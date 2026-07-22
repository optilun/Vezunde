import {
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from "./canonicalServiceRegistryExtended.js";
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
  getApprovedPatientGuidanceQuestion,
  isApprovedPatientGuidanceQuestionKey,
} from "./patientGuidanceQuestionCatalog.js";

export const PATIENT_GUIDANCE_ROUTING_VERSION = "patient-guidance-routing-v1";
export const PATIENT_GUIDANCE_TOP3_POLICY_VERSION = "patient-guidance-top3-v1";

export const REQUEST_CLARITY_VALUES = Object.freeze(["exact", "partial", "guided"]);
export const CARE_PATH_VALUES = Object.freeze([
  "optical_store",
  "optometry",
  "ophthalmology",
  "specialized_ophthalmology",
  "technical_optical_service",
  "emergency_interruption",
  "unresolved",
]);
export const SEARCH_EXPANSION_POLICY_VALUES = Object.freeze([
  "local_only",
  "local_then_county",
  "county_default",
  "national_opt_in",
]);
export const TOP3_ELIGIBILITY_VALUES = Object.freeze([
  "exact_top3",
  "extended_relevant",
  "directory_only",
  "ineligible",
]);

const INTENT_KEYS = new Set([
  "control_vedere",
  "control_copil",
  "simptome_oftalmologice",
  "investigatii",
  "ochelari_lentile",
  "lentile_contact",
  "reparatii_ochelari",
  "unknown",
]);

export const PATIENT_GUIDANCE_FACT_KEYS = Object.freeze([
  "routine_vs_symptom",
  "for_whom",
  "child_age_group",
  "investigation_type",
  "investigation_reference_text",
  "optical_product_type",
  "contact_lens_experience",
  "repair_type",
  "symptom_description",
  "symptom_timing_or_acuity",
  "locality",
  "timing",
  "safety_targeted_check",
  "last_eye_exam",
  "first_eye_exam",
  "prescription_status",
  "repair_details",
]);

const FACT_KEY_SET = new Set(PATIENT_GUIDANCE_FACT_KEYS);
const SAFETY_STATES = new Set(["unchecked", "clear", "advisory", "blocking"]);

const MATRIX = /** @type {Record<string, any>} */ ({
  control_vedere: {
    required_for_search: ["routine_vs_symptom", "locality"],
    required_for_provider_request: ["routine_vs_symptom", "locality", "timing"],
    optional_facts: ["last_eye_exam", "prescription_status"],
    inferable_facts: ["for_whom"],
    exact_service_can_skip_search_facts: ["routine_vs_symptom"],
    skip_question_keys: [
      "child_age_group",
      "investigation_type",
      "contact_lens_experience",
      "repair_type",
      "symptom_description",
      "symptom_timing_or_acuity",
      "safety_targeted_check",
    ],
  },
  control_copil: {
    required_for_search: ["child_age_group", "routine_vs_symptom", "locality"],
    required_for_provider_request: ["child_age_group", "routine_vs_symptom", "locality", "timing"],
    optional_facts: ["first_eye_exam"],
    inferable_facts: ["for_whom"],
    exact_service_can_skip_search_facts: ["routine_vs_symptom"],
    skip_question_keys: [
      "investigation_type",
      "optical_product_type",
      "contact_lens_experience",
      "repair_type",
      "symptom_description",
      "symptom_timing_or_acuity",
    ],
  },
  simptome_oftalmologice: {
    required_for_search: ["symptom_description", "safety_targeted_check", "locality"],
    required_for_provider_request: [
      "symptom_description",
      "symptom_timing_or_acuity",
      "safety_targeted_check",
      "for_whom",
      "locality",
      "timing",
    ],
    optional_facts: [],
    inferable_facts: [],
    skip_question_keys: [
      "investigation_type",
      "optical_product_type",
      "contact_lens_experience",
      "repair_type",
    ],
  },
  investigatii: {
    required_for_search: ["investigation_type", "locality"],
    required_for_provider_request: ["investigation_type", "locality", "timing"],
    optional_facts: ["investigation_reference_text", "prescription_status"],
    inferable_facts: [],
    conditional_required_for_search: [
      {
        when: { investigation_type: "not_sure", confirmed_service_required: false },
        facts: ["investigation_reference_text"],
      },
    ],
    skip_question_keys: [
      "routine_vs_symptom",
      "child_age_group",
      "optical_product_type",
      "contact_lens_experience",
      "repair_type",
      "symptom_description",
      "symptom_timing_or_acuity",
    ],
  },
  ochelari_lentile: {
    required_for_search: ["optical_product_type", "locality"],
    required_for_provider_request: ["optical_product_type", "locality", "timing"],
    optional_facts: ["prescription_status"],
    inferable_facts: [],
    skip_question_keys: [
      "routine_vs_symptom",
      "child_age_group",
      "investigation_type",
      "contact_lens_experience",
      "repair_type",
      "symptom_description",
      "symptom_timing_or_acuity",
      "safety_targeted_check",
    ],
  },
  lentile_contact: {
    required_for_search: ["contact_lens_experience", "locality"],
    required_for_provider_request: ["contact_lens_experience", "locality", "timing"],
    optional_facts: ["prescription_status"],
    inferable_facts: [],
    exact_product_service_can_skip_search_facts: ["contact_lens_experience"],
    skip_question_keys: [
      "routine_vs_symptom",
      "child_age_group",
      "investigation_type",
      "optical_product_type",
      "repair_type",
      "symptom_description",
      "symptom_timing_or_acuity",
      "safety_targeted_check",
    ],
  },
  reparatii_ochelari: {
    required_for_search: ["repair_type", "locality"],
    required_for_provider_request: ["repair_type", "locality", "timing"],
    optional_facts: ["repair_details"],
    inferable_facts: [],
    skip_question_keys: [
      "routine_vs_symptom",
      "for_whom",
      "child_age_group",
      "investigation_type",
      "optical_product_type",
      "contact_lens_experience",
      "symptom_description",
      "symptom_timing_or_acuity",
      "safety_targeted_check",
    ],
  },
  unknown: {
    required_for_search: ["routine_vs_symptom"],
    required_for_provider_request: ["routine_vs_symptom"],
    optional_facts: ["locality"],
    inferable_facts: [],
    skip_question_keys: [],
  },
});

const PATH_DEFAULT_PROFILE_TYPES = /** @type {Record<string, string[]>} */ ({
  optical_store: [
    "independent_optical_store",
    "optical_chain",
    "independent_optician",
    "optical_laboratory_b2c",
  ],
  optometry: [
    "independent_optometrist",
    "independent_optical_store",
    "optical_chain",
    "ophthalmology_clinic",
    "ophthalmology_office",
  ],
  ophthalmology: [
    "ophthalmology_clinic",
    "ophthalmology_office",
    "independent_ophthalmologist",
  ],
  specialized_ophthalmology: [
    "ophthalmology_clinic",
    "ophthalmology_office",
    "independent_ophthalmologist",
  ],
  technical_optical_service: [
    "independent_optical_store",
    "optical_chain",
    "independent_optician",
    "optical_laboratory_b2c",
  ],
  emergency_interruption: [],
  unresolved: [],
});

const INTENT_FALLBACK_PATH = /** @type {Record<string, string>} */ ({
  control_vedere: "unresolved",
  control_copil: "unresolved",
  simptome_oftalmologice: "ophthalmology",
  ochelari_lentile: "optical_store",
  lentile_contact: "unresolved",
  reparatii_ochelari: "technical_optical_service",
  investigatii: "unresolved",
  unknown: "unresolved",
});

const INTENT_CANDIDATE_PATHS = /** @type {Record<string, string[]>} */ ({
  control_vedere: ["optometry", "ophthalmology"],
  control_copil: ["optometry", "ophthalmology"],
  lentile_contact: ["optical_store", "optometry", "ophthalmology"],
});

export const PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES = Object.freeze([
  Object.freeze({
    rule_key: "pediatric_age_to_care_path",
    status: "requires_clinical_validation",
    affects_current_results: false,
    blocks_activation: true,
    reason: "Pragurile de varsta pot schimba traseul dintre optometrie si oftalmologie pediatrica.",
  }),
  Object.freeze({
    rule_key: "symptom_safety_completion",
    status: "requires_clinical_validation",
    affects_current_results: false,
    blocks_activation: true,
    reason: "Setul minim de fapte pentru simptome trebuie validat clinic inainte de conectarea la wizard.",
  }),
  Object.freeze({
    rule_key: "specialized_service_trust_threshold",
    status: "requires_clinical_validation",
    affects_current_results: false,
    blocks_activation: true,
    reason: "Pragul verified pentru servicii medicale specializate este contract viitor, nu regula activa de ranking.",
  }),
  Object.freeze({
    rule_key: "contact_lens_first_time_path",
    status: "requires_clinical_validation",
    affects_current_results: false,
    blocks_activation: true,
    reason: "Traseul pentru prima adaptare trebuie validat clinic fata de simpla achizitie de produse.",
  }),
]);

const CLINICAL_VALIDATION_RULE_KEY_SET = new Set(
  PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES.map((rule) => rule.rule_key),
);

function clean(value, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 120)).filter(Boolean))];
}

export function normalizePatientGuidanceClinicalValidationApprovals(approvals = []) {
  return unique(approvals).filter((ruleKey) => CLINICAL_VALIDATION_RULE_KEY_SET.has(ruleKey));
}

export function isPatientGuidanceClinicalRuleApproved(ruleKey, approvals = []) {
  const normalizedRuleKey = clean(ruleKey, 120);
  if (!CLINICAL_VALIDATION_RULE_KEY_SET.has(normalizedRuleKey)) return false;
  return normalizePatientGuidanceClinicalValidationApprovals(approvals).includes(normalizedRuleKey);
}

function clinicalValidationApprovalsFrom(request) {
  return normalizePatientGuidanceClinicalValidationApprovals(
    request?.clinicalValidationApprovals
      ?? request?.clinical_validation_approvals
      ?? [],
  );
}

function canonicalServiceKeys(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeServiceKey(value).canonicalKey)
    .filter(Boolean))];
}

function canonicalDefinitions(values) {
  return canonicalServiceKeys(values)
    .map((key) => getCanonicalServiceDefinition(key))
    .filter(Boolean);
}

function normalizedIntent(value) {
  const intent = clean(value, 80);
  return INTENT_KEYS.has(intent) ? intent : "unknown";
}

function normalizedFacts(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, any>} */ (value)
    : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([key]) => FACT_KEY_SET.has(key))
    .map(([key, fact]) => [key, typeof fact === "string" ? clean(fact, 800) : fact]));
}

function normalizedSafetyState(value) {
  if (typeof value === "string" && SAFETY_STATES.has(value)) return value;
  const assessment = value && typeof value === "object" ? /** @type {any} */ (value) : {};
  if (assessment.blocking === true || assessment.safety_state === "blocking") return "blocking";
  if ((assessment.advisory_flags || []).length > 0 || assessment.safety_state === "advisory") return "advisory";
  if (
    assessment.blocking === false
    && ["guided_answer", "explicit_text", "none"].includes(assessment.source)
  ) return "clear";
  if (assessment.safety_state === "clear") return "clear";
  return "unchecked";
}

function factPresent(key, facts) {
  const value = facts[key];
  if (value === false || value === 0) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const normalized = clean(value, 800).toLowerCase();
    if (!normalized) return false;
    if (["unknown", "unchecked"].includes(normalized)) return false;
  }
  return true;
}

function missingFacts(keys, facts) {
  return keys.filter((key) => !factPresent(key, facts));
}

function pathForDefinition(definition) {
  const kind = clean(definition?.kind, 80);
  const group = clean(definition?.group, 80);
  const professionals = unique(definition?.required_professional_types);

  if (["investigation", "specialty", "procedure", "surgery"].includes(kind)
    || ["investigations", "specialties", "procedures_surgery"].includes(group)) {
    return "specialized_ophthalmology";
  }
  if (kind === "technical_activity" || group === "technical_activities") {
    return "technical_optical_service";
  }
  if (group === "ophthalmology_consults"
    || (professionals.includes("ophthalmologist") && !professionals.includes("optometrist"))) {
    return "ophthalmology";
  }
  if (group === "optometry") {
    return "optometry";
  }
  if (group === "children_and_prevention" || group === "contact_lenses") {
    if (professionals.length === 0) return "optical_store";
    if (professionals.includes("optometrist") && !professionals.includes("ophthalmologist")) {
      return "optometry";
    }
    if (professionals.includes("ophthalmologist") && !professionals.includes("optometrist")) {
      return "ophthalmology";
    }
    return "unresolved";
  }
  if ([
    "optical_retail",
    "lenses_and_measurements",
    "business_attributes",
  ].includes(group)) {
    return "optical_store";
  }
  return "unresolved";
}

const PATH_PRIORITY = /** @type {Record<string, number>} */ ({
  unresolved: 0,
  optical_store: 1,
  technical_optical_service: 2,
  optometry: 3,
  ophthalmology: 4,
  specialized_ophthalmology: 5,
  emergency_interruption: 6,
});

export function normalizePatientGuidanceText(value) {
  return clean(value, 1200)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasBoundedPhrase(text, phrase) {
  const normalizedPhrase = normalizePatientGuidanceText(phrase);
  if (!text || !normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  return new RegExp("(?:^|\\s)" + escaped + "(?:$|\\s)").test(text);
}

const TEXT_RULES = Object.freeze([
  { intent: "control_copil", phrases: ["consult pentru copii", "consult copii", "consult pentru copil", "control pentru copii", "control copil"] },
  { intent: "reparatii_ochelari", service_key: "frame_repair", phrases: ["reparatie rama", "reparatii rame", "rama rupta", "rame rupte"] },
  { intent: "reparatii_ochelari", service_key: "eyeglasses_adjustment", phrases: ["reglaj rama", "reglaj rame", "reglare rama"] },
  { intent: "investigatii", service_key: "oct", phrases: ["oct"] },
  { intent: "investigatii", service_key: "corneal_topography", phrases: ["topografie corneana", "topografii corneene"] },
  { intent: "investigatii", phrases: ["investigatie", "investigatii"] },
  { intent: "simptome_oftalmologice", symptomatic: true, phrases: ["ochi rosu", "ochii rosii", "ochi rosii", "durere la ochi", "ma doare ochiul", "vedere dubla"] },
  { intent: "control_vedere", phrases: ["control vedere", "control de vedere", "vreau un control", "verificare vedere"] },
]);

export function detectPatientGuidanceSignals(value) {
  const normalized_text = normalizePatientGuidanceText(value);
  const matchedRules = TEXT_RULES.filter((rule) => rule.phrases.some((phrase) => hasBoundedPhrase(normalized_text, phrase)));
  const exact_service_keys = canonicalServiceKeys(matchedRules.map((rule) => rule.service_key));
  const proposed_intent = matchedRules[0]?.intent || null;
  const text_generic = [
    "nu stiu unde sa merg",
    "nu stiu ce caut",
    "nu stiu de unde sa incep",
  ].some((phrase) => hasBoundedPhrase(normalized_text, phrase));
  const text_symptomatic = matchedRules.some((rule) => rule.symptomatic === true);
  const text_technical = canonicalDefinitions(exact_service_keys)
    .some((definition) => pathForDefinition(definition) === "technical_optical_service");

  return {
    normalized_text,
    proposed_intent,
    exact_service_keys,
    text_generic,
    text_symptomatic,
    text_technical,
    text_medical_term_only: hasBoundedPhrase(normalized_text, "consult oftalmologic")
      && !text_symptomatic,
  };
}

export function classifyPatientRequestClarity(input = {}) {
  const request = /** @type {any} */ (input || {});
  const signals = request.textSignals || detectPatientGuidanceSignals(request.text || "");
  const exactServiceIdentified = request.exactServiceIdentified === true
    || canonicalServiceKeys(request.confirmedServiceKeys || signals.exact_service_keys).length > 0;
  const missingRequiredFacts = unique(request.missingRequiredFacts);
  const intent = normalizedIntent(request.intent || signals.proposed_intent);
  const safetyState = normalizedSafetyState(request.safetyState);

  if (signals.text_symptomatic && safetyState === "unchecked") return "guided";
  if (exactServiceIdentified && missingRequiredFacts.length === 0) return "exact";
  if (intent !== "unknown" || exactServiceIdentified) return "partial";
  if (signals.text_generic || signals.text_symptomatic || signals.text_technical) return "guided";
  return "guided";
}

export function getPatientGuidanceCompletenessPolicy(intent) {
  const key = normalizedIntent(intent);
  const policy = MATRIX[key] || MATRIX.unknown;
  return {
    intent: key,
    required_for_search: [...policy.required_for_search],
    required_for_provider_request: [...policy.required_for_provider_request],
    optional_facts: [...policy.optional_facts],
    inferable_facts: [...policy.inferable_facts],
    skip_question_keys: [...policy.skip_question_keys],
    exact_service_can_skip_search_facts: [...(policy.exact_service_can_skip_search_facts || [])],
    exact_product_service_can_skip_search_facts: [...(policy.exact_product_service_can_skip_search_facts || [])],
    conditional_required_for_search: (policy.conditional_required_for_search || []).map((rule) => ({
      when: { ...rule.when },
      facts: [...rule.facts],
    })),
  };
}

export function derivePatientCarePath(input = {}) {
  const request = /** @type {any} */ (input || {});
  const safetyState = normalizedSafetyState(request.safetyState);
  if (safetyState === "blocking") return "emergency_interruption";

  const intent = normalizedIntent(request.intent);
  const facts = normalizedFacts(request.confirmedFacts);
  const clinicalValidationApprovals = clinicalValidationApprovalsFrom(request);

  if (
    intent === "control_copil"
    && !isPatientGuidanceClinicalRuleApproved(
      "pediatric_age_to_care_path",
      clinicalValidationApprovals,
    )
  ) {
    return "unresolved";
  }

  if (
    intent === "lentile_contact"
    && facts.contact_lens_experience === "first_time"
    && !isPatientGuidanceClinicalRuleApproved(
      "contact_lens_first_time_path",
      clinicalValidationApprovals,
    )
  ) {
    return "unresolved";
  }

  const definitions = canonicalDefinitions(request.confirmedServiceKeys);
  if (definitions.length > 0) {
    return definitions
      .map(pathForDefinition)
      .sort((left, right) => (PATH_PRIORITY[right] || 0) - (PATH_PRIORITY[left] || 0))[0]
      || "unresolved";
  }

  if (intent === "control_vedere") {
    if (facts.routine_vs_symptom === "routine") return "optometry";
    if (facts.routine_vs_symptom === "symptom") return "ophthalmology";
    return "unresolved";
  }

  return INTENT_FALLBACK_PATH[intent] || "unresolved";
}

export function deriveCandidateCarePaths(input = {}) {
  const request = /** @type {any} */ (input || {});
  const carePath = CARE_PATH_VALUES.includes(request.carePath)
    ? request.carePath
    : derivePatientCarePath(request);
  if (carePath !== "unresolved") return [carePath];

  const intent = normalizedIntent(request.intent);
  const proposed = unique(request.candidateCarePaths)
    .filter((value) => CARE_PATH_VALUES.includes(value))
    .filter((value) => !["unresolved", "emergency_interruption"].includes(value));
  const fromDefinitions = canonicalDefinitions(request.confirmedServiceKeys)
    .map(pathForDefinition)
    .filter((value) => CARE_PATH_VALUES.includes(value) && value !== "unresolved");
  return unique([
    ...fromDefinitions,
    ...(INTENT_CANDIDATE_PATHS[intent] || []),
    ...proposed,
  ]);
}

function allowedProfileTypesForPath(carePath, serviceKeys) {
  const definitions = canonicalDefinitions(serviceKeys);
  const fromDefinitions = unique(definitions.flatMap((definition) => definition.applicable_profile_types || []));
  return fromDefinitions.length > 0
    ? fromDefinitions
    : [...(PATH_DEFAULT_PROFILE_TYPES[carePath] || [])];
}

function requiredProfessionalTypes(serviceKeys) {
  return unique(canonicalDefinitions(serviceKeys)
    .flatMap((definition) => definition.required_professional_types || []));
}

const SERVICE_EXPANSION_OVERRIDES = /** @type {Record<string, string>} */ (Object.freeze({
  eyeglasses_adjustment: "local_only",
  screw_replacement: "local_only",
  nose_pad_replacement: "local_only",
  frame_cleaning: "local_only",
  ultrasonic_cleaning: "local_only",
  eyeglasses_repair: "local_then_county",
  frame_repair: "local_then_county",
  hinge_repair: "local_then_county",
  metal_frame_soldering: "local_then_county",
  lens_replacement: "local_then_county",
  client_frame_lens_mounting: "local_then_county",
}));

function policyForDefinition(definition) {
  const serviceOverride = SERVICE_EXPANSION_OVERRIDES[definition?.key];
  if (serviceOverride) return serviceOverride;

  const kind = clean(definition?.kind, 80);
  const group = clean(definition?.group, 80);
  if (kind === "technical_activity" || group === "technical_activities") return "local_then_county";
  if (["specialty", "procedure", "surgery"].includes(kind)) return "national_opt_in";
  if (kind === "investigation" || group === "investigations") return "county_default";
  return "local_then_county";
}

const EXPANSION_RESTRICTIVENESS = /** @type {Record<string, number>} */ ({
  local_only: 0,
  local_then_county: 1,
  county_default: 2,
  national_opt_in: 3,
});

export function derivePatientSearchExpansionPolicy(input = {}) {
  const request = /** @type {any} */ (input || {});
  const carePath = CARE_PATH_VALUES.includes(request.carePath) ? request.carePath : "unresolved";
  if (["emergency_interruption", "unresolved"].includes(carePath)) return "local_only";
  const definitions = canonicalDefinitions(request.serviceKeys);
  if (definitions.length === 0) {
    return carePath === "technical_optical_service" ? "local_only" : "local_then_county";
  }
  return definitions
    .map(policyForDefinition)
    .sort((left, right) => (EXPANSION_RESTRICTIVENESS[left] || 0) - (EXPANSION_RESTRICTIVENESS[right] || 0))[0];
}

export function canActivateNationalPatientSearch(input = {}) {
  const request = /** @type {any} */ (input || {});
  return request.searchExpansionPolicy === "national_opt_in"
    && request.userConfirmed === true
    && normalizedSafetyState(request.safetyState) !== "blocking"
    && !["unresolved", "emergency_interruption"].includes(request.carePath)
    && request.sufficientForSearch === true;
}

export function buildPatientTop3EligibilityPolicy(input = {}) {
  const request = /** @type {any} */ (input || {});
  const definitions = canonicalDefinitions(request.serviceKeys);
  const specialized = definitions.some((definition) => definition.service_need_level === "specialized_medical");
  const clinicalValidationApprovals = clinicalValidationApprovalsFrom(request);
  const specializedThresholdApproved = isPatientGuidanceClinicalRuleApproved(
    "specialized_service_trust_threshold",
    clinicalValidationApprovals,
  );
  const blockingValidationRuleKeys = specialized && !specializedThresholdApproved
    ? ["specialized_service_trust_threshold"]
    : [];

  return {
    version: PATIENT_GUIDANCE_TOP3_POLICY_VERSION,
    activation_status: blockingValidationRuleKeys.length > 0 ? "blocked" : "clear",
    clinical_validation_approvals: clinicalValidationApprovals,
    approved_validation_rule_keys: clinicalValidationApprovals,
    blocking_validation_rule_keys: blockingValidationRuleKeys,
    exact_bucket: "exact_top3",
    extended_bucket: "extended_relevant",
    directory_bucket: "directory_only",
    ineligible_bucket: "ineligible",
    required_trust_levels: specialized
      ? (specializedThresholdApproved ? ["verified"] : [])
      : ["claimed", "verified"],
    required_service_confirmation_levels: specialized
      ? (specializedThresholdApproved ? ["vezunde_verified"] : [])
      : ["publicly_listed", "provider_confirmed", "vezunde_verified"],
    requires_active_location: true,
    requires_published_location: true,
    requires_exact_confirmed_service: true,
    requires_matching_eligible_service: true,
    requires_allowed_profile_type: true,
    requires_search_area: true,
    excludes_suspended: true,
    excludes_mapping_conflict: true,
  };
}

export function evaluatePatientTop3Eligibility(input = {}) {
  const candidate = /** @type {any} */ (input || {});
  const profile = /** @type {any} */ (candidate.routingProfile || {});
  const serviceKey = normalizeServiceKey(candidate.service_key).canonicalKey;
  if (!serviceKey) return { eligibility: "ineligible", reasons: ["unknown_service"] };

  const definition = getCanonicalServiceDefinition(serviceKey);
  const clinicalValidationApprovals = normalizePatientGuidanceClinicalValidationApprovals(
    candidate.clinicalValidationApprovals
      ?? candidate.clinical_validation_approvals
      ?? profile.approved_validation_rule_keys
      ?? profile.clinical_validation_approvals
      ?? [],
  );
  const policy = buildPatientTop3EligibilityPolicy({
    serviceKeys: profile.confirmed_service_keys?.length > 0
      ? profile.confirmed_service_keys
      : [serviceKey],
    clinicalValidationApprovals,
  });
  const activationBlocked = policy.activation_status === "blocked";
  const allowedProfileTypes = unique(profile.allowed_profile_types);
  const requiredProfessionals = unique(profile.required_professional_types);
  const candidateProfessionals = unique(candidate.professional_types);
  const profileCompatible = allowedProfileTypes.includes(candidate.profile_type)
    && definition?.applicable_profile_types?.includes(candidate.profile_type);
  const professionalCompatible = requiredProfessionals.length === 0
    || requiredProfessionals.some((type) => candidateProfessionals.includes(type));

  const structuralFailures = [
    candidate.active === true ? null : "inactive_location",
    candidate.published === true ? null : "unpublished_location",
    candidate.suspended === true ? "suspended_location" : null,
    candidate.mapping_conflict === true ? "mapping_conflict" : null,
    profileCompatible ? null : "incompatible_profile_type",
    candidate.in_search_area === true || candidate.in_expansion_area === true ? null : "outside_allowed_area",
    activationBlocked ? "clinical_validation_required" : null,
  ].filter(Boolean);
  const nonClinicalStructuralFailures = structuralFailures
    .filter((reason) => reason !== "clinical_validation_required");
  if (nonClinicalStructuralFailures.length > 0) {
    return { eligibility: "ineligible", reasons: structuralFailures };
  }

  const requestedExactService = canonicalServiceKeys(profile.confirmed_service_keys).includes(serviceKey);
  const confirmationAccepted = activationBlocked
    ? candidate.service_confirmed === true
    : policy.required_service_confirmation_levels.includes(candidate.service_confirmation_level);
  const exactServiceConfirmed = requestedExactService
    && candidate.service_confirmed === true
    && confirmationAccepted;
  const matchingEligible = candidate.service_matching_eligible === true
    && definition?.matching_allowed_when_provider_confirmed === true;
  const trustAccepted = activationBlocked
    ? true
    : policy.required_trust_levels.includes(candidate.trust_level);

  if (candidate.trust_level === "directory") {
    return {
      eligibility: "directory_only",
      reasons: [
        "directory_trust_only",
        activationBlocked ? "clinical_validation_required" : null,
        professionalCompatible ? null : "required_professional_type_missing",
        exactServiceConfirmed ? null : "exact_service_not_confirmed",
        matchingEligible ? null : "service_not_matching_eligible",
        candidate.in_search_area === true ? null : "expanded_search_area",
      ].filter(Boolean),
    };
  }

  if (
    !activationBlocked
    && exactServiceConfirmed
    && matchingEligible
    && trustAccepted
    && professionalCompatible
    && candidate.in_search_area === true
  ) {
    return { eligibility: "exact_top3", reasons: ["all_exact_top3_conditions_met"] };
  }

  return {
    eligibility: "extended_relevant",
    reasons: [
      activationBlocked ? "clinical_validation_required" : null,
      professionalCompatible ? null : "required_professional_type_missing",
      exactServiceConfirmed ? null : "exact_service_not_confirmed",
      matchingEligible ? null : "service_not_matching_eligible",
      trustAccepted ? null : "trust_below_top3_threshold",
      candidate.in_search_area === true ? null : "expanded_search_area",
    ].filter(Boolean),
  };
}

function nextApprovedQuestion(missingSearch, missingProvider, sufficientForSearch) {
  const candidates = sufficientForSearch ? missingProvider : missingSearch;
  return candidates.find((key) => isApprovedPatientGuidanceQuestionKey(key)) || null;
}

export function buildPatientGuidanceRoutingProfile(input = {}) {
  const request = /** @type {any} */ (input || {});
  const primaryIntent = normalizedIntent(request.primaryIntent || request.intent);
  const alternativeIntents = unique(request.alternativeIntents)
    .map(normalizedIntent)
    .filter((intent) => intent !== "unknown" && intent !== primaryIntent);
  const confirmedFacts = normalizedFacts(request.confirmedFacts);
  const confirmedServiceKeys = canonicalServiceKeys(request.confirmedServiceKeys);
  const candidateServiceKeys = canonicalServiceKeys([
    ...(request.candidateServiceKeys || []),
    ...confirmedServiceKeys,
  ]);
  const clinicalValidationApprovals = clinicalValidationApprovalsFrom(request);
  const safetyState = normalizedSafetyState(request.safetyState);
  const completeness = getPatientGuidanceCompletenessPolicy(primaryIntent);
  const carePath = derivePatientCarePath({
    intent: primaryIntent,
    confirmedServiceKeys,
    confirmedFacts,
    safetyState,
    clinicalValidationApprovals,
  });
  const confirmedDefinitions = canonicalDefinitions(confirmedServiceKeys);
  const exactServiceDeterminesPath = confirmedDefinitions.length > 0
    && !["unresolved", "emergency_interruption"].includes(carePath);
  const safeExactPediatricService = exactServiceDeterminesPath
    && confirmedDefinitions.some((definition) => (
      definition.group === "children_and_prevention"
      || definition.key === "pediatric_ophthalmology"
    ));
  const exactContactLensProduct = exactServiceDeterminesPath
    && confirmedDefinitions.some((definition) => (
      definition.group === "contact_lenses"
      && definition.kind === "product"
    ));
  const skippableSearchFacts = new Set([
    ...(primaryIntent === "control_vedere" && exactServiceDeterminesPath
      ? completeness.exact_service_can_skip_search_facts
      : []),
    ...(primaryIntent === "control_copil" && safeExactPediatricService
      ? completeness.exact_service_can_skip_search_facts
      : []),
    ...(primaryIntent === "lentile_contact" && exactContactLensProduct
      ? completeness.exact_product_service_can_skip_search_facts
      : []),
  ]);
  const effectiveRequiredSearchFacts = completeness.required_for_search
    .filter((key) => !skippableSearchFacts.has(key));
  if (
    primaryIntent === "investigatii"
    && confirmedFacts.investigation_type === "not_sure"
    && confirmedServiceKeys.length === 0
  ) {
    effectiveRequiredSearchFacts.push("investigation_reference_text");
  }
  const missingRequiredFacts = missingFacts(unique(effectiveRequiredSearchFacts), confirmedFacts);
  const missingProviderFacts = missingFacts(completeness.required_for_provider_request, confirmedFacts);
  const routingServiceKeys = confirmedServiceKeys.length > 0
    ? confirmedServiceKeys
    : candidateServiceKeys;
  const allowedProfileTypes = allowedProfileTypesForPath(carePath, routingServiceKeys);
  const requiredProfessionals = requiredProfessionalTypes(routingServiceKeys);
  const candidateCarePaths = deriveCandidateCarePaths({
    intent: primaryIntent,
    confirmedServiceKeys,
    confirmedFacts,
    carePath,
    candidateCarePaths: request.candidateCarePaths,
  });
  const applicableRoutingValidationRuleKeys = unique([
    primaryIntent === "control_copil"
      ? "pediatric_age_to_care_path"
      : null,
    primaryIntent === "simptome_oftalmologice"
      ? "symptom_safety_completion"
      : null,
    primaryIntent === "lentile_contact"
      && confirmedFacts.contact_lens_experience === "first_time"
      ? "contact_lens_first_time_path"
      : null,
  ]);
  const routingBlockingValidationRuleKeys = applicableRoutingValidationRuleKeys
    .filter((ruleKey) => (
      !isPatientGuidanceClinicalRuleApproved(ruleKey, clinicalValidationApprovals)
    ));
  const symptomSafetyComplete = primaryIntent !== "simptome_oftalmologice"
    || (
      isPatientGuidanceClinicalRuleApproved(
        "symptom_safety_completion",
        clinicalValidationApprovals,
      )
      && factPresent("safety_targeted_check", confirmedFacts)
      && ["clear", "advisory"].includes(safetyState)
    );
  const investigationResolved = primaryIntent !== "investigatii"
    || (factPresent("investigation_type", confirmedFacts) && carePath !== "unresolved");
  const sufficientForSearch = missingRequiredFacts.length === 0
    && routingBlockingValidationRuleKeys.length === 0
    && symptomSafetyComplete
    && investigationResolved
    && !["unresolved", "emergency_interruption"].includes(carePath);
  const sufficientForProviderRequest = sufficientForSearch && missingProviderFacts.length === 0;
  const signals = request.textSignals || detectPatientGuidanceSignals(request.text || "");
  const requestClarity = classifyPatientRequestClarity({
    intent: primaryIntent,
    confirmedServiceKeys,
    missingRequiredFacts,
    safetyState,
    textSignals: signals,
  });
  const nextQuestionKey = nextApprovedQuestion(
    missingRequiredFacts,
    missingProviderFacts,
    sufficientForSearch,
  );
  const searchExpansionPolicy = derivePatientSearchExpansionPolicy({
    serviceKeys: routingServiceKeys,
    carePath,
  });
  const top3Policy = buildPatientTop3EligibilityPolicy({
    serviceKeys: routingServiceKeys,
    clinicalValidationApprovals,
  });
  const blockingValidationRuleKeys = unique([
    ...routingBlockingValidationRuleKeys,
    ...top3Policy.blocking_validation_rule_keys,
  ]);

  return {
    contract_version: PATIENT_GUIDANCE_ROUTING_VERSION,
    question_catalog_version: PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION,
    request_clarity: requestClarity,
    primary_intent: primaryIntent,
    alternative_intents: alternativeIntents,
    confirmed_facts: confirmedFacts,
    missing_required_facts: missingRequiredFacts,
    candidate_service_keys: candidateServiceKeys,
    confirmed_service_keys: confirmedServiceKeys,
    care_path: carePath,
    candidate_care_paths: candidateCarePaths,
    allowed_profile_types: allowedProfileTypes,
    required_professional_types: requiredProfessionals,
    safety_state: safetyState,
    sufficient_for_search: sufficientForSearch,
    sufficient_for_provider_request: sufficientForProviderRequest,
    next_question_key: nextQuestionKey,
    next_question_reason: nextQuestionKey
      ? (sufficientForSearch ? "provider_request_completeness" : "search_completeness")
      : (blockingValidationRuleKeys.length > 0
        ? "clinical_validation_required"
        : (carePath === "unresolved" ? "intent_or_service_resolution_required" : null)),
    clinical_validation_approvals: clinicalValidationApprovals,
    clinical_validation_status: blockingValidationRuleKeys.length > 0 ? "blocked" : "clear",
    blocking_validation_rule_keys: blockingValidationRuleKeys,
    approved_validation_rule_keys: clinicalValidationApprovals,
    search_expansion_policy: searchExpansionPolicy,
    top3_eligibility_policy: top3Policy,
    fallback_mode: safetyState === "blocking"
      ? "safety_interruption"
      : (sufficientForSearch ? "none" : "guided_questions"),
    completeness_policy: completeness,
    next_question: nextQuestionKey ? getApprovedPatientGuidanceQuestion(nextQuestionKey) : null,
  };
}
