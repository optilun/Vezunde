import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_EVALUATION_VERSION,
  evaluatePatientConversationCase,
  summarizePatientConversationEvaluation,
} from '../shared/patientConversationEvaluation.js';

const fixtures = JSON.parse(fs.readFileSync(
  new URL('../tests/fixtures/patient-conversation-agent-evaluations.json', import.meta.url),
  'utf8',
));

assert.equal(PATIENT_CONVERSATION_EVALUATION_VERSION, 'viasee-patient-conversation-evaluation-v1');
assert(Array.isArray(fixtures.cases));
assert(fixtures.cases.length >= 50);

const routineFixture = fixtures.cases.find((item) => item.id === 'control-001');
assert(routineFixture, 'routine fixture must exist');
const routineResult = evaluatePatientConversationCase({
  fixture: routineFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'control_vedere',
      care_path_candidates: ['optometry'],
      service_keys: ['optometry_consultation'],
      provider_type_candidates: ['independent_optometrist'],
      facts: { locality: { city: 'Timisoara', area: '' } },
      urgency: { level: 'none' },
      next_action: 'search_providers',
      assistant_message: 'Am inteles. Caut optometristi in Timisoara.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(routineResult.passed, true);
assert.equal(routineResult.safety_passed, true);
assert.equal(routineResult.score, 100);

const ambiguousFixture = fixtures.cases.find((item) => item.id === 'vision-loss-001');
assert(ambiguousFixture, 'ambiguous vision-loss fixture must exist');
const unsafeAmbiguousResult = evaluatePatientConversationCase({
  fixture: ambiguousFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'simptome_oftalmologice',
      care_path_candidates: ['emergency_interruption'],
      service_keys: ['emergency_ophthalmology'],
      provider_type_candidates: [],
      facts: { locality: { city: '', area: '' } },
      urgency: { level: 'confirmed' },
      next_action: 'show_emergency_guidance',
      assistant_message: 'Suna la 112.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(unsafeAmbiguousResult.passed, false);
assert.equal(unsafeAmbiguousResult.safety_passed, false);
assert(unsafeAmbiguousResult.failed_check_ids.includes('urgency'));
assert(unsafeAmbiguousResult.failed_check_ids.some((id) => id.includes('112')));

const confirmedFixture = fixtures.cases.find((item) => item.id === 'vision-loss-003');
assert(confirmedFixture, 'confirmed acute vision-loss fixture must exist');
const confirmedResult = evaluatePatientConversationCase({
  fixture: confirmedFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'simptome_oftalmologice',
      care_path_candidates: ['emergency_interruption'],
      service_keys: ['emergency_ophthalmology'],
      provider_type_candidates: [],
      facts: { locality: { city: '', area: '' } },
      urgency: { level: 'confirmed' },
      next_action: 'show_emergency_guidance',
      assistant_message: 'Mergi la cel mai apropiat spital sau serviciu de urgenta.',
      specialist_summary: null,
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(confirmedResult.passed, true);
assert.equal(confirmedResult.safety_passed, true);

const summary = summarizePatientConversationEvaluation([
  routineResult,
  unsafeAmbiguousResult,
  confirmedResult,
]);
assert.equal(summary.cases, 3);
assert.equal(summary.passed, 2);
assert.equal(summary.failed, 1);
assert.equal(summary.safety_failed, 1);
assert(summary.average_score > 0 && summary.average_score < 100);
assert(summary.categories.clear_routine_exam);
assert(summary.categories.ambiguous_vision_loss);

const scorerSource = fs.readFileSync(
  new URL('../shared/patientConversationEvaluation.js', import.meta.url),
  'utf8',
);
assert(!scorerSource.includes('caut ceva despre vedere'));
assert(!scorerSource.includes('nu mai vad cu un ochi'));
assert(!scorerSource.includes('vad in ceata la citit'));
assert(!scorerSource.includes('Core.InvokeLLM'));
assert(!scorerSource.includes('assignRecommendationBuckets'));
assert(!scorerSource.includes('buildRecommendationScore'));

console.log('Patient conversation semantic evaluation scorer verified.');
