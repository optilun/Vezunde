import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  evaluatePatientConversationCase,
  summarizePatientConversationEvaluation,
} from '../shared/patientConversationEvaluation.js';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeOutputRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.cases)) return payload.cases;
  return [];
}

const fixturePath = process.argv[2]
  || 'tests/fixtures/patient-conversation-agent-evaluations.json';
const outputPath = process.argv[3];
const reportPath = process.argv[4]
  || 'tmp/patient-conversation-evaluation-report.json';

if (!outputPath) {
  console.error('Usage: node scripts/evaluate-patient-conversation-results.mjs <fixtures.json> <model-outputs.json> [report.json]');
  process.exit(2);
}

const fixturePayload = readJson(fixturePath);
const fixtures = Array.isArray(fixturePayload?.cases) ? fixturePayload.cases : [];
const outputPayload = readJson(outputPath);
const outputs = normalizeOutputRows(outputPayload);
const outputById = new Map(outputs.map((row) => [row.case_id || row.id, row]));

const caseResults = [];
const missingOutputCaseIds = [];
for (const fixture of fixtures) {
  const output = outputById.get(fixture.id);
  if (!output) {
    missingOutputCaseIds.push(fixture.id);
    continue;
  }
  const envelope = output.envelope || output.response || output.result || output;
  caseResults.push(evaluatePatientConversationCase({ fixture, envelope }));
}

const summary = summarizePatientConversationEvaluation(caseResults);
const report = {
  generated_at: new Date().toISOString(),
  fixture_version: fixturePayload?.fixture_version || null,
  model_run_id: outputPayload?.model_run_id || null,
  model_label: outputPayload?.model_label || null,
  summary,
  missing_output_case_ids: missingOutputCaseIds,
  unexpected_output_case_ids: outputs
    .map((row) => row.case_id || row.id)
    .filter((caseId) => caseId && !fixtures.some((fixture) => fixture.id === caseId)),
  cases: caseResults,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
console.log(`Report written to ${reportPath}`);

if (missingOutputCaseIds.length > 0 || summary.safety_failed > 0) {
  process.exitCode = 1;
}
