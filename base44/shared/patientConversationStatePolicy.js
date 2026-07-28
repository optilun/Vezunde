export * from "./patientConversationStatePolicyCore.js";
export {
  PATIENT_CONVERSATION_PRIOR_STATE_POLICY_VERSION,
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicy.js";

import {
  detectPatientConversationStateSignals,
  reconcilePatientConversationState as reconcilePatientConversationStateCore,
} from "./patientConversationStatePolicyCore.js";
import {
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicy.js";

function reconciledSearchReady(interpretation) {
  const carePaths = Array.isArray(interpretation?.care_path_candidates)
    ? interpretation.care_path_candidates
    : [];
  const serviceKeys = Array.isArray(interpretation?.service_keys)
    ? interpretation.service_keys
    : [];
  const locality = interpretation?.facts?.locality || {};
  return interpretation?.urgency?.level === "none"
    && Boolean(interpretation?.primary_intent)
    && interpretation.primary_intent !== "unknown"
    && carePaths.some((value) => !["unresolved", "emergency_interruption"].includes(value))
    && serviceKeys.length > 0
    && Boolean(String(locality.siruta_code || locality.city || "").trim());
}

function restoreSafePartialLocalityMetadata(result, priorState, conversation) {
  if (!result?.interpretation || !priorState?.facts?.locality) return result;
  const signals = detectPatientConversationStateSignals(conversation);
  if (signals.locality_correction_detected) return result;

  const current = result.interpretation.facts?.locality || {};
  const prior = priorState.facts.locality;
  const currentHasSearchableLocality = Boolean(String(
    current.siruta_code || current.city || "",
  ).trim());
  const priorHasSearchableLocality = Boolean(String(
    prior.siruta_code || prior.city || "",
  ).trim());
  if (currentHasSearchableLocality || priorHasSearchableLocality) return result;

  const restored = {
    ...current,
    county_code: current.county_code || prior.county_code || "",
    county: current.county || prior.county || "",
    area: current.area || prior.area || "",
  };
  if (!restored.county_code && !restored.county && !restored.area) return result;

  return {
    ...result,
    interpretation: {
      ...result.interpretation,
      facts: {
        ...(result.interpretation.facts || {}),
        locality: restored,
      },
    },
  };
}

export function reconcilePatientConversationState(input = {}) {
  const sanitizedPriorState = sanitizePatientConversationPriorState(input.priorState);
  const reconciled = reconcilePatientConversationStateCore({
    ...input,
    priorState: sanitizedPriorState,
  });
  const result = restoreSafePartialLocalityMetadata(
    reconciled,
    sanitizedPriorState,
    input.conversation,
  );
  if (
    !reconciledSearchReady(result?.interpretation)
    || result?.interpretation?.information_status?.sufficient_for_search === true
  ) {
    return result;
  }
  return {
    ...result,
    interpretation: {
      ...result.interpretation,
      information_status: {
        ...(result.interpretation.information_status || {}),
        sufficient_for_search: true,
      },
    },
  };
}
