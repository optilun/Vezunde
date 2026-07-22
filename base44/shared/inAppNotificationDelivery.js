import { canAccessProviderLeadInbox } from './providerLeadInboxPolicy.js';
import {
  IN_APP_NOTIFICATION_CONTRACT_VERSION,
  buildInAppNotificationIdempotencyKey,
} from './inAppNotificationPolicy.js';

function clean(value, maxLength = 240) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

export async function createInAppNotification({
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
  title,
  body,
  actionKind = 'request',
  actionTargetId = '',
  variant = '',
}) {
  if (!svc || !eventKey || !recipientType || !recipientRefId || !sourceEntityId) return null;
  const idempotencyKey = buildInAppNotificationIdempotencyKey({
    eventKey,
    recipientType,
    recipientRefId,
    sourceEntityId,
    variant,
  });
  const existing = await svc.entities.InAppNotification.filter({
    recipient_type: recipientType,
    recipient_ref_id: recipientRefId,
    idempotency_key: idempotencyKey,
  }, '-created_date', 2);
  if (existing[0]) return existing[0];

  return svc.entities.InAppNotification.create({
    notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
    event_key: clean(eventKey, 120),
    recipient_type: clean(recipientType, 40),
    recipient_ref_id: clean(recipientRefId, 120),
    source_entity_type: clean(sourceEntityType, 120),
    source_entity_id: clean(sourceEntityId, 120),
    request_id: clean(requestId, 120),
    lead_id: clean(leadId, 120),
    organization_id: clean(organizationId, 120),
    location_id: clean(locationId, 120),
    title: clean(title, 120),
    body: clean(body, 280),
    action_kind: clean(actionKind, 40),
    action_target_id: clean(actionTargetId, 120),
    variant: clean(variant, 160),
    idempotency_key: idempotencyKey,
    status: 'unread',
  });
}

export async function notifyProviderUsersInApp({
  svc,
  locationId,
  eventKey,
  sourceEntityType,
  sourceEntityId,
  requestId = '',
  leadId = '',
  organizationId = '',
  title,
  body,
  actionKind = 'lead',
  actionTargetId = '',
  variant = '',
}) {
  if (!svc || !locationId) return [];
  const memberships = await svc.entities.ProviderMembership.filter({
    location_id: locationId,
    status: 'active',
  }, '-created_date', 500);
  const recipients = new Map();
  for (const membership of memberships) {
    if (!membership?.user_id || !canAccessProviderLeadInbox(membership.role)) continue;
    if (!recipients.has(membership.user_id)) recipients.set(membership.user_id, membership);
  }
  const results = [];
  for (const membership of recipients.values()) {
    const notification = await createInAppNotification({
      svc,
      eventKey,
      recipientType: 'provider_user',
      recipientRefId: membership.user_id,
      sourceEntityType,
      sourceEntityId,
      requestId,
      leadId,
      organizationId,
      locationId,
      title,
      body,
      actionKind,
      actionTargetId,
      variant,
    });
    if (notification) results.push(notification);
  }
  return results;
}

export async function notifyPatientRequestInApp({
  svc,
  requestId,
  eventKey,
  sourceEntityType,
  sourceEntityId,
  leadId = '',
  organizationId = '',
  locationId = '',
  title,
  body,
  actionKind = 'request',
  actionTargetId = '',
  variant = '',
}) {
  if (!svc || !requestId) return null;
  return createInAppNotification({
    svc,
    eventKey,
    recipientType: 'patient_request',
    recipientRefId: requestId,
    sourceEntityType,
    sourceEntityId,
    requestId,
    leadId,
    organizationId,
    locationId,
    title,
    body,
    actionKind,
    actionTargetId,
    variant,
  });
}
