// Scurta anamneza pentru cererile de consult.
//
// 2026-09-24, cerere explicita a owner-ului: "pentru cei care vor sa se programeze la un
// consult sa se faca si o scurta anamneza". Un singur ecran, cu intrebari optionale, pus dupa
// chestionar si inainte de verificarea cererii.
//
// Reguli de autoritate si confidentialitate:
//  - intrebarile si variantele sunt text fix, aprobat aici; modelul AI nu le formuleaza;
//  - raspunsurile NU schimba potrivirea, ordinea rezultatelor sau Top 3 si NU sunt trimise
//    modelului AI;
//  - raspunsurile se salveaza in cerere (acordul "datele si raspunsurile mele"). Furnizorii NU
//    le primesc automat: acordul de distribuire enumera exact ce vad locatiile Pro din Top 3.
//    Pacientul le poate trimite medicului in mesajul de la final, unde apar precompletate si
//    unde le vede, le modifica sau le sterge inainte de trimitere.

export const PATIENT_ANAMNESIS_VERSION = "patient-anamnesis-v1";
export const PATIENT_ANAMNESIS_MARKER_KEY = "anamneza";
export const PATIENT_ANAMNESIS_KEY_PREFIX = "anamneza_";

// Titlurile sunt formulate neutru, ca sa se potriveasca si cand pacientul cauta pentru
// altcineva (un parinte, un partener).
export const ADULT_ANAMNESIS_QUESTIONS = Object.freeze([
  {
    key: "anamneza_corectie",
    title: "Ochelari sau lentile de contact",
    type: "single",
    options: [
      { key: "nu", label: "Nu poartă" },
      { key: "ochelari", label: "Ochelari" },
      { key: "lentile", label: "Lentile de contact" },
      { key: "ambele", label: "Ambele" },
    ],
  },
  {
    key: "anamneza_afectiuni",
    title: "Afecțiuni cunoscute",
    type: "multi",
    exclusive_option: "niciuna",
    options: [
      { key: "diabet", label: "Diabet" },
      { key: "hipertensiune", label: "Tensiune arterială mare" },
      { key: "glaucom", label: "Glaucom sau tensiune oculară mare" },
      { key: "cataracta", label: "Cataractă" },
      { key: "alta_boala_ochi", label: "Altă boală a ochilor" },
      { key: "niciuna", label: "Niciuna" },
    ],
  },
  {
    key: "anamneza_interventii",
    title: "Operații sau laser la ochi",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "cataracta", label: "Operație de cataractă" },
      { key: "laser_refractiv", label: "Laser pentru dioptrii" },
      { key: "alta", label: "Altă operație sau injecții în ochi" },
    ],
  },
  {
    key: "anamneza_picaturi",
    title: "Picături pentru ochi folosite regulat",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "da", label: "Da" },
    ],
  },
  {
    key: "anamneza_familie",
    title: "Glaucom în familie",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "da", label: "Da" },
      { key: "nu_stiu", label: "Nu știu" },
    ],
  },
]);

export const CHILD_ANAMNESIS_QUESTIONS = Object.freeze([
  {
    key: "anamneza_copil_ochelari",
    title: "Copilul poartă deja ochelari?",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "da", label: "Da" },
    ],
  },
  {
    key: "anamneza_copil_semne",
    title: "Ai observat la copil…",
    type: "multi",
    exclusive_option: "niciunul",
    options: [
      { key: "aproape_ecran", label: "Se apropie mult de ecran sau de carte" },
      { key: "mijeste", label: "Mijește ochii" },
      { key: "ochi_deviat", label: "Un ochi pare să fugă în lateral" },
      { key: "dureri_cap", label: "Se plânge de dureri de cap" },
      { key: "niciunul", label: "Niciunul" },
    ],
  },
  {
    key: "anamneza_copil_familie",
    title: "În familie: ochelari purtați de mic, strabism sau ochi leneș",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "da", label: "Da" },
      { key: "nu_stiu", label: "Nu știu" },
    ],
  },
  {
    key: "anamneza_copil_prematur",
    title: "Născut prematur",
    type: "single",
    options: [
      { key: "nu", label: "Nu" },
      { key: "da", label: "Da" },
      { key: "nu_stiu", label: "Nu știu" },
    ],
  },
]);

export const PATIENT_ANAMNESIS_QUESTIONS = Object.freeze([
  ...ADULT_ANAMNESIS_QUESTIONS,
  ...CHILD_ANAMNESIS_QUESTIONS,
]);

const QUESTION_BY_KEY = new Map(PATIENT_ANAMNESIS_QUESTIONS.map((question) => [question.key, question]));

// Nevoile pentru care pacientul ajunge la un consult. Reparatiile si cumpararea de ochelari
// sau lentile cu reteta nu primesc anamneza.
const CONSULT_INTENTS = new Set([
  "control_vedere",
  "control_copil",
  "simptome_oftalmologice",
  "investigatii",
]);

function answerMap(answers = []) {
  return Object.fromEntries((Array.isArray(answers) ? answers : [])
    .filter((answer) => answer?.question_key)
    .map((answer) => [answer.question_key, String(answer.answer_value || "")]));
}

export function isPatientAnamnesisKey(questionKey) {
  const key = String(questionKey || "");
  return key === PATIENT_ANAMNESIS_MARKER_KEY || key.startsWith(PATIENT_ANAMNESIS_KEY_PREFIX);
}

export function patientAnamnesisDone(answers = []) {
  return Object.hasOwn(answerMap(answers), PATIENT_ANAMNESIS_MARKER_KEY);
}

/**
 * @param {{ intent?: string | null, answers?: any[] }} [input]
 * @returns {boolean}
 */
export function patientNeedsAnamnesis({ intent, answers = [] } = {}) {
  if (patientAnamnesisDone(answers)) return false;
  if (CONSULT_INTENTS.has(intent)) return true;
  const byKey = answerMap(answers);
  if (intent === "ochelari_lentile") {
    return byKey.prescription_status === "needs_exam" || byKey.reteta === "needs_exam";
  }
  if (intent === "lentile_contact") {
    // Cheile istorice: prima_data "da" inseamna prima adaptare.
    return byKey.contact_lens_experience === "first_time" || byKey.prima_data === "da";
  }
  return false;
}

/**
 * @param {{ intent?: string | null, answers?: any[] }} [input]
 * @returns {"adult" | "child"}
 */
export function patientAnamnesisVariant({ intent, answers = [] } = {}) {
  const byKey = answerMap(answers);
  if (intent === "control_copil" || byKey.for_whom === "child" || byKey.pentru_cine === "copil") return "child";
  return "adult";
}

export function patientAnamnesisQuestions(variant) {
  return variant === "child" ? CHILD_ANAMNESIS_QUESTIONS : ADULT_ANAMNESIS_QUESTIONS;
}

// Normalizeaza selectiile din ecran. Valorile multiple se salveaza ca o singura valoare, cu
// cheile separate prin virgula, in ordinea din catalog. Ecranul nu permite "Niciuna" impreuna
// cu o afectiune; daca totusi ajung amandoua, pastram afectiunile - e mai sigur sa nu pierdem
// o afectiune declarata decat sa pierdem un "Niciuna".
export function normalizeAnamnesisSelection(question, selected) {
  if (!question) return [];
  const allowed = new Set(question.options.map((option) => option.key));
  const values = [...new Set((Array.isArray(selected) ? selected : [selected]).filter((value) => allowed.has(value)))];
  if (question.type !== "multi") return values.slice(0, 1);
  const exclusive = question.exclusive_option;
  const specific = values.filter((value) => value !== exclusive);
  if (exclusive && values.includes(exclusive) && specific.length === 0) return [exclusive];
  return question.options.map((option) => option.key).filter((key) => specific.includes(key));
}

// Comutarea unei variante in ecran: varianta exclusiva le goleste pe celelalte si invers.
export function toggleAnamnesisSelection(question, current = [], optionKey) {
  const values = Array.isArray(current) ? current : [];
  if (question?.type !== "multi") return values[0] === optionKey ? [] : [optionKey];
  if (values.includes(optionKey)) return values.filter((value) => value !== optionKey);
  if (optionKey === question.exclusive_option) return [optionKey];
  return [...values.filter((value) => value !== question.exclusive_option), optionKey];
}

// 2026-09-24, test live: pacientul scrisese "am tensiune oculara mare", iar anamneza pornea
// goala. Afectiunile deja spuse in mesaj pornesc bifate; ecranul spune asta explicit, iar
// pacientul le poate debifa. Primeste setul de afectiuni detectat de
// detectPatientConditionsFromText (src/lib/patientVisitGuidance.js), ca sa evitam un import
// circular intre cele doua module.
const CONDITION_TO_AFFECTION = Object.freeze({
  diabet: "diabet",
  hipertensiune: "hipertensiune",
  glaucom: "glaucom",
  cataracta: "cataracta",
});

export function buildAnamnesisPrefill(variant, conditions = new Set()) {
  if (variant !== "adult") return {};
  const values = new Set(conditions instanceof Set ? conditions : []);
  const selections = {};
  const affections = Object.entries(CONDITION_TO_AFFECTION)
    .filter(([condition]) => values.has(condition))
    .map(([, option]) => option);
  if (affections.length > 0) selections.anamneza_afectiuni = affections;
  if (values.has("glaucom_familie")) selections.anamneza_familie = ["da"];
  return selections;
}

export function buildPatientAnamnesisAnswers(variant, selections = {}, { skipped = false } = {}) {
  const answers = [];
  if (!skipped) {
    for (const question of patientAnamnesisQuestions(variant)) {
      const values = normalizeAnamnesisSelection(question, selections[question.key]);
      if (values.length > 0) answers.push({ question_key: question.key, answer_value: values.join(",") });
    }
  }
  answers.push({
    question_key: PATIENT_ANAMNESIS_MARKER_KEY,
    answer_value: skipped || answers.length === 0 ? "sarita" : "completata",
  });
  return answers;
}

export function getPatientAnamnesisQuestion(questionKey) {
  return QUESTION_BY_KEY.get(String(questionKey || "")) || null;
}

export function patientAnamnesisAnswerLabel(questionKey, answerValue) {
  const question = getPatientAnamnesisQuestion(questionKey);
  if (!question) return String(answerValue || "");
  return String(answerValue || "")
    .split(",")
    .map((value) => question.options.find((option) => option.key === value.trim())?.label)
    .filter(Boolean)
    .join(", ");
}

// Afectiunile declarate sau mentionate, folosite de recomandari.
export function patientAnamnesisConditions(answers = []) {
  const byKey = answerMap(answers);
  const conditions = new Set(String(byKey.anamneza_afectiuni || "").split(",").filter(Boolean));
  conditions.delete("niciuna");
  if (byKey.anamneza_interventii === "cataracta") conditions.add("operat_cataracta");
  if (["lentile", "ambele"].includes(byKey.anamneza_corectie)) conditions.add("poarta_lentile");
  if (byKey.anamneza_picaturi === "da") conditions.add("picaturi");
  if (byKey.anamneza_familie === "da") conditions.add("glaucom_familie");
  return conditions;
}

// Textul propus pentru mesajul catre locatiile Pro din Top 3. Pacientul il vede integral in
// formular si decide daca il trimite. Formularile evita cuvintele care ar declansa verificarea
// deterministica de urgenta (verificat in scripts/verify-patient-anamnesis-guidance.mjs).
export function buildPatientAnamnesisMessage(answers = []) {
  const rows = (Array.isArray(answers) ? answers : [])
    .filter((answer) => answer?.question_key?.startsWith(PATIENT_ANAMNESIS_KEY_PREFIX))
    .map((answer) => {
      const question = getPatientAnamnesisQuestion(answer.question_key);
      const label = patientAnamnesisAnswerLabel(answer.question_key, answer.answer_value);
      return question && label ? `${question.title.replace(/[?…]$/, "")}: ${label}` : "";
    })
    .filter(Boolean);
  if (rows.length === 0) return "";
  return `Pentru consult (anamneză): ${rows.join("; ")}.`;
}
