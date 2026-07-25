import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
  buildPatientConversationGuidanceHandoff,
} from '../shared/patientConversationGuidanceHandoff.js';
import {
  sanitizePatientGuidancePlannerProposal,
} from '../shared/patientGuidancePlanner.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationGuidanceHandoff.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationGuidanceHandoff.js', import.meta.url),
  'utf8',
);
const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
const handoffDoc = fs.readFileSync(
  new URL('../docs/patient-conversation-guidance-handoff.md', import.meta.url),
  'utf8',
);

assert.equal(sharedSource, base44Source);
assert.match(sharedSource, /deterministic_safety_advisory_flags/);
assert.doesNotMatch(sharedSource, /envelope\?\.diagnostics\?\.advisory_safety_flags/);
assert.equal(
  PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
  'viasee-patient-conversation-guidance-handoff-v1',
);
assert.equal(
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
  'patient-guidance-planner-v1',
);
assert.match(handoffDoc, /next_question_key` is deliberately forced to `null`/);
assert.match(handoffDoc, /confirmed_facts": "controlled_answers_only"/);
assert.match(handoffDoc, /do not activate the semantic LLM for patients/);

function interpretation(overrides = {}) {
  return {
    contract_version: 'viasee-patient-conversation-agent-v1',
    language: 'ro',
    need_summary: 'Reparatie balama ochelari in Arad.',
    primary_intent: 'reparatii_ochelari',
    alternative_intents: [],
    care_path_candidates: ['technical_optical_service'],
    service_keys: ['hinge_repair'],
    facts: {
      for_whom: 'adult',
      age_group: 'adult',
      locality: {
        siruta_code: '',
        city: 'Arad',
        county_code: 'AR',
        county: 'Arad',
        area: '',
      },
      symptom_onset: '',
      symptom_duration: '',
      symptom_pattern: '',
      desired_timing: '',
      contact_lens_experience: 'unknown',
      prescription_status: 'unknown',
      investigation_reference_text: '',
      repair_details: 'balama',
      user_constraints: [],
    },
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    understanding_confidence: 'high',
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
    assistant_message: 'Am suficiente informatii pentru a continua cautarea.',
    specialist_summary: null,
    evidence_phrases: ['balama', 'Arad'],
    ...overrides,
  };
}

const routineEnvelope = {
  mode: 'shadow',
  contract_version: 'viasee-patient-conversation-agent-v1',
  status: 'completed',
  reason: null,
  interpretation: interpretation(),
  diagnostics: {
    advisory_safety_flags: ['chemical_injury'],
    decision_policy: {
      deterministic_safety_flags: [],
      deterministic_safety_advisory_flags: [],
    },
  },
};
const routineHandoff = buildPatientConversationGuidanceHandoff(routineEnvelope);
assert.equal(routineHandoff.status, 'ready');
assert.equal(routineHandoff.safety_state, 'clear');
assert.equal(routineHandoff.planner_allowed, true);
assert.equal(routineHandoff.semantic_proposal.next_question_key, null);
assert.equal(
  routineHandoff.authority.next_question,
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
);
assert.equal(routineHandoff.authority.semantic_fields, 'candidate_only');
assert.equal(routineHandoff.authority.confirmed_facts, 'controlled_answers_only');
assert.deepEqual(routineHandoff.semantic_proposal.candidate_service_keys, ['hinge_repair']);
assert(routineHandoff.semantic_proposal.extracted_facts.some((fact) => (
  fact.fact_key === 'repair_details' && fact.value === 'balama'
)));
assert.equal(Object.hasOwn(routineHandoff, 'confirmed_facts'), false);
assert.equal(Object.hasOwn(routineHandoff.semantic_proposal, 'confirmed_facts'), false);

assert.deepEqual(
  Object.keys(routineHandoff.semantic_proposal).sort(),
  [
    'alternative_intents',
    'candidate_care_paths',
    'candidate_service_keys',
    'confidence_band',
    'evidence_phrases',
    'extracted_facts',
    'next_question_key',
    'possible_safety_flags',
    'primary_intent',
  ].sort(),
);

const plannerValidation = sanitizePatientGuidancePlannerProposal(
  routineHandoff.semantic_proposal,
  { text: 'S-a rupt balamaua la ochelari si sunt in Arad.' },
);
assert.equal(plannerValidation.valid, true);
assert.equal(plannerValidation.proposal.next_question_key, null);
assert.deepEqual(plannerValidation.proposal.candidate_service_keys, ['hinge_repair']);
assert.equal(plannerValidation.diagnostics.question_key_rejected, false);

const evidenceLimitHandoff = buildPatientConversationGuidanceHandoff({
  ...routineEnvelope,
  interpretation: interpretation({
    evidence_phrases: [
      'prima dovada',
      'a doua dovada',
      'a treia dovada',
      'a patra dovada',
      'a cincea dovada',
      'a sasea dovada care trebuie eliminata',
      'x'.repeat(180),
    ],
  }),
});
assert.equal(evidenceLimitHandoff.semantic_proposal.evidence_phrases.length, 5);
assert(evidenceLimitHandoff.semantic_proposal.evidence_phrases.every((phrase) => (
  phrase.length <= 120
)));

const advisoryEnvelope = {
  ...routineEnvelope,
  interpretation: interpretation({
    primary_intent: 'simptome_oftalmologice',
    service_keys: ['ophthalmology_consultation'],
    care_path_candidates: ['ophthalmology'],
    urgency: {
      level: 'possible',
      needs_clarification: true,
      reason: 'Semnal consultativ; necesita clarificare.',
    },
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['symptom_severity'],
    },
    next_action: 'ask_clarifying_question',
    evidence_phrases: ['nu vad cu ochiul drept'],
  }),
  diagnostics: {
    advisory_safety_flags: ['chemical_injury'],
    decision_policy: {
      deterministic_safety_flags: [],
      deterministic_safety_advisory_flags: ['sudden_vision_loss'],
    },
  },
};
const advisoryHandoff = buildPatientConversationGuidanceHandoff(advisoryEnvelope);
assert.equal(advisoryHandoff.status, 'ready');
assert.equal(advisoryHandoff.safety_state, 'advisory');
assert.equal(advisoryHandoff.planner_allowed, true);
assert.equal(advisoryHandoff.semantic_proposal.next_question_key, null);
assert.deepEqual(advisoryHandoff.semantic_proposal.possible_safety_flags, [
  'sudden_vision_loss',
]);
assert(advisoryHandoff.missing_critical_fields.includes('symptom_severity'));

const clearedStaleAdvisoryEnvelope = {
  ...routineEnvelope,
  interpretation: interpretation({
    primary_intent: 'simptome_oftalmologice',
    service_keys: ['optometry_consultation'],
    care_path_candidates: ['optometry'],
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
  }),
  diagnostics: {
    advisory_safety_flags: ['sudden_vision_loss'],
    decision_policy: {
      deterministic_safety_flags: [],
      deterministic_safety_advisory_flags: [],
      decision_source: 'deterministic_search_readiness',
    },
  },
};
const clearedStaleAdvisoryHandoff = buildPatientConversationGuidanceHandoff(
  clearedStaleAdvisoryEnvelope,
);
assert.equal(clearedStaleAdvisoryHandoff.safety_state, 'clear');
assert.equal(clearedStaleAdvisoryHandoff.planner_allowed, true);
assert.deepEqual(clearedStaleAdvisoryHandoff.semantic_proposal.possible_safety_flags, []);

const blockingEnvelope = {
  ...routineEnvelope,
  interpretation: interpretation({
    primary_intent: 'simptome_oftalmologice',
    care_path_candidates: ['emergency_interruption'],
    service_keys: ['emergency_ophthalmology'],
    urgency: {
      level: 'confirmed',
      needs_clarification: false,
      reason: 'Pierdere brusca sau marcata a vederii.',
    },
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'show_emergency_guidance',
  }),
  diagnostics: {
    advisory_safety_flags: ['chemical_injury'],
    decision_policy: {
      deterministic_safety_flags: ['sudden_vision_loss'],
      deterministic_safety_advisory_flags: [],
    },
  },
};
const blockingHandoff = buildPatientConversationGuidanceHandoff(blockingEnvelope);
assert.equal(blockingHandoff.status, 'safety_blocked');
assert.equal(blockingHandoff.safety_state, 'blocking');
assert.equal(blockingHandoff.planner_allowed, false);
assert.equal(blockingHandoff.semantic_proposal.next_question_key, null);
assert.deepEqual(blockingHandoff.semantic_proposal.candidate_service_keys, []);
assert.deepEqual(blockingHandoff.semantic_proposal.extracted_facts, []);
assert.deepEqual(blockingHandoff.semantic_proposal.candidate_care_paths, []);

const unavailableHandoff = buildPatientConversationGuidanceHandoff({
  mode: 'shadow',
  status: 'unavailable',
  reason: 'conversation_model_unavailable',
  interpretation: null,
});
assert.equal(unavailableHandoff.status, 'unavailable');
assert.equal(unavailableHandoff.safety_state, 'unchecked');
assert.equal(unavailableHandoff.planner_allowed, false);
assert.equal(unavailableHandoff.semantic_proposal.next_question_key, null);

assert.match(wrapperSource, /buildPatientConversationGuidanceHandoff/);
assert.match(wrapperSource, /patient_guidance_handoff/);
assert.doesNotMatch(wrapperSource, /runPatientGuidanceRuntimeShadow/);
assert.doesNotMatch(wrapperSource, /buildPatientGuidanceQuestionSelection/);
assert.doesNotMatch(wrapperSource, /next_question_key\s*:/);

console.log('Semantic conversation handoff to the sole patient-guidance planner verified.');
