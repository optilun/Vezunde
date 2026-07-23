import { detectPatientConversationStateSignals } from "./patientConversationStatePolicy.js";

export const PATIENT_CONVERSATION_STATE_DELTA_REDUCER_VERSION = "viasee-patient-conversation-state-delta-reducer-v1";

const FACT_FIELDS = new Set([
  "for_whom",
  "age_group",
  "symptom_onset",
  "symptom_duration",
  "symptom_pattern",
  "desired_timing",
  "contact_lens_experience",
  "prescription_status",
  "investigation_reference_text",
  "repair_details",
  "user_constraints",
]);

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, 80))
    .filter(Boolean))].slice(0, limit);
}

function normalized(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => clean(item, 240)).sort());
  if (isPlainObject(value)) {
    return JSON.stringify(Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, clean(item, 240)])));
  }
  return clean(value, 1000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameValue(left, right) {
  return normalized(left) === normalized(right);
}

function emptyFactValue(field) {
  if (["for_whom", "age_group", "contact_lens_experience", "prescription_status"].includes(field)) {
    return "unknown";
  }
  if (field === "user_constraints") return [];
  return "";
}

function clearAllowed(field, signals) {
  if (field === "primary_intent") return signals.intent_replacement_detected;
  if (field === "locality") return signals.locality_correction_detected;
  if (["for_whom", "age_group"].includes(field)) return signals.subject_correction_detected;
  if (field === "desired_timing") return signals.timing_correction_detected;
  if (field.startsWith("symptom_")) return signals.symptom_correction_detected;
  if (field === "user_constraints") return signals.intent_replacement_detected;
  if ([
    "contact_lens_experience",
    "prescription_status",
    "investigation_reference_text",
    "repair_details",
  ].includes(field)) return signals.intent_replacement_detected;
  return false;
}

function localityValue(value) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: clean(locality.siruta_code, 40),
    city: clean(locality.city, 120),
    county_code: clean(locality.county_code, 40),
    county: clean(locality.county, 120),
    area: clean(locality.area, 160),
  };
}

export function reducePatientConversationSemanticStateDelta({
  interpretation,
  priorState,
  conversation,
  semanticStateDelta,
} = {}) {
  const current = isPlainObject(interpretation) ? {
    ...interpretation,
    alternative_intents: [...(Array.isArray(interpretation.alternative_intents)
      ? interpretation.alternative_intents
      : [])],
    care_path_candidates: [...(Array.isArray(interpretation.care_path_candidates)
      ? interpretation.care_path_candidates
      : [])],
    service_keys: [...(Array.isArray(interpretation.service_keys)
      ? interpretation.service_keys
      : [])],
    provider_type_candidates: [...(Array.isArray(interpretation.provider_type_candidates)
      ? interpretation.provider_type_candidates
      : [])],
    facts: {
      ...(isPlainObject(interpretation.facts) ? interpretation.facts : {}),
      locality: localityValue(interpretation?.facts?.locality),
      user_constraints: [...(Array.isArray(interpretation?.facts?.user_constraints)
        ? interpretation.facts.user_constraints
        : [])],
    },
    information_status: {
      ...(isPlainObject(interpretation.information_status)
        ? interpretation.information_status
        : {}),
      missing_critical_fields: [...(Array.isArray(interpretation?.information_status?.missing_critical_fields)
        ? interpretation.information_status.missing_critical_fields
        : [])],
    },
  } : interpretation;
  const prior = isPlainObject(priorState) ? priorState : null;
  const delta = isPlainObject(semanticStateDelta) ? semanticStateDelta : {};
  const requestedFields = delta.correction_detected === true
    ? unique(delta.clear_fields, 14)
    : [];
  const signals = detectPatientConversationStateSignals(conversation);
  const appliedFields = [];
  const replacementPreservedFields = [];
  const rejectedFields = [];

  if (!isPlainObject(current) || !prior || requestedFields.length === 0) {
    return {
      interpretation: current,
      diagnostics: {
        reducer_version: PATIENT_CONVERSATION_STATE_DELTA_REDUCER_VERSION,
        correction_requested: delta.correction_detected === true,
        requested_fields: requestedFields,
        applied_fields: [],
        replacement_preserved_fields: [],
        rejected_fields: requestedFields,
      },
    };
  }

  for (const field of requestedFields) {
    if (!clearAllowed(field, signals)) {
      rejectedFields.push(field);
      continue;
    }

    if (field === "primary_intent") {
      const priorIntent = clean(prior.primary_intent, 80) || "unknown";
      const currentIntent = clean(current.primary_intent, 80) || "unknown";
      if (currentIntent !== "unknown" && currentIntent !== priorIntent) {
        replacementPreservedFields.push(field);
        continue;
      }
      current.primary_intent = "unknown";
      current.alternative_intents = [];
      current.care_path_candidates = [];
      current.service_keys = [];
      current.provider_type_candidates = [];
      current.need_summary = "";
      current.next_action = "ask_clarifying_question";
      current.information_status.sufficient_for_search = false;
      if (!current.information_status.missing_critical_fields.includes("need")) {
        current.information_status.missing_critical_fields.push("need");
      }
      appliedFields.push(field);
      continue;
    }

    if (field === "locality") {
      const currentLocality = localityValue(current.facts.locality);
      const priorLocality = localityValue(prior?.facts?.locality);
      const hasReplacement = Boolean(currentLocality.siruta_code || currentLocality.city)
        && !sameValue(currentLocality, priorLocality);
      if (hasReplacement) {
        replacementPreservedFields.push(field);
        continue;
      }
      current.facts.locality = localityValue(null);
      if (!current.information_status.missing_critical_fields.includes("locality")) {
        current.information_status.missing_critical_fields.push("locality");
      }
      current.information_status.sufficient_for_search = false;
      appliedFields.push(field);
      continue;
    }

    if (!FACT_FIELDS.has(field)) {
      rejectedFields.push(field);
      continue;
    }

    const currentValue = current.facts[field];
    const priorValue = prior?.facts?.[field];
    const currentPresent = normalized(currentValue)
      && !["unknown", "[]", "{}"].includes(normalized(currentValue));
    const replacementExists = currentPresent && !sameValue(currentValue, priorValue);
    if (replacementExists) {
      replacementPreservedFields.push(field);
      continue;
    }
    current.facts[field] = emptyFactValue(field);
    appliedFields.push(field);
  }

  return {
    interpretation: current,
    diagnostics: {
      reducer_version: PATIENT_CONVERSATION_STATE_DELTA_REDUCER_VERSION,
      correction_requested: delta.correction_detected === true,
      requested_fields: requestedFields,
      applied_fields: [...new Set(appliedFields)].sort(),
      replacement_preserved_fields: [...new Set(replacementPreservedFields)].sort(),
      rejected_fields: [...new Set(rejectedFields)].sort(),
    },
  };
}
