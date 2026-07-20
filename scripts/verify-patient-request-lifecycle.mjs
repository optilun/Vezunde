import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_REQUEST_LIFECYCLE_CONTRACT_VERSION,
  PATIENT_REQUEST_LIFECYCLE_STATES,
  canTransitionPatientRequestLifecycle,
  derivePatientRequestLifecycle,
  patientRequestHasExpired,
  patientRequestLifecyclePatch,
  sanitizePatientRequestLifecycle,
} from '../shared/patientRequestLifecyclePolicy.js';

assert.equal(PATIENT_REQUEST_LIFECYCLE_CONTRACT_VERSION, 'patient-request-lifecycle-v1');
assert.equal(canTransitionPatientRequestLifecycle('active', 'resolved'), true);
assert.equal(canTransitionPatientRequestLifecycle('active', 'closed'), true);
assert.equal(canTransitionPatientRequestLifecycle('active', 'expired'), true);
assert.equal(canTransitionPatientRequestLifecycle('resolved', 'active'), false);
assert.equal(canTransitionPatientRequestLifecycle('closed', 'resolved'), false);

const futureRequest = {
  status: 'pregatita_pentru_distribuire',
  lifecycle_state: 'active',
  expires_at: '2099-01-01T00:00:00.000Z',
};
assert.equal(patientRequestHasExpired(futureRequest, new Date('2026-07-20T10:00:00.000Z')), false);
assert.equal(derivePatientRequestLifecycle({ request: futureRequest }).stage, 'distributed');
assert.equal(derivePatientRequestLifecycle({ request: futureRequest, leadCount: 2 }).stage, 'waiting_responses');
assert.equal(derivePatientRequestLifecycle({ request: futureRequest, leadCount: 2, activeResponseCount: 1 }).stage, 'has_responses');
assert.equal(derivePatientRequestLifecycle({ request: futureRequest, leadCount: 2, activeResponseCount: 1, openConversationCount: 1 }).stage, 'conversation_active');

const expired = derivePatientRequestLifecycle({
  request: { ...futureRequest, expires_at: '2026-07-19T00:00:00.000Z' },
  now: new Date('2026-07-20T10:00:00.000Z'),
});
assert.equal(expired.state, PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED);
assert.equal(expired.terminal, true);

const resolvedPatch = patientRequestLifecyclePatch('resolved', 'patient', new Date('2026-07-20T10:00:00.000Z'));
assert.equal(resolvedPatch.lifecycle_state, 'resolved');
assert.equal(resolvedPatch.status, 'inchisa');
assert.equal(resolvedPatch.resolved_at, '2026-07-20T10:00:00.000Z');
assert.equal(sanitizePatientRequestLifecycle({ state: 'resolved', stage: 'resolved' }).can_close, false);

const requestSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequest.jsonc', import.meta.url), 'utf8'));
const leadSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLead.jsonc', import.meta.url), 'utf8'));
assert.deepEqual(requestSchema.properties.lifecycle_state.enum, ['active', 'resolved', 'closed', 'expired']);
assert.ok(requestSchema.properties.lifecycle_lock_token);
assert.ok(requestSchema.properties.expiration_processed_at);
assert.deepEqual(leadSchema.properties.closure_reason.enum, ['request_resolved', 'request_closed', 'request_expired']);
assert.ok(leadSchema.properties.closed_at);

const lifecycleOps = await readFile(new URL('../shared/patientRequestLifecycleOps.js', import.meta.url), 'utf8');
const statusBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const providerInboxBackend = await readFile(new URL('../base44/functions/providerLeadInboxOps/entry.ts', import.meta.url), 'utf8');
const chatPolicy = await readFile(new URL('../shared/controlledChatPolicy.js', import.meta.url), 'utf8');
const chatBackend = await readFile(new URL('../base44/functions/controlledChatOps/entry.ts', import.meta.url), 'utf8');
const phoneBackend = await readFile(new URL('../base44/functions/managePatientContactShareApproval/entry.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const patientStatus = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const lifecyclePanel = await readFile(new URL('../src/components/intake2/PatientRequestLifecyclePanel.jsx', import.meta.url), 'utf8');
const notificationPolicy = await readFile(new URL('../shared/inAppNotificationPolicy.js', import.meta.url), 'utf8');
const notificationProjection = await readFile(new URL('../shared/inAppNotificationProjection.js', import.meta.url), 'utf8');

assert.match(lifecycleOps, /acquirePatientRequestLifecycleLock/);
assert.match(lifecycleOps, /acquireControlledChatMessageLock/);
assert.match(lifecycleOps, /PatientRequestConversation\.update/);
assert.match(lifecycleOps, /ContactShareApproval\.update/);
assert.match(lifecycleOps, /ProviderLead\.update/);
assert.match(lifecycleOps, /contact_access_state: 'revoked'/);
assert.match(lifecycleOps, /conversation_access_state: 'locked'/);
assert.match(lifecycleOps, /delivery_state: closure\.deliveryState/);

assert.match(statusBackend, /action === 'resolve' \|\| action === 'close'/);
assert.match(statusBackend, /transitionPatientRequestLifecycle/);
assert.match(statusBackend, /reconcilePatientRequestExpiration/);
assert.match(statusBackend, /sanitizePatientRequestLifecycle/);
assert.doesNotMatch(statusBackend, /base44\.auth\.me\(\)/);

assert.match(providerInboxBackend, /reconcileLocationExpirations/);
assert.match(providerInboxBackend, /reconcilePatientRequestExpiration/);
assert.match(chatPolicy, /request_lifecycle_not_active/);
assert.match(chatBackend, /request: checked\.request/);
assert.match(chatBackend, /PatientRequest\.get\(lead\.request_id\)/);
assert.match(phoneBackend, /requestAllowsPhoneApproval/);
assert.match(phoneBackend, /Cererea nu mai permite aprobarea numarului de telefon/);

assert.match(client, /updatePatientRequestLifecycle/);
assert.match(client, /\["resolve", "close"\]/);
assert.match(patientStatus, /PatientRequestLifecyclePanel/);
assert.match(patientStatus, /status\?\.lifecycle\?\.state === "active"/);
assert.match(lifecyclePanel, /Cererea a fost rezolvata/);
assert.match(lifecyclePanel, /Inchide cererea/);
assert.match(lifecyclePanel, /inchide toate conversatiile si retrage accesul acordat la telefon/);

assert.match(notificationPolicy, /PROVIDER_REQUEST_RESOLVED/);
assert.match(notificationPolicy, /PROVIDER_REQUEST_EXPIRED/);
assert.match(notificationPolicy, /PATIENT_REQUEST_EXPIRED/);
assert.match(notificationProjection, /request_resolved/);
assert.match(notificationProjection, /request_expired/);
assert.match(notificationProjection, /Perioada activa s-a incheiat/);

for (const source of [patientStatus, lifecyclePanel]) {
  assert.doesNotMatch(source, /contact_phone\s*:|access_token_hash|original_message|detailed_message/);
}

console.log('Patient request lifecycle checks passed.');
