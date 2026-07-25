export * from "./patientConversationStatePolicyCore.js";

import {
  reconcilePatientConversationState as reconcilePatientConversationStateCore,
} from "./patientConversationStatePolicyCore.js";
import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from "./canonicalServiceRegistryExtended.js";
import { PATIENT_INTENT_KEYS } from "./patientNeedInterpretation.js";
import { deriveCandidateCarePaths } from "./patientGuidanceRouting.js";
import { redactPatientConversationText } from "./patientConversationGuardrails.js";

const INTENT_SET = new Set(PATIENT_INTENT_KEYS);
const FOR_WHOM_SET = new Set(["adult", "child", "unknown"]);
const AGE_GROUP_SET = new Set([
  "sub_3_ani",
  "3_6_ani",
  "7_12_ani",
  "13_18_ani",
  "adult",
  "unknown",
]);
const CONTACT_LENS_EXPERIENCE_SET = new Set(["first_time", "experienced", "unknown"]);
const PRESCRIPTION_STATUS_SET = new Set(["has_prescription", "needs_prescription", "unknown"]);
const PATIENT_FACING_SERVICE_SET = new Set(
  CANONICAL_SERVICE_KEYS.filter((key) => {
    const definition = getCanonicalServiceDefinition(key);
    return definition?.patient_facing !== false && definition?.b2b_only !== true;
  }),
);
const REDACTION_MARKER_PATTERN = /\[(?:email|telefon|identificator) eliminat\]/i;
const LOCALITY_TEXT_PATTERN = /^[\p{L}\p{M}\d .,'’()\/-]+$/u;
const COUNTY_CODE_SET = new Set([
  "AB", "AG", "AR", "B", "BC", "BH", "BN", "BR", "BT", "BV", "BZ",
  "CJ", "CL", "CS", "CT", "CV", "DB", "DJ", "GJ", "GL", "GR", "HD",
  "HR", "IF", "IL", "IS", "MH", "MM", "MS", "NT", "OT", "PH", "SB",
  "SJ", "SM", "SV", "TL", "TM", "TR", "VL", "VN", "VS",
]);

function clean(value, maxLength = 400) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20, maxLength = 240) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value, maxLength))
      .filter(Boolean),
  )].slice(0, limit);
}

function controlledEnum(value, allowedValues, fallback = "unknown") {
  const normalized = clean(value, 80);
  return allowedValues.has(normalized) ? normalized : fallback;
}

function canonicalIntent(value) {
  const intent = clean(value, 80);
  return INTENT_SET.has(intent) ? intent : "unknown";
}

function canonicalPatientServiceKeys(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeServiceKey(value).canonicalKey)
      .filter((key) => PATIENT_FACING_SERVICE_SET.has(key)),
  )].slice(0, 12);
}

function controlledLocalityText(value, maxLength) {
  const redacted = redactPatientConversationText(value, maxLength)
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!redacted || REDACTION_MARKER_PATTERN.test(redacted)) return "";
  if (!LOCALITY_TEXT_PATTERN.test(redacted) || !/[\p{L}\p{M}]/u.test(redacted)) return "";
  return redacted;
}

function controlledSirutaCode(value) {
  const code = clean(value, 10);
  return /^[1-9]\d{0,5}$/.test(code) ? code : "";
}

function controlledCountyCode(value) {
  const code = clean(value, 4).toUpperCase();
  return COUNTY_CODE_SET.has(code) ? code : "";
}

function sanitizedLocality(value) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: controlledSirutaCode(locality.siruta_code),
    city: controlledLocalityText(locality.city || locality.name, 120),
    county_code: controlledCountyCode(locality.county_code),
    county: controlledLocalityText(locality.county || locality.county_name, 120),
    area: controlledLocalityText(locality.area, 160),
  };
}

function sanitizedPriorFacts(value) {
  const facts = isPlainObject(value) ? value : {};
  return {
    for_whom: controlledEnum(facts.for_whom, FOR_WHOM_SET),
    age_group: controlledEnum(facts.age_group, AGE_GROUP_SET),
    locality: sanitizedLocality(facts.locality),
    symptom_onset: redactPatientConversationText(facts.symptom_onset, 240),
    symptom_duration: redactPatientConversationText(facts.symptom_duration, 240),
    symptom_pattern: redactPatientConversationText(facts.symptom_pattern, 400),
    desired_timing: redactPatientConversationText(facts.desired_timing, 240),
    contact_lens_experience: controlledEnum(
      facts.contact_lens_experience,
      CONTACT_LENS_EXPERIENCE_SET,
    ),
    prescription_status: controlledEnum(
      facts.prescription_status,
      PRESCRIPTION_STATUS_SET,
    ),
    investigation_reference_text: redactPatientConversationText(
      facts.investigation_reference_text,
      500,
    ),
    repair_details: redactPatientConversationText(facts.repair_details, 500),
    user_constraints: unique(facts.user_constraints, 8, 240)
      .map((value) => redactPatientConversationText(value, 240)),
  };
}

function sanitizedPriorState(value) {
  if (!isPlainObject(value)) return null;

  const primaryIntent = canonicalIntent(value.primary_intent);
  const serviceKeys = canonicalPatientServiceKeys(value.service_keys);
  const facts = sanitizedPriorFacts(value.facts);
  const derivedCarePaths = deriveCandidateCarePaths({
    intent: primaryIntent,
    confirmedServiceKeys: serviceKeys,
    confirmedFacts: {
      for_whom: facts.for_whom,
      child_age_group: facts.age_group,
      contact_lens_experience: facts.contact_lens_experience,
      prescription_status: facts.prescription_status,
      investigation_reference_text: facts.investigation_reference_text,
      repair_details: facts.repair_details,
      locality: facts.locality,
      timing: facts.desired_timing,
      symptom_description: facts.symptom_pattern,
      symptom_timing_or_acuity: facts.symptom_onset || facts.symptom_duration,
    },
    safetyState: "unchecked",
  }).filter((carePath) => carePath !== "emergency_interruption").slice(0, 4);

  return {
    contract_version: clean(value.contract_version, 80),
    need_summary: redactPatientConversationText(value.need_summary, 500),
    primary_intent: primaryIntent,
    alternative_intents: unique(value.alternative_intents, 3, 80)
      .filter((intent) => INTENT_SET.has(intent) && intent !== "unknown"),
    care_path_candidates: derivedCarePaths,
    service_keys: serviceKeys,
    provider_type_candidates: [],
    facts,
  };
}

export function reconcilePatientConversationState(input = {}) {
  return reconcilePatientConversationStateCore({
    ...input,
    priorState: sanitizedPriorState(input.priorState),
  });
}
