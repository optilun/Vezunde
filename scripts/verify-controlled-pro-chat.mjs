import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTROLLED_CHAT_CONTRACT_VERSION,
  CONTROLLED_CHAT_MAX_MESSAGES_PER_HOUR,
  CONTROLLED_CHAT_MESSAGE_CONTRACT_VERSION,
  controlledChatEligibility,
  controlledChatRateLimitState,
  sanitizeControlledChatMessage,
  validateControlledChatMessage,
} from '../shared/controlledChatPolicy.js';

assert.equal(CONTROLLED_CHAT_CONTRACT_VERSION, 'controlled-pro-chat-v1');
assert.equal(CONTROLLED_CHAT_MESSAGE_CONTRACT_VERSION, 'controlled-chat-message-v1');
assert.equal(validateControlledChatMessage('Buna, as dori mai multe detalii.').valid, true);
assert.equal(validateControlledChatMessage('Scrie-mi la client@example.com').valid, false);
assert.ok(validateControlledChatMessage('Scrie-mi la client@example.com').reasons.includes('email_not_allowed'));
assert.ok(validateControlledChatMessage('Telefon 0712 345 678').reasons.includes('phone_not_allowed'));
assert.ok(validateControlledChatMessage('Detalii pe https://example.com').reasons.includes('link_not_allowed'));
assert.ok(validateControlledChatMessage('a'.repeat(1201)).reasons.includes('message_too_long'));

const request = {
  lifecycle_state: 'active',
  status: 'pregatita_pentru_distribuire',
  expires_at: '2099-01-01T00:00:00.000Z',
};
const lead = {
  id: 'lead-1',
  delivery_state: 'available',
  status: 'interested',
  result_bucket_snapshot: 'top3',
  access_tier: 'pro_full',
};
const response = { status: 'active', response_type: 'can_help' };
const entitlement = { plan_code: 'pro', feature_keys: ['provider_chat.access'] };
const contact = {
  provider_request_distribution_consent: true,
  provider_request_distribution_consent_version: 'patient-request-distribution-top3-pro-v2',
};
assert.equal(controlledChatEligibility({ request, lead, response, entitlement, contact }).eligible, true);
assert.ok(controlledChatEligibility({ request: { ...request, lifecycle_state: 'closed' }, lead, response, entitlement, contact }).reasons.includes('request_lifecycle_not_active'));
assert.ok(controlledChatEligibility({ request, lead: { ...lead, result_bucket_snapshot: 'extended_confirmed' }, response, entitlement, contact }).reasons.includes('lead_not_top3'));
assert.ok(controlledChatEligibility({ request, lead, response, entitlement: { plan_code: 'free', feature_keys: [] }, contact }).reasons.includes('provider_chat_entitlement_required'));
assert.ok(controlledChatEligibility({ request, lead, response: { status: 'active', response_type: 'cannot_help' }, entitlement, contact }).reasons.includes('provider_response_not_eligible'));
assert.ok(controlledChatEligibility({ request, lead, response, entitlement, contact: { ...contact, provider_request_distribution_consent: false } }).reasons.includes('distribution_consent_missing'));
assert.ok(controlledChatEligibility({ request, lead, response, entitlement, contact, conversation: { status: 'closed' } }).reasons.includes('conversation_closed'));

const safeMessage = sanitizeControlledChatMessage({
  id: 'message-1',
  conversation_id: 'secret-conversation',
  request_id: 'secret-request',
  sender_type: 'provider',
  sender_user_id: 'secret-user',
  client_message_id: 'secret-client-id',
  body: 'Mesaj sigur',
  sent_at: '2026-07-20T10:00:00.000Z',
  contact_phone: '0712345678',
});
assert.deepEqual(safeMessage, {
  id: 'message-1',
  sender_type: 'provider',
  body: 'Mesaj sigur',
  sent_at: '2026-07-20T10:00:00.000Z',
});

const now = new Date('2026-07-20T10:00:00.000Z');
const messages = Array.from({ length: CONTROLLED_CHAT_MAX_MESSAGES_PER_HOUR }, (_, index) => ({
  sender_type: 'patient',
  status: 'active',
  sent_at: new Date(now.getTime() - (index * 1000)).toISOString(),
}));
assert.equal(controlledChatRateLimitState(messages, 'patient', now).allowed, false);
assert.equal(controlledChatRateLimitState(messages.slice(1), 'patient', now).allowed, true);

const conversationSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestConversation.jsonc', import.meta.url), 'utf8'));
const messageSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestMessage.jsonc', import.meta.url), 'utf8'));
const leadSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLead.jsonc', import.meta.url), 'utf8'));
assert.equal(conversationSchema.rls.read.user_condition.role, 'admin');
assert.equal(messageSchema.rls.read.user_condition.role, 'admin');
assert.deepEqual(messageSchema.properties.sender_type.enum, ['patient', 'provider']);
assert.deepEqual(conversationSchema.properties.status.enum, ['open', 'closed']);
assert.ok(leadSchema.properties.conversation_lock_token);
assert.ok(leadSchema.properties.conversation_lock_at);
for (const field of ['contact_name', 'contact_email', 'contact_phone', 'access_token_hash']) {
  assert.equal(messageSchema.properties[field], undefined, `${field} nu trebuie stocat in mesaj`);
  assert.equal(conversationSchema.properties[field], undefined, `${field} nu trebuie stocat in conversatie`);
}

const backend = await readFile(new URL('../base44/functions/controlledChatOps/entry.ts', import.meta.url), 'utf8');
const responseBackend = await readFile(new URL('../base44/functions/providerLeadResponseOps/entry.ts', import.meta.url), 'utf8');
const patientClient = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const patientPanel = await readFile(new URL('../src/components/intake2/PatientRequestChat.jsx', import.meta.url), 'utf8');
const patientStatus = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const providerPanel = await readFile(new URL('../src/components/workspace/provider/ProviderLeadChat.jsx', import.meta.url), 'utf8');
const providerInbox = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');

assert.match(backend, /actor === 'patient'/);
assert.match(backend, /actor === 'provider'/);
assert.match(backend, /sha256\(accessToken\)/);
assert.match(backend, /ProviderMembership\.filter/);
assert.match(backend, /PatientRequest\.get\(lead\.request_id\)/);
assert.match(backend, /request: checked\.request/);
assert.match(backend, /provider_chat\.access/);
assert.match(backend, /PatientRequestConversation\.create/);
assert.match(backend, /PatientRequestMessage\.create/);
assert.match(backend, /client_message_id/);
assert.match(backend, /controlledChatRateLimitState/);
assert.match(backend, /acquireControlledChatOpenLock/);
assert.match(backend, /acquireControlledChatMessageLock/);
assert.match(backend, /Nu include telefon, email sau linkuri in chat/);
assert.doesNotMatch(backend, /input\.contact_phone|input\.contact_email/);
assert.match(responseBackend, /PatientRequestConversation\.filter/);
assert.match(responseBackend, /closed_by: 'system'/);
assert.match(responseBackend, /conversation_access_state: 'locked'/);

assert.match(patientClient, /patientControlledChat/);
assert.match(patientClient, /actor: "patient"/);
assert.match(patientPanel, /Deschide conversația/);
assert.match(patientPanel, /Nu introduce telefon, email sau linkuri/);
assert.match(patientPanel, /clientMessageId: createControlledChatMessageId/);
assert.match(patientStatus, /<PatientRequestChat/);
assert.match(providerPanel, /actor: "provider"/);
assert.match(providerPanel, /Locația nu poate iniția chatul unilateral/);
assert.match(providerPanel, /client_message_id: createMessageId/);
assert.match(providerInbox, /provider_chat\.access/);
assert.match(providerInbox, /<ProviderLeadChat/);
for (const source of [patientPanel, providerPanel]) {
  assert.doesNotMatch(source, /base44\.entities\.PatientRequestMessage|base44\.entities\.PatientRequestConversation/);
}

console.log('Controlled Pro chat checks passed.');
