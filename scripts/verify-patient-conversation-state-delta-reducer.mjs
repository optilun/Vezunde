import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_STATE_DELTA_REDUCER_VERSION,
  reducePatientConversationSemanticStateDelta,
} from '../shared/patientConversationStateDeltaReducer.js';
import {
  reducePatientConversationSemanticStateDelta as reduceBase44PatientConversationSemanticStateDelta,
} from '../base44/shared/patientConversationStateDeltaReducer.js';

const sharedSource = fs.readFileSync('shared/patientConversationStateDeltaReducer.js', 'utf8');
const base44Source = fs.readFileSync('base44/shared/patientConversationStateDeltaReducer.js', 'utf8');
assert.equal(sharedSource, base44Source);
assert.equal(
  PATIENT_CONVERSATION_STATE_DELTA_REDUCER_VERSION,
  'viasee-patient-conversation-state-delta-reducer-v1',
);

function facts(overrides = {}) {
  return {
    for_whom: 'adult',
    age_group: 'adult',
    locality: { siruta_code: '', city: 'Timisoara', county_code: 'TM', county: 'Timis', area: '' },
    symptom_onset: '',
    symptom_duration: '',
    symptom_pattern: '',
    desired_timing: '',
    contact_lens_experience: 'unknown',
    prescription_status: 'has_prescription',
    investigation_reference_text: '',
    repair_details: '',
    user_constraints: [],
    ...overrides,
  };
}

function interpretation(overrides = {}) {
  return {
    need_summary: 'Control de vedere',
    primary_intent: 'control_vedere',
    alternative_intents: [],
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    provider_type_candidates: [],
    facts: facts(),
    urgency: { level: 'none' },
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
    ...overrides,
  };
}

function priorState(overrides = {}) {
  return {
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    provider_type_candidates: [],
    facts: facts(),
    ...overrides,
  };
}

const ignoredUnconfirmed = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'Timisoara' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['locality', 'prescription_status'],
  },
});
assert.equal(ignoredUnconfirmed.interpretation.facts.locality.city, 'Timisoara');
assert.equal(ignoredUnconfirmed.interpretation.facts.prescription_status, 'has_prescription');
assert.deepEqual(ignoredUnconfirmed.diagnostics.rejected_fields, [
  'locality',
  'prescription_status',
]);

const localityCleared = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'Nu mai caut in Timisoara, nu stiu orasul.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['locality'],
  },
});
assert.equal(localityCleared.interpretation.facts.locality.city, '');
assert.equal(localityCleared.interpretation.information_status.sufficient_for_search, false);
assert(localityCleared.interpretation.information_status.missing_critical_fields.includes('locality'));
assert.deepEqual(localityCleared.diagnostics.applied_fields, ['locality']);

const localityReplacementPreserved = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation({
    facts: facts({
      locality: { siruta_code: '', city: 'Lugoj', county_code: 'TM', county: 'Timis', area: '' },
    }),
  }),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'Am zis Timisoara dar sunt in Lugoj.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['locality'],
  },
});
assert.equal(localityReplacementPreserved.interpretation.facts.locality.city, 'Lugoj');
assert.deepEqual(localityReplacementPreserved.diagnostics.replacement_preserved_fields, ['locality']);

const intentReplacementPreserved = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation({
    primary_intent: 'investigatii',
    need_summary: 'OCT recomandat',
    care_path_candidates: ['specialized_ophthalmology'],
    service_keys: ['oct'],
    facts: facts({
      prescription_status: 'unknown',
      investigation_reference_text: 'OCT recomandat de medic',
    }),
  }),
  priorState: priorState({
    primary_intent: 'ochelari_lentile',
    care_path_candidates: ['optical_store'],
    service_keys: ['prescription_lenses'],
  }),
  conversation: [{ role: 'user', content: 'De fapt am nevoie de OCT.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['primary_intent', 'prescription_status'],
  },
});
assert.equal(intentReplacementPreserved.interpretation.primary_intent, 'investigatii');
assert.deepEqual(intentReplacementPreserved.interpretation.service_keys, ['oct']);
assert.equal(intentReplacementPreserved.interpretation.facts.prescription_status, 'unknown');
assert(intentReplacementPreserved.diagnostics.replacement_preserved_fields.includes('primary_intent'));
assert(intentReplacementPreserved.diagnostics.applied_fields.includes('prescription_status'));

const staleConstraintsCleared = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation({
    primary_intent: 'investigatii',
    care_path_candidates: ['specialized_ophthalmology'],
    service_keys: ['oct'],
    facts: facts({ user_constraints: ['doar sambata'] }),
  }),
  priorState: priorState({
    primary_intent: 'ochelari_lentile',
    facts: facts({ user_constraints: ['doar sambata'] }),
  }),
  conversation: [{ role: 'user', content: 'De fapt am nevoie de OCT.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['user_constraints'],
  },
});
assert.deepEqual(staleConstraintsCleared.interpretation.facts.user_constraints, []);
assert.deepEqual(staleConstraintsCleared.diagnostics.applied_fields, ['user_constraints']);

const constraintsClearRejectedWithoutIntentReplacement = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation({
    facts: facts({ user_constraints: ['doar sambata'] }),
  }),
  priorState: priorState({
    facts: facts({ user_constraints: ['doar sambata'] }),
  }),
  conversation: [{ role: 'user', content: 'Timisoara' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['user_constraints'],
  },
});
assert.deepEqual(
  constraintsClearRejectedWithoutIntentReplacement.interpretation.facts.user_constraints,
  ['doar sambata'],
);
assert.deepEqual(
  constraintsClearRejectedWithoutIntentReplacement.diagnostics.rejected_fields,
  ['user_constraints'],
);

const staleIntentCleared = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation({
    primary_intent: 'ochelari_lentile',
    care_path_candidates: ['optical_store'],
    service_keys: ['prescription_lenses'],
  }),
  priorState: priorState({
    primary_intent: 'ochelari_lentile',
    care_path_candidates: ['optical_store'],
    service_keys: ['prescription_lenses'],
  }),
  conversation: [{ role: 'user', content: 'De fapt vreau altceva.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['primary_intent'],
  },
});
assert.equal(staleIntentCleared.interpretation.primary_intent, 'unknown');
assert.deepEqual(staleIntentCleared.interpretation.service_keys, []);
assert.equal(staleIntentCleared.interpretation.next_action, 'ask_clarifying_question');
assert(staleIntentCleared.interpretation.information_status.missing_critical_fields.includes('need'));

const sharedResult = reducePatientConversationSemanticStateDelta({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'Nu mai caut in Timisoara.' }],
  semanticStateDelta: { correction_detected: true, clear_fields: ['locality'] },
});
const base44Result = reduceBase44PatientConversationSemanticStateDelta({
  interpretation: interpretation(),
  priorState: priorState(),
  conversation: [{ role: 'user', content: 'Nu mai caut in Timisoara.' }],
  semanticStateDelta: { correction_detected: true, clear_fields: ['locality'] },
});
assert.deepEqual(base44Result, sharedResult);

console.log('Validated semantic state delta reduction verified.');
