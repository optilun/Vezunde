import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPath = new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url);
const wrapperPath = new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url);
const corePath = new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts', import.meta.url);
const agentPath = new URL('../base44/shared/patientConversationAgent.js', import.meta.url);
const sharedAgentPath = new URL('../shared/patientConversationAgent.js', import.meta.url);
const decisionPath = new URL('../base44/shared/patientConversationDecisionPolicy.js', import.meta.url);
const sharedDecisionPath = new URL('../shared/patientConversationDecisionPolicy.js', import.meta.url);
const guardrailPath = new URL('../base44/shared/patientConversationGuardrails.js', import.meta.url);
const sharedGuardrailPath = new URL('../shared/patientConversationGuardrails.js', import.meta.url);
const operationalPath = new URL('../base44/shared/patientConversationOperationalPolicy.js', import.meta.url);
const sharedOperationalPath = new URL('../shared/patientConversationOperationalPolicy.js', import.meta.url);

const entrySource = fs.readFileSync(entryPath, 'utf8');
const wrapperSource = fs.readFileSync(wrapperPath, 'utf8');
const coreSource = fs.readFileSync(corePath, 'utf8');
const agentSource = fs.readFileSync(agentPath, 'utf8');
const sharedAgentSource = fs.readFileSync(sharedAgentPath, 'utf8');
const decisionSource = fs.readFileSync(decisionPath, 'utf8');
const sharedDecisionSource = fs.readFileSync(sharedDecisionPath, 'utf8');
const guardrailSource = fs.readFileSync(guardrailPath, 'utf8');
const sharedGuardrailSource = fs.readFileSync(sharedGuardrailPath, 'utf8');
const operationalSource = fs.readFileSync(operationalPath, 'utf8');
const sharedOperationalSource = fs.readFileSync(sharedOperationalPath, 'utf8');

assert.equal(guardrailSource, sharedGuardrailSource);
assert.equal(agentSource, sharedAgentSource);
assert.equal(decisionSource, sharedDecisionSource);
assert.equal(operationalSource, sharedOperationalSource);

assert(entrySource.includes("import { runPatientConversationAgentShadow } from './patientConversationAgentShadow.ts';"));
assert(entrySource.includes("const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';"));
assert(entrySource.includes('const user = await base44.auth.me().catch(() => null);'));
assert(entrySource.includes("if (user.role !== 'admin')"));
assert(entrySource.includes('status: 401'));
assert(entrySource.includes('status: 403'));
assert(entrySource.includes("headers: { 'Cache-Control': 'no-store' }"));
assert(entrySource.includes('return Response.json(envelope'));

const modeBranchIndex = entrySource.indexOf('payload.mode === PATIENT_CONVERSATION_SHADOW_MODE');
const semanticResolutionIndex = entrySource.indexOf('const semantic = resolveServiceSearchQuery(searchText');
const serviceRoleIndex = entrySource.indexOf('const svc = base44.asServiceRole;');
assert(modeBranchIndex >= 0);
assert(semanticResolutionIndex >= 0);
assert(serviceRoleIndex >= 0);
assert(modeBranchIndex < serviceRoleIndex && modeBranchIndex < semanticResolutionIndex);
const modeBlock = entrySource.slice(modeBranchIndex, serviceRoleIndex);
assert(modeBlock.includes('return await handlePatientConversationShadowMode(base44, payload);'));
assert(!modeBlock.includes('return handlePatientConversationShadowMode(base44, payload);'));
assert(!modeBlock.includes('assignRecommendationBuckets'));
assert(!modeBlock.includes('buildRecommendationScore'));
assert(!modeBlock.includes('resolveServiceSearchQuery'));

assert(wrapperSource.includes("from '../../shared/patientConversationOperationalPolicy.js';"));
assert(wrapperSource.includes("from './patientConversationAgentShadowCore.ts';"));
assert(wrapperSource.includes("audience: 'admin_shadow'"));
assert(wrapperSource.includes("const PATIENT_CONVERSATION_MODEL = 'gpt_5_4';"));
assert(wrapperSource.includes("const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';"));
assert(coreSource.includes("const PATIENT_CONVERSATION_MODEL = 'gpt_5_4';"));
assert(coreSource.includes("const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';"));
assert(wrapperSource.includes('function normalizedEvaluationCaseId('));
assert(wrapperSource.includes('function normalizedEvaluationAttempt('));
assert(wrapperSource.includes('function evaluationCorrelation('));
assert(wrapperSource.includes('evaluation_case_id: evaluationCaseId'));
assert(wrapperSource.includes('evaluation_attempt: normalizedEvaluationAttempt(payload)'));
assert(wrapperSource.includes('...evaluationCorrelation(payload)'));
assert(wrapperSource.includes('...evaluationCorrelation(runtimePayload)'));
assert(wrapperSource.includes('payload: runtimePayload'));
assert(wrapperSource.includes('function runtimePayloadFromRequest('));
assert(wrapperSource.includes('if (normalizedEvaluationCaseId(source)) return source;'));
assert(wrapperSource.includes('delete runtimePayload.prior_state;'));
assert(wrapperSource.includes('const runtimePayload = runtimePayloadFromRequest(payload);'));
assert(wrapperSource.includes('createPatientConversationOperationalController(runtimePayload'));
assert(wrapperSource.includes('controller.invoke(() =>'));
assert(wrapperSource.includes('finalizePatientConversationOperationalEnvelope('));
assert(wrapperSource.includes('function requestHasUserMessage('));
assert(wrapperSource.includes('function skippedWithoutUserMessage('));
assert(wrapperSource.includes('function noModelRuntimeMetadata('));
assert(wrapperSource.includes('function modelRuntimeMetadata('));
assert(wrapperSource.includes('function unavailableRuntime('));
assert(wrapperSource.includes('function normalizeRuntimeIdentity('));
assert(wrapperSource.includes("reason: 'user_message_required'"));
assert(wrapperSource.includes("? 'conversation_model_unavailable'"));
assert(wrapperSource.includes(": 'conversation_runtime_unavailable'"));
assert(wrapperSource.includes('snapshot?.model_calls_used !== 0'));
assert(wrapperSource.includes('modelInvoked: snapshot.model_calls_used > 0'));
assert(wrapperSource.includes('model: PATIENT_CONVERSATION_MODEL'));
assert(wrapperSource.includes('prompt_version: PATIENT_CONVERSATION_PROMPT_VERSION'));
assert(wrapperSource.includes('model_invoked: true'));
assert(wrapperSource.includes('model: null'));
assert(wrapperSource.includes('prompt_version: null'));
assert(wrapperSource.includes('model_invoked: false'));
assert(wrapperSource.includes('catch (_error)'));
assert(!wrapperSource.includes('_error?.message'));
const invokerGuardIndex = wrapperSource.indexOf("if (typeof invokeModel !== 'function')");
const controllerInvokeIndex = wrapperSource.indexOf('return controller.invoke(() => invokeModel.call(core, args));');
assert(invokerGuardIndex >= 0 && controllerInvokeIndex > invokerGuardIndex);
const emptyMessageGateIndex = wrapperSource.indexOf('if (!requestHasUserMessage(runtimePayload))');
const emptyMessageEnvelopeIndex = wrapperSource.indexOf('skippedWithoutUserMessage(runtimePayload');
const semanticCoreCallIndex = wrapperSource.indexOf('const envelope = await runPatientConversationAgentShadowCore(');
assert(emptyMessageGateIndex >= 0);
assert(emptyMessageEnvelopeIndex > emptyMessageGateIndex);
assert(semanticCoreCallIndex > emptyMessageEnvelopeIndex);
assert(!wrapperSource.includes('normalizeNonInvokedRuntimeIdentity'));
assert(!wrapperSource.includes('assignRecommendationBuckets'));
assert(!wrapperSource.includes('buildRecommendationScore'));
assert(!wrapperSource.includes('asServiceRole'));

assert.equal((coreSource.match(/Core\.InvokeLLM/g) || []).length, 1);
assert(coreSource.includes('model: PATIENT_CONVERSATION_MODEL'));
assert(coreSource.includes('add_context_from_internet: false'));
assert(coreSource.includes('response_json_schema: responseSchema'));
assert(coreSource.includes("from '../../shared/patientConversationGuardrails.js';"));
assert(coreSource.includes("from '../../shared/patientConversationDecisionPolicy.js';"));
assert(coreSource.includes('sanitizePatientConversationTurns('));
assert(coreSource.includes('sanitizePriorState(payload?.prior_state)'));
assert(coreSource.includes('need_summary: redactPatientConversationText(value.need_summary, 500)'));
assert(guardrailSource.includes('PATIENT_CONVERSATION_MAX_TURNS = 20'));
assert(guardrailSource.includes('PATIENT_CONVERSATION_MAX_CHARACTERS = 8000'));
assert(guardrailSource.includes('.replace(/\\b\\d{13}\\b/g, "[identificator eliminat]")'));
assert(guardrailSource.includes('[email eliminat]') && guardrailSource.includes('[telefon eliminat]'));

const preflightIndex = coreSource.indexOf('const preflightDecision = deterministicSafetyPreflight(conversation, runtimeContext);');
const promptBuildIndex = coreSource.indexOf('const prompt = buildPatientConversationAgentPrompt({');
const modelCallIndex = coreSource.indexOf('const raw = await base44.integrations.Core.InvokeLLM({');
assert(preflightIndex >= 0 && promptBuildIndex > preflightIndex && modelCallIndex > promptBuildIndex);
assert(coreSource.includes('{ modelInvoked: false }'));
assert(coreSource.includes('model_invoked: modelInvoked'));

const promptBuildBlock = coreSource.slice(promptBuildIndex, modelCallIndex);
assert(!promptBuildBlock.includes('evaluationAttempt'));
assert(!promptBuildBlock.includes('evaluation_attempt'));

assert(agentSource.includes('PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION'));
assert(agentSource.includes('Extract semantic meaning only'));
assert(agentSource.includes('Do not choose a care path, provider type'));
assert(agentSource.includes('possible_safety_flags are advisory'));
assert(!agentSource.includes('Only confirmed urgency may use show_emergency_guidance'));

for (const forbiddenRawModelField of [
  'care_path_candidates',
  'provider_type_candidates',
  'urgency',
  'information_status',
  'next_action',
  'assistant_message',
  'specialist_summary',
]) {
  const schemaStart = agentSource.indexOf('export function getPatientConversationAgentResponseSchema()');
  const promptStart = agentSource.indexOf('export function buildPatientConversationAgentPrompt');
  const schemaBlock = agentSource.slice(schemaStart, promptStart);
  assert(!schemaBlock.includes(`${forbiddenRawModelField}: {`), `${forbiddenRawModelField} leaked into raw model schema`);
}

assert(coreSource.includes('detectProhibitedPatientConversationOutput(raw)'));
assert(coreSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(coreSource.includes("invalidModelOutputEnvelope('prohibited_model_output'"));
assert(coreSource.includes("invalidModelOutputEnvelope('invalid_model_output_shape'"));
assert(coreSource.includes("invalidModelOutputEnvelope('noncanonical_model_output'"));
const prohibitedIndex = coreSource.indexOf('detectProhibitedPatientConversationOutput(raw)');
const schemaIndex = coreSource.indexOf('validatePatientConversationModelResponse(raw, responseSchema)');
const envelopeIndex = coreSource.indexOf('const builtEnvelope = buildPatientConversationShadowEnvelope({');
const stateIndex = coreSource.indexOf('const stateEnvelope = applyConversationStatePolicy(');
const decisionIndex = coreSource.indexOf('const deterministicEnvelope = applyDeterministicDecisionPolicy(');
assert(prohibitedIndex >= 0 && schemaIndex > prohibitedIndex);
assert(envelopeIndex > schemaIndex && stateIndex > envelopeIndex && decisionIndex > stateIndex);

assert(decisionSource.includes('const providerTypes = derivedProviderProfileTypes(current.service_keys);'));
assert(decisionSource.includes('current.provider_type_candidates = providerTypes;'));
assert(decisionSource.includes('let nextAction = "ask_clarifying_question";'));
assert(decisionSource.includes('current.assistant_message = deterministicAssistantMessage(nextAction);'));
assert(decisionSource.includes('current.specialist_summary = null;'));
assert(decisionSource.includes('if (safety.blocking)'));
assert(decisionSource.includes('urgencyLevel = "confirmed";'));
assert(decisionSource.includes('urgencyLevel = "possible";'));

assert(!coreSource.includes('assignRecommendationBuckets'));
assert(!coreSource.includes('buildRecommendationScore'));
assert(!coreSource.includes('ProviderLocation'));
assert(!coreSource.includes('asServiceRole'));

console.log('Patient conversation operational wrapper, semantic core, and deterministic authority verified.');
