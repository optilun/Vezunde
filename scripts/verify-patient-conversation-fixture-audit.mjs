import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_EVALUATION_VERSION,
  evaluatePatientConversationCase,
} from '../shared/patientConversationEvaluation.js';
import {
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
} from '../shared/patientEmergencyGuidance.js';
import {
  PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS,
  PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS,
  assertPatientConversationFixtureReleaseReady,
  validatePatientConversationFixtureContract,
} from './patient-conversation-fixture-contract.mjs';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const suite = loadPatientConversationFixtures();
const evaluatorSource = fs.readFileSync(
  new URL('../shared/patientConversationEvaluation.js', import.meta.url),
  'utf8',
);
const emergencyGuidance = PATIENT_EMERGENCY_GUIDANCE_MESSAGE
  .toLocaleLowerCase('ro-RO');

assert.equal(PATIENT_CONVERSATION_EVALUATION_VERSION, 'viasee-patient-conversation-evaluation-v1.4');
assert.equal(suite.cases.length, 71);
assert.equal(new Set(suite.cases.map((fixture) => fixture.id)).size, 71);
assert.deepEqual(suite.replacement_case_ids, ['vision-loss-003', 'summary-001']);
assert.equal(suite.fixture_paths.length, 4);
assert.equal(suite.fixture_versions.length, 4);
assert(suite.fixture_versions.some((item) => (
  item.fixture_version === 'patient-conversation-agent-evaluation-overrides-v1'
)));
assert(suite.non_scoring_question_goal_case_ids.length > 10);

assert.deepEqual(validatePatientConversationFixtureContract(suite.cases), []);
assert.doesNotThrow(() => assertPatientConversationFixtureReleaseReady(suite.cases));

const expectedFields = new Set();
const mustNotTokens = new Set();
const guidanceFixtures = [];
let exactEmptyServiceExpectationCount = 0;
for (const fixture of suite.cases) {
  const expected = fixture.expected || {};
  assert.equal(expected.question_goal, undefined, `${fixture.id} leaked non-scoring question_goal`);
  assert.equal(
    expected.specialist_summary_must_include,
    undefined,
    `${fixture.id} requests provider messaging outside PR #266`,
  );
  assert.notEqual(
    expected.next_action,
    'prepare_specialist_message',
    `${fixture.id} activates provider messaging outside PR #266`,
  );

  for (const field of Object.keys(expected)) expectedFields.add(field);
  for (const token of expected.must_not || []) mustNotTokens.add(token);
  if (Array.isArray(expected.must_include_guidance)) guidanceFixtures.push(fixture);
  if (Array.isArray(expected.service_keys_all) && expected.service_keys_all.length === 0) {
    exactEmptyServiceExpectationCount += 1;
  }
}

for (const field of expectedFields) {
  assert(
    PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS.includes(field),
    `Unscored expectation field remains in loaded suite: ${field}`,
  );
}
for (const token of mustNotTokens) {
  assert(
    PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS.includes(token),
    `Unsupported must_not token remains in loaded suite: ${token}`,
  );
  assert(
    evaluatorSource.includes(`${token}:`),
    `Evaluator has no rule for must_not token: ${token}`,
  );
}
assert(exactEmptyServiceExpectationCount >= 2);
assert(evaluatorSource.includes('Array.isArray(expected.service_keys_all)'));
assert(evaluatorSource.includes('actualServiceKeys.length === 0'));
assert(evaluatorSource.includes('forget_previous_need: forgotPreviousNeed(result)'));

for (const fixture of guidanceFixtures) {
  assert.equal(fixture.expected.next_action, 'show_emergency_guidance');
  for (const fragment of fixture.expected.must_include_guidance) {
    assert(
      emergencyGuidance.includes(String(fragment).toLocaleLowerCase('ro-RO')),
      `${fixture.id} requires stale emergency-guidance fragment: ${fragment}`,
    );
  }
}

const summaryFixture = suite.cases.find((fixture) => fixture.id === 'summary-001');
assert(summaryFixture);
assert.equal(summaryFixture.category, 'grounded_structured_facts');
assert.deepEqual(summaryFixture.expected.required_facts, {
  locality_city: 'Timisoara',
  duration: 'de cateva luni',
  symptom_pattern: 'vad mai prost cand citesc si ma doare capul',
  timing_preference: 'dupa ora 17',
});
assert(summaryFixture.expected.must_not.includes('invented_symptoms'));

const exactEmptyFixture = {
  id: 'audit-empty-services',
  category: 'fixture_audit',
  expected: {
    service_keys_all: [],
  },
};
const emptyServicePass = evaluatePatientConversationCase({
  fixture: exactEmptyFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      service_keys: [],
      facts: {},
    },
  },
});
assert.equal(emptyServicePass.passed, true);
const unexpectedServiceFailure = evaluatePatientConversationCase({
  fixture: exactEmptyFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      service_keys: ['ophthalmology_consultation'],
      facts: {},
    },
  },
});
assert.equal(unexpectedServiceFailure.passed, false);
assert(unexpectedServiceFailure.failed_check_ids.includes('service_keys_all'));

const memoryFixture = {
  id: 'audit-memory',
  category: 'fixture_audit',
  expected: {
    must_not: ['forget_previous_need'],
  },
};
const retainedNeed = evaluatePatientConversationCase({
  fixture: memoryFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'reparatii_ochelari',
      service_keys: ['hinge_repair'],
      facts: {},
    },
  },
});
assert.equal(retainedNeed.passed, true);
const forgottenNeed = evaluatePatientConversationCase({
  fixture: memoryFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'unknown',
      service_keys: [],
      facts: {},
    },
  },
});
assert.equal(forgottenNeed.passed, false);
assert(forgottenNeed.failed_check_ids.includes('must_not:forget_previous_need'));

console.log(`Patient conversation fixture audit verified ${suite.cases.length} scored cases, ${suite.replacement_case_ids.length} replacements, and ${suite.non_scoring_question_goal_case_ids.length} non-scoring question goals.`);
