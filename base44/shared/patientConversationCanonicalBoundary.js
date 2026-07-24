import {
  PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
  buildPatientProviderCandidateContract,
  normalizePatientAgeGroup,
  normalizePatientSubject,
  toGuidancePlannerAgeGroup,
  toLegacyPatientNeedSubject,
} from "./patientConversationCanonicalAdapter.js";
import {
  PATIENT_EMERGENCY_DESTINATION_POLICY,
  PATIENT_EMERGENCY_GUIDANCE_MESSAGE,
  PATIENT_EMERGENCY_GUIDANCE_VERSION,
} from "./patientEmergencyGuidance.js";

export const PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION = "viasee-patient-conversation-canonical-boundary-v1";

const EMERGENCY_SERVICE_KEY = "emergency_ophthalmology";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmergencyInterpretation(interpretation) {
  return interpretation?.next_action === "show_emergency_guidance"
    || (Array.isArray(interpretation?.care_path_candidates)
      && interpretation.care_path_candidates.includes("emergency_interruption"));
}

function canonicalServiceKeys(interpretation) {
  const source = [...new Set((Array.isArray(interpretation?.service_keys)
    ? interpretation.service_keys
    : []).filter(Boolean))].slice(0, 12);
  const emergency = isEmergencyInterpretation(interpretation);
  if (!emergency || source.includes(EMERGENCY_SERVICE_KEY)) return source;
  return [EMERGENCY_SERVICE_KEY, ...source].slice(0, 12);
}

export function applyPatientConversationCanonicalBoundary(interpretation) {
  if (!isPlainObject(interpretation)) {
    return {
      interpretation,
      diagnostics: {
        boundary_version: PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION,
        adapter_version: PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
        applied: false,
      },
    };
  }

  const facts = isPlainObject(interpretation.facts) ? interpretation.facts : {};
  const subject = normalizePatientSubject(facts.for_whom);
  const ageGroup = normalizePatientAgeGroup(facts.age_group);
  const emergency = isEmergencyInterpretation(interpretation);
  const originalServiceKeys = Array.isArray(interpretation.service_keys)
    ? interpretation.service_keys.filter(Boolean)
    : [];
  const serviceKeys = canonicalServiceKeys(interpretation);
  const providerCandidates = buildPatientProviderCandidateContract(serviceKeys);

  return {
    interpretation: {
      ...interpretation,
      service_keys: serviceKeys,
      assistant_message: emergency
        ? PATIENT_EMERGENCY_GUIDANCE_MESSAGE
        : interpretation.assistant_message,
      facts: {
        ...facts,
        for_whom: subject,
        age_group: ageGroup,
      },
      provider_profile_type_candidates:
        providerCandidates.provider_profile_type_candidates,
      location_provider_type_candidates:
        providerCandidates.location_provider_type_candidates,
      // Compatibility alias retained only while existing evaluators and consumers
      // migrate to the explicit provider_profile_type_candidates field.
      provider_type_candidates:
        providerCandidates.provider_profile_type_candidates,
    },
    diagnostics: {
      boundary_version: PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION,
      adapter_version: PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
      applied: true,
      canonical_subject: subject,
      legacy_patient_need_subject: toLegacyPatientNeedSubject(subject),
      canonical_age_group: ageGroup,
      guidance_planner_age_group: toGuidancePlannerAgeGroup(ageGroup),
      emergency_service_key_added:
        serviceKeys.includes(EMERGENCY_SERVICE_KEY)
        && !originalServiceKeys.includes(EMERGENCY_SERVICE_KEY),
      emergency_guidance_version: emergency
        ? PATIENT_EMERGENCY_GUIDANCE_VERSION
        : null,
      emergency_destination_policy: emergency
        ? PATIENT_EMERGENCY_DESTINATION_POLICY
        : null,
      provider_profile_type_count:
        providerCandidates.provider_profile_type_candidates.length,
      location_provider_type_count:
        providerCandidates.location_provider_type_candidates.length,
      compatibility_provider_type_alias: true,
    },
  };
}
