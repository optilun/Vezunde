import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_SAFETY_ASSESSMENT_VERSION,
  buildPatientSafetyAssessment,
  deterministicSafetyFlagsFromText,
  guidedSafetyFlagsFromAnswers,
} from '../src/lib/patientSafety.js';

assert.equal(PATIENT_SAFETY_ASSESSMENT_VERSION, 'patient-eye-safety-v1');
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'substanta_chimica' }]), ['chemical_injury']);
assert.deepEqual(guidedSafetyFlagsFromAnswers([{ question_key: 'safety_screening', answer_value: 'niciuna' }]), []);

assert.ok(deterministicSafetyFlagsFromText('Mi-am pierdut vederea brusc la un ochi').includes('sudden_vision_loss'));
assert.ok(deterministicSafetyFlagsFromText('Mi-a intrat acid in ochi').includes('chemical_injury'));
assert.ok(deterministicSafetyFlagsFromText('Am o durere severa la ochi').includes('severe_eye_pain'));
assert.ok(deterministicSafetyFlagsFromText('Vad o umbra ca o perdea').includes('other_possible_urgent_eye_problem'));
assert.deepEqual(deterministicSafetyFlagsFromText('Am ochii putin obositi dupa calculator'), []);
assert.deepEqual(deterministicSafetyFlagsFromText('Vreau un control de vedere'), []);

const guidedAssessment = buildPatientSafetyAssessment({
  answers: [{ question_key: 'safety_screening', answer_value: 'traumatism_obiect' }],
});
assert.equal(guidedAssessment.blocking, true);
assert.equal(guidedAssessment.source, 'guided_answer');
assert.ok(guidedAssessment.blocking_flags.includes('penetrating_or_high_speed_trauma'));

const canonicalGuidedAssessment = buildPatientSafetyAssessment({
  answers: [{ question_key: 'safety_targeted_check', answer_value: 'durere_severa' }],
});
assert.equal(canonicalGuidedAssessment.blocking, true);
assert.deepEqual(canonicalGuidedAssessment.blocking_flags, ['severe_eye_pain']);

const explicitTextAssessment = buildPatientSafetyAssessment({ text: 'Nu mai vad deloc cu un ochi' });
assert.equal(explicitTextAssessment.blocking, true);
assert.equal(explicitTextAssessment.source, 'explicit_text');

const aiOnlyAssessment = buildPatientSafetyAssessment({ aiFlags: ['severe_eye_pain'] });
assert.equal(aiOnlyAssessment.blocking, false, 'AI advisory nu poate bloca singur fluxul');
assert.deepEqual(aiOnlyAssessment.advisory_flags, ['severe_eye_pain']);
assert.equal(aiOnlyAssessment.source, 'ai_advisory');

const questionText = await readFile(new URL('../src/components/intake2/QuestionText.jsx', import.meta.url), 'utf8');
const questionChoice = await readFile(new URL('../src/components/intake2/QuestionChoice.jsx', import.meta.url), 'utf8');
const interruption = await readFile(new URL('../src/components/intake2/UrgencyInterruption.jsx', import.meta.url), 'utf8');
const safetyPolicy = await readFile(new URL('../src/lib/patientSafety.js', import.meta.url), 'utf8');

for (const label of [
  // Formularea a fost clarificata (2026-08-06): varianta veche "vederea a scazut mult"
  // prindea si miopia cronica, generand alarme false. Acum e explicit acuta.
  'vederea a disparut brusc la un ochi',
  'A ajuns o substanta chimica in ochi',
  'Un obiect a patruns in ochi sau a existat o lovitura puternica',
  'Am durere oculara foarte mare',
  'Au aparut brusc fulgerari',
  'dupa operatie ori injectie oculara recenta',
  'Niciuna dintre acestea',
]) assert.match(questionText, new RegExp(label));

assert.match(questionText, /buildPatientSafetyAssessment/);
assert.match(questionText, /UrgencyInterruption/);
assert.match(questionText, /if \(assessment\.blocking\)/);
assert.match(questionChoice, /safety_targeted_check/);
assert.match(questionChoice, /UrgencyInterruption/);
assert.match(interruption, /Opreste cautarea si solicita ajutor medical imediat/);
// 2026-09-01: textul afisat s-a realiniat cu APPROVED_PATIENT_SAFETY_COPY.primary_instruction
// din shared/patientGuidanceQuestionCatalog.js ("Mergi imediat la UPU..."). Ecranul softase
// formularea aprobata la "cat mai curand"; verificarea urmareste acum textul aprobat.
assert.match(interruption, /Mergi imediat la UPU, camera de garda/);
assert.match(interruption, /href="tel:112"/);
assert.match(interruption, /cel putin 20 de minute/);
assert.match(interruption, /Nu conduce/);
assert.match(interruption, /nu reprezinta diagnostic sau triaj medical/);
assert.doesNotMatch(interruption.toLowerCase(), /diagnosticul este|ai glaucom|ai dezlipire de retina/);
assert.match(safetyPolicy, /advisoryFlags/);
assert.match(safetyPolicy, /blocking: blockingFlags\.length > 0/);

console.log('Patient intake safety checks passed.');
