import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
  PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE,
  authorizePatientConversationSyntheticEvaluation,
  createPatientConversationEvaluationAuthorization,
} from '../shared/patientConversationEvaluationAuthorization.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationEvaluationAuthorization.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationEvaluationAuthorization.js', import.meta.url),
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
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_ENABLED'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_RUNTIME_CONTEXT'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_KEY_ID'));
assert(wrapperSource.includes('PATIENT_CONVERSATION_EVALUATION_SECRET'));
assert(wrapperSource.includes('authorizePatientConversationSyntheticEvaluation('));
assert(wrapperSource.includes('delete runtimePayload.evaluation_authorization;'));
assert(wrapperSource.includes('synthetic_evaluation: evaluationAuthorization.metadata'));
assert(!wrapperSource.includes('evaluationAuthorization.signature'));
assert(wrapperSource.includes('evaluationAuthorization.consumeModelCall();'));

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

function authorizationOptions(replayStore = new Map(), runUsageStore = new Map()) {
  return {
    enabled: true,
    runtimeContext: 'isolated_evaluation',
    keyId: 'evaluation-key-v1',
    secret,
    maxModelCallsPerRun: 3,
    nowMs,
    replayStore,
    runUsageStore,
  };
}

const acceptedPayload = await signedPayload();
const replayStore = new Map();
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
assert.equal(accepted.metadata.replay_protection_scope, 'process_instance');
assert.equal(accepted.metadata.model_calls_used_in_process, 0);
const acceptedConsumption = accepted.consumeModelCall();
assert.equal(acceptedConsumption.model_calls_used_in_process, 1);
assert.equal(accepted.metadata.model_calls_used_in_process, 1);
assert.throws(
  () => accepted.consumeModelCall(),
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

const runBudgetReplayStore = new Map();
const runBudgetUsageStore = new Map();
const runBudgetFirst = await signedPayload({}, {
  runId: 'run-budget-001',
  nonce: '62345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const runBudgetFirstResult = await authorizePatientConversationSyntheticEvaluation(
  runBudgetFirst,
  {
    ...authorizationOptions(runBudgetReplayStore, runBudgetUsageStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(runBudgetFirstResult.allowed, true);
assert.equal(runBudgetFirstResult.metadata.model_calls_used_in_process, 0);
runBudgetFirstResult.consumeModelCall();
assert.equal(runBudgetFirstResult.metadata.model_calls_used_in_process, 1);
const runBudgetSecond = await signedPayload({}, {
  runId: 'run-budget-001',
  nonce: '72345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const runBudgetSecondResult = await authorizePatientConversationSyntheticEvaluation(
  runBudgetSecond,
  {
    ...authorizationOptions(runBudgetReplayStore, runBudgetUsageStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(runBudgetSecondResult.allowed, false);
assert.equal(
  runBudgetSecondResult.reason,
  'patient_conversation_evaluation_run_budget_exceeded',
);

const noModelReplayStore = new Map();
const noModelUsageStore = new Map();
const noModelFirstPayload = await signedPayload({}, {
  runId: 'run-no-model-001',
  nonce: '82345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const noModelFirst = await authorizePatientConversationSyntheticEvaluation(
  noModelFirstPayload,
  {
    ...authorizationOptions(noModelReplayStore, noModelUsageStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(noModelFirst.allowed, true);
assert.equal(noModelFirst.metadata.model_calls_used_in_process, 0);
const noModelSecondPayload = await signedPayload({}, {
  runId: 'run-no-model-001',
  nonce: '92345678-1234-4234-9234-123456789abc',
  maxModelCalls: 1,
});
const noModelSecond = await authorizePatientConversationSyntheticEvaluation(
  noModelSecondPayload,
  {
    ...authorizationOptions(noModelReplayStore, noModelUsageStore),
    maxModelCallsPerRun: 1,
  },
);
assert.equal(noModelSecond.allowed, true);
assert.equal(noModelSecond.metadata.model_calls_used_in_process, 0);
noModelSecond.consumeModelCall();
assert.equal(noModelSecond.metadata.model_calls_used_in_process, 1);
assert.throws(
  () => noModelFirst.consumeModelCall(),
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
