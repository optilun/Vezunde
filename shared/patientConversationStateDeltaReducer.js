export * from "./patientConversationStateDeltaReducerCore.js";

import {
  reducePatientConversationSemanticStateDelta as reducePatientConversationSemanticStateDeltaCore,
} from "./patientConversationStateDeltaReducerCore.js";
import {
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicy.js";

export function reducePatientConversationSemanticStateDelta(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  return reducePatientConversationSemanticStateDeltaCore({
    ...source,
    priorState: sanitizePatientConversationPriorState(source.priorState),
  });
}
