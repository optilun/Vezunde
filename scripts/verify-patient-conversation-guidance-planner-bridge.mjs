import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_GUIDANCE_PLANNER_BRIDGE_VERSION,
  consumePatientConversationGuidanceHandoff,
} from '../shared/patientConversationGuidancePlannerBridge.js';
import {
  PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
} from '../shared/patientConversationGuidanceHandoff.js';
import {
  PATIENT_GUIDANCE_PLANNER_VERSION,
  PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
} from '../shared/patientGuidancePlanner.js';
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
} from '../shared/patientGuidanceQuestionCatalog.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationGuidancePlannerBridge.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationGuidancePlannerBridge.js', import.meta.url),
  'utf8',
);
const entrySource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
  'utf8',
);
const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);

assert.equal(sharedSource, base44Source);
assert.equal(
  PATIENT_CONVERSATION_GUIDANCE_PLANNER_BRIDGE_VERSION,
  'viasee-patient-conversation-guidance-planner-bridge-v1',
);
assert.equal(
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
  PATIENT_GUIDANCE_PLANNER_VERSION,
);
assert(!entrySource.includes('patientConversationGuidancePlannerBridge'));
assert(!wrapperSource.includes('patientConversationGuidancePlannerBridge'));
assert(!sharedSource.includes('Deno.serve'));
assert(!sharedSource.includes('request.json'));
assert(!sharedSource.includes('assignRecommendationBuckets'));
assert(!sharedSource.includes('buildRecommendationScore'));
assert(!sharedSource.includes('ProviderLocation'));
assert(!sharedSource.includes('Core.InvokeLLM'));

function proposal(overrides = {}) {
  return {
    primary_intent: 'reparatii_ochelari',
    alternative_intents: [],
    candidate_service_keys: ['hinge_repair'],
    extracted_facts: [
      {
        fact_key: 'locality',
        value: 'Arad',
        evidence_phrase: 'Arad',
      },
    ],
    candidate_care_paths: ['technical_optical_service'],
    next_question_key: null,
    confidence_band: 'high',
    possible_safety_flags: [],
    evidence_phrases: ['balamaua', 'Arad'],
    ...overrides,
  };
}

function handoff(overrides = {}) {
  return {
    contract_version: PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
    target_planner_version: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
    status: 'ready',
    reason: null,
    safety_state: 'clear',
    planner_allowed: true,
    semantic_proposal: proposal(),
    missing_critical_fields: ['locality'],
    authority: {
      semantic_fields: 'candidate_only',
      confirmed_facts: 'controlled_answers_only',
      safety: 'viasee_deterministic_policy',
      next_question: PATIENT_GUIDANCE_PLANNER_VERSION,
    },
    ...overrides,
  };
}

const text = 'S-a rupt balamaua la ochelari si sunt in Arad.';
const candidateOnlyResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff(),
  text,
  controlledContext: {
    explicit_primary_intent: 'reparatii_ochelari',
    explicit_confirmed_service_keys: ['hinge_repair'],
    guided_answers: [],
    question_history: [],
  },
});
assert.equal(candidateOnlyResult.contract_version, PATIENT_CONVERSATION_GUIDANCE_PLANNER_BRIDGE_VERSION);
assert.equal(candidateOnlyResult.target_planner_version, PATIENT_GUIDANCE_PLANNER_VERSION);
assert.equal(candidateOnlyResult.authority.handoff_source, 'server_internal_only');
assert.equal(candidateOnlyResult.authority.confirmed_facts, 'controlled_answers_only');
assert.equal(
  candidateOnlyResult.question_selection.contract_version,
  PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
);
assert.equal(
  candidateOnlyResult.question_selection.question_catalog_version,
  PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
);
assert.equal(candidateOnlyResult.diagnostics.confirmed_fact_source, 'controlled_context_only');
assert.equal(candidateOnlyResult.diagnostics.semantic_candidate_fact_count, 1);
assert.equal(candidateOnlyResult.diagnostics.controlled_answer_count, 0);
assert(!candidateOnlyResult.diagnostics.planner_confirmed_fact_keys.includes('locality'));
assert.equal(candidateOnlyResult.diagnostics.planner_confirmed_fact_sources.locality, undefined);
assert(
  candidateOnlyResult.question_selection.next_question_key === null
  || Object.hasOwn(
    PATIENT_GUIDANCE_QUESTION_CATALOG,
    candidateOnlyResult.question_selection.next_question_key,
  ),
);

const controlledLocalityResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff(),
  text,
  controlledContext: {
    explicit_primary_intent: 'reparatii_ochelari',
    explicit_confirmed_service_keys: ['hinge_repair'],
    explicit_locality: {
      city: 'Arad',
      county: 'Arad',
      county_code: 'AR',
    },
    guided_answers: [],
    question_history: [],
  },
});
assert.notEqual(controlledLocalityResult.status, 'invalid');
assert.notEqual(controlledLocalityResult.reason, 'semantic_proposal_invalid');
assert.equal(controlledLocalityResult.diagnostics.confirmed_fact_source, 'controlled_context_only');
assert(controlledLocalityResult.diagnostics.planner_confirmed_fact_keys.includes('locality'));
assert.equal(
  controlledLocalityResult.diagnostics.planner_confirmed_fact_sources.locality,
  'explicit_user',
);

const invalidControlledAnswerResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff(),
  text,
  controlledContext: {
    explicit_primary_intent: 'reparatii_ochelari',
    explicit_confirmed_service_keys: ['hinge_repair'],
    guided_answers: [
      { question_key: 'locality', answer_value: {} },
      { question_key: 'repair_type', answer_value: 'invented_option' },
      { question_key: 'invented_question', answer_value: 'invented' },
    ],
    question_history: ['invented_question'],
  },
});
assert.equal(invalidControlledAnswerResult.diagnostics.controlled_answer_count, 0);
assert(!invalidControlledAnswerResult.diagnostics.planner_confirmed_fact_keys.includes('locality'));
assert.equal(invalidControlledAnswerResult.question_selection.asked_question_count, 0);
assert.notEqual(
  invalidControlledAnswerResult.question_selection.fallback_reason,
  'answered_question_reselected',
);

const validControlledAnswerResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff(),
  text,
  controlledContext: {
    explicit_primary_intent: 'reparatii_ochelari',
    explicit_confirmed_service_keys: ['hinge_repair'],
    guided_answers: [
      { question_key: 'repair_type', answer_value: 'hinge_or_screw' },
    ],
    question_history: ['repair_type'],
  },
});
assert.equal(validControlledAnswerResult.diagnostics.controlled_answer_count, 1);
assert(validControlledAnswerResult.diagnostics.planner_confirmed_fact_keys.includes('repair_type'));
assert.equal(
  validControlledAnswerResult.diagnostics.planner_confirmed_fact_sources.repair_type,
  'guided_answer',
);
assert.equal(validControlledAnswerResult.question_selection.asked_question_count, 1);

const advisoryResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff({
    safety_state: 'advisory',
    semantic_proposal: proposal({
      primary_intent: 'simptome_oftalmologice',
      candidate_service_keys: ['ophthalmology_consultation'],
      candidate_care_paths: ['ophthalmology'],
      possible_safety_flags: ['sudden_vision_loss'],
      extracted_facts: [{
        fact_key: 'symptom_description',
        value: 'nu vad bine cu ochiul drept',
        evidence_phrase: 'nu vad bine cu ochiul drept',
      }],
      evidence_phrases: ['nu vad bine cu ochiul drept'],
    }),
  }),
  text: 'Nu vad bine cu ochiul drept.',
  controlledContext: {
    explicit_primary_intent: 'simptome_oftalmologice',
    guided_answers: [],
    question_history: [],
  },
});
assert.notEqual(advisoryResult.status, 'safety_blocked');
assert.equal(advisoryResult.question_selection.safety_blocking, false);
assert(!advisoryResult.diagnostics.planner_confirmed_fact_keys.includes('symptom_description'));
assert(
  advisoryResult.question_selection.next_question_key === null
  || Object.hasOwn(
    PATIENT_GUIDANCE_QUESTION_CATALOG,
    advisoryResult.question_selection.next_question_key,
  ),
);

const blockedResult = consumePatientConversationGuidanceHandoff({
  handoff: handoff({
    status: 'safety_blocked',
    reason: 'deterministic_safety_block',
    safety_state: 'blocking',
    planner_allowed: false,
    semantic_proposal: proposal({
      candidate_service_keys: [],
      extracted_facts: [],
      candidate_care_paths: [],
      possible_safety_flags: ['sudden_vision_loss'],
      evidence_phrases: [],
    }),
  }),
  text: 'Deodata nu mai vad aproape deloc cu ochiul drept.',
  controlledContext: {
    explicit_primary_intent: 'control_vedere',
    explicit_confirmed_service_keys: ['optometry_consultation'],
    explicit_locality: { city: 'Arad' },
    question_history: ['routine_vs_symptom'],
  },
});
assert.equal(blockedResult.status, 'safety_blocked');
assert.equal(blockedResult.reason, 'deterministic_safety_block');
assert.equal(blockedResult.question_selection.status, 'safety_blocked');
assert.equal(blockedResult.question_selection.next_question_key, null);
assert.equal(blockedResult.question_selection.safety_blocking, true);
assert.equal(blockedResult.question_selection.asked_question_count, 1);
assert.equal(Object.hasOwn(blockedResult, 'diagnostics'), false);

const questionAuthorityViolation = consumePatientConversationGuidanceHandoff({
  handoff: handoff({
    semantic_proposal: proposal({ next_question_key: 'locality' }),
  }),
  text,
});
assert.equal(questionAuthorityViolation.status, 'invalid');
assert.equal(questionAuthorityViolation.reason, 'handoff_question_authority_violation');
assert.equal(questionAuthorityViolation.question_selection.next_question_key, null);

const authorityViolation = consumePatientConversationGuidanceHandoff({
  handoff: handoff({
    authority: {
      semantic_fields: 'confirmed',
      confirmed_facts: 'semantic_allowed',
      safety: 'model',
      next_question: 'semantic_agent',
    },
  }),
  text,
});
assert.equal(authorityViolation.status, 'invalid');
assert.equal(authorityViolation.reason, 'handoff_authority_invalid');

const versionViolation = consumePatientConversationGuidanceHandoff({
  handoff: handoff({ target_planner_version: 'patient-guidance-planner-v2' }),
  text,
});
assert.equal(versionViolation.status, 'invalid');
assert.equal(versionViolation.reason, 'planner_contract_version_mismatch');

const unavailableResult = consumePatientConversationGuidanceHandoff({
  handoff: {
    status: 'unavailable',
    reason: 'conversation_model_unavailable',
  },
  text,
});
assert.equal(unavailableResult.status, 'fallback');
assert.equal(unavailableResult.reason, 'conversation_model_unavailable');
assert.equal(unavailableResult.question_selection.status, 'fallback');
assert.equal(unavailableResult.question_selection.next_question_key, null);

console.log('Inactive server-side patient conversation planner bridge verified.');
