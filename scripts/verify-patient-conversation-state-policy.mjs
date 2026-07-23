import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_STATE_POLICY_VERSION,
  detectPatientConversationStateSignals,
  reconcilePatientConversationState,
} from '../shared/patientConversationStatePolicy.js';
import {
  reconcilePatientConversationState as reconcileBase44PatientConversationState,
} from '../base44/shared/patientConversationStatePolicy.js';

function facts(overrides = {}) {
  return {
    for_whom: 'unknown',
    age_group: 'unknown',
    locality: {
      siruta_code: '',
      city: '',
      county_code: '',
      county: '',
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
    need_summary: '',
    primary_intent: 'unknown',
    alternative_intents: [],
    care_path_candidates: [],
    service_keys: [],
    provider_type_candidates: [],
    facts: facts(),
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['need', 'locality'],
    },
    next_action: 'ask_clarifying_question',
    assistant_message: 'Ce ai nevoie?',
    specialist_summary: null,
    ...overrides,
  };
}

function priorState(overrides = {}) {
  return {
    need_summary: 'Reparatie ochelari',
    primary_intent: 'reparatii_ochelari',
    alternative_intents: [],
    care_path_candidates: ['technical_optical_service'],
    service_keys: ['eyeglasses_repair'],
    provider_type_candidates: ['independent_optical_store'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Brasov',
        county_code: 'BV',
        county: 'Brasov',
        area: '',
      },
      repair_details: 'rama este slabita',
    }),
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
    ...overrides,
  };
}

const sharedSource = fs.readFileSync('shared/patientConversationStatePolicy.js', 'utf8');
const base44Source = fs.readFileSync('base44/shared/patientConversationStatePolicy.js', 'utf8');
const runtimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
  'utf8',
);

assert.equal(
  PATIENT_CONVERSATION_STATE_POLICY_VERSION,
  'viasee-patient-conversation-state-policy-v1.1',
);
assert.equal(
  base44Source,
  sharedSource,
  'Shared and Base44 state policies must remain byte-identical.',
);
assert(
  runtimeSource.includes("from '../../shared/patientConversationStatePolicy.js';"),
  'The Base44 runtime must import the deterministic state policy.',
);
assert(
  runtimeSource.includes('applyConversationStatePolicy(builtEnvelope, priorState, conversation)'),
  'The validated model envelope must pass through state reconciliation.',
);
const statePolicyIndex = runtimeSource.indexOf(
  'applyConversationStatePolicy(builtEnvelope, priorState, conversation)',
);
const runtimePolicyIndex = runtimeSource.indexOf('applyRuntimePolicy(stateEnvelope, runtimeContext)');
assert(
  statePolicyIndex >= 0 && runtimePolicyIndex > statePolicyIndex,
  'Conversation state must be reconciled before deterministic search and safety policy.',
);
assert(
  !runtimeSource.includes('state_latest_user_message:'),
  'Aggregate state diagnostics must not log raw patient messages.',
);

const recovered = reconcilePatientConversationState({
  interpretation: interpretation({
    facts: facts({ repair_details: 'balamaua este rupta' }),
    next_action: 'ask_locality',
  }),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'balamaua' }],
});
assert.equal(recovered.interpretation.primary_intent, 'reparatii_ochelari');
assert.deepEqual(recovered.interpretation.service_keys, ['eyeglasses_repair']);
assert.equal(recovered.interpretation.facts.locality.city, 'Brasov');
assert.equal(recovered.interpretation.facts.repair_details, 'balamaua este rupta');
assert.equal(recovered.interpretation.next_action, 'search_providers');
assert.equal(recovered.interpretation.information_status.sufficient_for_search, true);
assert.equal(recovered.diagnostics.recovered_prior_intent, true);
assert.equal(recovered.diagnostics.search_readiness_recovered, true);
assert(recovered.diagnostics.carried_fields.includes('locality'));

const explicitIntentSwitch = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'investigatii',
    need_summary: 'OCT recomandat de medic',
    care_path_candidates: ['specialized_ophthalmology'],
    service_keys: ['oct'],
    provider_type_candidates: ['ophthalmology_clinic'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Iasi',
        county_code: 'IS',
        county: 'Iasi',
        area: '',
      },
      investigation_reference_text: 'trimitere pentru OCT',
    }),
    next_action: 'search_providers',
  }),
  priorState: priorState({
    primary_intent: 'ochelari_lentile',
    care_path_candidates: ['optical_store'],
    service_keys: ['prescription_lenses'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Timisoara',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
      prescription_status: 'has_prescription',
      repair_details: 'informatie veche',
    }),
  }),
  conversation: [{
    role: 'user',
    content: 'de fapt medicul mi-a dat trimitere pentru OCT, in Iasi',
  }],
});
assert.equal(explicitIntentSwitch.interpretation.primary_intent, 'investigatii');
assert.deepEqual(explicitIntentSwitch.interpretation.service_keys, ['oct']);
assert.equal(explicitIntentSwitch.interpretation.facts.locality.city, 'Iasi');
assert.equal(explicitIntentSwitch.interpretation.facts.prescription_status, 'unknown');
assert.equal(explicitIntentSwitch.interpretation.facts.repair_details, '');
assert.equal(explicitIntentSwitch.diagnostics.transition, 'intent_replaced');
assert.equal(explicitIntentSwitch.diagnostics.intent_changed, true);

const staleIntentCopiedByModel = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'reparatii_ochelari',
    need_summary: 'Reparatie ochelari',
    care_path_candidates: ['technical_optical_service'],
    service_keys: ['eyeglasses_repair'],
    provider_type_candidates: ['independent_optical_store'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Brasov',
        county_code: 'BV',
        county: 'Brasov',
        area: '',
      },
      repair_details: 'rama este slabita',
    }),
  }),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'de fapt vreau doar un control de vedere' }],
});
assert.equal(staleIntentCopiedByModel.interpretation.primary_intent, 'unknown');
assert.deepEqual(staleIntentCopiedByModel.interpretation.service_keys, []);
assert.deepEqual(staleIntentCopiedByModel.interpretation.care_path_candidates, []);
assert.equal(staleIntentCopiedByModel.interpretation.next_action, 'ask_clarifying_question');
assert.equal(staleIntentCopiedByModel.diagnostics.stale_intent_rejected, true);
assert.equal(staleIntentCopiedByModel.diagnostics.transition, 'intent_replacement_unresolved');

const staleLocalityCopiedByModel = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Timisoara',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
    }),
  }),
  priorState: priorState({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Timisoara',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
    }),
  }),
  conversation: [{ role: 'user', content: 'nu mai caut in Timisoara, nu stiu inca orasul' }],
});
assert.equal(staleLocalityCopiedByModel.interpretation.facts.locality.city, '');
assert(staleLocalityCopiedByModel.diagnostics.cleared_stale_fields.includes('locality'));
assert(staleLocalityCopiedByModel.interpretation.information_status.missing_critical_fields.includes('locality'));

const replacedLocality = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Lugoj',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
    }),
  }),
  priorState: priorState({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts({
      locality: {
        siruta_code: '',
        city: 'Timisoara',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
    }),
  }),
  conversation: [{ role: 'user', content: 'am zis Timisoara dar sunt in Lugoj' }],
});
assert.equal(replacedLocality.interpretation.primary_intent, 'control_vedere');
assert.equal(replacedLocality.interpretation.facts.locality.city, 'Lugoj');
assert.equal(replacedLocality.diagnostics.intent_replacement_detected, false);
assert(replacedLocality.diagnostics.overwritten_fields.includes('locality'));

const subjectCorrection = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['optometry_consultation'],
    facts: facts({ for_whom: 'child', age_group: '7_12_ani' }),
  }),
  priorState: priorState({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['optometry_consultation'],
    facts: facts({ for_whom: 'child', age_group: '7_12_ani' }),
  }),
  conversation: [{ role: 'user', content: 'e pentru mama, nu pentru copil' }],
});
assert.equal(subjectCorrection.interpretation.facts.for_whom, 'adult');
assert.equal(subjectCorrection.interpretation.facts.age_group, 'adult');
assert.equal(subjectCorrection.diagnostics.subject_target_hint, 'adult');

const staleSymptomsCopiedByModel = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'simptome_oftalmologice',
    care_path_candidates: ['ophthalmology'],
    service_keys: ['ophthalmology_consultation'],
    facts: facts({
      symptom_onset: 'azi, brusc',
      symptom_duration: 'cateva luni',
      symptom_pattern: 'scadere brusca',
    }),
  }),
  priorState: priorState({
    primary_intent: 'simptome_oftalmologice',
    care_path_candidates: ['ophthalmology'],
    service_keys: ['ophthalmology_consultation'],
    facts: facts({
      symptom_onset: 'azi, brusc',
      symptom_duration: 'de azi',
      symptom_pattern: 'scadere brusca',
    }),
  }),
  conversation: [{ role: 'user', content: 'nu e brusc, e de cateva luni' }],
});
assert.equal(staleSymptomsCopiedByModel.interpretation.facts.symptom_onset, '');
assert.equal(staleSymptomsCopiedByModel.interpretation.facts.symptom_pattern, '');
assert.equal(staleSymptomsCopiedByModel.interpretation.facts.symptom_duration, 'cateva luni');
assert(staleSymptomsCopiedByModel.diagnostics.cleared_stale_fields.includes('symptom_onset'));
assert(staleSymptomsCopiedByModel.diagnostics.cleared_stale_fields.includes('symptom_pattern'));

const sharedResult = reconcilePatientConversationState({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'balamaua' }],
});
const base44Result = reconcileBase44PatientConversationState({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'balamaua' }],
});
assert.deepEqual(base44Result, sharedResult);

const signals = detectPatientConversationStateSignals([
  { role: 'user', content: 'am zis Timisoara dar sunt in Lugoj' },
]);
assert.equal(signals.generic_correction_detected, true);
assert.equal(signals.locality_correction_detected, true);
assert.equal(signals.intent_replacement_detected, false);

console.log('Patient conversation fail-closed state reconciliation verified.');
