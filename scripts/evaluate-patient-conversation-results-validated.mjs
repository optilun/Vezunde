import fs from 'node:fs';
import process from 'node:process';
import {
  assertPatientConversationFixtureContract,
  assertPatientConversationFixtureReleaseReady,
} from './patient-conversation-fixture-contract.mjs';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';
import {
  assessPatientConversationRuntimeEvidence,
} from './patient-conversation-runtime-evidence.mjs';

const fixtureArgument = process.argv[2] || 'default';
const fixtureSuite = loadPatientConversationFixtures(
  fixtureArgument === 'default' ? undefined : [fixtureArgument],
);
assertPatientConversationFixtureContract(fixtureSuite.cases);
assertPatientConversationFixtureReleaseReady(fixtureSuite.cases);

await import('./evaluate-patient-conversation-results.mjs');

const reportPath = process.argv[4] || 'tmp/patient-conversation-evaluation-report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const runtimeEvidence = assessPatientConversationRuntimeEvidence(report);

if (!runtimeEvidence.complete) {
  console.error(JSON.stringify({
    error: 'patient_conversation_runtime_duration_evidence_incomplete',
    ...runtimeEvidence,
  }));
  process.exitCode = 1;
}
