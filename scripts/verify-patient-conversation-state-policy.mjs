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
    contract_version: 'viasee-patient-conversation-agent-v1',
    language: 'ro',
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
    understanding_confidence: 'medium',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['need', 'locality'],
    },
    next_action: 'ask_clarifying_question',
    assistant_message: 'Ce ai nevoie?',
    specialist_summary: null,
    evidence_phrases: [],
    ...overrides,
  };
}

function priorState(overrides = {}) {
  return {
    contract_version: 'viasee-patient-conversation-agent-v1',
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
    understanding_confidence: 'high',
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
    ...overrides,
  };
}

assert.equal(PATIENT_CONVERSATION_STATE_POLICY_VERSION, 'viasee-patient-conversation-state-policy-v1');
assert.equal(
  fs.readFileSync('shared/patientConversationStatePolicy.js', 'utf8'),
  fs.readFileSync('base44/shared/patientConversationStatePolicy.js', 'utf8'),
  'Shared and Base44 state policies must remain byte-identical.',
);

const recovered = reconcilePatientConversationState({
  interpretation: interpretation({
    facts: facts({ repair_details: 'balamaua este rupta' }),
    next_action: 'ask_locality',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['need', 'locality'],
    },
  }),
  priorState: priorState(),
  conversation: [
    { role: 'assistant', content: 'Ce anume s-a stricat?' },
    { role: 'user', content: 'balamaua' },
  ],
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

const intentSwitch = reconcilePatientConversationState({
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
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
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
  conversation: [
    { role: 'user', content: 'vreau sa imi fac ochelari' },
    { role: 'assistant', content: 'Ai deja reteta?' },
    { role: 'user', content: 'de fapt medicul mi-a dat trimitere pentru OCT, in Iasi' },
  ],
});
assert.equal(intentSwitch.interpretation.primary_intent, 'investigatii');
assert.deepEqual(intentSwitch.interpretation.service_keys, ['oct']);
assert.equal(intentSwitch.interpretation.facts.locality.city, 'Iasi');
assert.equal(intentSwitch.interpretation.facts.prescription_status, 'unknown');
assert.equal(intentSwitch.interpretation.facts.repair_details, '');
assert.equal(intentSwitch.diagnostics.transition, 'intent_replaced');
assert.equal(intentSwitch.diagnostics.intent_changed, true);
assert(intentSwitch.diagnostics.cleared_stale_fields.includes('prescription_status'));
assert(intentSwitch.diagnostics.cleared_stale_fields.includes('repair_details'));

const localityCleared = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts(),
    next_action: 'ask_locality',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['locality'],
    },
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
assert.equal(localityCleared.interpretation.facts.locality.city, '');
assert.equal(localityCleared.interpretation.next_action, 'ask_locality');
assert.equal(localityCleared.diagnostics.locality_correction_detected, true);
assert(localityCleared.diagnostics.cleared_stale_fields.includes('locality'));

const subjectCorrection = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['optometry_consultation'],
    facts: facts({ for_whom: 'adult' }),
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
assert.equal(subjectCorrection.interpretation.facts.age_group, 'unknown');
assert.equal(subjectCorrection.diagnostics.subject_correction_detected, true);
assert(subjectCorrection.diagnostics.cleared_stale_fields.includes('age_group'));

const symptomCorrection = reconcilePatientConversationState({
  interpretation: interpretation({
    primary_intent: 'simptome_oftalmologice',
    care_path_candidates: ['ophthalmology'],
    service_keys: ['ophthalmology_consultation'],
    facts: facts({ symptom_duration: 'cateva luni' }),
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
assert.equal(symptomCorrection.interpretation.facts.symptom_onset, '');
assert.equal(symptomCorrection.interpretation.facts.symptom_duration, 'cateva luni');
assert.equal(symptomCorrection.interpretation.facts.symptom_pattern, '');
assert.equal(symptomCorrection.diagnostics.symptom_correction_detected, true);
assert(symptomCorrection.diagnostics.cleared_stale_fields.includes('symptom_onset'));
assert(symptomCorrection.diagnostics.cleared_stale_fields.includes('symptom_pattern'));

const uncertainReplacement = reconcilePatientConversationState({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'de fapt vreau doar un control de vedere' }],
});
assert.equal(uncertainReplacement.interpretation.primary_intent, 'unknown');
assert.deepEqual(uncertainReplacement.interpretation.service_keys, []);
assert.equal(uncertainReplacement.diagnostics.intent_replacement_detected, true);
assert.equal(uncertainReplacement.diagnostics.recovered_prior_intent, false);

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

console.log('Patient conversation state reconciliation verified.');
