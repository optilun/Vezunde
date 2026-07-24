import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_SAFETY_ASSESSMENT_VERSION,
  advisorySafetyFlagsFromText,
  buildPatientSafetyAssessment,
  deterministicSafetyFlagsFromText,
  guidedSafetyFlagsFromAnswers,
} from '../src/lib/patientSafety.js';
import {
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
  patientEmergencyGuidanceMentions112,
  patientEmergencyGuidanceUses112AsPrimaryAction,
} from '../shared/patientEmergencyGuidance.js';

assert.equal(PATIENT_SAFETY_ASSESSMENT_VERSION, 'patient-eye-safety-v1.2');
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'substanta_chimica' }]), ['chemical_injury']);
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'niciuna' }]), []);

assert.ok(deterministicSafetyFlagsFromText('Mi-am pierdut vederea brusc la un ochi').includes('sudden_vision_loss'));
assert.ok(deterministicSafetyFlagsFromText('Mi-a intrat acid in ochi').includes('chemical_injury'));
assert.ok(deterministicSafetyFlagsFromText('Am o durere severa la ochi').includes('severe_eye_pain'));
assert.ok(deterministicSafetyFlagsFromText('Vad o umbra ca o perdea').includes('other_possible_urgent_eye_problem'));
assert.deepEqual(deterministicSafetyFlagsFromText('Nu vad cu ochiul drept'), []);
assert.ok(advisorySafetyFlagsFromText('Nu vad cu ochiul drept').includes('sudden_vision_loss'));
assert.deepEqual(deterministicSafetyFlagsFromText('Am ochii putin obositi dupa calculator'), []);
assert.deepEqual(deterministicSafetyFlagsFromText('Vreau un control de vedere'), []);

const guidedAssessment = buildPatientSafetyAssessment({
  answers: [{ question_key: 'safety_screening', answer_value: 'traumatism_obiect' }],
});
assert.equal(guidedAssessment.state, 'blocking');
assert.equal(guidedAssessment.blocking, true);
assert.equal(guidedAssessment.source, 'guided_answer');
assert.ok(guidedAssessment.blocking_flags.includes('penetrating_or_high_speed_trauma'));

const explicitTextAssessment = buildPatientSafetyAssessment({ text: 'Nu mai vad deloc cu un ochi deodata' });
assert.equal(explicitTextAssessment.state, 'blocking');
assert.equal(explicitTextAssessment.blocking, true);
assert.equal(explicitTextAssessment.source, 'explicit_text');

const ambiguousTextAssessment = buildPatientSafetyAssessment({ text: 'Nu vad cu ochiul drept' });
assert.equal(ambiguousTextAssessment.state, 'advisory');
assert.equal(ambiguousTextAssessment.blocking, false);
assert.equal(ambiguousTextAssessment.advisory, true);
assert.deepEqual(ambiguousTextAssessment.advisory_flags, ['sudden_vision_loss']);
assert.equal(ambiguousTextAssessment.source, 'ambiguous_text');

const stableTextAssessment = buildPatientSafetyAssessment({
  text: 'Vad mai slab cu ochiul drept, dar problema exista de cateva luni si nu este brusca.',
});
assert.equal(stableTextAssessment.state, 'clear');
assert.equal(stableTextAssessment.blocking, false);
assert.equal(stableTextAssessment.advisory, false);
assert(stableTextAssessment.cleared_flags.includes('sudden_vision_loss'));

const correctedConversationAssessment = buildPatientSafetyAssessment({
  conversation: [
    { role: 'user', content: 'Nu vad cu ochiul drept.' },
    { role: 'assistant', content: 'Problema a aparut brusc?' },
    { role: 'user', content: 'Nu este brusc, vad mai slab de cateva luni si nu ma doare.' },
  ],
});
assert.equal(correctedConversationAssessment.state, 'clear');
assert(correctedConversationAssessment.cleared_flags.includes('sudden_vision_loss'));

const aiOnlyAssessment = buildPatientSafetyAssessment({ aiFlags: ['severe_eye_pain'] });
assert.equal(aiOnlyAssessment.state, 'advisory');
assert.equal(aiOnlyAssessment.blocking, false, 'AI advisory nu poate bloca singur fluxul');
assert.deepEqual(aiOnlyAssessment.advisory_flags, ['severe_eye_pain']);
assert.equal(aiOnlyAssessment.source, 'ai_or_text_advisory');

const questionText = await readFile(new URL('../src/components/intake2/QuestionText.jsx', import.meta.url), 'utf8');
const interruption = await readFile(new URL('../src/components/intake2/UrgencyInterruption.jsx', import.meta.url), 'utf8');
const safetyPolicy = await readFile(new URL('../src/lib/patientSafety.js', import.meta.url), 'utf8');
const sharedSafetyPolicy = await readFile(new URL('../shared/patientEyeSafetyPolicy.js', import.meta.url), 'utf8');
const base44SafetyPolicy = await readFile(new URL('../base44/shared/patientEyeSafetyPolicy.js', import.meta.url), 'utf8');

assert.equal(sharedSafetyPolicy, base44SafetyPolicy);

for (const label of [
  'Nu mai vad brusc sau vederea a scazut mult',
  'A ajuns o substanta chimica in ochi',
  'Un obiect a patruns in ochi sau a existat o lovitura puternica',
  'Am durere oculara foarte mare',
  'Au aparut brusc fulgerari',
  'dupa operatie ori injectie oculara recenta',
  'Niciuna dintre acestea',
]) assert.match(questionText, new RegExp(label));

assert.match(questionText, /assessment\.advisory/);
assert.match(questionText, /safetyReviewedValue/);
assert.match(questionText, /mode="advisory"/);
assert.match(questionText, /diferentiem o problema obisnuita de una urgenta/);
assert.match(questionText, /if \(assessment\.blocking\)/);
assert.match(interruption, /Opreste cautarea si solicita ajutor medical imediat/);
assert.match(interruption, /PATIENT_EMERGENCY_GUIDANCE_COPY/);
assert.match(interruption, /emergency_call_instruction/);
assert.match(interruption, /Hospital/);
assert.match(interruption, /blocking \? \(/);
assert.match(interruption, /blocking && chemical/);
assert.match(interruption, /Clarifica mai intai situatia/);
assert.match(interruption, /cautarea ramane oprita pana cand situatia este clarificata/);
assert.doesNotMatch(interruption, /href="tel:112"|PhoneCall/);
assert.match(interruption, /cel putin 20 de minute/);
assert.match(interruption, /nu reprezinta diagnostic sau triaj medical/);
assert.doesNotMatch(interruption.toLowerCase(), /diagnosticul este|ai glaucom|ai dezlipire de retina/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_MESSAGE, /spital public/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_MESSAGE, /urgente oftalmologice/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_MESSAGE, /chirurgie/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_MESSAGE, /Nu conduce/);
assert.match(PATIENT_EMERGENCY_GUIDANCE_MESSAGE, /apeleaza 112/);
assert.equal(patientEmergencyGuidanceMentions112(PATIENT_EMERGENCY_GUIDANCE_MESSAGE), true);
assert.equal(patientEmergencyGuidanceUses112AsPrimaryAction(PATIENT_EMERGENCY_GUIDANCE_MESSAGE), false);
assert.match(safetyPolicy, /assessPatientEyeSafety/);
assert.doesNotMatch(safetyPolicy, /nu mai vad cu un ochi/);

console.log('Patient intake safety checks passed.');
