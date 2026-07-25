import {
  sanitizePatientConversationLocality,
} from "./patientConversationPriorStatePolicy.js";

export const PATIENT_CONVERSATION_RUNTIME_CONTEXT_POLICY_VERSION =
  "viasee-patient-conversation-runtime-context-policy-v1";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function sanitizePatientConversationRuntimeContext(value) {
  const context = isPlainObject(value) ? value : {};
  return {
    locale: clean(context.locale, 20) || "ro-RO",
    known_locality: sanitizePatientConversationLocality(context.known_locality),
    contact_share_approved: false,
  };
}
