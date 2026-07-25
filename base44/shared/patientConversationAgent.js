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
import {
  sanitizePatientConversationTurns,
} from "./patientConversationGuardrails.js";

export function buildPatientConversationAgentPrompt(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  const fallbackText = source.text
    || source.search_text
    || source.query
    || source.free_text
    || source.search_query
    || "";
  const conversation = sanitizePatientConversationTurns(source.conversation, fallbackText);
  return buildPatientConversationAgentPromptCore({
    ...source,
    conversation,
    text: "",
    priorState: sanitizePatientConversationPriorState(source.priorState),
    runtimeContext: sanitizePatientConversationRuntimeContext(source.runtimeContext),
  });
}
