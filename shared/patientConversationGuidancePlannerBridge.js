import {
  PATIENT_GUIDANCE_PLANNER_VERSION,
  PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
  buildPatientGuidancePlannerProfile,
  buildPatientGuidanceQuestionSelection,
  sanitizePatientGuidancePlannerProposal,
} from "./patientGuidancePlanner.js";
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
} from "./patientGuidanceQuestionCatalog.js";
import {
  PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
  PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
} from "./patientConversationGuidanceHandoff.js";

export const PATIENT_CONVERSATION_GUIDANCE_PLANNER_BRIDGE_VERSION =
  "viasee-patient-conversation-guidance-planner-bridge-v1";

const SAFETY_STATES = new Set(["clear", "advisory", "blocking"]);

function clean(value, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function controlledQuestionKeys(values, limit = 30) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, 80))
    .filter(Boolean))]
    .slice(0, limit);
}

function controlledGuidedAnswers(values, limit = 30) {
  return (Array.isArray(values) ? values : [])
    .slice(0, limit)
    .map((answer) => ({
      question_key: clean(answer?.question_key, 80),
      answer_value: answer?.answer_value,
    }))
    .filter((answer) => answer.question_key && answer.answer_value !== undefined);
}

function controlledLocality(value) {
  if (!isPlainObject(value)) return null;
  const locality = {
    siruta_code: clean(value.siruta_code, 40),
    city: clean(value.city || value.name, 120),
    county_code: clean(value.county_code, 40),
    county: clean(value.county || value.county_name, 120),
  };
  const result = Object.fromEntries(
    Object.entries(locality).filter(([, item]) => Boolean(item)),
  );
  return Object.keys(result).length > 0 ? result : null;
}

function fallbackSelection(reason, askedQuestionCount = 0) {
  return {
    contract_version: PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
    question_catalog_version: PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
    status: "fallback",
    next_question_key: null,
    fallback_reason: reason,
    safety_blocking: false,
    asked_question_count: askedQuestionCount,
  };
}

function safetyBlockedSelection(askedQuestionCount = 0) {
  return {
    contract_version: PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
    question_catalog_version: PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
    status: "safety_blocked",
    next_question_key: null,
    fallback_reason: null,
    safety_blocking: true,
    asked_question_count: askedQuestionCount,
  };
}

function authorityValid(handoff) {
  return handoff?.authority?.semantic_fields === "candidate_only"
    && handoff?.authority?.confirmed_facts === "controlled_answers_only"
    && handoff?.authority?.safety === "viasee_deterministic_policy"
    && handoff?.authority?.next_question === PATIENT_GUIDANCE_PLANNER_VERSION;
}

function validateHandoff(handoff, text) {
  if (!isPlainObject(handoff)) return "handoff_required";
  if (handoff.contract_version !== PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION) {
    return "handoff_contract_version_mismatch";
  }
  if (
    handoff.target_planner_version !== PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION
    || handoff.target_planner_version !== PATIENT_GUIDANCE_PLANNER_VERSION
  ) {
    return "planner_contract_version_mismatch";
  }
  if (!authorityValid(handoff)) return "handoff_authority_invalid";
  if (!SAFETY_STATES.has(handoff.safety_state) && handoff.safety_state !== "unchecked") {
    return "handoff_safety_state_invalid";
  }
  if (!isPlainObject(handoff.semantic_proposal)) return "semantic_proposal_required";
  if (handoff.semantic_proposal.next_question_key !== null) {
    return "handoff_question_authority_violation";
  }

  const sanitized = sanitizePatientGuidancePlannerProposal(
    handoff.semantic_proposal,
    { text: clean(text, 1200) },
  );
  if (!sanitized.valid) return "semantic_proposal_invalid";
  if (sanitized.proposal?.next_question_key !== null) {
    return "handoff_question_authority_violation";
  }
  return null;
}

function resultBase(status, reason, questionSelection) {
  return {
    contract_version: PATIENT_CONVERSATION_GUIDANCE_PLANNER_BRIDGE_VERSION,
    target_planner_version: PATIENT_GUIDANCE_PLANNER_VERSION,
    status,
    reason,
    question_selection: questionSelection,
    authority: {
      handoff_source: "server_internal_only",
      semantic_fields: "candidate_only",
      confirmed_facts: "controlled_answers_only",
      safety: "viasee_deterministic_policy",
      next_question: PATIENT_GUIDANCE_PLANNER_VERSION,
    },
  };
}

export function consumePatientConversationGuidanceHandoff({
  handoff,
  text = "",
  controlledContext = {},
} = {}) {
  const askedQuestionKeys = controlledQuestionKeys(controlledContext.question_history);
  const answeredQuestionKeys = controlledQuestionKeys(
    (Array.isArray(controlledContext.guided_answers)
      ? controlledContext.guided_answers
      : []).map((answer) => answer?.question_key),
  );
  const askedQuestionCount = askedQuestionKeys.length;

  if (handoff?.status === "unavailable") {
    return resultBase(
      "fallback",
      clean(handoff.reason, 160) || "conversation_handoff_unavailable",
      fallbackSelection("conversation_handoff_unavailable", askedQuestionCount),
    );
  }

  const validationReason = validateHandoff(handoff, text);
  if (validationReason) {
    return resultBase(
      "invalid",
      validationReason,
      fallbackSelection(validationReason, askedQuestionCount),
    );
  }

  if (
    handoff.status === "safety_blocked"
    || handoff.safety_state === "blocking"
    || handoff.planner_allowed !== true
  ) {
    return resultBase(
      "safety_blocked",
      "deterministic_safety_block",
      safetyBlockedSelection(askedQuestionCount),
    );
  }

  if (handoff.status !== "ready") {
    return resultBase(
      "fallback",
      "handoff_not_ready",
      fallbackSelection("handoff_not_ready", askedQuestionCount),
    );
  }

  const guidedAnswers = controlledGuidedAnswers(controlledContext.guided_answers);
  const explicitLocality = controlledLocality(controlledContext.explicit_locality);
  const explicitPrimaryIntent = clean(controlledContext.explicit_primary_intent, 80);
  const explicitConfirmedServiceKeys = Array.isArray(
    controlledContext.explicit_confirmed_service_keys,
  )
    ? controlledContext.explicit_confirmed_service_keys
    : [];

  let profile;
  try {
    profile = buildPatientGuidancePlannerProfile({
      text: clean(text, 1200),
      explicitPrimaryIntent,
      explicitConfirmedServiceKeys,
      explicitFacts: explicitLocality ? { locality: explicitLocality } : {},
      guidedAnswers,
      deterministicIntent: "unknown",
      deterministicServiceKeys: [],
      deterministicFacts: {},
      deterministicSafetyState: handoff.safety_state,
    }, {
      status: "completed",
      raw: handoff.semantic_proposal,
    });
  } catch (_error) {
    return resultBase(
      "fallback",
      "planner_unavailable",
      fallbackSelection("planner_unavailable", askedQuestionCount),
    );
  }

  const selection = buildPatientGuidanceQuestionSelection(profile, {
    askedQuestionKeys,
    answeredQuestionKeys,
  });
  const completedStatuses = new Set(["selected", "complete", "safety_blocked"]);
  const status = completedStatuses.has(selection?.status)
    ? selection.status
    : "fallback";
  const confirmedFacts = isPlainObject(profile?.confirmed_facts)
    ? profile.confirmed_facts
    : {};
  const factSources = isPlainObject(profile?.fact_sources)
    ? profile.fact_sources
    : {};
  const confirmedFactKeys = Object.keys(confirmedFacts).sort().slice(0, 24);

  return {
    ...resultBase(
      status,
      completedStatuses.has(selection?.status)
        ? null
        : (clean(selection?.fallback_reason, 160) || "planner_fallback"),
      selection,
    ),
    diagnostics: {
      handoff_safety_state: handoff.safety_state,
      semantic_candidate_intent_count:
        1 + (handoff.semantic_proposal.alternative_intents?.length || 0),
      semantic_candidate_service_count:
        handoff.semantic_proposal.candidate_service_keys?.length || 0,
      semantic_candidate_fact_count:
        handoff.semantic_proposal.extracted_facts?.length || 0,
      confirmed_fact_source: "controlled_context_only",
      planner_confirmed_fact_keys: confirmedFactKeys,
      planner_confirmed_fact_sources: Object.fromEntries(
        confirmedFactKeys.map((key) => [key, clean(factSources[key], 40) || "unknown"]),
      ),
      planner_profile_status: clean(profile?.status, 40) || "unknown",
      planner_sufficient_for_search: profile?.sufficient_for_search === true,
    },
  };
}
