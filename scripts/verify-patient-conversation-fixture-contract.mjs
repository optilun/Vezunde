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
assert(summaryFixture.expected.must_not.includes('invented_symptoms'));
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
      'invented_symptoms',
    ],
  },
}];
assert.deepEqual(validatePatientConversationFixtureContract(validFixture), []);
assert.deepEqual(collectPatientConversationUnimplementedExpectations(validFixture), []);
assert.doesNotThrow(() => assertPatientConversationFixtureReleaseReady(validFixture));
assert.equal(isCriticalPatientConversationFixture(validFixture[0]), true);

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

const unsupportedUnimplementedFixture = [{
  id: 'fixture-contract-invalid-004',
  expected: {
    unimplemented_checks: ['invented_symptoms'],
  },
}];
assert.throws(
  () => assertPatientConversationFixtureContract(unsupportedUnimplementedFixture),
  (error) => (
    error?.code === 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID'
    && error?.violations?.[0]?.code === 'fixture_unknown_unimplemented_check_token'
  ),
);

console.log(`Patient conversation fixture contract verified across ${fixtureSuite.cases.length} default cases with active grounding checks.`);
