import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APPROVED_PATIENT_SAFETY_COPY,
  PATIENT_GUIDANCE_QUESTION_CATALOG,
} from '../shared/patientGuidanceQuestionCatalog.js';
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

// 2026-09-02: textul de triaj si cel de urgenta nu mai sunt copiate in componente, deci
// verificarea nu mai cauta literale in JSX. Erau trei exemplare ale aceluiasi text clinic
// (catalog, QuestionText, UrgencyInterruption) si unul chiar divergease. Verificam acum
// sursa unica plus faptul ca ecranele chiar consuma sursa, nu ceva scris de mana.
const safetyOptions = PATIENT_GUIDANCE_QUESTION_CATALOG.safety_targeted_check.options;
for (const label of [
  // Formularea a fost clarificata (2026-08-06): varianta veche "vederea a scazut mult"
  // prindea si miopia cronica, generand alarme false. Acum e explicit acuta.
  'vederea a dispărut brusc la un ochi',
  'A ajuns o substanță chimică în ochi',
  'Un obiect a pătruns în ochi sau a existat o lovitură puternică',
  'Am durere oculară foarte mare',
  'Au apărut brusc fulgerări',
  'după operație ori injecție oculară recentă',
  'Niciuna dintre acestea',
]) {
  assert.ok(
    safetyOptions.some((option) => option.label.includes(label)),
    `eticheta de triaj lipseste din catalogul aprobat: ${label}`,
  );
}

// Ecranele consuma catalogul, nu literale proprii.
assert.match(questionText, /PATIENT_GUIDANCE_QUESTION_CATALOG\.safety_targeted_check/);
assert.doesNotMatch(
  questionText,
  /A ajuns o substan/,
  'etichetele de triaj nu au voie sa fie copiate din nou in QuestionText',
);
assert.match(interruption, /APPROVED_PATIENT_SAFETY_COPY/);
assert.doesNotMatch(
  interruption,
  /Mergi imediat la UPU/,
  'instructiunea de destinatie nu are voie sa fie copiata din nou in UrgencyInterruption',
);

assert.match(questionText, /buildPatientSafetyAssessment/);
assert.match(questionText, /UrgencyInterruption/);
assert.match(questionText, /if \(assessment\.blocking\)/);
assert.match(questionChoice, /safety_targeted_check/);
assert.match(questionChoice, /UrgencyInterruption/);
assert.match(interruption, /href="tel:112"/);
assert.match(interruption, /Nu conduce/);

// Textul aprobat, verificat la sursa.
assert.match(APPROVED_PATIENT_SAFETY_COPY.blocking_title, /Oprește căutarea și solicită ajutor medical imediat/);
assert.match(APPROVED_PATIENT_SAFETY_COPY.primary_instruction, /Mergi imediat la UPU, camera de gardă/);
assert.match(APPROVED_PATIENT_SAFETY_COPY.chemical_instruction, /cel puțin 20 de minute/);
assert.match(APPROVED_PATIENT_SAFETY_COPY.disclaimer, /nu reprezintă diagnostic sau triaj medical/);

// 2026-09-02: primul ajutor exista pentru ambele traumatisme cu precautie aprobata, si
// ecranul il afiseaza INAINTEA destinatiei. Politica, sectiunea 3. Inainte, un pacient cu un
// obiect patruns in ochi nu primea nicio precautie pe ecranul blocant, iar cea pentru
// substanta chimica aparea dupa indrumarea spre spital.
assert.match(APPROVED_PATIENT_SAFETY_COPY.penetrating_instruction, /nu încerca să îl scoți/);
assert.match(APPROVED_PATIENT_SAFETY_COPY.penetrating_instruction, /nu apăsa pe ochi/);
assert.match(interruption, /COPY\.penetrating_instruction/);
assert.match(interruption, /COPY\.chemical_instruction/);
assert(
  interruption.indexOf('Primul ajutor, acum') < interruption.indexOf('Unde mergi'),
  'primul ajutor trebuie randat inaintea indrumarii spre destinatie',
);
// Precedenta: traumatismul penetrant suprima instructiunea de clatire.
const firstAidBranch = interruption.slice(interruption.indexOf('const firstAid'));
assert.match(
  firstAidBranch.slice(0, firstAidBranch.indexOf(';')),
  /penetrating_or_high_speed_trauma[\s\S]*penetrating_instruction[\s\S]*chemical_injury[\s\S]*chemical_instruction/,
);
assert.doesNotMatch(interruption.toLowerCase(), /diagnosticul este|ai glaucom|ai dezlipire de retina/);
assert.match(safetyPolicy, /advisoryFlags/);
assert.match(safetyPolicy, /blocking: blockingFlags\.length > 0/);

console.log('Patient intake safety checks passed.');
