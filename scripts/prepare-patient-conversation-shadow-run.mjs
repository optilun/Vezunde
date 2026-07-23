import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  isCriticalPatientConversationFixture,
  loadPatientConversationFixtures,
  normalizePatientConversationRepeatCount,
  patientConversationFixtureAttemptCount,
} from './patient-conversation-fixture-loader.mjs';

const CONTRACT_VERSION = 'viasee-patient-conversation-agent-v1';
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
    fixturePaths: [],
    outputPath: DEFAULT_OUTPUT_PATH,
    caseIds: [],
    responseFiles: [],
    defaultRepeat: 1,
    criticalRepeat: 3,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fixtures') options.fixturePaths.push(argv[++index]);
    else if (arg === '--output') options.outputPath = argv[++index];
    else if (arg === '--case') options.caseIds.push(argv[++index]);
    else if (arg === '--response') options.responseFiles.push(argv[++index]);
    else if (arg === '--repeat') options.defaultRepeat = normalizePatientConversationRepeatCount(argv[++index], 1);
    else if (arg === '--critical-repeat') options.criticalRepeat = normalizePatientConversationRepeatCount(argv[++index], 3);
    else throw new Error(`Argument necunoscut: ${arg}`);
  }
  options.criticalRepeat = Math.max(options.defaultRepeat, options.criticalRepeat);
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

function normalizeExistingCaseOutput(value, expectedAttempts, critical) {
  const attempts = value?.attempts && typeof value.attempts === 'object' && !Array.isArray(value.attempts)
    ? { ...value.attempts }
    : {};
  if (Object.keys(attempts).length === 0 && value && typeof value === 'object' && value.status) {
    attempts['1'] = {
      ...value,
      evaluation_attempt: 1,
    };
  }
  for (let attempt = 1; attempt <= expectedAttempts; attempt += 1) {
    if (!attempts[String(attempt)]) {
      attempts[String(attempt)] = {
        status: 'pending',
        evaluation_attempt: attempt,
        interpretation: null,
      };
    }
  }
  return {
    expected_attempts: expectedAttempts,
    critical,
    attempts,
  };
}

function normalizeAttempt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

const options = parseArgs(process.argv.slice(2));
const fixtureSuite = loadPatientConversationFixtures(
  options.fixturePaths.length > 0 ? options.fixturePaths : undefined,
);
const fixtures = fixtureSuite.cases;

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

const expectedAttemptCountByCase = new Map(selectedCaseIds.map((caseId) => {
  const fixture = fixtureById.get(caseId);
  return [caseId, patientConversationFixtureAttemptCount(fixture, {
    defaultRepeat: options.defaultRepeat,
    criticalRepeat: options.criticalRepeat,
  })];
}));

const existing = fs.existsSync(options.outputPath)
  ? readJson(options.outputPath)
  : null;
const startedAt = existing?.model_run?.started_at || new Date().toISOString();
const existingOutputs = existing?.outputs && typeof existing.outputs === 'object'
  ? existing.outputs
  : {};
const outputs = { ...existingOutputs };

for (const caseId of selectedCaseIds) {
  const fixture = fixtureById.get(caseId);
  outputs[caseId] = normalizeExistingCaseOutput(
    existingOutputs[caseId],
    expectedAttemptCountByCase.get(caseId),
    isCriticalPatientConversationFixture(fixture),
  );
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
  const expectedAttempts = expectedAttemptCountByCase.get(caseId);
  const explicitAttempt = normalizeAttempt(
    responsePayload?.evaluation_attempt
    || responsePayload?.attempt
    || envelope?.evaluation_attempt,
  );
  const attempt = explicitAttempt || (expectedAttempts === 1 ? 1 : null);
  if (!attempt) {
    throw new Error(`Raspunsul ${responseFile} necesita evaluation_attempt pentru cazul repetat ${caseId}.`);
  }
  if (attempt > expectedAttempts) {
    throw new Error(`Raspunsul ${responseFile} are attempt ${attempt}, peste limita ${expectedAttempts} pentru ${caseId}.`);
  }
  outputs[caseId].attempts[String(attempt)] = {
    ...envelope,
    evaluation_case_id: caseId,
    evaluation_attempt: attempt,
    status: envelope?.status || 'completed',
  };
}

const pendingAttempts = [];
let completedAttempts = 0;
for (const caseId of selectedCaseIds) {
  const expectedAttempts = expectedAttemptCountByCase.get(caseId);
  for (let attempt = 1; attempt <= expectedAttempts; attempt += 1) {
    if (outputs[caseId]?.attempts?.[String(attempt)]?.status === 'completed') {
      completedAttempts += 1;
    } else {
      pendingAttempts.push(`${caseId}#${attempt}`);
    }
  }
}

const singleFixtureVersion = fixtureSuite.fixture_versions.length === 1
  ? fixtureSuite.fixture_versions[0].fixture_version
  : null;
const capture = {
  fixture_version: singleFixtureVersion || 'patient-conversation-agent-evaluation-suite-v1',
  fixture_versions: fixtureSuite.fixture_versions,
  fixture_paths: fixtureSuite.fixture_paths,
  model_run: {
    started_at: startedAt,
    completed_at: pendingAttempts.length === 0 ? new Date().toISOString() : '',
    model_context: 'Base44 Core.InvokeLLM',
    contract_version: CONTRACT_VERSION,
    selected_case_ids: selectedCaseIds,
    default_repeat_count: options.defaultRepeat,
    critical_repeat_count: options.criticalRepeat,
    expected_attempts_by_case: Object.fromEntries(expectedAttemptCountByCase),
  },
  outputs,
};
writeJson(options.outputPath, capture);

const requests = selectedCaseIds.flatMap((caseId) => {
  const fixture = fixtureById.get(caseId);
  const expectedAttempts = expectedAttemptCountByCase.get(caseId);
  return Array.from({ length: expectedAttempts }, (_, index) => {
    const attempt = index + 1;
    return {
      evaluation_case_id: caseId,
      evaluation_attempt: attempt,
      request: {
        mode: 'patient_conversation_shadow',
        evaluation_case_id: caseId,
        evaluation_attempt: attempt,
        conversation: fixtureConversation(fixture),
        prior_state: fixturePriorState(fixture),
        runtime_context: fixtureRuntimeContext(fixture),
      },
    };
  });
});

console.log(JSON.stringify({
  fixture_version: capture.fixture_version,
  fixture_versions: capture.fixture_versions,
  selected_cases: selectedCaseIds,
  default_repeat_count: options.defaultRepeat,
  critical_repeat_count: options.criticalRepeat,
  completed_attempts: completedAttempts,
  pending_attempts: pendingAttempts,
  capture_file: options.outputPath,
  requests,
}, null, 2));
