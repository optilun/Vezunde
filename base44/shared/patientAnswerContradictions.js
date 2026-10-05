// Etapa 2 (2026-10-05): contradictii intre interpretarea AI si raspunsurile date de pacient
// la butoane. Raspunsurile ghidate sunt confirmate de pacient, deci au prioritate; aici doar
// marcam neconcordanta pentru raportul admin. Nu schimba nimic din cautare.

const SYMPTOM_INTENTS = new Set(["simptome_oftalmologice"]);
const ROUTINE_INTENTS = new Set(["control_vedere", "control_copil"]);

export function detectAnswerContradictions(interpretation, answers) {
  const byKey = Object.fromEntries((Array.isArray(answers) ? answers : [])
    .map((a) => [String(a?.question_key || ""), String(a?.answer_value || "")]));
  const intent = interpretation?.intent || "unknown";
  const flags = [];

  const routine = byKey.routine_vs_symptom;
  if (routine === "routine" && SYMPTOM_INTENTS.has(intent)) flags.push("answer_routine_vs_ai_symptom");
  if (routine === "symptom" && ROUTINE_INTENTS.has(intent)) flags.push("answer_symptom_vs_ai_routine");

  const forWhom = byKey.for_whom;
  const aiForWhom = interpretation?.for_whom;
  if ((forWhom === "child" || forWhom === "copil") && aiForWhom === "adult") flags.push("answer_child_vs_ai_adult");
  if (forWhom === "adult" && aiForWhom === "copil") flags.push("answer_adult_vs_ai_child");

  if (byKey.optical_product_type === "contact_lenses" && intent !== "unknown" && intent !== "lentile_contact") {
    flags.push("answer_contact_lenses_vs_ai_other");
  }
  return flags;
}

export const ANSWER_PRIORITY_RULES = [
  "GUIDED ANSWERS: guided_answers were confirmed by the patient by pressing a button. They override the free text.",
  "If the free text contradicts a guided answer, follow the guided answer for intent and for_whom, and set confidence_band to low.",
  "Never copy an evidence phrase that is not present verbatim in the patient text.",
];