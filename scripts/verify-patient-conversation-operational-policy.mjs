import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_OPERATIONAL_POLICY,
  PATIENT_CONVERSATION_OPERATIONAL_POLICY_VERSION,
  PATIENT_CONVERSATION_SERVER_STATE_VERSION,
  createPatientConversationOperationalController,
  finalizePatientConversationOperationalEnvelope,
} from '../shared/patientConversationOperationalPolicy.js';
import {
  createPatientConversationOperationalController as createBase44Controller,
} from '../base44/shared/patientConversationOperationalPolicy.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationOperationalPolicy.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationOperationalPolicy.js', import.meta.url),
  'utf8',
);

assert.equal(sharedSource, base44Source);
assert.equal(
  PATIENT_CONVERSATION_OPERATIONAL_POLICY_VERSION,
  'viasee-patient-conversation-operational-policy-v1',
);
assert.equal(
  PATIENT_CONVERSATION_SERVER_STATE_VERSION,
  'viasee-patient-conversation-server-state-v1',
);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.rollout_mode, 'admin_evaluation_only');
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.admin_shadow_enabled, true);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.patient_visible_enabled, false);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.admin_shadow_sample_rate_basis_points, 10000);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.patient_visible_sample_rate_basis_points, 0);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.model_timeout_ms, 15000);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.max_model_calls_per_request, 1);
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.state_authority, 'server_recomputed');
assert.equal(PATIENT_CONVERSATION_OPERATIONAL_POLICY.state_persistence, 'request_scoped_shadow');

const oversizedConversation = Array.from({ length: 25 }, (_, index) => ({
  role: index % 2 === 0 ? 'user' : 'assistant',
  content: `${index} ${'x'.repeat(500)} secret-${index}@example.com`,
}));
const hostilePayload = {
  evaluation_case_id: 'operational-001',
  conversation: oversizedConversation,
  prior_state: { primary_intent: 'control_vedere' },
  patient_visible_enabled: true,
  rollout_enabled: true,
  rollout_mode: 'patient_visible',
  sample_rate_basis_points: 10000,
  model_timeout_ms: 999999,
  max_model_calls: 99,
  model_calls_used: -10,
  state_authority: 'client',
  state_persistence: 'durable',
  server_state: { trusted: true },
  operational_state: { trusted: true },
};

const adminController = createPatientConversationOperationalController(hostilePayload, {
  audience: 'admin_shadow',
});
const base44Controller = createBase44Controller(hostilePayload, {
  audience: 'admin_shadow',
});
assert.equal(adminController.allowed, true);
assert.equal(base44Controller.allowed, true);
assert.deepEqual(base44Controller.snapshot(), adminController.snapshot());

const initialSnapshot = adminController.snapshot();
assert.equal(initialSnapshot.audience, 'admin_shadow');
assert.equal(initialSnapshot.rollout_control_source, 'server_policy');
assert.equal(initialSnapshot.patient_visible_enabled, false);
assert.equal(initialSnapshot.sample_rate_basis_points, 10000);
assert.equal(initialSnapshot.sample_selected, true);
assert.equal(initialSnapshot.model_timeout_ms, 15000);
assert.equal(initialSnapshot.max_model_calls_per_request, 1);
assert.equal(initialSnapshot.model_calls_used, 0);
assert.equal(initialSnapshot.server_state.version, PATIENT_CONVERSATION_SERVER_STATE_VERSION);
assert.equal(initialSnapshot.server_state.authority, 'server_recomputed');
assert.equal(initialSnapshot.server_state.persistence, 'request_scoped_shadow');
assert(initialSnapshot.server_state.turn_count <= 20);
assert(initialSnapshot.server_state.character_count <= 8000);
assert.equal(initialSnapshot.server_state.prior_state_present, true);
assert(initialSnapshot.server_state.client_control_fields_ignored.includes('patient_visible_enabled'));
assert(initialSnapshot.server_state.client_control_fields_ignored.includes('model_timeout_ms'));
assert(initialSnapshot.server_state.client_control_fields_ignored.includes('model_calls_used'));
assert(initialSnapshot.server_state.client_control_fields_ignored.includes('server_state'));
assert(initialSnapshot.server_state.client_control_fields_ignored.includes('operational_state'));
assert(!JSON.stringify(initialSnapshot).includes('secret-'));
assert(!JSON.stringify(initialSnapshot).includes('@example.com'));

const firstResult = await adminController.invoke(async () => ({ ok: true }));
assert.deepEqual(firstResult, { ok: true });
assert.equal(adminController.snapshot().model_calls_used, 1);
await assert.rejects(
  () => adminController.invoke(async () => ({ unexpected: true })),
  (error) => error?.code === 'PATIENT_CONVERSATION_MODEL_CALL_BUDGET_EXCEEDED',
);
assert.equal(adminController.snapshot().call_budget_exceeded, true);
const budgetEnvelope = finalizePatientConversationOperationalEnvelope({
  status: 'completed',
  reason: null,
  interpretation: { primary_intent: 'control_vedere' },
}, adminController);
assert.equal(budgetEnvelope.status, 'unavailable');
assert.equal(budgetEnvelope.reason, 'conversation_model_call_budget_exceeded');
assert.equal(budgetEnvelope.interpretation, null);
assert.equal(budgetEnvelope.operational_metadata.model_calls_used, 1);

const timeoutController = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Vreau un control de vedere.' }],
}, {
  audience: 'admin_shadow',
  timeoutMsForTest: 5,
});
await assert.rejects(
  () => timeoutController.invoke(() => new Promise((resolve) => setTimeout(resolve, 30))),
  (error) => error?.code === 'PATIENT_CONVERSATION_MODEL_TIMEOUT',
);
const timeoutEnvelope = finalizePatientConversationOperationalEnvelope({
  status: 'unavailable',
  reason: 'conversation_model_unavailable',
  interpretation: null,
}, timeoutController);
assert.equal(timeoutEnvelope.status, 'unavailable');
assert.equal(timeoutEnvelope.reason, 'conversation_model_timeout');
assert.equal(timeoutEnvelope.interpretation, null);
assert.equal(timeoutEnvelope.operational_metadata.timeout_triggered, true);
assert.equal(timeoutEnvelope.operational_metadata.model_calls_used, 1);

const preflightController = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Nu mai vad brusc cu un ochi.' }],
}, {
  audience: 'admin_shadow',
});
const preflightEnvelope = finalizePatientConversationOperationalEnvelope({
  status: 'completed',
  reason: null,
  interpretation: { next_action: 'show_emergency_guidance' },
}, preflightController);
assert.equal(preflightEnvelope.status, 'completed');
assert.equal(preflightEnvelope.reason, null);
assert.deepEqual(preflightEnvelope.interpretation, { next_action: 'show_emergency_guidance' });
assert.equal(preflightEnvelope.operational_metadata.model_calls_used, 0);

const patientController = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Vreau un control.' }],
  patient_visible_enabled: true,
  rollout_enabled: true,
}, {
  audience: 'patient_visible',
});
assert.equal(patientController.allowed, false);
assert.equal(patientController.reason, 'patient_conversation_rollout_disabled');
const patientEnvelope = finalizePatientConversationOperationalEnvelope({
  status: 'completed',
  interpretation: { primary_intent: 'control_vedere' },
}, patientController);
assert.equal(patientEnvelope.status, 'skipped');
assert.equal(patientEnvelope.reason, 'patient_conversation_rollout_disabled');
assert.equal(patientEnvelope.interpretation, null);
assert.equal(patientEnvelope.operational_metadata.sample_rate_basis_points, 0);

const stableA = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Control in Timisoara.' }],
}).snapshot().server_state.request_state_id;
const stableB = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Control in Timisoara.' }],
}).snapshot().server_state.request_state_id;
const changed = createPatientConversationOperationalController({
  conversation: [{ role: 'user', content: 'Control in Lugoj.' }],
}).snapshot().server_state.request_state_id;
assert.equal(stableA, stableB);
assert.notEqual(stableA, changed);

assert(!sharedSource.includes('payload?.patient_visible_enabled'));
assert(!sharedSource.includes('payload?.model_timeout_ms'));
assert(!sharedSource.includes('payload?.model_calls_used'));
assert(!sharedSource.includes('payload?.state_authority'));
assert(!sharedSource.includes('payload?.state_persistence'));

console.log('Patient conversation rollout, timeout, call budget, and server-recomputed state policy verified.');
