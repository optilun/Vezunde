import {
  sanitizePatientConversationLocality,
} from "./patientConversationPriorStatePolicy.js";

export const PATIENT_CONVERSATION_RUNTIME_CONTEXT_POLICY_VERSION =
  "viasee-patient-conversation-runtime-context-policy-v1";

const PATIENT_CONVERSATION_RUNTIME_LOCALE = "ro-RO";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizePatientConversationRuntimeContext(value) {
  const context = isPlainObject(value) ? value : {};
  return {
    locale: PATIENT_CONVERSATION_RUNTIME_LOCALE,
    known_locality: sanitizePatientConversationLocality(context.known_locality),
    contact_share_approved: false,
  };
}
