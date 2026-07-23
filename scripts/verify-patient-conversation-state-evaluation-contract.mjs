import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluatePatientConversationCase } from '../shared/patientConversationEvaluation.js';
import {
  DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS,
  isCriticalPatientConversationFixture,
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const stateFixturePath = 'tests/fixtures/patient-conversation-agent-state-evaluations.json';
const stateFixtures = JSON.parse(fs.readFileSync(stateFixturePath, 'utf8'));
const suite = loadPatientConversationFixtures();
const evaluatorSource = fs.readFileSync(
  'scripts/evaluate-patient-conversation-results.mjs',
  'utf8',
);

assert.deepEqual(DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS, [
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
  stateFixturePath,
]);
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

const intentSwitchFixture = stateFixtures.cases.find((fixture) => fixture.id === 'state-switch-001');
assert(intentSwitchFixture);

const staleIntentResult = evaluatePatientConversationCase({
  fixture: intentSwitchFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'ochelari_lentile',
      care_path_candidates: ['optical_store'],
      service_keys: ['prescription_lenses'],
      provider_type_candidates: ['independent_optical_store'],
      facts: { locality: { city: 'Timisoara', area: '' } },
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

const correctedIntentResult = evaluatePatientConversationCase({
  fixture: intentSwitchFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'investigatii',
      care_path_candidates: ['specialized_ophthalmology'],
      service_keys: ['oct'],
      provider_type_candidates: ['ophthalmology_clinic'],
      facts: { locality: { city: 'Iasi', area: '' } },
      urgency: { level: 'none' },
      next_action: 'search_providers',
      assistant_message: 'Am inteles. Caut servicii OCT in Iasi.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(correctedIntentResult.passed, true);

const localityClearedFixture = stateFixtures.cases.find((fixture) => fixture.id === 'state-locality-002');
assert(localityClearedFixture);
const staleLocalityResult = evaluatePatientConversationCase({
  fixture: localityClearedFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'control_vedere',
      care_path_candidates: ['optometry'],
      service_keys: ['refraction'],
      provider_type_candidates: ['independent_optometrist'],
      facts: { locality: { city: 'Timisoara', area: '' } },
      urgency: { level: 'none' },
      next_action: 'search_providers',
      assistant_message: 'Caut in Timisoara.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(staleLocalityResult.passed, false);
assert(staleLocalityResult.failed_check_ids.includes('next_action'));
assert(staleLocalityResult.failed_check_ids.includes('must_not:search_providers'));

console.log('Patient conversation state fixture and acceptance gates verified.');
