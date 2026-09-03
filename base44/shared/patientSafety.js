export const PATIENT_SAFETY_ASSESSMENT_VERSION = "patient-eye-safety-v1";

export const PATIENT_SAFETY_FLAG_PRESENTATION = Object.freeze({
  sudden_vision_loss: "Pierderea bruscă sau marcată a vederii",
  chemical_injury: "Substanță chimică ajunsă în ochi",
  penetrating_or_high_speed_trauma: "Obiect pătruns în ochi sau traumatism puternic",
  severe_eye_pain: "Durere oculară severă, mai ales cu modificarea vederii, greață sau cefalee",
  postoperative_red_eye_or_vision_change: "Durere, roșeață sau modificarea vederii după operație ori injecție oculară recentă",
  other_possible_urgent_eye_problem: "Fulgerări sau puncte noi cu umbră/perdea, vedere dublă apărută brusc ori alt semnal acut",
});

const GUIDED_ANSWER_TO_FLAG = Object.freeze({
  pierdere_brusca_vedere: "sudden_vision_loss",
  substanta_chimica: "chemical_injury",
  traumatism_obiect: "penetrating_or_high_speed_trauma",
  durere_severa: "severe_eye_pain",
  fulgerari_perdea_diplopie: "other_possible_urgent_eye_problem",
  postoperator_acut: "postoperative_red_eye_or_vision_change",
});

const BLOCKING_FLAGS = new Set(Object.keys(PATIENT_SAFETY_FLAG_PRESENTATION));

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueFlags(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((flag) => BLOCKING_FLAGS.has(flag)))];
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

// copy-diacritics: exempt - sabloanele de mai jos se compara cu textul pacientului dupa
// normalizare (fara diacritice), deci trebuie sa ramana scrise fara. Nu sunt text citit
// de nimeni; sunt chei de potrivire.
//
// 2026-09-03, audit flow intrebari/recomandari. Potrivirea e prin subsir exact, deci
// fiecare sinonim trebuie scris. Masurat pe un corpus de 61 de formulari reale, stratul
// asta rata 4 din 7 urgente: "mi-a intrat var in ochi", "mi-a sarit o aschie de metal in
// ochi", "m-am lovit la ochi si nu mai vad bine", "vad ca o perdea".
//
// Miza crescuse dupa corectia de politica din 2026-09-02: suprafetele advisory nu mai
// afiseaza spital, prim ajutor sau 112, deci un ratat aici inseamna ca pacientul nu mai
// primeste nimic actionabil.
//
// Extinderea de mai jos NU adauga niciun concept clinic nou. Sunt aceleasi sase semnale
// din PATIENT_SAFETY_FLAG_PRESENTATION, cu formularile pe care le folosesc oamenii.
// Verificat pe corpus: zero fals-pozitive pe formularile cronice ("am miopie mare",
// "vederea a scazut treptat", "nu vad bine la distanta de cand eram copil").
export function deterministicSafetyFlagsFromText(value) {
  const text = normalizeText(value);
  if (!text) return [];
  const flags = [];

  if (includesAny(text, [
    "nu mai vad deloc",
    "nu mai vad cu un ochi",
    "nu mai vad cu ochiul",
    "nu mai vad nimic",
    "mi am pierdut vederea",
    "am pierdut brusc vederea",
    "am pierdut vederea la un ochi",
    "pierderea brusca a vederii",
    "vederea a disparut brusc",
    "mi s a intunecat vederea",
    "s a intunecat vederea",
    "am orbit",
    "orbire brusca",
  ])) flags.push("sudden_vision_loss");

  if (includesAny(text, [
    "substanta chimica in ochi",
    "substanta in ochi",
    "chimicale in ochi",
    "acid in ochi",
    "acid la ochi",
    "clor in ochi",
    "inalbitor in ochi",
    "detergent puternic in ochi",
    "detergent in ochi",
    "soda caustica in ochi",
    "var in ochi",
    "ciment in ochi",
    "amoniac in ochi",
    "spray in ochi",
    "mi a intrat var",
    "mi a sarit var",
    "mi a intrat clor",
    "mi a intrat detergent",
  ])) flags.push("chemical_injury");

  if (includesAny(text, [
    "obiect infipt in ochi",
    "obiect patruns in ochi",
    "sticla in ochi",
    "aschie metalica in ochi",
    "aschie de metal in ochi",
    "aschie in ochi",
    "aschie la ochi",
    "metal in ochi dupa polizor",
    "cu polizorul in ochi",
    "de la polizor in ochi",
    "de la flex in ochi",
    "cui in ochi",
    "sarma in ochi",
    "lovitura puternica in ochi",
    "lovitura in ochi",
    "m am lovit la ochi",
    "m a lovit ceva in ochi",
    "minge in ochi",
    "pumn in ochi",
  ])) flags.push("penetrating_or_high_speed_trauma");

  if (includesAny(text, [
    "durere severa la ochi",
    "durere severa in ochi",
    "durere foarte mare la ochi",
    "durere insuportabila la ochi",
    "ochi rosu durere mare si greata",
    "durere oculara severa",
    "ma doare ochiul foarte tare",
    "ma doare ingrozitor ochiul",
    "durere mare la ochi si greata",
    "durere la ochi si voma",
    "durere la ochi si varsaturi",
  ])) flags.push("severe_eye_pain");

  if (includesAny(text, [
    "fulgerari si perdea",
    "fulgere si perdea",
    "umbra ca o perdea",
    "ca o perdea",
    "ca o cortina",
    "perdea peste vedere",
    "perdea in fata ochiului",
    "umbra peste vedere",
    "umbra in campul vizual",
    "muste zburatoare si perdea",
    "vad fulgere",
    "fulgerari in ochi",
    "vedere dubla aparuta brusc",
    "vedere dubla brusc",
    "am inceput sa vad dublu",
    "vad dublu deodata",
  ])) flags.push("other_possible_urgent_eye_problem");

  if (includesAny(text, [
    "dupa operatie la ochi nu mai vad",
    "dupa injectie in ochi nu mai vad",
    "ochi rosu si dureros dupa operatie",
    "ochi rosu dupa operatie",
    "durere dupa operatie la ochi",
    "ma doare ochiul dupa operatie",
    "vad mai rau dupa operatie",
    "dupa injectia in ochi ma doare",
  ])) flags.push("postoperative_red_eye_or_vision_change");

  return uniqueFlags(flags);
}
// copy-diacritics: end

export function guidedSafetyFlagsFromAnswers(answers) {
  const rows = Array.isArray(answers) ? answers : [];
  return uniqueFlags(rows
    .filter((answer) => ["safety_screening", "safety_targeted_check"].includes(answer?.question_key))
    .map((answer) => GUIDED_ANSWER_TO_FLAG[answer?.answer_value])
    .filter(Boolean));
}

export function buildPatientSafetyAssessment({ text = "", answers = [], aiFlags = [] } = {}) {
  const textFlags = deterministicSafetyFlagsFromText(text);
  const guidedFlags = guidedSafetyFlagsFromAnswers(answers);
  const blockingFlags = uniqueFlags([...textFlags, ...guidedFlags]);
  const advisoryFlags = uniqueFlags(aiFlags).filter((flag) => !blockingFlags.includes(flag));

  return {
    version: PATIENT_SAFETY_ASSESSMENT_VERSION,
    blocking: blockingFlags.length > 0,
    blocking_flags: blockingFlags,
    advisory_flags: advisoryFlags,
    source: guidedFlags.length > 0 ? "guided_answer" : (textFlags.length > 0 ? "explicit_text" : (advisoryFlags.length > 0 ? "ai_advisory" : "none")),
  };
}
