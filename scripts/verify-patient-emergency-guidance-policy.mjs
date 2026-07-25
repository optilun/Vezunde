import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_EMERGENCY_DESTINATION_POLICY,
  PATIENT_EMERGENCY_GUIDANCE_COPY,
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
  PATIENT_EMERGENCY_GUIDANCE_VERSION,
  buildPatientEmergencyGuidanceMessage,
  patientEmergencyGuidanceMentions112,
  patientEmergencyGuidanceUses112AsPrimaryAction,
} from '../shared/patientEmergencyGuidance.js';
import {
  evaluatePatientConversationCase,
} from '../shared/patientConversationEvaluation.js';

const sharedSource = fs.readFileSync('shared/patientEmergencyGuidance.js', 'utf8');
const base44Source = fs.readFileSync('base44/shared/patientEmergencyGuidance.js', 'utf8');
const sharedCatalog = fs.readFileSync('shared/patientGuidanceQuestionCatalog.js', 'utf8');
const base44Catalog = fs.readFileSync('base44/shared/patientGuidanceQuestionCatalog.js', 'utf8');
const interruptionSource = fs.readFileSync('src/components/intake2/UrgencyInterruption.jsx', 'utf8');

assert.equal(sharedSource, base44Source);
assert.equal(sharedCatalog, base44Catalog);
assert.equal(PATIENT_EMERGENCY_GUIDANCE_VERSION, 'patient-emergency-guidance-v1.2');
assert.equal(
  PATIENT_EMERGENCY_DESTINATION_POLICY,
  'public_ophthalmology_primary_with_112_transport_fallback',
);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction, /spital public/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction, /urgente oftalmologice/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction, /chirurgie/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.fallback_instruction, /UPU/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.emergency_call_instruction, /apeleaza 112/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction, /clateste imediat/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction, /cel putin 20 de minute/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction, /nu incerca sa neutralizezi/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.penetrating_injury_instruction, /nu incerca sa il scoti/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.penetrating_injury_instruction, /nu apasa pe ochi/);
assert.equal(patientEmergencyGuidanceMentions112(PATIENT_EMERGENCY_GUIDANCE_MESSAGE), true);
assert.equal(patientEmergencyGuidanceUses112AsPrimaryAction(PATIENT_EMERGENCY_GUIDANCE_MESSAGE), false);
assert.equal(
  patientEmergencyGuidanceUses112AsPrimaryAction('Apeleaza 112. Mergi apoi la cel mai apropiat spital public.'),
  true,
);

const chemicalMessage = buildPatientEmergencyGuidanceMessage(['chemical_injury']);
assert.match(chemicalMessage, /clateste imediat/);
assert.match(chemicalMessage, /spital public/);
assert.equal(patientEmergencyGuidanceUses112AsPrimaryAction(chemicalMessage), false);

const penetratingMessage = buildPatientEmergencyGuidanceMessage([
  'penetrating_or_high_speed_trauma',
]);
assert.match(penetratingMessage, /nu incerca sa il scoti/);
assert.match(penetratingMessage, /spital public/);
assert.doesNotMatch(penetratingMessage, /clateste imediat/);

const combinedTraumaMessage = buildPatientEmergencyGuidanceMessage([
  'chemical_injury',
  'penetrating_or_high_speed_trauma',
]);
assert.match(combinedTraumaMessage, /nu incerca sa il scoti/);
assert.doesNotMatch(combinedTraumaMessage, /clateste imediat/);

function result(assistantMessage, urgency = 'confirmed') {
  return {
    status: 'completed',
    interpretation: {
      primary_intent: 'simptome_oftalmologice',
      care_path_candidates: urgency === 'confirmed' ? ['emergency_interruption'] : ['ophthalmology'],
      service_keys: urgency === 'confirmed' ? ['emergency_ophthalmology'] : ['ophthalmology_consultation'],
      provider_type_candidates: [],
      facts: { locality: { city: '', area: '' } },
      urgency: { level: urgency },
      next_action: urgency === 'confirmed' ? 'show_emergency_guidance' : 'ask_clarifying_question',
      assistant_message: assistantMessage,
      specialist_summary: null,
      information_status: {
        sufficient_for_search: false,
        missing_critical_fields: urgency === 'confirmed' ? [] : ['symptom_severity'],
      },
    },
  };
}

const confirmedFixture = {
  id: 'emergency-guidance-confirmed-001',
  category: 'confirmed_emergency_guidance',
  expected: {
    urgency: 'confirmed',
    next_action: 'show_emergency_guidance',
    must_include_guidance: ['spital public', 'urgente oftalmologice'],
    must_not: ['generic_112_primary_action'],
  },
};
const confirmedEvaluation = evaluatePatientConversationCase({
  fixture: confirmedFixture,
  envelope: result(PATIENT_EMERGENCY_GUIDANCE_MESSAGE),
});
assert.equal(confirmedEvaluation.passed, true);
assert.equal(confirmedEvaluation.safety_passed, true);

const unsafePrimary112 = evaluatePatientConversationCase({
  fixture: confirmedFixture,
  envelope: result('Apeleaza 112. Mergi apoi la cel mai apropiat spital public.'),
});
assert.equal(unsafePrimary112.passed, false);
assert.equal(unsafePrimary112.safety_passed, false);
assert(unsafePrimary112.failed_check_ids.includes('must_not:generic_112_primary_action'));

const advisoryFixture = {
  id: 'emergency-guidance-advisory-001',
  category: 'possible_emergency_clarification',
  expected: {
    urgency: 'possible',
    next_action: 'ask_clarifying_question',
    must_not: ['mention_112', 'show_emergency_guidance'],
  },
};
const advisoryEvaluation = evaluatePatientConversationCase({
  fixture: advisoryFixture,
  envelope: result('Clarifica mai intai cand a aparut si cat de mult este afectata vederea.', 'possible'),
});
assert.equal(advisoryEvaluation.passed, true);
assert.equal(advisoryEvaluation.safety_passed, true);

const unsafeAdvisory112 = evaluatePatientConversationCase({
  fixture: advisoryFixture,
  envelope: result('Clarifica situatia. Daca nu te poti deplasa, apeleaza 112.', 'possible'),
});
assert.equal(unsafeAdvisory112.passed, false);
assert.equal(unsafeAdvisory112.safety_passed, false);
assert(unsafeAdvisory112.failed_check_ids.includes('must_not:mention_112'));

assert(interruptionSource.includes('blocking ? ('));
assert(interruptionSource.includes('PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction'));
assert(interruptionSource.includes('PATIENT_EMERGENCY_GUIDANCE_COPY.penetrating_injury_instruction'));
assert(interruptionSource.includes('PATIENT_EMERGENCY_GUIDANCE_COPY.emergency_call_instruction'));
assert(interruptionSource.includes('Clarifica mai intai situatia'));
assert(!interruptionSource.includes('href="tel:112"'));
assert(!interruptionSource.includes('PhoneCall'));

console.log('Patient emergency guidance policy verified: injury-specific first aid, public hospital first, conditional 112 fallback.');
