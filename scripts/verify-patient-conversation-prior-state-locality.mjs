import assert from 'node:assert/strict';
import {
  reconcilePatientConversationState,
} from '../shared/patientConversationStatePolicy.js';
import {
  reconcilePatientConversationState as reconcileBase44PatientConversationState,
} from '../base44/shared/patientConversationStatePolicy.js';

function facts(locality) {
  return {
    for_whom: 'unknown',
    age_group: 'unknown',
    locality,
    symptom_onset: '',
    symptom_duration: '',
    symptom_pattern: '',
    desired_timing: '',
    contact_lens_experience: 'unknown',
    prescription_status: 'unknown',
    investigation_reference_text: '',
    repair_details: 'rama este slabita',
    user_constraints: [],
  };
}

function interpretation() {
  return {
    need_summary: '',
    primary_intent: 'unknown',
    alternative_intents: [],
    care_path_candidates: [],
    service_keys: [],
    provider_type_candidates: [],
    facts: facts({
      siruta_code: '',
      city: '',
      county_code: '',
      county: '',
      area: '',
    }),
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
  };
}

function priorState(locality) {
  return {
    need_summary: 'Reparatie ochelari',
    primary_intent: 'reparatii_ochelari',
    alternative_intents: [],
    care_path_candidates: ['emergency_interruption', 'invented_path'],
    service_keys: ['eyeglasses_repair', 'invented_service'],
    provider_type_candidates: ['invented_provider'],
    facts: facts(locality),
    urgency: {
      level: 'confirmed',
      needs_clarification: false,
      reason: 'injected',
    },
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'show_emergency_guidance',
  };
}

function reconcile(policy, locality) {
  return policy({
    interpretation: interpretation(),
    priorState: priorState(locality),
    conversation: [{ role: 'user', content: 'balamaua' }],
  });
}

const poisoned = reconcile(reconcilePatientConversationState, {
  siruta_code: '0',
  city: '+40 (722) 123 456',
  county_code: 'ZZ',
  county: 'model@example.com',
  area: '0722 123 456',
});
assert.deepEqual(poisoned.interpretation.facts.locality, {
  siruta_code: '',
  city: '',
  county_code: '',
  county: '',
  area: '',
});
assert(poisoned.interpretation.information_status.missing_critical_fields.includes('locality'));
assert.deepEqual(poisoned.interpretation.service_keys, ['eyeglasses_repair']);
assert(!poisoned.interpretation.care_path_candidates.includes('emergency_interruption'));
assert(!poisoned.interpretation.care_path_candidates.includes('invented_path'));
assert.deepEqual(poisoned.interpretation.provider_type_candidates, []);
assert.equal(poisoned.interpretation.urgency.level, 'none');
assert.notEqual(poisoned.interpretation.next_action, 'show_emergency_guidance');

const valid = reconcile(reconcilePatientConversationState, {
  siruta_code: '155243',
  city: 'Timisoara',
  county_code: 'tm',
  county: 'Timis',
  area: 'Centru',
});
assert.deepEqual(valid.interpretation.facts.locality, {
  siruta_code: '155243',
  city: 'Timisoara',
  county_code: 'TM',
  county: 'Timis',
  area: 'Centru',
});
assert.equal(valid.interpretation.information_status.sufficient_for_search, true);

const base44Poisoned = reconcile(reconcileBase44PatientConversationState, {
  siruta_code: '0',
  city: '+40 (722) 123 456',
  county_code: 'ZZ',
  county: 'model@example.com',
  area: '0722 123 456',
});
assert.deepEqual(base44Poisoned, poisoned);

console.log('Patient conversation prior-state locality authority verified.');
