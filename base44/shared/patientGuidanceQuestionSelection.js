import {
  isApprovedPatientGuidanceQuestionKey,
} from "./patientGuidanceQuestionCatalog.js";

export const PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION =
  "patient-guidance-question-selection-v1";

function clean(value, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function unique(values, limit = 20) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value, 160))
      .filter(Boolean),
  )].slice(0, limit);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function approvedQuestionHistory(values) {
  return unique(values, 30).filter((key) => isApprovedPatientGuidanceQuestionKey(key));
}

export function buildPatientGuidanceQuestionSelection(profile = {}, options = {}) {
  const routingProfile = isPlainObject(profile?.routing_profile)
    ? profile.routing_profile
    : null;
  const aiStatus = clean(profile?.ai_status, 40);
  const deterministicOnly = aiStatus === "not_requested";
  const plannerAvailable = Boolean(routingProfile)
    && (profile?.status === "completed" || deterministicOnly);
  const askedQuestionKeys = approvedQuestionHistory(options.askedQuestionKeys);
  const answeredQuestionKeys = approvedQuestionHistory(options.answeredQuestionKeys);
  const proposedQuestionKey = clean(profile?.next_question_key, 80);
  const safetyBlocking = profile?.safety_state === "blocking"
    || routingProfile?.safety_state === "blocking";

  const base = {
    contract_version: PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
    question_catalog_version: clean(routingProfile?.question_catalog_version, 80)
      || "patient-guidance-questions-v1",
    status: "fallback",
    next_question_key: null,
    fallback_reason: null,
    safety_blocking: safetyBlocking,
    asked_question_count: askedQuestionKeys.length,
  };

  if (!plannerAvailable) {
    return {
      ...base,
      fallback_reason: profile?.status === "fallback"
        ? (clean(profile?.fallback_reason, 80) || "planner_unavailable")
        : "planner_invalid",
    };
  }
  if (safetyBlocking) {
    return { ...base, status: "safety_blocked" };
  }
  if (!proposedQuestionKey) {
    return { ...base, status: "complete" };
  }
  if (!isApprovedPatientGuidanceQuestionKey(proposedQuestionKey)) {
    return { ...base, status: "invalid", fallback_reason: "question_not_in_catalog" };
  }
  if (answeredQuestionKeys.includes(proposedQuestionKey)) {
    return { ...base, status: "invalid", fallback_reason: "answered_question_reselected" };
  }
  if (askedQuestionKeys.includes(proposedQuestionKey)) {
    return { ...base, status: "fallback", fallback_reason: "question_loop_prevented" };
  }

  return {
    ...base,
    status: "selected",
    next_question_key: proposedQuestionKey,
  };
}
