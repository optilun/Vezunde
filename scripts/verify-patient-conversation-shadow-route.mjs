import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPath = new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url);
const runnerPath = new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url);

const entrySource = fs.readFileSync(entryPath, 'utf8');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');

assert(
  entrySource.includes("import { runPatientConversationAgentShadow } from './patientConversationAgentShadow.ts';"),
  'matchProvidersSemantic must import the isolated conversation shadow runner',
);
assert(
  entrySource.includes("const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';"),
  'the developer-only conversation mode must use a dedicated explicit value',
);
assert(
  entrySource.includes('const user = await base44.auth.me().catch(() => null);'),
  'the shadow route must require an authenticated user',
);
assert(
  entrySource.includes("if (user.role !== 'admin')"),
  'the shadow route must be limited to administrators',
);
assert(
  entrySource.includes('status: 401'),
  'unauthenticated shadow requests must return 401',
);
assert(
  entrySource.includes('status: 403'),
  'non-admin shadow requests must return 403',
);
assert(
  entrySource.includes("headers: { 'Cache-Control': 'no-store' }"),
  'shadow responses must not be cached',
);
assert(
  entrySource.includes('return Response.json(envelope'),
  'the developer route must return only the isolated shadow envelope',
);

const modeBranchIndex = entrySource.indexOf('payload.mode === PATIENT_CONVERSATION_SHADOW_MODE');
const semanticResolutionIndex = entrySource.indexOf('const semantic = resolveServiceSearchQuery(searchText');
const serviceRoleIndex = entrySource.indexOf('const svc = base44.asServiceRole;');
assert(modeBranchIndex >= 0, 'the shadow mode branch must exist');
assert(semanticResolutionIndex >= 0, 'the existing semantic matcher must remain present');
assert(serviceRoleIndex >= 0, 'the existing service-role matcher path must remain present');
assert(
  modeBranchIndex < serviceRoleIndex && modeBranchIndex < semanticResolutionIndex,
  'the admin-only shadow route must exit before service-role access or deterministic matching',
);

const modeBlock = entrySource.slice(modeBranchIndex, serviceRoleIndex);
assert(
  modeBlock.includes('handlePatientConversationShadowMode(base44, payload)'),
  'the dedicated mode must delegate to the isolated handler',
);
assert(
  !modeBlock.includes('assignRecommendationBuckets'),
  'the shadow branch must not perform provider recommendation bucketing',
);
assert(
  !modeBlock.includes('buildRecommendationScore'),
  'the shadow branch must not calculate provider scores',
);
assert(
  !modeBlock.includes('resolveServiceSearchQuery'),
  'the conversation model must receive the conversation before deterministic phrase matching',
);

assert.equal(
  (runnerSource.match(/Core\.InvokeLLM/g) || []).length,
  1,
  'the isolated runner must make exactly one LLM call',
);
assert(
  runnerSource.includes("const PATIENT_CONVERSATION_MODEL = 'gpt_5_4';"),
  'the shadow evaluator must use an explicitly versioned model selection',
);
assert(
  runnerSource.includes("const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.1';"),
  'the prompt contract must be versioned independently',
);
assert(
  runnerSource.includes('model: PATIENT_CONVERSATION_MODEL'),
  'the configured model must be passed to InvokeLLM',
);
assert(
  runnerSource.includes('add_context_from_internet: false'),
  'the isolated runner must not use internet context',
);
assert(
  runnerSource.includes('redactSensitiveText(turn?.content)'),
  'conversation messages must be redacted before entering the prompt',
);
assert(
  runnerSource.includes(".replace(/\\b\\d{13}\\b/g, '[identificator eliminat]')"),
  '13-digit personal identifiers must be removed before model invocation',
);
assert(
  runnerSource.includes('sanitizePriorState(payload?.prior_state)'),
  'prior conversational state must be bounded and field-selected before entering the prompt',
);
assert(
  runnerSource.includes('need_summary: redactSensitiveText(value.need_summary, 500)'),
  'prior-state narrative fields must be redacted before entering the prompt',
);
assert(
  runnerSource.includes('MAX_CONVERSATION_TURNS = 20'),
  'conversation turn count must be bounded',
);
assert(
  runnerSource.includes('MAX_CONVERSATION_CHARACTERS = 8000'),
  'conversation character count must be bounded',
);
assert(
  runnerSource.includes('runtime_metadata:'),
  'shadow results must carry model, prompt, and duration metadata',
);
assert(
  runnerSource.includes('const searchReady = urgencyLevel === \'none\''),
  'search readiness must be recomputed server-side',
);
assert(
  runnerSource.includes("interpretation.primary_intent !== 'unknown'"),
  'an unknown need must never start provider search',
);
assert(
  runnerSource.includes('&& hasServices'),
  'provider search must require canonical services',
);
assert(
  runnerSource.includes('&& hasLocality(interpretation.facts.locality)'),
  'provider search must require a locality',
);
assert(
  runnerSource.includes("interpretation.next_action = 'ask_locality';"),
  'missing locality must return to a locality question instead of matching',
);
assert(
  runnerSource.includes("interpretation.next_action = 'ask_clarifying_question';"),
  'ambiguous or incomplete meaning must return to clarification',
);
assert(
  runnerSource.includes("if (urgencyLevel === 'possible')"),
  'possible urgency must remain a clarification state',
);
assert(
  runnerSource.includes("if (urgencyLevel === 'confirmed')"),
  'confirmed urgency must have a separate enforced path',
);
assert(
  runnerSource.includes("interpretation.next_action = 'show_emergency_guidance';"),
  'only the confirmed branch may enforce emergency guidance',
);
assert(
  runnerSource.includes('redactContactDetails(interpretation.specialist_summary)'),
  'contact details must be removed from specialist summaries',
);
assert(
  !runnerSource.includes('assignRecommendationBuckets'),
  'the isolated runner must not rank or bucket providers',
);
assert(
  !runnerSource.includes('buildRecommendationScore'),
  'the isolated runner must not calculate recommendation scores',
);
assert(
  !runnerSource.includes('ProviderLocation'),
  'the isolated runner must not load or choose concrete providers',
);

console.log('Patient conversation admin-only shadow route verified.');
