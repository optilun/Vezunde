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
  SUPPRESSED_STATUSES,
} from '../../shared/outreachEmailPolicy.js';

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

async function findLog(svc, messageId, email) {
  if (messageId) {
    const byMessage = await svc.entities.OutreachCampaignLog.filter({ resend_message_id: messageId }).catch(() => []);
    if (byMessage?.length) return byMessage[0];
  }
  if (email) {
    const byEmail = await svc.entities.OutreachCampaignLog.filter({ normalized_email: email }).catch(() => []);
    const sentLog = (byEmail || []).find((log) => ['sent', 'delivery_delayed', 'failed'].includes(log.status));
    if (sentLog) return sentLog;
    if (byEmail?.length) return byEmail[0];
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

async function updateCampaignCounters(svc, log, nextStatus) {
  if (!log?.campaign_id || log.campaign_id === 'direct' || log.campaign_id === 'resend_webhook_unknown') return;
  const campaign = await svc.entities.OutreachCampaign.get(log.campaign_id).catch(() => null);
  if (!campaign) return;
  const patch = {};
  if (nextStatus === 'delivered') patch.delivered_count = (campaign.delivered_count || 0) + 1;
  if (nextStatus === 'bounced') patch.bounced_count = (campaign.bounced_count || 0) + 1;
  if (nextStatus === 'complained') patch.complained_count = (campaign.complained_count || 0) + 1;
  if (nextStatus === 'failed') patch.failed_count = (campaign.failed_count || 0) + 1;
  if (nextStatus === 'opened') patch.opened_count = (campaign.opened_count || 0) + 1;
  if (nextStatus === 'clicked') patch.clicked_count = (campaign.clicked_count || 0) + 1;
  if (Object.keys(patch).length) {
    await svc.entities.OutreachCampaign.update(campaign.id, patch).catch((error) => {
      console.error('outreachWebhookOps campaign counter update failed', campaign.id, error?.message || error);
    });
  }
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

  try {
    const existingLog = await findLog(svc, messageId, email);
    const processed = Array.isArray(existingLog?.processed_event_ids) ? existingLog.processed_event_ids : [];
    if (existingLog && processed.includes(eventId)) {
      return json({ duplicate: true, event_id: eventId, message_id: messageId });
    }

    const isLoggableStatus = LOG_STATUS_VALUES.has(nextStatus);
    const timestampKey = isLoggableStatus ? timestampFieldForStatus(nextStatus) : null;
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
      ...(isLoggableStatus ? { status: nextStatus } : {}),
      ...(timestampKey ? { [timestampKey]: occurredAt } : {}),
    };

    let log = existingLog;
    if (existingLog?.id) {
      await svc.entities.OutreachCampaignLog.update(existingLog.id, logPatch);
      log = { ...existingLog, ...logPatch };
    } else {
      log = await svc.entities.OutreachCampaignLog.create({
        campaign_id: 'resend_webhook_unknown',
        contact_id: '',
        email: email || 'unknown',
        normalized_email: email,
        status: isLoggableStatus ? nextStatus : 'unknown',
        created_at: occurredAt,
        ...logPatch,
      });
    }

    await updateContactFromEvent(svc, log, email, nextStatus, errorMessage);
    await upsertSuppression(svc, log, email, nextStatus, event, errorMessage);
    await updateCampaignCounters(svc, log, nextStatus);

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
