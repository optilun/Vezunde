// Bundled single-file Base44 function. Do not add local project imports.

// scripts/bridge-sources/listProviderMemberInvitations.entry.ts
import { createClientFromRequest as createClientFromRequest2 } from "npm:@base44/sdk@0.8.31";

// base44/functions/directoryOps/directoryImportOps.ts
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

// base44/shared/directoryImportPipeline.js
var DIRECTORY_IMPORT_CONTRACT_VERSION = "viasee-directory-import-v1";
var DIRECTORY_CLASSIFICATION_CONTRACT_VERSION = "viasee-directory-location-first-v1";
var DIRECTORY_IMPORT_MAX_CHUNK_SIZE = 100;
var FIELD_ALIASES = {
  location_name: ["location_name", "location_display_name", "name", "location"],
  organization_name: ["organization_name", "organization_display_name", "organization", "brand"],
  locality_name: ["locality_name", "official_locality", "city", "locality"],
  county_name: ["county_name", "county_if_confirmed", "county"],
  locality_siruta_code: ["locality_siruta_code", "siruta", "siruta_code"],
  address: ["address", "confirmed_address", "location_address"],
  phone: ["phone", "confirmed_location_phone", "public_phone", "phone_public"],
  email: ["email", "confirmed_location_email", "public_email"],
  website: ["website", "website_url"],
  source_url: ["source_url", "official_source_url"],
  source_name: ["source_name", "official_source_name", "organization_display_name"],
  source_type: ["source_type", "official_source_type"],
  source_checked_at: ["source_checked_at"],
  research_status: ["research_status"],
  operational_status: ["operational_status"],
  import_readiness: ["import_readiness"],
  activity_category: ["activity_category", "confirmed_activity_category"],
  review_flags: ["review_flags"],
  evidence_note: ["evidence_note"],
  observations: ["observations", "notes"],
  schedule: ["schedule", "confirmed_schedule", "opening_hours"],
  organization_external_key: ["organization_external_key", "organization_key"],
  location_external_key: ["location_external_key", "location_key", "directory_external_key"],
  provider_type: ["provider_type"],
  provider_profile_type: ["provider_profile_type"],
  organization_type_code: ["organization_type_code", "organization_type"],
  location_type_code: ["location_type_code"],
  care_setting_code: ["care_setting_code"],
  ownership_type_code: ["ownership_type_code"]
};
var PROVIDER_TYPES = /* @__PURE__ */ new Set([
  "optica_medicala",
  "clinica_oftalmologica",
  "cabinet_oftalmologic",
  "cabinet_optometric",
  "laborator_optic",
  "optometrist_independent",
  "medic_oftalmolog_independent"
]);
var PROVIDER_PROFILE_TYPES = /* @__PURE__ */ new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor"
]);
var ORGANIZATION_TYPE_CODES = /* @__PURE__ */ new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "healthcare_network",
  "multi_specialty_healthcare_provider",
  "public_healthcare_institution",
  "independent_professional",
  "optical_laboratory",
  "b2b_distributor",
  "other"
]);
var LOCATION_TYPE_CODES = /* @__PURE__ */ new Set([
  "optical_store",
  "optometry_office",
  "ophthalmology_office",
  "ophthalmology_clinic",
  "multi_specialty_clinic",
  "hospital_department",
  "hospital_outpatient_unit",
  "optical_laboratory",
  "independent_professional_office",
  "other"
]);
var CARE_SETTING_CODES = /* @__PURE__ */ new Set([
  "retail",
  "outpatient",
  "hospital_outpatient",
  "hospital_inpatient",
  "mixed",
  "laboratory",
  "other"
]);
var OWNERSHIP_TYPE_CODES = /* @__PURE__ */ new Set(["private", "public", "nonprofit", "unknown"]);
function clean(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normalizeIdentityText(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function stableTextHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function firstValue(raw, aliases) {
  for (const alias of aliases) {
    const value = raw?.[alias];
    if (value !== void 0 && value !== null && clean(value)) return clean(value);
  }
  return "";
}
function canonicalFields(raw = {}) {
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([key, aliases]) => [key, firstValue(raw, aliases)])
  );
}
function explicitCanonicalType(fields) {
  const hasAnyExplicitType = Boolean(
    fields.provider_type || fields.provider_profile_type || fields.location_type_code || fields.care_setting_code
  );
  if (!hasAnyExplicitType) return null;
  const complete = PROVIDER_TYPES.has(fields.provider_type) && PROVIDER_PROFILE_TYPES.has(fields.provider_profile_type) && LOCATION_TYPE_CODES.has(fields.location_type_code) && CARE_SETTING_CODES.has(fields.care_setting_code);
  if (!complete) return {
    invalid: true,
    provider_type: "",
    provider_profile_type: "",
    location_type_code: "",
    care_setting_code: ""
  };
  return {
    invalid: false,
    provider_type: fields.provider_type,
    provider_profile_type: fields.provider_profile_type,
    location_type_code: fields.location_type_code,
    care_setting_code: fields.care_setting_code
  };
}
function resolveOrganizationType(fields, locationType) {
  if (fields.organization_type_code) {
    return {
      organization_type_code: ORGANIZATION_TYPE_CODES.has(fields.organization_type_code) ? fields.organization_type_code : "",
      organization_type_source: "source_explicit",
      organization_type_invalid: !ORGANIZATION_TYPE_CODES.has(fields.organization_type_code),
      organization_type_legacy_fallback: false
    };
  }
  const legacyProfile = locationType?.provider_profile_type || "";
  return {
    organization_type_code: ORGANIZATION_TYPE_CODES.has(legacyProfile) ? legacyProfile : "",
    organization_type_source: legacyProfile ? "legacy_profile_fallback" : "unresolved",
    organization_type_invalid: false,
    organization_type_legacy_fallback: Boolean(legacyProfile)
  };
}
function normalizeAddressForFingerprint(value) {
  return normalizeIdentityText(value).replace(/\b(strada|str|bulevardul|bulevard|bd|calea|sos|soseaua|piata|p-ta)\b/g, " ").replace(/\b(numarul|numar|nr)\b/g, " ").replace(/\s+/g, " ").trim();
}
function inferCanonicalLocationType(activityCategory = "") {
  const value = normalizeIdentityText(activityCategory);
  if (!value) return null;
  if (value.includes("laborator")) {
    return { provider_type: "laborator_optic", provider_profile_type: "optical_laboratory_b2c", location_type_code: "optical_laboratory", care_setting_code: "laboratory" };
  }
  if (value.includes("spital") || value.includes("ambulator") || value.includes("sectie")) {
    return { provider_type: "clinica_oftalmologica", provider_profile_type: "ophthalmology_clinic", location_type_code: value.includes("ambulator") ? "hospital_outpatient_unit" : "hospital_department", care_setting_code: value.includes("ambulator") ? "hospital_outpatient" : "hospital_inpatient" };
  }
  if (value.includes("multi") || value.includes("policlinica")) {
    return { provider_type: "clinica_oftalmologica", provider_profile_type: "ophthalmology_clinic", location_type_code: "multi_specialty_clinic", care_setting_code: "outpatient" };
  }
  if (value.includes("clinica") && value.includes("oftalm")) {
    return { provider_type: "clinica_oftalmologica", provider_profile_type: "ophthalmology_clinic", location_type_code: "ophthalmology_clinic", care_setting_code: "outpatient" };
  }
  if (value.includes("cabinet") && value.includes("oftalm")) {
    return { provider_type: "cabinet_oftalmologic", provider_profile_type: "ophthalmology_office", location_type_code: "ophthalmology_office", care_setting_code: "outpatient" };
  }
  if (value.includes("optica") || value.includes("optic")) {
    return { provider_type: "optica_medicala", provider_profile_type: "independent_optical_store", location_type_code: "optical_store", care_setting_code: "retail" };
  }
  if (value.includes("optometr")) {
    return { provider_type: "cabinet_optometric", provider_profile_type: "independent_optometrist", location_type_code: "optometry_office", care_setting_code: "outpatient" };
  }
  return null;
}
function mapOperationalStatus(value) {
  const status = normalizeIdentityText(value).replace(/ /g, "_");
  if (["active", "active_confirmed", "activa"].includes(status)) return "active";
  if (["temporarily_closed", "suspended", "suspendata"].includes(status)) return "temporarily_closed";
  if (["closed", "inactive", "inactiva", "possibly_inactive"].includes(status)) return "closed";
  return "unknown";
}
function dataQualityFor(fields) {
  if (fields.import_readiness === "blocked_conflict") return "conflict";
  if (["blocked_missing_data", "blocked_type_mapping"].includes(fields.import_readiness)) return "low";
  if (fields.research_status === "official_confirmed") return "high";
  if (fields.research_status === "official_partial") return "medium";
  return "low";
}
function pseudoRowReason(fields) {
  const name = normalizeIdentityText(fields.location_name);
  const locality = clean(fields.locality_name);
  const address = normalizeIdentityText(fields.address);
  if (!name) return "missing_location_name";
  if (name === "organizatie" || /^(?:locatii|acoperire|retea|network)(?:\s|$)/.test(name) || /^total(?:\s*:?\s*\d|\s+(?:locatii|puncte|sedii)\b)/.test(name)) return "aggregate_or_summary_row";
  if (/^~?\d+\+?$/.test(locality)) return "aggregate_count_row";
  if (/^~?\d+\+?$/.test(clean(fields.location_name))) return "aggregate_count_row";
  if (!address && /\b(locatii|puncte|sedii)\b/.test(name)) return "aggregate_without_address";
  return "";
}
function normalizeDirectoryImportRow(raw = {}, context = {}) {
  const fields = canonicalFields(raw);
  const explicitType = explicitCanonicalType(fields);
  const inferredType = explicitType || inferCanonicalLocationType(fields.activity_category);
  const organizationType = resolveOrganizationType(fields, inferredType);
  const localityKey = normalizeIdentityText(fields.locality_name);
  const addressKey = normalizeAddressForFingerprint(fields.address);
  const organizationKey = fields.organization_external_key || (fields.organization_name ? `org:${stableTextHash(normalizeIdentityText(fields.organization_name))}` : "");
  const locationKey = fields.location_external_key || (fields.location_name && localityKey && addressKey ? `loc:${stableTextHash([localityKey, addressKey, normalizeIdentityText(fields.location_name)].join("|"))}` : "");
  const addressFingerprint = localityKey && addressKey ? `addr:${stableTextHash([fields.locality_siruta_code || localityKey, addressKey].join("|"))}` : "";
  return {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    classification_contract_version: DIRECTORY_CLASSIFICATION_CONTRACT_VERSION,
    source_version: clean(context.source_version, 160),
    source_row_key: clean(context.source_row_key, 200),
    row_number: Number(context.row_number || 0),
    location_name: fields.location_name,
    organization_name: fields.organization_name,
    locality_name: fields.locality_name,
    county_name: fields.county_name,
    locality_siruta_code: fields.locality_siruta_code,
    address: fields.address,
    phone: fields.phone,
    email: fields.email,
    website: fields.website,
    schedule: fields.schedule,
    source_url: fields.source_url,
    source_name: fields.source_name,
    source_type: fields.source_type,
    source_checked_at: fields.source_checked_at,
    research_status: fields.research_status,
    source_operational_status: fields.operational_status,
    import_readiness: fields.import_readiness,
    activity_category: fields.activity_category,
    review_flags: fields.review_flags,
    evidence_note: fields.evidence_note,
    observations: fields.observations,
    organization_external_key: organizationKey,
    location_external_key: locationKey,
    address_fingerprint: addressFingerprint,
    provider_type: inferredType?.provider_type || "",
    provider_profile_type: inferredType?.provider_profile_type || "",
    organization_type_code: organizationType.organization_type_code,
    location_type_code: inferredType?.location_type_code || "",
    care_setting_code: inferredType?.care_setting_code || "",
    ownership_type_code: OWNERSHIP_TYPE_CODES.has(fields.ownership_type_code) ? fields.ownership_type_code : "unknown",
    operational_status: mapOperationalStatus(fields.operational_status),
    publication_status: "draft",
    control_status: "directory",
    data_quality_status: dataQualityFor(fields),
    directory_detail_level: "summary",
    directory_basic_details_approved: false,
    pseudo_row_reason: pseudoRowReason(fields),
    canonical_type_source: explicitType ? "source_explicit" : inferredType ? "activity_inferred" : "unresolved",
    canonical_type_invalid: Boolean(explicitType?.invalid),
    organization_type_source: organizationType.organization_type_source,
    organization_type_invalid: organizationType.organization_type_invalid,
    organization_type_legacy_fallback: organizationType.organization_type_legacy_fallback
  };
}
function validateNormalizedDirectoryRow(row = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const sourceEligible = !["excluded", "not_eligible"].includes(row.research_status) && row.import_readiness !== "not_eligible";
  if (!row.location_name) errors.push("missing_location_name");
  if (!row.locality_name) errors.push("missing_locality");
  if (!row.locality_siruta_code && options.require_siruta !== false) errors.push("missing_siruta");
  if (!row.address) errors.push("missing_address");
  if (!row.source_url) errors.push("missing_official_source");
  if (!row.location_external_key) errors.push("missing_location_external_key");
  if (!row.address_fingerprint) errors.push("missing_address_fingerprint");
  if (row.pseudo_row_reason) errors.push(row.pseudo_row_reason);
  if (!sourceEligible) errors.push("source_row_not_eligible");
  if (row.import_readiness === "blocked_conflict") errors.push("research_conflict_requires_review");
  if (row.import_readiness === "blocked_missing_data") errors.push("research_missing_data_requires_review");
  if (row.import_readiness === "blocked_type_mapping") errors.push("location_type_requires_mapping");
  if (row.canonical_type_invalid) errors.push("invalid_explicit_canonical_type");
  if (row.organization_type_invalid) errors.push("invalid_explicit_organization_type");
  if (!row.provider_type || !row.provider_profile_type || !row.location_type_code) warnings.push("canonical_type_not_inferred");
  if (!row.organization_name) warnings.push("organization_missing");
  if (row.organization_name && !row.organization_type_code) warnings.push("organization_type_not_resolved");
  if (row.organization_type_legacy_fallback) warnings.push("organization_type_inferred_from_legacy_profile");
  if (!row.phone && !row.website && !row.email) warnings.push("public_contact_missing");
  if (row.operational_status === "unknown") warnings.push("operational_status_unknown");
  return {
    valid: errors.length === 0,
    blocked: errors.length > 0,
    errors,
    warnings,
    validation_codes: [...errors, ...warnings]
  };
}
function batchApprovalToken(batchKey, sourceSha256, readyRows) {
  return `IMPORT ${clean(batchKey, 120)} ${clean(sourceSha256, 80).slice(0, 12)} ${Number(readyRows || 0)}`;
}
function rollbackApprovalToken(batchKey, appliedRows) {
  return `ROLLBACK ${clean(batchKey, 120)} ${Number(appliedRows || 0)}`;
}
function rowIdempotencyKey(snapshotKey, sourceRowKey, rowHash) {
  return `row:${stableTextHash([snapshotKey, sourceRowKey, rowHash].join("|"))}`;
}

// base44/shared/directoryOrganizationTypeMapping.js
var LEGACY_PROVIDER_ORGANIZATION_TYPES = /* @__PURE__ */ new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor"
]);
var DIRECTORY_ORGANIZATION_TYPE_CODES = /* @__PURE__ */ new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "healthcare_network",
  "multi_specialty_healthcare_provider",
  "public_healthcare_institution",
  "independent_professional",
  "optical_laboratory",
  "b2b_distributor",
  "other"
]);
var DIRECT_LEGACY_TYPE_BY_CODE = Object.freeze({
  independent_optical_store: "independent_optical_store",
  optical_chain: "optical_chain",
  ophthalmology_clinic: "ophthalmology_clinic",
  ophthalmology_office: "ophthalmology_office",
  healthcare_network: "ophthalmology_clinic",
  multi_specialty_healthcare_provider: "ophthalmology_clinic",
  public_healthcare_institution: "ophthalmology_clinic",
  b2b_distributor: "future_b2b_distributor"
});
var INDEPENDENT_PROFESSIONAL_LEGACY_TYPES = /* @__PURE__ */ new Set([
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician"
]);
var OPTICAL_LABORATORY_LEGACY_TYPES = /* @__PURE__ */ new Set([
  "optical_laboratory_b2c",
  "optical_laboratory_b2b"
]);
function cleanType(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}
function isDirectoryOrganizationTypeCode(value) {
  return DIRECTORY_ORGANIZATION_TYPE_CODES.has(cleanType(value));
}
function resolveProviderOrganizationType(row = {}) {
  const organizationTypeCode = cleanType(row.organization_type_code);
  const providerProfileType = cleanType(row.provider_profile_type);
  if (!organizationTypeCode) {
    return {
      valid: false,
      organization_type_code: "",
      organization_type: "",
      error_code: "organization_type_not_resolved"
    };
  }
  if (!DIRECTORY_ORGANIZATION_TYPE_CODES.has(organizationTypeCode)) {
    return {
      valid: false,
      organization_type_code: organizationTypeCode,
      organization_type: "",
      error_code: "invalid_explicit_organization_type"
    };
  }
  let legacyOrganizationType = DIRECT_LEGACY_TYPE_BY_CODE[organizationTypeCode] || "";
  if (organizationTypeCode === "independent_professional" && INDEPENDENT_PROFESSIONAL_LEGACY_TYPES.has(providerProfileType)) {
    legacyOrganizationType = providerProfileType;
  }
  if (organizationTypeCode === "optical_laboratory" && OPTICAL_LABORATORY_LEGACY_TYPES.has(providerProfileType)) {
    legacyOrganizationType = providerProfileType;
  }
  if (!LEGACY_PROVIDER_ORGANIZATION_TYPES.has(legacyOrganizationType)) {
    return {
      valid: false,
      organization_type_code: organizationTypeCode,
      organization_type: "",
      error_code: "organization_type_legacy_mapping_not_resolved"
    };
  }
  return {
    valid: true,
    organization_type_code: organizationTypeCode,
    organization_type: legacyOrganizationType,
    error_code: ""
  };
}

// base44/shared/directoryOrganizationReconciliation.js
function clean2(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normalizeIdentity(value) {
  return clean2(value, 240).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function resolveDirectoryOrganizationCanonicalPayload(row = {}) {
  const typeResolution = resolveProviderOrganizationType(row);
  if (!typeResolution.valid) {
    return {
      valid: false,
      error_code: typeResolution.error_code,
      values: {},
      type_resolution: typeResolution
    };
  }
  const organizationName = clean2(row.organization_name, 240);
  const organizationExternalKey = clean2(row.organization_external_key, 240);
  if (!organizationName || !organizationExternalKey) {
    return {
      valid: false,
      error_code: "organization_identity_not_resolved",
      values: {},
      type_resolution: typeResolution
    };
  }
  return {
    valid: true,
    error_code: "",
    values: {
      name: organizationName,
      public_display_name: organizationName,
      organization_type: typeResolution.organization_type,
      organization_type_code: typeResolution.organization_type_code,
      directory_external_key: organizationExternalKey,
      directory_source_version: clean2(row.source_version, 160)
    },
    type_resolution: typeResolution
  };
}
function isMutableDirectoryOrganization(organization = {}) {
  return organization.control_status === "directory" && organization.publication_status === "draft" && (!organization.public_visibility_status || organization.public_visibility_status === "draft");
}
function planDirectoryOrganizationReconciliation(organization = {}, row = {}) {
  const canonical = resolveDirectoryOrganizationCanonicalPayload(row);
  if (!canonical.valid) {
    return {
      valid: false,
      error_code: canonical.error_code,
      updates: {},
      requires_update: false,
      protected: true,
      canonical
    };
  }
  const desired = canonical.values;
  const currentExternalKey = clean2(organization.directory_external_key, 240);
  if (currentExternalKey && currentExternalKey !== desired.directory_external_key) {
    return {
      valid: false,
      error_code: "organization_external_key_conflict",
      updates: {},
      requires_update: false,
      protected: true,
      canonical
    };
  }
  const mutable = isMutableDirectoryOrganization(organization);
  if (!mutable) {
    const currentName = organization.public_display_name || organization.name;
    if (normalizeIdentity(currentName) !== normalizeIdentity(desired.name)) {
      return {
        valid: false,
        error_code: "controlled_organization_identity_conflict",
        updates: {},
        requires_update: false,
        protected: true,
        canonical
      };
    }
    if (clean2(organization.organization_type, 120) !== desired.organization_type) {
      return {
        valid: false,
        error_code: "controlled_organization_legacy_type_conflict",
        updates: {},
        requires_update: false,
        protected: true,
        canonical
      };
    }
    const currentCanonicalType2 = clean2(organization.organization_type_code, 120);
    if (currentCanonicalType2 && currentCanonicalType2 !== desired.organization_type_code) {
      return {
        valid: false,
        error_code: "controlled_organization_canonical_type_conflict",
        updates: {},
        requires_update: false,
        protected: true,
        canonical
      };
    }
    if (!currentCanonicalType2 && desired.organization_type_code !== desired.organization_type) {
      return {
        valid: false,
        error_code: "controlled_organization_canonical_type_missing",
        updates: {},
        requires_update: false,
        protected: true,
        canonical
      };
    }
    return {
      valid: true,
      error_code: "",
      updates: {},
      requires_update: false,
      protected: true,
      canonical
    };
  }
  const updates = {};
  const currentCanonicalType = clean2(organization.organization_type_code, 120);
  if (!currentCanonicalType && desired.organization_type_code !== desired.organization_type) {
    return {
      valid: false,
      error_code: "directory_organization_canonical_type_missing",
      updates: {},
      requires_update: false,
      protected: false,
      canonical
    };
  }
  for (const key of ["name", "organization_type"]) {
    if (clean2(organization[key], key.includes("type") ? 120 : 240) !== desired[key]) {
      updates[key] = desired[key];
    }
  }
  for (const key of [
    "public_display_name",
    "organization_type_code",
    "directory_external_key",
    "directory_source_version"
  ]) {
    const currentValue = clean2(organization[key], key.includes("type") ? 120 : 240);
    if (currentValue && currentValue !== desired[key]) updates[key] = desired[key];
  }
  return {
    valid: true,
    error_code: "",
    updates,
    requires_update: Object.keys(updates).length > 0,
    protected: false,
    canonical
  };
}

// base44/shared/directoryIdentityMatchPolicy.js
function uniqueBy(candidates, keyFor) {
  const rows = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const unique = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (key && !unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}
function locationTargets(states, locationsById) {
  const targets = [];
  for (const state of uniqueBy(states, (row) => row.location_id || row.id)) {
    const location = locationsById.get(state.location_id);
    if (location) targets.push(location);
  }
  return uniqueBy(targets, (row) => row.id);
}
function resolveDirectoryOrganizationMatch({
  externalCandidates = [],
  nameCandidates = []
} = {}) {
  const external = uniqueBy(externalCandidates, (row) => row.id);
  if (external.length > 1) {
    return {
      target: null,
      strategy: "organization_external_key",
      confidence: "none",
      error_code: "multiple_organizations_for_external_key",
      candidate_ids: external.map((row) => row.id)
    };
  }
  if (external.length === 1) {
    return {
      target: external[0],
      strategy: "organization_external_key",
      confidence: "high",
      error_code: "",
      candidate_ids: [external[0].id]
    };
  }
  const byName = uniqueBy(nameCandidates, (row) => row.id);
  if (byName.length > 1) {
    return {
      target: null,
      strategy: "organization_exact_name",
      confidence: "none",
      error_code: "multiple_organizations_for_exact_name",
      candidate_ids: byName.map((row) => row.id)
    };
  }
  if (byName.length === 1) {
    return {
      target: byName[0],
      strategy: "organization_exact_name",
      confidence: "high",
      error_code: "",
      candidate_ids: [byName[0].id]
    };
  }
  return {
    target: null,
    strategy: "none",
    confidence: "none",
    error_code: "",
    candidate_ids: []
  };
}
function resolveDirectoryLocationMatch({
  externalStates = [],
  exactFallbackCandidates = [],
  addressStates = [],
  locationsById = /* @__PURE__ */ new Map()
} = {}) {
  const uniqueExternalStates = uniqueBy(
    externalStates,
    (row) => row.location_id || row.id
  );
  const externalTargets = locationTargets(externalStates, locationsById);
  if (externalTargets.length > 1) {
    return {
      target: null,
      strategy: "location_external_key",
      confidence: "none",
      error_code: "multiple_locations_for_external_key",
      candidate_ids: externalTargets.map((row) => row.id)
    };
  }
  if (externalTargets.length === 1) {
    return {
      target: externalTargets[0],
      strategy: "location_external_key",
      confidence: "high",
      error_code: "",
      candidate_ids: [externalTargets[0].id]
    };
  }
  if (uniqueExternalStates.length > 0) {
    return {
      target: null,
      strategy: "location_external_key",
      confidence: "none",
      error_code: "location_external_state_target_missing",
      candidate_ids: []
    };
  }
  const exactFallback = uniqueBy(exactFallbackCandidates, (row) => row.id);
  if (exactFallback.length > 1) {
    return {
      target: null,
      strategy: "exact_name_locality_address",
      confidence: "none",
      error_code: "multiple_locations_for_exact_identity",
      candidate_ids: exactFallback.map((row) => row.id)
    };
  }
  if (exactFallback.length === 1) {
    return {
      target: exactFallback[0],
      strategy: "exact_name_locality_address",
      confidence: "high",
      error_code: "",
      candidate_ids: [exactFallback[0].id]
    };
  }
  const uniqueAddressStates = uniqueBy(
    addressStates,
    (row) => row.location_id || row.id
  );
  const addressTargets = locationTargets(addressStates, locationsById);
  if (addressTargets.length > 0) {
    return {
      target: null,
      strategy: "address_fingerprint",
      confidence: "none",
      error_code: "address_match_requires_manual_identity_review",
      candidate_ids: addressTargets.map((row) => row.id)
    };
  }
  if (uniqueAddressStates.length > 0) {
    return {
      target: null,
      strategy: "address_fingerprint",
      confidence: "none",
      error_code: "address_state_target_missing",
      candidate_ids: []
    };
  }
  return {
    target: null,
    strategy: "none",
    confidence: "none",
    error_code: "",
    candidate_ids: []
  };
}

// base44/functions/directoryOps/directoryImportOps.ts
var MAX_ROWS = 5e3;
var EXECUTION_CHUNK = 20;
var FINALIZATION_CHUNK = 50;
var PLANNING_CHUNK = 50;
var LOCK_MINUTES = 5;
var CONTROLLED_PROFILES = /* @__PURE__ */ new Set(["claimed", "verified", "suspended"]);
function clean3(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function safeJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}
function boundedChunkSize(value, maximum, fallback = maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function snapshotDuplicateKey(row) {
  const externalKey = clean3(row?.location_external_key, 220);
  if (externalKey) return `external:${externalKey}`;
  const addressFingerprint = clean3(row?.address_fingerprint, 220);
  const locationName = normalizeIdentityText(row?.location_name);
  if (!addressFingerprint || !locationName) return "";
  return `identity:${addressFingerprint}|${locationName}`;
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
function response(body, status = 200) {
  return Response.json(body, { status });
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function lockExpiry() {
  return new Date(Date.now() + LOCK_MINUTES * 6e4).toISOString();
}
function randomToken(prefix = "lock") {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}
function normalizeDate(value) {
  const text = clean3(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function activeStatusFor(row) {
  return row.operational_status === "active" ? "activa" : "inactiva";
}
function confidenceFor(row) {
  if (row.data_quality_status === "high") return "high";
  if (row.data_quality_status === "medium") return "medium";
  return "low";
}
function sourceSnapshotKey(sourceVersion, sha256) {
  return `snapshot:${stableTextHash(`${sourceVersion}|${sha256}`)}`;
}
function batchKeyFor(snapshot, sequence) {
  return `DIR-${clean3(snapshot.source_version, 60).replace(/[^a-zA-Z0-9_-]+/g, "-")}-${String(sequence).padStart(3, "0")}`;
}
function pickFields(source, keys) {
  return Object.fromEntries(keys.filter((key) => source?.[key] !== void 0).map((key) => [key, source[key]]));
}
function equalFieldSubset(current, expected) {
  return Object.entries(expected || {}).every(([key, value]) => stableStringify(current?.[key] ?? null) === stableStringify(value ?? null));
}
async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: response({ error: "Autentificare necesara." }, 401) };
  if (user.role !== "admin") return { error: response({ error: "Acces administrativ necesar." }, 403) };
  return { user, svc: base44.asServiceRole };
}
async function writeAudit(svc, user, entityType, entityId, actionType, previousValues, nextValues, note = "") {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    changed_fields: Object.keys(nextValues || {}),
    previous_values: JSON.stringify(previousValues || {}),
    new_values: JSON.stringify(nextValues || {}),
    admin_user_id: user.id,
    admin_email: user.email || "",
    note,
    performed_at: now()
  });
}
async function createMutation(svc, input) {
  const existing = await svc.entities.DirectoryImportMutation.filter({ mutation_key: input.mutation_key }, "-created_date", 2).catch(() => []);
  if (existing[0]) return existing[0];
  return svc.entities.DirectoryImportMutation.create(input);
}
async function getEntity(svc, entityType, entityId) {
  if (entityType === "ProviderOrganization") return svc.entities.ProviderOrganization.get(entityId).catch(() => null);
  if (entityType === "ProviderLocation") return svc.entities.ProviderLocation.get(entityId).catch(() => null);
  if (entityType === "ProviderLocationDirectoryState") return svc.entities.ProviderLocationDirectoryState.get(entityId).catch(() => null);
  if (entityType === "DirectoryOrganizationLocationLink") return svc.entities.DirectoryOrganizationLocationLink.get(entityId).catch(() => null);
  if (entityType === "ProviderEvidence") return svc.entities.ProviderEvidence.get(entityId).catch(() => null);
  return null;
}
async function updateEntity(svc, entityType, entityId, values) {
  if (entityType === "ProviderOrganization") return svc.entities.ProviderOrganization.update(entityId, values);
  if (entityType === "ProviderLocation") return svc.entities.ProviderLocation.update(entityId, values);
  if (entityType === "ProviderLocationDirectoryState") return svc.entities.ProviderLocationDirectoryState.update(entityId, values);
  if (entityType === "DirectoryOrganizationLocationLink") return svc.entities.DirectoryOrganizationLocationLink.update(entityId, values);
  if (entityType === "ProviderEvidence") return svc.entities.ProviderEvidence.update(entityId, values);
  throw new Error(`Entitate nerecunoscuta: ${entityType}`);
}
async function deleteEntity(svc, entityType, entityId) {
  if (entityType === "ProviderOrganization") return svc.entities.ProviderOrganization.delete(entityId);
  if (entityType === "ProviderLocation") return svc.entities.ProviderLocation.delete(entityId);
  if (entityType === "ProviderLocationDirectoryState") return svc.entities.ProviderLocationDirectoryState.delete(entityId);
  if (entityType === "DirectoryOrganizationLocationLink") return svc.entities.DirectoryOrganizationLocationLink.delete(entityId);
  if (entityType === "ProviderEvidence") return svc.entities.ProviderEvidence.delete(entityId);
  throw new Error(`Entitate nerecunoscuta: ${entityType}`);
}
async function listSnapshots(svc, input) {
  const limit = Math.max(1, Math.min(200, Number(input.limit || 50)));
  const snapshots = await svc.entities.DirectorySourceSnapshot.list("-created_date", limit).catch(() => []);
  const batches = await svc.entities.DirectoryImportBatch.list("-created_date", 500).catch(() => []);
  const latestBatchBySnapshot = /* @__PURE__ */ new Map();
  for (const batch of batches) {
    if (!batch.snapshot_id || latestBatchBySnapshot.has(batch.snapshot_id)) continue;
    latestBatchBySnapshot.set(batch.snapshot_id, batch);
  }
  return snapshots.map((snapshot) => ({
    ...snapshot,
    latest_batch: latestBatchBySnapshot.get(snapshot.id) || null
  }));
}
async function createSnapshot(svc, user, input) {
  const sourceVersion = clean3(input.source_version, 160);
  const sourceSha256 = clean3(input.source_sha256, 80).toLowerCase();
  const sourceName = clean3(input.source_name, 200);
  const sourceFormat = clean3(input.source_format, 30);
  if (!sourceVersion || !sourceName || !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    return response({ error: "Versiunea, numele sursei si SHA-256 valid sunt obligatorii." }, 400);
  }
  if (!["json", "ndjson", "csv", "markdown"].includes(sourceFormat)) {
    return response({ error: "Formatul sursei nu este acceptat." }, 400);
  }
  const existing = await svc.entities.DirectorySourceSnapshot.filter({ source_sha256: sourceSha256 }, "-created_date", 10).catch(() => []);
  const same = existing.find((item) => item.source_version === sourceVersion && item.status !== "archived");
  if (same) return response({ success: true, reused: true, snapshot: same });
  const snapshot = await svc.entities.DirectorySourceSnapshot.create({
    snapshot_key: sourceSnapshotKey(sourceVersion, sourceSha256),
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    source_name: sourceName,
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat,
    original_filename: clean3(input.original_filename, 240),
    column_map_json: JSON.stringify(input.column_map || {}),
    status: "uploading",
    total_rows: Number(input.total_rows || 0),
    uploaded_rows: 0,
    valid_rows: 0,
    blocked_rows: 0,
    duplicate_rows: 0,
    warning_rows: 0,
    summary_json: "{}",
    created_by_user_id: user.id,
    created_by_email: user.email || "",
    created_at_source: normalizeDate(input.created_at_source),
    notes: clean3(input.notes, 2e3)
  });
  await writeAudit(svc, user, "DirectorySourceSnapshot", snapshot.id, "directory_snapshot_created", {}, {
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat
  });
  return response({ success: true, reused: false, snapshot });
}
async function appendRows(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean3(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  if (!["draft", "uploading"].includes(snapshot.status) || snapshot.immutable_at) {
    return response({ error: "Snapshotul este blocat si nu mai accepta randuri." }, 409);
  }
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!rows.length || rows.length > DIRECTORY_IMPORT_MAX_CHUNK_SIZE) {
    return response({ error: `Trimite intre 1 si ${DIRECTORY_IMPORT_MAX_CHUNK_SIZE} randuri per lot.` }, 400);
  }
  let created = 0;
  let reused = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const sourceRow = rows[index] && typeof rows[index] === "object" ? rows[index] : {};
    const rowNumber = Number(sourceRow.__row_number || input.start_row_number || 0) + (sourceRow.__row_number ? 0 : index);
    const sourceRowKey = clean3(sourceRow.__source_row_key || `${snapshot.snapshot_key}:${rowNumber}`, 220);
    const raw = Object.fromEntries(Object.entries(sourceRow).filter(([key]) => !key.startsWith("__")));
    const rawPayload = stableStringify(raw);
    const rowHash = stableTextHash(rawPayload);
    const idempotencyKey = rowIdempotencyKey(snapshot.snapshot_key, sourceRowKey, rowHash);
    const existing = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id, idempotency_key: idempotencyKey }, "-created_date", 2).catch(() => []);
    if (existing[0]) {
      reused += 1;
      continue;
    }
    await svc.entities.DirectoryImportRow.create({
      snapshot_id: snapshot.id,
      row_number: rowNumber,
      source_row_key: sourceRowKey,
      row_hash: rowHash,
      idempotency_key: idempotencyKey,
      raw_payload_json: rawPayload,
      normalized_payload_json: "{}",
      planned_actions_json: "[]",
      status: "raw",
      validation_codes: [],
      validation_errors_json: "[]",
      validation_warnings_json: "[]",
      match_confidence: "none",
      candidate_matches_json: "[]",
      rollback_status: "not_required"
    });
    created += 1;
  }
  const uploadedRows = Number(snapshot.uploaded_rows || 0) + created;
  await svc.entities.DirectorySourceSnapshot.update(snapshot.id, {
    status: "uploading",
    uploaded_rows: uploadedRows,
    total_rows: Math.max(Number(snapshot.total_rows || 0), uploadedRows)
  });
  await writeAudit(svc, user, "DirectorySourceSnapshot", snapshot.id, "directory_snapshot_rows_appended", {
    uploaded_rows: snapshot.uploaded_rows || 0
  }, { uploaded_rows: uploadedRows, created, reused });
  return response({ success: true, created, reused, uploaded_rows: uploadedRows });
}
async function finalizeSnapshot(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean3(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  if (snapshot.immutable_at) {
    return response({
      success: true,
      reused: true,
      remaining: false,
      processed: 0,
      snapshot
    });
  }
  if (!["draft", "uploading", "validating"].includes(snapshot.status)) {
    return response({ error: "Snapshotul nu poate fi finalizat din starea curenta." }, 409);
  }
  if (snapshot.status !== "validating") {
    await svc.entities.DirectorySourceSnapshot.update(snapshot.id, { status: "validating" });
  }
  const rows = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id }, "row_number", MAX_ROWS).catch(() => []);
  const seenKeys = /* @__PURE__ */ new Map();
  let validRows = 0;
  let blockedRows = 0;
  let duplicateRows = 0;
  let warningRows = 0;
  const codeCounts = {};
  const rawRows = [];
  for (const row of rows) {
    if (row.status === "raw") {
      rawRows.push(row);
      continue;
    }
    const validationCodes = Array.isArray(row.validation_codes) ? row.validation_codes : [];
    const normalized = safeJson(row.normalized_payload_json, {});
    for (const code of validationCodes) codeCounts[code] = (codeCounts[code] || 0) + 1;
    if (asArray(safeJson(row.validation_warnings_json, [])).length) warningRows += 1;
    if (row.status === "valid") validRows += 1;
    else blockedRows += 1;
    if (validationCodes.includes("duplicate_within_snapshot")) duplicateRows += 1;
    const duplicateKey = snapshotDuplicateKey({
      ...normalized,
      location_external_key: row.location_external_key || normalized.location_external_key,
      address_fingerprint: row.address_fingerprint || normalized.address_fingerprint
    });
    if (duplicateKey) seenKeys.set(duplicateKey, row.id);
  }
  const requestedLimit = boundedChunkSize(
    input.limit,
    FINALIZATION_CHUNK
  );
  const processingRows = rawRows.slice(0, requestedLimit);
  for (const row of processingRows) {
    const raw = safeJson(row.raw_payload_json, {});
    const normalized = normalizeDirectoryImportRow(raw, {
      source_version: snapshot.source_version,
      source_row_key: row.source_row_key,
      row_number: row.row_number
    });
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: input.require_siruta !== false });
    const duplicateKey = snapshotDuplicateKey(normalized);
    if (duplicateKey && seenKeys.has(duplicateKey)) {
      validation.errors.push("duplicate_within_snapshot");
      validation.validation_codes.push("duplicate_within_snapshot");
      validation.valid = false;
      validation.blocked = true;
      duplicateRows += 1;
    } else if (duplicateKey) {
      seenKeys.set(duplicateKey, row.id);
    }
    for (const code of validation.validation_codes) codeCounts[code] = (codeCounts[code] || 0) + 1;
    if (validation.warnings.length) warningRows += 1;
    if (validation.valid) validRows += 1;
    else blockedRows += 1;
    await svc.entities.DirectoryImportRow.update(row.id, {
      organization_external_key: normalized.organization_external_key || "",
      location_external_key: normalized.location_external_key || "",
      address_fingerprint: normalized.address_fingerprint || "",
      normalized_payload_json: JSON.stringify(normalized),
      status: validation.valid ? "valid" : "blocked",
      validation_codes: validation.validation_codes,
      validation_errors_json: JSON.stringify(validation.errors),
      validation_warnings_json: JSON.stringify(validation.warnings),
      planned_action: validation.valid ? void 0 : normalized.pseudo_row_reason || validation.errors.includes("source_row_not_eligible") ? "reject_invalid" : "block_conflict",
      error_message: validation.valid ? "" : validation.errors.join(", ")
    });
  }
  const remainingRows = rawRows.length - processingRows.length;
  const summary = {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    code_counts: codeCounts,
    require_siruta: input.require_siruta !== false,
    finalization_chunk_size: requestedLimit,
    finalization_processed_rows: rows.length - remainingRows,
    finalization_remaining_rows: remainingRows
  };
  const progressUpdates = {
    status: remainingRows > 0 ? "validating" : validRows > 0 ? "ready" : "blocked",
    total_rows: rows.length,
    uploaded_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    duplicate_rows: duplicateRows,
    warning_rows: warningRows,
    summary_json: JSON.stringify(summary)
  };
  if (remainingRows > 0) {
    await svc.entities.DirectorySourceSnapshot.update(snapshot.id, progressUpdates);
    return response({
      success: true,
      remaining: true,
      processed: processingRows.length,
      remaining_rows: remainingRows,
      snapshot: { ...snapshot, ...progressUpdates }
    });
  }
  const finalizedAt = now();
  const finalUpdates = {
    ...progressUpdates,
    finalized_at: finalizedAt,
    immutable_at: finalizedAt
  };
  await svc.entities.DirectorySourceSnapshot.update(snapshot.id, finalUpdates);
  await writeAudit(svc, user, "DirectorySourceSnapshot", snapshot.id, "directory_snapshot_finalized", {}, {
    status: finalUpdates.status,
    total_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    duplicate_rows: duplicateRows
  });
  return response({
    success: true,
    remaining: false,
    processed: processingRows.length,
    remaining_rows: 0,
    snapshot: { ...snapshot, ...finalUpdates }
  });
}
function locationComparablePayload(location) {
  return {
    name: location.name || "",
    city: location.city || "",
    county_name: location.county_name || "",
    locality_name: location.locality_name || "",
    locality_siruta_code: location.locality_siruta_code || "",
    address: location.address || "",
    phone_public: location.phone_public || "",
    public_email: location.public_email || "",
    website: location.website || "",
    opening_hours: location.opening_hours || "",
    active_status: location.active_status || "activa"
  };
}
function locationUpdatePayload(row) {
  return {
    name: row.location_name,
    city: row.locality_name,
    locality_name: row.locality_name,
    locality_siruta_code: row.locality_siruta_code,
    county: row.county_name,
    county_name: row.county_name,
    address: row.address,
    phone_public: row.phone,
    public_email: row.email,
    website: row.website,
    opening_hours: row.schedule,
    active_status: activeStatusFor(row),
    source_url: row.source_url,
    source_name: row.source_name || row.organization_name || row.location_name,
    source_type: row.source_type || "official",
    source_checked_at: normalizeDate(row.source_checked_at),
    data_confidence: confidenceFor(row),
    data_source: "public_source",
    last_confirmed_at: normalizeDate(row.source_checked_at) || now(),
    migration_review_required: false
  };
}
function locationCreatePayload(row, organizationId = null) {
  return {
    organization_id: organizationId || null,
    name: row.location_name,
    provider_type: row.provider_type,
    provider_profile_type: row.provider_profile_type,
    city: row.locality_name,
    county: row.county_name,
    locality_siruta_code: row.locality_siruta_code,
    locality_name: row.locality_name,
    county_name: row.county_name,
    address: row.address,
    phone_public: row.phone,
    public_email: row.email,
    website: row.website,
    opening_hours: row.schedule,
    request_intake_status: "inactive",
    public_visibility_status: "draft",
    status: "draft",
    profile_control_status: "directory",
    claim_verification_status: "none",
    verification_state: "unclaimed",
    active_status: activeStatusFor(row),
    is_verified: false,
    source_url: row.source_url,
    source_name: row.source_name || row.organization_name || row.location_name,
    source_type: row.source_type || "official",
    source_checked_at: normalizeDate(row.source_checked_at),
    data_confidence: confidenceFor(row),
    data_source: "public_source",
    last_confirmed_at: normalizeDate(row.source_checked_at) || now(),
    migration_review_required: false
  };
}
function directoryStatePayload(row, locationId, organizationLinked) {
  return {
    location_id: locationId,
    directory_external_key: row.location_external_key,
    directory_source_version: row.source_version,
    address_fingerprint: row.address_fingerprint,
    location_type_code: row.location_type_code,
    care_setting_code: row.care_setting_code,
    ownership_type_code: row.ownership_type_code || "unknown",
    operational_status: row.operational_status,
    publication_status: "draft",
    control_status: "directory",
    data_quality_status: row.data_quality_status,
    directory_detail_level: "summary",
    directory_basic_details_approved: false,
    organization_link_status: organizationLinked ? "confirmed" : "unassigned",
    organization_link_confidence: organizationLinked ? confidenceFor(row) : "low",
    organization_link_review_note: organizationLinked ? "Confirmat prin aprobarea administrativa a lotului de import." : "Fara organizatie confirmata la import.",
    source_checked_at: normalizeDate(row.source_checked_at),
    normalized_at: now(),
    state_status: "active"
  };
}
async function loadPlanningContext(svc) {
  const [organizations, locations, states] = await Promise.all([
    svc.entities.ProviderOrganization.list("name", MAX_ROWS).catch(() => []),
    svc.entities.ProviderLocation.list("name", MAX_ROWS).catch(() => []),
    svc.entities.ProviderLocationDirectoryState.filter({ state_status: "active" }, "-created_date", MAX_ROWS).catch(() => [])
  ]);
  const organizationsByExternalKey = /* @__PURE__ */ new Map();
  const organizationsByName = /* @__PURE__ */ new Map();
  const append = (map, key, value) => {
    if (!key) return;
    const rows = map.get(key) || [];
    rows.push(value);
    map.set(key, rows);
  };
  for (const organization of organizations) {
    append(
      organizationsByExternalKey,
      organization.directory_external_key,
      organization
    );
    const normalizedName = normalizeIdentityText(organization.public_display_name || organization.name);
    append(organizationsByName, normalizedName, organization);
  }
  const statesByExternalKey = /* @__PURE__ */ new Map();
  const statesByAddress = /* @__PURE__ */ new Map();
  for (const state of states) {
    append(statesByExternalKey, state.directory_external_key, state);
    append(statesByAddress, state.address_fingerprint, state);
  }
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const locationsByFallback = /* @__PURE__ */ new Map();
  for (const location of locations) {
    const key = [normalizeIdentityText(location.locality_name || location.city), normalizeIdentityText(location.address), normalizeIdentityText(location.public_display_name || location.name)].join("|");
    if (key.replace(/\|/g, "")) append(locationsByFallback, key, location);
  }
  return { organizationsByExternalKey, organizationsByName, statesByExternalKey, statesByAddress, locationsById, locationsByFallback };
}
function applyAdminOverride(normalized, row) {
  const override = safeJson(row.admin_override_json, {});
  const merged = {
    ...normalized,
    ...override,
    source_row_key: normalized.source_row_key,
    row_number: normalized.row_number,
    contract_version: normalized.contract_version
  };
  if (Object.prototype.hasOwnProperty.call(override, "organization_type_code")) {
    const organizationTypeCode = clean3(override.organization_type_code, 120);
    merged.organization_type_code = organizationTypeCode;
    merged.organization_type_source = "admin_override";
    merged.organization_type_invalid = Boolean(organizationTypeCode) && !isDirectoryOrganizationTypeCode(organizationTypeCode);
    merged.organization_type_legacy_fallback = false;
  }
  return merged;
}
async function planBatch(svc, user, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean3(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  if (!["ready", "blocked"].includes(snapshot.status) || !snapshot.immutable_at) {
    return response({ error: "Finalizeaza snapshotul inainte de dry-run." }, 409);
  }
  const existingBatches = await svc.entities.DirectoryImportBatch.filter({ snapshot_id: snapshot.id }, "-created_date", 100).catch(() => []);
  const active = existingBatches.find((batch2) => !["completed", "completed_with_errors", "failed", "rolled_back", "rollback_failed"].includes(batch2.status));
  if (active && active.status !== "planning") {
    return response({ success: true, reused: true, remaining: false, batch: active });
  }
  const batchKey = active?.batch_key || batchKeyFor(snapshot, existingBatches.length + 1);
  const batch = active || await svc.entities.DirectoryImportBatch.create({
    batch_key: batchKey,
    snapshot_id: snapshot.id,
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    source_version: snapshot.source_version,
    source_sha256: snapshot.source_sha256,
    idempotency_key: `batch:${stableTextHash(`${snapshot.id}|${snapshot.source_sha256}|${existingBatches.length + 1}`)}`,
    mode: "dry_run",
    status: "planning",
    execution_cursor: 0,
    rollback_cursor: 0,
    total_rows: 0,
    valid_rows: 0,
    blocked_rows: 0,
    ready_rows: 0,
    applied_rows: 0,
    failed_rows: 0,
    skipped_rows: 0,
    created_organizations: 0,
    created_locations: 0,
    updated_locations: 0,
    created_links: 0,
    summary_json: "{}",
    created_by_user_id: user.id
  });
  const rows = await svc.entities.DirectoryImportRow.filter({ snapshot_id: snapshot.id }, "row_number", MAX_ROWS).catch(() => []);
  const context = await loadPlanningContext(svc);
  const actionNames = [
    "create_organization_and_location",
    "create_location_use_existing_organization",
    "create_location_without_organization",
    "update_existing_location",
    "link_existing_location",
    "skip_unchanged",
    "skip_duplicate",
    "block_conflict",
    "reject_invalid"
  ];
  const counts = Object.fromEntries(actionNames.map((key) => [key, 0]));
  let readyRows = 0;
  let blockedRows = 0;
  let validRows = 0;
  const organizationsPlannedForUpdate = /* @__PURE__ */ new Set();
  const alreadyPlannedRows = rows.filter((row) => row.batch_id === batch.id);
  for (const row of alreadyPlannedRows) {
    const action = clean3(row.planned_action, 80);
    if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action] += 1;
    if (row.status === "ready") readyRows += 1;
    else blockedRows += 1;
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: true });
    const organizationTypeResolution = normalized.organization_name ? resolveProviderOrganizationType(normalized) : null;
    if (validation.valid && normalized.provider_type && normalized.provider_profile_type && normalized.location_type_code && normalized.care_setting_code && (!organizationTypeResolution || organizationTypeResolution.valid)) {
      validRows += 1;
    }
    const plannedActions = asArray(safeJson(row.planned_actions_json, []));
    if (plannedActions.includes("update_directory_organization") && row.target_organization_id) {
      organizationsPlannedForUpdate.add(row.target_organization_id);
    }
  }
  const requestedLimit = boundedChunkSize(input.limit, PLANNING_CHUNK);
  const unplannedRows = rows.filter((row) => row.batch_id !== batch.id);
  const planningRows = unplannedRows.slice(0, requestedLimit);
  for (const row of planningRows) {
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: true });
    const organizationTypeResolution = normalized.organization_name ? resolveProviderOrganizationType(normalized) : null;
    let plannedAction = "block_conflict";
    let targetOrganization = null;
    let targetLocation = null;
    let matchStrategy = "none";
    let matchConfidence = "none";
    const candidates = [];
    const supplementalActions = [];
    let organizationReconciliation = null;
    let organizationMatchError = "";
    let locationMatchError = "";
    if (!validation.valid) {
      plannedAction = normalized.pseudo_row_reason || validation.errors.includes("source_row_not_eligible") ? "reject_invalid" : "block_conflict";
    } else if (!normalized.provider_type || !normalized.provider_profile_type || !normalized.location_type_code || !normalized.care_setting_code) {
      plannedAction = "block_conflict";
      validation.errors.push("canonical_type_not_resolved");
      validation.validation_codes.push("canonical_type_not_resolved");
    } else if (organizationTypeResolution && !organizationTypeResolution.valid) {
      plannedAction = "block_conflict";
      validation.errors.push(organizationTypeResolution.error_code);
      validation.validation_codes.push(organizationTypeResolution.error_code);
    } else {
      validRows += 1;
      const organizationMatch = resolveDirectoryOrganizationMatch({
        externalCandidates: normalized.organization_external_key ? context.organizationsByExternalKey.get(normalized.organization_external_key) || [] : [],
        nameCandidates: normalized.organization_name ? context.organizationsByName.get(normalizeIdentityText(normalized.organization_name)) || [] : []
      });
      targetOrganization = organizationMatch.target;
      organizationMatchError = organizationMatch.error_code;
      for (const id of organizationMatch.candidate_ids) {
        candidates.push({
          entity_type: "ProviderOrganization",
          id,
          strategy: organizationMatch.strategy,
          confidence: organizationMatch.confidence
        });
      }
      if (organizationMatchError) {
        validation.errors.push(organizationMatchError);
        validation.validation_codes.push(organizationMatchError);
      }
      if (targetOrganization) {
        organizationReconciliation = planDirectoryOrganizationReconciliation(targetOrganization, normalized);
        if (!organizationReconciliation.valid) {
          validation.errors.push(organizationReconciliation.error_code);
          validation.validation_codes.push(organizationReconciliation.error_code);
        }
      }
      const fallbackKey = [
        normalizeIdentityText(normalized.locality_name),
        normalizeIdentityText(normalized.address),
        normalizeIdentityText(normalized.location_name)
      ].join("|");
      const locationMatch = resolveDirectoryLocationMatch({
        externalStates: context.statesByExternalKey.get(normalized.location_external_key) || [],
        exactFallbackCandidates: context.locationsByFallback.get(fallbackKey) || [],
        addressStates: context.statesByAddress.get(normalized.address_fingerprint) || [],
        locationsById: context.locationsById
      });
      targetLocation = locationMatch.target;
      matchStrategy = locationMatch.strategy;
      matchConfidence = locationMatch.confidence;
      locationMatchError = locationMatch.error_code;
      for (const id of locationMatch.candidate_ids) {
        candidates.push({
          entity_type: "ProviderLocation",
          id,
          strategy: locationMatch.strategy,
          confidence: locationMatch.confidence
        });
      }
      if (locationMatchError) {
        validation.errors.push(locationMatchError);
        validation.validation_codes.push(locationMatchError);
      }
      if (organizationMatchError || locationMatchError || organizationReconciliation && !organizationReconciliation.valid) {
        plannedAction = "block_conflict";
      } else if (targetLocation && CONTROLLED_PROFILES.has(targetLocation.profile_control_status || "directory")) {
        plannedAction = "block_conflict";
        validation.errors.push("controlled_profile_requires_manual_update");
        validation.validation_codes.push("controlled_profile_requires_manual_update");
      } else if (targetLocation) {
        const updates2 = locationUpdatePayload(normalized);
        const comparable = locationComparablePayload(targetLocation);
        const expectedComparable = pickFields(updates2, Object.keys(comparable));
        const same = equalFieldSubset(comparable, expectedComparable);
        if (same && (!targetOrganization || targetLocation.organization_id === targetOrganization.id)) plannedAction = "skip_unchanged";
        else if (targetOrganization && targetLocation.organization_id !== targetOrganization.id) plannedAction = "link_existing_location";
        else plannedAction = "update_existing_location";
      } else if (targetOrganization) {
        plannedAction = "create_location_use_existing_organization";
      } else if (normalized.organization_name) {
        plannedAction = "create_organization_and_location";
      } else {
        plannedAction = "create_location_without_organization";
      }
    }
    const rowReady = !["block_conflict", "reject_invalid"].includes(plannedAction);
    if (rowReady && organizationReconciliation?.requires_update) {
      supplementalActions.push("update_directory_organization");
      organizationsPlannedForUpdate.add(targetOrganization.id);
    }
    if (rowReady) readyRows += 1;
    else blockedRows += 1;
    counts[plannedAction] += 1;
    await svc.entities.DirectoryImportRow.update(row.id, {
      batch_id: batch.id,
      normalized_payload_json: JSON.stringify(normalized),
      planned_action: plannedAction,
      planned_actions_json: JSON.stringify([...supplementalActions, plannedAction]),
      status: rowReady ? "ready" : "blocked",
      validation_codes: [...new Set(validation.validation_codes)],
      validation_errors_json: JSON.stringify(validation.errors),
      validation_warnings_json: JSON.stringify(validation.warnings),
      match_strategy: matchStrategy,
      match_confidence: matchConfidence,
      candidate_matches_json: JSON.stringify(candidates),
      target_organization_id: targetOrganization?.id || "",
      target_location_id: targetLocation?.id || "",
      error_message: rowReady ? "" : validation.errors.join(", ")
    });
  }
  const remainingRows = unplannedRows.length - planningRows.length;
  const planningState = {
    chunk_size: requestedLimit,
    processed_rows: rows.length - remainingRows,
    remaining_rows: remainingRows,
    organization_update_ids: [...organizationsPlannedForUpdate].sort()
  };
  const summary = {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    action_counts: counts,
    supplemental_action_counts: {
      update_directory_organization: organizationsPlannedForUpdate.size
    },
    planning_state: planningState,
    approval_token: remainingRows > 0 ? "" : batchApprovalToken(batchKey, snapshot.source_sha256, readyRows),
    safety: {
      publishes_profiles: false,
      verifies_profiles: false,
      creates_services: false,
      grants_access: false,
      updates_controlled_profiles: false,
      updates_controlled_organizations: false,
      updates_directory_organizations: organizationsPlannedForUpdate.size > 0
    }
  };
  const updates = {
    status: remainingRows > 0 ? "planning" : readyRows > 0 ? "ready" : "failed",
    total_rows: rows.length,
    valid_rows: validRows,
    blocked_rows: blockedRows,
    ready_rows: readyRows,
    summary_json: JSON.stringify(summary),
    failure_message: remainingRows > 0 || readyRows > 0 ? "" : "Nu exista randuri pregatite pentru import."
  };
  await svc.entities.DirectoryImportBatch.update(batch.id, updates);
  if (remainingRows > 0) {
    return response({
      success: true,
      reused: Boolean(active),
      remaining: true,
      processed: planningRows.length,
      remaining_rows: remainingRows,
      batch: { ...batch, ...updates },
      summary
    });
  }
  await writeAudit(svc, user, "DirectoryImportBatch", batch.id, "directory_import_dry_run_created", {}, { ...updates, summary });
  return response({
    success: true,
    reused: Boolean(active),
    remaining: false,
    processed: planningRows.length,
    remaining_rows: 0,
    batch: { ...batch, ...updates },
    summary
  });
}
async function overrideRow(svc, user, input) {
  const row = await svc.entities.DirectoryImportRow.get(clean3(input.row_id, 120)).catch(() => null);
  if (!row) return response({ error: "Randul nu a fost gasit." }, 404);
  if (["applied", "rolled_back"].includes(row.status)) return response({ error: "Randul executat nu mai poate fi modificat." }, 409);
  const allowedKeys = [
    "organization_name",
    "organization_external_key",
    "location_name",
    "location_external_key",
    "locality_name",
    "county_name",
    "locality_siruta_code",
    "address",
    "address_fingerprint",
    "provider_type",
    "provider_profile_type",
    "organization_type_code",
    "location_type_code",
    "care_setting_code",
    "ownership_type_code",
    "operational_status",
    "source_url",
    "source_name",
    "source_type",
    "source_checked_at",
    "phone",
    "email",
    "website",
    "schedule"
  ];
  const override = pickFields(input.override || {}, allowedKeys);
  if (!Object.keys(override).length) return response({ error: "Nu exista campuri de corectat." }, 400);
  const previous = safeJson(row.admin_override_json, {});
  if (row.batch_id) {
    const batch = await svc.entities.DirectoryImportBatch.get(row.batch_id).catch(() => null);
    if (batch && ["planning", "ready"].includes(batch.status)) {
      await svc.entities.DirectoryImportBatch.update(batch.id, {
        status: "failed",
        failure_message: `Randul ${row.row_number} a fost modificat dupa dry-run. Genereaza un dry-run nou.`
      });
    }
  }
  await svc.entities.DirectoryImportRow.update(row.id, {
    admin_override_json: JSON.stringify({ ...previous, ...override }),
    status: "valid",
    batch_id: "",
    planned_action: void 0,
    planned_actions_json: "[]",
    error_message: ""
  });
  await writeAudit(svc, user, "DirectoryImportRow", row.id, "directory_import_row_overridden", previous, override, clean3(input.note, 1200));
  return response({ success: true, row_id: row.id });
}
async function approveBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean3(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (batch.status !== "ready") return response({ error: "Lotul nu este pregatit pentru aprobare." }, 409);
  const expected = batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows);
  if (clean3(input.confirmation, 240) !== expected) {
    return response({ error: "Confirmarea nu corespunde lotului curent.", expected_confirmation: expected }, 400);
  }
  const approvalTokenHash = stableTextHash(expected);
  const updates = {
    mode: "import",
    status: "approved",
    approval_token_hash: approvalTokenHash,
    approved_by_user_id: user.id,
    approved_at: now()
  };
  await svc.entities.DirectoryImportBatch.update(batch.id, updates);
  await writeAudit(svc, user, "DirectoryImportBatch", batch.id, "directory_import_batch_approved", { status: batch.status }, updates);
  return response({ success: true, batch: { ...batch, ...updates } });
}
async function ensureOrganization(svc, user, batch, rowRecord, row, allowDirectoryOrganizationUpdate = false) {
  if (!row.organization_name) return { organization: null, created: false, updated: false };
  let target = null;
  if (rowRecord.target_organization_id) {
    target = await svc.entities.ProviderOrganization.get(rowRecord.target_organization_id).catch(() => null);
  }
  if (!target) {
    const existing = row.organization_external_key ? await svc.entities.ProviderOrganization.filter({ directory_external_key: row.organization_external_key }, "-created_date", 5).catch(() => []) : [];
    if (existing.length > 1) {
      throw new Error("Mai multe organizatii folosesc aceeasi cheie externa; executia este blocata pentru verificare manuala.");
    }
    target = existing[0] || null;
  }
  if (target) {
    const reconciliation = planDirectoryOrganizationReconciliation(target, row);
    if (!reconciliation.valid) {
      throw new Error(`Organizatia existenta necesita verificare manuala: ${reconciliation.error_code}.`);
    }
    if (!reconciliation.requires_update) {
      return { organization: target, created: false, updated: false };
    }
    if (!allowDirectoryOrganizationUpdate) {
      throw new Error("Organizatia s-a schimbat dupa dry-run; regenereaza planul inainte de executie.");
    }
    const before = pickFields(target, Object.keys(reconciliation.updates));
    const updated = await svc.entities.ProviderOrganization.update(target.id, reconciliation.updates);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: Number(batch.applied_rows || 0) * 10 + 1,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderOrganization:${target.id}:update`,
      entity_type: "ProviderOrganization",
      entity_id: target.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(reconciliation.updates),
      rollback_status: "pending",
      applied_at: now()
    });
    await writeAudit(
      svc,
      user,
      "ProviderOrganization",
      target.id,
      "directory_import_organization_updated",
      before,
      reconciliation.updates,
      `Lot ${batch.batch_key}`
    );
    return {
      organization: updated || { ...target, ...reconciliation.updates },
      created: false,
      updated: true
    };
  }
  const canonical = resolveDirectoryOrganizationCanonicalPayload(row);
  if (!canonical.valid) {
    throw new Error(`Tipul organizatiei nu poate fi rezolvat: ${canonical.error_code}.`);
  }
  const values = {
    ...canonical.values,
    legal_name: "",
    website: row.website || "",
    control_status: "directory",
    publication_status: "draft",
    data_quality_status: row.data_quality_status,
    source_checked_at: normalizeDate(row.source_checked_at),
    public_visibility_status: "draft",
    status: "activa"
  };
  const organization = await svc.entities.ProviderOrganization.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence: Number(batch.applied_rows || 0) * 10 + 1,
    mutation_key: `${batch.id}:${rowRecord.id}:ProviderOrganization:${organization.id}:create`,
    entity_type: "ProviderOrganization",
    entity_id: organization.id,
    operation: "create",
    before_json: "{}",
    after_json: JSON.stringify(values),
    rollback_status: "pending",
    applied_at: now()
  });
  await writeAudit(svc, user, "ProviderOrganization", organization.id, "directory_import_organization_created", {}, values, `Lot ${batch.batch_key}`);
  return { organization, created: true, updated: false };
}
async function createEvidence(svc, user, batch, rowRecord, row, entityType, entityId, sequence) {
  if (!row.source_url) return null;
  const values = {
    entity_type: entityType,
    entity_id: entityId,
    field_name: "directory_import_snapshot",
    value_snapshot: JSON.stringify({ source_version: row.source_version, source_row_key: row.source_row_key }),
    source_url: row.source_url,
    source_type: row.source_type || "official",
    source_title: row.source_name || row.organization_name || row.location_name,
    collected_at: now(),
    collected_by: user.id,
    checked_at: normalizeDate(row.source_checked_at),
    confidence: confidenceFor(row),
    evidence_status: "active",
    notes: clean3([row.evidence_note, row.observations].filter(Boolean).join(" | "), 2e3)
  };
  const evidence = await svc.entities.ProviderEvidence.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:ProviderEvidence:${evidence.id}:create`,
    entity_type: "ProviderEvidence",
    entity_id: evidence.id,
    operation: "create",
    before_json: "{}",
    after_json: JSON.stringify(values),
    rollback_status: "pending",
    applied_at: now()
  });
  return evidence;
}
async function ensureDirectoryState(svc, user, batch, rowRecord, row, location, organizationLinked, sequence) {
  const existing = await svc.entities.ProviderLocationDirectoryState.filter({ location_id: location.id, state_status: "active" }, "-created_date", 5).catch(() => []);
  const values = directoryStatePayload(row, location.id, organizationLinked);
  if (existing[0]) {
    const before = pickFields(existing[0], Object.keys(values));
    await svc.entities.ProviderLocationDirectoryState.update(existing[0].id, values);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${existing[0].id}:update`,
      entity_type: "ProviderLocationDirectoryState",
      entity_id: existing[0].id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(values),
      rollback_status: "pending",
      applied_at: now()
    });
    return existing[0].id;
  }
  const state = await svc.entities.ProviderLocationDirectoryState.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${state.id}:create`,
    entity_type: "ProviderLocationDirectoryState",
    entity_id: state.id,
    operation: "create",
    before_json: "{}",
    after_json: JSON.stringify(values),
    rollback_status: "pending",
    applied_at: now()
  });
  await writeAudit(svc, user, "ProviderLocationDirectoryState", state.id, "directory_import_state_created", {}, values, `Lot ${batch.batch_key}`);
  return state.id;
}
async function ensureOrganizationLink(svc, user, batch, rowRecord, row, locationId, organizationId, sequence) {
  if (!organizationId) return null;
  const active = await svc.entities.DirectoryOrganizationLocationLink.filter({ location_id: locationId, link_record_status: "active" }, "-created_date", 20).catch(() => []);
  for (const existing of active) {
    if (existing.organization_id === organizationId && existing.link_status === "confirmed") return existing.id;
    const before = { link_record_status: existing.link_record_status };
    const after = { link_record_status: "superseded" };
    await svc.entities.DirectoryOrganizationLocationLink.update(existing.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 1,
      mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${existing.id}:update`,
      entity_type: "DirectoryOrganizationLocationLink",
      entity_id: existing.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: "pending",
      applied_at: now()
    });
  }
  const values = {
    organization_id: organizationId,
    location_id: locationId,
    source_row_key: row.source_row_key,
    source_version: row.source_version,
    link_status: "confirmed",
    confidence: confidenceFor(row),
    evidence_summary: row.evidence_note || `Asociere aprobata prin lotul ${batch.batch_key}.`,
    review_note: `Confirmata la aprobarea lotului de import ${batch.batch_key}.`,
    reviewed_by_user_id: user.id,
    reviewed_at: now(),
    link_record_status: "active"
  };
  const link = await svc.entities.DirectoryOrganizationLocationLink.create(values);
  await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${link.id}:create`,
    entity_type: "DirectoryOrganizationLocationLink",
    entity_id: link.id,
    operation: "create",
    before_json: "{}",
    after_json: JSON.stringify(values),
    rollback_status: "pending",
    applied_at: now()
  });
  await writeAudit(svc, user, "DirectoryOrganizationLocationLink", link.id, "directory_import_organization_link_created", {}, values, `Lot ${batch.batch_key}`);
  return link.id;
}
async function executeRow(svc, user, batch, rowRecord) {
  const row = applyAdminOverride(safeJson(rowRecord.normalized_payload_json, {}), rowRecord);
  const plannedActions = safeJson(rowRecord.planned_actions_json, []);
  const updatesDirectoryOrganization = Array.isArray(plannedActions) && plannedActions.includes("update_directory_organization");
  const result = {
    action: rowRecord.planned_action,
    created_organization: false,
    updated_organization: false,
    created_location: false,
    updated_location: false,
    created_link: false
  };
  if (rowRecord.planned_action === "skip_unchanged" && !updatesDirectoryOrganization || rowRecord.planned_action === "skip_duplicate") {
    await svc.entities.DirectoryImportRow.update(rowRecord.id, { status: "skipped", result_json: JSON.stringify(result), applied_at: now(), rollback_status: "not_required" });
    return { status: "skipped", result };
  }
  if (["block_conflict", "reject_invalid"].includes(rowRecord.planned_action)) throw new Error("Randul nu este eligibil pentru executie.");
  let organization = null;
  if (row.organization_name) {
    const organizationResult = await ensureOrganization(
      svc,
      user,
      batch,
      rowRecord,
      row,
      updatesDirectoryOrganization
    );
    organization = organizationResult.organization;
    result.created_organization = organizationResult.created;
    result.updated_organization = organizationResult.updated;
  }
  if (rowRecord.planned_action === "skip_unchanged") {
    result.organization_id = organization?.id || null;
    result.location_id = rowRecord.target_location_id || null;
    const status = result.created_organization || result.updated_organization ? "applied" : "skipped";
    await svc.entities.DirectoryImportRow.update(rowRecord.id, {
      status,
      result_json: JSON.stringify(result),
      applied_at: now(),
      rollback_status: status === "applied" ? "pending" : "not_required",
      error_message: ""
    });
    return { status, result };
  }
  let location = rowRecord.target_location_id ? await svc.entities.ProviderLocation.get(rowRecord.target_location_id).catch(() => null) : null;
  if (location && CONTROLLED_PROFILES.has(location.profile_control_status || "directory")) throw new Error("Profilul este controlat si necesita actualizare manuala.");
  if (!location) {
    const values = locationCreatePayload(row, organization?.id || null);
    location = await svc.entities.ProviderLocation.create(values);
    result.created_location = true;
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: Number(batch.applied_rows || 0) * 10 + 2,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocation:${location.id}:create`,
      entity_type: "ProviderLocation",
      entity_id: location.id,
      operation: "create",
      before_json: "{}",
      after_json: JSON.stringify(values),
      rollback_status: "pending",
      applied_at: now()
    });
    await writeAudit(svc, user, "ProviderLocation", location.id, "directory_import_location_created", {}, values, `Lot ${batch.batch_key}`);
  } else {
    const updates = locationUpdatePayload(row);
    if (organization?.id) updates.organization_id = organization.id;
    const before = pickFields(location, Object.keys(updates));
    await svc.entities.ProviderLocation.update(location.id, updates);
    result.updated_location = true;
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: Number(batch.applied_rows || 0) * 10 + 2,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocation:${location.id}:update`,
      entity_type: "ProviderLocation",
      entity_id: location.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(updates),
      rollback_status: "pending",
      applied_at: now()
    });
    await writeAudit(svc, user, "ProviderLocation", location.id, "directory_import_location_updated", before, updates, `Lot ${batch.batch_key}`);
  }
  await ensureDirectoryState(svc, user, batch, rowRecord, row, location, Boolean(organization?.id), Number(batch.applied_rows || 0) * 10 + 4);
  if (organization?.id) {
    await ensureOrganizationLink(svc, user, batch, rowRecord, row, location.id, organization.id, Number(batch.applied_rows || 0) * 10 + 6);
    result.created_link = true;
  }
  await createEvidence(svc, user, batch, rowRecord, row, "ProviderLocation", location.id, Number(batch.applied_rows || 0) * 10 + 8);
  result.organization_id = organization?.id || null;
  result.location_id = location.id;
  await svc.entities.DirectoryImportRow.update(rowRecord.id, {
    status: "applied",
    target_organization_id: organization?.id || "",
    target_location_id: location.id,
    result_json: JSON.stringify(result),
    applied_at: now(),
    rollback_status: "pending",
    error_message: ""
  });
  return { status: "applied", result };
}
async function acquireBatchLock(svc, batch, requestedToken = "") {
  const currentExpiry = batch.execution_lock_expires_at ? new Date(batch.execution_lock_expires_at).getTime() : 0;
  const currentToken = clean3(batch.execution_lock_token, 200);
  const supplied = clean3(requestedToken, 200);
  if (currentToken && currentExpiry > Date.now() && supplied !== currentToken) return { error: "Lotul este procesat de alta executie." };
  const token = supplied && supplied === currentToken ? supplied : randomToken("import");
  await svc.entities.DirectoryImportBatch.update(batch.id, { execution_lock_token: token, execution_lock_expires_at: lockExpiry() });
  return { token };
}
async function executeBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean3(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (!["approved", "running"].includes(batch.status)) return response({ error: "Lotul nu este aprobat sau nu poate continua." }, 409);
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);
  if (batch.status === "approved") {
    await svc.entities.DirectoryImportBatch.update(batch.id, { status: "running", started_at: now() });
  }
  const limit = boundedChunkSize(input.limit, EXECUTION_CHUNK);
  const rows = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: "ready" }, "row_number", limit).catch(() => []);
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  let createdOrganizations = 0;
  let updatedOrganizations = 0;
  let createdLocations = 0;
  let updatedLocations = 0;
  let createdLinks = 0;
  for (const row of rows) {
    try {
      const outcome = await executeRow(svc, user, { ...batch, applied_rows: Number(batch.applied_rows || 0) + applied }, row);
      if (outcome.status === "applied") {
        applied += 1;
        if (outcome.result.created_organization) createdOrganizations += 1;
        if (outcome.result.updated_organization) updatedOrganizations += 1;
        if (outcome.result.created_location) createdLocations += 1;
        if (outcome.result.updated_location) updatedLocations += 1;
        if (outcome.result.created_link) createdLinks += 1;
      } else skipped += 1;
    } catch (error) {
      failed += 1;
      await svc.entities.DirectoryImportRow.update(row.id, { status: "failed", error_message: error?.message || "Executia randului a esuat.", result_json: "{}" });
    }
  }
  const remaining = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: "ready" }, "row_number", 2).catch(() => []);
  const totals = {
    execution_cursor: Number(batch.execution_cursor || 0) + rows.length,
    applied_rows: Number(batch.applied_rows || 0) + applied,
    skipped_rows: Number(batch.skipped_rows || 0) + skipped,
    failed_rows: Number(batch.failed_rows || 0) + failed,
    created_organizations: Number(batch.created_organizations || 0) + createdOrganizations,
    created_locations: Number(batch.created_locations || 0) + createdLocations,
    updated_locations: Number(batch.updated_locations || 0) + updatedLocations,
    created_links: Number(batch.created_links || 0) + createdLinks
  };
  const previousSummary = safeJson(batch.summary_json, {});
  const executionCounts = {
    ...previousSummary.execution_counts || {},
    updated_organizations: Number(previousSummary.execution_counts?.updated_organizations || 0) + updatedOrganizations
  };
  const completed = remaining.length === 0;
  const status = completed ? totals.failed_rows > 0 ? "completed_with_errors" : "completed" : "running";
  await svc.entities.DirectoryImportBatch.update(batch.id, {
    ...totals,
    summary_json: JSON.stringify({ ...previousSummary, execution_counts: executionCounts }),
    status,
    finished_at: completed ? now() : null,
    execution_lock_token: completed ? "" : lock.token,
    execution_lock_expires_at: completed ? null : lockExpiry()
  });
  if (completed) {
    await svc.entities.DirectorySourceSnapshot.update(batch.snapshot_id, { status: "imported" });
    await writeAudit(svc, user, "DirectoryImportBatch", batch.id, "directory_import_batch_completed", {}, { ...totals, status });
  }
  return response({
    success: true,
    batch_id: batch.id,
    status,
    lock_token: completed ? "" : lock.token,
    processed: rows.length,
    applied,
    skipped,
    failed,
    remaining: !completed,
    totals: { ...totals, updated_organizations: executionCounts.updated_organizations }
  });
}
async function canDeleteCreatedLocation(svc, entity) {
  if (!entity || entity.profile_control_status !== "directory") return false;
  const [memberships, services] = await Promise.all([
    svc.entities.ProviderMembership.filter({ location_id: entity.id, status: "active" }, "-created_date", 2).catch(() => []),
    svc.entities.LocationService.filter({ location_id: entity.id }, "-created_date", 2).catch(() => [])
  ]);
  return memberships.length === 0 && services.length === 0;
}
async function canDeleteCreatedOrganization(svc, entity) {
  if (!entity || entity.control_status !== "directory") return false;
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: entity.id }, "-created_date", 2).catch(() => []);
  return locations.length === 0;
}
async function rollbackMutation(svc, mutation) {
  const current = await getEntity(svc, mutation.entity_type, mutation.entity_id);
  if (mutation.operation === "create") {
    if (!current) return { success: true, already_absent: true };
    if (mutation.entity_type === "ProviderLocation" && !await canDeleteCreatedLocation(svc, current)) throw new Error("Locatia a primit date sau acces dupa import si nu poate fi stearsa automat.");
    if (mutation.entity_type === "ProviderOrganization" && !await canDeleteCreatedOrganization(svc, current)) throw new Error("Organizatia are inca locatii si nu poate fi stearsa automat.");
    const expected = safeJson(mutation.after_json, {});
    if (!equalFieldSubset(current, expected)) throw new Error("Entitatea creata a fost modificata dupa import.");
    await deleteEntity(svc, mutation.entity_type, mutation.entity_id);
    return { success: true };
  }
  if (!current) throw new Error("Entitatea actualizata nu mai exista.");
  const after = safeJson(mutation.after_json, {});
  if (!equalFieldSubset(current, after)) throw new Error("Entitatea a fost modificata dupa import; rollbackul automat este blocat.");
  const before = safeJson(mutation.before_json, {});
  await updateEntity(svc, mutation.entity_type, mutation.entity_id, before);
  return { success: true };
}
async function rollbackBatch(svc, user, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean3(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (!["completed", "completed_with_errors", "rollback_failed", "rolling_back"].includes(batch.status)) {
    return response({ error: "Lotul nu poate fi retras in starea curenta." }, 409);
  }
  const expected = rollbackApprovalToken(batch.batch_key, batch.applied_rows);
  if (clean3(input.confirmation, 240) !== expected) return response({ error: "Confirmarea de rollback nu corespunde.", expected_confirmation: expected }, 400);
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);
  if (batch.status !== "rolling_back") await svc.entities.DirectoryImportBatch.update(batch.id, { status: "rolling_back", rollback_started_at: now() });
  const limit = Math.max(1, Math.min(EXECUTION_CHUNK * 5, Number(input.limit || EXECUTION_CHUNK * 2)));
  const mutations = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: "pending" }, "-sequence", limit).catch(() => []);
  let completed = 0;
  let failed = 0;
  for (const mutation of mutations) {
    try {
      await rollbackMutation(svc, mutation);
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: "completed", rolled_back_at: now(), rollback_error: "" });
      completed += 1;
    } catch (error) {
      failed += 1;
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: "failed", rollback_error: error?.message || "Rollback esuat." });
    }
  }
  const pending = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: "pending" }, "-sequence", 2).catch(() => []);
  const failedMutations = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id, rollback_status: "failed" }, "-sequence", 2).catch(() => []);
  const done = pending.length === 0;
  const status = done ? failedMutations.length ? "rollback_failed" : "rolled_back" : "rolling_back";
  await svc.entities.DirectoryImportBatch.update(batch.id, {
    status,
    rollback_cursor: Number(batch.rollback_cursor || 0) + mutations.length,
    rollback_finished_at: done ? now() : null,
    execution_lock_token: done ? "" : lock.token,
    execution_lock_expires_at: done ? null : lockExpiry()
  });
  if (done && !failedMutations.length) {
    const rows = await svc.entities.DirectoryImportRow.filter({ batch_id: batch.id, status: "applied" }, "row_number", MAX_ROWS).catch(() => []);
    for (const row of rows) await svc.entities.DirectoryImportRow.update(row.id, { status: "rolled_back", rollback_status: "completed" });
    await svc.entities.DirectorySourceSnapshot.update(batch.snapshot_id, { status: "ready" });
    await writeAudit(svc, user, "DirectoryImportBatch", batch.id, "directory_import_batch_rolled_back", {}, { status: "rolled_back", completed_mutations: completed });
  }
  return response({ success: true, status, lock_token: done ? "" : lock.token, processed: mutations.length, completed, failed, remaining: !done });
}
async function getSnapshotDetail(svc, input) {
  const snapshot = await svc.entities.DirectorySourceSnapshot.get(clean3(input.snapshot_id, 120)).catch(() => null);
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const skip = Math.max(0, Number(input.skip || 0));
  const query = { snapshot_id: snapshot.id };
  if (input.status) query.status = clean3(input.status, 40);
  const all = await svc.entities.DirectoryImportRow.filter(query, "row_number", Math.min(MAX_ROWS, skip + limit)).catch(() => []);
  const rows = all.slice(skip, skip + limit);
  const batches = await svc.entities.DirectoryImportBatch.filter({ snapshot_id: snapshot.id }, "-created_date", 100).catch(() => []);
  return response({ success: true, snapshot, rows, batches, pagination: { skip, limit, returned: rows.length } });
}
async function getBatchDetail(svc, input) {
  const batch = await svc.entities.DirectoryImportBatch.get(clean3(input.batch_id, 120)).catch(() => null);
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const status = clean3(input.status, 40);
  const query = { batch_id: batch.id };
  if (status) query.status = status;
  const rows = await svc.entities.DirectoryImportRow.filter(query, "row_number", limit).catch(() => []);
  const mutationSummary = await svc.entities.DirectoryImportMutation.filter({ batch_id: batch.id }, "-sequence", 5e3).catch(() => []);
  const summary = mutationSummary.reduce((acc, mutation) => {
    acc.total += 1;
    acc[mutation.rollback_status] = (acc[mutation.rollback_status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, completed: 0, failed: 0, not_required: 0 });
  return response({ success: true, batch, rows, mutation_summary: summary, approval_confirmation: batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows), rollback_confirmation: rollbackApprovalToken(batch.batch_key, batch.applied_rows) });
}
async function handle(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.error) return auth.error;
    const { user, svc } = auth;
    const input = await req.json().catch(() => ({}));
    const action = clean3(input.action, 80);
    if (action === "list_snapshots") return response({ success: true, snapshots: await listSnapshots(svc, input), contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION });
    if (action === "create_snapshot") return createSnapshot(svc, user, input);
    if (action === "append_rows") return appendRows(svc, user, input);
    if (action === "finalize_snapshot") return finalizeSnapshot(svc, user, input);
    if (action === "get_snapshot") return getSnapshotDetail(svc, input);
    if (action === "plan_batch") return planBatch(svc, user, input);
    if (action === "override_row") return overrideRow(svc, user, input);
    if (action === "approve_batch") return approveBatch(svc, user, input);
    if (action === "execute_batch") return executeBatch(svc, user, input);
    if (action === "rollback_batch") return rollbackBatch(svc, user, input);
    if (action === "get_batch") return getBatchDetail(svc, input);
    return response({ error: "Actiune necunoscuta." }, 400);
  } catch (error) {
    return response({ error: error?.message || "Eroare neasteptata in pipeline-ul directorului." }, 500);
  }
}

// base44/functions/directoryOps/directoryImportOpsLocationFirst.ts
var DIRECTORY_IMPORT_RUNTIME_REVISION = "directory-import-runtime-identity-safe-4";
function clean4(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
async function handle2(req) {
  const input = await req.clone().json().catch(() => ({}));
  if (clean4(input.action, 80) === "runtime_info") {
    return Response.json({
      success: true,
      runtime_revision: DIRECTORY_IMPORT_RUNTIME_REVISION,
      classification_contract_version: "viasee-directory-location-first-v1",
      preserves_explicit_location_type: true,
      preserves_explicit_organization_type: true,
      supports_extended_organization_types: true,
      reconciles_directory_organizations: true,
      rejects_address_only_location_match: true,
      rejects_ambiguous_organization_match: true,
      chunked_snapshot_finalization: true,
      chunked_batch_planning: true
    });
  }
  return handle(req);
}

// base44/functions/directoryOps/directoryImportOpsLatest.ts
var DIRECTORY_IMPORT_RUNTIME_REVISION2 = "directory-import-runtime-identity-safe-4";
async function handle3(req) {
  const input = await req.clone().json().catch(() => ({}));
  if (input?.action === "runtime_info") {
    return Response.json({
      success: true,
      runtime_revision: DIRECTORY_IMPORT_RUNTIME_REVISION2,
      classification_contract_version: "viasee-directory-location-first-v1",
      preserves_explicit_location_type: true,
      preserves_explicit_organization_type: true,
      supports_extended_organization_types: true,
      reconciles_directory_organizations: true,
      rejects_address_only_location_match: true,
      rejects_ambiguous_organization_match: true,
      chunked_snapshot_finalization: true,
      chunked_batch_planning: true
    });
  }
  return handle2(req);
}

// scripts/bridge-sources/listProviderMemberInvitations.entry.ts
var ROLES = ["organization_owner", "location_manager", "location_staff"];
var DIRECTORY_IMPORT_LOGICAL_NAME = "directoryImportOps";
var FUNCTION_DEPLOY_REVISION = "viasee-directory-import-single-file-6";
console.info(`[VIASEE] listProviderMemberInvitations ${FUNCTION_DEPLOY_REVISION}`);
function res(body, status = 200) {
  return Response.json(body, { status });
}
function role(value) {
  if (value === "owner") return "organization_owner";
  if (value === "staff") return "location_staff";
  return ROLES.includes(value) ? value : "";
}
function locIds(invitation) {
  return Array.isArray(invitation.invited_location_ids) ? invitation.invited_location_ids.filter(Boolean) : [];
}
function mask(email) {
  const [user, domain] = String(email || "").toLowerCase().split("@");
  return user && domain ? `${user.slice(0, 2)}***@${domain}` : "";
}
function safe(invitation) {
  return {
    id: invitation.id,
    organization_id: invitation.organization_id || null,
    invited_location_ids: locIds(invitation),
    invited_email_masked: mask(invitation.invited_email_normalized),
    proposed_role: invitation.proposed_role,
    invited_by_user_id: invitation.invited_by_user_id || "",
    status: invitation.status,
    expires_at: invitation.expires_at || null,
    accepted_by_user_id: invitation.accepted_by_user_id || "",
    accepted_at: invitation.accepted_at || null,
    revoked_by_user_id: invitation.revoked_by_user_id || "",
    revoked_at: invitation.revoked_at || null,
    created_date: invitation.created_date || null,
    updated_date: invitation.updated_date || null
  };
}
async function access(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter(
    { user_id: userId, status: "active" },
    "-created_date",
    200
  );
  const managerLocationIds = /* @__PURE__ */ new Set();
  for (const membership of memberships) {
    if (["organization_owner", "location_manager"].includes(role(membership.role)) && membership.location_id) {
      managerLocationIds.add(membership.location_id);
    }
  }
  return managerLocationIds;
}
function routedRequest(req, payload) {
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(payload ?? {})
  });
}
async function handleInvitationList(req) {
  try {
    const base44 = createClientFromRequest2(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: "Autentificare necesara" }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const allowedLocationIds = await access(svc, user.id);
    if (allowedLocationIds.size === 0) {
      return res({ error: "Nu ai dreptul sa vezi invitatii" }, 403);
    }
    const validStatuses = ["draft", "pending", "accepted", "expired", "revoked"];
    const statuses = Array.isArray(payload.statuses) ? payload.statuses.filter((status) => validStatuses.includes(status)) : validStatuses.includes(payload.status) ? [payload.status] : ["draft", "pending"];
    const invitations = [];
    for (const status of statuses) {
      const rows = await svc.entities.ProviderMemberInvitation.filter(
        { status },
        "-created_date",
        200
      );
      invitations.push(
        ...rows.filter((invitation) => locIds(invitation).some((id) => allowedLocationIds.has(id))).map(safe)
      );
    }
    return res({ invitations });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
}
Deno.serve(async (req) => {
  const body = await req.clone().json().catch(() => null);
  if (body?.__function === DIRECTORY_IMPORT_LOGICAL_NAME) {
    return handle3(routedRequest(req, body.payload));
  }
  return handleInvitationList(req);
});
