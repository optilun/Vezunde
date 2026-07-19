import {
  COMMUNICATION_EVENT_CATALOG_VERSION,
  communicationEventDefinition,
} from './communicationEventCatalog.js';

const MAX_DELIVERY_ATTEMPTS = 3;

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function singleLine(value, maxLength = 180) {
  return clean(value, maxLength).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
}

function normalizeEmail(value) {
  return clean(value, 254).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function communicationDeliveryIdempotencyKey({ eventKey, sourceId, recipientRefId, variant = '' }) {
  return [
    clean(eventKey, 100),
    clean(sourceId, 140),
    clean(recipientRefId, 140),
    clean(variant, 100),
  ].join(':');
}

function oldestDelivery(rows) {
  return [...(rows || [])].sort((left, right) => {
    const createdOrder = String(left?.created_date || '').localeCompare(String(right?.created_date || ''));
    if (createdOrder !== 0) return createdOrder;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  })[0] || null;
}

async function existingDelivery(svc, idempotencyKey) {
  const rows = await svc.entities.CommunicationDelivery.filter({ idempotency_key: idempotencyKey }, 'created_date', 10);
  return oldestDelivery(rows);
}

function baseDeliveryRecord({
  event,
  recipientType,
  recipientRefId,
  recipientEmailHash,
  sourceEntityType,
  sourceEntityId,
  requestId,
  leadId,
  organizationId,
  locationId,
  idempotencyKey,
  subject,
  now,
}) {
  return {
    catalog_version: COMMUNICATION_EVENT_CATALOG_VERSION,
    event_key: event.event_key,
    template_version: event.template_version,
    channel: event.channel,
    priority: event.priority,
    recipient_type: recipientType,
    recipient_ref_id: recipientRefId,
    recipient_email_hash: recipientEmailHash,
    source_entity_type: sourceEntityType,
    source_entity_id: sourceEntityId,
    request_id: requestId || '',
    lead_id: leadId || '',
    organization_id: organizationId || '',
    location_id: locationId || '',
    idempotency_key: idempotencyKey,
    subject_preview: singleLine(subject, 180),
    queued_at: now,
  };
}

export async function recordSkippedCommunication({
  svc,
  eventKey,
  recipientType,
  recipientRefId,
  sourceEntityType,
  sourceEntityId,
  requestId = '',
  leadId = '',
  organizationId = '',
  locationId = '',
  variant = '',
  reason,
  subject = '',
}) {
  const event = communicationEventDefinition(eventKey);
  if (!event) return { status: 'invalid_event', idempotent_replay: false };
  const idempotencyKey = communicationDeliveryIdempotencyKey({ eventKey, sourceId: sourceEntityId, recipientRefId, variant });
  const existing = await existingDelivery(svc, idempotencyKey);
  if (existing) return { status: existing.status, idempotent_replay: true, delivery_id: existing.id };
  const now = new Date().toISOString();
  const row = await svc.entities.CommunicationDelivery.create({
    ...baseDeliveryRecord({
      event,
      recipientType,
      recipientRefId,
      recipientEmailHash: '',
      sourceEntityType,
      sourceEntityId,
      requestId,
      leadId,
      organizationId,
      locationId,
      idempotencyKey,
      subject,
      now,
    }),
    status: 'skipped',
    attempt_count: 0,
    delivery_provider: '',
    last_error: '',
    skip_reason: clean(reason || 'delivery_skipped', 180),
    skipped_at: now,
  });
  return { status: 'skipped', idempotent_replay: false, delivery_id: row.id };
}

export async function deliverCommunicationEmail({
  base44,
  svc,
  eventKey,
  recipientType,
  recipientRefId,
  recipientEmail,
  sourceEntityType,
  sourceEntityId,
  requestId = '',
  leadId = '',
  organizationId = '',
  locationId = '',
  variant = '',
  subject,
  body,
}) {
  const event = communicationEventDefinition(eventKey);
  if (!event || event.channel !== 'email') return { status: 'invalid_event', idempotent_replay: false };

  const email = normalizeEmail(recipientEmail);
  const idempotencyKey = communicationDeliveryIdempotencyKey({ eventKey, sourceId: sourceEntityId, recipientRefId, variant });
  const existing = await existingDelivery(svc, idempotencyKey);
  if (existing && ['pending', 'sent', 'skipped'].includes(existing.status)) {
    return { status: existing.status, idempotent_replay: true, delivery_id: existing.id };
  }
  if (existing && Number(existing.attempt_count || 0) >= MAX_DELIVERY_ATTEMPTS) {
    return { status: 'failed', idempotent_replay: true, delivery_id: existing.id };
  }

  if (!validEmail(email)) {
    return recordSkippedCommunication({
      svc,
      eventKey,
      recipientType,
      recipientRefId,
      sourceEntityType,
      sourceEntityId,
      requestId,
      leadId,
      organizationId,
      locationId,
      variant,
      reason: 'recipient_email_unavailable',
      subject,
    });
  }

  const now = new Date().toISOString();
  const attemptCount = Number(existing?.attempt_count || 0) + 1;
  const recipientEmailHash = await sha256(email);
  const pendingPayload = {
    ...baseDeliveryRecord({
      event,
      recipientType,
      recipientRefId,
      recipientEmailHash,
      sourceEntityType,
      sourceEntityId,
      requestId,
      leadId,
      organizationId,
      locationId,
      idempotencyKey,
      subject,
      now,
    }),
    status: 'pending',
    attempt_count: attemptCount,
    delivery_provider: 'base44',
    last_error: '',
    skip_reason: '',
    last_attempt_at: now,
  };
  const delivery = existing
    ? await svc.entities.CommunicationDelivery.update(existing.id, pendingPayload)
    : await svc.entities.CommunicationDelivery.create(pendingPayload);

  try {
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: singleLine(subject, 180),
      body: clean(body, 6000),
      from_name: 'VIASEE',
    });
    await svc.entities.CommunicationDelivery.update(delivery.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      failed_at: null,
      last_error: '',
    });
    return { status: 'sent', idempotent_replay: false, delivery_id: delivery.id };
  } catch (deliveryError) {
    await svc.entities.CommunicationDelivery.update(delivery.id, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      last_error: clean(deliveryError?.message || 'Email delivery failed.', 300),
    });
    return { status: 'failed', idempotent_replay: false, delivery_id: delivery.id };
  }
}
