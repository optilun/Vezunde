import assert from 'node:assert/strict';
import {
  PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS,
  assertPatientConversationFixtureContract,
  assertPatientConversationFixtureReleaseReady,
  collectPatientConversationUnimplementedExpectations,
  validatePatientConversationFixtureContract,
} from './patient-conversation-fixture-contract.mjs';
import {
  isCriticalPatientConversationFixture,
  loadPatientConversationFixtures,
  patientConversationFixtureAttemptCount,
} from './patient-conversation-fixture-loader.mjs';

const fixtureSuite = loadPatientConversationFixtures();
assert.deepEqual(
  validatePatientConversationFixtureContract(fixtureSuite.cases),
  [],
  'Default patient conversation fixtures must use only controlled expectation tokens.',
);
assert.doesNotThrow(() => {
  assertPatientConversationFixtureContract(fixtureSuite.cases);
});
assert.deepEqual(
  PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS,
  ['invented_symptoms'],
);
const defaultReleaseBlockers = collectPatientConversationUnimplementedExpectations(
  fixtureSuite.cases,
);
assert(defaultReleaseBlockers.some((blocker) => (
  blocker.fixture_id === 'summary-001'
  && blocker.value === 'invented_symptoms'
)));
assert.throws(
  () => assertPatientConversationFixtureReleaseReady(fixtureSuite.cases),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED'
    && error?.blockers?.some((blocker) => (
      blocker.fixture_id === 'summary-001'
      && blocker.value === 'invented_symptoms'
    ))
  ),
);
const summaryFixture = fixtureSuite.cases.find((fixture) => fixture.id === 'summary-001');
assert(summaryFixture);
assert.equal(isCriticalPatientConversationFixture(summaryFixture), true);
assert.equal(
  patientConversationFixtureAttemptCount(summaryFixture, {
    defaultRepeat: 1,
    criticalRepeat: 3,
  }),
  3,
);

const validFixture = [{
  id: 'fixture-contract-valid-001',
  expected: {
    must_not: [
      'search_providers',
      'mention_112',
      'generic_112_primary_action',
      'provider_recommendation',
      'contact_details_without_consent',
    ],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(validFixture), []);
assert.deepEqual(collectPatientConversationUnimplementedExpectations(validFixture), []);
assert.doesNotThrow(() => assertPatientConversationFixtureReleaseReady(validFixture));

const unimplementedMustNotFixture = [{
  id: 'fixture-contract-blocked-001',
  expected: {
    must_not: ['invented_symptoms'],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(unimplementedMustNotFixture), []);
assert.deepEqual(
  collectPatientConversationUnimplementedExpectations(unimplementedMustNotFixture),
  [{
    fixture_id: 'fixture-contract-blocked-001',
    field: 'expected.must_not',
    code: 'fixture_unimplemented_expectation',
    value: 'invented_symptoms',
  }],
);
assert.equal(isCriticalPatientConversationFixture(unimplementedMustNotFixture[0]), true);
assert.throws(
  () => assertPatientConversationFixtureReleaseReady(unimplementedMustNotFixture),
  (error) => error?.code === 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED',
);

const explicitUnimplementedFixture = [{
  id: 'fixture-contract-blocked-002',
  expected: {
    unimplemented_checks: ['invented_symptoms'],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(explicitUnimplementedFixture), []);
assert.equal(isCriticalPatientConversationFixture(explicitUnimplementedFixture[0]), true);
assert.throws(
  () => assertPatientConversationFixtureReleaseReady(explicitUnimplementedFixture),
  (error) => error?.code === 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED',
);

const unknownTokenFixture = [{
  id: 'fixture-contract-invalid-001',
  expected: {
    must_not: ['generic_112'],
  },
}];
const unknownTokenViolations = validatePatientConversationFixtureContract(
  unknownTokenFixture,
);
assert.equal(unknownTokenViolations.length, 1);
assert.deepEqual(unknownTokenViolations[0], {
  fixture_id: 'fixture-contract-invalid-001',
  field: 'expected.must_not',
  code: 'fixture_unknown_must_not_token',
  value: 'generic_112',
});
assert.throws(
  () => assertPatientConversationFixtureContract(unknownTokenFixture),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID'
    && error?.violations?.[0]?.code === 'fixture_unknown_must_not_token'
  ),
);

const malformedMustNotFixture = [{
  id: 'fixture-contract-invalid-002',
  expected: {
    must_not: 'search_providers',
  },
}];
assert.throws(
  () => assertPatientConversationFixtureContract(malformedMustNotFixture),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID'
    && error?.violations?.[0]?.code === 'fixture_must_not_array_required'
  ),
);

const missingExpectedFixture = [{
  id: 'fixture-contract-invalid-003',
}];
assert.throws(
  () => assertPatientConversationFixtureContract(missingExpectedFixture),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID'
    && error?.violations?.[0]?.code === 'fixture_expected_required'
  ),
);

const unknownUnimplementedFixture = [{
  id: 'fixture-contract-invalid-004',
  expected: {
    unimplemented_checks: ['unknown_grounding_check'],
  },
}];
assert.throws(
  () => assertPatientConversationFixtureContract(unknownUnimplementedFixture),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID'
    && error?.violations?.[0]?.code === 'fixture_unknown_unimplemented_check_token'
  ),
);

console.log(`Patient conversation fixture contract verified across ${fixtureSuite.cases.length} default cases with explicit release blockers.`);
