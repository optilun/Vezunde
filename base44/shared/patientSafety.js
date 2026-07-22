export const PATIENT_SAFETY_ASSESSMENT_VERSION = "patient-eye-safety-v1";

export const PATIENT_SAFETY_FLAG_PRESENTATION = Object.freeze({
  sudden_vision_loss: "Pierderea brusca sau marcata a vederii",
  chemical_injury: "Substanta chimica ajunsa in ochi",
  penetrating_or_high_speed_trauma: "Obiect patruns in ochi sau traumatism puternic",
  severe_eye_pain: "Durere oculara severa, mai ales cu modificarea vederii, greata sau cefalee",
  postoperative_red_eye_or_vision_change: "Durere, roseata sau modificarea vederii dupa operatie ori injectie oculara recenta",
  other_possible_urgent_eye_problem: "Fulgerari sau puncte noi cu umbra/perdea, vedere dubla aparuta brusc ori alt semnal acut",
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

export function deterministicSafetyFlagsFromText(value) {
  const text = normalizeText(value);
  if (!text) return [];
  const flags = [];

  if (includesAny(text, [
    "nu mai vad deloc",
    "nu mai vad cu un ochi",
    "mi am pierdut vederea",
    "pierderea brusca a vederii",
    "vederea a disparut brusc",
    "orbire brusca",
  ])) flags.push("sudden_vision_loss");

  if (includesAny(text, [
    "substanta chimica in ochi",
    "acid in ochi",
    "clor in ochi",
    "inalbitor in ochi",
    "detergent puternic in ochi",
    "soda caustica in ochi",
  ])) flags.push("chemical_injury");

  if (includesAny(text, [
    "obiect infipt in ochi",
    "obiect patruns in ochi",
    "sticla in ochi",
    "aschie metalica in ochi",
    "metal in ochi dupa polizor",
    "lovitura puternica in ochi",
  ])) flags.push("penetrating_or_high_speed_trauma");

  if (includesAny(text, [
    "durere severa la ochi",
    "durere foarte mare la ochi",
    "durere insuportabila la ochi",
    "ochi rosu durere mare si greata",
    "durere oculara severa",
    "ma doare foarte tare ochiul",
    "doare foarte tare ochiul",
  ])) flags.push("severe_eye_pain");

  if (includesAny(text, [
    "fulgerari si perdea",
    "fulgere si perdea",
    "umbra ca o perdea",
    "muste zburatoare si perdea",
    "vedere dubla aparuta brusc",
    "vad dublu deodata",
  ])) flags.push("other_possible_urgent_eye_problem");

  if (includesAny(text, [
    "dupa operatie la ochi nu mai vad",
    "dupa injectie in ochi nu mai vad",
    "ochi rosu si dureros dupa operatie",
    "durere dupa operatie la ochi",
  ])) flags.push("postoperative_red_eye_or_vision_change");

  return uniqueFlags(flags);
}

export function guidedSafetyFlagsFromAnswers(answers) {
  const rows = Array.isArray(answers) ? answers : [];
  return uniqueFlags(rows
    .filter((answer) => answer?.question_key === "safety_screening")
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