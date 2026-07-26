import assert from 'node:assert/strict';
import fs from 'node:fs';

const entrySource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
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
const sharedGuardrailSource = fs.readFileSync(
  new URL('../shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
const base44GuardrailSource = fs.readFileSync(
  new URL('../base44/shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
const sharedOperationalSource = fs.readFileSync(
  new URL('../shared/patientConversationOperationalPolicy.js', import.meta.url),
  'utf8',
);
const base44OperationalSource = fs.readFileSync(
  new URL('../base44/shared/patientConversationOperationalPolicy.js', import.meta.url),
  'utf8',
);

assert.equal(sharedGuardrailSource, base44GuardrailSource);
assert.equal(sharedOperationalSource, base44OperationalSource);

assert(entrySource.includes("const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';"));
assert(entrySource.includes('const user = await base44.auth.me().catch(() => null);'));
assert(entrySource.includes("if (user.role !== 'admin')"));
assert(entrySource.includes('return await handlePatientConversationShadowMode(base44, payload);'));

const modeBranchIndex = entrySource.indexOf('payload.mode === PATIENT_CONVERSATION_SHADOW_MODE');
const serviceRoleIndex = entrySource.indexOf('const svc = base44.asServiceRole;');
assert(modeBranchIndex >= 0 && serviceRoleIndex > modeBranchIndex);
const shadowRouteBlock = entrySource.slice(modeBranchIndex, serviceRoleIndex);
assert(!shadowRouteBlock.includes('assignRecommendationBuckets'));
assert(!shadowRouteBlock.includes('buildRecommendationScore'));
assert(!shadowRouteBlock.includes('resolveServiceSearchQuery'));

assert(wrapperSource.includes("const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';"));
assert(wrapperSource.includes("const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';"));
assert(wrapperSource.includes("from './patientConversationAgentShadowRuntime.ts';"));
assert(wrapperSource.includes('function createAutomaticModelBase44('));
assert(wrapperSource.includes('delete automaticArgs.model;'));
assert(wrapperSource.includes('explicit_model_override: false'));
assert(wrapperSource.includes('automatic_retry_enabled: false'));
assert(!wrapperSource.includes('PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET'));
assert(!wrapperSource.includes('monthly_model_call_target'));
assert(wrapperSource.includes('function hasGuidedAnswers('));
assert(wrapperSource.includes("reason: 'guided_answer_does_not_require_model'"));
assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes('retry_attempted: false'));
assert(wrapperSource.includes('search_blocked: true'));

const guidedGateIndex = wrapperSource.indexOf('if (hasGuidedAnswers(payload))');
const runtimeCallIndex = wrapperSource.indexOf('await runPatientConversationAgentShadowRuntime(');
assert(guidedGateIndex >= 0 && runtimeCallIndex > guidedGateIndex);
assert.equal((wrapperSource.match(/runPatientConversationAgentShadowRuntime\(/g) || []).length, 1);
assert.equal((wrapperSource.match(/InvokeLLM/g) || []).length, 3);
assert(!wrapperSource.includes("model: 'gpt_5_4'"));
assert(!wrapperSource.includes('assignRecommendationBuckets'));
assert(!wrapperSource.includes('buildRecommendationScore'));
assert(!wrapperSource.includes('asServiceRole'));

assert(runtimeSource.includes("const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';"));
assert(runtimeSource.includes('createPatientConversationOperationalController('));
assert(runtimeSource.includes("audience: 'admin_shadow'"));
assert(runtimeSource.includes('controller.invoke(() =>'));
assert(runtimeSource.includes('delete automaticArgs.model;'));
assert(runtimeSource.includes('finalizePatientConversationOperationalEnvelope('));
assert(runtimeSource.includes('semanticPayloadWithoutControlledAnswers(runtimePayload)'));
assert(runtimeSource.includes('sanitizeGuidedSafetyAnswers(runtimePayload?.answers)'));
assert(!runtimeSource.includes("'gpt_5_4'"));
assert(!runtimeSource.includes('PATIENT_CONVERSATION_MODEL ='));
assert(!runtimeSource.includes('model: PATIENT_CONVERSATION_MODEL'));

assert.equal((coreSource.match(/Core\.InvokeLLM/g) || []).length, 1);
assert(coreSource.includes("const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';"));
assert(coreSource.includes('add_context_from_internet: false'));
assert(coreSource.includes('response_json_schema: responseSchema'));
assert(coreSource.includes('detectProhibitedPatientConversationOutput(raw)'));
assert(coreSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(!coreSource.includes("'gpt_5_4'"));
assert(!coreSource.includes('PATIENT_CONVERSATION_MODEL ='));
assert(!coreSource.includes('model: PATIENT_CONVERSATION_MODEL'));
assert(!coreSource.includes('assignRecommendationBuckets'));
assert(!coreSource.includes('buildRecommendationScore'));
assert(!coreSource.includes('ProviderLocation'));
assert(!coreSource.includes('asServiceRole'));

assert(sharedOperationalSource.includes('max_model_calls_per_request: 1'));
assert(sharedOperationalSource.includes('if (modelCallsUsed >= policy.max_model_calls_per_request)'));
assert(sharedOperationalSource.includes('modelCallsUsed += 1'));

console.log('Patient conversation Automatic model policy, zero-retry fallback, guided bypass, and marketplace isolation verified.');