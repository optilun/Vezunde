export const PATIENT_INTENT_CONFIRMATION_VERSION = "patient-intent-confirmation-v1";

const CONFIRMABLE_CONFIDENCE = new Set(["high", "medium"]);

function cleanList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

export function buildIntentConfirmationProposal(response = {}, {
  allowedIntents = [],
  deterministicIntent = null,
} = {}) {
  const allowed = new Set(allowedIntents);
  const interpretation = response?.interpretation;

  if (response?.status !== "completed" || !interpretation) {
    return {
      status: "fallback",
      intent: allowed.has(deterministicIntent) ? deterministicIntent : null,
      service_keys: [],
      confidence_band: "low",
      agreement_status: "not_comparable",
      possible_safety_flags: [],
      version: null,
    };
  }

  const interpretedIntent = allowed.has(interpretation.intent) && interpretation.intent !== "unknown"
    ? interpretation.intent
    : null;
  const confidenceBand = CONFIRMABLE_CONFIDENCE.has(interpretation.confidence_band)
    ? interpretation.confidence_band
    : "low";
  const clarificationRequired = interpretation.clarification_required === true;
  const canConfirm = Boolean(interpretedIntent)
    && CONFIRMABLE_CONFIDENCE.has(confidenceBand)
    && !clarificationRequired;

  return {
    status: canConfirm ? "confirm" : "manual_choice",
    intent: interpretedIntent,
    service_keys: cleanList(interpretation.service_keys),
    confidence_band: confidenceBand,
    agreement_status: interpretation.agreement_status || "not_comparable",
    possible_safety_flags: cleanList(interpretation.possible_safety_flags),
    version: interpretation.version || null,
  };
}
