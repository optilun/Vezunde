import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
  PATIENT_CONVERSATION_SAFETY_POLICY_VERSION,
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
const sharedCoreSource = fs.readFileSync('shared/patientConversationDecisionPolicyCore.js', 'utf8');
const base44CoreSource = fs.readFileSync('base44/shared/patientConversationDecisionPolicyCore.js', 'utf8');
const sharedSafetySource = fs.readFileSync('shared/patientEyeSafetyPolicy.js', 'utf8');
const base44SafetySource = fs.readFileSync('base44/shared/patientEyeSafetyPolicy.js', 'utf8');
const runtimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);

assert.equal(
  PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
  'viasee-patient-conversation-decision-policy-v1',
);
assert.equal(
  PATIENT_CONVERSATION_SAFETY_POLICY_VERSION,
  'patient-eye-safety-v1.2',
);
assert.equal(
  base44Source,
  sharedSource,
  'Shared and Base44 decision policies must remain byte-identical.',
);
assert.equal(
  base44CoreSource,
  sharedCoreSource,
  'Shared and Base44 decision policy cores must remain byte-identical.',
);
assert.equal(
  base44SafetySource,
  sharedSafetySource,
  'Shared and Base44 eye safety policies must remain byte-identical.',
);
assert.match(sharedCoreSource, /guidedSafetyCleared/);
assert.match(sharedCoreSource, /deterministic_safety_guided_clear/);
assert.match(sharedCoreSource, /model_safety_flags_ignored: true/);
assert(!sharedCoreSource.includes('aiFlags: interpretation?.possible_safety_flags'));

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

const ambiguousOneEye = assessPatientConversationDeterministicSafety([
  { role: 'user', content: 'Nu mai vad cu un ochi.' },
]);
assert.equal(ambiguousOneEye.state, 'advisory');
assert.equal(ambiguousOneEye.blocking, false);
assert.equal(ambiguousOneEye.advisory, true);
assert.deepEqual(ambiguousOneEye.blocking_flags, []);
assert.deepEqual(ambiguousOneEye.advisory_flags, ['sudden_vision_loss']);

const controlledClearSafety = assessPatientConversationDeterministicSafety(
  [{ role: 'user', content: 'Nu mai vad cu un ochi.' }],
  [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
);
assert.equal(controlledClearSafety.state, 'clear');
assert.equal(controlledClearSafety.source, 'guided_clear');
assert.deepEqual(controlledClearSafety.advisory_flags, []);

const explicitEmergencyConversation = [
  { role: 'user', content: 'Nu mai vad cu un ochi deodata.' },
];
const explicitSafety = assessPatientConversationDeterministicSafety(explicitEmergencyConversation);
assert.equal(explicitSafety.state, 'blocking');
assert.equal(explicitSafety.blocking, true);
assert(explicitSafety.blocking_flags.includes('sudden_vision_loss'));
assert.equal(explicitSafety.policy_version, PATIENT_CONVERSATION_SAFETY_POLICY_VERSION);

const explicitSafetyWithControlledClear = assessPatientConversationDeterministicSafety(
  explicitEmergencyConversation,
  [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
);
assert.equal(explicitSafetyWithControlledClear.state, 'blocking');
assert.equal(explicitSafetyWithControlledClear.source, 'explicit_text');

const confirmedSafetyScenarios = [
  ['a disparut brusc azi dimineata, aproape complet', 'sudden_vision_loss'],
  ['Mi-a disparut brusc vederea aproape complet azi.', 'sudden_vision_loss'],
  ['mi-a sarit spray de curatat cuptorul in ochi', 'chemical_injury'],
  ['mi-a sarit o aschie de metal si a ramas infipta in ochi', 'penetrating_or_high_speed_trauma'],
  ['m-a lovit ceva tare in ochi si acum aproape nu mai vad deloc', 'sudden_vision_loss'],
  ['dupa operatia de ieri ochiul e rosu, ma doare si vad mai prost', 'postoperative_red_eye_or_vision_change'],
  ['de azi vad fulgere si o perdea neagra intr-o parte', 'other_possible_urgent_eye_problem'],
];
for (const [content, expectedFlag] of confirmedSafetyScenarios) {
  const assessment = assessPatientConversationDeterministicSafety([
    { role: 'user', content },
  ]);
  assert.equal(assessment.blocking, true, content);
  assert(assessment.blocking_flags.includes(expectedFlag), `${content}: ${expectedFlag}`);
}

for (const content of [
  'mi-a intrat sampon in ochi, am clatit si inca ma ustura putin',
  'm-am lovit la ochi cu mingea si vad cam in ceata',
]) {
  const assessment = assessPatientConversationDeterministicSafety([
    { role: 'user', content },
  ]);
  assert.equal(assessment.blocking, false, content);
}

const stableMonocular = assessPatientConversationDeterministicSafety([
  { role: 'user', content: 'Vad mai slab cu ochiul drept, dar problema exista de cateva luni si nu este brusca.' },
]);
assert.equal(stableMonocular.state, 'clear');
assert(stableMonocular.cleared_flags.includes('sudden_vision_loss'));

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
assert.equal(emergencyPreflight.diagnostics.deterministic_safety_state, 'blocking');
assert.equal(emergencyPreflight.diagnostics.decision_source, 'deterministic_safety_preflight');
assert.equal(
  emergencyPreflight.diagnostics.safety_policy_version,
  PATIENT_CONVERSATION_SAFETY_POLICY_VERSION,
);
assert.equal(emergencyPreflight.diagnostics.model_safety_flags_ignored, true);

const guidedEmergencyPreflight = buildPatientConversationEmergencyInterpretation({
  contractVersion: 'viasee-patient-conversation-agent-v1',
  conversation: [{ role: 'user', content: 'Am o problema la ochi.' }],
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'durere_severa' }],
  runtimeContext: {},
});
assert(guidedEmergencyPreflight);
assert.equal(guidedEmergencyPreflight.interpretation.urgency.level, 'confirmed');
assert.equal(guidedEmergencyPreflight.diagnostics.deterministic_safety_preflight, true);
assert(guidedEmergencyPreflight.diagnostics.deterministic_safety_flags.includes('severe_eye_pain'));

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
assert.equal(correctedSafety.state, 'clear');
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

const ambiguousModelMiss = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: { level: 'none', needs_clarification: false, reason: '' },
    next_action: 'search_providers',
  }),
  conversation: [{ role: 'user', content: 'Nu vad cu ochiul drept.' }],
  runtimeContext: {},
});
assert.equal(ambiguousModelMiss.interpretation.urgency.level, 'possible');
assert.equal(ambiguousModelMiss.interpretation.next_action, 'ask_clarifying_question');
assert.equal(ambiguousModelMiss.interpretation.information_status.sufficient_for_search, false);
assert(ambiguousModelMiss.interpretation.information_status.missing_critical_fields.includes('symptom_severity'));
assert.equal(ambiguousModelMiss.diagnostics.deterministic_safety_state, 'advisory');

const controlledClearOverridesModelAdvisory = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: { level: 'possible', needs_clarification: true, reason: 'Model advisory.' },
    possible_safety_flags: ['sudden_vision_loss'],
    next_action: 'ask_clarifying_question',
  }),
  conversation: [{ role: 'user', content: 'Nu vad cu ochiul drept.' }],
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
  runtimeContext: {},
});
assert.equal(controlledClearOverridesModelAdvisory.interpretation.urgency.level, 'none');
assert.equal(controlledClearOverridesModelAdvisory.interpretation.next_action, 'search_providers');
assert.equal(controlledClearOverridesModelAdvisory.interpretation.information_status.sufficient_for_search, true);
assert.deepEqual(controlledClearOverridesModelAdvisory.diagnostics.deterministic_safety_advisory_flags, []);
assert.equal(controlledClearOverridesModelAdvisory.diagnostics.deterministic_safety_guided_clear, true);
assert.equal(controlledClearOverridesModelAdvisory.diagnostics.model_urgency_overridden, true);
assert.equal(controlledClearOverridesModelAdvisory.diagnostics.model_safety_flag_count, 1);
assert.equal(controlledClearOverridesModelAdvisory.diagnostics.model_safety_flags_ignored, true);

const controlledClearCannotOverrideDecisionBlocking = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: { level: 'none', needs_clarification: false, reason: '' },
    next_action: 'search_providers',
  }),
  conversation: explicitEmergencyConversation,
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
  runtimeContext: {},
});
assert.equal(controlledClearCannotOverrideDecisionBlocking.interpretation.urgency.level, 'confirmed');
assert.equal(controlledClearCannotOverrideDecisionBlocking.interpretation.next_action, 'show_emergency_guidance');
assert.equal(controlledClearCannotOverrideDecisionBlocking.diagnostics.deterministic_safety_guided_clear, false);

const unsupportedModelEmergency = applyPatientConversationDecisionPolicy({
  interpretation: interpretation({
    urgency: {
      level: 'confirmed',
      needs_clarification: false,
      reason: 'Modelul considera urgent.',
    },
    possible_safety_flags: ['sudden_vision_loss'],
    next_action: 'show_emergency_guidance',
  }),
  conversation: [{ role: 'user', content: 'Vad mai slab de cateva luni.' }],
  runtimeContext: {},
});
assert.equal(unsupportedModelEmergency.interpretation.urgency.level, 'none');
assert.equal(unsupportedModelEmergency.interpretation.next_action, 'search_providers');
assert.equal(unsupportedModelEmergency.interpretation.information_status.sufficient_for_search, true);
assert.equal(unsupportedModelEmergency.diagnostics.model_urgency_advisory, 'confirmed');
assert.equal(unsupportedModelEmergency.diagnostics.model_urgency_overridden, true);
assert.equal(unsupportedModelEmergency.diagnostics.model_safety_flag_count, 1);
assert.equal(unsupportedModelEmergency.diagnostics.model_safety_flags_ignored, true);
assert.equal(unsupportedModelEmergency.diagnostics.deterministic_safety_state, 'clear');

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

console.log('Exclusive deterministic authority over patient conversation safety and decisions verified.');
