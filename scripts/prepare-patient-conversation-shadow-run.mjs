import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CONTRACT_VERSION = 'viasee-patient-conversation-agent-v1';
const DEFAULT_FIXTURE_PATH = 'tests/fixtures/patient-conversation-agent-evaluations.json';
const DEFAULT_OUTPUT_PATH = 'tmp/patient-conversation-shadow-run.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const options = {
    fixturePath: DEFAULT_FIXTURE_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    caseIds: [],
    responseFiles: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fixtures') options.fixturePath = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else if (arg === '--case') options.caseIds.push(argv[++index]);
    else if (arg === '--response') options.responseFiles.push(argv[++index]);
    else throw new Error(`Argument necunoscut: ${arg}`);
  }
  return options;
}

function fixtureConversation(fixture) {
  if (Array.isArray(fixture?.conversation)) return fixture.conversation;
  if (Array.isArray(fixture?.messages)) return fixture.messages;
  return [];
}

function fixturePriorState(fixture) {
  return fixture?.prior_state && typeof fixture.prior_state === 'object'
    ? fixture.prior_state
    : null;
}

function fixtureRuntimeContext(fixture) {
  return fixture?.runtime_context && typeof fixture.runtime_context === 'object'
    ? fixture.runtime_context
    : {};
}

function responseEnvelope(payload) {
  if (payload?.envelope && typeof payload.envelope === 'object') return payload.envelope;
  if (payload?.response && typeof payload.response === 'object') return payload.response;
  if (payload?.result && typeof payload.result === 'object') return payload.result;
  return payload;
}

const options = parseArgs(process.argv.slice(2));
const fixturePayload = readJson(options.fixturePath);
const fixtures = Array.isArray(fixturePayload?.cases) ? fixturePayload.cases : [];

if (options.caseIds.length === 0) {
  console.error('Selecteaza explicit cel putin un caz cu --case <evaluation_case_id>.');
  process.exit(2);
}

const selectedCaseIds = [...new Set(options.caseIds)];
const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
const unknownCaseIds = selectedCaseIds.filter((caseId) => !fixtureById.has(caseId));
if (unknownCaseIds.length > 0) {
  console.error(`Cazuri inexistente: ${unknownCaseIds.join(', ')}`);
  process.exit(2);
}

const existing = fs.existsSync(options.outputPath)
  ? readJson(options.outputPath)
  : null;
const startedAt = existing?.model_run?.started_at || new Date().toISOString();
const outputs = existing?.outputs && typeof existing.outputs === 'object'
  ? { ...existing.outputs }
  : {};

for (const caseId of selectedCaseIds) {
  if (!outputs[caseId]) {
    outputs[caseId] = {
      status: 'pending',
      evaluation_case_id: caseId,
      interpretation: null,
    };
  }
}

for (const responseFile of options.responseFiles) {
  const responsePayload = readJson(responseFile);
  const envelope = responseEnvelope(responsePayload);
  const caseId = responsePayload?.evaluation_case_id
    || responsePayload?.case_id
    || envelope?.evaluation_case_id;
  if (!caseId || !fixtureById.has(caseId)) {
    throw new Error(`Raspunsul ${responseFile} nu contine un evaluation_case_id valid.`);
  }
  if (!selectedCaseIds.includes(caseId)) {
    throw new Error(`Raspunsul ${responseFile} apartine cazului neselectat ${caseId}.`);
  }
  outputs[caseId] = {
    ...envelope,
    evaluation_case_id: caseId,
    status: envelope?.status || 'completed',
  };
}

const pending = selectedCaseIds.filter((caseId) => outputs[caseId]?.status !== 'completed');
const completed = selectedCaseIds.filter((caseId) => outputs[caseId]?.status === 'completed').length;
const capture = {
  fixture_version: fixturePayload?.fixture_version || 'patient-conversation-agent-evaluations-v1',
  model_run: {
    started_at: startedAt,
    completed_at: pending.length === 0 ? new Date().toISOString() : '',
    model_context: 'Base44 Core.InvokeLLM',
    contract_version: CONTRACT_VERSION,
    selected_case_ids: selectedCaseIds,
  },
  outputs,
};
writeJson(options.outputPath, capture);

const requests = selectedCaseIds.map((caseId) => {
  const fixture = fixtureById.get(caseId);
  return {
    evaluation_case_id: caseId,
    request: {
      mode: 'patient_conversation_shadow',
      evaluation_case_id: caseId,
      conversation: fixtureConversation(fixture),
      prior_state: fixturePriorState(fixture),
      runtime_context: fixtureRuntimeContext(fixture),
    },
  };
});

console.log(JSON.stringify({
  fixture_version: capture.fixture_version,
  selected_cases: selectedCaseIds,
  completed_outputs: completed,
  pending_cases: pending,
  capture_file: options.outputPath,
  requests,
}, null, 2));
