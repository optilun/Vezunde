import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  isValidEmail,
  isContactSuppressed,
  complianceMissing,
} from '../../shared/outreachEmailPolicy.js';

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

const SYNC_CHUNK_SIZE = 300;
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

function contactMatchesTags(contact, filters = {}) {
  const tags = Array.isArray(filters.target_tags) ? filters.target_tags : [];
  if (!tags.length) return true;
  return Array.isArray(contact.tags) && tags.some((tag) => contact.tags.includes(tag));
}

async function listAllLocationsWithEmail(svc) {
  const rows = await svc.entities.ProviderLocation.list('name', DEFAULT_LOCATION_LIST_LIMIT);
  return (rows || []).filter((row) => isValidEmail(row.public_email));
}

async function listAllContacts(svc) {
  return svc.entities.OutreachContact.list('-created_date', DEFAULT_LOCATION_LIST_LIMIT);
}

async function eligibleContactsForSegment(svc, filters) {
  const contacts = await listAllContacts(svc);
  return (contacts || []).filter((contact) => (
    isValidEmail(contact.normalized_email || contact.email)
    && !isContactSuppressed(contact)
    && contactMatchesTags(contact, filters)
  ));
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

async function actionCreateTemplate(svc, payload) {
  const name = clean(payload.name);
  const subject = clean(payload.subject);
  const body = clean(payload.body);
  if (!name || !subject || !body) return Response.json({ error: 'name, subject si body sunt obligatorii' }, { status: 400 });
  const template = await svc.entities.OutreachTemplate.create({
    name,
    subject,
    body,
    campaign_type: ['claim_notice', 'marketing'].includes(payload.campaign_type) ? payload.campaign_type : 'marketing',
  });
  return Response.json({ template });
}

async function actionUpdateTemplate(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const patch = {};
  if (payload.name !== undefined) patch.name = clean(payload.name);
  if (payload.subject !== undefined) patch.subject = clean(payload.subject);
  if (payload.body !== undefined) patch.body = clean(payload.body);
  if (payload.campaign_type !== undefined && ['claim_notice', 'marketing'].includes(payload.campaign_type)) patch.campaign_type = payload.campaign_type;
  const template = await svc.entities.OutreachTemplate.update(id, patch);
  return Response.json({ template });
}

async function actionDeleteTemplate(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  await svc.entities.OutreachTemplate.delete(id);
  return Response.json({ success: true });
}

async function actionPreviewSegment(svc, payload) {
  const filters = {
    target_counties: payload.target_counties,
    target_provider_types: payload.target_provider_types,
    target_profile_control_status: payload.target_profile_control_status,
    target_tags: payload.target_tags,
  };
  const locations = await listAllLocationsWithEmail(svc);
  const matchingLocations = locations.filter((location) => locationMatchesSegment(location, filters));

  const contacts = await listAllContacts(svc);
  const matchingContacts = contacts.filter((contact) => contactMatchesTags(contact, filters));
  const eligibleContacts = matchingContacts.filter((contact) => !isContactSuppressed(contact));
  const missingCompliance = eligibleContacts.filter((contact) => complianceMissing(contact).length > 0).length;

  return Response.json({
    directory_locations_matching: matchingLocations.length,
    directory_locations_total_with_email: locations.length,
    contacts_materialized_matching: matchingContacts.length,
    contacts_eligible_for_send: eligibleContacts.length,
    contacts_suppressed: matchingContacts.length - eligibleContacts.length,
    contacts_missing_compliance_metadata: missingCompliance,
    not_yet_materialized: Math.max(0, matchingLocations.length - matchingContacts.length),
  });
}

async function actionSyncContactsFromDirectory(svc, user, payload) {
  const filters = {
    target_counties: payload.target_counties,
    target_provider_types: payload.target_provider_types,
    target_profile_control_status: payload.target_profile_control_status,
  };
  const cursor = Math.max(0, Number(payload.cursor) || 0);

  const allLocations = await listAllLocationsWithEmail(svc);
  const candidates = allLocations.filter((location) => locationMatchesSegment(location, filters));
  const chunk = candidates.slice(cursor, cursor + SYNC_CHUNK_SIZE);

  const existingContacts = await listAllContacts(svc);
  const byLocationId = new Map(existingContacts.filter((c) => c.location_id).map((c) => [c.location_id, c]));
  const byNormalizedEmail = new Map(existingContacts.map((c) => [normalizeEmail(c.normalized_email || c.email), c]));

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const location of chunk) {
    const email = normalizeEmail(location.public_email);
    if (!email) { skipped++; continue; }
    const existing = byLocationId.get(location.id) || byNormalizedEmail.get(email);
    const descriptive = {
      location_id: location.id,
      organization_id: location.organization_id || '',
      company_name: location.public_display_name || location.name || '',
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      email,
      normalized_email: email,
    };

    if (existing) {
      const patch = { ...descriptive };
      // Nu suprascriem status/email_status/tags/consent_audit puse manual de admin.
      if (!existing.source_url && location.source_url) patch.source_url = location.source_url;
      if (!existing.collection_date && (location.collected_at || location.source_checked_at)) {
        patch.collection_date = location.collected_at || location.source_checked_at;
      }
      if (!existing.source_type) patch.source_type = location.source_type || 'public_directory';
      if (!existing.lawful_basis) patch.lawful_basis = 'legitimate_interest';
      await svc.entities.OutreachContact.update(existing.id, patch);
      updated++;
    } else {
      await svc.entities.OutreachContact.create({
        ...descriptive,
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
      created++;
    }
  }

  const nextCursor = cursor + chunk.length;
  const hasMore = nextCursor < candidates.length;
  return Response.json({
    created,
    updated,
    skipped,
    processed: chunk.length,
    total_candidates: candidates.length,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
}

async function actionCreateCampaign(svc, user, payload) {
  const name = clean(payload.name);
  const subject = clean(payload.subject);
  if (!name || !subject) return Response.json({ error: 'name si subject sunt obligatorii' }, { status: 400 });

  const filters = {
    target_counties: payload.target_counties,
    target_provider_types: payload.target_provider_types,
    target_profile_control_status: payload.target_profile_control_status,
    target_tags: payload.target_tags,
  };
  const eligible = await eligibleContactsForSegment(svc, filters);

  const campaign = await svc.entities.OutreachCampaign.create({
    name,
    campaign_type: ['claim_notice', 'marketing'].includes(payload.campaign_type) ? payload.campaign_type : 'marketing',
    template_id: clean(payload.template_id),
    subject,
    body_html: clean(payload.body_html),
    from_name: clean(payload.from_name) || 'VIASEE',
    from_email: clean(payload.from_email),
    reply_to_email: clean(payload.reply_to_email),
    target_counties: Array.isArray(payload.target_counties) ? payload.target_counties : [],
    target_provider_types: Array.isArray(payload.target_provider_types) ? payload.target_provider_types : [],
    target_profile_control_status: Array.isArray(payload.target_profile_control_status) ? payload.target_profile_control_status : [],
    target_tags: Array.isArray(payload.target_tags) ? payload.target_tags : [],
    status: 'draft',
    recipient_count: eligible.length,
    created_by_user_id: user.id,
  });

  await writeAudit(svc, user, { entityId: campaign.id, actionType: 'outreach_campaign_created', note: `Campanie creata, ${eligible.length} destinatari eligibili estimati`, next: { name, recipient_count: eligible.length } });
  return Response.json({ campaign });
}

async function actionUpdateCampaign(svc, payload) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (campaign.status !== 'draft') return Response.json({ error: 'Doar campaniile in stare draft pot fi editate' }, { status: 409 });

  const editable = ['name', 'campaign_type', 'template_id', 'subject', 'body_html', 'from_name', 'from_email', 'reply_to_email', 'target_counties', 'target_provider_types', 'target_profile_control_status', 'target_tags'];
  const patch = {};
  for (const key of editable) if (payload[key] !== undefined) patch[key] = payload[key];
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
  return Response.json({ campaign, logs });
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

  const filters = {
    target_counties: campaign.target_counties,
    target_provider_types: campaign.target_provider_types,
    target_profile_control_status: campaign.target_profile_control_status,
    target_tags: campaign.target_tags,
  };
  const eligible = await eligibleContactsForSegment(svc, filters);
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

async function actionSetCampaignStatus(svc, user, payload, { allowedFrom, to, actionType }) {
  const id = clean(payload.id);
  if (!id) return Response.json({ error: 'id este obligatoriu' }, { status: 400 });
  const campaign = await svc.entities.OutreachCampaign.get(id).catch(() => null);
  if (!campaign) return Response.json({ error: 'Campania nu a fost gasita' }, { status: 404 });
  if (!allowedFrom.includes(campaign.status)) {
    return Response.json({ error: `Campania trebuie sa fie in una din starile: ${allowedFrom.join(', ')}` }, { status: 409 });
  }
  const updated = await svc.entities.OutreachCampaign.update(id, { status: to });
  await writeAudit(svc, user, { entityId: id, actionType, previous: { status: campaign.status }, next: { status: to } });
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
      case 'sync_contacts_from_directory': return await actionSyncContactsFromDirectory(svc, user, payload);
      case 'create_campaign': return await actionCreateCampaign(svc, user, payload);
      case 'update_campaign': return await actionUpdateCampaign(svc, payload);
      case 'list_campaigns': return await actionListCampaigns(svc);
      case 'get_campaign': return await actionGetCampaign(svc, payload);
      case 'approve_campaign': return await actionApproveCampaign(svc, user, payload);
      case 'pause_campaign': return await actionSetCampaignStatus(svc, user, payload, { allowedFrom: ['ready', 'sending'], to: 'paused', actionType: 'outreach_campaign_paused' });
      case 'resume_campaign': return await actionSetCampaignStatus(svc, user, payload, { allowedFrom: ['paused'], to: 'ready', actionType: 'outreach_campaign_resumed' });
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
