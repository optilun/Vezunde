import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
  createPatientConversationEvaluationAuthorization,
} from '../shared/patientConversationEvaluationAuthorization.js';

const MAX_AUTHORIZATION_LIFETIME_SECONDS = 15 * 60;

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || String(value).startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }
  return number;
}

function parseArguments(argv) {
  const options = {
    input: '',
    output: '',
    runId: '',
    keyId: process.env.PATIENT_CONVERSATION_EVALUATION_KEY_ID || '',
    secretEnv: 'PATIENT_CONVERSATION_EVALUATION_SIGNING_SECRET',
    expiresInSeconds: 10 * 60,
    maxCalls: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = requiredValue(argv, index++, arg);
    else if (arg === '--output') options.output = requiredValue(argv, index++, arg);
    else if (arg === '--run-id') options.runId = requiredValue(argv, index++, arg);
    else if (arg === '--key-id') options.keyId = requiredValue(argv, index++, arg);
    else if (arg === '--secret-env') options.secretEnv = requiredValue(argv, index++, arg);
    else if (arg === '--expires-in-seconds') {
      options.expiresInSeconds = positiveInteger(requiredValue(argv, index++, arg), arg);
    } else if (arg === '--max-calls') {
      options.maxCalls = positiveInteger(requiredValue(argv, index++, arg), arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.input || !options.output || !options.runId || !options.keyId) {
    throw new Error('--input, --output, --run-id and --key-id are required.');
  }
  if (options.expiresInSeconds > MAX_AUTHORIZATION_LIFETIME_SECONDS) {
    throw new Error(`--expires-in-seconds cannot exceed ${MAX_AUTHORIZATION_LIFETIME_SECONDS}.`);
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixtureFingerprint(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify({
    fixture_version: manifest?.fixture_version || null,
    fixture_versions: manifest?.fixture_versions || [],
    selected_cases: manifest?.selected_cases || [],
    pending_attempts: manifest?.pending_attempts || [],
  })).digest('hex');
}

function validIdentifier(value, maxLength) {
  const text = String(value ?? '').trim().slice(0, maxLength);
  return /^[a-z0-9][a-z0-9._:-]*$/i.test(text) ? text : '';
}

const options = parseArguments(process.argv.slice(2));
if (fs.existsSync(options.output)) {
  throw new Error('Output file already exists. Use a new path for each authorized run.');
}
const secret = String(process.env[options.secretEnv] || '');
if (secret.length < 32) {
  throw new Error(`Environment variable ${options.secretEnv} must contain at least 32 characters.`);
}
if (!validIdentifier(options.runId, 120) || !validIdentifier(options.keyId, 80)) {
  throw new Error('Run id or key id is invalid.');
}

const manifest = readJson(options.input);
const requests = Array.isArray(manifest?.requests) ? manifest.requests : [];
if (requests.length === 0) throw new Error('Input manifest contains no pending requests.');
const maxCalls = options.maxCalls ?? requests.length;
if (maxCalls !== requests.length) {
  throw new Error('--max-calls must equal the exact number of pending requests.');
}

const fingerprint = fixtureFingerprint(manifest);
const issuedAt = new Date();
const expiresAt = new Date(issuedAt.getTime() + options.expiresInSeconds * 1000);
const signedRequests = [];
for (const item of requests) {
  const caseId = validIdentifier(item?.evaluation_case_id, 120);
  const attempt = positiveInteger(item?.evaluation_attempt, 'evaluation_attempt');
  if (!caseId || attempt > 5 || item?.request?.evaluation_case_id !== caseId) {
    throw new Error('Input manifest contains an invalid fixture request.');
  }
  const request = {
    ...(item.request || {}),
    evaluation_fixture: {
      synthetic: true,
      source: PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
      fixture_fingerprint: fingerprint,
    },
  };
  request.evaluation_authorization =
    await createPatientConversationEvaluationAuthorization({
      payload: request,
      secret,
      keyId: options.keyId,
      runId: options.runId,
      nonce: crypto.randomUUID(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      maxModelCalls: maxCalls,
    });
  signedRequests.push({
    evaluation_case_id: caseId,
    evaluation_attempt: attempt,
    request,
  });
}

const output = {
  authorization_version:
    signedRequests[0].request.evaluation_authorization.version,
  generated_at: issuedAt.toISOString(),
  expires_at: expiresAt.toISOString(),
  run_id: options.runId,
  key_id: options.keyId,
  max_model_calls: maxCalls,
  fixture_fingerprint: fingerprint,
  request_count: signedRequests.length,
  requests: signedRequests,
};
fs.mkdirSync(path.dirname(options.output), { recursive: true });
fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx',
});
console.log(JSON.stringify({
  output: options.output,
  run_id: options.runId,
  request_count: signedRequests.length,
  expires_at: expiresAt.toISOString(),
  secret_in_output: false,
}, null, 2));
