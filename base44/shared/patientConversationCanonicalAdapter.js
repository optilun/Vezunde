import { getCanonicalServiceDefinition } from "./canonicalServiceRegistryExtended.js";

export const PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION = "viasee-patient-conversation-canonical-adapter-v1";

export const PATIENT_SUBJECT_VALUES = Object.freeze(["adult", "child", "unknown"]);
export const PATIENT_AGE_GROUP_VALUES = Object.freeze([
  "sub_3_ani",
  "3_6_ani",
  "7_12_ani",
  "13_18_ani",
  "adult",
  "unknown",
]);

export const PROVIDER_PROFILE_TYPE_VALUES = Object.freeze([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor",
]);

export const LOCATION_PROVIDER_TYPE_VALUES = Object.freeze([
  "optica_medicala",
  "clinica_oftalmologica",
  "cabinet_oftalmologic",
  "cabinet_optometric",
  "laborator_optic",
  "optometrist_independent",
  "medic_oftalmolog_independent",
]);

const SUBJECT_ALIASES = Object.freeze({
  adult: "adult",
  child: "child",
  copil: "child",
  unknown: "unknown",
  necunoscut: "unknown",
});

const AGE_GROUP_ALIASES = Object.freeze({
  sub_3_ani: "sub_3_ani",
  under_3: "sub_3_ani",
  "3_6_ani": "3_6_ani",
  "3_6": "3_6_ani",
  "7_12_ani": "7_12_ani",
  "7_12": "7_12_ani",
  "13_18_ani": "13_18_ani",
  "13_18": "13_18_ani",
  adult: "adult",
  unknown: "unknown",
  not_sure: "unknown",
});

const PROFILE_TO_LOCATION_PROVIDER_TYPES = Object.freeze({
  independent_optical_store: Object.freeze(["optica_medicala"]),
  optical_chain: Object.freeze(["optica_medicala"]),
  ophthalmology_clinic: Object.freeze(["clinica_oftalmologica"]),
  ophthalmology_office: Object.freeze(["cabinet_oftalmologic"]),
  independent_ophthalmologist: Object.freeze([
    "medic_oftalmolog_independent",
    "cabinet_oftalmologic",
  ]),
  independent_optometrist: Object.freeze([
    "optometrist_independent",
    "cabinet_optometric",
  ]),
  independent_optician: Object.freeze(["optica_medicala"]),
  optical_laboratory_b2c: Object.freeze(["laborator_optic"]),
  optical_laboratory_b2b: Object.freeze(["laborator_optic"]),
  future_b2b_distributor: Object.freeze([]),
});

const PATIENT_FACING_PROFILE_TYPES = new Set(
  PROVIDER_PROFILE_TYPE_VALUES.filter((value) => ![
    "optical_laboratory_b2b",
    "future_b2b_distributor",
  ].includes(value)),
);
const PROFILE_TYPE_SET = new Set(PROVIDER_PROFILE_TYPE_VALUES);
const LOCATION_PROVIDER_TYPE_SET = new Set(LOCATION_PROVIDER_TYPE_VALUES);

function clean(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function unique(values, limit = 20) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value))
    .filter(Boolean))].slice(0, limit);
}

export function normalizePatientSubject(value) {
  return SUBJECT_ALIASES[clean(value, 40)] || "unknown";
}

export function toLegacyPatientNeedSubject(value) {
  const normalized = normalizePatientSubject(value);
  return normalized === "child" ? "copil" : normalized;
}

export function normalizePatientAgeGroup(value) {
  return AGE_GROUP_ALIASES[clean(value, 40)] || "unknown";
}

export function toGuidancePlannerAgeGroup(value) {
  const normalized = normalizePatientAgeGroup(value);
  return {
    sub_3_ani: "under_3",
    "3_6_ani": "3_6",
    "7_12_ani": "7_12",
    "13_18_ani": "13_18",
  }[normalized] || normalized;
}

export function normalizeProviderProfileTypes(values, {
  patientFacingOnly = true,
  limit = 8,
} = {}) {
  return unique(values, limit)
    .filter((value) => PROFILE_TYPE_SET.has(value))
    .filter((value) => !patientFacingOnly || PATIENT_FACING_PROFILE_TYPES.has(value))
    .slice(0, limit);
}

export function normalizeLocationProviderTypes(values, limit = 8) {
  return unique(values, limit)
    .filter((value) => LOCATION_PROVIDER_TYPE_SET.has(value))
    .slice(0, limit);
}

export function providerProfileTypesFromServiceKeys(serviceKeys, limit = 8) {
  return normalizeProviderProfileTypes(
    unique(serviceKeys, 12).flatMap((serviceKey) => {
      const definition = getCanonicalServiceDefinition(serviceKey);
      return Array.isArray(definition?.applicable_profile_types)
        ? definition.applicable_profile_types
        : [];
    }),
    { patientFacingOnly: true, limit },
  );
}

export function locationProviderTypesFromProfileTypes(profileTypes, limit = 8) {
  return normalizeLocationProviderTypes(
    normalizeProviderProfileTypes(profileTypes, {
      patientFacingOnly: false,
      limit: 20,
    }).flatMap((profileType) => PROFILE_TO_LOCATION_PROVIDER_TYPES[profileType] || []),
    limit,
  );
}

export function buildPatientProviderCandidateContract(serviceKeys) {
  const providerProfileTypes = providerProfileTypesFromServiceKeys(serviceKeys);
  return {
    provider_profile_type_candidates: providerProfileTypes,
    location_provider_type_candidates: locationProviderTypesFromProfileTypes(providerProfileTypes),
  };
}
