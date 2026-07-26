import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessPatientEyeSafety,
} from '../shared/patientEyeSafetyPolicy.js';
import {
  detectProhibitedPatientConversationOutput,
} from '../shared/patientConversationGuardrails.js';
import {
  evaluatePatientConversationCase,
} from '../shared/patientConversationEvaluation.js';

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

const aliasResult = evaluatePatientConversationCase({
  fixture: {
    id: 'care-path-alias',
    expected: { care_paths_any: ['ophthalmology'] },
  },
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'simptome_oftalmologice',
      care_path_candidates: ['specialized_ophthalmology'],
      facts: {},
    },
  },
});
assert.equal(aliasResult.passed, true);

const unresolvedResult = evaluatePatientConversationCase({
  fixture: {
    id: 'care-path-unresolved',
    expected: { care_paths_any: ['unresolved'] },
  },
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'unknown',
      care_path_candidates: [],
      facts: {},
    },
  },
});
assert.equal(unresolvedResult.passed, true);

const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes("transition: 'terminal_fallback_no_state_mutation'"));
assert(wrapperSource.includes('recoverTerminalFailure(operationalEnvelope, payload)'));

const evaluatorSource = fs.readFileSync(
  new URL('./evaluate-patient-conversation-results.mjs', import.meta.url),
  'utf8',
);
assert(evaluatorSource.includes("EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3'"));

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

console.log('Post-evaluation safety, fallback, ranking, and care-path stabilization verified.');
