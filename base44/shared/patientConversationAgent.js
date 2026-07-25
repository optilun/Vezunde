export * from "./patientConversationAgentCore.js";

import {
  buildPatientConversationAgentPrompt as buildPatientConversationAgentPromptCore,
} from "./patientConversationAgentCore.js";
import {
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicy.js";
import {
  sanitizePatientConversationRuntimeContext,
} from "./patientConversationRuntimeContextPolicy.js";

export function buildPatientConversationAgentPrompt(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  return buildPatientConversationAgentPromptCore({
    ...source,
    priorState: sanitizePatientConversationPriorState(source.priorState),
    runtimeContext: sanitizePatientConversationRuntimeContext(source.runtimeContext),
  });
}
