import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from "./canonicalServiceRegistryExtended.js";
import {
  PATIENT_INTENT_KEYS,
  PATIENT_SAFETY_FLAG_KEYS,
} from "./patientNeedInterpretation.js";
import { CARE_PATH_VALUES } from "./patientGuidanceRouting.js";
import { toGuidancePlannerAgeGroup } from "./patientConversationCanonicalAdapter.js";

export const PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION =
  "viasee-patient-conversation-guidance-handoff-v1";
export const PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION =
  "patient-guidance-planner-v1";

const INTENT_SET = new Set(PATIENT_INTENT_KEYS);
const SAFETY_FLAG_SET = new Set(PATIENT_SAFETY_FLAG_KEYS);
const CONFIDENCE_SET = new Set(["high", "medium", "low"]);
const CARE_PATH_SET = new Set(
  CARE_PATH_VALUES.filter((value) => !["unresolved", "emergency_interruption"].includes(value)),
);
const PATIENT_FACING_SERVICE_SET = new Set(
  CANONICAL_SERVICE_KEYS.filter((key) => {
    const definition = getCanonicalServiceDefinition(key);
    return definition?.patient_facing !== false && definition?.b2b_only !== true;
  }),
);
const CONTROLLED_TIMING_VALUES = new Set([
  "cat_mai_repede",
  "zilele_urmatoare",
  "saptamana_aceasta",
  "nu_e_urgent",
]);
const CONTROLLED_ACUITY_VALUES = new Set([
  "sudden",
  "recent",
  "gradual",
  "recurrent",
  "not_sure",
]);

function clean(value, maxLength = 400) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20, maxLength = 240) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, maxLength))
    .filter(Boolean))].slice(0, limit);
}

function normalized(value) {
  return clean(value, 1000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function canonicalIntent(value) {
  const intent = clean(value, 80);
  return INTENT_SET.has(intent) ? intent : "unknown";
}

function canonicalServices(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeServiceKey(value).canonicalKey)
    .filter((key) => PATIENT_FACING_SERVICE_SET.has(key)))]
    .slice(0, 12);
}

function canonicalCarePaths(values) {
  return unique(values, 4, 80).filter((value) => CARE_PATH_SET.has(value));
}

function evidencePhraseForValue(value, evidencePhrases) {
  const normalizedValue = normalized(value);
  if (!normalizedValue) return "";
  return unique(evidencePhrases, 8, 160).find((phrase) => {
    const normalizedPhrase = normalized(phrase);
    return normalizedPhrase
      && (normalizedValue.includes(normalizedPhrase) || normalizedPhrase.includes(normalizedValue));
  }) || "";
}

function candidateFact(factKey, value, evidencePhrases) {
  const candidateValue = clean(value, 800);
  if (!candidateValue) return null;
  return {
    fact_key: factKey,
    value: candidateValue,
    evidence_phrase: evidencePhraseForValue(candidateValue, evidencePhrases),
  };
}

function candidateFacts(interpretation, evidencePhrases) {
  const facts = isPlainObject(interpretation?.facts) ? interpretation.facts : {};
  const rows = [];
  const forWhom = ["adult", "child"].includes(facts.for_whom) ? facts.for_whom : "";
  const guidanceAgeGroup = toGuidancePlannerAgeGroup(facts.age_group);
  const contactLensExperience = ["first_time", "experienced"].includes(
    facts.contact_lens_experience,
  ) ? facts.contact_lens_experience : "";
  const locality = isPlainObject(facts.locality)
    ? clean(facts.locality.city || facts.locality.name, 160)
    : clean(facts.locality, 160);
  const timing = CONTROLLED_TIMING_VALUES.has(facts.desired_timing)
    ? facts.desired_timing
    : "";
  const acuity = CONTROLLED_ACUITY_VALUES.has(facts.symptom_onset)
    ? facts.symptom_onset
    : "";

  rows.push(candidateFact("for_whom", forWhom, evidencePhrases));
  if (forWhom === "child" && guidanceAgeGroup) {
    rows.push(candidateFact("child_age_group", guidanceAgeGroup, evidencePhrases));
  }
  rows.push(candidateFact("locality", locality, evidencePhrases));
  rows.push(candidateFact("contact_lens_experience", contactLensExperience, evidencePhrases));
  rows.push(candidateFact(
    "investigation_reference_text",
    facts.investigation_reference_text,
    evidencePhrases,
  ));
  rows.push(candidateFact("repair_details", facts.repair_details, evidencePhrases));
  rows.push(candidateFact("symptom_description", facts.symptom_pattern, evidencePhrases));
  rows.push(candidateFact("symptom_timing_or_acuity", acuity, evidencePhrases));
  rows.push(candidateFact("timing", timing, evidencePhrases));

  return rows.filter(Boolean).slice(0, 12);
}

function handoffSafetyState(envelope) {
  const interpretation = envelope?.interpretation;
  const urgency = isPlainObject(interpretation?.urgency) ? interpretation.urgency : {};
  const missingFields = Array.isArray(interpretation?.information_status?.missing_critical_fields)
    ? interpretation.information_status.missing_critical_fields
    : [];
  const blocking = urgency.level === "confirmed"
    || interpretation?.next_action === "show_emergency_guidance"
    || (Array.isArray(interpretation?.care_path_candidates)
      && interpretation.care_path_candidates.includes("emergency_interruption"));
  if (blocking) return "blocking";
  const advisory = urgency.level === "possible"
    || urgency.needs_clarification === true
    || missingFields.includes("symptom_severity")
    || (Array.isArray(envelope?.diagnostics?.advisory_safety_flags)
      && envelope.diagnostics.advisory_safety_flags.length > 0);
  return advisory ? "advisory" : "clear";
}

function safetyFlags(envelope) {
  return unique([
    ...(envelope?.diagnostics?.advisory_safety_flags || []),
    ...(envelope?.diagnostics?.decision_policy?.deterministic_safety_flags || []),
  ], 6, 80).filter((flag) => SAFETY_FLAG_SET.has(flag));
}

function emptySemanticProposal() {
  return {
    primary_intent: "unknown",
    alternative_intents: [],
    candidate_service_keys: [],
    extracted_facts: [],
    candidate_care_paths: [],
    next_question_key: null,
    confidence_band: "low",
    possible_safety_flags: [],
    evidence_phrases: [],
  };
}

export function buildPatientConversationGuidanceHandoff(envelope = {}) {
  const interpretation = isPlainObject(envelope?.interpretation)
    ? envelope.interpretation
    : null;
  if (envelope?.status !== "completed" || !interpretation) {
    return {
      contract_version: PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
      target_planner_version: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
      status: "unavailable",
      reason: clean(envelope?.reason, 160) || "conversation_interpretation_unavailable",
      safety_state: "unchecked",
      planner_allowed: false,
      semantic_proposal: emptySemanticProposal(),
      missing_critical_fields: [],
      authority: {
        semantic_fields: "candidate_only",
        confirmed_facts: "controlled_answers_only",
        safety: "viasee_deterministic_policy",
        next_question: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
      },
    };
  }

  const state = handoffSafetyState(envelope);
  const evidencePhrases = unique(interpretation.evidence_phrases, 8, 160);
  const primaryIntent = canonicalIntent(interpretation.primary_intent);
  const alternativeIntents = unique(interpretation.alternative_intents, 3, 80)
    .map(canonicalIntent)
    .filter((intent) => intent !== "unknown" && intent !== primaryIntent);
  const confidence = CONFIDENCE_SET.has(interpretation.understanding_confidence)
    ? interpretation.understanding_confidence
    : "low";
  const missingCriticalFields = unique(
    interpretation?.information_status?.missing_critical_fields,
    8,
    80,
  );

  return {
    contract_version: PATIENT_CONVERSATION_GUIDANCE_HANDOFF_VERSION,
    target_planner_version: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
    status: state === "blocking" ? "safety_blocked" : "ready",
    reason: state === "blocking" ? "deterministic_safety_block" : null,
    safety_state: state,
    planner_allowed: state !== "blocking",
    semantic_proposal: {
      primary_intent: primaryIntent,
      alternative_intents: alternativeIntents,
      candidate_service_keys: state === "blocking"
        ? []
        : canonicalServices(interpretation.service_keys),
      extracted_facts: state === "blocking"
        ? []
        : candidateFacts(interpretation, evidencePhrases),
      candidate_care_paths: state === "blocking"
        ? []
        : canonicalCarePaths(interpretation.care_path_candidates),
      next_question_key: null,
      confidence_band: confidence,
      possible_safety_flags: safetyFlags(envelope),
      evidence_phrases: evidencePhrases,
    },
    missing_critical_fields: missingCriticalFields,
    authority: {
      semantic_fields: "candidate_only",
      confirmed_facts: "controlled_answers_only",
      safety: "viasee_deterministic_policy",
      next_question: PATIENT_CONVERSATION_GUIDANCE_TARGET_PLANNER_VERSION,
    },
  };
}
