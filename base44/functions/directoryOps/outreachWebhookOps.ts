import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeEmail,
  verifySvixSignature,
  extractResendMessageId,
  extractResendRecipientEmail,
  resendEventTime,
  compactRawEvent,
  statusForResendEvent,
  timestampFieldForStatus,
  getResendErrorMessage,
  extractResendTags,
  SUPPRESSED_STATUSES,
} from '../../shared/outreachEmailPolicy.js';
import {
  evaluateCampaignHealth,
  withLogHealthCounters,
  healthPausePatch,
  autoPauseAuditRecord,
} from '../../shared/outreachSendSafety.js';
import {
  summarizeCampaignLogs,
  shouldReplaceLogStatus,
} from '../../shared/outreachAudiencePolicy.js';

// outreachWebhookOps — receptor webhook Resend (semnat Svix), portat din Optilun
// (resendWebhook/entry.ts), adaptat la modelul de rute al VIASEE: NU e o functie fizica separata,
// e apelat direct de router.ts pe baza header-ului `svix-signature`, INAINTE de parsarea normala
// __function/payload — deci nu apare niciodata in DIRECTORY_FUNCTION_ROUTES si nu poate fi atins
// prin `__function`. Securitatea vine exclusiv din verificarea semnaturii, nu din auth Base44
// (Resend nu are o sesiune VIASEE).
//
// Fata de Optilun, adaugam gestionarea `email.sent`/`email.opened`/`email.clicked`: primele doua
// nu exista ca `status` in enum-ul OutreachCampaignLog.status, asa ca nu suprascriem statusul —
// doar incrementam contorul corespunzator de pe campanie si retinem un timestamp in `metadata`.
//
// Legarea de campanie se face dupa etichetele puse la trimitere (viasee_campaign, viasee_contact),
// nu dupa adresa: aceeasi adresa poate fi in mai multe campanii, iar un eveniment nu are voie sa
// ajunga pe jurnalul altei campanii. Evenimentele fara aceste etichete (emailurile de test) nu
// intra in niciun raport; o respingere sau o reclamatie pe ele ajunge totusi in lista de suprimari.
// Un eveniment venit inaintea jurnalului (Resend raspunde in ~1 secunda, jurnalul se scrie imediat
// dupa) primeste 503, iar Resend il retrimite dupa cateva secunde, cand jurnalul exista.

// Cat timp mai asteptam jurnalul unui eveniment etichetat. Dupa aceea evenimentul e tratat fara
// jurnal (doar suprimarea), ca Resend sa nu-l reincerce la nesfarsit.
const EVENT_LOG_WAIT_MS = 6 * 60 * 60 * 1000;

const LOG_STATUS_VALUES = new Set([
  'pending', 'sent', 'failed', 'skipped', 'unsubscribed', 'bounced', 'invalid',
  'duplicate', 'delivered', 'delivery_delayed', 'complained', 'replied', 'unknown',
]);

const HANDLED_EVENTS = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'email.failed',
]);

function json(data, status = 200) {
  return Response.json(data, { status });
}

// Jurnalul exact al emailului: dupa id-ul Resend, verificand ca e al aceleiasi campanii, apoi dupa
// perechea campanie + contact (cand id-ul n-a putut fi salvat la trimitere).
async function findCampaignLog(svc, campaignId, contactId, messageId) {
  if (messageId) {
    const byMessage = await svc.entities.OutreachCampaignLog.filter({ resend_message_id: messageId }, '-created_date', 5).catch(() => []);
    const match = (byMessage || []).find((log) => log.campaign_id === campaignId);
    if (match) return match;
  }
  if (contactId) {
    const byContact = await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaignId, contact_id: contactId }, '-created_date', 10).catch(() => []);
    const sentLog = (byContact || []).find((log) => log.sent_at || log.resend_message_id);
    if (sentLog) return sentLog;
  }
  return null;
}

async function updateContactFromEvent(svc, log, email, status, errorMessage) {
  if (!['bounced', 'complained'].includes(status)) return;
  let contact = null;
  if (log?.contact_id) {
    contact = await svc.entities.OutreachContact.get(log.contact_id).catch(() => null);
  }
  if (!contact && email) {
    const contacts = await svc.entities.OutreachContact.filter({ normalized_email: email }).catch(() => []);
    contact = contacts?.[0] || null;
  }
  if (!contact || SUPPRESSED_STATUSES.has(contact.email_status || contact.status)) return;

  const now = new Date().toISOString();
  await svc.entities.OutreachContact.update(contact.id, {
    normalized_email: email || contact.normalized_email || normalizeEmail(contact.email),
    email_status: status,
    status,
    last_error: errorMessage || (status === 'complained' ? 'Plangere de spam via webhook Resend' : 'Livrare permanent esuata via webhook Resend'),
    unsubscribe_reason: status === 'complained' ? 'resend_spam_complaint' : contact.unsubscribe_reason,
    last_status_change_at: now,
    consent_audit: [
      ...(Array.isArray(contact.consent_audit) ? contact.consent_audit : []),
      { at: now, source: 'resend_webhook', action: `marked_${status}`, reason: errorMessage || status },
    ].slice(-25),
  }).catch((error) => console.error('outreachWebhookOps contact update failed', contact?.id, error?.message || error));
}

async function upsertSuppression(svc, log, email, status, event, errorMessage) {
  if (!['bounced', 'complained'].includes(status)) return;
  const normalized = normalizeEmail(email || log?.normalized_email || log?.email);
  if (!normalized) return;
  const now = new Date().toISOString();
  const existing = await svc.entities.OutreachSuppression.filter({ normalized_email: normalized }).catch(() => []);
  const payload = {
    email: normalized,
    normalized_email: normalized,
    status,
    // O adresa respinsa sau o reclamatie de spam blocheaza orice categorie, nu doar pe cea a
    // campaniei din care a venit.
    categories: ['all'],
    reason: errorMessage || (status === 'complained' ? 'Plangere de spam via webhook Resend' : 'Livrare permanent esuata via webhook Resend'),
    source: 'resend_webhook',
    campaign_id: log?.campaign_id || event?.data?.tags?.campaign_id || '',
    contact_id: log?.contact_id || '',
    provider: 'resend',
    provider_message_id: extractResendMessageId(event),
    provider_event_id: event?.id || event?.event_id || '',
    details: compactRawEvent(event),
    is_active: true,
    updated_at: now,
  };
  if (existing?.[0]?.id) {
    await svc.entities.OutreachSuppression.update(existing[0].id, payload).catch((error) => {
      console.error('outreachWebhookOps suppression update failed', normalized, error?.message || error);
    });
    return;
  }
  await svc.entities.OutreachSuppression.create({ ...payload, created_at: now }).catch((error) => {
    console.error('outreachWebhookOps suppression create failed', normalized, error?.message || error);
  });
}

// Contoarele care conteaza pentru protectie (respinse, reclamatii, esuate) se RENUMARA din jurnal la
// fiecare astfel de eveniment, in loc de +1: zeci de webhook-uri sosesc aproape simultan, iar un
// +1 citit-modificat-scris pierde incrementari exact cand conteaza. Contoarele nu scad niciodata.
// Livrarile (multe, neimportante pentru protectie) raman pe +1; lista si raportul le numara din jurnal.
const RECOUNT_STATUSES = new Set(['bounced', 'complained', 'failed']);

async function updateCampaignCounters(svc, campaignId, nextStatus) {
  const campaign = await svc.entities.OutreachCampaign.get(campaignId).catch(() => null);
  if (!campaign) return { campaign: null, counts: null };
  const stored = (key) => Number(campaign[key]) || 0;
  const patch = {};
  let counts = null;
  if (RECOUNT_STATUSES.has(nextStatus)) {
    const logs = await svc.entities.OutreachCampaignLog.filter({ campaign_id: campaignId }, '-created_date', 20000).catch(() => null);
    if (logs) {
      counts = summarizeCampaignLogs(logs, campaign.recipient_count).counts;
      patch.delivered_count = Math.max(stored('delivered_count'), counts.delivered);
      patch.bounced_count = Math.max(stored('bounced_count'), counts.bounced);
      patch.complained_count = Math.max(stored('complained_count'), counts.complained);
      patch.failed_count = Math.max(stored('failed_count'), counts.failed);
    } else {
      patch[`${nextStatus}_count`] = stored(`${nextStatus}_count`) + 1;
    }
  }
  if (nextStatus === 'delivered') patch.delivered_count = stored('delivered_count') + 1;
  if (nextStatus === 'opened') patch.opened_count = stored('opened_count') + 1;
  if (nextStatus === 'clicked') patch.clicked_count = stored('clicked_count') + 1;
  if (Object.keys(patch).length) {
    await svc.entities.OutreachCampaign.update(campaign.id, patch).catch((error) => {
      console.error('outreachWebhookOps campaign counter update failed', campaign.id, error?.message || error);
    });
  }
  return { campaign: { ...campaign, ...patch }, counts };
}

// Oprirea automata chiar in momentul in care vine respingerea / reclamatia: cronul de trimitere
// ruleaza la 5 minute, iar intre timp nu trebuie sa mai plece niciun lot. Doar campaniile care
// inca trimit; una terminata sau oprita deja de admin ramane cum e.
async function autoPauseIfUnhealthy(svc, campaign, counts, nextStatus) {
  if (!campaign || !['bounced', 'complained'].includes(nextStatus)) return;
  if (!['ready', 'sending'].includes(campaign.status)) return;
  const health = evaluateCampaignHealth(withLogHealthCounters(campaign, counts));
  if (health.healthy) return;
  // Starea se re-citeste chiar inainte de scriere: o anulare sau o pauza data de admin intre timp
  // nu are voie sa fie inlocuita de o pauza automata (care s-ar putea relua).
  const current = await svc.entities.OutreachCampaign.get(campaign.id).catch(() => null);
  if (!current || !['ready', 'sending'].includes(current.status)) return;
  await svc.entities.OutreachCampaign.update(campaign.id, healthPausePatch(health)).catch((error) => {
    console.error('outreachWebhookOps auto-pause failed', campaign.id, error?.message || error);
  });
  await svc.entities.DirectoryAuditRecord.create(autoPauseAuditRecord(campaign.id, health, 'webhook Resend'))
    .catch((error) => console.error('outreachWebhookOps auto-pause audit failed', campaign.id, error?.message || error));
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Metoda nepermisa' }, 405);

  const rawBody = await req.text();
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') || Deno.env.get('RESEND_WEBHOOK_SIGNING_SECRET') || '';
  if (!webhookSecret) {
    console.error('outreachWebhookOps: RESEND_WEBHOOK_SECRET nu este configurat');
    return json({ error: 'Secretul webhook nu este configurat' }, 500);
  }

  try {
    const verified = await verifySvixSignature(rawBody, req.headers, webhookSecret);
    if (!verified) return json({ error: 'Semnatura webhook invalida' }, 400);
  } catch (error) {
    console.error('outreachWebhookOps signature verification failed', error?.message || error);
    return json({ error: 'Semnatura webhook invalida' }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_e) {
    return json({ error: 'Payload JSON invalid' }, 400);
  }

  if (!HANDLED_EVENTS.has(event?.type)) {
    return json({ ignored: true, type: event?.type || 'unknown' });
  }

  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;
  const eventId = req.headers.get('svix-id') || event?.id || `${event?.type}:${resendEventTime(event)}:${extractResendMessageId(event)}`;
  const messageId = extractResendMessageId(event);
  const email = extractResendRecipientEmail(event);
  const nextStatus = statusForResendEvent(event);
  const occurredAt = resendEventTime(event);
  const errorMessage = getResendErrorMessage(event);
  const tags = extractResendTags(event);
  const campaignId = tags.viasee_campaign || '';
  const contactId = tags.viasee_contact || '';

  try {
    if (!campaignId) {
      // Email de test sau trimis din afara campaniilor: nu intra in niciun raport, dar o adresa
      // respinsa sau o reclamatie de spam ramane blocata pentru orice trimitere viitoare.
      await updateContactFromEvent(svc, null, email, nextStatus, errorMessage);
      await upsertSuppression(svc, null, email, nextStatus, event, errorMessage);
      return json({ processed: true, tracked: false, event_id: eventId, type: event?.type, status: nextStatus });
    }

    const existingLog = await findCampaignLog(svc, campaignId, contactId, messageId);
    if (!existingLog) {
      const ageMs = Date.now() - new Date(occurredAt).getTime();
      if (!Number.isFinite(ageMs) || ageMs < EVENT_LOG_WAIT_MS) {
        // Jurnalul inca nu e scris (evenimentul a venit mai repede decat inregistrarea trimiterii).
        // 503 => Resend retrimite evenimentul (dupa 5 s, 5 min, 30 min...), fara sa se piarda.
        return json({ retry: true, reason: 'campaign_log_not_found_yet', event_id: eventId, campaign_id: campaignId }, 503);
      }
      const fallbackLog = { campaign_id: campaignId, contact_id: contactId };
      await updateContactFromEvent(svc, fallbackLog, email, nextStatus, errorMessage);
      await upsertSuppression(svc, fallbackLog, email, nextStatus, event, errorMessage);
      return json({ processed: true, orphan: true, event_id: eventId, type: event?.type, status: nextStatus });
    }

    const processed = Array.isArray(existingLog?.processed_event_ids) ? existingLog.processed_event_ids : [];
    if (processed.includes(eventId)) {
      return json({ duplicate: true, event_id: eventId, message_id: messageId });
    }

    const isLoggableStatus = LOG_STATUS_VALUES.has(nextStatus);
    // Un eveniment venit tarziu nu coboara starea (un "delivered" intarziat nu sterge un "bounced");
    // marcajul lui de timp se pastreaza oricum, iar raportul decide dupa marcaje.
    const replaceStatus = isLoggableStatus && shouldReplaceLogStatus(existingLog.status, nextStatus);
    const timestampField = isLoggableStatus ? timestampFieldForStatus(nextStatus) : null;
    const timestampKey = timestampField && timestampField !== 'created_at' && !existingLog[timestampField] ? timestampField : null;
    const existingMetadata = (existingLog && typeof existingLog.metadata === 'object' && existingLog.metadata) || {};
    const metadataPatch = { ...existingMetadata };
    if (nextStatus === 'opened') metadataPatch.last_opened_at = occurredAt;
    if (nextStatus === 'clicked') {
      metadataPatch.last_clicked_at = occurredAt;
      const clickUrl = event?.data?.click?.link || event?.data?.link || '';
      if (clickUrl) metadataPatch.last_click_url = clickUrl;
    }

    const logPatch = {
      provider: 'resend',
      provider_event_id: eventId,
      provider_event_type: event?.type,
      resend_message_id: messageId || existingLog?.resend_message_id,
      normalized_email: email || existingLog?.normalized_email,
      email: email || existingLog?.email || 'unknown',
      error: errorMessage || existingLog?.error,
      reason: event?.type,
      raw_event: compactRawEvent(event),
      metadata: metadataPatch,
      processed_event_ids: [...new Set([...processed, eventId])].slice(-50),
      ...(replaceStatus ? { status: nextStatus } : {}),
      ...(timestampKey ? { [timestampKey]: occurredAt } : {}),
    };

    await svc.entities.OutreachCampaignLog.update(existingLog.id, logPatch);
    const log = { ...existingLog, ...logPatch };

    await updateContactFromEvent(svc, log, email, nextStatus, errorMessage);
    await upsertSuppression(svc, log, email, nextStatus, event, errorMessage);
    const { campaign, counts } = await updateCampaignCounters(svc, campaignId, nextStatus);
    await autoPauseIfUnhealthy(svc, campaign, counts, nextStatus);

    return json({ processed: true, event_id: eventId, type: event?.type, status: nextStatus, message_id: messageId || null });
  } catch (error) {
    console.error('outreachWebhookOps processing failed', {
      event_id: eventId,
      type: event?.type,
      message_id: messageId,
      error: error?.message || error,
    });
    return json({ error: 'Procesarea webhook-ului a esuat' }, 500);
  }
}
