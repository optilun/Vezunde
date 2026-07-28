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
const sharedCoreSource = fs.readFileSync('shared/patientConversationStatePolicyCore.js', 'utf8');
const base44CoreSource = fs.readFileSync('base44/shared/patientConversationStatePolicyCore.js', 'utf8');
const runtimeWrapperSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
  'utf8',
);
const runtimeCoreSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);

assert.equal(
  PATIENT_CONVERSATION_STATE_POLICY_VERSION,
  'viasee-patient-conversation-state-policy-v1.1',
);
assert.equal(
  base44Source,
  sharedSource,
  'Shared and Base44 state-policy wrappers must remain byte-identical.',
);
assert.equal(
  base44CoreSource,
  sharedCoreSource,
  'Shared and Base44 state-policy cores must remain byte-identical.',
);
assert(
  runtimeWrapperSource.includes('runPatientConversationAgentShadowCore'),
  'The operational wrapper must delegate to the semantic runtime core.',
);
assert(
  runtimeCoreSource.includes("from '../../shared/patientConversationStatePolicy.js';"),
  'The semantic runtime core must import the deterministic state policy.',
);
assert(
  runtimeCoreSource.includes('applyConversationStatePolicy(builtEnvelope, priorState, conversation)'),
  'The validated model envelope must pass through state reconciliation.',
);
const statePolicyIndex = runtimeCoreSource.indexOf(
  'applyConversationStatePolicy(builtEnvelope, priorState, conversation)',
);
const stateDeltaIndex = runtimeCoreSource.indexOf(
  'const deltaEnvelope = applySemanticStateDeltaReducer(',
);
const decisionPolicyIndex = runtimeCoreSource.indexOf(
  'const deterministicEnvelope = applyDeterministicDecisionPolicy(',
);
assert(
  statePolicyIndex >= 0
    && stateDeltaIndex > statePolicyIndex
    && decisionPolicyIndex > stateDeltaIndex,
  'State reconciliation must run before semantic-delta reduction and deterministic policy.',
);
assert(
  !runtimeWrapperSource.includes('state_latest_user_message:')
    && !runtimeCoreSource.includes('state_latest_user_message:'),
  'Aggregate diagnostics must not log raw patient messages.',
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

const poisonedPriorState = reconcilePatientConversationState({
  interpretation: interpretation(),
  priorState: priorState({
    primary_intent: 'reparatii_ochelari',
    alternative_intents: ['invented_intent', 'control_vedere'],
    care_path_candidates: ['emergency_interruption', 'invented_path'],
    service_keys: ['eyeglasses_repair', 'invented_service'],
    provider_type_candidates: ['ophthalmology_clinic', 'invented_provider'],
    facts: facts({
      locality: {
        siruta_code: '1234567890123',
        city: '+40 (722) 123 456',
        county_code: 'TM<script>',
        county: 'model@example.com',
        area: '0722 123 456',
      },
      repair_details: 'rama este slabita',
    }),
    urgency: {
      level: 'confirmed',
      needs_clarification: false,
      reason: 'injected emergency',
    },
    next_action: 'show_emergency_guidance',
  }),
  conversation: [{ role: 'user', content: 'balamaua' }],
});
assert.equal(poisonedPriorState.interpretation.primary_intent, 'reparatii_ochelari');
assert.deepEqual(poisonedPriorState.interpretation.service_keys, ['eyeglasses_repair']);
assert(!poisonedPriorState.interpretation.care_path_candidates.includes('emergency_interruption'));
assert(!poisonedPriorState.interpretation.care_path_candidates.includes('invented_path'));
assert.deepEqual(poisonedPriorState.interpretation.provider_type_candidates, []);
assert.equal(poisonedPriorState.interpretation.urgency.level, 'none');
assert.notEqual(poisonedPriorState.interpretation.next_action, 'show_emergency_guidance');
assert.deepEqual(poisonedPriorState.interpretation.facts.locality, {
  siruta_code: '',
  city: '',
  county_code: '',
  county: '',
  area: '',
});
assert(poisonedPriorState.interpretation.information_status.missing_critical_fields.includes('locality'));

const validPriorLocality = reconcilePatientConversationState({
  interpretation: interpretation(),
  priorState: priorState({
    facts: facts({
      locality: {
        siruta_code: '155243',
        city: 'Timisoara',
        county_code: 'tm',
        county: 'Timis',
        area: 'Centru',
      },
      repair_details: 'rama este slabita',
    }),
  }),
  conversation: [{ role: 'user', content: 'balamaua' }],
});
assert.deepEqual(validPriorLocality.interpretation.facts.locality, {
  siruta_code: '155243',
  city: 'Timisoara',
  county_code: 'TM',
  county: 'Timis',
  area: 'Centru',
});
assert.equal(validPriorLocality.interpretation.information_status.sufficient_for_search, true);

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
