import {
  PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
  buildPatientProviderCandidateContract,
  normalizePatientAgeGroup,
  normalizePatientSubject,
  toGuidancePlannerAgeGroup,
  toLegacyPatientNeedSubject,
} from "./patientConversationCanonicalAdapter.js";

export const PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION = "viasee-patient-conversation-canonical-boundary-v1";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const providerCandidates = buildPatientProviderCandidateContract(
    interpretation.service_keys,
  );

  return {
    interpretation: {
      ...interpretation,
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
      provider_profile_type_count:
        providerCandidates.provider_profile_type_candidates.length,
      location_provider_type_count:
        providerCandidates.location_provider_type_candidates.length,
      compatibility_provider_type_alias: true,
    },
  };
}
