import {
  sanitizePatientConversationLocality,
} from "./patientConversationPriorStatePolicy.js";

export const PATIENT_CONVERSATION_RUNTIME_CONTEXT_POLICY_VERSION =
  "viasee-patient-conversation-runtime-context-policy-v1";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function controlledLocale(value) {
  const locale = String(value ?? "").trim().toLocaleLowerCase("ro-RO");
  return locale === "ro" || locale === "ro-ro" ? "ro-RO" : "ro-RO";
}

export function sanitizePatientConversationRuntimeContext(value) {
  const context = isPlainObject(value) ? value : {};
  return {
    locale: controlledLocale(context.locale),
    known_locality: sanitizePatientConversationLocality(context.known_locality),
    contact_share_approved: false,
  };
}
