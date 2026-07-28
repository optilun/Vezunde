import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  loadPatientConversationFixtures,
  patientConversationFixtureAttemptCount,
} from './patient-conversation-fixture-loader.mjs';

const CONTRACT_VERSION = 'viasee-patient-conversation-agent-v1';
const DEFAULT_OUTPUT_PATH = 'tmp/patient-conversation-shadow-run.json';
const EXPECTED_DEFAULT_CASE_COUNT = 71;
const MINIMUM_CRITICAL_REPEAT_COUNT = 3;
const MAXIMUM_REPEAT_COUNT = 5;
const CAPTURED_STATUSES = new Set(['completed', 'invalid', 'unavailable', 'skipped']);

function requiredArgument(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || String(value).startsWith('--')) {
    throw new Error(`${flag} necesita o valoare.`);
  }
  return value;
}

function repeatCount(value, flag, minimum = 1) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${flag} necesita un numar intreg.`);
  }
  const parsed = Number.parseInt(text, 10);
  if (parsed < minimum || parsed > MAXIMUM_REPEAT_COUNT) {
    throw new Error(`${flag} trebuie sa fie intre ${minimum} si ${MAXIMUM_REPEAT_COUNT}.`);
  }
  return parsed;
}

function parseArguments(argv) {
  const options = {
    fixturePaths: [],
    outputPath: DEFAULT_OUTPUT_PATH,
    responseFiles: [],
    defaultRepeat: 1,
    criticalRepeat: MINIMUM_CRITICAL_REPEAT_COUNT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case') {
      throw new Error('Comanda full-suite nu accepta --case; selecteaza automat toate cazurile.');
    }
    if (arg === '--fixtures') {
      options.fixturePaths.push(requiredArgument(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = requiredArgument(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--response') {
      options.responseFiles.push(requiredArgument(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--repeat') {
      options.defaultRepeat = repeatCount(requiredArgument(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === '--critical-repeat') {
      options.criticalRepeat = repeatCount(
        requiredArgument(argv, index, arg),
        arg,
        MINIMUM_CRITICAL_REPEAT_COUNT,
      );
      index += 1;
      continue;
    }
    throw new Error(`Argument necunoscut: ${arg}`);
  }
  options.criticalRepeat = Math.max(options.defaultRepeat, options.criticalRepeat);
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function responseEnvelope(payload) {
  if (isPlainObject(payload?.envelope)) return payload.envelope;
  if (isPlainObject(payload?.response)) return payload.response;
  if (isPlainObject(payload?.result)) return payload.result;
  return payload;
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizedAttempt(value) {
  const text = clean(value);
  if (!/^[1-5]$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

function fixtureFingerprint(suite) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      fixture_versions: suite.fixture_versions,
      cases: suite.cases,
    }))
    .digest('hex');
}

function expectedAttemptsByCase(suite, options) {
  return Object.fromEntries(suite.cases.map((fixture) => [
    fixture.id,
    patientConversationFixtureAttemptCount(fixture, {
      defaultRepeat: options.defaultRepeat,
      criticalRepeat: options.criticalRepeat,
    }),
  ]));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertExistingCaptureIdentity(existing, identity) {
  if (!existing) return;
  const mismatches = [];
  if (!sameJson(existing.fixture_paths, identity.fixture_paths)) mismatches.push('fixture_paths');
  if (!sameJson(existing.fixture_versions, identity.fixture_versions)) mismatches.push('fixture_versions');
  if (existing?.model_run?.fixture_fingerprint !== identity.fixture_fingerprint) {
    mismatches.push('fixture_fingerprint');
  }
  if (existing?.model_run?.contract_version !== CONTRACT_VERSION) mismatches.push('contract_version');
  if (!sameJson(existing?.model_run?.selected_case_ids, identity.selected_case_ids)) {
    mismatches.push('selected_case_ids');
  }
  if (existing?.model_run?.default_repeat_count !== identity.default_repeat_count) {
    mismatches.push('default_repeat_count');
  }
  if (existing?.model_run?.critical_repeat_count !== identity.critical_repeat_count) {
    mismatches.push('critical_repeat_count');
  }
  if (!sameJson(existing?.model_run?.expected_attempts_by_case, identity.expected_attempts_by_case)) {
    mismatches.push('expected_attempts_by_case');
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Captura existenta nu corespunde suitei curente (${mismatches.join(', ')}). Foloseste un fisier de output nou.`,
    );
  }
}

function assertResponseCorrelation(responseFile, selectedCaseIds, attemptsByCase) {
  const payload = readJson(responseFile);
  const envelope = responseEnvelope(payload);
  if (!isPlainObject(envelope)) {
    throw new Error(`Raspunsul ${responseFile} nu contine un envelope obiect.`);
  }
  if (clean(envelope.mode) !== 'shadow') {
    throw new Error(`Raspunsul ${responseFile} nu provine din mode=shadow.`);
  }
  if (clean(envelope.contract_version) !== CONTRACT_VERSION) {
    throw new Error(`Raspunsul ${responseFile} are contract_version invalid.`);
  }

  const envelopeCaseId = clean(envelope.evaluation_case_id);
  if (!envelopeCaseId) {
    throw new Error(`Raspunsul ${responseFile} nu pastreaza evaluation_case_id in envelope.`);
  }
  const caseValues = [
    payload?.evaluation_case_id,
    payload?.case_id,
    envelopeCaseId,
  ].map(clean).filter(Boolean);
  const uniqueCaseValues = [...new Set(caseValues)];
  if (uniqueCaseValues.length !== 1) {
    throw new Error(
      `Raspunsul ${responseFile} are corelatie de caz contradictorie: ${uniqueCaseValues.join(', ')}.`,
    );
  }
  const caseId = uniqueCaseValues[0];
  if (!selectedCaseIds.includes(caseId)) {
    throw new Error(`Raspunsul ${responseFile} apartine cazului neselectat ${caseId}.`);
  }

  const envelopeAttempt = normalizedAttempt(envelope.evaluation_attempt);
  if (!envelopeAttempt) {
    throw new Error(`Raspunsul ${responseFile} nu pastreaza evaluation_attempt valid in envelope.`);
  }
  const rawAttempts = [
    payload?.evaluation_attempt,
    payload?.attempt,
    envelopeAttempt,
  ].filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
  const attempts = rawAttempts.map(normalizedAttempt);
  if (attempts.some((attempt) => attempt === null)) {
    throw new Error(`Raspunsul ${responseFile} contine un evaluation_attempt invalid.`);
  }
  const uniqueAttempts = [...new Set(attempts)];
  const expectedAttempts = attemptsByCase[caseId];
  if (uniqueAttempts.length !== 1) {
    throw new Error(`Raspunsul ${responseFile} are attempturi contradictorii: ${uniqueAttempts.join(', ')}.`);
  }
  const attempt = uniqueAttempts[0];
  if (attempt > expectedAttempts) {
    throw new Error(
      `Raspunsul ${responseFile} are attempt ${attempt}, peste limita ${expectedAttempts} pentru ${caseId}.`,
    );
  }

  const status = clean(envelope.status);
  if (!CAPTURED_STATUSES.has(status)) {
    throw new Error(
      `Raspunsul ${responseFile} necesita status explicit completed, invalid, unavailable sau skipped.`,
    );
  }
  const durationMs = Number(envelope?.runtime_metadata?.duration_ms);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(`Raspunsul ${responseFile} nu pastreaza runtime_metadata.duration_ms valid.`);
  }
}

const forwardedArguments = process.argv.slice(2);
const options = parseArguments(forwardedArguments);
const suite = loadPatientConversationFixtures(
  options.fixturePaths.length > 0 ? options.fixturePaths : undefined,
);
if (options.fixturePaths.length === 0 && suite.cases.length !== EXPECTED_DEFAULT_CASE_COUNT) {
  throw new Error(
    `Suita implicita trebuie sa contina exact ${EXPECTED_DEFAULT_CASE_COUNT} cazuri; actual=${suite.cases.length}.`,
  );
}

const selectedCaseIds = suite.cases.map((fixture) => fixture.id);
const attemptsByCase = expectedAttemptsByCase(suite, options);
const identity = {
  fixture_paths: suite.fixture_paths,
  fixture_versions: suite.fixture_versions,
  fixture_fingerprint: fixtureFingerprint(suite),
  selected_case_ids: selectedCaseIds,
  default_repeat_count: options.defaultRepeat,
  critical_repeat_count: options.criticalRepeat,
  expected_attempts_by_case: attemptsByCase,
};

const existingCapture = fs.existsSync(options.outputPath)
  ? readJson(options.outputPath)
  : null;
assertExistingCaptureIdentity(existingCapture, identity);
for (const responseFile of options.responseFiles) {
  assertResponseCorrelation(responseFile, selectedCaseIds, attemptsByCase);
}

const caseArguments = selectedCaseIds.flatMap((caseId) => ['--case', caseId]);
const result = spawnSync(process.execPath, [
  'scripts/prepare-patient-conversation-shadow-run.mjs',
  ...forwardedArguments,
  ...caseArguments,
], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

if (result.status === 0 && fs.existsSync(options.outputPath)) {
  const capture = readJson(options.outputPath);
  capture.model_run = {
    ...(isPlainObject(capture.model_run) ? capture.model_run : {}),
    fixture_fingerprint: identity.fixture_fingerprint,
  };
  writeJson(options.outputPath, capture);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
