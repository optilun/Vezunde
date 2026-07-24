import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_DURABLE_STATE_POLICY,
  PATIENT_CONVERSATION_DURABLE_STATE_POLICY_VERSION,
  PATIENT_CONVERSATION_DURABLE_STATE_RECORD_VERSION,
  buildPatientConversationDurableFactProvenance,
  createPatientConversationDurableStateRecord,
  evaluatePatientConversationDurableBudget,
  patientConversationDurableStateActivationReadiness,
  planPatientConversationDurableStateUpdate,
  validatePatientConversationDurableStateRecord,
} from '../shared/patientConversationDurableStatePolicy.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationDurableStatePolicy.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationDurableStatePolicy.js', import.meta.url),
  'utf8',
);
const entrySource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
  'utf8',
);
const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
const coreSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts', import.meta.url),
  'utf8',
);

assert.equal(sharedSource, base44Source);
assert(!sharedSource.includes('base44.entities'));
assert(!sharedSource.includes('asServiceRole'));
for (const runtimeSource of [entrySource, wrapperSource, coreSource]) {
  assert(
    !runtimeSource.includes('patientConversationDurableStatePolicy'),
    'Inactive durable state contract must not be imported by the shadow runtime.',
  );
  assert(
    !runtimeSource.includes('createPatientConversationDurableStateRecord'),
    'Shadow runtime must not create durable state records.',
  );
}
assert.equal(
  PATIENT_CONVERSATION_DURABLE_STATE_POLICY_VERSION,
  'viasee-patient-conversation-durable-state-policy-v1',
);
assert.equal(
  PATIENT_CONVERSATION_DURABLE_STATE_RECORD_VERSION,
  'viasee-patient-conversation-durable-state-record-v1',
);
assert.deepEqual(PATIENT_CONVERSATION_DURABLE_STATE_POLICY, {
  mode: 'inactive_contract_only',
  persistence_adapter: 'none',
  patient_visible_persistence_enabled: false,
  admin_shadow_persistence_enabled: false,
  session_ttl_ms: 2 * 60 * 60 * 1000,
  maximum_clock_skew_ms: 5 * 60 * 1000,
  concurrency_control: 'optimistic_revision',
  raw_conversation_persistence: 'forbidden',
  evidence_provenance_required: true,
  max_model_calls_per_session: null,
  max_model_calls_per_subject_24h: null,
  release_ready: false,
});

const now = 1_800_000_000_000;
const sessionId = 'pcs_1234567890abcdef';
const subjectKey = 'subject_1234567890abcdef';
const record = createPatientConversationDurableStateRecord({
  sessionId,
  subjectKey,
  now,
});
assert(record);
assert.equal(record.session_id, sessionId);
assert.equal(record.subject_key, subjectKey);
assert.equal(record.status, 'active');
assert.equal(record.revision, 0);
assert.equal(record.model_calls_used, 0);
assert.equal(record.expires_at, now + 2 * 60 * 60 * 1000);
assert.equal(validatePatientConversationDurableStateRecord(record, { now }).valid, true);
assert.equal(createPatientConversationDurableStateRecord({
  sessionId: 'client-controlled',
  subjectKey,
  now,
}), null);
assert.equal(createPatientConversationDurableStateRecord({
  sessionId,
  subjectKey: 'ana@example.com',
  now,
}), null);

const facts = {
  symptom_onset: '',
  symptom_duration: 'De cateva luni',
  symptom_pattern: 'Vad mai prost cand citesc si ma doare capul',
};
const factEvidence = {
  symptom_onset: [],
  symptom_duration: ['De cateva luni'],
  symptom_pattern: ['Vad mai prost cand citesc si ma doare capul'],
};
const userMessages = [
  {
    role: 'user',
    message_id: 'msg_12345678',
    content: 'Vad mai prost cand citesc si ma doare capul.',
  },
  {
    role: 'assistant',
    message_id: 'msg_assistant1',
    content: 'De cand ai observat?',
  },
  {
    role: 'user',
    message_id: 'msg_87654321',
    content: 'De cateva luni.',
  },
];
const builtProvenance = buildPatientConversationDurableFactProvenance({
  facts,
  factEvidence,
  userMessages,
  revision: 1,
});
assert.equal(builtProvenance.valid, true);
assert.deepEqual(builtProvenance.missing_fields, []);
assert.deepEqual(builtProvenance.provenance.symptom_duration, {
  value: 'De cateva luni',
  evidence_phrase: 'De cateva luni',
  source_message_id: 'msg_87654321',
  verified_at_revision: 1,
});
assert.deepEqual(builtProvenance.provenance.symptom_pattern, {
  value: 'Vad mai prost cand citesc si ma doare capul',
  evidence_phrase: 'Vad mai prost cand citesc si ma doare capul',
  source_message_id: 'msg_12345678',
  verified_at_revision: 1,
});

const assistantOnlyProvenance = buildPatientConversationDurableFactProvenance({
  facts: { symptom_onset: 'A aparut brusc' },
  factEvidence: { symptom_onset: ['A aparut brusc'] },
  userMessages: [
    { role: 'assistant', message_id: 'msg_assistant2', content: 'A aparut brusc?' },
    { role: 'user', message_id: 'msg_abcdefgh', content: 'Nu, este mai veche.' },
  ],
});
assert.equal(assistantOnlyProvenance.valid, false);
assert.deepEqual(assistantOnlyProvenance.missing_fields, ['symptom_onset']);

const missingEvidenceProvenance = buildPatientConversationDurableFactProvenance({
  facts: { symptom_pattern: 'Vad dublu' },
  factEvidence: { symptom_pattern: [] },
  userMessages: [
    { role: 'user', message_id: 'msg_qwerty12', content: 'Vad dublu.' },
  ],
});
assert.equal(missingEvidenceProvenance.valid, false);
assert.deepEqual(missingEvidenceProvenance.missing_fields, ['symptom_pattern']);

const planned = planPatientConversationDurableStateUpdate(record, {
  expectedRevision: 0,
  groundedFacts: facts,
  factProvenance: builtProvenance.provenance,
  modelCallsIncrement: 1,
  now: now + 1_000,
});
assert.equal(planned.status, 'planned');
assert.equal(planned.reason, 'persistence_adapter_not_implemented');
assert.equal(planned.activation_allowed, false);
assert.equal(planned.record.revision, 1);
assert.equal(planned.record.model_calls_used, 1);
assert.equal(validatePatientConversationDurableStateRecord(
  planned.record,
  { now: now + 1_000 },
).valid, true);

const staleWrite = planPatientConversationDurableStateUpdate(planned.record, {
  expectedRevision: 0,
  groundedFacts: facts,
  factProvenance: builtProvenance.provenance,
  now: now + 2_000,
});
assert.equal(staleWrite.status, 'conflict');
assert.equal(staleWrite.reason, 'durable_state_revision_mismatch');
assert.equal(staleWrite.record, null);

const missingProvenanceWrite = planPatientConversationDurableStateUpdate(record, {
  expectedRevision: 0,
  groundedFacts: facts,
  factProvenance: {},
  now: now + 1_000,
});
assert.equal(missingProvenanceWrite.status, 'rejected');
assert.equal(missingProvenanceWrite.reason, 'durable_state_update_invalid');
assert(missingProvenanceWrite.violations.includes('missing_provenance:symptom_duration'));
assert(missingProvenanceWrite.violations.includes('missing_provenance:symptom_pattern'));

const rawConversationRecord = {
  ...record,
  conversation: [{ role: 'user', content: 'text brut' }],
};
const rawConversationValidation = validatePatientConversationDurableStateRecord(
  rawConversationRecord,
  { now },
);
assert.equal(rawConversationValidation.valid, false);
assert(rawConversationValidation.violations.includes('unexpected_field:conversation'));

const unknownNestedFieldRecord = {
  ...record,
  grounded_facts: {
    ...record.grounded_facts,
    diagnosis: 'conjunctivita',
  },
};
const unknownNestedValidation = validatePatientConversationDurableStateRecord(
  unknownNestedFieldRecord,
  { now },
);
assert.equal(unknownNestedValidation.valid, false);
assert(unknownNestedValidation.violations.includes('unexpected_fact_field:diagnosis'));

const expiredValidation = validatePatientConversationDurableStateRecord(record, {
  now: record.expires_at + 1,
});
assert.equal(expiredValidation.valid, false);
assert(expiredValidation.violations.includes('record_expired'));

const completed = planPatientConversationDurableStateUpdate(record, {
  expectedRevision: 0,
  groundedFacts: {},
  factProvenance: {},
  status: 'completed',
  now: now + 1_000,
});
assert.equal(completed.status, 'planned');
const reopenCompleted = planPatientConversationDurableStateUpdate(completed.record, {
  expectedRevision: completed.record.revision,
  groundedFacts: {},
  factProvenance: {},
  status: 'active',
  now: now + 2_000,
});
assert.equal(reopenCompleted.status, 'rejected');
assert.equal(reopenCompleted.reason, 'durable_state_transition_invalid');

assert.deepEqual(evaluatePatientConversationDurableBudget({
  record,
  modelCallsIncrement: 1,
}), {
  allowed: false,
  reason: 'durable_budget_policy_unconfigured',
});
assert.equal(evaluatePatientConversationDurableBudget({
  record,
  modelCallsIncrement: 1,
  sessionLimit: 3,
  subjectCalls24h: 2,
  subjectLimit: 5,
}).allowed, true);
assert.equal(evaluatePatientConversationDurableBudget({
  record: { ...record, model_calls_used: 3 },
  modelCallsIncrement: 1,
  sessionLimit: 3,
  subjectCalls24h: 2,
  subjectLimit: 5,
}).reason, 'session_model_call_budget_exceeded');
assert.equal(evaluatePatientConversationDurableBudget({
  record,
  modelCallsIncrement: 1,
  sessionLimit: 3,
  subjectCalls24h: 5,
  subjectLimit: 5,
}).reason, 'subject_model_call_budget_exceeded');

assert.deepEqual(patientConversationDurableStateActivationReadiness(), {
  ready: false,
  blockers: [
    'persistence_adapter_missing',
    'session_budget_unapproved',
    'subject_budget_unapproved',
    'patient_visible_persistence_disabled',
  ],
});

console.log('Patient conversation durable state contract verified inactive, disconnected, and fail closed.');
