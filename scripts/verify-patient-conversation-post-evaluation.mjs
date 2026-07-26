import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessPatientEyeSafety,
} from '../shared/patientEyeSafetyPolicy.js';
import {
  detectProhibitedPatientConversationOutput,
} from '../shared/patientConversationGuardrails.js';

const safetyCases = [
  {
    content: 'mi-a intrat sampon in ochi, am clatit si inca ma ustura putin',
    state: 'advisory',
    flag: 'chemical_injury',
  },
  {
    content: 'm-am lovit la ochi cu mingea si vad cam in ceata',
    state: 'advisory',
    flag: 'penetrating_or_high_speed_trauma',
  },
  {
    content: 'ochiul e foarte rosu, ma doare tare si imi vine sa vomit de azi',
    state: 'blocking',
    flag: 'severe_eye_pain',
  },
  {
    content: 'am nevoie urgent de un oftalmolog',
    state: 'advisory',
    flag: 'other_possible_urgent_eye_problem',
  },
];

for (const scenario of safetyCases) {
  const result = assessPatientEyeSafety({
    conversation: [{ role: 'user', content: scenario.content }],
  });
  assert.equal(result.state, scenario.state, scenario.content);
  const flags = scenario.state === 'blocking'
    ? result.blocking_flags
    : result.advisory_flags;
  assert(flags.includes(scenario.flag), scenario.content);
}

const correctedVision = assessPatientEyeSafety({
  conversation: [
    { role: 'user', content: 'nu mai vad cu un ochi' },
    { role: 'assistant', content: 'A aparut brusc?' },
    { role: 'user', content: 'vad, doar ca mult mai slab de vreo doi ani' },
  ],
});
assert.equal(correctedVision.state, 'clear');
assert(correctedVision.cleared_flags.includes('sudden_vision_loss'));

assert.deepEqual(
  detectProhibitedPatientConversationOutput({
    need_summary: 'Utilizatorul solicita un top 3 de clinici, cerere care nu acorda autoritate modelului.',
  }),
  [],
);
assert(
  detectProhibitedPatientConversationOutput({
    assistant_message: 'Cea mai buna clinica este Clinica X.',
  }).includes('ranking_or_provider_recommendation_claim'),
);

const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
assert(wrapperSource.includes("const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';"));
assert(wrapperSource.includes('delete automaticArgs.model;'));
assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes('retry_attempted: false'));
assert(wrapperSource.includes('search_blocked: true'));
assert(!wrapperSource.includes('PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET'));
assert(!wrapperSource.includes('monthly_model_call_target'));

const evaluatorSource = fs.readFileSync(
  new URL('./evaluate-patient-conversation-results.mjs', import.meta.url),
  'utf8',
);
assert(evaluatorSource.includes("EXPECTED_MODEL_POLICY = 'base44_automatic'"));
assert(evaluatorSource.includes("EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3'"));
assert(evaluatorSource.includes('function normalizeInterpretationCompatibility('));
assert(evaluatorSource.includes("carePaths.includes('specialized_ophthalmology')"));
assert(evaluatorSource.includes("carePaths.push('ophthalmology')"));
assert(evaluatorSource.includes("carePaths.push('unresolved')"));
assert(evaluatorSource.includes("replace(/\\btop\\s*3\\b/giu, 'clasament solicitat')"));

for (const fileName of [
  'patientConversationGuardrails.js',
  'patientEyeSafetyPolicy.js',
]) {
  assert.equal(
    fs.readFileSync(new URL(`../shared/${fileName}`, import.meta.url), 'utf8'),
    fs.readFileSync(new URL(`../base44/shared/${fileName}`, import.meta.url), 'utf8'),
    `${fileName} shared/Base44 copies differ`,
  );
}

console.log('Post-evaluation safety, Automatic fallback, ranking, and compatibility fixes verified.');
