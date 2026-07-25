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

export function reconcilePatientConversationState(input = {}) {
  return reconcilePatientConversationStateCore({
    ...input,
    priorState: sanitizePatientConversationPriorState(input.priorState),
  });
}
