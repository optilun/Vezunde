import assert from 'node:assert/strict';
import {
  assertPatientConversationFixtureContract,
  validatePatientConversationFixtureContract,
} from './patient-conversation-fixture-contract.mjs';
import {
  loadPatientConversationFixtures,
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

console.log(`Patient conversation fixture contract verified across ${fixtureSuite.cases.length} default cases.`);
