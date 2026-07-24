import assert from 'node:assert/strict';
import {
  PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS,
  PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS,
  assertPatientConversationFixtureContract,
  assertPatientConversationFixtureReleaseReady,
  collectPatientConversationUnimplementedExpectations,
  validatePatientConversationFixtureContract,
} from './patient-conversation-fixture-contract.mjs';
import {
  DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS,
  isCriticalPatientConversationFixture,
  loadPatientConversationFixtures,
  patientConversationFixtureAttemptCount,
} from './patient-conversation-fixture-loader.mjs';

const fixtureSuite = loadPatientConversationFixtures();
assert.equal(fixtureSuite.cases.length, 71);
assert.equal(new Set(fixtureSuite.cases.map((fixture) => fixture.id)).size, 71);
assert.deepEqual(DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS, [
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
  'tests/fixtures/patient-conversation-agent-state-evaluations.json',
  'tests/fixtures/patient-conversation-agent-evaluation-overrides.json',
]);
assert.deepEqual(fixtureSuite.replacement_case_ids, [
  'vision-loss-003',
  'summary-001',
]);
assert(fixtureSuite.non_scoring_question_goal_case_ids.includes('vague-001'));
assert(fixtureSuite.non_scoring_question_goal_case_ids.includes('vision-loss-001'));
assert(fixtureSuite.non_scoring_question_goal_case_ids.length > 10);
assert(fixtureSuite.cases.every((fixture) => fixture?.expected?.question_goal === undefined));

assert.deepEqual(
  validatePatientConversationFixtureContract(fixtureSuite.cases),
  [],
  'Default patient conversation fixtures must use only scored, controlled expectations.',
);
assert.doesNotThrow(() => {
  assertPatientConversationFixtureContract(fixtureSuite.cases);
});
assert.deepEqual(PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS, []);
assert.deepEqual(
  collectPatientConversationUnimplementedExpectations(fixtureSuite.cases),
  [],
);
assert.doesNotThrow(() => {
  assertPatientConversationFixtureReleaseReady(fixtureSuite.cases);
});

const summaryFixture = fixtureSuite.cases.find((fixture) => fixture.id === 'summary-001');
assert(summaryFixture);
assert.equal(summaryFixture.category, 'grounded_structured_facts');
assert.equal(summaryFixture.expected.specialist_summary_must_include, undefined);
assert.deepEqual(summaryFixture.expected.required_facts, {
  locality_city: 'Timisoara',
  duration: 'de cateva luni',
  symptom_pattern: 'vad mai prost cand citesc si ma doare capul',
  timing_preference: 'dupa ora 17',
});
assert(summaryFixture.expected.must_not.includes('invented_symptoms'));
assert.equal(isCriticalPatientConversationFixture(summaryFixture), true);
assert.equal(
  patientConversationFixtureAttemptCount(summaryFixture, {
    defaultRepeat: 1,
    criticalRepeat: 3,
  }),
  3,
);

const confirmedVisionLossFixture = fixtureSuite.cases.find(
  (fixture) => fixture.id === 'vision-loss-003',
);
assert(confirmedVisionLossFixture);
assert.deepEqual(confirmedVisionLossFixture.expected.must_include_guidance, [
  'spital public',
  'upu',
  'nu conduce',
  '112',
]);

const usedExpectedFields = new Set(fixtureSuite.cases.flatMap((fixture) => (
  Object.keys(fixture.expected || {})
)));
for (const field of usedExpectedFields) {
  assert(
    PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS.includes(field),
    `Unsupported default expectation field: ${field}`,
  );
}

const validFixture = [{
  id: 'fixture-contract-valid-001',
  conversation: [{ role: 'user', content: 'vad mai slab de cateva luni' }],
  expected: {
    next_action: 'ask_locality',
    urgency: 'none',
    must_ask: true,
    required_facts: {
      duration: 'cateva luni',
    },
    must_not: [
      'mention_112',
      'generic_112_primary_action',
      'provider_recommendation',
      'contact_details_without_consent',
      'invented_symptoms',
      'forget_previous_need',
    ],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(validFixture), []);
assert.deepEqual(collectPatientConversationUnimplementedExpectations(validFixture), []);
assert.doesNotThrow(() => assertPatientConversationFixtureReleaseReady(validFixture));
assert.equal(isCriticalPatientConversationFixture(validFixture[0]), true);

const unsupportedSummaryFixture = [{
  id: 'fixture-contract-blocked-001',
  expected: {
    specialist_summary_must_include: ['simptom inventat'],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(unsupportedSummaryFixture), []);
assert.deepEqual(
  collectPatientConversationUnimplementedExpectations(unsupportedSummaryFixture),
  [{
    fixture_id: 'fixture-contract-blocked-001',
    field: 'expected.specialist_summary_must_include',
    code: 'fixture_unsupported_runtime_expectation',
    value: 'specialist_summary',
  }],
);
assert.throws(
  () => assertPatientConversationFixtureReleaseReady(unsupportedSummaryFixture),
  (error) => error?.code === 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED',
);

const unknownTokenFixture = [{
  id: 'fixture-contract-invalid-001',
  expected: {
    must_not: ['generic_112'],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(unknownTokenFixture), [{
  fixture_id: 'fixture-contract-invalid-001',
  field: 'expected.must_not',
  code: 'fixture_unknown_must_not_token',
  value: 'generic_112',
}]);

const unknownExpectationFixture = [{
  id: 'fixture-contract-invalid-002',
  expected: {
    unscored_claim: true,
  },
}];
assert(validatePatientConversationFixtureContract(unknownExpectationFixture).some(
  (item) => item.code === 'fixture_unknown_expectation_field',
));

const contradictoryQuestionFixture = [{
  id: 'fixture-contract-invalid-003',
  expected: {
    next_action: 'search_providers',
    must_ask: true,
  },
}];
assert(validatePatientConversationFixtureContract(contradictoryQuestionFixture).some(
  (item) => item.code === 'fixture_must_ask_action_contradiction',
));

const contradictoryUrgencyFixture = [{
  id: 'fixture-contract-invalid-004',
  expected: {
    next_action: 'search_providers',
    urgency: 'possible',
    must_ask: false,
  },
}];
assert(validatePatientConversationFixtureContract(contradictoryUrgencyFixture).some(
  (item) => item.code === 'fixture_possible_urgency_action_contradiction',
));

const ungroundedExpectedFactFixture = [{
  id: 'fixture-contract-invalid-005',
  conversation: [{ role: 'user', content: 'vad incetosat de o luna' }],
  expected: {
    required_facts: {
      symptom_pattern: 'vad dublu',
    },
  },
}];
assert(validatePatientConversationFixtureContract(ungroundedExpectedFactFixture).some(
  (item) => item.code === 'fixture_fact_expectation_not_user_grounded',
));

const unknownFactFixture = [{
  id: 'fixture-contract-invalid-006',
  expected: {
    required_facts: {
      diagnosis: 'conjunctivita',
    },
  },
}];
assert(validatePatientConversationFixtureContract(unknownFactFixture).some(
  (item) => item.code === 'fixture_unknown_fact_expectation_key',
));

assert.throws(
  () => assertPatientConversationFixtureContract(unknownTokenFixture),
  (error) => error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID',
);

console.log(`Patient conversation fixture contract verified across ${fixtureSuite.cases.length} aligned cases with ${fixtureSuite.replacement_case_ids.length} explicit replacements.`);
