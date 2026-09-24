// Identificarea nevoii pacientului si rutarea chestionarului.
//
// 2026-09-24, audit LLM cautare/recomandare. Verificarile de aici blocheaza patru corectii:
//  1. Detectia determinista a intentiei foloseste precedenta (simptom > investigatie >
//     reparatie > lentile de contact > copil > ochelari > control) si acopera formularile
//     uzuale. Inainte recunostea 29 din 68 de formulari si trimitea simptome la control.
//  2. Nevoia aleasa explicit de pacient (link de categorie, confirmarea AI, alegerea manuala)
//     ajunge la server ca raspuns controlat la `categorie`. Fara el, planificatorul primea
//     intentia "unknown" si intreba "Ce te aduce la noi?" pe toate intrarile din afara
//     cardurilor din chestionar - inclusiv cele 25 de linkuri /cerere?categorie=... din site.
//  3. Interpretarea LLM v2 are definitii, precedenta, exemple si o clarificare restransa la
//     ambiguitatea reala de intentie; confirmarea nu mai cade pe alegere manuala la incredere
//     "high".
//  4. Indiciile din mesaj (pentru cine, varsta, termen, localitate) sunt doar sugestii: nu
//     devin raspunsuri si nu apar niciodata pe intrebarea de siguranta.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CATEGORY_QUESTION,
  INTENTS,
  detectIntentFromText,
  detectPatientContextHints,
  detectSubIntentPrefill,
  mergePatientContextHints,
  suggestedOptionKeyForQuestion,
} from '../src/lib/intentRegistry.js';
import {
  buildDeterministicIntentProposal,
  buildIntentConfirmationProposal,
} from '../src/lib/patientIntentConfirmation.js';
import {
  PATIENT_INTENT_KEYS,
  PATIENT_NEED_INTERPRETATION_EXAMPLES,
  PATIENT_NEED_INTERPRETATION_VERSION,
  buildPatientNeedPrompt,
  getPatientNeedResponseSchema,
  sanitizePatientNeedInterpretation,
} from '../shared/patientNeedInterpretation.js';
import { normalizeServiceKey } from '../shared/canonicalServiceRegistryExtended.js';
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  getApprovedPatientGuidanceQuestion,
} from '../shared/patientGuidanceQuestionCatalog.js';
import { deterministicSafetyFlagsFromText } from '../src/lib/patientSafety.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
const allowedIntents = Object.keys(INTENTS);
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

// --- 1. Detectia determinista -------------------------------------------------------------
// Corpus de formulari realiste (fara date de pacient). `null` = fara intentie, pacientul
// alege categoria sau descrie mai mult.
const CORPUS = [
  ['vreau sa fac un control la ochi, nu am mai fost de mult', 'control_vedere'],
  ['nu vad bine la distanta cand conduc noaptea', 'control_vedere'],
  ['cred ca mi-au crescut dioptriile', 'control_vedere'],
  ['vreau sa-mi verific vederea', 'control_vedere'],
  ['Nu mai văd bine de aproape, nu pot citi telefonul', 'control_vedere'],
  ['am nevoie de un consult pentru permisul de conducere', 'control_vedere'],
  ['vreau un control oftalmologic pentru mama mea de 70 de ani', 'control_vedere'],
  ['control anual la ochi in Cluj', 'control_vedere'],
  ['vad incetosat de cateva saptamani', 'control_vedere'],
  ['copilul meu de 5 ani se uita foarte aproape de televizor', 'control_copil'],
  ['fiica mea nu vede la tabla la scoala', 'control_copil'],
  ['baietelul meu isi da ochii peste cap si cred ca are strabism', 'control_copil'],
  ['control de vedere pentru copil de 3 ani', 'control_copil'],
  ['vreau un control pentru fetita mea inainte de clasa pregatitoare', 'control_copil'],
  ['copilul are ochiul rosu si ii curge', 'simptome_oftalmologice'],
  ['am nevoie de ochelari noi, am reteta de la medic', 'ochelari_lentile'],
  ['vreau lentile progresive', 'ochelari_lentile'],
  ['vreau sa schimb lentilele la rama mea', 'ochelari_lentile'],
  ['caut ochelari de soare cu dioptrii', 'ochelari_lentile'],
  ['vreau ochelari pentru calculator, cu filtru de lumina albastra', 'ochelari_lentile'],
  ['am o reteta si vreau sa-mi fac ochelari cat mai repede', 'ochelari_lentile'],
  ['ochelari de citit', 'ochelari_lentile'],
  ['vreau sa incerc lentile de contact, port ochelari acum', 'lentile_contact'],
  ['vreau sa-mi cumpar lentile de contact lunare', 'lentile_contact'],
  ['port lentile de contact si vreau altele', 'lentile_contact'],
  ['lentile colorate', 'lentile_contact'],
  ['mi s-a rupt bratul la ochelari, poate fi reparat?', 'reparatii_ochelari'],
  ['mi-a cazut un surub de la ochelari', 'reparatii_ochelari'],
  ['ochelarii imi aluneca de pe nas', 'reparatii_ochelari'],
  ['s-a rupt rama si am nevoie de ochelari noi', 'reparatii_ochelari'],
  ['am calcat pe ochelari si s-au stricat', 'reparatii_ochelari'],
  ['mi-a sarit o lentila din rama', 'reparatii_ochelari'],
  ['ma dor ochii si nu vad bine', 'simptome_oftalmologice'],
  ['am ochiul rosu de doua zile', 'simptome_oftalmologice'],
  ['imi lacrimeaza ochiul stang de cateva zile', 'simptome_oftalmologice'],
  ['ma mananca ochii si am pleoapele umflate', 'simptome_oftalmologice'],
  ['am un urcior la ochi', 'simptome_oftalmologice'],
  ['ma usuca ochii la calculator', 'simptome_oftalmologice'],
  ['vad puncte negre care plutesc', 'simptome_oftalmologice'],
  ['am conjunctivita', 'simptome_oftalmologice'],
  ['ma supara lumina si ma doare ochiul drept', 'simptome_oftalmologice'],
  ['am cataracta si vreau sa ma operez', 'simptome_oftalmologice'],
  ['cred ca am glaucom', 'simptome_oftalmologice'],
  ['mi s-a umflat pleoapa', 'simptome_oftalmologice'],
  ['vad dublu de ieri', 'simptome_oftalmologice'],
  ['mi-a sarit inalbitor in ochi acum cateva minute', 'simptome_oftalmologice'],
  ['nu mai vad deloc cu un ochi, s-a intamplat brusc acum o ora', 'simptome_oftalmologice'],
  ['mi-a intrat o aschie de metal in ochi de la flex', 'simptome_oftalmologice'],
  ['vad ca o perdea neagra la ochiul drept', 'simptome_oftalmologice'],
  ['m-am lovit la ochi si nu mai vad bine', 'simptome_oftalmologice'],
  ['dupa operatia de cataracta ochiul e rosu si ma doare', 'simptome_oftalmologice'],
  ['am nevoie de OCT', 'investigatii'],
  ['medicul de familie mi-a dat trimitere pentru camp vizual', 'investigatii'],
  ['unde pot face tomografie oculara', 'investigatii'],
  ['vreau sa-mi masor tensiunea oculara', 'investigatii'],
  ['am o trimitere de la medic dar nu inteleg ce scrie', 'investigatii'],
  ['doctor de ochi', 'simptome_oftalmologice'],
  ['am o problema cu ochii', 'simptome_oftalmologice'],
  ['nu stiu unde sa merg', null],
  ['ajutor', null],
];

check('deterministic corpus accuracy', () => {
  const misses = CORPUS.filter(([text, expected]) => detectIntentFromText(text) !== expected);
  assert.ok(
    misses.length <= Math.floor(CORPUS.length * 0.05),
    `Detectia determinista rateaza ${misses.length}/${CORPUS.length}: ${misses.map(([text]) => text).join(' | ')}`,
  );
});

// Cazurile de precedenta sunt exacte: fiecare a fost gresit in versiunea veche.
const PRECEDENCE = [
  ['ma dor ochii si nu vad bine', 'simptome_oftalmologice', 'simptomul bate plangerea refractiva'],
  ['m-am lovit la ochi si nu mai vad bine', 'simptome_oftalmologice', 'traumatismul nu e control de rutina'],
  ['vreau sa incerc lentile de contact, port ochelari acum', 'lentile_contact', 'lentilele de contact bat ochelarii'],
  ['caut ochelari de soare cu dioptrii', 'ochelari_lentile', 'produsul numit bate cuvantul dioptrii'],
  ['copilul are ochiul rosu si ii curge', 'simptome_oftalmologice', 'simptomul copilului nu e control pediatric'],
  ['vreau un control la un doctor', 'control_vedere', '"doctor" nu mai declanseaza investigatia OCT'],
  ['fiul meu de 25 de ani nu vede bine la distanta', 'control_vedere', 'un adult nu e control pediatric'],
];
check('intent precedence', () => {
  for (const [text, expected, reason] of PRECEDENCE) {
    assert.equal(detectIntentFromText(text), expected, `${reason}: ${text}`);
  }
});

check('word matching stays whole-word and bounded', () => {
  assert.notEqual(detectIntentFromText('am programare in octombrie la medic'), 'investigatii');
  assert.notEqual(detectIntentFromText('vreau lentile de contact, port ochelari de multi ani'), 'ochelari_lentile');
});

// --- 2. Raspunsuri precompletate din text (doar formulari neechivoce) ----------------------
check('sub-intent prefill', () => {
  const cases = [
    ['reparatii_ochelari', 'mi s-a rupt bratul la ochelari', 'ce_deteriorat', 'rama_rupta'],
    ['reparatii_ochelari', 'mi-a cazut un surub', 'ce_deteriorat', 'balama_surub'],
    ['reparatii_ochelari', 'ochelarii imi aluneca', 'ce_deteriorat', 'reglaj_rama'],
    ['investigatii', 'am trimitere pentru camp vizual', 'investigatie', 'camp_vizual'],
    ['investigatii', 'tomografie oculara', 'investigatie', 'oct'],
    ['investigatii', 'am nevoie de un OCT', 'investigatie', 'oct'],
    ['lentile_contact', 'vreau sa incerc lentile de contact', 'prima_data', 'da'],
    ['lentile_contact', 'port lentile de contact de ani de zile', 'prima_data', 'nu'],
    ['ochelari_lentile', 'vreau lentile progresive', 'ce_cauti', 'lentile_progresive'],
    ['ochelari_lentile', 'vreau sa schimb lentilele la rama mea', 'ce_cauti', 'schimbare_lentile'],
  ];
  for (const [intent, text, questionKey, optionKey] of cases) {
    assert.deepEqual(detectSubIntentPrefill(intent, text), { question_key: questionKey, option_key: optionKey }, text);
    const question = INTENTS[intent].questions.find((item) => item.key === questionKey);
    assert.ok(question?.options?.some((option) => option.key === optionKey), `${questionKey}.${optionKey} trebuie sa existe`);
  }
  // O lentila cazuta din rama nu e neaparat deteriorata: nu raspundem noi in locul pacientului.
  assert.equal(detectSubIntentPrefill('reparatii_ochelari', 'mi-a sarit o lentila din rama'), null);
});

// --- 3. Indicii din mesaj -> sugestii, nu raspunsuri ---------------------------------------
check('context hints', () => {
  const child = detectPatientContextHints('copilul meu de 5 ani se uita aproape de televizor, suntem din Brasov');
  assert.equal(child.for_whom, 'child');
  assert.equal(child.child_age_group, '3_6');
  assert.equal(child.locality_query, 'Brasov');
  assert.equal(child.symptom_onset, null, '"de 5 ani" este varsta, nu durata simptomului');

  const parent = detectPatientContextHints('vreau un control oftalmologic pentru mama mea de 70 de ani');
  assert.equal(parent.for_whom, 'other_adult');
  assert.equal(parent.child_age_group, null);
  assert.equal(parent.symptom_onset, null);

  const symptom = detectPatientContextHints('imi lacrimeaza ochiul stang de cateva zile');
  assert.equal(symptom.symptom_onset, 'recent');
  assert.equal(symptom.timing, null, '"de cateva zile" nu este termenul dorit');
  assert.equal(symptom.routine_vs_symptom, 'symptom');

  assert.equal(detectPatientContextHints('vad dublu de ieri').symptom_onset, 'sudden');
  assert.equal(detectPatientContextHints('reparatie cat mai repede').timing, 'cat_mai_repede');
  assert.equal(detectPatientContextHints('nu ma grabesc, cand se poate').timing, 'nu_e_urgent');
  assert.equal(detectPatientContextHints('am nevoie de ochelari, am reteta').prescription, 'recent_prescription');
  assert.equal(detectPatientContextHints('control in sectorul 3').locality_query, 'Sector 3');
  assert.equal(detectPatientContextHints('vreau sa-mi verific vederea').routine_vs_symptom, 'routine');
  assert.equal(detectPatientContextHints('').for_whom, null);
});

check('interpretation hints only fill gaps', () => {
  const merged = mergePatientContextHints(
    { for_whom: null, child_age_group: null, timing: 'nu_e_urgent', locality_query: null },
    { for_whom: 'copil', age_group: '7_12_ani', timing_key: 'cat_mai_repede', location_text: 'Cluj' },
  );
  assert.equal(merged.for_whom, 'child');
  assert.equal(merged.child_age_group, '7_12');
  assert.equal(merged.timing, 'nu_e_urgent', 'indiciul determinist are prioritate');
  assert.equal(merged.locality_query, 'Cluj');
  assert.equal(mergePatientContextHints({ timing: null }, { timing_key: 'saptamana_aceasta' }).timing, 'zilele_urmatoare');
});

check('suggestions map to visible options and never to safety', () => {
  const hints = {
    for_whom: 'child',
    child_age_group: '3_6',
    timing: 'saptamana_aceasta',
    symptom_onset: 'recent',
    prescription: 'needs_exam',
    routine_vs_symptom: 'routine',
  };
  assert.equal(suggestedOptionKeyForQuestion(PATIENT_GUIDANCE_QUESTION_CATALOG.for_whom, hints), 'child');
  const legacyForWhom = INTENTS.control_vedere.questions.find((question) => question.key === 'pentru_cine');
  assert.equal(suggestedOptionKeyForQuestion(legacyForWhom, hints), 'copil');
  const legacyAge = INTENTS.control_copil.questions.find((question) => question.key === 'varsta_copil');
  assert.equal(suggestedOptionKeyForQuestion(legacyAge, hints), '3_6_ani');
  assert.equal(suggestedOptionKeyForQuestion(PATIENT_GUIDANCE_QUESTION_CATALOG.symptom_timing_or_acuity, hints), 'recent');
  assert.equal(suggestedOptionKeyForQuestion(PATIENT_GUIDANCE_QUESTION_CATALOG.prescription_status, hints), 'needs_exam');
  assert.equal(suggestedOptionKeyForQuestion(PATIENT_GUIDANCE_QUESTION_CATALOG.routine_vs_symptom, hints), 'routine');
  assert.equal(
    suggestedOptionKeyForQuestion(PATIENT_GUIDANCE_QUESTION_CATALOG.timing, hints),
    null,
    'optiunea ascunsa nu poate fi sugerata',
  );
  const safety = PATIENT_GUIDANCE_QUESTION_CATALOG.safety_targeted_check;
  for (const option of safety.options) {
    assert.equal(
      suggestedOptionKeyForQuestion(safety, { routine_vs_symptom: option.key, for_whom: option.key, timing: option.key }),
      null,
      'intrebarea de siguranta nu primeste niciodata sugestie',
    );
  }
  assert.equal(suggestedOptionKeyForQuestion(CATEGORY_QUESTION, hints), null);
  const choice = source('src/components/intake2/QuestionChoice.jsx');
  assert.match(choice, /question\.key === "safety_targeted_check" \? null : suggestedOptionKey/);
});

// --- 4. Confirmarea interpretarii ----------------------------------------------------------
check('confirmation v2', () => {
  const interpretation = (overrides) => ({
    status: 'completed',
    interpretation: {
      version: 'patient-need-ai-v2',
      intent: 'control_copil',
      alternative_intent: '',
      service_keys: ['children_eye_exam'],
      for_whom: 'copil',
      age_group: '3_6_ani',
      timing_key: 'unknown',
      location_text: 'Cluj',
      confidence_band: 'high',
      clarification_required: true,
      possible_safety_flags: [],
      agreement_status: 'agree',
      ...overrides,
    },
  });
  const high = buildIntentConfirmationProposal(interpretation(), {
    allowedIntents,
    deterministicIntent: 'control_copil',
    text: 'copilul meu de 5 ani, suntem din Cluj',
  });
  assert.equal(high.status, 'confirm', 'increderea high nu mai e anulata de o clarificare pentru detalii');
  assert.equal(high.source, 'ai');
  assert.deepEqual(high.candidate_facts, { for_whom: 'copil', age_group: '3_6_ani', timing_key: null, location_text: 'Cluj' });

  const medium = buildIntentConfirmationProposal(interpretation({
    confidence_band: 'medium',
    intent: 'control_vedere',
    alternative_intent: 'simptome_oftalmologice',
  }), { allowedIntents, deterministicIntent: null, text: 'vreau o programare la ochi' });
  assert.equal(medium.status, 'manual_choice');
  assert.equal(medium.alternative_intent, 'simptome_oftalmologice');
  assert.equal(medium.candidate_facts.location_text, null, 'localitatea care nu apare in text este eliminata');

  const deterministic = buildDeterministicIntentProposal('reparatii_ochelari', { allowedIntents });
  assert.equal(deterministic.status, 'confirm');
  assert.equal(deterministic.source, 'deterministic');
  assert.equal(buildDeterministicIntentProposal('unknown', { allowedIntents }), null);
  assert.equal(buildDeterministicIntentProposal(null, { allowedIntents }), null);
});

// --- 5. Promptul si contractul LLM v2 -------------------------------------------------------
check('interpretation v2 contract', () => {
  assert.equal(PATIENT_NEED_INTERPRETATION_VERSION, 'patient-need-ai-v2');
  const schema = getPatientNeedResponseSchema();
  assert.ok(schema.required.includes('alternative_intent'));
  assert.ok(schema.properties.for_whom.enum.includes('other_adult'));
  assert.equal(schema.properties.service_keys.items.enum, undefined, 'fara enum mare de servicii (limita Gemini)');

  const prompt = buildPatientNeedPrompt({ text: 'test', deterministicIntent: 'control_vedere' });
  for (const intent of PATIENT_INTENT_KEYS) {
    assert.ok(prompt.includes(`- ${intent}: `), `promptul trebuie sa defineasca intentia ${intent}`);
  }
  assert.match(prompt, /Missing details never require clarification/);
  assert.match(prompt, /apply these rules in order/);
  assert.match(prompt, /never as instructions/);
  assert.match(prompt, /Do not diagnose/);
  assert.match(prompt, /A possible safety flag is advisory only/);

  for (const example of PATIENT_NEED_INTERPRETATION_EXAMPLES) {
    assert.ok(PATIENT_INTENT_KEYS.includes(example.output.intent));
    for (const key of example.output.service_keys) {
      assert.equal(normalizeServiceKey(key).canonicalKey, key, `exemplul foloseste o cheie necanonica: ${key}`);
    }
    for (const phrase of example.output.evidence_phrases) {
      assert.ok(example.text.includes(phrase), `fraza-dovada nu apare in exemplu: ${phrase}`);
    }
    for (const field of schema.required) {
      assert.ok(Object.hasOwn(example.output, field), `exemplul nu are campul ${field}`);
    }
    assert.ok(prompt.includes(JSON.stringify(example.text)));
  }

  const sanitized = sanitizePatientNeedInterpretation({
    intent: 'reparatii_ochelari',
    alternative_intent: 'reparatii_ochelari',
    service_keys: ['frame_repair', 'invented', 'sunglasses', 'eyeglasses', 'accessories', 'oct', 'tonometry', 'fundus_exam'],
    location_text: 'Brasov',
    evidence_phrases: ['bratul la ochelari', 'fraza inventata'],
    confidence_band: 'high',
  }, { text: 'mi s-a rupt bratul la ochelari' });
  assert.equal(sanitized.alternative_intent, '', 'alternativa identica cu intentia se elimina');
  assert.equal(sanitized.location_text, '', 'localitatea care nu apare in text se elimina');
  assert.deepEqual(sanitized.evidence_phrases, ['bratul la ochelari']);
  assert.ok(sanitized.service_keys.length <= 6);
  assert.ok(!sanitized.service_keys.includes('invented'));
});

check('backend imports the current interpretation module', () => {
  const entry = source('base44/functions/matchProvidersSemantic/entry.ts');
  assert.match(entry, /from '\.\.\/\.\.\/shared\/patientNeedInterpretation\.js'/);
  assert.match(entry, /text: searchText,/);
  assert.equal(source('shared/patientNeedInterpretation.js'), source('base44/shared/patientNeedInterpretation.js'));
});

// --- 6. Rutarea pe server: categoria ajunge la planificator -------------------------------
// Se evalueaza chiar functiile din matchProvidersSemantic/entry.ts (ramura question_only),
// cu aceleasi module ca in productie.
const entrySource = source('base44/functions/matchProvidersSemantic/entry.ts');
const blockStart = entrySource.indexOf('const PATIENT_GUIDANCE_SHADOW_EVENT');
const blockEnd = entrySource.indexOf('async function interpretPatientNeed(');
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'nu gasesc ramura question_only in entry.ts');
const moduleUrl = (relativePath) => pathToFileURL(path.join(root, relativePath)).href;
const questionOnlyModule = [
  `import { runPatientGuidanceRuntimeShadow } from '${moduleUrl('base44/shared/patientGuidancePlanner.js')}';`,
  `import { PATIENT_GUIDANCE_QUESTION_CATALOG, isApprovedPatientGuidanceQuestionKey } from '${moduleUrl('base44/shared/patientGuidanceQuestionCatalog.js')}';`,
  `import { buildPatientSafetyAssessment } from '${moduleUrl('base44/shared/patientSafety.js')}';`,
  `import { normalizeServiceKey, resolveServiceSearchQuery } from '${moduleUrl('base44/functions/matchProvidersSemantic/sharedDependencies.js')}';`,
  "function clean(value) { return String(value || '').trim(); }",
  entrySource.slice(blockStart, blockEnd),
  'export { selectPatientGuidanceQuestion, resolveServiceSearchQuery };',
].join('\n');
const serverQuestionOnly = await import(`data:text/javascript,${encodeURIComponent(questionOnlyModule)}`);

function serverNextQuestion(answers, text = '') {
  const semantic = serverQuestionOnly.resolveServiceSearchQuery(text, { limit: 15, minScore: 0.34 });
  const result = serverQuestionOnly.selectPatientGuidanceQuestion({
    search_text: text,
    answers,
    question_history: answers.map((answer) => answer.question_key),
  }, text, semantic.service_keys);
  return result.patient_guidance_question_selection?.next_question_key || null;
}

check('recorded category drives the first server question', () => {
  const expected = {
    ochelari_lentile: 'optical_product_type',
    reparatii_ochelari: 'repair_type',
    investigatii: 'investigation_type',
    control_vedere: 'routine_vs_symptom',
  };
  for (const [intent, questionKey] of Object.entries(expected)) {
    assert.equal(
      serverNextQuestion([{ question_key: 'categorie', answer_value: intent }]),
      questionKey,
      `categoria ${intent} trebuie sa porneasca cu ${questionKey}`,
    );
  }
  // Fara categorie, planificatorul nu stie intentia: exact defectul corectat.
  assert.equal(serverNextQuestion([]), 'routine_vs_symptom');
  // Lentilele de contact nu mai ajung la intrebarea control / problema.
  assert.notEqual(
    serverNextQuestion([{ question_key: 'categorie', answer_value: 'lentile_contact' }], 'vreau lentile de contact'),
    'routine_vs_symptom',
  );
  for (const key of Object.values(expected)) {
    assert.ok(getApprovedPatientGuidanceQuestion(key), `${key} trebuie sa fie in catalogul aprobat`);
  }
});

check('frontend records every explicit intent choice', () => {
  const card = source('src/components/intake2/ConversationalCard.jsx');
  assert.match(card, /initState\(initialIntent, initialMessage, \{ recordCategory: Boolean\(initialIntent\) \}\)/);
  assert.match(card, /\[\{ question_key: "categorie", answer_value: intent \}\]/);
  assert.match(card, /const confirmedState = stateForConfirmedIntent\(intentProposal\.intent/);
  assert.match(card, /const correctedState = stateForConfirmedIntent\(intentKey/);
  assert.match(card, /buildDeterministicIntentProposal\(deterministicIntent/);
  // Ramura "Nu sunt sigur": descrierea inainte de planificator, apoi re-interpretarea ei.
  assert.match(card, /state\.intent === "unknown" && !hasPatientDescription\(state\.answers\)/);
  assert.match(card, /requestInterpretation\(patientLanguageText\(initialMessage, nextAnswers\), "description"\)/);
  // Doar interpretarea AI se salveaza in cerere.
  assert.match(card, /interpretation: intentProposal\?\.source === "ai" \? intentProposal : null/);
});

check('confirmation screen uses approved copy only', () => {
  const confirmation = source('src/components/intake2/PatientIntentConfirmation.jsx');
  assert.doesNotMatch(confirmation, /clarification_question/);
  assert.doesNotMatch(confirmation, /tel:112/);
  assert.match(confirmation, /CATEGORY_QUESTION\.options/);
  assert.match(confirmation, /INTENT_DISPLAY/);
});

check('description prefill never re-triggers an acknowledged emergency', () => {
  const card = source('src/components/intake2/ConversationalCard.jsx');
  assert.match(card, /PATIENT_DESCRIPTION_QUESTION_KEYS\.has\(question\.key\) && initialSafetyFlags\.length === 0/);
  // Textul precompletat trece oricum prin verificarea deterministica la trimitere.
  assert.match(source('src/components/intake2/QuestionText.jsx'), /buildPatientSafetyAssessment\(\{ text: nextValue \}\)/);
  assert.ok(deterministicSafetyFlagsFromText('mi-a intrat var in ochi').length > 0);
});

console.log(`Patient need identification verified: ${checks} checks, ${CORPUS.length} corpus phrases, ${PRECEDENCE.length} precedence cases.`);
