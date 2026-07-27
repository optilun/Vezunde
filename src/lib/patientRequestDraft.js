import { CATEGORY_QUESTION, INTENTS } from "./intentRegistry.js";
import { PATIENT_GUIDANCE_QUESTION_CATALOG } from "../../shared/patientGuidanceQuestionCatalog.js";

export const PATIENT_QUESTIONNAIRE_VERSION = "patient-questionnaire-v1";
export const PATIENT_REQUEST_DRAFT_CONTRACT_VERSION = "patient-request-draft-v1";

function clean(value, maxLength = 800) {
  return String(value || "").trim().slice(0, maxLength);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 120)).filter(Boolean))];
}

function questionnaireKey(intent) {
  return `patient-${clean(intent, 80) || "unknown"}-v1`;
}

function questionCatalog() {
  /** @type {Map<string, any>} */
  const entries = new Map([[CATEGORY_QUESTION.key, CATEGORY_QUESTION]]);
  for (const intent of Object.values(INTENTS)) {
    for (const question of intent.questions || []) {
      if (!entries.has(question.key)) entries.set(question.key, question);
    }
  }
  for (const question of Object.values(PATIENT_GUIDANCE_QUESTION_CATALOG)) {
    entries.set(question.key, question);
  }
  return entries;
}

const QUESTIONS_BY_KEY = questionCatalog();

function answerLabel(question, answerValue) {
  if (!question) return clean(answerValue, 240);
  if (question.type === "location" || question.type === "text") return clean(answerValue, 240);
  const option = (question.options || []).find((item) => item.key === answerValue);
  return clean(option?.label || answerValue, 240);
}

function normalizedAnswers(answers) {
  return (Array.isArray(answers) ? answers : [])
    .slice(0, 30)
    .map((answer) => {
      const questionKey = clean(answer?.question_key, 80);
      const answerValue = clean(answer?.answer_value, 500);
      if (!questionKey || !answerValue) return null;
      const question = QUESTIONS_BY_KEY.get(questionKey);
      return {
        question_key: questionKey,
        question_label: clean(question?.title || questionKey, 160),
        answer_value: answerValue,
        answer_label: answerLabel(question, answerValue),
      };
    })
    .filter(Boolean);
}

export function buildPatientRequestDraft({
  state = {},
  originalMessage = "",
  interpretation = null,
} = {}) {
  const safeState = /** @type {any} */ (state || {});
  const safeInterpretation = /** @type {any} */ (interpretation || null);
  const intent = clean(safeState.intent, 80) || "unknown";
  const answers = normalizedAnswers(safeState.answers);
  const answerByKey = Object.fromEntries(answers.map((answer) => [answer.question_key, answer.answer_value]));
  const intentDefinition = INTENTS[intent] || INTENTS.unknown;
  const forWhom = answerByKey.for_whom || answerByKey.pentru_cine || null;
  const ageGroup = answerByKey.child_age_group || answerByKey.varsta_copil || null;
  const legacyForWhom = forWhom === "child" ? "copil" : forWhom;
  const legacyAgeGroup = {
    under_3: "sub_3_ani",
    "3_6": "3_6_ani",
    "7_12": "7_12_ani",
    "13_18": "13_18_ani",
  }[ageGroup] || ageGroup;

  return {
    contract_version: PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
    questionnaire_version: PATIENT_QUESTIONNAIRE_VERSION,
    questionnaire_key: questionnaireKey(intent),
    intent,
    intent_label: clean(intentDefinition?.label || "Nu sunt sigur", 120),
    original_message: clean(originalMessage, 800),
    service_keys: unique(safeState.serviceKeys),
    location_scope: clean(safeState.scope, 40) || "locality",
    city: clean(safeState.city, 120),
    county: clean(safeState.locality?.county_name, 120),
    county_code: clean(safeState.locality?.county_code, 10),
    locality_siruta_code: clean(safeState.locality?.siruta_code, 40),
    client_address_text: clean(safeState.clientAddressText, 240),
    for_whom: clean(legacyForWhom, 40) || null,
    age_group: clean(legacyAgeGroup, 40) || null,
    timing_key: clean(answerByKey.timing, 60) || null,
    answers,
    interpretation: safeInterpretation ? {
      version: clean(safeInterpretation.version, 80) || null,
      confidence_band: clean(safeInterpretation.confidence_band, 20) || null,
      agreement_status: clean(safeInterpretation.agreement_status, 30) || null,
      possible_safety_flags: unique(safeInterpretation.possible_safety_flags),
    } : null,
  };
}
