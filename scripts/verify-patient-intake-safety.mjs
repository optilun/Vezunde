import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_SAFETY_ASSESSMENT_VERSION,
  advisorySafetyFlagsFromText,
  buildPatientSafetyAssessment,
  deterministicSafetyFlagsFromText,
  guidedSafetyClearRequestedFromAnswers,
  guidedSafetyFlagsFromAnswers,
} from '../src/lib/patientSafety.js';
import {
  PATIENT_SAFETY_ASSESSMENT_VERSION as BASE44_PATIENT_SAFETY_ASSESSMENT_VERSION,
  buildPatientSafetyAssessment as buildBase44PatientSafetyAssessment,
  guidedSafetyClearRequestedFromAnswers as guidedBase44SafetyClearRequestedFromAnswers,
  guidedSafetyFlagsFromAnswers as guidedBase44SafetyFlagsFromAnswers,
} from '../base44/shared/patientSafety.js';
import {
  PATIENT_EMERGENCY_GUIDANCE_COPY,
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
  patientEmergencyGuidanceMentions112,
  patientEmergencyGuidanceUses112AsPrimaryAction,
} from '../shared/patientEmergencyGuidance.js';

assert.equal(PATIENT_SAFETY_ASSESSMENT_VERSION, 'patient-eye-safety-v1.2');
assert.equal(BASE44_PATIENT_SAFETY_ASSESSMENT_VERSION, 'patient-eye-safety-v1.2');
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'substanta_chimica' }]), ['chemical_injury']);
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'substanta_chimica' }]), ['chemical_injury']);
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'niciuna' }]), []);
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }]), []);
assert.equal(guidedSafetyClearRequestedFromAnswers([{ question_key: 'safety_screening', answer_value: 'niciuna' }]), true);
assert.equal(guidedSafetyClearRequestedFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }]), true);
assert.equal(guidedSafetyClearRequestedFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'necunoscut' }]), false);
assert.deepEqual(guidedBase44SafetyFlagsFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'traumatism_obiect' }]), ['penetrating_or_high_speed_trauma']);
assert.equal(guidedBase44SafetyClearRequestedFromAnswers([{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }]), true);

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

const canonicalGuidedAssessment = buildPatientSafetyAssessment({
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'durere_severa' }],
});
assert.equal(canonicalGuidedAssessment.state, 'blocking');
assert.equal(canonicalGuidedAssessment.blocking, true);
assert.ok(canonicalGuidedAssessment.blocking_flags.includes('severe_eye_pain'));

const base44CanonicalGuidedAssessment = buildBase44PatientSafetyAssessment({
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'postoperator_acut' }],
});
assert.equal(base44CanonicalGuidedAssessment.state, 'blocking');
assert.equal(base44CanonicalGuidedAssessment.blocking, true);
assert.ok(base44CanonicalGuidedAssessment.blocking_flags.includes('postoperative_red_eye_or_vision_change'));

const explicitTextAssessment = buildPatientSafetyAssessment({ text: 'Nu mai vad deloc cu un ochi deodata' });
assert.equal(explicitTextAssessment.state, 'blocking');
assert.equal(explicitTextAssessment.blocking, true);
assert.equal(explicitTextAssessment.source, 'explicit_text');

const contradictorySameTurnAssessment = buildPatientSafetyAssessment({
  text: 'Nu este brusca problema, dar acum nu mai vad deloc cu ochiul drept.',
});
assert.equal(contradictorySameTurnAssessment.state, 'blocking');
assert(contradictorySameTurnAssessment.blocking_flags.includes('sudden_vision_loss'));
assert.equal(contradictorySameTurnAssessment.cleared_flags.includes('sudden_vision_loss'), false);

const ambiguousTextAssessment = buildPatientSafetyAssessment({ text: 'Nu vad cu ochiul drept' });
assert.equal(ambiguousTextAssessment.state, 'advisory');
assert.equal(ambiguousTextAssessment.blocking, false);
assert.equal(ambiguousTextAssessment.advisory, true);
assert.deepEqual(ambiguousTextAssessment.advisory_flags, ['sudden_vision_loss']);
assert.equal(ambiguousTextAssessment.source, 'ambiguous_text');

const guidedClearAssessment = buildPatientSafetyAssessment({
  text: 'Nu vad cu ochiul drept',
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
});
assert.equal(guidedClearAssessment.state, 'clear');
assert.equal(guidedClearAssessment.blocking, false);
assert.equal(guidedClearAssessment.advisory, false);
assert.equal(guidedClearAssessment.source, 'guided_clear');
assert.deepEqual(guidedClearAssessment.advisory_flags, []);
assert.ok(guidedClearAssessment.cleared_flags.includes('sudden_vision_loss'));

const guidedClearCannotOverrideBlockingText = buildPatientSafetyAssessment({
  text: 'Nu mai vad deloc cu un ochi deodata',
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
});
assert.equal(guidedClearCannotOverrideBlockingText.state, 'blocking');
assert.equal(guidedClearCannotOverrideBlockingText.blocking, true);
assert.equal(guidedClearCannotOverrideBlockingText.source, 'explicit_text');
assert.ok(guidedClearCannotOverrideBlockingText.blocking_flags.includes('sudden_vision_loss'));

const correctedGuidedAnswerAssessment = buildPatientSafetyAssessment({
  answers: [
    { question_key: 'safety_screening', answer_value: 'durere_severa' },
    { question_key: 'safety_targeted_check', answer_value: 'niciuna' },
  ],
});
assert.equal(correctedGuidedAnswerAssessment.state, 'clear');
assert.equal(correctedGuidedAnswerAssessment.source, 'guided_clear');
assert.deepEqual(correctedGuidedAnswerAssessment.blocking_flags, []);

const laterBlockingGuidedAnswerAssessment = buildPatientSafetyAssessment({
  answers: [
    { question_key: 'safety_screening', answer_value: 'niciuna' },
    { question_key: 'safety_targeted_check', answer_value: 'durere_severa' },
  ],
});
assert.equal(laterBlockingGuidedAnswerAssessment.state, 'blocking');
assert.equal(laterBlockingGuidedAnswerAssessment.source, 'guided_answer');
assert.deepEqual(laterBlockingGuidedAnswerAssessment.blocking_flags, ['severe_eye_pain']);

const base44GuidedClearAssessment = buildBase44PatientSafetyAssessment({
  text: 'Nu vad cu ochiul drept',
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'niciuna' }],
});
assert.equal(base44GuidedClearAssessment.state, 'clear');
assert.equal(base44GuidedClearAssessment.source, 'guided_clear');
assert.deepEqual(base44GuidedClearAssessment.advisory_flags, []);

const stableTextAssessment = buildPatientSafetyAssessment({
  text: 'Vad mai slab cu ochiul drept, dar problema exista de cateva luni si nu este brusca.',
});
assert.equal(stableTextAssessment.state, 'clear');
assert.equal(stableTextAssessment.blocking, false);
assert.equal(stableTextAssessment.advisory, false);
assert(stableTextAssessment.cleared_flags.includes('sudden_vision_loss'));

const unrelatedChildhoodText = buildPatientSafetyAssessment({
  conversation: [
    { role: 'user', content: 'Nu vad cu ochiul drept.' },
    { role: 'assistant', content: 'Problema exista de mult timp?' },
    { role: 'user', content: 'Locuiesc in Brasov de mic.' },
  ],
});
assert.equal(unrelatedChildhoodText.state, 'advisory');
assert.equal(unrelatedChildhoodText.cleared_flags.includes('sudden_vision_loss'), false);

const correctedConversationAssessment = buildPatientSafetyAssessment({
  conversation: [
    { role: 'user', content: 'Nu vad cu ochiul drept.' },
    { role: 'assistant', content: 'Problema a aparut brusc?' },
    { role: 'user', content: 'Nu este brusca, vad mai slab de cateva luni si nu ma doare.' },
  ],
});
assert.equal(correctedConversationAssessment.state, 'clear');
assert(correctedConversationAssessment.cleared_flags.includes('sudden_vision_loss'));

const correctedConversationWithStaleAiFlag = buildPatientSafetyAssessment({
  conversation: [
    { role: 'user', content: 'Nu vad cu ochiul drept.' },
    { role: 'assistant', content: 'Problema a aparut brusc?' },
    { role: 'user', content: 'Nu este brusca, vad mai slab de cateva luni.' },
  ],
  aiFlags: ['sudden_vision_loss'],
});
assert.equal(correctedConversationWithStaleAiFlag.state, 'clear');
assert.deepEqual(correctedConversationWithStaleAiFlag.advisory_flags, []);

const aiOnlyAssessment = buildPatientSafetyAssessment({ aiFlags: ['severe_eye_pain'] });
assert.equal(aiOnlyAssessment.state, 'advisory');
assert.equal(aiOnlyAssessment.blocking, false, 'AI advisory nu poate bloca singur fluxul');
assert.deepEqual(aiOnlyAssessment.advisory_flags, ['severe_eye_pain']);
assert.equal(aiOnlyAssessment.source, 'ai_or_text_advisory');

const questionText = await readFile(new URL('../src/components/intake2/QuestionText.jsx', import.meta.url), 'utf8');
const interruption = await readFile(new URL('../src/components/intake2/UrgencyInterruption.jsx', import.meta.url), 'utf8');
const safetyPolicy = await readFile(new URL('../src/lib/patientSafety.js', import.meta.url), 'utf8');
const base44SafetyAdapter = await readFile(new URL('../base44/shared/patientSafety.js', import.meta.url), 'utf8');
const sharedSafetyPolicy = await readFile(new URL('../shared/patientEyeSafetyPolicy.js', import.meta.url), 'utf8');
const base44SafetyPolicy = await readFile(new URL('../base44/shared/patientEyeSafetyPolicy.js', import.meta.url), 'utf8');

assert.equal(sharedSafetyPolicy, base44SafetyPolicy);
assert.match(base44SafetyAdapter, /assessPatientEyeSafety/);
assert.match(base44SafetyAdapter, /PATIENT_EYE_SAFETY_POLICY_VERSION/);
assert.match(base44SafetyAdapter, /guidedSafetyClearRequestedFromAnswers/);
assert.doesNotMatch(base44SafetyAdapter, /nu mai vad cu un ochi/);

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
assert.match(questionText, /onSubmit\(question, reviewedValue\)/);
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
assert.match(PATIENT_EMERGENCY_GUIDANCE_COPY.chemical_irrigation_instruction, /cel putin 20 de minute/);
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
assert.match(safetyPolicy, /guidedSafetyClearRequestedFromAnswers/);
assert.doesNotMatch(safetyPolicy, /nu mai vad cu un ochi/);

console.log('Patient intake safety checks passed.');
