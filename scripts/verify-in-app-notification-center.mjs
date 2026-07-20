import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  IN_APP_NOTIFICATION_CONTRACT_VERSION,
  IN_APP_NOTIFICATION_EVENT_KEYS,
  buildInAppNotificationIdempotencyKey,
  sanitizeInAppNotification,
  summarizeInAppNotifications,
} from '../shared/inAppNotificationPolicy.js';
import { createInAppNotification } from '../shared/inAppNotificationDelivery.js';

assert.equal(IN_APP_NOTIFICATION_CONTRACT_VERSION, 'in-app-notification-v1');
assert.equal(IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE, 'provider_lead_available');
assert.equal(IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_CHAT_MESSAGE_RECEIVED, 'patient_chat_message_received');
assert.equal(IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_REQUEST_RESOLVED, 'provider_request_resolved');
assert.equal(IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_EXPIRED, 'patient_request_expired');

const key = buildInAppNotificationIdempotencyKey({
  eventKey: 'provider_chat_message_received',
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  sourceEntityId: 'message-1',
  variant: 'v1',
});
assert.equal(key, buildInAppNotificationIdempotencyKey({
  eventKey: 'provider_chat_message_received',
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  sourceEntityId: 'message-1',
  variant: 'v1',
}));
assert.notEqual(key, buildInAppNotificationIdempotencyKey({
  eventKey: 'provider_chat_message_received',
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  sourceEntityId: 'message-1',
  variant: 'v2',
}));

const safe = sanitizeInAppNotification({
  id: 'notification-1',
  event_key: 'patient_chat_message_received',
  title: 'Mesaj nou',
  body: 'Ai primit un mesaj.',
  status: 'unread',
  action_kind: 'chat',
  action_target_id: 'location-1',
  recipient_ref_id: 'request-secret',
  request_id: 'request-secret',
  lead_id: 'lead-secret',
  source_entity_id: 'message-secret',
  contact_email: 'secret@example.com',
  contact_phone: '0722123456',
});
assert.equal(safe.action_target_id, 'location-1');
for (const forbidden of ['recipient_ref_id', 'request_id', 'lead_id', 'source_entity_id', 'contact_email', 'contact_phone']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie expus`);
}
assert.deepEqual(summarizeInAppNotifications([{ status: 'unread' }, { status: 'read' }]), { total: 2, unread: 1 });

const created = [];
const mockSvc = {
  entities: {
    InAppNotification: {
      async filter(query) {
        return created.filter((row) => row.recipient_type === query.recipient_type
          && row.recipient_ref_id === query.recipient_ref_id
          && row.idempotency_key === query.idempotency_key);
      },
      async create(payload) {
        const row = { id: `notification-${created.length + 1}`, ...payload };
        created.push(row);
        return row;
      },
    },
  },
};
const deliveryInput = {
  svc: mockSvc,
  eventKey: 'provider_lead_available',
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  sourceEntityType: 'ProviderLead',
  sourceEntityId: 'lead-1',
  requestId: 'request-1',
  leadId: 'lead-1',
  locationId: 'location-1',
  title: 'Cerere noua',
  body: 'Rezumat anonim',
  actionKind: 'lead',
  actionTargetId: 'lead-1',
};
const first = await createInAppNotification(deliveryInput);
const replay = await createInAppNotification(deliveryInput);
assert.equal(first.id, replay.id);
assert.equal(created.length, 1);

const schema = JSON.parse(await readFile(new URL('../base44/entities/InAppNotification.jsonc', import.meta.url), 'utf8'));
assert.equal(schema.rls.read.user_condition.role, 'admin');
assert.equal(schema.rls.create.user_condition.role, 'admin');
for (const forbidden of ['contact_email', 'contact_phone', 'message_body', 'detailed_message', 'original_message']) {
  assert.equal(schema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in notificare`);
}

const providerBackend = await readFile(new URL('../base44/functions/providerLeadInboxOps/entry.ts', import.meta.url), 'utf8');
const patientBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const projection = await readFile(new URL('../shared/inAppNotificationProjection.js', import.meta.url), 'utf8');
const delivery = await readFile(new URL('../shared/inAppNotificationDelivery.js', import.meta.url), 'utf8');
const communication = await readFile(new URL('../shared/leadCommunicationNotifications.js', import.meta.url), 'utf8');
const phoneBackend = await readFile(new URL('../base44/functions/managePatientContactShareApproval/entry.ts', import.meta.url), 'utf8');
const center = await readFile(new URL('../src/components/notifications/NotificationCenter.jsx', import.meta.url), 'utf8');
const providerCenter = await readFile(new URL('../src/components/notifications/ProviderNotificationCenter.jsx', import.meta.url), 'utf8');
const patientCenter = await readFile(new URL('../src/components/notifications/PatientNotificationCenter.jsx', import.meta.url), 'utf8');
const providerInbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');
const patientStatus = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');

assert.match(providerBackend, /base44\.auth\.me\(\)/);
assert.match(providerBackend, /ProviderMembership\.filter/);
assert.match(providerBackend, /recipient_ref_id: userId/);
assert.match(providerBackend, /notification\.location_id !== locationId/);
assert.match(providerBackend, /ensureProviderInAppNotifications/);
assert.match(patientBackend, /sha256\(accessToken\)/);
assert.match(patientBackend, /recipient_type: 'patient_request'/);
assert.match(patientBackend, /notification\.request_id !== requestId/);
assert.match(patientBackend, /ensurePatientInAppNotifications/);
assert.doesNotMatch(patientBackend, /base44\.auth\.me\(\)/);
assert.match(patientBackend, /conversation_enabled: lifecycle\.state === PATIENT_REQUEST_LIFECYCLE_STATES\.ACTIVE/);

assert.match(projection, /PROVIDER_CHAT_MESSAGE_RECEIVED/);
assert.match(projection, /PATIENT_CHAT_MESSAGE_RECEIVED/);
assert.match(projection, /PROVIDER_PHONE_APPROVED/);
assert.match(projection, /PROVIDER_PHONE_REVOKED/);
assert.match(projection, /PATIENT_CONVERSATION_CLOSED/);
assert.match(projection, /PROVIDER_REQUEST_RESOLVED/);
assert.match(projection, /PATIENT_REQUEST_EXPIRED/);
assert.match(delivery, /idempotency_key: idempotencyKey/);
assert.match(communication, /notifyProviderUsersInApp/);
assert.match(communication, /notifyPatientRequestInApp/);

assert.doesNotMatch(phoneBackend, /conversation_access_state: 'locked'/);
assert.match(phoneBackend, /conversation_access_state: checkedLead\.conversation_access_state/);
assert.match(phoneBackend, /conversation_access_state: lead\?\.conversation_access_state/);

assert.match(center, /window\.setInterval\(\(\) => void load\(\), 60000\)/);
assert.match(center, /markAllNotificationsRead/);
assert.match(center, /notification\.title/);
assert.match(center, /notification\.body/);
assert.doesNotMatch(center, /contact_phone|contact_email|detailed_message|original_message/);
assert.match(providerCenter, /providerLeadInboxOps/);
assert.match(providerCenter, /notifications_list/);
assert.match(patientCenter, /getPatientRequestStatus/);
assert.match(patientCenter, /request_access_token: accessToken/);
assert.match(providerInbox, /ProviderNotificationCenter/);
assert.match(providerInbox, /id=\{`provider-lead-\$\{lead\.id\}`\}/);
assert.match(patientStatus, /PatientNotificationCenter/);
assert.match(patientStatus, /id=\{`patient-response-\$\{response\.location_id\}`\}/);
assert.doesNotMatch(providerCenter, /base44\.entities\.InAppNotification/);
assert.doesNotMatch(patientCenter, /base44\.entities\.InAppNotification/);

console.log('In-app notification center checks passed.');
