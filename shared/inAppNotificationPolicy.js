export const IN_APP_NOTIFICATION_CONTRACT_VERSION = 'in-app-notification-v1';

export const IN_APP_NOTIFICATION_EVENT_KEYS = Object.freeze({
  PROVIDER_LEAD_AVAILABLE: 'provider_lead_available',
  PATIENT_PROVIDER_RESPONSE_RECEIVED: 'patient_provider_response_received',
  PROVIDER_CHAT_OPENED: 'provider_chat_opened',
  PROVIDER_CHAT_MESSAGE_RECEIVED: 'provider_chat_message_received',
  PATIENT_CHAT_MESSAGE_RECEIVED: 'patient_chat_message_received',
  PROVIDER_PHONE_APPROVED: 'provider_phone_approved',
  PROVIDER_PHONE_REVOKED: 'provider_phone_revoked',
  PROVIDER_CONVERSATION_CLOSED: 'provider_conversation_closed',
  PATIENT_CONVERSATION_CLOSED: 'patient_conversation_closed',
});

const EVENT_KEYS = new Set(Object.values(IN_APP_NOTIFICATION_EVENT_KEYS));
const STATUSES = new Set(['unread', 'read']);
const ACTION_KINDS = new Set(['lead', 'chat', 'request', 'contact']);

function clean(value, maxLength = 240) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

export function buildInAppNotificationIdempotencyKey({ eventKey, recipientType, recipientRefId, sourceEntityId, variant = '' }) {
  return [eventKey, recipientType, recipientRefId, sourceEntityId, variant]
    .map((value) => clean(value, 120))
    .join(':')
    .slice(0, 480);
}

export function sanitizeInAppNotification(row) {
  return {
    id: clean(row?.id, 120),
    event_key: EVENT_KEYS.has(row?.event_key) ? row.event_key : '',
    title: clean(row?.title, 120),
    body: clean(row?.body, 280),
    status: STATUSES.has(row?.status) ? row.status : 'unread',
    action_kind: ACTION_KINDS.has(row?.action_kind) ? row.action_kind : 'request',
    action_target_id: clean(row?.action_target_id, 120),
    created_date: row?.created_date || null,
    read_at: row?.read_at || null,
  };
}

export function summarizeInAppNotifications(rows) {
  const notifications = Array.isArray(rows) ? rows : [];
  return {
    total: notifications.length,
    unread: notifications.filter((row) => row?.status === 'unread').length,
  };
}
