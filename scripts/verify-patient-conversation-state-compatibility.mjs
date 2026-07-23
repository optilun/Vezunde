import assert from 'node:assert/strict';
import {
  reconcilePatientConversationState,
} from '../shared/patientConversationStatePolicy.js';

function facts(overrides = {}) {
  return {
    for_whom: 'unknown',
    age_group: 'unknown',
    locality: { siruta_code: '', city: '', county_code: '', county: '', area: '' },
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
    urgency: { level: 'none', needs_clarification: false, reason: '' },
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
    assistant_message: '',
    specialist_summary: null,
    ...overrides,
  };
}

function priorState(overrides = {}) {
  return {
    primary_intent: 'reparatii_ochelari',
    care_path_candidates: ['technical_optical_service'],
    service_keys: ['eyeglasses_repair'],
    provider_type_candidates: ['independent_optical_store'],
    facts: facts({
      locality: { siruta_code: '', city: 'Iasi', county_code: 'IS', county: 'Iasi', area: '' },
      repair_details: 'rama este indoita',
    }),
    ...overrides,
  };
}

const repairToInvestigation = reconcilePatientConversationState({
  priorState: priorState(),
  conversation: [{
    role: 'user',
    content: 'de fapt am nevoie de OCT, medicul a spus sa fac investigatia',
  }],
  interpretation: interpretation({
    primary_intent: 'investigatii',
    care_path_candidates: ['specialized_ophthalmology'],
    service_keys: ['oct'],
    provider_type_candidates: ['ophthalmology_clinic'],
    facts: facts({
      locality: { siruta_code: '', city: 'Iasi', county_code: 'IS', county: 'Iasi', area: '' },
      investigation_reference_text: 'medicul a recomandat OCT',
      repair_details: 'balamaua trebuie schimbata',
      prescription_status: 'has_prescription',
    }),
  }),
});
assert.equal(repairToInvestigation.interpretation.primary_intent, 'investigatii');
assert.equal(repairToInvestigation.interpretation.facts.investigation_reference_text, 'medicul a recomandat OCT');
assert.equal(repairToInvestigation.interpretation.facts.repair_details, '');
assert.equal(repairToInvestigation.interpretation.facts.prescription_status, 'unknown');
assert(repairToInvestigation.diagnostics.cleared_stale_fields.includes('repair_details'));
assert(repairToInvestigation.diagnostics.cleared_stale_fields.includes('prescription_status'));

const investigationToRepair = reconcilePatientConversationState({
  priorState: priorState({
    primary_intent: 'investigatii',
    care_path_candidates: ['specialized_ophthalmology'],
    service_keys: ['oct'],
    provider_type_candidates: ['ophthalmology_clinic'],
    facts: facts({
      locality: { siruta_code: '', city: 'Sibiu', county_code: 'SB', county: 'Sibiu', area: '' },
      investigation_reference_text: 'OCT recomandat',
    }),
  }),
  conversation: [{ role: 'user', content: 'de fapt vreau doar sa repar rama' }],
  interpretation: interpretation({
    primary_intent: 'reparatii_ochelari',
    care_path_candidates: ['technical_optical_service'],
    service_keys: ['eyeglasses_repair'],
    provider_type_candidates: ['independent_optical_store'],
    facts: facts({
      locality: { siruta_code: '', city: 'Sibiu', county_code: 'SB', county: 'Sibiu', area: '' },
      repair_details: 'rama este rupta',
      investigation_reference_text: 'OCT recomandat de medic',
    }),
  }),
});
assert.equal(investigationToRepair.interpretation.facts.repair_details, 'rama este rupta');
assert.equal(investigationToRepair.interpretation.facts.investigation_reference_text, '');
assert(investigationToRepair.diagnostics.cleared_stale_fields.includes('investigation_reference_text'));

const contactLensToRoutine = reconcilePatientConversationState({
  priorState: priorState({
    primary_intent: 'lentile_contact',
    care_path_candidates: ['contact_lens_fitting'],
    service_keys: ['contact_lens_fitting'],
    facts: facts({
      locality: { siruta_code: '', city: 'Cluj-Napoca', county_code: 'CJ', county: 'Cluj', area: '' },
      contact_lens_experience: 'experienced',
    }),
  }),
  conversation: [{ role: 'user', content: 'de fapt vreau doar un control de vedere' }],
  interpretation: interpretation({
    primary_intent: 'control_vedere',
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    facts: facts({
      locality: { siruta_code: '', city: 'Cluj-Napoca', county_code: 'CJ', county: 'Cluj', area: '' },
      contact_lens_experience: 'experienced',
    }),
  }),
});
assert.equal(contactLensToRoutine.interpretation.facts.contact_lens_experience, 'unknown');
assert(contactLensToRoutine.diagnostics.cleared_stale_fields.includes('contact_lens_experience'));

console.log('Patient conversation intent-to-fact compatibility verified.');
