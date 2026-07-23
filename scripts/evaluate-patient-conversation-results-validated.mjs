import process from 'node:process';
import {
  assertPatientConversationFixtureContract,
} from './patient-conversation-fixture-contract.mjs';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const fixtureArgument = process.argv[2] || 'default';
const fixtureSuite = loadPatientConversationFixtures(
  fixtureArgument === 'default' ? undefined : [fixtureArgument],
);
assertPatientConversationFixtureContract(fixtureSuite.cases);

await import('./evaluate-patient-conversation-results.mjs');
