import { getCanonicalServiceDefinition } from "./canonicalServiceRegistryExtended.js";
import {
  PATIENT_EYE_SAFETY_POLICY_VERSION,
  PATIENT_SAFETY_FLAG_PRESENTATION,
  assessPatientEyeSafety,
} from "./patientEyeSafetyPolicy.js";
import {
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
  buildPatientEmergencyGuidanceMessage,
} from "./patientEmergencyGuidance.js";

export const PATIENT_CONVERSATION_DECISION_POLICY_VERSION = "viasee-patient-conversation-decision-policy-v1";
export const PATIENT_CONVERSATION_SAFETY_POLICY_VERSION = PATIENT_EYE_SAFETY_POLICY_VERSION;
export const PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE = PATIENT_EMERGENCY_GUIDANCE_MESSAGE;

const PATIENT_FACING_PROFILE_TYPES = new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
]);

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, 240))
    .filter(Boolean))].slice(0, limit);
}

function hasLocality(locality) {
  return Boolean(clean(locality?.siruta_code, 40) || clean(locality?.city, 120));
}

function cloneLocality(value) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: clean(locality.siruta_code, 40),
    city: clean(locality.city || locality.name, 120),
    county_code: clean(locality.county_code, 40),
    county: clean(locality.county || locality.county_name, 120),
    area: clean(locality.area, 160),
  };
}

function derivedProviderProfileTypes(serviceKeys) {
  return [...new Set(unique(serviceKeys, 12).flatMap((serviceKey) => {
    const definition = getCanonicalServiceDefinition(serviceKey);
    return Array.isArray(definition?.applicable_profile_types)
      ? definition.applicable_profile_types
      : [];
  }).filter((profileType) => PATIENT_FACING_PROFILE_TYPES.has(profileType)))].slice(0, 8);
}

function deterministicAssistantMessage(nextAction, safetyFlags = []) {
  if (nextAction === "show_emergency_guidance") {
    return buildPatientEmergencyGuidanceMessage(safetyFlags);
  }
  if (nextAction === "ask_locality") {
    return "In ce oras sau zona doresti sa cauti?";
  }
  if (nextAction === "ask_clarifying_question") {
    return "Pentru siguranta si o cautare corecta, poti clarifica pe scurt ce ai nevoie sa rezolvi?";
  }
  if (nextAction === "search_providers") {
    return "Am suficiente informatii pentru a continua cautarea.";
  }
  return "";
}

export function assessPatientConversationDeterministicSafety(conversation, answers = []) {
  return assessPatientEyeSafety({ conversation, answers });
}

export function buildPatientConversationEmergencyInterpretation({
  contractVersion,
  conversation,
  answers,
  runtimeContext,
} = {}) {
  const safety = assessPatientConversationDeterministicSafety(conversation, answers);
  if (!safety.blocking) return null;

  const knownLocality = cloneLocality(runtimeContext?.known_locality);
  const emergencyMessage = buildPatientEmergencyGuidanceMessage(safety.blocking_flags);
  return {
    interpretation: {
      contract_version: clean(contractVersion, 80),
      language: "ro",
      need_summary: "Semnal ocular acut care necesita evaluare urgenta.",
      primary_intent: "simptome_oftalmologice",
      alternative_intents: [],
      care_path_candidates: ["emergency_interruption"],
      service_keys: [],
      provider_type_candidates: [],
      facts: {
        for_whom: "unknown",
        age_group: "unknown",
        locality: knownLocality,
        symptom_onset: "",
        symptom_duration: "",
        symptom_pattern: "",
        desired_timing: "",
        contact_lens_experience: "unknown",
        prescription_status: "unknown",
        investigation_reference_text: "",
        repair_details: "",
        user_constraints: [],
      },
      urgency: {
        level: "confirmed",
        needs_clarification: false,
        reason: safety.blocking_flags
          .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag] || flag)
          .join("; "),
      },
      understanding_confidence: "high",
      information_status: {
        sufficient_for_search: false,
        sufficient_for_specialist_message: false,
        missing_critical_fields: [],
      },
      next_action: "show_emergency_guidance",
      assistant_message: emergencyMessage,
      specialist_summary: null,
      evidence_phrases: [],
    },
    diagnostics: {
      policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
      safety_policy_version: safety.policy_version,
      deterministic_safety_state: safety.state,
      deterministic_safety_preflight: true,
      deterministic_safety_flags: safety.blocking_flags,
      deterministic_safety_advisory_flags: safety.advisory_flags,
      deterministic_safety_cleared_flags: safety.cleared_flags,
      deterministic_safety_guided_clear: safety.source === "guided_clear",
      model_invoked: false,
      model_urgency_advisory: null,
      model_next_action_ignored: null,
      provider_types_derived: true,
      decision_source: "deterministic_safety_preflight",
    },
  };
}

export function applyPatientConversationDecisionPolicy({
  interpretation,
  conversation,
  answers,
  runtimeContext,
  stateDiagnostics,
} = {}) {
  if (!isPlainObject(interpretation)) {
    return {
      interpretation,
      diagnostics: {
        policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
        decision_source: "invalid_interpretation",
      },
    };
  }

  const current = {
    ...interpretation,
    alternative_intents: unique(interpretation.alternative_intents, 3),
    care_path_candidates: unique(interpretation.care_path_candidates, 4),
    service_keys: unique(interpretation.service_keys, 12),
    facts: {
      ...(isPlainObject(interpretation.facts) ? interpretation.facts : {}),
      locality: cloneLocality(interpretation?.facts?.locality),
      user_constraints: unique(interpretation?.facts?.user_constraints, 8),
    },
    urgency: { ...(isPlainObject(interpretation.urgency) ? interpretation.urgency : {}) },
    information_status: {
      ...(isPlainObject(interpretation.information_status)
        ? interpretation.information_status
        : {}),
      missing_critical_fields: unique(
        interpretation?.information_status?.missing_critical_fields,
        8,
      ),
    },
  };

  const safety = assessPatientEyeSafety({
    conversation,
    answers,
    aiFlags: interpretation?.possible_safety_flags,
  });
  const guidedSafetyCleared = safety.source === "guided_clear";
  const modelUrgency = ["none", "possible", "confirmed"].includes(current.urgency?.level)
    ? current.urgency.level
    : "none";
  const modelNextAction = clean(current.next_action, 80);
  const modelProviderTypes = unique(current.provider_type_candidates, 8);
  const localityWasCleared = stateDiagnostics?.locality_correction_detected === true
    && Array.isArray(stateDiagnostics?.cleared_stale_fields)
    && stateDiagnostics.cleared_stale_fields.includes("locality");
  const knownLocality = cloneLocality(runtimeContext?.known_locality);
  let localitySource = hasLocality(current.facts.locality) ? "interpretation" : "missing";

  if (!localityWasCleared && !hasLocality(current.facts.locality) && hasLocality(knownLocality)) {
    current.facts.locality = knownLocality;
    localitySource = "runtime_context";
  }

  const providerTypes = derivedProviderProfileTypes(current.service_keys);
  current.provider_type_candidates = providerTypes;

  let urgencyLevel = "none";
  let urgencyNeedsClarification = false;
  let urgencyReason = "";
  if (safety.blocking) {
    urgencyLevel = "confirmed";
    urgencyReason = safety.blocking_flags
      .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag] || flag)
      .join("; ");
  } else if (safety.advisory
    || (!guidedSafetyCleared && ["possible", "confirmed"].includes(modelUrgency))) {
    urgencyLevel = "possible";
    urgencyNeedsClarification = true;
    urgencyReason = "Semnal ocular neclar; necesita clarificare controlata.";
  }

  const hasIntent = clean(current.primary_intent, 80)
    && current.primary_intent !== "unknown";
  const hasServices = current.service_keys.length > 0;
  const localityPresent = hasLocality(current.facts.locality);
  const missingCriticalFields = [];

  if (!hasIntent) missingCriticalFields.push("need");
  if (!hasServices) missingCriticalFields.push("service");
  if (!localityPresent && urgencyLevel === "none") missingCriticalFields.push("locality");
  if (urgencyLevel === "possible") missingCriticalFields.push("symptom_severity");

  let nextAction = "ask_clarifying_question";
  if (urgencyLevel === "confirmed") {
    nextAction = "show_emergency_guidance";
  } else if (urgencyLevel === "possible") {
    nextAction = "ask_clarifying_question";
  } else if (!hasIntent || !hasServices) {
    nextAction = "ask_clarifying_question";
  } else if (!localityPresent) {
    nextAction = "ask_locality";
  } else {
    nextAction = "search_providers";
  }

  const sufficientForSearch = nextAction === "search_providers";
  current.urgency = {
    level: urgencyLevel,
    needs_clarification: urgencyNeedsClarification,
    reason: urgencyReason,
  };
  current.information_status = {
    sufficient_for_search: sufficientForSearch,
    sufficient_for_specialist_message: false,
    missing_critical_fields: missingCriticalFields,
  };
  current.next_action = nextAction;
  current.assistant_message = deterministicAssistantMessage(nextAction, safety.blocking_flags);
  current.specialist_summary = null;

  return {
    interpretation: current,
    diagnostics: {
      policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
      safety_policy_version: safety.policy_version,
      deterministic_safety_state: safety.state,
      deterministic_safety_preflight: false,
      deterministic_safety_flags: safety.blocking_flags,
      deterministic_safety_advisory_flags: safety.advisory_flags,
      deterministic_safety_cleared_flags: safety.cleared_flags,
      deterministic_safety_guided_clear: guidedSafetyCleared,
      model_invoked: true,
      model_urgency_advisory: modelUrgency,
      model_urgency_overridden: modelUrgency !== urgencyLevel,
      model_next_action_advisory: modelNextAction || null,
      model_next_action_ignored: modelNextAction !== nextAction,
      model_provider_type_count: modelProviderTypes.length,
      derived_provider_type_count: providerTypes.length,
      provider_types_derived: true,
      locality_source: localitySource,
      locality_correction_respected: localityWasCleared,
      search_ready: sufficientForSearch,
      decision_source: safety.blocking
        ? "deterministic_safety"
        : (urgencyLevel === "possible"
          ? "deterministic_clarification"
          : "deterministic_search_readiness"),
    },
  };
}
