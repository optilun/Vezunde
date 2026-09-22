import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  isValidEmail,
  firstValidEmail,
  isContactSuppressed,
  complianceMissing,
  getPublicBaseUrl,
  DEFAULT_FROM_EMAIL,
  DEFAULT_CONTACT_EMAIL,
} from '../../shared/outreachEmailPolicy.js';
import {
  normalizeCategory,
  normalizeAudienceSources,
  contactKind,
  contactMatchesFilters,
  computeAudienceRows,
  audienceRowView,
  buildSuppressionMap,
  summarizeCampaignLogs,
  logOutcome,
  notSentReason,
} from '../../shared/outreachAudiencePolicy.js';
import { composeOutreachEmail } from '../../shared/outreachComposer.js';
import {
  normalizeDailySendLimit,
  effectiveDailyLimit,
  summarizeSendsByDay,
  healthBaselineFrom,
  HEALTH_PAUSE_REASONS,
  emailDomain,
  lookupEmailDomains,
  isDomainUndeliverable,
  DOMAIN_STATUSES,
} from '../../shared/outreachSendSafety.js';

// outreachCampaignOps — actiuni admin pentru modulul de outreach email (sabloane, segmentare,
// materializare contacte din director, campanii, aprobare cu confirmare tastata).
// Trimiterea efectiva (advance_campaign_sends) e in outreachSendOps.ts, pe cron, separat de
// acest handler care e apelat direct din admin (fara __automation_trigger).
//
// Model de conformitate: contactele materializate din director primesc automat
// lawful_basis: 'legitimate_interest' + provenienta (source_url/collection_date/source_type)
// preluata din ProviderLocation, dupa modelul deja folosit in productie de Optilun
// (base44 app 6984db05b4843f9d480897e9) pentru exact acelasi scenariu: marketing B2B catre
// adrese de contact publice ale unor firme.

// Fiecare locatie inseamna o scriere separata in baza de date (~0,1 s). La 300 per apel, functia
// depasea timpul maxim si sincronizarea se oprea pe la jumatatea primului lot (2026-09-21:
// 160 de contacte din ~1000 de locatii, toate alfabetic intre "9" si "E"). Interfata reia
// automat cu urmatorul lot, deci loturi mici nu costa nimic.
const SYNC_CHUNK_SIZE = 40;
const DEFAULT_LOCATION_LIST_LIMIT = 20000;

function clean(value) {
  return String(value ?? '').trim();
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function locationMatchesSegment(location, filters = {}) {
  const counties = Array.isArray(filters.target_counties) ? filters.target_counties : [];
  const providerTypes = Array.isArray(filters.target_provider_types) ? filters.target_provider_types : [];
  const controlStatuses = Array.isArray(filters.target_profile_control_status) ? filters.target_profile_control_status : [];
  if (counties.length && !counties.includes(location.county_name || location.county)) return false;
  if (providerTypes.length && !providerTypes.includes(location.provider_type)) return false;
  if (controlStatuses.length && !controlStatuses.includes(location.profile_control_status || 'directory')) return false;
  return true;
}

// Segmentarea reala a destinatarilor. Se aplica pe campurile contactului, nu ale locatiei: contactul
// e entitatea catre care se trimite, si el poarta judetul, tipul si starea profilului, copiate la
// materializare. Fara asta, filtrele de judet/tip de pe campanie erau acceptate in interfata dar
// ignorate la calculul listei — o campanie "doar Cluj, doar optici" ar fi plecat catre toata tara.
// Regulile (judet, tip, stare profil, tipul adresei, etichete) stau in
// shared/outreachAudiencePolicy.js, folosite la fel de lista de destinatari, aprobare si test.
function contactMatchesSegment(contact, filters = {}) {
  return contactMatchesFilters(contact, filters);
}

// ── Clasificarea contactelor materializate din director ──
// Prefixele sunt stabile, ca segmentarea sa poata tinti direct ("tip:optica", "retea:lant").
// Tag-urile puse manual de admin (fara prefix cunoscut) nu sunt atinse la resincronizare.
const AUTO_TAG_PREFIXES = ['tip:', 'retea:', 'profil:', 'adresa:'];

const PROVIDER_TYPE_TAGS = {
  optica_medicala: 'tip:optica',
  clinica_oftalmologica: 'tip:clinica',
  cabinet_oftalmologic: 'tip:cabinet-oftalmologic',
  cabinet_optometric: 'tip:cabinet-optometric',
  laborator_optic: 'tip:laborator',
  optometrist_independent: 'tip:optometrist',
  medic_oftalmolog_independent: 'tip:medic-oftalmolog',
};

// Marimea retelei conteaza pentru ton: unui lant de 12 optici i se scrie altfel decat unui cabinet
// cu o singura locatie.
function networkTag(locationCount) {
  if (!locationCount || locationCount <= 1) return 'retea:locatie-unica';
  if (locationCount <= 4) return 'retea:grup-mic';
  return 'retea:lant';
}

function buildAutoTags(location, locationCount) {
  return [
    PROVIDER_TYPE_TAGS[location.provider_type] || 'tip:necunoscut',
    networkTag(locationCount),
    `profil:${location.profile_control_status || 'directory'}`,
  ];
}

function mergeTags(existingTags, autoTags) {
  const manual = (Array.isArray(existingTags) ? existingTags : [])
    .filter((tag) => !AUTO_TAG_PREFIXES.some((prefix) => String(tag).startsWith(prefix)));
  return [...new Set([...manual, ...autoTags])];
}

function countLocationsByOrganization(locations) {
  const counts = new Map();
  for (const location of locations || []) {
    if (!location.organization_id) continue;
    counts.set(location.organization_id, (counts.get(location.organization_id) || 0) + 1);
  }
  return counts;
}

function tallyTags(entries) {
  const tally = {};
  for (const tags of entries) for (const tag of tags) tally[tag] = (tally[tag] || 0) + 1;
  return tally;
}

async function listAllLocations(svc) {
  return (await svc.entities.ProviderLocation.list('name', DEFAULT_LOCATION_LIST_LIMIT)) || [];
}

// Emailul spune "[FIRMA] apare deja in rezultate" — deci doar locatiile care chiar apar: aceeasi
// regula ca in patientRequestStatusPolicy (publicata, activa, nesuspendata). O locatie in ciorna
// sau suspendata nu primeste un email care afirma ceva fals despre ea.
function isLocationPublic(location) {
  return location?.status === 'publicata'
    && location?.active_status !== 'inactiva'
    && location?.profile_control_status !== 'suspended';
}

function isOutreachCandidate(location) {
  return isLocationPublic(location) && !!firstValidEmail(location?.public_email);
}

async function listAllLocationsWithEmail(svc) {
  const rows = await listAllLocations(svc);
  return rows.filter(isOutreachCandidate);
}

const SYNC_COMPARED_FIELDS = [
  'location_id', 'organization_id', 'company_name', 'city', 'county', 'provider_type',
  'profile_control_status', 'organization_location_count', 'email', 'normalized_email',
  'source_url', 'collection_date', 'source_type', 'lawful_basis',
  'email_scope', 'shared_location_count', 'shared_city_count', 'email_domain_status',
];

// La o resincronizare, marea majoritate a contactelor nu s-au schimbat (iar lanturile au zeci de
// locatii cu aceeasi adresa). Scrierea lor din nou costa timp fara niciun efect.
function syncPatchChangesContact(existing, patch) {
  for (const field of SYNC_COMPARED_FIELDS) {
    if (!(field in patch)) continue;
    if (String(existing?.[field] ?? '') !== String(patch[field] ?? '')) return true;
  }
  const before = [...(existing?.tags || [])].sort().join('|');
  const after = [...(patch.tags || [])].sort().join('|');
  return before !== after;
}

async function listAllContacts(svc) {
  return svc.entities.OutreachContact.list('-created_date', DEFAULT_LOCATION_LIST_LIMIT);
}

// O singura intrare per adresa de email (doua locatii ale aceleiasi firme pot publica aceeasi
// adresa): deduplicarea se face in computeAudienceRows, dupa ce contactele blocate (fara temei legal,
// suprimate etc.) au fost scoase, deci ramane mereu intrarea care chiar poate primi emailul.

// Specificatia audientei: categoria (din ce lista se poate dezabona), sursele (director / conturi),
// filtrele si ajustarile manuale. Aceeasi forma vine din ciorna din interfata sau din campanie.
function audienceSpecFrom(source = {}) {
  const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
  return {
    category: normalizeCategory(source.category),
    audience_sources: normalizeAudienceSources(source.audience_sources),
    audience_mode: source.audience_mode === 'manual' ? 'manual' : 'filters',
    included_contact_ids: list(source.included_contact_ids),
    excluded_contact_ids: list(source.excluded_contact_ids),
    target_counties: list(source.target_counties),
    target_provider_types: list(source.target_provider_types),
    target_profile_control_status: list(source.target_profile_control_status),
    target_tags: list(source.target_tags),
    target_email_scope: list(source.target_email_scope),
  };
}

// Cine primeste campania. Exclude adresele invalide, suprimate (respinse, reclamatii, dezabonate de
// la tot sau de la categoria campaniei), conturile inchise, domeniile care nu primesc email si
// contactele fara temei legal; o adresa apare o singura data.
async function computeAudience(svc, spec) {
  const [contacts, suppressionRows] = await Promise.all([
    listAllContacts(svc),
    svc.entities.OutreachSuppression.list('-updated_at', 20000).catch(() => []),
  ]);
  return computeAudienceRows(contacts || [], spec, buildSuppressionMap(suppressionRows || []));
}

async function eligibleContactsForSegment(svc, filters) {
  return (await computeAudience(svc, audienceSpecFrom(filters))).eligible;
}

async function writeAudit(svc, user, { entityId, actionType, note, previous, next }) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'OutreachCampaign',
    entity_id: entityId || '',
    action_type: actionType,
    changed_fields: next ? Object.keys(next) : [],
    previous_values: previous ? JSON.stringify(previous) : '',
    new_values: next ? JSON.stringify(next) : '',
    admin_user_id: user.id,
    admin_email: user.email,
    note: note || '',
    performed_at: new Date().toISOString(),
  }).catch((error) => console.error('outreachCampaignOps audit failed', actionType, error?.message || error));
}

// ── actiuni ──

async function actionListTemplates(svc) {
  const templates = await svc.entities.OutreachTemplate.list('-created_date', 200);
  return Response.json({ templates });
}

// Un sablon descrie emailul complet: categoria, subiectul, textul, butonul si daca arata fisa din
// director. Campania copiaza tot la alegere, deci o schimbare ulterioara a sablonului nu atinge
// campaniile deja pornite.
function templateFieldsFrom(payload, { partial = false } = {}) {
  const patch = {};
  const has = (key) => payload[key] !== undefined;
  if (!partial || has('name')) patch.name = clean(payload.name);
  if (!partial || has('subject')) patch.subject = clean(payload.subject);
  if (!partial || has('body')) patch.body = clean(payload.body);
  if (!partial || has('category')) patch.category = normalizeCategory(payload.category);
  if (!partial || has('cta_label')) patch.cta_label = clean(payload.cta_label);
  if (!partial || has('cta_url')) patch.cta_url = clean(payload.cta_url);
  if (!partial || has('show_listing_preview')) patch.show_listing_preview = payload.show_listing_preview !== false;
  if (has('campaign_type') && ['claim_notice', 'marketing'].includes(payload.campaign_type)) patch.campaign_type = payload.campaign_type;
  return patch;
}

async function actionCreateTemplate(svc, payload) {
  const fields = templateFieldsFrom(payload);
  if (!fields.name || !fields.subject || !fields.body) return Response.json({ error: 'name, subject si body sunt obligatorii' }, { status: 400 });
  const template = await svc.entities.OutreachTemplate.create({ campaign_type: 'marketing', ...fields });
  return Response.json({ template });
}

async function actionUpdateTemplate(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const template = await svc.entities.OutreachTemplate.update(id, templateFieldsFrom(payload, { partial: true }));
  return Response.json({ template });
}

async function actionDeleteTemplate(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  await svc.entities.OutreachTemplate.delete(id);
  return Response.json({ success: true });
}

async function actionPreviewSegment(svc, payload) {
  const spec = audienceSpecFrom(payload);
  const locations = await listAllLocationsWithEmail(svc);
  const matchingLocations = locations.filter((location) => locationMatchesSegment(location, spec));
  const audience = await computeAudience(svc, spec);
  const blocked = audience.counts.blocked;
  const directoryCandidates = audience.rows.filter((row) => row.kind === 'directory').length;

  // Numarul real de emailuri trimise e numarul de ADRESE distincte care pot primi emailul: acelasi
  // numar pe care il cere si fraza de confirmare la aprobare.
  return Response.json({
    directory_locations_matching: matchingLocations.length,
    directory_locations_total_with_email: locations.length,
    contacts_materialized_matching: audience.counts.candidates,
    contacts_eligible_for_send: audience.counts.eligible,
    contacts_excluded_manually: audience.counts.excluded,
    contacts_duplicate_emails: blocked.duplicate || 0,
    contacts_suppressed: (blocked.suppressed || 0) + (blocked.unsubscribed_category || 0),
    contacts_undeliverable_domain: blocked.undeliverable_domain || 0,
    contacts_missing_compliance_metadata: blocked.missing_compliance || 0,
    contacts_blocked_until_compliance_completed: blocked.missing_compliance || 0,
    not_yet_materialized: spec.audience_sources.includes('directory')
      ? Math.max(0, matchingLocations.length - directoryCandidates)
      : 0,
  });
}

// Lista reala de destinatari pentru pasul "Destinatari": fiecare contact cu motivul pentru care nu
// primeste (daca e cazul), plus valorile disponibile pentru filtre (judete, tipuri).
async function actionListRecipients(svc, payload) {
  const spec = audienceSpecFrom(payload);
  const audience = await computeAudience(svc, spec);
  const contacts = await listAllContacts(svc);
  const inSources = (contacts || []).filter((contact) => spec.audience_sources.includes(contactKind(contact)));
  const distinct = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ro'));
  return Response.json({
    category: audience.category,
    counts: audience.counts,
    rows: audience.rows.map(audienceRowView),
    facets: {
      counties: distinct(inSources.map((contact) => contact.county)),
      provider_types: distinct(inSources.map((contact) => contact.provider_type)),
      sources: {
        directory: (contacts || []).filter((contact) => contactKind(contact) === 'directory').length,
        provider_account: (contacts || []).filter((contact) => contactKind(contact) === 'provider_account').length,
      },
    },
  });
}

// Cautare pentru "Adauga manual": orice contact, din orice sursa, dupa nume, email sau oras.
async function actionSearchContacts(svc, payload) {
  const term = clean(payload.query).toLowerCase();
  if (term.length < 2) return Response.json({ contacts: [] });
  const contacts = await listAllContacts(svc);
  const matches = (contacts || [])
    .filter((contact) => [contact.company_name, contact.contact_name, contact.email, contact.city]
      .some((value) => String(value || '').toLowerCase().includes(term)))
    .slice(0, 40)
    .map((contact) => ({
      id: contact.id,
      company_name: contact.company_name || '',
      email: normalizeEmail(contact.normalized_email || contact.email),
      city: contact.city || '',
      kind: contactKind(contact),
    }));
  return Response.json({ contacts: matches });
}

// Emailul exact, asa cum il primeste un destinatar ales (sau un exemplu), fara sa trimita nimic.
// Ciorna nesalvata din interfata poate suprascrie continutul campaniei.
async function actionRenderPreview(svc, payload) {
  const id = clean(payload.id);
  const campaign = id ? await svc.entities.OutreachCampaign.get(id).catch(() => null) : null;
  const overrides = {};
  for (const key of ['category', 'subject', 'body_html', 'cta_label', 'cta_url', 'show_listing_preview']) {
    if (payload[key] !== undefined) overrides[key] = payload[key];
  }
  const merged = { ...(campaign || {}), ...overrides };
  const contactId = clean(payload.contact_id);
  const contact = (contactId ? await svc.entities.OutreachContact.get(contactId).catch(() => null) : null) || {
    company_name: 'Optica Exemplu', provider_type: 'optica_medicala', city: 'Bucuresti', county: 'Bucuresti',
    profile_control_status: 'directory', email: 'exemplu@optica.ro',
  };
  const composed = composeOutreachEmail(merged, contact, { unsubscribeUrl: `${getPublicBaseUrl()}/dezabonare` });
  return Response.json({
    subject: composed.subject,
    html: composed.html,
    recipient: { company_name: contact.company_name || '', email: normalizeEmail(contact.normalized_email || contact.email), kind: contactKind(contact) },
  });
}

// Un contact = o adresa de email. Candidatii (deja sortati dupa nume) se grupeaza pe adresa, iar
// fiecare grup se scrie O SINGURA DATA per sincronizare. Inainte se scria per locatie: cele 79 de
// locatii Lensa cu aceeasi adresa rescriau acelasi contact de 79 de ori la rand, fiecare data cu
// alt nume si alt oras, iar sincronizarea murea exact acolo (2026-09-21, de doua ori la "Lensa").
function groupCandidatesByEmail(candidates) {
  const groups = new Map();
  for (const location of candidates) {
    const email = firstValidEmail(location.public_email);
    if (!email) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(location);
  }
  return [...groups.entries()].map(([email, locations]) => ({ email, locations }));
}

// Numele afisat pentru o adresa folosita de mai multe locatii ale ACELEIASI organizatii e numele
// organizatiei ("Lensa"), nu numele primei sucursale ("Lensa Bacau — Hello Shopping Park"):
// emailul ajunge la sediu, nu la un magazin.
// Si cand adresa e comuna mai multor organizatii inrudite (Vitreum SRL / Vitreum Medical / ...),
// numele organizatiei primei locatii e mai potrivit decat numele unei sucursale ("Cabinet
// Oftalmologic Vitreum Baia Mare — Regele Mihai I" pentru un email trimis la 19 locatii).
function groupDisplayName(group, organizationsById) {
  const representative = group.locations[0];
  const locationName = representative.public_display_name || representative.name || '';
  if (group.locations.length < 2) return locationName;
  const organization = organizationsById.get(representative.organization_id || '');
  return organization?.public_display_name || organization?.name || locationName;
}

// A cui e adresa. O adresa folosita de o singura locatie e a locatiei; una folosita de mai multe
// locatii (Lensa: 79) e a organizatiei — de obicei sediul. Campaniile le pot tinti separat, cu alt
// text: sediul unui lant nu trebuie sa primeasca un email despre "profilul din Alba Iulia".
function groupAddressScope(group) {
  const sharedLocationCount = group.locations.length;
  const sharedCityCount = new Set(group.locations.map((row) => row.locality_name || row.city || '').filter(Boolean)).size || 1;
  const emailScope = sharedLocationCount > 1 ? 'organization' : 'location';
  return {
    emailScope,
    sharedLocationCount,
    sharedCityCount,
    tag: emailScope === 'organization' ? 'adresa:organizatie' : 'adresa:locatie',
  };
}

async function listAllOrganizationsById(svc) {
  const rows = (await svc.entities.ProviderOrganization.list('name', DEFAULT_LOCATION_LIST_LIMIT)) || [];
  return new Map(rows.map((row) => [row.id, row]));
}

async function actionSyncContactsFromDirectory(svc, user, payload) {
  const filters = {
    target_counties: payload.target_counties,
    target_provider_types: payload.target_provider_types,
    target_profile_control_status: payload.target_profile_control_status,
  };
  const cursor = Math.max(0, Number(payload.cursor) || 0);

  // Numaram locatiile pe organizatie peste TOATE locatiile, nu doar cele cu email: un lant are
  // 12 locatii chiar daca doar 3 publica o adresa de contact.
  const everyLocation = await listAllLocations(svc);
  const locationCounts = countLocationsByOrganization(everyLocation);
  const allLocations = everyLocation.filter(isOutreachCandidate);
  const candidates = allLocations.filter((location) => locationMatchesSegment(location, filters));
  const groups = groupCandidatesByEmail(candidates);
  const chunk = groups.slice(cursor, cursor + SYNC_CHUNK_SIZE);

  const [existingContacts, organizationsById] = await Promise.all([
    listAllContacts(svc),
    listAllOrganizationsById(svc),
  ]);
  // Doar contactele din director: un furnizor cu cont are propriul contact (sincronizat separat),
  // chiar daca adresa lui e si adresa publica a locatiei.
  const directoryContacts = (existingContacts || []).filter((c) => contactKind(c) === 'directory');
  const byNormalizedEmail = new Map(directoryContacts.map((c) => [normalizeEmail(c.normalized_email || c.email), c]));
  const byLocationId = new Map(directoryContacts.filter((c) => c.location_id).map((c) => [c.location_id, c]));

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let undeliverableDomains = 0;
  let dnsErrorDomains = 0;

  // Domeniul fiecarei adrese din lot se verifica acum (MX), ca previzualizarea si aprobarea sa
  // numere doar adresele care pot primi email. Se reverifica la fiecare sincronizare: o adresa
  // reparata intre timp redevine eligibila.
  const domainCache = await lookupEmailDomains(chunk.map((group) => emailDomain(group.email)));

  for (const group of chunk) {
    const { email } = group;
    const location = group.locations[0];
    const domainStatus = domainCache.get(emailDomain(email)) || 'lookup_failed';
    if (isDomainUndeliverable(domainStatus)) undeliverableDomains++;
    if (domainStatus === 'dns_error') dnsErrorDomains++;
    // 'lookup_failed' (n-am putut intreba DNS-ul) nu suprascrie un rezultat anterior.
    const domainFields = DOMAIN_STATUSES.includes(domainStatus) ? { email_domain_status: domainStatus } : {};
    const existing = byNormalizedEmail.get(email)
      || group.locations.map((row) => byLocationId.get(row.id)).find(Boolean);
    const locationCount = location.organization_id ? (locationCounts.get(location.organization_id) || 1) : 1;
    const scope = groupAddressScope(group);
    const autoTags = [...buildAutoTags(location, locationCount), scope.tag];
    const descriptive = {
      location_id: location.id,
      organization_id: location.organization_id || '',
      company_name: groupDisplayName(group, organizationsById),
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      provider_type: location.provider_type || '',
      profile_control_status: location.profile_control_status || 'directory',
      organization_location_count: locationCount,
      email_scope: scope.emailScope,
      shared_location_count: scope.sharedLocationCount,
      shared_city_count: scope.sharedCityCount,
      email,
      normalized_email: email,
      ...domainFields,
    };

    if (existing) {
      const patch = { ...descriptive, tags: mergeTags(existing.tags, autoTags) };
      if (domainFields.email_domain_status && domainFields.email_domain_status !== existing.email_domain_status) {
        patch.email_domain_checked_at = now;
      }
      // Nu suprascriem status/email_status/consent_audit puse manual de admin. Tag-urile se
      // reimprospateaza doar pe prefixele automate (vezi mergeTags) — cele adaugate de mana raman.
      if (!existing.source_url && location.source_url) patch.source_url = location.source_url;
      if (!existing.collection_date && (location.collected_at || location.source_checked_at)) {
        patch.collection_date = location.collected_at || location.source_checked_at;
      }
      if (!existing.source_type) patch.source_type = location.source_type || 'public_directory';
      if (!existing.lawful_basis) patch.lawful_basis = 'legitimate_interest';
      if (!syncPatchChangesContact(existing, patch)) {
        unchanged++;
        continue;
      }
      await svc.entities.OutreachContact.update(existing.id, patch);
      updated++;
    } else {
      const createdContact = await svc.entities.OutreachContact.create({
        ...descriptive,
        contact_kind: 'directory',
        tags: autoTags,
        ...(domainFields.email_domain_status ? { email_domain_checked_at: now } : {}),
        status: 'new',
        email_status: 'active',
        source: 'public_directory',
        lawful_basis: 'legitimate_interest',
        source_url: location.source_url || '',
        collection_date: location.collected_at || location.source_checked_at || now,
        source_type: location.source_type || 'public_directory',
        lia_notes: 'Adresa publica de contact business, preluata din directorul national VIASEE (pipeline de import). Interes legitim: comunicare relevanta pentru optici/clinici/cabinete listate, cu dezabonare cu un click.',
        consent_audit: [{ at: now, source: 'sync_contacts_from_directory', action: 'created' }],
        last_status_change_at: now,
      });
      if (createdContact) byNormalizedEmail.set(email, createdContact);
      created++;
    }
  }

  const nextCursor = cursor + chunk.length;
  const hasMore = nextCursor < groups.length;
  // Distributia se calculeaza peste toate adresele, nu doar peste lotul curent, ca numerele sa
  // fie citibile ca imagine de ansamblu inca de la primul lot.
  const breakdown = tallyTags(groups.map((group) => [
    ...buildAutoTags(
      group.locations[0],
      group.locations[0].organization_id ? (locationCounts.get(group.locations[0].organization_id) || 1) : 1,
    ),
    groupAddressScope(group).tag,
  ]));

  return Response.json({
    created,
    updated,
    unchanged,
    skipped,
    unique_emails: groups.length,
    processed: chunk.length,
    undeliverable_domains: undeliverableDomains,
    dns_error_domains: dnsErrorDomains,
    total_candidates: candidates.length,
    next_cursor: nextCursor,
    has_more: hasMore,
    breakdown,
  });
}

// O campanie noua porneste din categorie + (optional) un sablon din aceeasi categorie: subiectul,
// textul si butonul se copiaza din sablon; tot ce vine explicit in payload are prioritate.
// Anunturile pleaca implicit si catre furnizorii cu cont, fara fisa din director.
// ── Furnizorii cu cont ca destinatari ──
// Fiecare utilizator cu acces activ la o organizatie devine un contact de tip provider_account
// (unul per utilizator, nu per adresa din director). Temeiul e relatia contractuala (contul);
// dezabonarea ramane pe categorii. Cine nu mai are acces activ ramane in lista, dar nu mai
// primeste campanii (account_active: false).
const ACCOUNT_COMPARED_FIELDS = [
  'organization_id', 'company_name', 'contact_name', 'email', 'normalized_email', 'city', 'county',
  'provider_type', 'profile_control_status', 'organization_location_count', 'shared_location_count',
  'shared_city_count', 'email_domain_status', 'account_active',
];

async function actionSyncProviderAccounts(svc) {
  const memberships = await svc.entities.ProviderMembership.filter({ status: 'active' }, '-created_date', 5000).catch(() => []);
  const orgIdsByUser = new Map();
  for (const membership of memberships || []) {
    if (!membership.user_id || !membership.organization_id) continue;
    if (!orgIdsByUser.has(membership.user_id)) orgIdsByUser.set(membership.user_id, []);
    orgIdsByUser.get(membership.user_id).push(membership.organization_id);
  }

  const [organizationsById, everyLocation, contacts] = await Promise.all([
    listAllOrganizationsById(svc),
    listAllLocations(svc),
    listAllContacts(svc),
  ]);
  const locationsByOrg = new Map();
  for (const location of everyLocation || []) {
    if (!location.organization_id) continue;
    if (!locationsByOrg.has(location.organization_id)) locationsByOrg.set(location.organization_id, []);
    locationsByOrg.get(location.organization_id).push(location);
  }
  const accountContacts = (contacts || []).filter((contact) => contactKind(contact) === 'provider_account');
  const byUserId = new Map(accountContacts.filter((c) => c.user_id).map((c) => [c.user_id, c]));

  const users = [];
  for (const userId of orgIdsByUser.keys()) {
    const account = await svc.entities.User.get(userId).catch(() => null);
    if (account) users.push(account);
  }
  const domainCache = await lookupEmailDomains(users.map((account) => emailDomain(normalizeEmail(account.email))));

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let deactivated = 0;
  const activeUserIds = new Set();

  for (const account of users) {
    const email = normalizeEmail(account.email);
    if (!email || !isValidEmail(email)) { skipped++; continue; }
    activeUserIds.add(account.id);
    const organizationId = orgIdsByUser.get(account.id)[0];
    const organization = organizationsById.get(organizationId);
    const locations = (locationsByOrg.get(organizationId) || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ro'));
    const first = locations[0] || {};
    const domainStatus = domainCache.get(emailDomain(email)) || 'lookup_failed';
    const descriptive = {
      contact_kind: 'provider_account',
      user_id: account.id,
      account_active: true,
      organization_id: organizationId,
      company_name: organization?.public_display_name || organization?.name || first.name || '',
      contact_name: account.full_name || '',
      email,
      normalized_email: email,
      city: first.locality_name || first.city || '',
      county: first.county_name || first.county || '',
      provider_type: first.provider_type || '',
      profile_control_status: first.profile_control_status || 'claimed',
      organization_location_count: locations.length,
      email_scope: 'organization',
      shared_location_count: Math.max(1, locations.length),
      shared_city_count: new Set(locations.map((row) => row.locality_name || row.city || '').filter(Boolean)).size || 1,
      ...(DOMAIN_STATUSES.includes(domainStatus) ? { email_domain_status: domainStatus } : {}),
    };
    const existing = byUserId.get(account.id);
    if (existing) {
      const changed = ACCOUNT_COMPARED_FIELDS.some((field) => field in descriptive && String(existing[field] ?? '') !== String(descriptive[field] ?? ''));
      if (!changed) { unchanged++; continue; }
      await svc.entities.OutreachContact.update(existing.id, {
        ...descriptive,
        ...(descriptive.email_domain_status && descriptive.email_domain_status !== existing.email_domain_status ? { email_domain_checked_at: now } : {}),
      });
      updated++;
    } else {
      await svc.entities.OutreachContact.create({
        ...descriptive,
        ...(descriptive.email_domain_status ? { email_domain_checked_at: now } : {}),
        tags: [],
        status: 'new',
        email_status: 'active',
        source: 'provider_account',
        lawful_basis: 'contract',
        source_url: `${getPublicBaseUrl()}/contul-meu`,
        collection_date: account.created_date || now,
        source_type: 'provider_account',
        lia_notes: 'Utilizator cu cont de furnizor VIASEE: anunturi despre platforma si comunicari legate de profil, cu dezabonare pe categorii.',
        consent_audit: [{ at: now, source: 'sync_provider_accounts', action: 'created' }],
        last_status_change_at: now,
      });
      created++;
    }
  }

  for (const contact of accountContacts) {
    if (!contact.user_id || activeUserIds.has(contact.user_id) || contact.account_active === false) continue;
    await svc.entities.OutreachContact.update(contact.id, { account_active: false, last_status_change_at: now }).catch(() => null);
    deactivated++;
  }

  return Response.json({ created, updated, unchanged, skipped, deactivated, active_accounts: activeUserIds.size });
}

// ── Raport ──

// Raportul unei campanii se calculeaza din jurnalul complet (nu din ultimele intrari), iar
// destinatarii la care inca nu s-a ajuns apar ca "in asteptare".
async function actionCampaignReport(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  const [logs, contacts] = await Promise.all([
    svc.entities.OutreachCampaignLog.filter({ campaign_id: id }, '-created_date', 20000).catch(() => []),
    listAllContacts(svc),
  ]);
  const contactsById = new Map((contacts || []).map((contact) => [contact.id, contact]));
  const summary = summarizeCampaignLogs(logs || [], campaign.recipient_count);
  const describe = (contactId) => {
    const contact = contactsById.get(contactId) || {};
    return { company_name: contact.company_name || '', city: contact.city || '', kind: contactKind(contact) };
  };
  const loggedContactIds = new Set();
  const rows = (logs || []).map((log) => {
    if (log.contact_id) loggedContactIds.add(log.contact_id);
    const outcome = logOutcome(log);
    return {
      id: log.id,
      contact_id: log.contact_id || '',
      email: normalizeEmail(log.normalized_email || log.email),
      ...describe(log.contact_id),
      outcome,
      reason: outcome === 'not_sent' ? notSentReason(log) : '',
      error: log.error || '',
      sent_at: log.sent_at || '',
      delivered_at: log.delivered_at || '',
      bounced_at: log.bounced_at || '',
    };
  });
  for (const contactId of Array.isArray(campaign.recipient_contact_ids) ? campaign.recipient_contact_ids : []) {
    if (loggedContactIds.has(contactId)) continue;
    const contact = contactsById.get(contactId) || {};
    rows.push({
      id: `queued:${contactId}`,
      contact_id: contactId,
      email: normalizeEmail(contact.normalized_email || contact.email),
      ...describe(contactId),
      outcome: 'queued',
      reason: '', error: '', sent_at: '', delivered_at: '', bounced_at: '',
    });
  }
  return Response.json({
    campaign: {
      id: campaign.id, name: campaign.name, category: normalizeCategory(campaign.category), status: campaign.status,
      subject: campaign.subject, approved_at: campaign.approved_at || '', sent_at: campaign.sent_at || '',
    },
    summary,
    rows,
  });
}

// Imaginea de ansamblu din lista de campanii: cat s-a trimis si livrat pe fiecare categorie, cati
// destinatari sunt disponibili pe fiecare sursa si cati s-au dezabonat.
async function actionOutreachOverview(svc) {
  const [campaigns, contacts, suppressions] = await Promise.all([
    svc.entities.OutreachCampaign.list('-created_date', 500).catch(() => []),
    listAllContacts(svc),
    svc.entities.OutreachSuppression.list('-updated_at', 20000).catch(() => []),
  ]);
  const byCategory = {};
  for (const category of ['marketing', 'announcement']) {
    byCategory[category] = { campaigns: 0, active: 0, sent: 0, delivered: 0, bounced: 0, complained: 0 };
  }
  for (const campaign of campaigns || []) {
    const bucket = byCategory[normalizeCategory(campaign.category)];
    bucket.campaigns += 1;
    if (['ready', 'sending', 'paused'].includes(campaign.status)) bucket.active += 1;
    bucket.sent += Number(campaign.sent_count) || 0;
    bucket.delivered += Number(campaign.delivered_count) || 0;
    bucket.bounced += Number(campaign.bounced_count) || 0;
    bucket.complained += Number(campaign.complained_count) || 0;
  }
  const unsubscribed = { marketing: 0, announcement: 0, all: 0 };
  for (const [, categories] of buildSuppressionMap(suppressions || [])) {
    if (categories.has('all')) { unsubscribed.all += 1; continue; }
    if (categories.has('marketing')) unsubscribed.marketing += 1;
    if (categories.has('announcement')) unsubscribed.announcement += 1;
  }
  const list = contacts || [];
  return Response.json({
    by_category: byCategory,
    contacts: {
      directory: list.filter((contact) => contactKind(contact) === 'directory').length,
      provider_account: list.filter((contact) => contactKind(contact) === 'provider_account' && contact.account_active !== false).length,
    },
    suppressed: unsubscribed,
  });
}

async function actionCreateCampaign(svc, user, payload) {
  const name = clean(payload.name);
  const category = normalizeCategory(payload.category);
  const templateId = clean(payload.template_id);
  const template = templateId ? await svc.entities.OutreachTemplate.get(templateId).catch(() => null) : null;
  if (templateId && !template) return Response.json({ error: 'Sablonul ales nu mai exista' }, { status: 404 });
  if (template && normalizeCategory(template.category) !== category) {
    return Response.json({ error: 'Sablonul e din alta categorie decat campania' }, { status: 400 });
  }
  const pick = (key, templateKey = key) => (payload[key] !== undefined && clean(payload[key]) !== '' ? clean(payload[key]) : clean(template?.[templateKey]));
  const subject = pick('subject');
  if (!name || !subject) return Response.json({ error: 'Numele campaniei si subiectul (sau un sablon) sunt obligatorii' }, { status: 400 });

  const defaults = category === 'announcement'
    ? { audience_sources: ['provider_account', 'directory'], show_listing_preview: false }
    : { audience_sources: ['directory'], show_listing_preview: true };
  const showListingPreview = payload.show_listing_preview !== undefined
    ? payload.show_listing_preview !== false
    : (template ? template.show_listing_preview !== false && category === 'marketing' : defaults.show_listing_preview);
  const spec = audienceSpecFrom({ ...payload, category, audience_sources: payload.audience_sources || defaults.audience_sources });
  const audience = await computeAudience(svc, spec);

  const campaign = await svc.entities.OutreachCampaign.create({
    name,
    category,
    campaign_type: ['claim_notice', 'marketing'].includes(payload.campaign_type) ? payload.campaign_type : (template?.campaign_type || 'marketing'),
    template_id: template?.id || '',
    subject,
    body_html: pick('body_html', 'body'),
    cta_label: pick('cta_label'),
    cta_url: pick('cta_url'),
    show_listing_preview: showListingPreview,
    from_name: clean(payload.from_name) || 'VIASEE',
    from_email: clean(payload.from_email) || DEFAULT_FROM_EMAIL,
    reply_to_email: clean(payload.reply_to_email) || DEFAULT_CONTACT_EMAIL,
    audience_sources: spec.audience_sources,
    audience_mode: spec.audience_mode,
    included_contact_ids: spec.included_contact_ids,
    excluded_contact_ids: spec.excluded_contact_ids,
    target_counties: spec.target_counties,
    target_provider_types: spec.target_provider_types,
    target_profile_control_status: spec.target_profile_control_status,
    target_tags: spec.target_tags,
    target_email_scope: spec.target_email_scope,
    daily_send_limit: normalizeDailySendLimit(payload.daily_send_limit),
    daily_send_ramp: payload.daily_send_ramp !== false,
    status: 'draft',
    recipient_count: audience.counts.eligible,
    created_by_user_id: user.id,
  });

  await writeAudit(svc, user, { entityId: campaign.id, actionType: 'outreach_campaign_created', note: `Campanie creata (${category}), ${audience.counts.eligible} destinatari eligibili estimati`, next: { name, category, template_id: template?.id || '', recipient_count: audience.counts.eligible } });
  return Response.json({ campaign });
}

async function actionUpdateCampaign(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (campaign.status !== 'draft') return Response.json({ error: 'Doar campaniile in stare draft pot fi editate' }, { status: 409 });

  const editable = ['name', 'category', 'campaign_type', 'template_id', 'subject', 'body_html', 'cta_label', 'cta_url', 'show_listing_preview', 'from_name', 'from_email', 'reply_to_email', 'audience_sources', 'audience_mode', 'included_contact_ids', 'excluded_contact_ids', 'target_counties', 'target_provider_types', 'target_profile_control_status', 'target_tags', 'target_email_scope', 'daily_send_limit', 'daily_send_ramp'];
  const patch = {};
  for (const key of editable) if (payload[key] !== undefined) patch[key] = payload[key];
  if (patch.category !== undefined) patch.category = normalizeCategory(patch.category);
  if (patch.audience_sources !== undefined) patch.audience_sources = normalizeAudienceSources(patch.audience_sources);
  if (patch.audience_mode !== undefined) patch.audience_mode = patch.audience_mode === 'manual' ? 'manual' : 'filters';
  for (const key of ['included_contact_ids', 'excluded_contact_ids']) {
    if (patch[key] !== undefined) patch[key] = [...new Set((Array.isArray(patch[key]) ? patch[key] : []).filter(Boolean))];
  }
  if (patch.daily_send_limit !== undefined) patch.daily_send_limit = normalizeDailySendLimit(patch.daily_send_limit);
  if (patch.daily_send_ramp !== undefined) patch.daily_send_ramp = patch.daily_send_ramp !== false;
  const updated = await svc.entities.OutreachCampaign.update(id, patch);
  return Response.json({ campaign: updated });
}

async function actionListCampaigns(svc) {
  const campaigns = await svc.entities.OutreachCampaign.list('-created_date', 200);
  return Response.json({ campaigns });
}

async function actionGetCampaign(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  const logs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: id }, '-created_date', Number(payload.log_limit) || 200).catch(() => []);
  // Ritmul de azi se calculeaza peste tot jurnalul, nu doar peste ultimele intrari afisate:
  // cresterea automata depinde de cate zile de trimitere au fost de la inceput.
  let sendStats = null;
  if (campaign.status !== 'draft') {
    const allLogs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: id }, '-created_date', 20000).catch(() => []);
    const sends = summarizeSendsByDay(allLogs || []);
    sendStats = {
      sent_today: sends.sentToday,
      prior_sending_days: sends.priorSendingDays,
      daily_limit_today: effectiveDailyLimit(campaign, sends.priorSendingDays),
    };
  }
  return Response.json({ campaign, logs, send_stats: sendStats });
}

async function actionApproveCampaign(svc, user, payload) {
  const id = clean(payload.id);
  const confirmationText = clean(payload.confirmation_text);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (campaign.status !== 'draft') return Response.json({ error: 'Doar campaniile in stare draft pot fi aprobate' }, { status: 409 });
  if (!clean(campaign.from_email) || !clean(campaign.body_html)) {
    return Response.json({ error: 'Campania trebuie sa aiba from_email si body_html completate inainte de aprobare' }, { status: 400 });
  }

  // Exact lista din pasul "Destinatari": filtre, surse, bife si adaugari manuale, categoria.
  const eligible = await eligibleContactsForSegment(svc, campaign);
  const expectedConfirmation = `TRIMITE ${campaign.name} ${eligible.length}`;

  if (!confirmationText) {
    return Response.json({ error: 'confirmation_text este obligatoriu', expected_confirmation: expectedConfirmation, recipient_count: eligible.length }, { status: 400 });
  }
  if (confirmationText !== expectedConfirmation) {
    return Response.json({ error: 'Textul de confirmare nu se potriveste', expected_confirmation: expectedConfirmation, recipient_count: eligible.length }, { status: 400 });
  }

  const approvalHash = await sha256Hex(expectedConfirmation);
  const now = new Date().toISOString();
  const updated = await svc.entities.OutreachCampaign.update(id, {
    status: 'ready',
    recipient_contact_ids: eligible.map((c) => c.id),
    recipient_count: eligible.length,
    current_cursor: 0,
    approval_token_hash: approvalHash,
    approved_by_user_id: user.id,
    approved_at: now,
  });

  await writeAudit(svc, user, { entityId: id, actionType: 'outreach_campaign_approved', note: `Aprobata pentru trimitere catre ${eligible.length} destinatari`, next: { status: 'ready', recipient_count: eligible.length } });
  return Response.json({ campaign: updated });
}

async function actionSetCampaignStatus(svc, user, payload, { allowedFrom, to, actionType, extraPatch = () => ({}) }) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (!allowedFrom.includes(campaign.status)) {
    return Response.json({ error: `Campania trebuie sa fie in una din starile: ${allowedFrom.join(', ')}` }, { status: 409 });
  }
  const patch = { status: to, ...extraPatch(campaign) };
  const updated = await svc.entities.OutreachCampaign.update(id, patch);
  await writeAudit(svc, user, { entityId: id, actionType, previous: { status: campaign.status, pause_reason: campaign.pause_reason || '' }, next: patch });
  return Response.json({ campaign: updated });
}

// Reluarea unei campanii oprite automat: adminul a vazut motivul si a decis sa continue. Oprirea
// automata porneste de la zero de aici (health_baseline), altfel s-ar declansa imediat din nou pe
// aceleasi respingeri. O pauza pusa de admin nu reseteaza nimic.
function resumePatch(campaign) {
  const patch = { pause_reason: '', failure_message: '' };
  if (HEALTH_PAUSE_REASONS.has(campaign.pause_reason)) patch.health_baseline = healthBaselineFrom(campaign);
  return patch;
}

// Limita zilnica se poate schimba si in timpul trimiterii (ex. o crestere manuala dupa ce primele
// zile au mers bine). Asteptarea pana maine se anuleaza: trimitatorul recalculeaza la urmatorul
// ciclu si o repune doar daca noua limita e tot atinsa.
async function actionSetDailySendLimit(svc, user, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (!['draft', 'ready', 'sending', 'paused'].includes(campaign.status)) {
    return Response.json({ error: 'Limita se poate schimba doar la o campanie care nu s-a incheiat' }, { status: 409 });
  }
  const patch = {
    daily_send_limit: normalizeDailySendLimit(payload.daily_send_limit),
    daily_send_ramp: payload.daily_send_ramp !== false,
    next_send_after: null,
  };
  const updated = await svc.entities.OutreachCampaign.update(id, patch);
  await writeAudit(svc, user, {
    entityId: id,
    actionType: 'outreach_campaign_daily_limit_changed',
    previous: { daily_send_limit: campaign.daily_send_limit ?? null, daily_send_ramp: campaign.daily_send_ramp ?? null },
    next: { daily_send_limit: patch.daily_send_limit, daily_send_ramp: patch.daily_send_ramp },
  });
  return Response.json({ campaign: updated });
}

async function actionMarkReplied(svc, payload) {
  const logId = clean(payload.log_id);
  const contactId = clean(payload.contact_id);
  const now = new Date().toISOString();

  if (logId) {
    await svc.entities.OutreachCampaignLog.update(logId, { status: 'replied', replied_at: now }).catch(() => null);
  }
  if (contactId) {
    const contact = await svc.entities.OutreachContact.get(contactId).catch(() => null);
    if (contact && !['unsubscribed', 'converted'].includes(contact.status)) {
      await svc.entities.OutreachContact.update(contactId, { status: 'replied', last_status_change_at: now }).catch(() => null);
    }
  }
  return Response.json({ success: true });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces permis doar administratorilor VIASEE' }, { status: 403 });
    const svc = base44.asServiceRole;

    const payload = await req.json().catch(() => ({}));
    const action = clean(payload?.action);
    if (!isPlainObject(payload)) return Response.json({ error: 'Payload invalid' }, { status: 400 });

    switch (action) {
      case 'list_templates': return await actionListTemplates(svc);
      case 'create_template': return await actionCreateTemplate(svc, payload);
      case 'update_template': return await actionUpdateTemplate(svc, payload);
      case 'delete_template': return await actionDeleteTemplate(svc, payload);
      case 'preview_segment': return await actionPreviewSegment(svc, payload);
      case 'list_recipients': return await actionListRecipients(svc, payload);
      case 'search_contacts': return await actionSearchContacts(svc, payload);
      case 'render_preview': return await actionRenderPreview(svc, payload);
      case 'sync_provider_accounts': return await actionSyncProviderAccounts(svc);
      case 'campaign_report': return await actionCampaignReport(svc, payload);
      case 'outreach_overview': return await actionOutreachOverview(svc);
      case 'sync_contacts_from_directory': return await actionSyncContactsFromDirectory(svc, user, payload);
      case 'create_campaign': return await actionCreateCampaign(svc, user, payload);
      case 'update_campaign': return await actionUpdateCampaign(svc, payload);
      case 'list_campaigns': return await actionListCampaigns(svc);
      case 'get_campaign': return await actionGetCampaign(svc, payload);
      case 'approve_campaign': return await actionApproveCampaign(svc, user, payload);
      case 'pause_campaign': return await actionSetCampaignStatus(svc, user, payload, { allowedFrom: ['ready', 'sending'], to: 'paused', actionType: 'outreach_campaign_paused', extraPatch: () => ({ pause_reason: 'admin' }) });
      case 'resume_campaign': return await actionSetCampaignStatus(svc, user, payload, { allowedFrom: ['paused'], to: 'ready', actionType: 'outreach_campaign_resumed', extraPatch: resumePatch });
      case 'set_daily_send_limit': return await actionSetDailySendLimit(svc, user, payload);
      case 'cancel_campaign': return await actionSetCampaignStatus(svc, user, payload, { allowedFrom: ['draft', 'ready', 'sending', 'paused'], to: 'cancelled', actionType: 'outreach_campaign_cancelled' });
      case 'mark_replied': return await actionMarkReplied(svc, payload);
      default:
        return Response.json({ error: `Actiune necunoscuta: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('outreachCampaignOps failed', error?.message || error);
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
