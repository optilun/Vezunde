// outreachAudiencePolicy — cine primeste o campanie si ce s-a intamplat cu fiecare email.
// Logica pura (fara baza de date), folosita la fel de lista de destinatari din interfata, de
// aprobare si de raport, ca numerele sa nu difere intre ecrane:
//
// - categorii: marketing (prezentari, invitatii la revendicare) si announcement (anunturi despre
//   VIASEE). Fiecare are dezabonarea ei; respingerile si reclamatiile blocheaza tot.
// - surse: directory (adresele publice din director) si provider_account (furnizorii cu cont).
// - selectie: filtre, minus contactele debifate, plus cele adaugate de mana; sau doar de mana.

import {
  normalizeEmail,
  isSendableEmail,
  complianceMissing,
  isContactSuppressed,
} from './outreachEmailPolicy.js';
import { isDomainUndeliverable } from './outreachSendSafety.js';

export const OUTREACH_CATEGORIES = ['marketing', 'announcement'];
export const AUDIENCE_SOURCES = ['directory', 'provider_account'];

export function normalizeCategory(value) {
  return OUTREACH_CATEGORIES.includes(value) ? value : 'marketing';
}

export function normalizeAudienceSources(value) {
  const list = (Array.isArray(value) ? value : []).filter((source) => AUDIENCE_SOURCES.includes(source));
  return list.length ? [...new Set(list)] : ['directory'];
}

export function contactKind(contact) {
  return contact?.contact_kind === 'provider_account' ? 'provider_account' : 'directory';
}

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

// ── Suprimari pe categorii ──

// Inregistrarile vechi (fara categorii) blocau tot; raman asa.
export function suppressionCategories(row) {
  const list = asList(row?.categories);
  return list.length ? list : ['all'];
}

export function buildSuppressionMap(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.is_active === false) continue;
    const email = normalizeEmail(row?.normalized_email || row?.email);
    if (!email) continue;
    if (!map.has(email)) map.set(email, new Set());
    for (const category of suppressionCategories(row)) map.get(email).add(category);
  }
  return map;
}

export function isSuppressedFor(map, email, category) {
  const set = map?.get(normalizeEmail(email));
  return !!set && (set.has('all') || set.has(category));
}

// Dezabonarea dintr-o categorie se adauga la ce exista; 'all' le inghite pe toate.
export function mergeSuppressionCategories(existingRow, added = []) {
  const current = existingRow && existingRow.is_active !== false ? suppressionCategories(existingRow) : [];
  const merged = [...new Set([...current, ...asList(added)])];
  return merged.includes('all') ? ['all'] : merged;
}

// ── Filtre ──

export function contactMatchesFilters(contact, filters = {}) {
  const counties = asList(filters.target_counties);
  const providerTypes = asList(filters.target_provider_types);
  const controlStatuses = asList(filters.target_profile_control_status);
  const emailScopes = asList(filters.target_email_scope);
  const tags = asList(filters.target_tags);
  if (counties.length && !counties.includes(contact.county)) return false;
  if (providerTypes.length && !providerTypes.includes(contact.provider_type)) return false;
  if (controlStatuses.length && !controlStatuses.includes(contact.profile_control_status || 'directory')) return false;
  if (emailScopes.length && !emailScopes.includes(contact.email_scope || 'location')) return false;
  if (tags.length && !(Array.isArray(contact.tags) && tags.some((tag) => contact.tags.includes(tag)))) return false;
  return true;
}

// ── De ce nu primeste un contact aceasta campanie ──

export const BLOCK_REASON_LABELS = {
  invalid_email: 'Adresa invalida',
  suppressed: 'Dezabonat de la tot / respins / reclamatie',
  unsubscribed_category: 'Dezabonat de la aceasta categorie',
  inactive_account: 'Contul nu mai e activ',
  undeliverable_domain: 'Domeniul nu primeste email',
  missing_compliance: 'Lipsesc temeiul legal sau sursa',
  duplicate: 'Aceeasi adresa apare deja in lista',
};

export function contactBlockReason(contact, category, suppressionMap = null) {
  const email = normalizeEmail(contact?.normalized_email || contact?.email);
  if (!email || !isSendableEmail(email)) return 'invalid_email';
  if (isContactSuppressed(contact)) return 'suppressed';
  if (suppressionMap) {
    const set = suppressionMap.get(email);
    if (set?.has('all')) return 'suppressed';
    if (set?.has(category)) return 'unsubscribed_category';
  }
  if (asList(contact.unsubscribed_categories).includes(category)) return 'unsubscribed_category';
  if (contactKind(contact) === 'provider_account' && contact.account_active === false) return 'inactive_account';
  if (isDomainUndeliverable(contact.email_domain_status)) return 'undeliverable_domain';
  if (complianceMissing(contact).length) return 'missing_compliance';
  return '';
}

// ── Audienta unei campanii ──

// La aceeasi adresa din doua surse (cont de furnizor si director) se trimite o singura data, iar
// contul are prioritate: e relatia directa cu VIASEE, iar subsolul emailului o spune corect.
function dedupePriority(row) {
  return row.kind === 'provider_account' ? 0 : 1;
}

export function computeAudienceRows(contacts = [], spec = {}, suppressionMap = null) {
  const category = normalizeCategory(spec.category);
  const sources = normalizeAudienceSources(spec.audience_sources);
  const manualOnly = spec.audience_mode === 'manual';
  const included = new Set(asList(spec.included_contact_ids));
  const excluded = new Set(asList(spec.excluded_contact_ids));

  const rows = [];
  for (const contact of contacts || []) {
    const kind = contactKind(contact);
    const byFilters = !manualOnly && sources.includes(kind) && contactMatchesFilters(contact, spec);
    const byHand = included.has(contact.id);
    if (!byFilters && !byHand) continue;
    rows.push({
      contact,
      kind,
      email: normalizeEmail(contact.normalized_email || contact.email),
      added_manually: byHand && !byFilters,
      excluded: excluded.has(contact.id),
      excluded_by_address: false,
      block: contactBlockReason(contact, category, suppressionMap),
      duplicate: false,
    });
  }

  // Debifarea scoate ADRESA, nu doar randul: aceeasi adresa poate veni si din director, si din
  // contul de furnizor (sau de pe doua locatii). Altfel, dupa debifarea primului rand, duplicatul
  // lui ar trece pe "primeste" si adresa ar primi totusi emailul.
  const excludedEmails = new Set(rows.filter((row) => row.excluded && row.email).map((row) => row.email));
  for (const row of rows) {
    if (!row.excluded && row.email && excludedEmails.has(row.email)) {
      row.excluded = true;
      row.excluded_by_address = true;
    }
  }

  const sendable = rows
    .filter((row) => !row.excluded && !row.block)
    .sort((a, b) => dedupePriority(a) - dedupePriority(b));
  const seen = new Set();
  for (const row of sendable) {
    if (seen.has(row.email)) { row.duplicate = true; continue; }
    seen.add(row.email);
  }

  rows.sort((a, b) => String(a.contact.company_name || a.email).localeCompare(String(b.contact.company_name || b.email), 'ro'));
  const eligible = rows.filter((row) => !row.excluded && !row.block && !row.duplicate).map((row) => row.contact);

  const blocked = {};
  for (const row of rows) {
    if (row.excluded) continue;
    const reason = row.block || (row.duplicate ? 'duplicate' : '');
    if (reason) blocked[reason] = (blocked[reason] || 0) + 1;
  }
  return {
    category,
    rows,
    eligible,
    counts: {
      candidates: rows.length,
      eligible: eligible.length,
      excluded: rows.filter((row) => row.excluded).length,
      added_manually: rows.filter((row) => row.added_manually).length,
      blocked,
    },
  };
}

// Randul trimis interfetei: doar ce trebuie afisat, fara metadatele de conformitate.
export function audienceRowView(row) {
  const c = row.contact;
  return {
    id: c.id,
    company_name: c.company_name || '',
    contact_name: c.contact_name || '',
    email: row.email,
    city: c.city || '',
    county: c.county || '',
    provider_type: c.provider_type || '',
    kind: row.kind,
    email_scope: c.email_scope || 'location',
    shared_location_count: c.shared_location_count || 1,
    added_manually: row.added_manually,
    excluded: row.excluded,
    excluded_by_address: !!row.excluded_by_address,
    reason: row.block || (row.duplicate ? 'duplicate' : ''),
  };
}

// ── Subsolul emailului ──

export function footerReasonFor(contact) {
  if (contactKind(contact) === 'provider_account') {
    return 'Primesti acest email pentru ca ai un cont de furnizor pe VIASEE.';
  }
  return ''; // textul implicit din legalConfig(): adresa publica din directorul national
}

export function unsubscribeLabelFor(category) {
  return normalizeCategory(category) === 'announcement'
    ? 'Dezaboneaza-te de la anunturi'
    : 'Dezaboneaza-te de la prezentari';
}

export function eyebrowFor(category) {
  return normalizeCategory(category) === 'announcement' ? 'Anunt VIASEE' : '';
}

// ── Raportul campaniei ──

// Ce s-a intamplat, in final, cu emailul unui destinatar. Evenimentele Resend pot ajunge in orice
// ordine (un "sent" intarziat dupa "bounced"), deci rezultatul se decide dupa marcajele de timp
// pastrate pe jurnal, de la cel mai grav la cel mai slab, nu dupa ultimul status scris.
// Dezabonarea sau raspunsul vin dupa livrare, deci se numara si ca livrate.
export function logOutcome(log = {}) {
  const wasSent = !!(log.sent_at || log.resend_message_id);
  if (!wasSent) return 'not_sent';
  const status = log.status;
  if (log.complained_at || status === 'complained') return 'complained';
  if (log.bounced_at || status === 'bounced') return 'bounced';
  if (log.failed_at || status === 'failed') return 'failed';
  if (log.unsubscribed_at || status === 'unsubscribed') return 'unsubscribed';
  if (log.replied_at || status === 'replied') return 'replied';
  if (log.delivered_at || status === 'delivered') return 'delivered';
  return 'awaiting';
}

// Ordinea starilor unui email trimis (aceeasi ca in logOutcome): un eveniment mai slab venit tarziu
// nu il coboara pe unul mai grav (un "delivered" intarziat nu sterge un "bounced", un "sent" nu
// sterge un "delivered", o dezabonare nu ascunde o respingere).
export const LOG_STATUS_RANK = Object.freeze({
  unknown: 0,
  pending: 0,
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  replied: 4,
  unsubscribed: 5,
  failed: 6,
  bounced: 7,
  complained: 8,
});

export function shouldReplaceLogStatus(current, next) {
  const currentRank = LOG_STATUS_RANK[current] ?? 0;
  const nextRank = LOG_STATUS_RANK[next];
  if (nextRank === undefined) return false;
  return nextRank >= currentRank;
}

export function notSentReason(log = {}) {
  const reason = String(log.reason || '');
  if (log.status === 'duplicate') return 'duplicate';
  if (reason.startsWith('undeliverable_domain')) return 'undeliverable_domain';
  if (reason === 'domain_dns_error') return 'domain_dns_error';
  if (reason === 'suppressed_at_send_time' || reason === 'unsubscribed_category') return 'suppressed';
  if (reason === 'inactive_account') return 'inactive_account';
  if (reason === 'rejected_by_provider') return 'rejected_by_provider';
  if (reason.startsWith('missing_compliance')) return 'missing_compliance';
  if (log.status === 'invalid') return 'invalid_email';
  return 'other';
}

export const NOT_SENT_REASON_LABELS = {
  duplicate: 'Adresa duplicat',
  undeliverable_domain: 'Domeniul nu primeste email',
  domain_dns_error: 'Eroare DNS la domeniu',
  suppressed: 'Dezabonat / suprimat',
  missing_compliance: 'Lipsesc temeiul legal sau sursa',
  invalid_email: 'Adresa invalida',
  inactive_account: 'Contul nu mai e activ',
  rejected_by_provider: 'Adresa refuzata de serviciul de email',
  other: 'Alt motiv',
};

function rate(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export function summarizeCampaignLogs(logs = [], recipientCount = 0) {
  const counts = {
    recipients: Math.max(0, Number(recipientCount) || 0),
    sent: 0,
    delivered: 0,
    awaiting: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    unsubscribed: 0,
    replied: 0,
    not_sent: 0,
  };
  const notSentByReason = {};
  for (const log of logs || []) {
    const outcome = logOutcome(log);
    if (outcome === 'not_sent') {
      counts.not_sent += 1;
      const reason = notSentReason(log);
      notSentByReason[reason] = (notSentByReason[reason] || 0) + 1;
      continue;
    }
    counts.sent += 1;
    if (['delivered', 'unsubscribed', 'replied', 'complained'].includes(outcome)) counts.delivered += 1;
    if (outcome === 'awaiting') counts.awaiting += 1;
    if (outcome === 'bounced') counts.bounced += 1;
    if (outcome === 'complained') counts.complained += 1;
    if (outcome === 'failed') counts.failed += 1;
    if (outcome === 'unsubscribed') counts.unsubscribed += 1;
    if (outcome === 'replied') counts.replied += 1;
  }
  counts.pending_send = Math.max(0, counts.recipients - counts.sent - counts.not_sent);
  return {
    counts,
    not_sent_by_reason: notSentByReason,
    rates: {
      delivered: rate(counts.delivered, counts.sent),
      bounced: rate(counts.bounced, counts.sent),
      complained: rate(counts.complained, counts.sent),
      unsubscribed: rate(counts.unsubscribed, counts.sent),
      replied: rate(counts.replied, counts.sent),
    },
  };
}
