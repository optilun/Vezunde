import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
  PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
  authorizePatientConversationSyntheticEvaluation,
  createPatientConversationEvaluationAuthorization,
} from '../shared/patientConversationEvaluationAuthorization.js';
import {
  createPatientConversationEvaluationRedisUsageStore,
} from '../shared/patientConversationEvaluationUsageStore.js';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationEvaluationAuthorization.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationEvaluationAuthorization.js', import.meta.url),
  'utf8',
);
const usageStoreSource = fs.readFileSync(
  new URL('../shared/patientConversationEvaluationUsageStore.js', import.meta.url),
  'utf8',
);
const base44UsageStoreSource = fs.readFileSync(
  new URL('../base44/shared/patientConversationEvaluationUsageStore.js', import.meta.url),
  'utf8',
);
const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
const runtimeSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowRuntime.ts', import.meta.url),
  'utf8',
);
const coreSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts', import.meta.url),
  'utf8',
);
const entrySource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
  'utf8',
);
const signerSource = fs.readFileSync(
  new URL('./sign-patient-conversation-evaluation-requests.mjs', import.meta.url),
  'utf8',
);

assert.equal(sharedSource, base44Source);
assert.equal(usageStoreSource, base44UsageStoreSource);
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_ENABLED'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_RUNTIME_CONTEXT'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_KEY_ID'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_SECRET'));
assert(wrapperSource.includes('UPSTASH_REDIS_REST_URL'));
assert(wrapperSource.includes('UPSTASH_REDIS_REST_TOKEN'));
assert(wrapperSource.includes('createPatientConversationEvaluationRedisUsageStore({'));
assert(wrapperSource.includes('authorizePatientConversationSyntheticEvaluation('));
assert(wrapperSource.includes('delete runtimePayload.evaluation_authorization;'));
assert(wrapperSource.includes('synthetic_evaluation: evaluationAuthorization.metadata'));
assert(!wrapperSource.includes('evaluationAuthorization.signature'));
assert(wrapperSource.includes('await evaluationAuthorization.consumeModelCall();'));
assert(usageStoreSource.includes("redis.call('SET'"));
assert(usageStoreSource.includes("'NX', 'EX'"));
assert(usageStoreSource.includes('"EVAL",'));
assert(usageStoreSource.includes("redis.call('HINCRBY'"));
assert(!usageStoreSource.includes('patient_text'));
assert(!usageStoreSource.includes('symptom_text'));
assert(!usageStoreSource.includes('semantic_output'));
assert(!usageStoreSource.includes('provider_results'));

const authorizationIndex = wrapperSource.indexOf(
  'await authorizePatientConversationSyntheticEvaluation(',
);
const guidedIndex = wrapperSource.indexOf('if (hasGuidedAnswers(runtimePayload))');
const runtimeIndex = wrapperSource.indexOf(
  'await runPatientConversationAgentShadowRuntime(',
);
assert(authorizationIndex >= 0);
assert(guidedIndex > authorizationIndex);
assert(runtimeIndex > authorizationIndex);

function sourceFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing ${name}.`);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  const nextExport = source.indexOf('\nexport ', start + 1);
  const candidates = [nextFunction, nextExport].filter((index) => index > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

for (const summarySource of [
  sourceFunction(runtimeSource, 'emitControlledPreflightSummary'),
  sourceFunction(coreSource, 'emitShadowSummary'),
]) {
  assert(!summarySource.includes('primary_intent:'));
  assert(!summarySource.includes('urgency_level:'));
  assert(!summarySource.includes('next_action:'));
  assert(!summarySource.includes('sufficient_for_search:'));
  assert(!summarySource.includes('model_urgency_advisory:'));
}
assert(entrySource.includes("error: 'Cererea nu a putut fi procesata.'"));
assert(entrySource.includes("'Cache-Control': 'no-store'"));
assert(!entrySource.includes("error?.message || 'Eroare neașteptată"));
assert(signerSource.includes('PATIENT_CONVERSATION_EVALUATION_SIGNING_SECRET'));
assert(signerSource.includes('loadPatientConversationFixtures()'));
assert(signerSource.includes('assert.deepEqual(item.request'));
assert(signerSource.includes('secret_in_output: false'));

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

const signerTempDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'viasee-evaluation-signer-'),
);
const signerManifestPath = path.join(signerTempDirectory, 'manifest.json');
const reducedBudgetOutputPath = path.join(signerTempDirectory, 'signed-reduced.json');
const excessiveBudgetOutputPath = path.join(signerTempDirectory, 'signed-excessive.json');
const signerFixtureSuite = loadPatientConversationFixtures();
const signerFixtures = signerFixtureSuite.cases.slice(0, 2);
assert.equal(signerFixtures.length, 2);
fs.writeFileSync(signerManifestPath, `${JSON.stringify({
  fixture_versions: signerFixtureSuite.fixture_versions,
  requests: signerFixtures.map((fixture) => ({
    evaluation_case_id: fixture.id,
    evaluation_attempt: 1,
    request: {
      mode: 'patient_conversation_shadow',
      evaluation_case_id: fixture.id,
      evaluation_attempt: 1,
      conversation: fixtureConversation(fixture),
      prior_state: fixturePriorState(fixture),
      runtime_context: fixtureRuntimeContext(fixture),
    },
  })),
}, null, 2)}\n`);

function runSigner(maxCalls, outputPath) {
  return spawnSync(process.execPath, [
    'scripts/sign-patient-conversation-evaluation-requests.mjs',
    '--input',
    signerManifestPath,
    '--output',
    outputPath,
    '--run-id',
    `signer-budget-${maxCalls}`,
    '--key-id',
    'evaluation-key-v1',
    '--max-calls',
    String(maxCalls),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATIENT_CONVERSATION_EVALUATION_SIGNING_SECRET:
        'abcdef0123456789abcdef0123456789',
    },
  });
}

const reducedBudgetSignerRun = runSigner(1, reducedBudgetOutputPath);
assert.equal(
  reducedBudgetSignerRun.status,
  0,
  reducedBudgetSignerRun.stderr || reducedBudgetSignerRun.stdout,
);
const reducedBudgetManifest = JSON.parse(
  fs.readFileSync(reducedBudgetOutputPath, 'utf8'),
);
assert.equal(reducedBudgetManifest.request_count, 2);
assert.equal(reducedBudgetManifest.max_model_calls, 1);
assert(reducedBudgetManifest.requests.every((item) => (
  item.request.evaluation_authorization.max_model_calls === 1
)));

const excessiveBudgetSignerRun = runSigner(3, excessiveBudgetOutputPath);
assert.notEqual(excessiveBudgetSignerRun.status, 0);
assert.match(
  `${excessiveBudgetSignerRun.stderr}\n${excessiveBudgetSignerRun.stdout}`,
  /cannot exceed the number of pending requests/,
);
assert.equal(fs.existsSync(excessiveBudgetOutputPath), false);
fs.rmSync(signerTempDirectory, { recursive: true, force: true });

const secret = '0123456789abcdef0123456789abcdef';
const nowMs = Date.parse('2026-07-28T08:00:00.000Z');
const basePayload = {
  mode: 'patient_conversation_shadow',
  evaluation_case_id: 'control-001',
  evaluation_attempt: 1,
  conversation: [{ role: 'user', content: 'Vreau un control de vedere in Timisoara.' }],
  runtime_context: { locale: 'ro-RO' },
  evaluation_fixture: {
    synthetic: true,
    source: PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
    fixture_fingerprint: 'a'.repeat(64),
  },
};

async function signedPayload(overrides = {}, claims = {}) {
  const payload = {
    ...basePayload,
    ...overrides,
  };
  payload.evaluation_authorization =
    await createPatientConversationEvaluationAuthorization({
      payload,
      secret,
      keyId: 'evaluation-key-v1',
      runId: claims.runId || 'run-control-001',
      nonce: claims.nonce || '12345678-1234-4234-9234-123456789abc',
      issuedAt: claims.issuedAt || '2026-07-28T07:55:00.000Z',
      expiresAt: claims.expiresAt || '2026-07-28T08:05:00.000Z',
      maxModelCalls: claims.maxModelCalls || 3,
    });
  return payload;
}

function createAtomicTestUsageStore({
  nonces = new Set(),
  runs = new Map(),
  unavailable = false,
} = {}) {
  return {
    scope: 'distributed_test_store',
    configured: true,
    async reserveNonce({ keyId, runId, nonce }) {
      if (unavailable) throw new Error('test store unavailable');
      const key = `${keyId}:${runId}:${nonce}`;
      if (nonces.has(key)) return { reserved: false };
      nonces.add(key);
      return { reserved: true };
    },
    async consumeModelCall({ keyId, runId, maxModelCalls }) {
      if (unavailable) throw new Error('test store unavailable');
      const key = `${keyId}:${runId}`;
      const current = runs.get(key) || {
        max_model_calls: maxModelCalls,
        model_calls_used: 0,
      };
      if (current.max_model_calls !== maxModelCalls) {
        const error = new Error('run limit mismatch');
        error.code = 'PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH';
        throw error;
      }
      if (current.model_calls_used >= maxModelCalls) {
        return {
          allowed: false,
          modelCallsUsed: current.model_calls_used,
          maxModelCalls: current.max_model_calls,
        };
      }
      const next = {
        ...current,
        model_calls_used: current.model_calls_used + 1,
      };
      runs.set(key, next);
      return {
        allowed: true,
        modelCallsUsed: next.model_calls_used,
        maxModelCalls: next.max_model_calls,
      };
    },
  };
}

function authorizationOptions(usageStore = createAtomicTestUsageStore()) {
  return {
    enabled: true,
    runtimeContext: 'isolated_evaluation',
    keyId: 'evaluation-key-v1',
    secret,
    maxModelCallsPerRun: 3,
    nowMs,
    usageStore,
  };
}

const redisCommands = [];
const redisNonceKeys = new Set();
const redisRunUsage = new Map();
async function redisFetch(url, init = {}) {
  assert.equal(url, 'https://viasee-evaluation-test.upstash.io');
  assert.equal(init?.method, 'POST');
  assert.equal(init?.headers?.Authorization, `Bearer ${'t'.repeat(32)}`);
  const command = JSON.parse(init?.body || '[]');
  redisCommands.push(command);
  let result;
  if (command[0] === 'EVAL' && command[2] === '2') {
    const nonceKey = command[3];
    const runKey = command[4];
    const requestedMax = Number(command[5]);
    const current = redisRunUsage.get(runKey) || {
      max_model_calls: requestedMax,
      model_calls_used: 0,
    };
    if (current.max_model_calls !== requestedMax) {
      result = [-1, current.model_calls_used, current.max_model_calls];
    } else if (redisNonceKeys.has(nonceKey)) {
      result = [0, current.model_calls_used, current.max_model_calls];
    } else {
      redisNonceKeys.add(nonceKey);
      redisRunUsage.set(runKey, current);
      result = [1, current.model_calls_used, current.max_model_calls];
    }
  } else if (command[0] === 'EVAL' && command[2] === '1') {
    const key = command[3];
    const requestedMax = Number(command[4]);
    const current = redisRunUsage.get(key) || {
      max_model_calls: requestedMax,
      model_calls_used: 0,
    };
    if (current.max_model_calls !== requestedMax) {
      result = [-1, current.model_calls_used, current.max_model_calls];
    } else if (current.model_calls_used >= requestedMax) {
      result = [0, current.model_calls_used, current.max_model_calls];
    } else {
      const next = {
        ...current,
        model_calls_used: current.model_calls_used + 1,
      };
      redisRunUsage.set(key, next);
      result = [1, next.model_calls_used, next.max_model_calls];
    }
  } else {
    throw new Error(`Unexpected Redis command ${String(command[0])}.`);
  }
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const redisUsageStore = createPatientConversationEvaluationRedisUsageStore({
  url: 'https://viasee-evaluation-test.upstash.io/',
  token: 't'.repeat(32),
  fetchImpl: redisFetch,
});
assert.equal(redisUsageStore.configured, true);
const redisNonceReservation = {
  keyId: 'evaluation-key-v1',
  runId: 'redis-run-001',
  nonce: 'redis-nonce-1234567890',
  maxModelCalls: 1,
  expiresAtMs: nowMs + 60_000,
  nowMs,
};
assert.equal(
  (await redisUsageStore.reserveNonce(redisNonceReservation)).reserved,
  true,
);
assert.equal(
  (await redisUsageStore.reserveNonce(redisNonceReservation)).reserved,
  false,
);
const redisConsumptionRequest = {
  keyId: 'evaluation-key-v1',
  runId: 'redis-run-001',
  maxModelCalls: 1,
  expiresAtMs: nowMs + 60_000,
  nowMs,
};
const redisConcurrentConsumption = await Promise.all([
  redisUsageStore.consumeModelCall(redisConsumptionRequest),
  redisUsageStore.consumeModelCall(redisConsumptionRequest),
]);
assert.deepEqual(
  redisConcurrentConsumption.map((item) => item.allowed).sort(),
  [false, true],
);
assert.equal(redisConcurrentConsumption[0].modelCallsUsed, 1);
assert.equal(redisConcurrentConsumption[1].modelCallsUsed, 1);
await assert.rejects(
  redisUsageStore.consumeModelCall({
    ...redisConsumptionRequest,
    maxModelCalls: 2,
  }),
  (error) => error?.code === 'PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH',
);
assert(redisCommands.some((command) => (
  command[0] === 'EVAL'
  && command[2] === '2'
  && command[1].includes("redis.call('SET'")
  && command[1].includes("'NX', 'EX'")
)));
assert(redisCommands.some((command) => (
  command[0] === 'EVAL'
  && command[1].includes("redis.call('HINCRBY'")
)));
assert(redisCommands.every((command) => (
  !JSON.stringify(command).includes(redisNonceReservation.nonce)
  && !JSON.stringify(command).includes(redisNonceReservation.runId)
)));
const redisCommandsBeforeTupleSeparation = redisCommands.length;
const ambiguousTupleFirst = {
  keyId: 'evaluation:key',
  runId: 'tuple-run',
  nonce: 'tuple-nonce-1234567890',
  maxModelCalls: 1,
  expiresAtMs: nowMs + 60_000,
  nowMs,
};
const ambiguousTupleSecond = {
  keyId: 'evaluation',
  runId: 'key:tuple-run',
  nonce: 'tuple-nonce-1234567890',
  maxModelCalls: 1,
  expiresAtMs: nowMs + 60_000,
  nowMs,
};
assert.equal(
  (await redisUsageStore.reserveNonce(ambiguousTupleFirst)).reserved,
  true,
);
assert.equal(
  (await redisUsageStore.reserveNonce(ambiguousTupleSecond)).reserved,
  true,
);
const tupleSeparationCommands = redisCommands.slice(redisCommandsBeforeTupleSeparation);
assert.equal(tupleSeparationCommands.length, 2);
assert.notEqual(tupleSeparationCommands[0][3], tupleSeparationCommands[1][3]);
assert.notEqual(tupleSeparationCommands[0][4], tupleSeparationCommands[1][4]);
const redisLimitMismatchPayload = await signedPayload({}, {
  runId: redisNonceReservation.runId,
  nonce: 'redis-limit-mismatch-1234567890',
  maxModelCalls: 2,
});
const redisLimitMismatch = await authorizePatientConversationSyntheticEvaluation(
  redisLimitMismatchPayload,
  {
    ...authorizationOptions(redisUsageStore),
    maxModelCallsPerRun: 3,
  },
);
assert.equal(redisLimitMismatch.allowed, false);
assert.equal(
  redisLimitMismatch.reason,
  'patient_conversation_evaluation_run_limit_mismatch',
);

const acceptedPayload = await signedPayload();
const replayStore = createAtomicTestUsageStore();
const accepted = await authorizePatientConversationSyntheticEvaluation(
  acceptedPayload,
  authorizationOptions(replayStore),
);
assert.equal(accepted.allowed, true);
assert.equal(
  accepted.metadata.authorization_version,
  PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
);
assert.equal(accepted.metadata.synthetic_fixture_verified, true);
assert.equal(accepted.metadata.replay_protection_scope, 'distributed_test_store');
assert.equal(accepted.metadata.model_calls_used_global, null);
const acceptedConsumption = await accepted.consumeModelCall();
assert.equal(acceptedConsumption.model_calls_used_global, 1);
assert.equal(accepted.metadata.model_calls_used_global, 1);
await assert.rejects(
  accepted.consumeModelCall(),
  (error) => error?.code === 'PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_CONSUMED',
);

const replayed = await authorizePatientConversationSyntheticEvaluation(
  acceptedPayload,
  authorizationOptions(replayStore),
);
assert.equal(replayed.allowed, false);
assert.equal(replayed.reason, 'patient_conversation_evaluation_replay_blocked');

const tamperedPayload = await signedPayload({}, {
  nonce: '22345678-1234-4234-9234-123456789abc',
});
tamperedPayload.conversation[0].content = 'Date reale schimbate dupa semnare.';
const tampered = await authorizePatientConversationSyntheticEvaluation(
  tamperedPayload,
  authorizationOptions(),
);
assert.equal(tampered.allowed, false);
assert.equal(tampered.reason, 'patient_conversation_evaluation_authorization_invalid');

const expiredPayload = await signedPayload({}, {
  nonce: '32345678-1234-4234-9234-123456789abc',
  issuedAt: '2026-07-28T07:30:00.000Z',
  expiresAt: '2026-07-28T07:45:00.000Z',
});
const expired = await authorizePatientConversationSyntheticEvaluation(
  expiredPayload,
  authorizationOptions(),
);
assert.equal(expired.allowed, false);
assert.equal(expired.reason, 'patient_conversation_evaluation_authorization_expired');

const disabled = await authorizePatientConversationSyntheticEvaluation(
  acceptedPayload,
  { ...authorizationOptions(), enabled: false },
);
assert.equal(disabled.allowed, false);
assert.equal(disabled.reason, 'patient_conversation_evaluation_disabled');

const wrongContext = await authorizePatientConversationSyntheticEvaluation(
  acceptedPayload,
  { ...authorizationOptions(), runtimeContext: 'production' },
);
assert.equal(wrongContext.allowed, false);
assert.equal(wrongContext.reason, 'patient_conversation_evaluation_context_invalid');

const missingUsageStore = await authorizePatientConversationSyntheticEvaluation(
  acceptedPayload,
  { ...authorizationOptions(), usageStore: null },
);
assert.equal(missingUsageStore.allowed, false);
assert.equal(
  missingUsageStore.reason,
  'patient_conversation_evaluation_misconfigured',
);

const unavailableUsagePayload = await signedPayload({}, {
  nonce: 'a2345678-1234-4234-9234-123456789abc',
});
const unavailableUsageStore = await authorizePatientConversationSyntheticEvaluation(
  unavailableUsagePayload,
  authorizationOptions(createAtomicTestUsageStore({ unavailable: true })),
);
assert.equal(unavailableUsageStore.allowed, false);
assert.equal(
  unavailableUsageStore.reason,
  'patient_conversation_evaluation_usage_store_unavailable',
);

const overBudgetPayload = await signedPayload({}, {
  nonce: '42345678-1234-4234-9234-123456789abc',
  maxModelCalls: 4,
});
const overBudget = await authorizePatientConversationSyntheticEvaluation(
  overBudgetPayload,
  authorizationOptions(),
);
assert.equal(overBudget.allowed, false);
assert.equal(overBudget.reason, 'patient_conversation_evaluation_authorization_invalid');

const runBudgetStore = createAtomicTestUsageStore();
const runBudgetFirst = await signedPayload({}, {
  runId: 'run-budget-001',
  nonce: '62345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const runBudgetFirstResult = await authorizePatientConversationSyntheticEvaluation(
  runBudgetFirst,
  {
    ...authorizationOptions(runBudgetStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(runBudgetFirstResult.allowed, true);
assert.equal(runBudgetFirstResult.metadata.model_calls_used_global, null);
await runBudgetFirstResult.consumeModelCall();
assert.equal(runBudgetFirstResult.metadata.model_calls_used_global, 1);
const runBudgetSecond = await signedPayload({}, {
  runId: 'run-budget-001',
  nonce: '72345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const runBudgetSecondResult = await authorizePatientConversationSyntheticEvaluation(
  runBudgetSecond,
  {
    ...authorizationOptions(runBudgetStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(runBudgetSecondResult.allowed, true);
assert.equal(runBudgetSecondResult.metadata.model_calls_used_global, null);
await assert.rejects(
  runBudgetSecondResult.consumeModelCall(),
  (error) => error?.code === 'PATIENT_CONVERSATION_EVALUATION_RUN_BUDGET_EXCEEDED',
);
const runBudgetSecondReplay = await authorizePatientConversationSyntheticEvaluation(
  runBudgetSecond,
  {
    ...authorizationOptions(runBudgetStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(runBudgetSecondReplay.allowed, false);
assert.equal(
  runBudgetSecondReplay.reason,
  'patient_conversation_evaluation_replay_blocked',
);

const noModelStore = createAtomicTestUsageStore();
const noModelFirstPayload = await signedPayload({}, {
  runId: 'run-no-model-001',
  nonce: '82345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const noModelFirst = await authorizePatientConversationSyntheticEvaluation(
  noModelFirstPayload,
  {
    ...authorizationOptions(noModelStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(noModelFirst.allowed, true);
assert.equal(noModelFirst.metadata.model_calls_used_global, null);
const noModelSecondPayload = await signedPayload({}, {
  runId: 'run-no-model-001',
  nonce: '92345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const noModelSecond = await authorizePatientConversationSyntheticEvaluation(
  noModelSecondPayload,
  {
    ...authorizationOptions(noModelStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(noModelSecond.allowed, true);
assert.equal(noModelSecond.metadata.model_calls_used_global, null);
await noModelSecond.consumeModelCall();
assert.equal(noModelSecond.metadata.model_calls_used_global, 1);
await assert.rejects(
  noModelFirst.consumeModelCall(),
  (error) => error?.code === 'PATIENT_CONVERSATION_EVALUATION_RUN_BUDGET_EXCEEDED',
);

const nonSyntheticPayload = await signedPayload({
  evaluation_fixture: {
    synthetic: false,
    source: PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
    fixture_fingerprint: 'a'.repeat(64),
  },
}, {
  nonce: '52345678-1234-4234-9234-123456789abc',
});
const nonSynthetic = await authorizePatientConversationSyntheticEvaluation(
  nonSyntheticPayload,
  authorizationOptions(),
);
assert.equal(nonSynthetic.allowed, false);
assert.equal(nonSynthetic.reason, 'patient_conversation_synthetic_fixture_required');

console.log('Synthetic evaluation authorization, expiry, budget, tamper and replay gates verified.');
