import fs from 'node:fs';
import process from 'node:process';
import {
  assertPatientConversationFixtureContract,
  assertPatientConversationFixtureReleaseReady,
} from './patient-conversation-fixture-contract.mjs';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const fixtureArgument = process.argv[2] || 'default';
const fixtureSuite = loadPatientConversationFixtures(
  fixtureArgument === 'default' ? undefined : [fixtureArgument],
);
assertPatientConversationFixtureContract(fixtureSuite.cases);
assertPatientConversationFixtureReleaseReady(fixtureSuite.cases);

await import('./evaluate-patient-conversation-results.mjs');

const reportPath = process.argv[4] || 'tmp/patient-conversation-evaluation-report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const expectedAttemptCount = Object.values(
  report?.repeat_policy?.expected_attempts_by_case || {},
).reduce((sum, value) => sum + (Number(value) || 0), 0);
const measuredAttemptCount = Number(report?.runtime?.duration_ms?.measured_attempts) || 0;
const missingDurationCount = Number(report?.runtime?.duration_ms?.missing_attempts) || 0;
const durationEvidenceComplete = expectedAttemptCount > 0
  && measuredAttemptCount === expectedAttemptCount
  && missingDurationCount === 0;

if (!durationEvidenceComplete) {
  console.error(JSON.stringify({
    error: 'patient_conversation_runtime_duration_evidence_incomplete',
    expected_attempts: expectedAttemptCount,
    measured_attempts: measuredAttemptCount,
    missing_duration_attempts: missingDurationCount,
  }));
  process.exitCode = 1;
}
