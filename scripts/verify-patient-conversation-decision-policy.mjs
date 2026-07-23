import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
  PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE,
  applyPatientConversationDecisionPolicy,
  assessPatientConversationDeterministicSafety,
  buildPatientConversationEmergencyInterpretation,
} from '../shared/patientConversationDecisionPolicy.js';
import {
  applyPatientConversationDecisionPolicy as applyBase44PatientConversationDecisionPolicy,
} from '../base44/shared/patientConversationDecisionPolicy.js';
import { getCanonicalServiceDefinition } from '../shared/canonicalServiceRegistryExtended.js';

const sharedSource = fs.readFileSync('shared/patientConversationDecisionPolicy.js', 'utf8');
const base44Source = fs.readFileSync('base44/shared/patientConversationDecisionPolicy.js', 'utf8');
const runtimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);

assert.equal(
  PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
  'viasee-patient-conversation-decision-policy-v1',
);
assert.equal(
  base44Source,
  sharedSource,
  'Shared and Base44 decision policies must remain byte-identical.',
);

function facts(overrides = {}) {
  return {
    for_whom: 'adult',
    age_group: 'adult',
    locality: {
      siruta_code: '155252',
      city: 'Timisoara',
      county_code: 'TM',
      county: 'Timis',
      area: '',
    },
    symptom_onset: '',
    symptom_duration: '',
    symptom_pattern: '',
    desired_timing: '',
    contact_lens_experience: 'unknown',
    prescription_status: 'unknown',
    investigation_reference_text: '',
    repair_details: '',
    user_constraints: [],
    ...overrides,
  };
}

function interpretation(overrides = {}) {
  return {
    contract_version: 'viasee-patient-conversation-agent-v1',
    language: 'ro',
    need_summary: 'Control de vedere',
    primary_intent: 'control_vedere',
    alternative_intents: [],
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    provider_type_candidates: ['ophthalmology_clinic'],
    facts: facts(),
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    understanding_confidence: 'high',
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: true,
      missing_critical_fields: [],
    },
    next_action: 'prepare_specialist_message',
    assistant_message: 'Mesaj liber generat de model.',
    specialist_summary: 'Rezumat liber generat de model.',
    evidence_phrases: [],
    ...overrides,
  };
}

const explicitEmergencyConversation = [
  { role: 'user', content: 'Nu mai vad cu un ochi deodata.' },
];
const explicitSafety = assessPatientConversationDeterministicSafety(explicitEmergencyConversation);
assert.equal(explicitSafety.blocking, true);
assert(explicitSafety.blocking_flags.includes('sudden_vision_loss'));

const emergencyPreflight = buildPatientConversationEmergencyInterpretation({
  contractVersion: 'viasee-patient-conversation-agent-v1',
  conversation: explicitEmergencyConversation,
  runtimeContext: {
    known_locality: {
      siruta_code: '155252',
      city: 'Timisoara',
      county_code: 'TM',
      county: 'Timis',
      area: '',
    },
  },
});
assert(emergencyPreflight);
assert.equal(emergencyPreflight.interpretation.urgency.level, 'confirmed');
assert.equal(emergencyPreflight.interpretation.next_action, 'show_emergency_guidance');
assert.equal(
  emergencyPreflight.interpretation.assistant_message,
  PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE,
);
assert.equal(emergencyPreflight.interpretation.information_status.sufficient_for_search, false);
assert.equal(emergencyPreflight.diagnostics.model_invoked, false);
assert.equal(emergencyPreflight.diagnostics.decision_source, 'deterministic_safety_preflight');

const emergencySurvivesShortFollowup = assessPatientConversationDeterministicSafety([
  { role: 'user', content: 'Vederea a disparut brusc.' },
  { role: 'assistant', content: 'In ce oras esti?' },
  { role: 'user', content: 'Brasov.' },
]);
assert.equal(emergencySurvivesShortFollowup.blocking, true);
assert(emergencySurvivesShortFollowup.blocking_flags.includes('sudden_vision_loss'));

const correctedSafety = assessPatientConversationDeterministicSafety([
  { role: 'user', content: 'Vederea a disparut brusc.' },
  { role: 'assistant', content: 'A aparut chiar astazi?' },
  { role: 'user', content: 'Nu e brusc, vad mai slab de cateva luni.' },
]);
assert.equal(correctedSafety.blocking, false);
assert(correctedSafety.cleared_flags.includes('sudden_vision_loss'));

const falseNegativeModel = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: { level: 'none', needs_clarification: false, reason: '' },
    next_action: 'search_providers',
  }),
  conversation: explicitEmergencyConversation,
  runtimeContext: {},
});
assert.equal(falseNegativeModel.interpretation.urgency.level, 'confirmed');
assert.equal(falseNegativeModel.interpretation.next_action, 'show_emergency_guidance');
assert.equal(falseNegativeModel.interpretation.information_status.sufficient_for_search, false);
assert.equal(falseNegativeModel.diagnostics.model_urgency_overridden, true);
assert(falseNegativeModel.diagnostics.deterministic_safety_flags.includes('sudden_vision_loss'));

const unsupportedModelEmergency = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: {
      level: 'confirmed',
      needs_clarification: false,
      reason: 'Modelul considera urgent.',
    },
    next_action: 'show_emergency_guidance',
  }),
  conversation: [{ role: 'user', content: 'Vad mai slab de cateva luni.' }],
  runtimeContext: {},
});
assert.equal(unsupportedModelEmergency.interpretation.urgency.level, 'possible');
assert.equal(unsupportedModelEmergency.interpretation.next_action, 'ask_clarifying_question');
assert.equal(unsupportedModelEmergency.interpretation.information_status.sufficient_for_search, false);
assert.equal(unsupportedModelEmergency.diagnostics.model_urgency_advisory, 'confirmed');
assert.equal(unsupportedModelEmergency.diagnostics.model_urgency_overridden, true);

const completeRoutine = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    next_action: 'prepare_specialist_message',
    assistant_message: 'Alege clinica X.',
    specialist_summary: 'Text care nu trebuie expus.',
  }),
  conversation: [{ role: 'user', content: 'Vreau sa verific dioptriile in Timisoara.' }],
  runtimeContext: {},
});
assert.equal(completeRoutine.interpretation.urgency.level, 'none');
assert.equal(completeRoutine.interpretation.next_action, 'search_providers');
assert.equal(completeRoutine.interpretation.information_status.sufficient_for_search, true);
assert.equal(completeRoutine.interpretation.information_status.sufficient_for_specialist_message, false);
assert.equal(completeRoutine.interpretation.specialist_summary, null);
assert.notEqual(completeRoutine.interpretation.assistant_message, 'Alege clinica X.');
assert.equal(completeRoutine.diagnostics.model_next_action_ignored, true);

const expectedProfileTypes = [...new Set(
  getCanonicalServiceDefinition('refraction')?.applicable_profile_types || [],
)].filter((profileType) => [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
].includes(profileType)).slice(0, 8);
assert.deepEqual(
  completeRoutine.interpretation.provider_type_candidates,
  expectedProfileTypes,
);
assert.equal(
  completeRoutine.interpretation.provider_type_candidates.includes('future_b2b_distributor'),
  false,
);

const missingLocality = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    facts: facts({
      locality: { siruta_code: '', city: '', county_code: '', county: '', area: '' },
    }),
    next_action: 'search_providers',
  }),
  conversation: [{ role: 'user', content: 'Vreau sa verific dioptriile.' }],
  runtimeContext: {},
});
assert.equal(missingLocality.interpretation.next_action, 'ask_locality');
assert.equal(missingLocality.interpretation.information_status.sufficient_for_search, false);
assert(missingLocality.interpretation.information_status.missing_critical_fields.includes('locality'));

const clearedLocality = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    facts: facts({
      locality: { siruta_code: '', city: '', county_code: '', county: '', area: '' },
    }),
  }),
  conversation: [{ role: 'user', content: 'Nu mai caut in Timisoara.' }],
  runtimeContext: {
    known_locality: {
      siruta_code: '155252',
      city: 'Timisoara',
      county_code: 'TM',
      county: 'Timis',
      area: '',
    },
  },
  stateDiagnostics: {
    locality_correction_detected: true,
    cleared_stale_fields: ['locality'],
  },
});
assert.equal(clearedLocality.interpretation.facts.locality.city, '');
assert.equal(clearedLocality.interpretation.next_action, 'ask_locality');
assert.equal(clearedLocality.diagnostics.locality_correction_respected, true);

const sharedResult = applyPatientConversationDecisionPolicy({
  interpretation: interpretation(),
  conversation: [{ role: 'user', content: 'Vreau un control in Timisoara.' }],
  runtimeContext: {},
});
const base44Result = applyBase44PatientConversationDecisionPolicy({
  interpretation: interpretation(),
  conversation: [{ role: 'user', content: 'Vreau un control in Timisoara.' }],
  runtimeContext: {},
});
assert.deepEqual(base44Result, sharedResult);

assert(
  runtimeSource.includes("from '../../shared/patientConversationDecisionPolicy.js';"),
  'Runtime must import the deterministic decision policy.',
);
const preflightIndex = runtimeSource.indexOf(
  'const preflightDecision = deterministicSafetyPreflight(conversation, runtimeContext);',
);
const modelCallIndex = runtimeSource.indexOf('base44.integrations.Core.InvokeLLM({');
assert(preflightIndex >= 0 && modelCallIndex > preflightIndex);
assert(
  runtimeSource.includes('{ modelInvoked: false }'),
  'Deterministic preflight must truthfully record that the model was not invoked.',
);
const statePolicyIndex = runtimeSource.indexOf(
  'const stateEnvelope = applyConversationStatePolicy(builtEnvelope, priorState, conversation);',
);
const decisionPolicyIndex = runtimeSource.indexOf(
  'const deterministicEnvelope = applyDeterministicDecisionPolicy(',
);
assert(statePolicyIndex >= 0 && decisionPolicyIndex > statePolicyIndex);
assert(
  runtimeSource.includes('decision_policy: decision.diagnostics'),
  'Runtime must retain decision policy diagnostics.',
);

console.log('Deterministic authority over patient conversation safety and decisions verified.');
