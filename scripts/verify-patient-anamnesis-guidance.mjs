// Scurta anamneza pentru consult si recomandarile pentru vizita.
//
// 2026-09-24, cerere explicita a owner-ului: anamneza scurta pentru cine se programeaza la un
// consult si recomandari (inclusiv pentru cataracta si tensiune oculara/arteriala), fara semne
// mari "Suna la 112". Verificarile de aici blocheaza regulile de autoritate si confidentialitate:
//  - anamneza apare doar pentru consult, e optionala si nu schimba intrebarile serverului;
//  - raspunsurile nu ajung la modelul AI si nici automat la furnizori (doar prin mesajul final,
//    pe care pacientul il vede si il poate modifica);
//  - niciun text din recomandari sau din rezumatul anamnezei nu declanseaza verificarea de
//    urgenta si nu contine spital, UPU sau 112 (acestea raman doar pe ecranul de urgenta confirmata).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ADULT_ANAMNESIS_QUESTIONS,
  CHILD_ANAMNESIS_QUESTIONS,
  PATIENT_ANAMNESIS_MARKER_KEY,
  buildPatientAnamnesisAnswers,
  buildPatientAnamnesisMessage,
  isPatientAnamnesisKey,
  normalizeAnamnesisSelection,
  patientAnamnesisAnswerLabel,
  patientAnamnesisVariant,
  patientNeedsAnamnesis,
  toggleAnamnesisSelection,
} from '../src/lib/patientAnamnesis.js';
import {
  PATIENT_VISIT_GUIDANCE_DISCLAIMER,
  buildPatientVisitGuidance,
  detectPatientConditionsFromText,
} from '../src/lib/patientVisitGuidance.js';
import { buildPatientRequestDraft } from '../src/lib/patientRequestDraft.js';
import { deterministicSafetyFlagsFromText } from '../src/lib/patientSafety.js';
import {
  PATIENT_QUESTIONNAIRE_VERSION,
  PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
  PATIENT_REQUEST_PROCESSING_CONSENT_VERSION,
  sanitizePatientRequestSubmission,
} from '../shared/patientRequestPersistence.js';
import { buildProviderLeadFullDetails } from '../shared/providerLeadFullDetailsPolicy.js';

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

// --- 1. Cand apare anamneza ---------------------------------------------------------------
check('anamnesis only for consult requests', () => {
  for (const intent of ['control_vedere', 'control_copil', 'simptome_oftalmologice', 'investigatii']) {
    assert.equal(patientNeedsAnamnesis({ intent, answers: [] }), true, intent);
  }
  assert.equal(patientNeedsAnamnesis({ intent: 'reparatii_ochelari', answers: [] }), false);
  assert.equal(patientNeedsAnamnesis({ intent: 'ochelari_lentile', answers: [{ question_key: 'reteta', answer_value: 'recent_prescription' }] }), false);
  assert.equal(patientNeedsAnamnesis({ intent: 'ochelari_lentile', answers: [{ question_key: 'prescription_status', answer_value: 'needs_exam' }] }), true);
  assert.equal(patientNeedsAnamnesis({ intent: 'lentile_contact', answers: [{ question_key: 'prima_data', answer_value: 'nu' }] }), false);
  assert.equal(patientNeedsAnamnesis({ intent: 'lentile_contact', answers: [{ question_key: 'prima_data', answer_value: 'da' }] }), true);
  assert.equal(
    patientNeedsAnamnesis({ intent: 'control_vedere', answers: [{ question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'sarita' }] }),
    false,
    'o anamneza sarita nu se mai cere',
  );
  assert.equal(patientAnamnesisVariant({ intent: 'control_copil', answers: [] }), 'child');
  assert.equal(patientAnamnesisVariant({ intent: 'simptome_oftalmologice', answers: [{ question_key: 'pentru_cine', answer_value: 'copil' }] }), 'child');
  assert.equal(patientAnamnesisVariant({ intent: 'control_vedere', answers: [{ question_key: 'for_whom', answer_value: 'child' }] }), 'child');
  assert.equal(patientAnamnesisVariant({ intent: 'control_vedere', answers: [{ question_key: 'for_whom', answer_value: 'other_adult' }] }), 'adult');
});

// --- 2. Raspunsuri si etichete --------------------------------------------------------------
check('answers are normalized and optional', () => {
  const afectiuni = ADULT_ANAMNESIS_QUESTIONS.find((question) => question.key === 'anamneza_afectiuni');
  assert.deepEqual(normalizeAnamnesisSelection(afectiuni, ['glaucom', 'diabet', 'inventat']), ['diabet', 'glaucom']);
  assert.deepEqual(normalizeAnamnesisSelection(afectiuni, ['niciuna']), ['niciuna']);
  assert.deepEqual(normalizeAnamnesisSelection(afectiuni, ['niciuna', 'cataracta']), ['cataracta'], 'o afectiune declarata nu se pierde');
  assert.deepEqual(toggleAnamnesisSelection(afectiuni, ['diabet'], 'niciuna'), ['niciuna']);
  assert.deepEqual(toggleAnamnesisSelection(afectiuni, ['niciuna'], 'diabet'), ['diabet']);
  assert.deepEqual(toggleAnamnesisSelection(afectiuni, ['diabet', 'glaucom'], 'diabet'), ['glaucom']);
  const single = ADULT_ANAMNESIS_QUESTIONS.find((question) => question.key === 'anamneza_picaturi');
  assert.deepEqual(toggleAnamnesisSelection(single, ['nu'], 'da'), ['da']);
  assert.deepEqual(toggleAnamnesisSelection(single, ['da'], 'da'), []);

  const answers = buildPatientAnamnesisAnswers('adult', {
    anamneza_corectie: ['ochelari'],
    anamneza_afectiuni: ['glaucom', 'diabet'],
    anamneza_familie: ['nu_stiu'],
  });
  assert.deepEqual(answers, [
    { question_key: 'anamneza_corectie', answer_value: 'ochelari' },
    { question_key: 'anamneza_afectiuni', answer_value: 'diabet,glaucom' },
    { question_key: 'anamneza_familie', answer_value: 'nu_stiu' },
    { question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'completata' },
  ]);
  assert.deepEqual(buildPatientAnamnesisAnswers('adult', {}, { skipped: true }), [
    { question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'sarita' },
  ]);
  assert.deepEqual(buildPatientAnamnesisAnswers('child', {}), [
    { question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'sarita' },
  ], 'fara niciun raspuns, anamneza conteaza ca sarita');
  assert.equal(patientAnamnesisAnswerLabel('anamneza_afectiuni', 'diabet,glaucom'), 'Diabet, Glaucom sau tensiune oculară mare');
  assert.ok(isPatientAnamnesisKey('anamneza') && isPatientAnamnesisKey('anamneza_copil_semne'));
  assert.ok(!isPatientAnamnesisKey('for_whom'));
});

check('draft labels include anamnesis', () => {
  const draft = buildPatientRequestDraft({
    state: {
      intent: 'control_vedere',
      answers: [
        { question_key: 'categorie', answer_value: 'control_vedere' },
        { question_key: 'anamneza_afectiuni', answer_value: 'diabet,cataracta' },
        { question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'completata' },
      ],
      serviceKeys: ['optometry_consultation'],
    },
    originalMessage: 'vreau un control la ochi',
  });
  const row = draft.answers.find((answer) => answer.question_key === 'anamneza_afectiuni');
  assert.equal(row.question_label, 'Afecțiuni cunoscute');
  assert.equal(row.answer_label, 'Diabet, Cataractă');
  const marker = draft.answers.find((answer) => answer.question_key === PATIENT_ANAMNESIS_MARKER_KEY);
  assert.equal(marker.answer_label, 'Completată');
});

check('anamnesis persists with the request, providers do not receive it', () => {
  const answers = buildPatientAnamnesisAnswers('adult', { anamneza_afectiuni: ['glaucom'], anamneza_picaturi: ['da'] });
  const draft = buildPatientRequestDraft({
    state: {
      intent: 'control_vedere',
      answers: [{ question_key: 'categorie', answer_value: 'control_vedere' }, ...answers],
      serviceKeys: ['optometry_consultation'],
      city: 'Timisoara',
      locality: { siruta_code: '155243', county_name: 'Timis', county_code: 'TM' },
    },
    originalMessage: 'vreau un control la ochi pentru glaucom',
  });
  assert.equal(draft.questionnaire_version, PATIENT_QUESTIONNAIRE_VERSION);
  const sanitized = sanitizePatientRequestSubmission({
    idempotency_key: 'patient:anamnesis1234567',
    detailed_message: '',
    request_draft: { ...draft, contract_version: PATIENT_REQUEST_DRAFT_CONTRACT_VERSION },
    contact: { name: 'Ana Popescu', email: 'ana@example.com', phone: '', preference: 'email' },
    consent: { processing: true, version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION },
    recommendation: { contract_version: 'provider-recommendation-v1', results: [] },
  });
  const saved = sanitized.answers.find((answer) => answer.question_key === 'anamneza_afectiuni');
  assert.equal(saved.answer_label, 'Glaucom sau tensiune oculară mare');
  const providerView = buildProviderLeadFullDetails({ request: sanitized.request, contact: { ...sanitized.contact, contact_email_verified: true } });
  assert.ok(!JSON.stringify(providerView).includes('Glaucom'), 'detaliile pentru furnizor nu contin raspunsurile din anamneza');
});

// --- 3. Rezumatul pentru mesajul final nu declanseaza urgenta -----------------------------
check('every anamnesis summary is safety-neutral', () => {
  for (const [variant, questions] of [['adult', ADULT_ANAMNESIS_QUESTIONS], ['child', CHILD_ANAMNESIS_QUESTIONS]]) {
    const all = Object.fromEntries(questions.map((question) => [
      question.key,
      question.type === 'multi'
        ? question.options.map((option) => option.key).filter((key) => key !== question.exclusive_option)
        : [question.options[question.options.length - 1].key],
    ]));
    const variants = [all, ...questions.flatMap((question) => question.options.map((option) => ({ [question.key]: [option.key] })))];
    for (const selections of variants) {
      const message = buildPatientAnamnesisMessage(buildPatientAnamnesisAnswers(variant, selections));
      assert.deepEqual(deterministicSafetyFlagsFromText(message), [], `rezumatul declanseaza verificarea de urgenta: ${message}`);
      assert.doesNotMatch(message, /112|UPU|spital/i);
    }
  }
  assert.equal(buildPatientAnamnesisMessage([{ question_key: PATIENT_ANAMNESIS_MARKER_KEY, answer_value: 'sarita' }]), '');
});

// --- 4. Recomandari -------------------------------------------------------------------------
check('conditions from text', () => {
  const cases = [
    ['am cataracta si vreau sa ma operez', ['cataracta']],
    ['am tensiune oculara mare', ['glaucom']],
    ['am tensiune mare si diabet', ['diabet', 'hipertensiune']],
    ['vreau un control, am glaucom in familie', ['glaucom_familie']],
    ['mama are glaucom si vreau un control', ['glaucom_familie']],
    ['ma usuca ochii la calculator', ['ochi_uscat']],
    ['vreau ochelari noi', []],
  ];
  for (const [text, expected] of cases) {
    assert.deepEqual([...detectPatientConditionsFromText(text)].sort(), [...expected].sort(), text);
  }
});

const INTENTS = ['control_vedere', 'control_copil', 'simptome_oftalmologice', 'investigatii', 'ochelari_lentile', 'lentile_contact', 'reparatii_ochelari', 'unknown'];
const CONDITION_TEXTS = ['', 'am cataracta', 'am glaucom', 'am diabet', 'am tensiune arteriala mare', 'ochi uscati', 'mama are glaucom'];

check('guidance for every intent and condition stays informational', () => {
  for (const intent of INTENTS) {
    for (const text of CONDITION_TEXTS) {
      const guidance = buildPatientVisitGuidance({ intent, answers: [], text });
      assert.ok(guidance.where.length > 10, `${intent}: lipseste recomandarea "unde"`);
      assert.ok(guidance.notes.length <= 3);
      assert.equal(guidance.disclaimer, PATIENT_VISIT_GUIDANCE_DISCLAIMER);
      const allText = [guidance.where, ...guidance.prepare, ...guidance.notes.flatMap((note) => [note.title, ...note.points]), guidance.safety_net].join(' ');
      assert.doesNotMatch(allText, /112|UPU|spital|tel:/i, `${intent}/${text}: fara destinatii de urgenta in afara ecranului de urgenta`);
      assert.doesNotMatch(allText, /\bmg\b|doz[aă]|antibiotic|cortizon|diagnosticul este|ai glaucom|ai cataract/i, `${intent}/${text}: fara doze, tratamente sau diagnostic`);
      assert.deepEqual(deterministicSafetyFlagsFromText(allText.replace(guidance.safety_net, '')), [], `${intent}/${text}`);
    }
  }
});

check('condition notes', () => {
  const cataract = buildPatientVisitGuidance({ intent: 'control_vedere', text: 'am cataracta' });
  assert.equal(cataract.notes[0].key, 'cataracta');
  assert.match(cataract.where, /medic oftalmolog/);
  const glaucoma = buildPatientVisitGuidance({ intent: 'control_vedere', text: 'am tensiune oculara mare', answers: [{ question_key: 'anamneza_familie', answer_value: 'da' }] });
  assert.deepEqual(glaucoma.notes.map((note) => note.key), ['glaucom'], 'nota de glaucom in familie nu se repeta langa glaucom');
  assert.match(glaucoma.notes[0].points.join(' '), /nu întrerupe picăturile/);
  const family = buildPatientVisitGuidance({ intent: 'control_vedere', answers: [{ question_key: 'anamneza_familie', answer_value: 'da' }] });
  assert.deepEqual(family.notes.map((note) => note.key), ['glaucom_familie']);
  const fromService = buildPatientVisitGuidance({ intent: 'simptome_oftalmologice', serviceKeys: ['diabetic_retinopathy'] });
  assert.deepEqual(fromService.notes.map((note) => note.key), ['diabet']);
  assert.ok(fromService.safety_net.length > 0, 'simptomele primesc plasa de siguranta, fara 112');
  assert.equal(buildPatientVisitGuidance({ intent: 'control_vedere' }).safety_net, '');
  const operated = buildPatientVisitGuidance({ intent: 'control_vedere', answers: [{ question_key: 'anamneza_interventii', answer_value: 'cataracta' }] });
  assert.deepEqual(operated.notes.map((note) => note.key), ['operat_cataracta']);
  const lenses = buildPatientVisitGuidance({ intent: 'control_vedere', answers: [{ question_key: 'anamneza_corectie', answer_value: 'lentile' }] });
  assert.ok(lenses.prepare.some((tip) => /lentile de contact/.test(tip)));
  const repair = buildPatientVisitGuidance({ intent: 'reparatii_ochelari' });
  assert.ok(repair.prepare.some((tip) => /piesele desprinse/.test(tip)));
  const child = buildPatientVisitGuidance({ intent: 'control_copil' });
  assert.ok(child.prepare.some((tip) => /copilul este odihnit/.test(tip)));
  assert.doesNotMatch(child.where, /sub \d|ani/, 'fara praguri de varsta: regula pediatrica asteapta validare clinica');
});

// --- 5. Integrarea in flux ------------------------------------------------------------------
check('flow wiring', () => {
  const card = source('src/components/intake2/ConversationalCard.jsx');
  const draftEffect = card.slice(card.indexOf('// Chestionarul s-a incheiat.'));
  assert.ok(
    draftEffect.indexOf('patientNeedsAnamnesis') < draftEffect.indexOf('buildPatientRequestDraft'),
    'anamneza vine inaintea verificarii cererii',
  );
  assert.match(card, /\.filter\(\(answer\) => !isPatientAnamnesisKey\(answer\.question_key\)\)/, 'anamneza nu pleaca spre modelul AI');
  assert.match(card, /phase === "anamnesis"/);
  const submission = source('src/components/intake2/PatientRequestSubmission.jsx');
  assert.match(submission, /useState\(anamnesisMessage\)/, 'rezumatul porneste in mesajul vizibil si editabil');
  assert.match(submission, /Le poți modifica sau șterge/);
  assert.match(submission, /!isPatientAnamnesisKey\(answer\.question_key\)/, 'anamneza nu apare in "Locatiile vor primi"');
  const review = source('src/components/intake2/PatientRequestReview.jsx');
  assert.match(review, /buildPatientVisitGuidance/);
  assert.match(review, /Recomandări pentru vizită/);
});

// --- 6. Serverul ignora anamneza la alegerea intrebarilor ---------------------------------
const entrySource = source('base44/functions/matchProvidersSemantic/entry.ts');
const blockStart = entrySource.indexOf('const PATIENT_GUIDANCE_SHADOW_EVENT');
const blockEnd = entrySource.indexOf('async function interpretPatientNeed(');
assert.ok(blockStart >= 0 && blockEnd > blockStart);
const moduleUrl = (relativePath) => pathToFileURL(path.join(root, relativePath)).href;
const serverModule = await import(`data:text/javascript,${encodeURIComponent([
  `import { runPatientGuidanceRuntimeShadow } from '${moduleUrl('base44/shared/patientGuidancePlanner.js')}';`,
  `import { PATIENT_GUIDANCE_QUESTION_CATALOG, isApprovedPatientGuidanceQuestionKey } from '${moduleUrl('base44/shared/patientGuidanceQuestionCatalog.js')}';`,
  `import { buildPatientSafetyAssessment } from '${moduleUrl('base44/shared/patientSafety.js')}';`,
  `import { normalizeServiceKey, resolveServiceSearchQuery } from '${moduleUrl('base44/functions/matchProvidersSemantic/sharedDependencies.js')}';`,
  "function clean(value) { return String(value || '').trim(); }",
  entrySource.slice(blockStart, blockEnd),
  'export { selectPatientGuidanceQuestion };',
].join('\n'))}`);

check('server question selection ignores anamnesis answers', () => {
  const base = [{ question_key: 'categorie', answer_value: 'control_vedere' }];
  const withAnamnesis = [...base, ...buildPatientAnamnesisAnswers('adult', { anamneza_afectiuni: ['glaucom'] })];
  const select = (answers) => serverModule.selectPatientGuidanceQuestion({
    search_text: '',
    answers,
    question_history: answers.map((answer) => answer.question_key),
  }, '', []).patient_guidance_question_selection?.next_question_key;
  assert.equal(select(withAnamnesis), select(base));
});

console.log(`Patient anamnesis and visit guidance verified: ${checks} checks.`);
