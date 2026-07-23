import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPath = new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url);
const runnerPath = new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url);
const agentPath = new URL('../base44/shared/patientConversationAgent.js', import.meta.url);
const sharedAgentPath = new URL('../shared/patientConversationAgent.js', import.meta.url);
const decisionPath = new URL('../base44/shared/patientConversationDecisionPolicy.js', import.meta.url);
const sharedDecisionPath = new URL('../shared/patientConversationDecisionPolicy.js', import.meta.url);
const guardrailPath = new URL('../base44/shared/patientConversationGuardrails.js', import.meta.url);
const sharedGuardrailPath = new URL('../shared/patientConversationGuardrails.js', import.meta.url);

const entrySource = fs.readFileSync(entryPath, 'utf8');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const agentSource = fs.readFileSync(agentPath, 'utf8');
const sharedAgentSource = fs.readFileSync(sharedAgentPath, 'utf8');
const decisionSource = fs.readFileSync(decisionPath, 'utf8');
const sharedDecisionSource = fs.readFileSync(sharedDecisionPath, 'utf8');
const guardrailSource = fs.readFileSync(guardrailPath, 'utf8');
const sharedGuardrailSource = fs.readFileSync(sharedGuardrailPath, 'utf8');

assert.equal(guardrailSource, sharedGuardrailSource);
assert.equal(agentSource, sharedAgentSource);
assert.equal(decisionSource, sharedDecisionSource);

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
assert(modeBlock.includes('handlePatientConversationShadowMode(base44, payload)'));
assert(!modeBlock.includes('assignRecommendationBuckets'));
assert(!modeBlock.includes('buildRecommendationScore'));
assert(!modeBlock.includes('resolveServiceSearchQuery'));

assert.equal((runnerSource.match(/Core\.InvokeLLM/g) || []).length, 1);
assert(runnerSource.includes("const PATIENT_CONVERSATION_MODEL = 'gpt_5_4';"));
assert(runnerSource.includes("const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';"));
assert(runnerSource.includes('model: PATIENT_CONVERSATION_MODEL'));
assert(runnerSource.includes('add_context_from_internet: false'));
assert(runnerSource.includes('response_json_schema: responseSchema'));
assert(runnerSource.includes("from '../../shared/patientConversationGuardrails.js';"));
assert(runnerSource.includes("from '../../shared/patientConversationDecisionPolicy.js';"));
assert(runnerSource.includes('sanitizePatientConversationTurns('));
assert(runnerSource.includes('sanitizePriorState(payload?.prior_state)'));
assert(runnerSource.includes('need_summary: redactPatientConversationText(value.need_summary, 500)'));
assert(guardrailSource.includes('PATIENT_CONVERSATION_MAX_TURNS = 20'));
assert(guardrailSource.includes('PATIENT_CONVERSATION_MAX_CHARACTERS = 8000'));
assert(guardrailSource.includes('.replace(/\\b\\d{13}\\b/g, "[identificator eliminat]")'));
assert(guardrailSource.includes('[email eliminat]') && guardrailSource.includes('[telefon eliminat]'));

const preflightIndex = runnerSource.indexOf('const preflightDecision = deterministicSafetyPreflight(conversation, runtimeContext);');
const promptBuildIndex = runnerSource.indexOf('const prompt = buildPatientConversationAgentPrompt({');
const modelCallIndex = runnerSource.indexOf('const raw = await base44.integrations.Core.InvokeLLM({');
assert(preflightIndex >= 0 && promptBuildIndex > preflightIndex && modelCallIndex > promptBuildIndex);
assert(runnerSource.includes('{ modelInvoked: false }'));
assert(runnerSource.includes('model_invoked: modelInvoked'));

const promptBuildBlock = runnerSource.slice(promptBuildIndex, modelCallIndex);
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

assert(runnerSource.includes('detectProhibitedPatientConversationOutput(raw)'));
assert(runnerSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(runnerSource.includes("invalidModelOutputEnvelope('prohibited_model_output'"));
assert(runnerSource.includes("invalidModelOutputEnvelope('invalid_model_output_shape'"));
assert(runnerSource.includes("invalidModelOutputEnvelope('noncanonical_model_output'"));
const prohibitedIndex = runnerSource.indexOf('detectProhibitedPatientConversationOutput(raw)');
const schemaIndex = runnerSource.indexOf('validatePatientConversationModelResponse(raw, responseSchema)');
const envelopeIndex = runnerSource.indexOf('const builtEnvelope = buildPatientConversationShadowEnvelope({');
const stateIndex = runnerSource.indexOf('const stateEnvelope = applyConversationStatePolicy(');
const decisionIndex = runnerSource.indexOf('const deterministicEnvelope = applyDeterministicDecisionPolicy(');
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

assert(!runnerSource.includes('assignRecommendationBuckets'));
assert(!runnerSource.includes('buildRecommendationScore'));
assert(!runnerSource.includes('ProviderLocation'));
assert(!runnerSource.includes('asServiceRole'));

console.log('Patient conversation semantic-only admin shadow route and deterministic authority verified.');
