import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluatePatientConversationCase } from '../shared/patientConversationEvaluation.js';
import {
  DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS,
  isCriticalPatientConversationFixture,
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const stateFixturePath = 'tests/fixtures/patient-conversation-agent-state-evaluations.json';
const overrideFixturePath = 'tests/fixtures/patient-conversation-agent-evaluation-overrides.json';
const stateFixtures = JSON.parse(fs.readFileSync(stateFixturePath, 'utf8'));
const suite = loadPatientConversationFixtures();
const evaluatorSource = [
  fs.readFileSync('scripts/evaluate-patient-conversation-results.mjs', 'utf8'),
  fs.readFileSync('scripts/evaluate-patient-conversation-results-legacy.mjs', 'utf8'),
].join('\n');
const caseEvaluatorSource = fs.readFileSync(
  'shared/patientConversationEvaluation.js',
  'utf8',
);

assert.deepEqual(DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS, [
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
  stateFixturePath,
  overrideFixturePath,
]);
assert.deepEqual(suite.replacement_case_ids, ['vision-loss-003', 'summary-001']);
assert.equal(stateFixtures.fixture_version, 'patient-conversation-agent-state-evaluations-v1.1');
assert.equal(stateFixtures.cases.length, 10);
assert.equal(suite.cases.length, 71);
assert.equal(new Set(suite.cases.map((fixture) => fixture.id)).size, 71);

for (const category of [
  'prior_state_short_answer',
  'prior_state_locality_only_answer',
  'prior_state_intent_replacement',
  'technical_to_routine_intent_switch',
  'locality_replacement',
  'locality_cleared',
  'person_replacement',
  'symptom_timing_correction',
  'mixed_romanian_english',
  'typos_without_diacritics',
]) {
  assert(
    suite.cases.some((fixture) => fixture.category === category),
    `Missing state evaluation category: ${category}`,
  );
}

for (const category of [
  'prior_state_intent_replacement',
  'technical_to_routine_intent_switch',
  'locality_replacement',
  'locality_cleared',
  'person_replacement',
  'symptom_timing_correction',
]) {
  const fixture = suite.cases.find((item) => item.category === category);
  assert.equal(
    isCriticalPatientConversationFixture(fixture),
    true,
    `${category} must receive repeated critical evaluation`,
  );
}

for (const requiredSourceFragment of [
  "const EXPECTED_STATE_POLICY_VERSION = 'viasee-patient-conversation-state-policy-v1.1';",
  'state_policy_application: 100',
  'state_memory_retention: 100',
  'intent_switch_accuracy: 100',
  'fact_correction_accuracy: 100',
  'state_policy_application_required: statePolicyApplicationRequired',
  'state_evaluation_required: stateEvaluationRequired',
  'acceptance.observed.state_policy_application',
  'acceptance.observed.state_memory_retention',
  'acceptance.observed.intent_switch_accuracy',
  'acceptance.observed.fact_correction_accuracy',
]) {
  assert(
    evaluatorSource.includes(requiredSourceFragment),
    `Evaluator is missing state gate: ${requiredSourceFragment}`,
  );
}
assert(
  caseEvaluatorSource.includes('for (const forbiddenFact of list(expected.forbidden_facts))'),
  'Case evaluation must enforce forbidden stale facts.',
);
assert(
  caseEvaluatorSource.includes('`forbidden_fact:${forbiddenFact}`'),
  'Forbidden facts must be visible as dedicated failed checks.',
);
assert(
  caseEvaluatorSource.includes('forget_previous_need: forgotPreviousNeed(result)'),
  'Prior-need retention token must have an active evaluator rule.',
);

const intentSwitchFixture = stateFixtures.cases.find((fixture) => fixture.id === 'state-switch-001');
assert(intentSwitchFixture);
assert.deepEqual(intentSwitchFixture.expected.forbidden_facts, [
  'prescription_status',
  'repair_details',
]);

const staleIntentResult = evaluatePatientConversationCase({
  fixture: intentSwitchFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'ochelari_lentile',
      care_path_candidates: ['optical_store'],
      service_keys: ['prescription_lenses'],
      provider_type_candidates: ['independent_optical_store'],
      facts: {
        locality: { city: 'Timisoara', area: '' },
        prescription_status: 'has_prescription',
      },
      urgency: { level: 'none' },
      next_action: 'search_providers',
      assistant_message: 'Caut optici in Timisoara.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(staleIntentResult.passed, false);
assert(staleIntentResult.failed_check_ids.includes('primary_intent'));
assert(staleIntentResult.failed_check_ids.includes('must_not:retain_superseded_eyeglasses_intent'));

console.log('Patient conversation state evaluation contract verified.');