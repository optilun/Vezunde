export * from "./patientConversationDecisionPolicyCore.js";

import {
  applyPatientConversationDecisionPolicy as applyPatientConversationDecisionPolicyCore,
  buildPatientConversationEmergencyInterpretation as buildPatientConversationEmergencyInterpretationCore,
} from "./patientConversationDecisionPolicyCore.js";
import {
  sanitizePatientConversationRuntimeContext,
} from "./patientConversationRuntimeContextPolicy.js";

// Core diagnostics retain guidedSafetyCleared and deterministic_safety_guided_clear.

function controlledInput(input) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  return {
    ...source,
    runtimeContext: sanitizePatientConversationRuntimeContext(source.runtimeContext),
  };
}

export function buildPatientConversationEmergencyInterpretation(input = {}) {
  return buildPatientConversationEmergencyInterpretationCore(controlledInput(input));
}

export function applyPatientConversationDecisionPolicy(input = {}) {
  return applyPatientConversationDecisionPolicyCore(controlledInput(input));
}
