export * from "./patientConversationStatePolicyCore.js";
export {
  PATIENT_CONVERSATION_PRIOR_STATE_POLICY_VERSION,
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicy.js";

import {
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

export function reconcilePatientConversationState(input = {}) {
  const result = reconcilePatientConversationStateCore({
    ...input,
    priorState: sanitizePatientConversationPriorState(input.priorState),
  });
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
