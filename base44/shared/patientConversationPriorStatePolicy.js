export * from "./patientConversationPriorStatePolicyCore.js";

import {
  sanitizePatientConversationPriorState,
} from "./patientConversationPriorStatePolicyCore.js";

function emptyLocality() {
  return {
    siruta_code: "",
    city: "",
    county_code: "",
    county: "",
    area: "",
  };
}

export function sanitizePatientConversationLocality(value) {
  const sanitized = sanitizePatientConversationPriorState({
    facts: { locality: value },
  });
  return sanitized?.facts?.locality || emptyLocality();
}
