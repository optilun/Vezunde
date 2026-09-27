// Cardurile chestionarului pacientului: text scurt, explicatiile in butonul "i".
//
// 2026-09-27, cererea owner-ului: cardurile aratau prea mult text deodata. Informatia ramane
// aceeasi, dar explicatiile se deschid cu butonul "i" (InfoHint). Verificarile de aici blocheaza:
//  1. explicatiile lungi nu mai stau vizibil pe carduri, ci in InfoHint;
//  2. textele aprobate (catalogul, nota despre AI, confidentialitatea anamnezei, disclaimerul
//     recomandarilor) exista in continuare, doar mutate;
//  3. pe ecranul de urgenta raman vizibile actiunile (unde mergi, primul ajutor, 112); doar
//     explicatia si disclaimerul se deschid cu "i". Plasa de siguranta ramane vizibila.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATIENT_GUIDANCE_QUESTION_CATALOG } from '../shared/patientGuidanceQuestionCatalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

let checks = 0;
function check(name, fn) {
  try {
    fn();
    checks += 1;
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

check('InfoHint opens a popover from an accessible button', () => {
  const hint = source('src/components/intake2/InfoHint.jsx');
  assert.match(hint, /from "@\/components\/ui\/popover"/);
  assert.match(hint, /aria-label=\{label\}/);
  assert.match(hint, /label = "Mai multe informații"/);
  assert.match(hint, /h-8 w-8/, 'zona de atingere ramane de 32px');
});

check('question explanations moved next to the title', () => {
  const card = source('src/components/intake2/ConversationalCard.jsx');
  assert.match(card, /function questionInfoItems\(question/);
  assert.match(card, /if \(question\?\.helper && !prefilled\) items\.push\(question\.helper\);/);
  assert.match(card, /const SUGGESTION_INFO = "Varianta marcată „Sugestie” vine din mesajul tău\./);
  assert.match(card, /!\(current\.type === "text" && questionPhase === "safety"\) && \(\n\s+<InfoHint/, 'butonul nu ramane ascuns in titlul invizibil al verificarii de siguranta');

  const choice = source('src/components/intake2/QuestionChoice.jsx');
  assert.doesNotMatch(choice, /\{question\.helper\}/);
  assert.doesNotMatch(choice, /Am marcat varianta care pare/);

  const location = source('src/components/intake2/QuestionLocation.jsx');
  assert.match(location, /<InfoHint items=\{\[LOCATION_RULE\]\}/, 'regula de cautare se deschide cu butonul din campul de cautare');
  assert.doesNotMatch(location, /<p[^>]*>\s*Selectează localitatea din lista oficială/, 'regula nu mai e un paragraf vizibil');
  assert.match(location, /Am căutat după localitatea din mesajul tău\./);
});

check('the approved safety explanation stays, behind the info button', () => {
  const helper = PATIENT_GUIDANCE_QUESTION_CATALOG.safety_targeted_check.helper;
  assert.match(helper, /Întrebăm doar despre situații apărute brusc/);
  const text = source('src/components/intake2/QuestionText.jsx');
  assert.match(text, /<InfoHint items=\{\[SAFETY_QUESTION\.helper\]\} \/>/);
  assert.doesNotMatch(text, />\s*\{SAFETY_QUESTION\.helper\}\s*</, 'explicatia nu mai e un paragraf vizibil');
  assert.match(text, /SAFETY_CHOICES\.map/, 'variantele clinice raman vizibile');
});

check('confirmation, anamnesis and review keep their texts in InfoHint', () => {
  const confirmation = source('src/components/intake2/PatientIntentConfirmation.jsx');
  assert.match(confirmation, /Confirmă și continuăm cu câteva întrebări scurte\.\n\s+<InfoHint/);
  assert.match(confirmation, /"AI-ul nu alege furnizorii și nu stabilește ordinea rezultatelor\."/);

  const anamnesis = source('src/components/intake2/PatientAnamnesis.jsx');
  assert.match(anamnesis, /<InfoHint\n\s+items=\{\[/);
  assert.match(anamnesis, /"Răspunsurile rămân în cererea ta și nu schimbă ordinea rezultatelor\./);
  assert.match(anamnesis, /Am bifat din mesajul tău/);
  assert.match(anamnesis, /Poți debifa oricând/);

  const review = source('src/components/intake2/PatientRequestReview.jsx');
  assert.match(review, /<InfoHint items=\{\[guidance\.disclaimer\]\}/);
  assert.match(review, /\{guidance\.safety_net\}/, 'plasa de siguranta ramane vizibila');
  assert.doesNotMatch(review, /Verifică nevoia și localitatea, apoi caută/);
});

check('the emergency screen keeps its actions visible', () => {
  const urgency = source('src/components/intake2/UrgencyInterruption.jsx');
  assert.match(urgency, /\{COPY\.primary_instruction\}/, 'unde mergi ramane vizibil');
  assert.match(urgency, /\{firstAid\}/, 'primul ajutor ramane vizibil');
  assert.match(urgency, /href="tel:112"/);
  assert.match(urgency, /<InfoHint\n\s+items=\{\[\n\s+COPY\.explanation,/, 'explicatia se deschide cu butonul i');
  assert.match(urgency, /\n\s+COPY\.disclaimer,\n/);
  assert.doesNotMatch(urgency, /<p[^>]*>\{COPY\.disclaimer\}<\/p>/);
});

console.log(`Patient intake info hints verified: ${checks} checks.`);
