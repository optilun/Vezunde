import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPatientGuidancePlannerProfile,
} from '../shared/patientGuidancePlanner.js';
import {
  isApprovedPatientGuidanceQuestionKey,
} from '../shared/patientGuidanceQuestionCatalog.js';
import {
  buildPatientSafetyAssessment,
} from '../base44/shared/patientSafety.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
let scenarios = 0;

function scenario(name, verify) {
  scenarios += 1;
  try {
    verify();
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

const entry = source('base44/functions/matchProvidersSemantic/entry.ts');
const card = source('src/components/intake2/ConversationalCard.jsx');
const handoff = source('shared/patientConversationGuidanceHandoff.js');
const backendSafetyAdapter = source('base44/shared/patientSafety.js');

scenario('PR265 planner copies remain byte-identical', () => {
  assert.equal(
    source('shared/patientGuidancePlanner.js'),
    source('base44/shared/patientGuidancePlanner.js'),
  );
  assert.equal(
    source('shared/patientGuidanceQuestionCatalog.js'),
    source('base44/shared/patientGuidanceQuestionCatalog.js'),
  );
  assert.equal(
    source('shared/patientGuidancePlannerCore.js'),
    source('base44/shared/patientGuidancePlannerCore.js'),
  );
  const plannerWrapper = source('shared/patientGuidancePlanner.js');
  assert.match(plannerWrapper, /assessPatientEyeSafety/);
  assert.match(plannerWrapper, /if \(safety\.advisory\) return "advisory"/);
});

scenario('planner core cannot bypass the composed safety wrapper', () => {
  for (const runtimePath of [
    'base44/functions/matchProvidersSemantic/entry.ts',
    'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
    'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
    'src/lib/providerSemanticSearch.js',
    'src/components/intake2/ConversationalCard.jsx',
    'shared/patientConversationGuidanceHandoff.js',
    'shared/patientConversationGuidancePlannerBridge.js',
  ]) {
    assert.doesNotMatch(source(runtimePath), /patientGuidancePlannerCore/);
  }
});

scenario('canonical safety policy copies remain byte-identical', () => {
  assert.equal(
    source('shared/patientEyeSafetyPolicy.js'),
    source('base44/shared/patientEyeSafetyPolicy.js'),
  );
  assert.match(backendSafetyAdapter, /from '\.\/patientEyeSafetyPolicy\.js'/);
  assert.match(backendSafetyAdapter, /return assessPatientEyeSafety\(options\)/);
  assert.doesNotMatch(backendSafetyAdapter, /const BLOCKING_PATTERNS/);
});

scenario('question-only and semantic shadow modes coexist', () => {
  assert.match(entry, /function selectPatientGuidanceQuestion/);
  assert.match(entry, /payload\.mode === 'question_only'/);
  assert.match(entry, /PATIENT_CONVERSATION_SHADOW_MODE/);
  assert.match(entry, /handlePatientConversationShadowMode/);
  assert.equal((entry.match(/Core\.InvokeLLM\(/g) || []).length, 1);
});

scenario('question-only route has no model authority', () => {
  const start = entry.indexOf('function selectPatientGuidanceQuestion');
  const end = entry.indexOf('async function interpretPatientNeed', start);
  assert.ok(start >= 0 && end > start);
  const block = entry.slice(start, end);
  assert.doesNotMatch(block, /InvokeLLM/);
  assert.doesNotMatch(block, /payload\.deterministic_intent/);
  assert.doesNotMatch(block, /payload\.deterministic_service_keys/);
  assert.doesNotMatch(block, /payload\.deterministic_facts/);
  assert.doesNotMatch(block, /payload\.deterministic_safety_state/);
  assert.doesNotMatch(block, /payload\.explicit_primary_intent/);
  assert.match(block, /serverQuestionSafetyState\(searchText, guidedAnswers\)/);
});

scenario('semantic handoff cannot choose the next question', () => {
  assert.match(handoff, /next_question_key: null/);
  assert.match(handoff, /semantic_fields: "candidate_only"/);
  assert.match(handoff, /confirmed_facts: "controlled_answers_only"/);
  assert.match(handoff, /next_question: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION/);
});

scenario('frontend sends controlled evidence rather than browser authority', () => {
  const requestStart = card.indexOf('selectPatientGuidanceNextQuestion({');
  const requestEnd = card.indexOf('}, {', requestStart);
  assert.ok(requestStart >= 0 && requestEnd > requestStart);
  const request = card.slice(requestStart, requestEnd);
  assert.match(request, /answers: state\.answers/);
  assert.match(request, /question_history: state\.questionHistory/);
  assert.doesNotMatch(request, /deterministic_intent/);
  assert.doesNotMatch(request, /deterministic_service_keys/);
  assert.doesNotMatch(request, /explicit_primary_intent/);
  assert.doesNotMatch(request, /deterministic_safety_state/);
  assert.match(card, /expandedAnsweredQuestionKeys/);
});

scenario('routine request selects only an approved question', () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: 'Vreau un control oftalmologic',
    explicitPrimaryIntent: 'control_vedere',
  }, { status: 'not_requested' });
  assert.equal(profile.next_question_key, 'routine_vs_symptom');
  assert.equal(isApprovedPatientGuidanceQuestionKey(profile.next_question_key), true);
});

scenario('investigation request asks for the missing investigation type', () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: 'Mi-a recomandat medicul o investigatie',
  }, { status: 'not_requested' });
  assert.equal(profile.next_question_key, 'investigation_type');
});

scenario('answered questions are not selected again', () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: 'Vreau un control oftalmologic',
    explicitPrimaryIntent: 'control_vedere',
    guidedAnswers: [{ question_key: 'routine_vs_symptom', answer_value: 'routine' }],
  }, { status: 'not_requested' });
  assert.notEqual(profile.next_question_key, 'routine_vs_symptom');
});

scenario('generic monocular wording is advisory, not automatically blocking', () => {
  const safety = buildPatientSafetyAssessment({ text: 'Nu mai vad cu un ochi' });
  assert.equal(safety.blocking, false);
  assert.equal(safety.state, 'advisory');
  assert.ok(safety.advisory_flags.includes('sudden_vision_loss'));
});

scenario('composed planner preserves advisory safety for guided questioning', () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: 'Nu mai vad cu un ochi',
  }, { status: 'not_requested' });
  assert.equal(profile.safety_state, 'advisory');
  assert.equal(profile.next_question_key, 'safety_targeted_check');
  assert.equal(profile.sufficient_for_search, false);
});

scenario('explicit sudden monocular loss remains blocking', () => {
  const safety = buildPatientSafetyAssessment({ text: 'Nu mai vad brusc cu un ochi' });
  assert.equal(safety.blocking, true);
  assert.ok(safety.blocking_flags.includes('sudden_vision_loss'));
});

scenario('controlled urgent answer blocks before ordinary guidance', () => {
  const safety = buildPatientSafetyAssessment({
    answers: [{ question_key: 'safety_targeted_check', answer_value: 'durere_severa' }],
  });
  assert.equal(safety.blocking, true);
  assert.ok(safety.blocking_flags.includes('severe_eye_pain'));
});

scenario('guided none clears advisory but cannot clear explicit blocking text', () => {
  const answers = [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }];
  const advisory = buildPatientSafetyAssessment({
    text: 'Nu mai vad cu un ochi',
    answers,
  });
  assert.equal(advisory.state, 'clear');
  assert.equal(advisory.source, 'guided_clear');

  const blocking = buildPatientSafetyAssessment({
    text: 'Nu mai vad brusc cu un ochi',
    answers,
  });
  assert.equal(blocking.blocking, true);
});

scenario('matching, ranking and Top 3 are absent from both authority seams', () => {
  const questionStart = entry.indexOf('function selectPatientGuidanceQuestion');
  const questionEnd = entry.indexOf('async function interpretPatientNeed', questionStart);
  const shadowStart = entry.indexOf('async function handlePatientConversationShadowMode');
  const serveStart = entry.indexOf('Deno.serve', shadowStart);
  for (const block of [
    entry.slice(questionStart, questionEnd),
    entry.slice(shadowStart, serveStart),
  ]) {
    assert.doesNotMatch(block, /assignRecommendationBuckets/);
    assert.doesNotMatch(block, /buildRecommendationScore/);
    assert.doesNotMatch(block, /ProviderLocation/);
  }
});

assert.ok(scenarios >= 16);
console.log(`PR #265 + PR #266 conversational composition checks passed: ${scenarios} scenarios.`);
