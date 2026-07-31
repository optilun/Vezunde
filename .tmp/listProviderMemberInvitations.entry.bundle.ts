// Bundled single-file Base44 function. Do not add local project imports.

// scripts/bridge-sources/listProviderMemberInvitations.entry.ts
import { createClientFromRequest as createClientFromRequest3 } from "npm:@base44/sdk@0.8.31";

// base44/functions/directoryOps/directoryImportOps.ts
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

// base44/shared/directoryImportPipeline.js
var DIRECTORY_IMPORT_CONTRACT_VERSION = "viasee-directory-import-v1";
var DIRECTORY_CLASSIFICATION_CONTRACT_VERSION = "viasee-directory-location-first-v1";
var DIRECTORY_IMPORT_MAX_CHUNK_SIZE = 100;
var FIELD_ALIASES = {
  location_name: ["location_name", "location_display_name", "name", "location"],
  organization_name: ["organization_name", "organization_display_name", "organization", "brand"],
  locality_name: ["official_locality", "locality_name", "city", "locality"],
  county_name: ["county_name", "county_if_confirmed", "county"],
  county_code: ["county_code"],
  locality_siruta_code: ["locality_siruta_code", "siruta", "siruta_code"],
  uat_code: ["uat_code"],
  uat_name: ["uat_name"],
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
  target_organization_id: ["target_organization_id"],
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
    county_code: fields.county_code,
    locality_siruta_code: fields.locality_siruta_code,
    uat_code: fields.uat_code,
    uat_name: fields.uat_name,
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
    target_organization_id: fields.target_organization_id,
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

// base44/shared/directoryBatchOrganizationPlanning.js
function clean3(value, maxLength = 400) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function directoryBatchOrganizationDescriptor(row = {}) {
  const organizationName = clean3(row.organization_name, 240);
  const organizationExternalKey = clean3(row.organization_external_key, 240);
  const normalizedName = normalizeIdentityText(organizationName);
  const typeResolution = resolveProviderOrganizationType(row);
  const groupKey = organizationExternalKey ? `external:${organizationExternalKey}` : normalizedName ? `name:${normalizedName}` : "";
  if (!groupKey) {
    return {
      valid: false,
      error_code: "organization_identity_not_resolved",
      group_key: "",
      organization_name_normalized: normalizedName,
      organization_external_key: organizationExternalKey,
      organization_type_code: typeResolution.organization_type_code || "",
      organization_type: typeResolution.organization_type || ""
    };
  }
  if (!typeResolution.valid) {
    return {
      valid: false,
      error_code: typeResolution.error_code,
      group_key: groupKey,
      organization_name_normalized: normalizedName,
      organization_external_key: organizationExternalKey,
      organization_type_code: typeResolution.organization_type_code || "",
      organization_type: typeResolution.organization_type || ""
    };
  }
  return {
    valid: true,
    error_code: "",
    group_key: groupKey,
    organization_name_normalized: normalizedName,
    organization_external_key: organizationExternalKey,
    organization_type_code: typeResolution.organization_type_code,
    organization_type: typeResolution.organization_type
  };
}
function validateDirectoryBatchOrganizationCompatibility(current, incoming) {
  if (!current?.valid) return { valid: false, error_code: current?.error_code || "organization_identity_not_resolved" };
  if (!incoming?.valid) return { valid: false, error_code: incoming?.error_code || "organization_identity_not_resolved" };
  if (current.group_key !== incoming.group_key) {
    return { valid: false, error_code: "batch_organization_group_key_conflict" };
  }
  if (current.organization_name_normalized !== incoming.organization_name_normalized) {
    return { valid: false, error_code: "batch_organization_name_conflict" };
  }
  if (current.organization_external_key !== incoming.organization_external_key) {
    return { valid: false, error_code: "batch_organization_external_key_conflict" };
  }
  if (current.organization_type_code !== incoming.organization_type_code || current.organization_type !== incoming.organization_type) {
    return { valid: false, error_code: "batch_organization_type_conflict" };
  }
  return { valid: true, error_code: "" };
}
function validateExplicitDirectoryOrganizationTarget(organization = {}, row = {}) {
  const descriptor = directoryBatchOrganizationDescriptor(row);
  if (!descriptor.valid) return { valid: false, error_code: descriptor.error_code, descriptor };
  const organizationId = clean3(organization.id, 160);
  if (!organizationId) {
    return { valid: false, error_code: "admin_target_organization_not_found", descriptor };
  }
  const existingExternalKey = clean3(organization.directory_external_key, 240);
  if (existingExternalKey && descriptor.organization_external_key && existingExternalKey !== descriptor.organization_external_key) {
    return { valid: false, error_code: "admin_target_organization_external_key_conflict", descriptor };
  }
  const existingLegacyType = clean3(organization.organization_type, 120);
  if (existingLegacyType && existingLegacyType !== descriptor.organization_type) {
    return { valid: false, error_code: "admin_target_organization_legacy_type_conflict", descriptor };
  }
  return {
    valid: true,
    error_code: "",
    descriptor,
    organization_id: organizationId,
    preserves_controlled_organization: true
  };
}

// base44/shared/directoryLocationReconciliation.js
function clean4(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normalizeDirectoryDate(value) {
  const text = clean4(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function directoryConfidenceFor(row = {}) {
  if (row.data_quality_status === "high") return "high";
  if (row.data_quality_status === "medium") return "medium";
  return "low";
}
function comparableValue(key, value, expected) {
  if (expected === null) {
    return value === void 0 || value === null || value === "" ? null : value;
  }
  if (typeof expected === "string" && key.endsWith("_at")) {
    return normalizeDirectoryDate(value);
  }
  if (typeof expected === "string") return clean4(value);
  if (typeof expected === "boolean") return Boolean(value);
  if (typeof expected === "number") return Number(value);
  return value ?? null;
}
function directoryFieldsEqual(current = {}, expected = {}) {
  return Object.entries(expected).every(
    ([key, value]) => comparableValue(key, current?.[key], value) === value
  );
}
function resolveDirectoryLocationUpdatePayload(row = {}) {
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  const values = {
    name: clean4(row.location_name, 240),
    provider_type: clean4(row.provider_type, 120),
    provider_profile_type: clean4(row.provider_profile_type, 120),
    city: clean4(row.locality_name, 160),
    locality_name: clean4(row.locality_name, 160),
    locality_siruta_code: clean4(row.locality_siruta_code, 40),
    county: clean4(row.county_name, 160),
    county_name: clean4(row.county_name, 160),
    address: clean4(row.address, 600),
    active_status: row.operational_status === "active" ? "activa" : "inactiva",
    source_url: clean4(row.source_url, 1200),
    source_name: clean4(
      row.source_name || row.organization_name || row.location_name,
      300
    ),
    source_type: clean4(row.source_type || "official", 120),
    data_confidence: directoryConfidenceFor(row),
    data_source: "public_source",
    migration_review_required: false
  };
  for (const [key, value, maxLength] of [
    ["phone_public", row.phone, 160],
    ["public_email", row.email, 240],
    ["website", row.website, 600],
    ["opening_hours", row.schedule, 1200]
  ]) {
    const normalized = clean4(value, maxLength);
    if (normalized) values[key] = normalized;
  }
  for (const [key, value, maxLength] of [
    ["county_code", row.county_code, 40],
    ["uat_code", row.uat_code, 40],
    ["uat_name", row.uat_name, 160]
  ]) {
    const normalized = clean4(value, maxLength);
    if (normalized) values[key] = normalized;
  }
  if (sourceCheckedAt) {
    values.source_checked_at = sourceCheckedAt;
    values.last_confirmed_at = sourceCheckedAt;
  }
  return values;
}
function resolveDirectoryStateUpdatePayload(row = {}, locationId = "", organizationLinked = false) {
  const values = {
    location_id: clean4(locationId, 160),
    directory_external_key: clean4(row.location_external_key, 240),
    directory_source_version: clean4(row.source_version, 160),
    address_fingerprint: clean4(row.address_fingerprint, 240),
    location_type_code: clean4(row.location_type_code, 120),
    care_setting_code: clean4(row.care_setting_code, 120),
    ownership_type_code: clean4(row.ownership_type_code || "unknown", 120),
    operational_status: clean4(row.operational_status || "unknown", 120),
    data_quality_status: clean4(row.data_quality_status || "low", 120),
    organization_link_status: organizationLinked ? "confirmed" : "unassigned",
    organization_link_confidence: organizationLinked ? directoryConfidenceFor(row) : "low",
    organization_link_review_note: organizationLinked ? "Confirmat prin aprobarea administrativa a lotului de import." : "Fara organizatie confirmata la import."
  };
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  if (sourceCheckedAt) values.source_checked_at = sourceCheckedAt;
  return values;
}
function resolveDirectoryStateCreatePayload(row = {}, locationId = "", organizationLinked = false) {
  return {
    ...resolveDirectoryStateUpdatePayload(row, locationId, organizationLinked),
    publication_status: "draft",
    control_status: "directory",
    directory_detail_level: "summary",
    directory_basic_details_approved: false,
    state_status: "active"
  };
}
function resolveDirectoryLinkPayload(row = {}, locationId = "", organizationId = "") {
  return {
    organization_id: clean4(organizationId, 160),
    location_id: clean4(locationId, 160),
    source_row_key: clean4(row.source_row_key, 240),
    source_version: clean4(row.source_version, 160),
    link_status: "confirmed",
    confidence: directoryConfidenceFor(row),
    evidence_summary: clean4(
      row.evidence_note || "Asociere confirmata prin sursa directorului.",
      2e3
    ),
    link_record_status: "active"
  };
}
function resolveDirectoryEvidencePayload(row = {}, entityType = "ProviderLocation", entityId = "") {
  const values = {
    entity_type: clean4(entityType, 120),
    entity_id: clean4(entityId, 160),
    field_name: "directory_import_snapshot",
    value_snapshot: JSON.stringify({
      source_version: clean4(row.source_version, 160),
      source_row_key: clean4(row.source_row_key, 240)
    }),
    source_url: clean4(row.source_url, 1200),
    source_type: clean4(row.source_type || "official", 120),
    source_title: clean4(
      row.source_name || row.organization_name || row.location_name,
      300
    ),
    confidence: directoryConfidenceFor(row),
    evidence_status: "active",
    notes: clean4(
      [row.evidence_note, row.observations].filter(Boolean).join(" | "),
      2e3
    )
  };
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  if (sourceCheckedAt) values.checked_at = sourceCheckedAt;
  return values;
}
function activeRows(rows, field, activeValue) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row && (!row[field] || row[field] === activeValue));
}
function planDirectoryLocationReconciliation({
  location = {},
  directoryStates = [],
  organizationLinks = [],
  evidenceRows = [],
  row = {},
  organizationId = ""
} = {}) {
  const locationValues = resolveDirectoryLocationUpdatePayload(row);
  const activeStates = activeRows(directoryStates, "state_status", "active");
  const stateValues = resolveDirectoryStateUpdatePayload(
    row,
    location.id,
    Boolean(organizationId)
  );
  const activeLinks = activeRows(
    organizationLinks,
    "link_record_status",
    "active"
  );
  const linkValues = organizationId ? resolveDirectoryLinkPayload(row, location.id, organizationId) : null;
  const matchingLinks = linkValues ? activeLinks.filter((link) => link.organization_id === organizationId) : [];
  const activeEvidence = activeRows(
    evidenceRows,
    "evidence_status",
    "active"
  );
  const evidenceValues = resolveDirectoryEvidencePayload(
    row,
    "ProviderLocation",
    location.id
  );
  const matchingEvidence = activeEvidence.filter(
    (evidence) => directoryFieldsEqual(evidence, evidenceValues)
  );
  const components = {
    location: !directoryFieldsEqual(location, locationValues),
    directory_state: activeStates.length !== 1 || !directoryFieldsEqual(activeStates[0], stateValues),
    organization_link: Boolean(linkValues) && (activeLinks.length !== 1 || matchingLinks.length !== 1 || !directoryFieldsEqual(matchingLinks[0], linkValues)),
    evidence: activeEvidence.length !== 1 || matchingEvidence.length !== 1
  };
  return {
    valid: true,
    error_code: "",
    requires_update: Object.values(components).some(Boolean),
    components,
    location_values: locationValues,
    state_values: stateValues,
    link_values: linkValues,
    evidence_values: evidenceValues
  };
}

// base44/shared/directoryImportReadPolicy.js
function clean5(value, maxLength = 400) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function errorStatus(error) {
  for (const value of [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode
  ]) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}
function directoryReadFailure(resourceName, error) {
  const resource = clean5(resourceName, 160) || "resursa directorului";
  const detail = clean5(error?.message, 300);
  const failure = new Error(
    `Citirea ${resource} a esuat. Importul a fost oprit${detail ? `: ${detail}` : "."}`
  );
  failure.code = "directory_read_failed";
  failure.resource = resource;
  failure.status = errorStatus(error);
  failure.cause = error;
  return failure;
}
async function requireDirectoryRows(readPromise, resourceName = "") {
  try {
    const rows = await readPromise;
    if (!Array.isArray(rows)) {
      throw new TypeError("Raspunsul nu este o lista de inregistrari.");
    }
    return rows;
  } catch (error) {
    if (error?.code === "directory_read_failed") throw error;
    throw directoryReadFailure(resourceName, error);
  }
}
async function getDirectoryEntityOrNull(readPromise, resourceName = "") {
  try {
    return await readPromise;
  } catch (error) {
    if (errorStatus(error) === 404) return null;
    throw directoryReadFailure(resourceName, error);
  }
}
function isDirectoryReadFailure(error) {
  return error?.code === "directory_read_failed";
}
function transientStatus(error) {
  for (const candidate of [
    error,
    error?.cause,
    error?.response,
    error?.response?.data
  ]) {
    const status = errorStatus(candidate);
    if ([408, 425, 429, 502, 503, 504].includes(status)) return status;
  }
  return null;
}
function transientMessage(error) {
  const parts = [];
  const seen = /* @__PURE__ */ new Set();
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    parts.push(clean5(current?.message, 500));
    parts.push(clean5(current?.response?.data?.error, 500));
    current = current?.cause;
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}
function isTransientDirectoryExecutionFailure(error) {
  if (transientStatus(error)) return true;
  return /(rate\s*limit|too\s*many\s*requests|throttl|temporar(?:y|ily)?\s+unavailable|service\s+unavailable|gateway\s+timeout|timed?\s*out)/i.test(
    transientMessage(error)
  );
}

// base44/functions/directoryOps/directoryImportOps.ts
var MAX_ROWS = 5e3;
var EXECUTION_CHUNK = 5;
var FINALIZATION_CHUNK = 50;
var PLANNING_CHUNK = 50;
var LOCK_MINUTES = 5;
var CONTROLLED_PROFILES = /* @__PURE__ */ new Set(["claimed", "verified", "suspended"]);
function clean6(value, maxLength = 4e3) {
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
  const externalKey = clean6(row?.location_external_key, 220);
  if (externalKey) return `external:${externalKey}`;
  const addressFingerprint = clean6(row?.address_fingerprint, 220);
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
  const text = clean6(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function sourceSnapshotKey(sourceVersion, sha256) {
  return `snapshot:${stableTextHash(`${sourceVersion}|${sha256}`)}`;
}
function batchKeyFor(snapshot, sequence) {
  return `DIR-${clean6(snapshot.source_version, 60).replace(/[^a-zA-Z0-9_-]+/g, "-")}-${String(sequence).padStart(3, "0")}`;
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
  const existing = await requireDirectoryRows(
    svc.entities.DirectoryImportMutation.filter(
      { mutation_key: input.mutation_key },
      "-created_date",
      2
    ),
    "mutatiilor existente ale importului"
  );
  if (existing[0]) return existing[0];
  return svc.entities.DirectoryImportMutation.create(input);
}
async function getEntity(svc, entityType, entityId) {
  if (entityType === "ProviderOrganization") {
    return getDirectoryEntityOrNull(
      svc.entities.ProviderOrganization.get(entityId),
      "organizatiei pentru rollback"
    );
  }
  if (entityType === "ProviderLocation") {
    return getDirectoryEntityOrNull(
      svc.entities.ProviderLocation.get(entityId),
      "locatiei pentru rollback"
    );
  }
  if (entityType === "ProviderLocationDirectoryState") {
    return getDirectoryEntityOrNull(
      svc.entities.ProviderLocationDirectoryState.get(entityId),
      "starii de director pentru rollback"
    );
  }
  if (entityType === "DirectoryOrganizationLocationLink") {
    return getDirectoryEntityOrNull(
      svc.entities.DirectoryOrganizationLocationLink.get(entityId),
      "legaturii organizationale pentru rollback"
    );
  }
  if (entityType === "ProviderEvidence") {
    return getDirectoryEntityOrNull(
      svc.entities.ProviderEvidence.get(entityId),
      "dovezii pentru rollback"
    );
  }
  throw new Error(`Entitate nerecunoscuta: ${entityType}`);
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
  const [snapshots, batches] = await Promise.all([
    requireDirectoryRows(
      svc.entities.DirectorySourceSnapshot.list("-created_date", limit),
      "snapshoturilor de import"
    ),
    requireDirectoryRows(
      svc.entities.DirectoryImportBatch.list("-created_date", 500),
      "loturilor de import"
    )
  ]);
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
  const sourceVersion = clean6(input.source_version, 160);
  const sourceSha256 = clean6(input.source_sha256, 80).toLowerCase();
  const sourceName = clean6(input.source_name, 200);
  const sourceFormat = clean6(input.source_format, 30);
  if (!sourceVersion || !sourceName || !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    return response({ error: "Versiunea, numele sursei si SHA-256 valid sunt obligatorii." }, 400);
  }
  if (!["json", "ndjson", "csv", "markdown"].includes(sourceFormat)) {
    return response({ error: "Formatul sursei nu este acceptat." }, 400);
  }
  const existing = await requireDirectoryRows(
    svc.entities.DirectorySourceSnapshot.filter(
      { source_sha256: sourceSha256 },
      "-created_date",
      10
    ),
    "snapshoturilor cu acelasi SHA-256"
  );
  const same = existing.find((item) => item.source_version === sourceVersion && item.status !== "archived");
  if (same) return response({ success: true, reused: true, snapshot: same });
  const snapshot = await svc.entities.DirectorySourceSnapshot.create({
    snapshot_key: sourceSnapshotKey(sourceVersion, sourceSha256),
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    source_name: sourceName,
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat,
    original_filename: clean6(input.original_filename, 240),
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
    notes: clean6(input.notes, 2e3)
  });
  await writeAudit(svc, user, "DirectorySourceSnapshot", snapshot.id, "directory_snapshot_created", {}, {
    source_version: sourceVersion,
    source_sha256: sourceSha256,
    source_format: sourceFormat
  });
  return response({ success: true, reused: false, snapshot });
}
async function appendRows(svc, user, input) {
  const snapshot = await getDirectoryEntityOrNull(
    svc.entities.DirectorySourceSnapshot.get(clean6(input.snapshot_id, 120)),
    "snapshotului pentru incarcarea randurilor"
  );
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
    const sourceRowKey = clean6(sourceRow.__source_row_key || `${snapshot.snapshot_key}:${rowNumber}`, 220);
    const raw = Object.fromEntries(Object.entries(sourceRow).filter(([key]) => !key.startsWith("__")));
    const rawPayload = stableStringify(raw);
    const rowHash = stableTextHash(rawPayload);
    const idempotencyKey = rowIdempotencyKey(snapshot.snapshot_key, sourceRowKey, rowHash);
    const existing = await requireDirectoryRows(
      svc.entities.DirectoryImportRow.filter(
        {
          snapshot_id: snapshot.id,
          idempotency_key: idempotencyKey
        },
        "-created_date",
        2
      ),
      "randurilor existente din snapshot"
    );
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
  const snapshot = await getDirectoryEntityOrNull(
    svc.entities.DirectorySourceSnapshot.get(clean6(input.snapshot_id, 120)),
    "snapshotului pentru validare"
  );
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
  const rows = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      { snapshot_id: snapshot.id },
      "row_number",
      MAX_ROWS
    ),
    "randurilor snapshotului pentru validare"
  );
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
function organizationCreatePayload(row) {
  const canonical = resolveDirectoryOrganizationCanonicalPayload(row);
  if (!canonical.valid) {
    throw new Error(`Tipul organizatiei nu poate fi rezolvat: ${canonical.error_code}.`);
  }
  return {
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
}
function locationCreatePayload(row, organizationId = null) {
  const canonical = resolveDirectoryLocationUpdatePayload(row);
  return {
    organization_id: organizationId || null,
    ...canonical,
    request_intake_status: "inactive",
    public_visibility_status: "draft",
    status: "draft",
    profile_control_status: "directory",
    claim_verification_status: "none",
    verification_state: "unclaimed",
    is_verified: false,
    last_confirmed_at: canonical.last_confirmed_at || now()
  };
}
async function loadPlanningContext(svc) {
  const [organizations, locations, states, links, evidenceRows] = await Promise.all([
    requireDirectoryRows(
      svc.entities.ProviderOrganization.list("name", MAX_ROWS),
      "organizatiilor existente pentru dry-run"
    ),
    requireDirectoryRows(
      svc.entities.ProviderLocation.list("name", MAX_ROWS),
      "locatiilor existente pentru dry-run"
    ),
    requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter(
        { state_status: "active" },
        "-created_date",
        MAX_ROWS
      ),
      "starilor active de director pentru dry-run"
    ),
    requireDirectoryRows(
      svc.entities.DirectoryOrganizationLocationLink.filter(
        { link_record_status: "active" },
        "-created_date",
        MAX_ROWS
      ),
      "legaturilor organizationale active pentru dry-run"
    ),
    requireDirectoryRows(
      svc.entities.ProviderEvidence.filter(
        {
          field_name: "directory_import_snapshot",
          evidence_status: "active"
        },
        "-created_date",
        MAX_ROWS
      ),
      "dovezilor active pentru dry-run"
    )
  ]);
  const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]));
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
  const statesByLocationId = /* @__PURE__ */ new Map();
  for (const state of states) {
    append(statesByExternalKey, state.directory_external_key, state);
    append(statesByAddress, state.address_fingerprint, state);
    append(statesByLocationId, state.location_id, state);
  }
  const linksByLocationId = /* @__PURE__ */ new Map();
  for (const link of links) append(linksByLocationId, link.location_id, link);
  const evidenceByLocationId = /* @__PURE__ */ new Map();
  for (const evidence of evidenceRows) {
    append(evidenceByLocationId, evidence.entity_id, evidence);
  }
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const locationsByFallback = /* @__PURE__ */ new Map();
  for (const location of locations) {
    const key = [normalizeIdentityText(location.locality_name || location.city), normalizeIdentityText(location.address), normalizeIdentityText(location.public_display_name || location.name)].join("|");
    if (key.replace(/\|/g, "")) append(locationsByFallback, key, location);
  }
  return {
    organizationsById,
    organizationsByExternalKey,
    organizationsByName,
    statesByExternalKey,
    statesByAddress,
    statesByLocationId,
    linksByLocationId,
    evidenceByLocationId,
    locationsById,
    locationsByFallback
  };
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
    const organizationTypeCode = clean6(override.organization_type_code, 120);
    merged.organization_type_code = organizationTypeCode;
    merged.organization_type_source = "admin_override";
    merged.organization_type_invalid = Boolean(organizationTypeCode) && !isDirectoryOrganizationTypeCode(organizationTypeCode);
    merged.organization_type_legacy_fallback = false;
  }
  if (Object.prototype.hasOwnProperty.call(override, "target_organization_id")) {
    merged.target_organization_id = clean6(override.target_organization_id, 160);
  }
  return merged;
}
async function planBatch(svc, user, input) {
  const snapshot = await getDirectoryEntityOrNull(
    svc.entities.DirectorySourceSnapshot.get(clean6(input.snapshot_id, 120)),
    "snapshotului pentru dry-run"
  );
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  if (!["ready", "blocked"].includes(snapshot.status) || !snapshot.immutable_at) {
    return response({ error: "Finalizeaza snapshotul inainte de dry-run." }, 409);
  }
  const existingBatches = await requireDirectoryRows(
    svc.entities.DirectoryImportBatch.filter(
      { snapshot_id: snapshot.id },
      "-created_date",
      100
    ),
    "loturilor existente pentru snapshot"
  );
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
  const rows = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      { snapshot_id: snapshot.id },
      "row_number",
      MAX_ROWS
    ),
    "randurilor snapshotului pentru dry-run"
  );
  const context = await loadPlanningContext(svc);
  const explicitOrganizationTargetsByGroup = /* @__PURE__ */ new Map();
  const explicitOrganizationTargetConflicts = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const targetOrganizationId = clean6(normalized.target_organization_id, 160);
    if (!targetOrganizationId || !normalized.organization_name) continue;
    const descriptor = directoryBatchOrganizationDescriptor(normalized);
    if (!descriptor.valid) continue;
    const previousTargetId = explicitOrganizationTargetsByGroup.get(descriptor.group_key);
    if (previousTargetId && previousTargetId !== targetOrganizationId) {
      explicitOrganizationTargetConflicts.add(descriptor.group_key);
      continue;
    }
    explicitOrganizationTargetsByGroup.set(descriptor.group_key, targetOrganizationId);
  }
  const plannedOrganizationGroups = /* @__PURE__ */ new Map();
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
  const organizationsPlannedForCreate = /* @__PURE__ */ new Set();
  let plannedOrganizationReuseRows = 0;
  const alreadyPlannedRows = rows.filter((row) => row.batch_id === batch.id);
  for (const row of alreadyPlannedRows) {
    const action = clean6(row.planned_action, 80);
    if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action] += 1;
    if (row.status === "ready") readyRows += 1;
    else blockedRows += 1;
    const normalized = applyAdminOverride(safeJson(row.normalized_payload_json, {}), row);
    const organizationDescriptor = normalized.organization_name ? directoryBatchOrganizationDescriptor(normalized) : null;
    const plannedActions = asArray(safeJson(row.planned_actions_json, []));
    if (organizationDescriptor?.valid) {
      const targetOrganizationId = clean6(row.target_organization_id, 160);
      if (targetOrganizationId) {
        plannedOrganizationGroups.set(organizationDescriptor.group_key, {
          descriptor: organizationDescriptor,
          target_organization_id: targetOrganizationId,
          planned_new: false
        });
      } else if (action === "create_organization_and_location") {
        plannedOrganizationGroups.set(organizationDescriptor.group_key, {
          descriptor: organizationDescriptor,
          target_organization_id: "",
          planned_new: true
        });
        organizationsPlannedForCreate.add(organizationDescriptor.group_key);
      }
      if (plannedActions.includes("reuse_planned_organization")) {
        plannedOrganizationReuseRows += 1;
      }
    }
    const validation = validateNormalizedDirectoryRow(normalized, { require_siruta: true });
    const organizationTypeResolution = normalized.organization_name ? resolveProviderOrganizationType(normalized) : null;
    if (validation.valid && normalized.provider_type && normalized.provider_profile_type && normalized.location_type_code && normalized.care_setting_code && (!organizationTypeResolution || organizationTypeResolution.valid)) {
      validRows += 1;
    }
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
    let locationReconciliation = null;
    let organizationMatchError = "";
    let locationMatchError = "";
    let usesExplicitOrganizationTarget = false;
    let reusesPlannedOrganization = false;
    const organizationDescriptor = normalized.organization_name ? directoryBatchOrganizationDescriptor(normalized) : null;
    let organizationGroup = organizationDescriptor?.valid ? plannedOrganizationGroups.get(organizationDescriptor.group_key) || null : null;
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
      const organizationGroupKey = organizationDescriptor?.group_key || "";
      const explicitTargetConflict = organizationGroupKey && explicitOrganizationTargetConflicts.has(organizationGroupKey);
      const explicitTargetOrganizationId = organizationGroupKey ? clean6(explicitOrganizationTargetsByGroup.get(organizationGroupKey), 160) : "";
      if (explicitTargetConflict) {
        organizationMatchError = "admin_target_organization_group_conflict";
      } else if (explicitTargetOrganizationId) {
        targetOrganization = context.organizationsById.get(explicitTargetOrganizationId) || null;
        if (!targetOrganization) {
          organizationMatchError = "admin_target_organization_not_found";
        } else {
          const explicitTargetValidation = validateExplicitDirectoryOrganizationTarget(
            targetOrganization,
            normalized
          );
          if (!explicitTargetValidation.valid) {
            organizationMatchError = explicitTargetValidation.error_code;
          } else {
            usesExplicitOrganizationTarget = true;
            candidates.push({
              entity_type: "ProviderOrganization",
              id: targetOrganization.id,
              strategy: "admin_target_organization_id",
              confidence: "high"
            });
          }
        }
      } else {
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
      }
      if (!organizationMatchError && organizationGroup) {
        const compatibility = validateDirectoryBatchOrganizationCompatibility(
          organizationGroup.descriptor,
          organizationDescriptor
        );
        if (!compatibility.valid) {
          organizationMatchError = compatibility.error_code;
        } else if (targetOrganization && organizationGroup.target_organization_id && organizationGroup.target_organization_id !== targetOrganization.id) {
          organizationMatchError = "batch_organization_target_conflict";
        } else if (!targetOrganization && organizationGroup.target_organization_id) {
          targetOrganization = context.organizationsById.get(
            organizationGroup.target_organization_id
          ) || null;
          if (!targetOrganization) {
            organizationMatchError = "batch_target_organization_not_found";
          } else {
            candidates.push({
              entity_type: "ProviderOrganization",
              id: targetOrganization.id,
              strategy: "batch_organization_group",
              confidence: "high"
            });
          }
        } else if (!targetOrganization && organizationGroup.planned_new) {
          reusesPlannedOrganization = true;
          candidates.push({
            entity_type: "ProviderOrganizationBatchPlan",
            id: organizationDescriptor.group_key,
            strategy: "batch_organization_group",
            confidence: "high"
          });
        }
      }
      if (organizationMatchError) {
        validation.errors.push(organizationMatchError);
        validation.validation_codes.push(organizationMatchError);
      }
      if (targetOrganization && !usesExplicitOrganizationTarget) {
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
        locationReconciliation = planDirectoryLocationReconciliation({
          location: targetLocation,
          directoryStates: context.statesByLocationId.get(targetLocation.id) || [],
          organizationLinks: context.linksByLocationId.get(targetLocation.id) || [],
          evidenceRows: context.evidenceByLocationId.get(targetLocation.id) || [],
          row: normalized,
          organizationId: targetOrganization?.id || ""
        });
        if (!locationReconciliation.requires_update && (!targetOrganization || targetLocation.organization_id === targetOrganization.id)) plannedAction = "skip_unchanged";
        else if (targetOrganization && targetLocation.organization_id !== targetOrganization.id) plannedAction = "link_existing_location";
        else plannedAction = "update_existing_location";
      } else if (targetOrganization || reusesPlannedOrganization) {
        plannedAction = "create_location_use_existing_organization";
      } else if (normalized.organization_name) {
        plannedAction = "create_organization_and_location";
      } else {
        plannedAction = "create_location_without_organization";
      }
    }
    const rowReady = !["block_conflict", "reject_invalid"].includes(plannedAction);
    if (rowReady && usesExplicitOrganizationTarget) {
      supplementalActions.push("use_admin_target_organization");
    }
    if (rowReady && reusesPlannedOrganization) {
      supplementalActions.push("reuse_planned_organization");
      plannedOrganizationReuseRows += 1;
    }
    if (rowReady && organizationDescriptor?.valid && !organizationGroup) {
      organizationGroup = {
        descriptor: organizationDescriptor,
        target_organization_id: targetOrganization?.id || "",
        planned_new: !targetOrganization
      };
      plannedOrganizationGroups.set(organizationDescriptor.group_key, organizationGroup);
      if (!targetOrganization) {
        organizationsPlannedForCreate.add(organizationDescriptor.group_key);
      }
    }
    if (rowReady && organizationReconciliation?.requires_update) {
      supplementalActions.push("update_directory_organization");
      organizationsPlannedForUpdate.add(targetOrganization.id);
    }
    if (rowReady && locationReconciliation?.components) {
      for (const [component, requiresUpdate] of Object.entries(
        locationReconciliation.components
      )) {
        if (requiresUpdate) supplementalActions.push(`reconcile_${component}`);
      }
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
    organization_update_ids: [...organizationsPlannedForUpdate].sort(),
    planned_new_organization_keys: [...organizationsPlannedForCreate].sort(),
    planned_new_organization_count: organizationsPlannedForCreate.size,
    planned_organization_reuse_rows: plannedOrganizationReuseRows
  };
  const summary = {
    contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION,
    action_counts: counts,
    supplemental_action_counts: {
      update_directory_organization: organizationsPlannedForUpdate.size,
      create_directory_organization: organizationsPlannedForCreate.size,
      reuse_planned_organization: plannedOrganizationReuseRows
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
  const row = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportRow.get(clean6(input.row_id, 120)),
    "randului pentru corectie"
  );
  if (!row) return response({ error: "Randul nu a fost gasit." }, 404);
  if (["applied", "rolled_back"].includes(row.status)) return response({ error: "Randul executat nu mai poate fi modificat." }, 409);
  const allowedKeys = [
    "organization_name",
    "organization_external_key",
    "target_organization_id",
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
    const batch = await getDirectoryEntityOrNull(
      svc.entities.DirectoryImportBatch.get(row.batch_id),
      "lotului asociat randului corectat"
    );
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
  await writeAudit(svc, user, "DirectoryImportRow", row.id, "directory_import_row_overridden", previous, override, clean6(input.note, 1200));
  return response({ success: true, row_id: row.id });
}
async function approveBatch(svc, user, input) {
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(clean6(input.batch_id, 120)),
    "lotului pentru aprobare"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (batch.status !== "ready") return response({ error: "Lotul nu este pregatit pentru aprobare." }, 409);
  const expected = batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows);
  if (clean6(input.confirmation, 240) !== expected) {
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
async function ensureOrganization(svc, user, batch, rowRecord, row, allowDirectoryOrganizationUpdate = false, preserveExplicitOrganizationTarget = false, requireExistingPlannedOrganization = false) {
  if (!row.organization_name) return { organization: null, created: false, updated: false };
  let target = null;
  if (rowRecord.target_organization_id) {
    target = await getDirectoryEntityOrNull(
      svc.entities.ProviderOrganization.get(rowRecord.target_organization_id),
      "organizatiei planificate pentru executie"
    );
  }
  if (!target) {
    const existing = row.organization_external_key ? await requireDirectoryRows(
      svc.entities.ProviderOrganization.filter(
        { directory_external_key: row.organization_external_key },
        "-created_date",
        5
      ),
      "organizatiilor cu aceeasi cheie externa"
    ) : [];
    if (existing.length > 1) {
      throw new Error("Mai multe organizatii folosesc aceeasi cheie externa; executia este blocata pentru verificare manuala.");
    }
    target = existing[0] || null;
  }
  if (target) {
    if (preserveExplicitOrganizationTarget) {
      const explicitTargetValidation = validateExplicitDirectoryOrganizationTarget(target, row);
      if (!explicitTargetValidation.valid) {
        throw new Error(`Maparea administrativa a organizatiei nu mai este valida: ${explicitTargetValidation.error_code}.`);
      }
      return { organization: target, created: false, updated: false };
    }
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
  if (requireExistingPlannedOrganization) {
    throw new Error("Organizatia planificata anterior nu a fost creata; executia randului a fost oprita pentru a preveni o dublura.");
  }
  const values = organizationCreatePayload(row);
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
async function ensureEvidence(svc, user, batch, rowRecord, row, entityType, entityId, sequence) {
  if (!row.source_url) {
    return { id: null, created: false, superseded: 0 };
  }
  const expected = resolveDirectoryEvidencePayload(row, entityType, entityId);
  const active = await requireDirectoryRows(
    svc.entities.ProviderEvidence.filter(
      {
        entity_type: entityType,
        entity_id: entityId,
        field_name: "directory_import_snapshot",
        evidence_status: "active"
      },
      "-created_date",
      20
    ),
    "dovezilor active ale locatiei"
  );
  const retained = active.find((item) => directoryFieldsEqual(item, expected)) || null;
  const stale = active.filter((item) => item.id !== retained?.id);
  for (const [index, existing] of stale.entries()) {
    const before = { evidence_status: existing.evidence_status };
    const after = { evidence_status: "superseded" };
    await svc.entities.ProviderEvidence.update(existing.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderEvidence:${existing.id}:update`,
      entity_type: "ProviderEvidence",
      entity_id: existing.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: "pending",
      applied_at: now()
    });
    await writeAudit(
      svc,
      user,
      "ProviderEvidence",
      existing.id,
      "directory_import_evidence_superseded",
      before,
      after,
      `Lot ${batch.batch_key}`
    );
  }
  if (retained) {
    return { id: retained.id, created: false, superseded: stale.length };
  }
  const values = {
    ...expected,
    collected_at: now(),
    collected_by: user.id
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
  return { id: evidence.id, created: true, superseded: stale.length };
}
async function ensureDirectoryState(svc, user, batch, rowRecord, row, location, organizationLinked, sequence) {
  const active = await requireDirectoryRows(
    svc.entities.ProviderLocationDirectoryState.filter(
      {
        location_id: location.id,
        state_status: "active"
      },
      "-created_date",
      20
    ),
    "starilor active ale locatiei"
  );
  const current = active[0] || null;
  const duplicates = active.slice(1);
  const expected = resolveDirectoryStateUpdatePayload(
    row,
    location.id,
    organizationLinked
  );
  let stateId = current?.id || null;
  let created = false;
  let updated = false;
  if (current && !directoryFieldsEqual(current, expected)) {
    const values = { ...expected, normalized_at: now() };
    const before = pickFields(current, Object.keys(values));
    await svc.entities.ProviderLocationDirectoryState.update(current.id, values);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${current.id}:update`,
      entity_type: "ProviderLocationDirectoryState",
      entity_id: current.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(values),
      rollback_status: "pending",
      applied_at: now()
    });
    await writeAudit(
      svc,
      user,
      "ProviderLocationDirectoryState",
      current.id,
      "directory_import_state_updated",
      before,
      values,
      `Lot ${batch.batch_key}`
    );
    updated = true;
  } else if (!current) {
    const values = {
      ...resolveDirectoryStateCreatePayload(
        row,
        location.id,
        organizationLinked
      ),
      normalized_at: now()
    };
    const state = await svc.entities.ProviderLocationDirectoryState.create(values);
    stateId = state.id;
    created = true;
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
    await writeAudit(
      svc,
      user,
      "ProviderLocationDirectoryState",
      state.id,
      "directory_import_state_created",
      {},
      values,
      `Lot ${batch.batch_key}`
    );
  }
  for (const [index, duplicate] of duplicates.entries()) {
    const before = { state_status: duplicate.state_status };
    const after = { state_status: "superseded" };
    await svc.entities.ProviderLocationDirectoryState.update(duplicate.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
      mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${duplicate.id}:update`,
      entity_type: "ProviderLocationDirectoryState",
      entity_id: duplicate.id,
      operation: "update",
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
      rollback_status: "pending",
      applied_at: now()
    });
    updated = true;
  }
  return {
    id: stateId,
    created,
    updated,
    superseded: duplicates.length
  };
}
async function ensureOrganizationLink(svc, user, batch, rowRecord, row, locationId, organizationId, sequence) {
  if (!organizationId) {
    return { id: null, created: false, updated: false, superseded: 0 };
  }
  const active = await requireDirectoryRows(
    svc.entities.DirectoryOrganizationLocationLink.filter(
      {
        location_id: locationId,
        link_record_status: "active"
      },
      "-created_date",
      20
    ),
    "legaturilor organizationale active ale locatiei"
  );
  const matching = active.filter(
    (item) => item.organization_id === organizationId
  );
  const current = matching[0] || null;
  const stale = active.filter((item) => item.id !== current?.id);
  for (const [index, existing] of stale.entries()) {
    const before = { link_record_status: existing.link_record_status };
    const after = { link_record_status: "superseded" };
    await svc.entities.DirectoryOrganizationLocationLink.update(existing.id, after);
    await createMutation(svc, {
      batch_id: batch.id,
      row_id: rowRecord.id,
      sequence: sequence - 0.5 + index / 100,
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
  const expected = resolveDirectoryLinkPayload(
    row,
    locationId,
    organizationId
  );
  if (current) {
    let updated = stale.length > 0;
    if (!directoryFieldsEqual(current, expected)) {
      const values2 = {
        ...expected,
        review_note: `Confirmata la aprobarea lotului de import ${batch.batch_key}.`,
        reviewed_by_user_id: user.id,
        reviewed_at: now()
      };
      const before = pickFields(current, Object.keys(values2));
      await svc.entities.DirectoryOrganizationLocationLink.update(current.id, values2);
      await createMutation(svc, {
        batch_id: batch.id,
        row_id: rowRecord.id,
        sequence,
        mutation_key: `${batch.id}:${rowRecord.id}:DirectoryOrganizationLocationLink:${current.id}:update`,
        entity_type: "DirectoryOrganizationLocationLink",
        entity_id: current.id,
        operation: "update",
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(values2),
        rollback_status: "pending",
        applied_at: now()
      });
      await writeAudit(
        svc,
        user,
        "DirectoryOrganizationLocationLink",
        current.id,
        "directory_import_organization_link_updated",
        before,
        values2,
        `Lot ${batch.batch_key}`
      );
      updated = true;
    }
    return {
      id: current.id,
      created: false,
      updated,
      superseded: stale.length
    };
  }
  const values = {
    ...expected,
    review_note: `Confirmata la aprobarea lotului de import ${batch.batch_key}.`,
    reviewed_by_user_id: user.id,
    reviewed_at: now()
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
  await writeAudit(
    svc,
    user,
    "DirectoryOrganizationLocationLink",
    link.id,
    "directory_import_organization_link_created",
    {},
    values,
    `Lot ${batch.batch_key}`
  );
  return {
    id: link.id,
    created: true,
    updated: stale.length > 0,
    superseded: stale.length
  };
}
async function loadLocationReconciliationArtifacts(svc, locationId) {
  const [directoryStates, organizationLinks, evidenceRows] = await Promise.all([
    requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter(
        {
          location_id: locationId,
          state_status: "active"
        },
        "-created_date",
        20
      ),
      "starilor locatiei pentru reconciliere"
    ),
    requireDirectoryRows(
      svc.entities.DirectoryOrganizationLocationLink.filter(
        {
          location_id: locationId,
          link_record_status: "active"
        },
        "-created_date",
        20
      ),
      "legaturilor locatiei pentru reconciliere"
    ),
    requireDirectoryRows(
      svc.entities.ProviderEvidence.filter(
        {
          entity_type: "ProviderLocation",
          entity_id: locationId,
          field_name: "directory_import_snapshot",
          evidence_status: "active"
        },
        "-created_date",
        20
      ),
      "dovezilor locatiei pentru reconciliere"
    )
  ]);
  return { directoryStates, organizationLinks, evidenceRows };
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
    created_directory_state: false,
    updated_directory_state: false,
    superseded_directory_states: 0,
    created_link: false,
    updated_link: false,
    superseded_links: 0,
    created_evidence: false,
    superseded_evidence: 0
  };
  if (rowRecord.planned_action === "skip_duplicate") {
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
      updatesDirectoryOrganization,
      Array.isArray(plannedActions) && plannedActions.includes("use_admin_target_organization"),
      Array.isArray(plannedActions) && plannedActions.includes("reuse_planned_organization")
    );
    organization = organizationResult.organization;
    result.created_organization = organizationResult.created;
    result.updated_organization = organizationResult.updated;
  }
  let location = rowRecord.target_location_id ? await getDirectoryEntityOrNull(
    svc.entities.ProviderLocation.get(rowRecord.target_location_id),
    "locatiei planificate pentru executie"
  ) : null;
  if (location && CONTROLLED_PROFILES.has(location.profile_control_status || "directory")) throw new Error("Profilul este controlat si necesita actualizare manuala.");
  if (rowRecord.planned_action === "skip_unchanged") {
    if (!location) {
      throw new Error("Locatia existenta nu mai poate fi gasita; regenereaza dry-run-ul.");
    }
    const artifacts = await loadLocationReconciliationArtifacts(svc, location.id);
    const currentPlan = planDirectoryLocationReconciliation({
      location,
      ...artifacts,
      row,
      organizationId: organization?.id || ""
    });
    if (currentPlan.requires_update || organization?.id && location.organization_id !== organization.id) {
      throw new Error("Locatia s-a schimbat dupa dry-run; regenereaza planul inainte de executie.");
    }
    result.organization_id = organization?.id || null;
    result.location_id = location.id;
    const status2 = result.created_organization || result.updated_organization ? "applied" : "skipped";
    await svc.entities.DirectoryImportRow.update(rowRecord.id, {
      status: status2,
      result_json: JSON.stringify(result),
      applied_at: now(),
      rollback_status: status2 === "applied" ? "pending" : "not_required",
      error_message: ""
    });
    return { status: status2, result };
  }
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
    const updates = resolveDirectoryLocationUpdatePayload(row);
    if (organization?.id) updates.organization_id = organization.id;
    if (!directoryFieldsEqual(location, updates)) {
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
      location = { ...location, ...updates };
    }
  }
  const stateResult = await ensureDirectoryState(
    svc,
    user,
    batch,
    rowRecord,
    row,
    location,
    Boolean(organization?.id),
    Number(batch.applied_rows || 0) * 10 + 4
  );
  result.created_directory_state = stateResult.created;
  result.updated_directory_state = stateResult.updated;
  result.superseded_directory_states = stateResult.superseded;
  if (organization?.id) {
    const linkResult = await ensureOrganizationLink(
      svc,
      user,
      batch,
      rowRecord,
      row,
      location.id,
      organization.id,
      Number(batch.applied_rows || 0) * 10 + 6
    );
    result.created_link = linkResult.created;
    result.updated_link = linkResult.updated;
    result.superseded_links = linkResult.superseded;
  }
  const evidenceResult = await ensureEvidence(
    svc,
    user,
    batch,
    rowRecord,
    row,
    "ProviderLocation",
    location.id,
    Number(batch.applied_rows || 0) * 10 + 8
  );
  result.created_evidence = evidenceResult.created;
  result.superseded_evidence = evidenceResult.superseded;
  result.organization_id = organization?.id || null;
  result.location_id = location.id;
  const status = [
    result.created_organization,
    result.updated_organization,
    result.created_location,
    result.updated_location,
    result.created_directory_state,
    result.updated_directory_state,
    result.created_link,
    result.updated_link,
    result.created_evidence,
    result.superseded_evidence > 0
  ].some(Boolean) ? "applied" : "skipped";
  await svc.entities.DirectoryImportRow.update(rowRecord.id, {
    status,
    target_organization_id: organization?.id || "",
    target_location_id: location.id,
    result_json: JSON.stringify(result),
    applied_at: now(),
    rollback_status: status === "applied" ? "pending" : "not_required",
    error_message: ""
  });
  return { status, result };
}
function directoryPublicationQuality(row = {}) {
  const researchStatus = clean6(row.research_status, 80);
  const hasReviewFlags = Boolean(clean6(row.review_flags, 2e3));
  if (researchStatus === "official_confirmed" && !hasReviewFlags) return "high";
  if (["official_confirmed", "official_partial"].includes(researchStatus)) return "medium";
  return "low";
}
async function publishCompletedBatchAsBasicDirectory(svc, user, input = {}) {
  const batchId = clean6(input.batch_id, 160);
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(batchId),
    "lotului finalizat pentru publicarea directorului"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (batch.status !== "completed") return response({ error: `Lotul nu este finalizat (${batch.status}).` }, 409);
  const rows = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter({ batch_id: batch.id }, "row_number", 200),
    "randurilor finalizate pentru publicarea directorului"
  );
  let publishedLocations = 0;
  let publishedStates = 0;
  let skippedControlled = 0;
  for (const rowRecord of rows) {
    if (!["applied", "skipped"].includes(rowRecord.status)) continue;
    const result = safeJson(rowRecord.result_json, {});
    const locationId = clean6(rowRecord.target_location_id || result.location_id, 160);
    if (!locationId) continue;
    const location = await getDirectoryEntityOrNull(
      svc.entities.ProviderLocation.get(locationId),
      "locatiei pentru publicarea directorului"
    );
    if (!location) continue;
    if (CONTROLLED_PROFILES.has(location.profile_control_status || "directory")) {
      skippedControlled += 1;
      continue;
    }
    const row = applyAdminOverride(safeJson(rowRecord.normalized_payload_json, {}), rowRecord);
    const quality = directoryPublicationQuality(row);
    const basicApproved = ["high", "medium"].includes(quality) && Boolean(clean6(row.address, 600)) && Boolean(clean6(row.source_url, 1200)) && row.operational_status === "active";
    const locationValues = {
      public_visibility_status: "approved",
      status: "publicata",
      profile_control_status: "directory",
      claim_verification_status: "none",
      verification_state: "unclaimed",
      is_verified: false,
      request_intake_status: "inactive",
      migration_review_required: quality === "low" || Boolean(clean6(row.review_flags, 2e3)),
      profile_control_status_reason: "Profil de director neconfirmat publicat automat din sursa publica."
    };
    if (!directoryFieldsEqual(location, locationValues)) {
      const values = { ...locationValues, profile_control_status_updated_at: now() };
      const before = pickFields(location, Object.keys(values));
      await svc.entities.ProviderLocation.update(location.id, values);
      await createMutation(svc, {
        batch_id: batch.id,
        row_id: rowRecord.id,
        sequence: 1e5 + Number(rowRecord.row_number || 0) * 10 + 1,
        mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocation:${location.id}:publish-basic`,
        entity_type: "ProviderLocation",
        entity_id: location.id,
        operation: "update",
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(values),
        rollback_status: "pending",
        applied_at: now()
      });
      await writeAudit(svc, user, "ProviderLocation", location.id, "directory_profile_published_basic", before, values, `Lot ${batch.batch_key}`);
      publishedLocations += 1;
    }
    const activeStates = await requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter({ location_id: location.id, state_status: "active" }, "-created_date", 20),
      "starii locatiei pentru publicarea directorului"
    );
    const stateValues = {
      publication_status: "published",
      control_status: "directory",
      operational_status: "active",
      data_quality_status: quality,
      directory_detail_level: basicApproved ? "basic" : "summary",
      directory_basic_details_approved: basicApproved
    };
    const state = activeStates[0] || null;
    if (state) {
      if (!directoryFieldsEqual(state, stateValues)) {
        const values = { ...stateValues, normalized_at: now() };
        const before = pickFields(state, Object.keys(values));
        await svc.entities.ProviderLocationDirectoryState.update(state.id, values);
        await createMutation(svc, {
          batch_id: batch.id,
          row_id: rowRecord.id,
          sequence: 1e5 + Number(rowRecord.row_number || 0) * 10 + 2,
          mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${state.id}:publish-basic`,
          entity_type: "ProviderLocationDirectoryState",
          entity_id: state.id,
          operation: "update",
          before_json: JSON.stringify(before),
          after_json: JSON.stringify(values),
          rollback_status: "pending",
          applied_at: now()
        });
        await writeAudit(svc, user, "ProviderLocationDirectoryState", state.id, "directory_state_published_basic", before, values, `Lot ${batch.batch_key}`);
        publishedStates += 1;
      }
    } else {
      const values = {
        ...resolveDirectoryStateCreatePayload(row, location.id, Boolean(location.organization_id)),
        ...stateValues,
        normalized_at: now(),
        state_status: "active"
      };
      const createdState = await svc.entities.ProviderLocationDirectoryState.create(values);
      await createMutation(svc, {
        batch_id: batch.id,
        row_id: rowRecord.id,
        sequence: 1e5 + Number(rowRecord.row_number || 0) * 10 + 2,
        mutation_key: `${batch.id}:${rowRecord.id}:ProviderLocationDirectoryState:${createdState.id}:publish-basic-create`,
        entity_type: "ProviderLocationDirectoryState",
        entity_id: createdState.id,
        operation: "create",
        before_json: "{}",
        after_json: JSON.stringify(values),
        rollback_status: "pending",
        applied_at: now()
      });
      await writeAudit(svc, user, "ProviderLocationDirectoryState", createdState.id, "directory_state_published_basic", {}, values, `Lot ${batch.batch_key}`);
      publishedStates += 1;
    }
  }
  return response({
    success: true,
    batch_id: batch.id,
    published_locations: publishedLocations,
    published_states: publishedStates,
    skipped_controlled: skippedControlled
  });
}
async function acquireBatchLock(svc, batch, requestedToken = "") {
  const currentExpiry = batch.execution_lock_expires_at ? new Date(batch.execution_lock_expires_at).getTime() : 0;
  const currentToken = clean6(batch.execution_lock_token, 200);
  const supplied = clean6(requestedToken, 200);
  if (currentToken && currentExpiry > Date.now() && supplied !== currentToken) return { error: "Lotul este procesat de alta executie." };
  const token = supplied && supplied === currentToken ? supplied : randomToken("import");
  await svc.entities.DirectoryImportBatch.update(batch.id, { execution_lock_token: token, execution_lock_expires_at: lockExpiry() });
  return { token };
}
function executionProgressFromRows(rows, mutations = []) {
  const totals = {
    execution_cursor: 0,
    applied_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    created_organizations: 0,
    created_locations: 0,
    updated_locations: 0,
    created_links: 0
  };
  let updatedOrganizations = 0;
  for (const row of rows) {
    if (row.status === "applied") {
      totals.applied_rows += 1;
      totals.execution_cursor += 1;
    } else if (row.status === "skipped") {
      totals.skipped_rows += 1;
      totals.execution_cursor += 1;
    } else if (row.status === "failed" && !isTransientDirectoryExecutionFailure(new Error(clean6(row.error_message, 1200)))) {
      totals.failed_rows += 1;
      totals.execution_cursor += 1;
    }
  }
  if (mutations.length > 0) {
    const uniqueMutations = /* @__PURE__ */ new Map();
    for (const mutation of mutations) {
      const key = `${mutation.entity_type}:${mutation.entity_id}:${mutation.operation}`;
      if (!uniqueMutations.has(key)) uniqueMutations.set(key, mutation);
    }
    for (const mutation of uniqueMutations.values()) {
      if (mutation.operation === "create" && mutation.entity_type === "ProviderOrganization") totals.created_organizations += 1;
      if (mutation.operation === "create" && mutation.entity_type === "ProviderLocation") totals.created_locations += 1;
      if (mutation.operation === "update" && mutation.entity_type === "ProviderLocation") totals.updated_locations += 1;
      if (mutation.operation === "create" && mutation.entity_type === "DirectoryOrganizationLocationLink") totals.created_links += 1;
      if (mutation.operation === "update" && mutation.entity_type === "ProviderOrganization") updatedOrganizations += 1;
    }
  } else {
    for (const row of rows) {
      if (row.status !== "applied") continue;
      const result = safeJson(row.result_json, {});
      if (result.created_organization) totals.created_organizations += 1;
      if (result.created_location) totals.created_locations += 1;
      if (result.updated_location) totals.updated_locations += 1;
      if (result.created_link) totals.created_links += 1;
      if (result.updated_organization) updatedOrganizations += 1;
    }
  }
  return { totals, updatedOrganizations };
}
function createdDuringBatch(entity, batch) {
  const createdAt = entity?.created_date ? new Date(entity.created_date).getTime() : 0;
  const startedAt = batch?.started_at ? new Date(batch.started_at).getTime() : 0;
  return Boolean(createdAt && startedAt && createdAt >= startedAt - 5e3);
}
function hasCreateMutation(mutations, entityType, entityId) {
  return mutations.some((mutation) => mutation.entity_type === entityType && mutation.entity_id === entityId && mutation.operation === "create");
}
async function recoverCreateMutation(svc, batch, rowRecord, mutations, entityType, entity, expectedValues, sequence) {
  if (!entity || !createdDuringBatch(entity, batch)) return 0;
  if (hasCreateMutation(mutations, entityType, entity.id)) return 0;
  if (!equalFieldSubset(entity, expectedValues)) {
    throw new Error(`Entitatea partiala ${entityType} nu mai corespunde sursei si necesita verificare manuala.`);
  }
  const mutation = await createMutation(svc, {
    batch_id: batch.id,
    row_id: rowRecord.id,
    sequence,
    mutation_key: `${batch.id}:${rowRecord.id}:${entityType}:${entity.id}:create`,
    entity_type: entityType,
    entity_id: entity.id,
    operation: "create",
    before_json: "{}",
    after_json: JSON.stringify(expectedValues),
    rollback_status: "pending",
    applied_at: now()
  });
  mutations.push(mutation);
  return 1;
}
async function repairTransientRowArtifacts(svc, batch, rowRecord, mutations) {
  const row = applyAdminOverride(safeJson(rowRecord.normalized_payload_json, {}), rowRecord);
  let repaired = 0;
  let organization = null;
  if (rowRecord.target_organization_id) {
    organization = await getDirectoryEntityOrNull(
      svc.entities.ProviderOrganization.get(rowRecord.target_organization_id),
      "organizatiei mapate pentru repararea reluarii"
    );
  } else if (row.organization_external_key) {
    const organizations = await requireDirectoryRows(
      svc.entities.ProviderOrganization.filter(
        { directory_external_key: row.organization_external_key },
        "-created_date",
        5
      ),
      "organizatiilor partiale pentru reluare"
    );
    if (organizations.length > 1) {
      throw new Error("Mai multe organizatii partiale folosesc aceeasi cheie externa.");
    }
    organization = organizations[0] || null;
  }
  if (organization && organization.control_status === "directory" && clean6(organization.directory_source_version, 160) === clean6(row.source_version, 160)) {
    repaired += await recoverCreateMutation(
      svc,
      batch,
      rowRecord,
      mutations,
      "ProviderOrganization",
      organization,
      organizationCreatePayload(row),
      Number(batch.applied_rows || 0) * 10 + 1
    );
  }
  const locationCandidates = await requireDirectoryRows(
    svc.entities.ProviderLocation.filter(
      {
        name: row.location_name,
        address: row.address,
        profile_control_status: "directory"
      },
      "-created_date",
      5
    ),
    "locatiilor partiale pentru reluare"
  );
  const recentLocations = locationCandidates.filter((location2) => createdDuringBatch(location2, batch));
  if (recentLocations.length > 1) {
    throw new Error("Mai multe locatii partiale corespund aceluiasi rand.");
  }
  const location = recentLocations[0] || null;
  if (location) {
    const expectedLocation = locationCreatePayload(
      row,
      organization?.id || location.organization_id || null
    );
    repaired += await recoverCreateMutation(
      svc,
      batch,
      rowRecord,
      mutations,
      "ProviderLocation",
      location,
      expectedLocation,
      Number(batch.applied_rows || 0) * 10 + 2
    );
  }
  let state = null;
  if (row.location_external_key) {
    const states = await requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter(
        {
          directory_external_key: row.location_external_key,
          state_status: "active"
        },
        "-created_date",
        5
      ),
      "starilor partiale pentru reluare"
    );
    const matchingStates = states.filter((candidate) => (!location || candidate.location_id === location.id) && clean6(candidate.directory_source_version, 160) === clean6(row.source_version, 160));
    if (matchingStates.length > 1) throw new Error("Mai multe stari partiale corespund aceluiasi rand.");
    state = matchingStates[0] || null;
  }
  if (state && location) {
    repaired += await recoverCreateMutation(
      svc,
      batch,
      rowRecord,
      mutations,
      "ProviderLocationDirectoryState",
      state,
      resolveDirectoryStateCreatePayload(row, location.id, Boolean(organization?.id)),
      Number(batch.applied_rows || 0) * 10 + 4
    );
  }
  let link = null;
  if (location && organization) {
    const links = await requireDirectoryRows(
      svc.entities.DirectoryOrganizationLocationLink.filter(
        {
          source_version: row.source_version,
          source_row_key: row.source_row_key,
          link_record_status: "active"
        },
        "-created_date",
        5
      ),
      "legaturilor partiale pentru reluare"
    );
    const matchingLinks = links.filter((candidate) => candidate.location_id === location.id && candidate.organization_id === organization.id);
    if (matchingLinks.length > 1) throw new Error("Mai multe legaturi partiale corespund aceluiasi rand.");
    link = matchingLinks[0] || null;
  }
  if (link && location && organization) {
    repaired += await recoverCreateMutation(
      svc,
      batch,
      rowRecord,
      mutations,
      "DirectoryOrganizationLocationLink",
      link,
      resolveDirectoryLinkPayload(row, location.id, organization.id),
      Number(batch.applied_rows || 0) * 10 + 6
    );
  }
  if (location && row.source_url) {
    const evidenceRows = await requireDirectoryRows(
      svc.entities.ProviderEvidence.filter(
        {
          entity_type: "ProviderLocation",
          entity_id: location.id,
          field_name: "directory_import_snapshot",
          evidence_status: "active"
        },
        "-created_date",
        20
      ),
      "dovezilor partiale pentru reluare"
    );
    const evidence = evidenceRows.find((candidate) => {
      const snapshot = safeJson(candidate.value_snapshot, {});
      return clean6(snapshot.source_version, 160) === clean6(row.source_version, 160) && clean6(snapshot.source_row_key, 240) === clean6(row.source_row_key, 240);
    }) || null;
    if (evidence) {
      repaired += await recoverCreateMutation(
        svc,
        batch,
        rowRecord,
        mutations,
        "ProviderEvidence",
        evidence,
        resolveDirectoryEvidencePayload(row, "ProviderLocation", location.id),
        Number(batch.applied_rows || 0) * 10 + 8
      );
    }
  }
  return repaired;
}
async function releaseBatchLockAfterTransientFailure(svc, batch, error) {
  try {
    await svc.entities.DirectoryImportBatch.update(batch.id, {
      execution_lock_token: "",
      execution_lock_expires_at: null,
      failure_message: clean6(
        error?.message || "Operatia a fost intrerupta temporar si poate fi reluata.",
        1200
      )
    });
  } catch (_cleanupError) {
  }
}
async function persistBatchInterruption(svc, batch, progress, error) {
  const previousSummary = safeJson(batch.summary_json, {});
  const executionCounts = {
    ...previousSummary.execution_counts || {},
    updated_organizations: Number(previousSummary.execution_counts?.updated_organizations || 0) + Number(progress.updatedOrganizations || 0)
  };
  try {
    await svc.entities.DirectoryImportBatch.update(batch.id, {
      execution_cursor: Number(batch.execution_cursor || 0) + Number(progress.processed || 0),
      applied_rows: Number(batch.applied_rows || 0) + Number(progress.applied || 0),
      skipped_rows: Number(batch.skipped_rows || 0) + Number(progress.skipped || 0),
      failed_rows: Number(batch.failed_rows || 0) + Number(progress.failed || 0),
      created_organizations: Number(batch.created_organizations || 0) + Number(progress.createdOrganizations || 0),
      created_locations: Number(batch.created_locations || 0) + Number(progress.createdLocations || 0),
      updated_locations: Number(batch.updated_locations || 0) + Number(progress.updatedLocations || 0),
      created_links: Number(batch.created_links || 0) + Number(progress.createdLinks || 0),
      summary_json: JSON.stringify({ ...previousSummary, execution_counts: executionCounts }),
      status: "running",
      execution_lock_token: "",
      execution_lock_expires_at: null,
      failure_message: clean6(
        error?.message || "Executia a fost intrerupta temporar. Lotul poate fi reluat.",
        1200
      )
    });
  } catch (_cleanupError) {
  }
}
async function resumeBatchAfterTransientFailure(svc, user, input) {
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(clean6(input.batch_id, 120)),
    "lotului pentru reluare"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (!["approved", "running"].includes(batch.status)) {
    return response({ error: "Lotul nu poate fi reluat din starea curenta." }, 409);
  }
  const rows = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      { batch_id: batch.id },
      "row_number",
      MAX_ROWS
    ),
    "randurilor lotului pentru reluare"
  );
  const retryableRows = rows.filter((row) => row.status === "failed" && isTransientDirectoryExecutionFailure(new Error(clean6(row.error_message, 1200))));
  const mutations = await requireDirectoryRows(
    svc.entities.DirectoryImportMutation.filter(
      { batch_id: batch.id },
      "sequence",
      MAX_ROWS
    ),
    "mutatiilor lotului pentru reluare"
  );
  const limit = boundedChunkSize(input.limit, EXECUTION_CHUNK);
  const rowsToRecover = retryableRows.slice(0, limit);
  const recoveredIds = new Set(rowsToRecover.map((row) => row.id));
  let repairedArtifacts = 0;
  for (const row of rowsToRecover) {
    repairedArtifacts += await repairTransientRowArtifacts(svc, batch, row, mutations);
    await svc.entities.DirectoryImportRow.update(row.id, {
      status: "ready",
      error_message: "",
      result_json: "{}",
      applied_at: null,
      rollback_status: "not_required"
    });
  }
  const reconciledRows = rows.map((row) => recoveredIds.has(row.id) ? { ...row, status: "ready", error_message: "", result_json: "{}", applied_at: null } : row);
  const progress = executionProgressFromRows(reconciledRows, mutations);
  const previousSummary = safeJson(batch.summary_json, {});
  const executionCounts = {
    ...previousSummary.execution_counts || {},
    updated_organizations: progress.updatedOrganizations
  };
  const remainingTransientRows = Math.max(0, retryableRows.length - rowsToRecover.length);
  const failureMessage = remainingTransientRows > 0 ? `${remainingTransientRows} randuri intrerupte temporar mai trebuie pregatite pentru reluare.` : "";
  await svc.entities.DirectoryImportBatch.update(batch.id, {
    ...progress.totals,
    summary_json: JSON.stringify({ ...previousSummary, execution_counts: executionCounts }),
    status: "running",
    execution_lock_token: "",
    execution_lock_expires_at: null,
    failure_message: failureMessage
  });
  await writeAudit(
    svc,
    user,
    "DirectoryImportBatch",
    batch.id,
    "directory_import_batch_transient_rows_recovered",
    { transient_failed_rows: retryableRows.length },
    {
      recovered_rows: rowsToRecover.length,
      repaired_partial_artifacts: repairedArtifacts,
      remaining_transient_rows: remainingTransientRows
    }
  );
  return response({
    success: true,
    batch_id: batch.id,
    recovered: rowsToRecover.length,
    repaired_artifacts: repairedArtifacts,
    remaining: remainingTransientRows > 0,
    totals: { ...progress.totals, updated_organizations: progress.updatedOrganizations }
  });
}
async function executeBatch(svc, user, input) {
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(clean6(input.batch_id, 120)),
    "lotului pentru executie"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (!["approved", "running"].includes(batch.status)) return response({ error: "Lotul nu este aprobat sau nu poate continua." }, 409);
  if (clean6(batch.failure_message, 1200)) {
    return response({
      error: "Lotul are o intrerupere temporara nereconciliata. Pregateste reluarea inainte de executie.",
      retryable: true,
      requires_resume: true
    }, 409);
  }
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);
  if (batch.status === "approved") {
    await svc.entities.DirectoryImportBatch.update(batch.id, { status: "running", started_at: now() });
  }
  const limit = boundedChunkSize(input.limit, EXECUTION_CHUNK);
  const rows = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      { batch_id: batch.id, status: "ready" },
      "row_number",
      limit
    ),
    "randurilor pregatite pentru executie"
  );
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
      if (isDirectoryReadFailure(error) || isTransientDirectoryExecutionFailure(error)) {
        await persistBatchInterruption(svc, batch, {
          processed: applied + skipped + failed,
          applied,
          skipped,
          failed,
          createdOrganizations,
          updatedOrganizations,
          createdLocations,
          updatedLocations,
          createdLinks
        }, error);
        throw error;
      }
      failed += 1;
      await svc.entities.DirectoryImportRow.update(row.id, { status: "failed", error_message: error?.message || "Executia randului a esuat.", result_json: "{}" });
    }
  }
  const remaining = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      { batch_id: batch.id, status: "ready" },
      "row_number",
      2
    ),
    "randurilor ramase dupa executie"
  );
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
    execution_lock_expires_at: completed ? null : lockExpiry(),
    failure_message: ""
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
    requireDirectoryRows(
      svc.entities.ProviderMembership.filter(
        { location_id: entity.id, status: "active" },
        "-created_date",
        2
      ),
      "acceselor active ale locatiei pentru rollback"
    ),
    requireDirectoryRows(
      svc.entities.LocationService.filter(
        { location_id: entity.id },
        "-created_date",
        2
      ),
      "serviciilor locatiei pentru rollback"
    )
  ]);
  return memberships.length === 0 && services.length === 0;
}
async function canDeleteCreatedOrganization(svc, entity) {
  if (!entity || entity.control_status !== "directory") return false;
  const locations = await requireDirectoryRows(
    svc.entities.ProviderLocation.filter(
      { organization_id: entity.id },
      "-created_date",
      2
    ),
    "locatiilor organizatiei pentru rollback"
  );
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
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(clean6(input.batch_id, 120)),
    "lotului pentru rollback"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  if (!["completed", "completed_with_errors", "rollback_failed", "rolling_back"].includes(batch.status)) {
    return response({ error: "Lotul nu poate fi retras in starea curenta." }, 409);
  }
  const expected = rollbackApprovalToken(batch.batch_key, batch.applied_rows);
  if (clean6(input.confirmation, 240) !== expected) return response({ error: "Confirmarea de rollback nu corespunde.", expected_confirmation: expected }, 400);
  const lock = await acquireBatchLock(svc, batch, input.lock_token);
  if (lock.error) return response({ error: lock.error }, 409);
  if (batch.status !== "rolling_back") await svc.entities.DirectoryImportBatch.update(batch.id, { status: "rolling_back", rollback_started_at: now() });
  const limit = Math.max(1, Math.min(EXECUTION_CHUNK * 5, Number(input.limit || EXECUTION_CHUNK * 2)));
  const mutations = await requireDirectoryRows(
    svc.entities.DirectoryImportMutation.filter(
      { batch_id: batch.id, rollback_status: "pending" },
      "-sequence",
      limit
    ),
    "mutatiilor ramase pentru rollback"
  );
  let completed = 0;
  let failed = 0;
  for (const mutation of mutations) {
    try {
      await rollbackMutation(svc, mutation);
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: "completed", rolled_back_at: now(), rollback_error: "" });
      completed += 1;
    } catch (error) {
      if (isDirectoryReadFailure(error) || isTransientDirectoryExecutionFailure(error)) {
        await releaseBatchLockAfterTransientFailure(svc, batch, error);
        throw error;
      }
      failed += 1;
      await svc.entities.DirectoryImportMutation.update(mutation.id, { rollback_status: "failed", rollback_error: error?.message || "Rollback esuat." });
    }
  }
  const [pending, failedMutations] = await Promise.all([
    requireDirectoryRows(
      svc.entities.DirectoryImportMutation.filter(
        { batch_id: batch.id, rollback_status: "pending" },
        "-sequence",
        2
      ),
      "mutatiilor inca neprocesate dupa rollback"
    ),
    requireDirectoryRows(
      svc.entities.DirectoryImportMutation.filter(
        { batch_id: batch.id, rollback_status: "failed" },
        "-sequence",
        2
      ),
      "mutatiilor esuate dupa rollback"
    )
  ]);
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
    const rows = await requireDirectoryRows(
      svc.entities.DirectoryImportRow.filter(
        { batch_id: batch.id, status: "applied" },
        "row_number",
        MAX_ROWS
      ),
      "randurilor aplicate pentru finalizarea rollbackului"
    );
    for (const row of rows) await svc.entities.DirectoryImportRow.update(row.id, { status: "rolled_back", rollback_status: "completed" });
    await svc.entities.DirectorySourceSnapshot.update(batch.snapshot_id, { status: "ready" });
    await writeAudit(svc, user, "DirectoryImportBatch", batch.id, "directory_import_batch_rolled_back", {}, { status: "rolled_back", completed_mutations: completed });
  }
  return response({ success: true, status, lock_token: done ? "" : lock.token, processed: mutations.length, completed, failed, remaining: !done });
}
async function getSnapshotDetail(svc, input) {
  const snapshot = await getDirectoryEntityOrNull(
    svc.entities.DirectorySourceSnapshot.get(clean6(input.snapshot_id, 120)),
    "snapshotului pentru afisare"
  );
  if (!snapshot) return response({ error: "Snapshotul nu a fost gasit." }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const skip = Math.max(0, Number(input.skip || 0));
  const query = { snapshot_id: snapshot.id };
  if (input.status) query.status = clean6(input.status, 40);
  const all = await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter(
      query,
      "row_number",
      Math.min(MAX_ROWS, skip + limit)
    ),
    "randurilor snapshotului pentru afisare"
  );
  const rows = all.slice(skip, skip + limit);
  const batches = await requireDirectoryRows(
    svc.entities.DirectoryImportBatch.filter(
      { snapshot_id: snapshot.id },
      "-created_date",
      100
    ),
    "loturilor snapshotului pentru afisare"
  );
  return response({ success: true, snapshot, rows, batches, pagination: { skip, limit, returned: rows.length } });
}
async function getBatchDetail(svc, input) {
  const batch = await getDirectoryEntityOrNull(
    svc.entities.DirectoryImportBatch.get(clean6(input.batch_id, 120)),
    "lotului pentru afisare"
  );
  if (!batch) return response({ error: "Lotul nu a fost gasit." }, 404);
  const limit = Math.max(1, Math.min(250, Number(input.limit || 100)));
  const status = clean6(input.status, 40);
  const query = { batch_id: batch.id };
  if (status) query.status = status;
  const [rows, mutationSummary] = await Promise.all([
    requireDirectoryRows(
      svc.entities.DirectoryImportRow.filter(query, "row_number", limit),
      "randurilor lotului pentru afisare"
    ),
    requireDirectoryRows(
      svc.entities.DirectoryImportMutation.filter(
        { batch_id: batch.id },
        "-sequence",
        5e3
      ),
      "mutatiilor lotului pentru afisare"
    )
  ]);
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
    const action = clean6(input.action, 80);
    if (action === "list_snapshots") return response({ success: true, snapshots: await listSnapshots(svc, input), contract_version: DIRECTORY_IMPORT_CONTRACT_VERSION });
    if (action === "create_snapshot") return createSnapshot(svc, user, input);
    if (action === "append_rows") return appendRows(svc, user, input);
    if (action === "finalize_snapshot") return finalizeSnapshot(svc, user, input);
    if (action === "get_snapshot") return getSnapshotDetail(svc, input);
    if (action === "plan_batch") return planBatch(svc, user, input);
    if (action === "override_row") return overrideRow(svc, user, input);
    if (action === "approve_batch") return approveBatch(svc, user, input);
    if (action === "resume_batch") return resumeBatchAfterTransientFailure(svc, user, input);
    if (action === "execute_batch") return executeBatch(svc, user, input);
    if (action === "rollback_batch") return rollbackBatch(svc, user, input);
    if (action === "get_batch") return getBatchDetail(svc, input);
    return response({ error: "Actiune necunoscuta." }, 400);
  } catch (error) {
    const retryableFailure = isDirectoryReadFailure(error) || isTransientDirectoryExecutionFailure(error);
    return response({
      error: error?.message || "Eroare neasteptata in pipeline-ul directorului.",
      retryable: retryableFailure
    }, retryableFailure ? 503 : 500);
  }
}

// base44/functions/directoryOps/directoryImportOpsLocationFirst.ts
var DIRECTORY_IMPORT_RUNTIME_REVISION = "directory-import-runtime-read-safe-6";
function clean7(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
async function handle2(req) {
  const input = await req.clone().json().catch(() => ({}));
  if (clean7(input.action, 80) === "runtime_info") {
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
      chunked_batch_planning: true,
      reconciles_existing_location_metadata: true,
      reconciles_directory_state: true,
      reconciles_directory_evidence: true,
      preserves_directory_publication_state: true,
      preserves_existing_optional_fields: true,
      fails_closed_on_directory_read_errors: true
    });
  }
  return handle(req);
}

// base44/functions/directoryOps/directoryAutoImportOps.ts
import { createClientFromRequest as createClientFromRequest2 } from "npm:@base44/sdk@0.8.31";
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";
var DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION = "viasee-directory-auto-import-v2";
var CAMPAIGN_MODE_STRICT = "strict_import";
var CAMPAIGN_MODE_NATIONAL = "national_directory";
var PUBLICATION_MODE_BASIC = "public_basic_directory";
var MAX_BATCHES = 50;
var MAX_ROWS_PER_BATCH = 40;
var EXECUTION_CHUNK2 = 5;
var PAYLOAD_CHUNK_SIZE = 12e3;
var LOCK_MINUTES2 = 4;
var ALLOWED_ACTIONS = /* @__PURE__ */ new Set([
  "create_organization_and_location",
  "create_location_use_existing_organization"
]);
var TERMINAL_ITEM_STATUSES = /* @__PURE__ */ new Set(["completed", "blocked", "failed", "skipped"]);
function clean8(value, maxLength = 4e3) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function now2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function response2(body, status = 200) {
  return Response.json(body, { status });
}
function safeJson2(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}
function asArray2(value) {
  return Array.isArray(value) ? value : [];
}
function campaignMode(value) {
  return clean8(value, 80) === CAMPAIGN_MODE_NATIONAL ? CAMPAIGN_MODE_NATIONAL : CAMPAIGN_MODE_STRICT;
}
function runCampaignMode(run = {}) {
  const direct = campaignMode(run.campaign_mode);
  if (direct === CAMPAIGN_MODE_NATIONAL) return direct;
  const policy = safeJson2(run.safety_policy_json, {});
  return campaignMode(policy.campaign_mode);
}
function stableStringify2(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify2).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify2(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
async function responsePayload(value) {
  if (!(value instanceof Response)) return value || {};
  return value.clone().json().catch(() => ({}));
}
async function requireAdmin2(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: response2({ error: "Autentificare necesara." }, 401) };
  if (user.role !== "admin") return { error: response2({ error: "Acces administrativ necesar." }, 403) };
  return { user, svc: base44.asServiceRole };
}
function automationUser(run = {}) {
  return {
    id: clean8(run.approved_by_user_id || run.created_by_user_id || "directory-auto-import", 160),
    email: clean8(run.approved_by_email || run.created_by_email || "automation@viasee.internal", 240),
    role: "admin"
  };
}
async function writeAudit2(svc, user, entityType, entityId, actionType, previousValues, nextValues, note = "") {
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
    performed_at: now2()
  });
}
async function sha256HexBytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function sha256HexText(value) {
  return sha256HexBytes(new TextEncoder().encode(String(value ?? "")));
}
function splitPayloadText(value) {
  const text = String(value ?? "");
  const chunks = [];
  for (let offset = 0; offset < text.length; offset += PAYLOAD_CHUNK_SIZE) {
    chunks.push(text.slice(offset, offset + PAYLOAD_CHUNK_SIZE));
  }
  return chunks.length ? chunks : [""];
}
async function persistPayloadChunks(svc, runId, itemKey, payloadJson, selectedRows) {
  const text = String(payloadJson ?? "[]");
  const payloadSha256 = await sha256HexText(text);
  const chunks = splitPayloadText(text);
  const existing = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportPayloadChunk.filter(
      { run_id: runId, item_key: itemKey },
      "chunk_index",
      200
    ),
    "fragmentelor private ale lotului automat"
  );
  const byIndex = /* @__PURE__ */ new Map();
  for (const entry of existing) {
    const index = Number(entry.chunk_index);
    if (byIndex.has(index)) throw new Error(`Fragmente private duplicate pentru ${itemKey}.`);
    byIndex.set(index, entry);
  }
  let created = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const current = byIndex.get(index) || null;
    if (current) {
      const matches = Number(current.chunk_count) === chunks.length && clean8(current.payload_sha256, 80) === payloadSha256 && current.payload_chunk === chunks[index];
      if (!matches) throw new Error(`Persistenta privata este neconforma pentru ${itemKey}, fragmentul ${index}.`);
      continue;
    }
    await svc.entities.DirectoryAutoImportPayloadChunk.create({
      run_id: runId,
      item_key: itemKey,
      chunk_index: index,
      chunk_count: chunks.length,
      payload_chunk: chunks[index],
      payload_sha256: payloadSha256,
      created_for_selected_rows: Number(selectedRows || 0)
    });
    created += 1;
  }
  for (const index of byIndex.keys()) {
    if (index < 0 || index >= chunks.length) throw new Error(`Fragment privat excedentar pentru ${itemKey}.`);
  }
  return { payload_sha256: payloadSha256, chunk_count: chunks.length, reused: created === 0, created };
}
async function loadPayloadChunks(svc, item) {
  const chunks = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportPayloadChunk.filter(
      { run_id: item.run_id, item_key: item.item_key },
      "chunk_index",
      200
    ),
    "fragmentelor private ale lotului automat pentru reluare"
  );
  if (!chunks.length) return null;
  const expectedCount = Number(chunks[0].chunk_count || 0);
  if (!expectedCount || chunks.length !== expectedCount) {
    throw new Error(`Fragmente private incomplete pentru ${item.item_key}.`);
  }
  for (let index = 0; index < chunks.length; index += 1) {
    if (Number(chunks[index].chunk_index) !== index || Number(chunks[index].chunk_count) !== expectedCount) {
      throw new Error(`Ordine invalida a fragmentelor private pentru ${item.item_key}.`);
    }
  }
  const text = chunks.map((entry) => entry.payload_chunk || "").join("");
  const actualSha256 = await sha256HexText(text);
  if (actualSha256 !== clean8(chunks[0].payload_sha256, 80)) {
    throw new Error(`SHA invalid pentru persistenta privata a ${item.item_key}.`);
  }
  const payload = JSON.parse(text);
  if (!Array.isArray(payload)) throw new Error(`Payload privat invalid pentru ${item.item_key}.`);
  return payload;
}
async function fetchJson(sourceUrl, expectedSha256 = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3e4);
  try {
    const result = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!result.ok) throw new Error(`Fisierul sursa nu poate fi descarcat (${result.status}).`);
    const bytes = await result.arrayBuffer();
    if (bytes.byteLength > 8e6) throw new Error("Fisierul sursa depaseste limita de 8 MB.");
    const sha256 = await sha256HexBytes(bytes);
    const expected = clean8(expectedSha256, 80).toLowerCase();
    if (expected && expected !== sha256) throw new Error("SHA-256 al fisierului nu corespunde manifestului.");
    return {
      payload: JSON.parse(new TextDecoder().decode(bytes)),
      sha256,
      bytes: bytes.byteLength
    };
  } finally {
    clearTimeout(timer);
  }
}
function sourceUrlFor(entry) {
  if (typeof entry === "string") return clean8(entry, 2e3);
  return clean8(
    entry?.source_url || entry?.file_url || entry?.url || entry?.batch_url || entry?.batch_file_url || entry?.clean_batch_file_url,
    2e3
  );
}
function descriptorFor(entry, index = 0) {
  const sourceUrl = sourceUrlFor(entry);
  if (!/^https:\/\//i.test(sourceUrl)) return null;
  const expectedRows = Number(
    entry?.row_count ?? entry?.location_count ?? entry?.expected_rows ?? 0
  );
  return {
    source_url: sourceUrl,
    source_filename: clean8(
      entry?.file_name || entry?.filename || sourceUrl.split("/").pop()?.split("?")[0] || `batch-${index + 1}.json`,
      240
    ),
    expected_sha256: clean8(
      entry?.clean_batch_file_sha256 || entry?.file_sha256 || entry?.sha256 || "",
      80
    ).toLowerCase(),
    expected_rows: Number.isFinite(expectedRows) && expectedRows > 0 ? expectedRows : 0,
    organization_count: Math.max(0, Number(entry?.organization_count || 0))
  };
}
function descriptorsFromManifest(payload, manifestUrl = "") {
  const collections = [
    payload?.clean_batches,
    payload?.batches,
    payload?.batch_files,
    payload?.files,
    payload?.items
  ].filter(Array.isArray);
  const descriptors = (collections[0] || []).map((entry, index) => descriptorFor(entry, index)).filter(Boolean).filter((entry) => /\.json(?:$|\?)/i.test(entry.source_url)).filter((entry) => {
    const name = clean8(entry.source_filename, 240).toLowerCase();
    if (/(needs-review|excluded|audit|report|manifest)/.test(name)) return false;
    return /batch/.test(name);
  });
  if (descriptors.length) return descriptors;
  if (Array.isArray(payload?.rows)) {
    const direct = descriptorFor({
      source_url: manifestUrl,
      file_name: payload?.batch_key ? `${payload.batch_key}.json` : void 0,
      row_count: payload.rows.length,
      organization_count: payload?.organization_count,
      file_sha256: payload?.clean_batch_file_sha256 || payload?.file_sha256 || ""
    });
    return direct ? [direct] : [];
  }
  return [];
}
function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}
function decodeBase64Bytes(value) {
  const source = String(value || "").replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "");
  if (!source) throw new Error("Arhiva ZIP lipseste.");
  if (source.length > 12e6) throw new Error("Arhiva ZIP depaseste limita acceptata.");
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function archiveEntryByName(entries, requestedName) {
  const expected = clean8(requestedName, 500).replace(/^\.\//, "");
  if (!expected) return null;
  if (entries[expected]) return { name: expected, bytes: entries[expected] };
  const exactSuffix = Object.keys(entries).find((name) => name === expected || name.endsWith(`/${expected}`));
  if (exactSuffix) return { name: exactSuffix, bytes: entries[exactSuffix] };
  const baseName = expected.split("/").pop();
  const byBaseName = Object.keys(entries).filter((name) => name.split("/").pop() === baseName);
  if (byBaseName.length === 1) return { name: byBaseName[0], bytes: entries[byBaseName[0]] };
  return null;
}
async function descriptorsFromZipBase64(zipBase64, archiveFilename = "") {
  const zipBytes = decodeBase64Bytes(zipBase64);
  if (zipBytes.byteLength > 8e6) throw new Error("Arhiva ZIP depaseste limita de 8 MB.");
  const archiveSha256 = await sha256HexBytes(zipBytes);
  let entries;
  try {
    entries = unzipSync(zipBytes);
  } catch (_error) {
    throw new Error("Arhiva ZIP nu poate fi deschisa.");
  }
  const names = Object.keys(entries).filter((name) => !name.endsWith("/"));
  const manifestName = names.find((name) => /(^|\/)(manifest-index|manifest)\.json$/i.test(name));
  let manifest = null;
  if (manifestName) {
    try {
      manifest = JSON.parse(strFromU8(entries[manifestName]));
    } catch (_error) {
      throw new Error("Manifestul JSON din arhiva este invalid.");
    }
  }
  const manifestCollections = [
    manifest?.automatic_batches,
    manifest?.clean_batches,
    manifest?.batches,
    manifest?.batch_files,
    manifest?.files,
    manifest?.items
  ].filter(Array.isArray);
  const descriptors = [];
  if (manifestCollections[0]?.length) {
    for (let index = 0; index < manifestCollections[0].length; index += 1) {
      const entry = manifestCollections[0][index];
      const fileName = clean8(
        entry?.file || entry?.file_name || entry?.filename || entry?.path,
        500
      );
      const located = archiveEntryByName(entries, fileName);
      if (!located) throw new Error(`Fisierul ${fileName || index + 1} declarat in manifest lipseste din arhiva.`);
      const actualSha256 = await sha256HexBytes(located.bytes);
      const expectedSha256 = clean8(entry?.sha256 || entry?.file_sha256 || "", 80).toLowerCase();
      if (expectedSha256 && expectedSha256 !== actualSha256) {
        throw new Error(`SHA-256 nu corespunde pentru ${fileName}.`);
      }
      let payload;
      try {
        payload = JSON.parse(strFromU8(located.bytes));
      } catch (_error) {
        throw new Error(`Fisierul ${fileName} nu contine JSON valid.`);
      }
      const rows = rowsFromPayload(payload);
      descriptors.push({
        source_url: `archive://${archiveSha256}/${located.name}`,
        source_filename: located.name.split("/").pop() || `batch-${index + 1}.json`,
        source_sha256: actualSha256,
        expected_sha256: actualSha256,
        expected_rows: Math.max(0, Number(entry?.rows ?? entry?.row_count ?? entry?.location_count ?? rows.length)),
        organization_count: Math.max(0, Number(entry?.organizations ?? entry?.organization_count ?? 0)),
        inline_rows: rows
      });
    }
  } else {
    const batchNames = names.filter((name) => {
      const baseName = name.split("/").pop()?.toLowerCase() || "";
      return /\.json$/.test(baseName) && /batch/.test(baseName) && !/(needs-review|requires-review|excluded|blocked|audit|report|manifest|invalid)/.test(baseName);
    }).sort();
    for (let index = 0; index < batchNames.length; index += 1) {
      const name = batchNames[index];
      let payload;
      try {
        payload = JSON.parse(strFromU8(entries[name]));
      } catch (_error) {
        throw new Error(`Fisierul ${name} nu contine JSON valid.`);
      }
      const rows = rowsFromPayload(payload);
      const sourceSha256 = await sha256HexBytes(entries[name]);
      descriptors.push({
        source_url: `archive://${archiveSha256}/${name}`,
        source_filename: name.split("/").pop() || `batch-${index + 1}.json`,
        source_sha256: sourceSha256,
        expected_sha256: sourceSha256,
        expected_rows: rows.length,
        organization_count: 0,
        inline_rows: rows
      });
    }
  }
  if (!descriptors.length) throw new Error("Arhiva nu contine loturi JSON recunoscute.");
  return {
    archive_filename: clean8(archiveFilename, 240),
    archive_sha256: archiveSha256,
    descriptors
  };
}
function nationalPseudoRowReason(row = {}) {
  const name = normalizeIdentityText(row.location_display_name || row.location_name);
  const locality = clean8(row.official_locality || row.locality_name, 160);
  const address = normalizeIdentityText(row.confirmed_address || row.address);
  if (!name) return "missing_location_name";
  if (name === "organizatie" || /^(?:locatii|acoperire|retea|network)(?:\s|$)/.test(name) || /^total(?:\s*:?\s*\d|\s+(?:locatii|puncte|sedii)\b)/.test(name)) return "aggregate_or_summary_row";
  if (/^~?\d+\+?$/.test(locality) || /^~?\d+\+?$/.test(clean8(row.location_display_name || row.location_name))) {
    return "aggregate_count_row";
  }
  if (!address && /\b(locatii|puncte|sedii)\b/.test(name)) return "aggregate_without_address";
  return "";
}
function nationalOrganizationTypeCode(row = {}, resolvedType = null) {
  const explicit = clean8(row.organization_type_code, 120);
  if (explicit && explicit !== "other") return explicit;
  const text = normalizeIdentityText([
    row.organization_display_name,
    row.location_display_name,
    row.confirmed_activity_category,
    row.observations
  ].filter(Boolean).join(" "));
  if (/\bspital\b|\binstitut\b|\bambulator\b|\bsectie\b/.test(text)) return "public_healthcare_institution";
  if (/\bpoliclinica\b|\bhiperclinica\b|\bmulti specialitate\b|\bcentru medical\b/.test(text)) return "multi_specialty_healthcare_provider";
  if (/\bretea\b|\bnetwork\b/.test(text)) return "healthcare_network";
  const profileType = clean8(resolvedType?.provider_profile_type || row.provider_profile_type, 120);
  if (profileType === "optical_chain") return "optical_chain";
  if (profileType === "independent_optical_store") return "independent_optical_store";
  if (profileType === "ophthalmology_clinic") return "ophthalmology_clinic";
  if (profileType === "ophthalmology_office") return "ophthalmology_office";
  if (profileType.startsWith("independent_")) return "independent_professional";
  if (profileType.startsWith("optical_laboratory_")) return "optical_laboratory";
  if (resolvedType?.provider_type === "optica_medicala") return "independent_optical_store";
  if (resolvedType?.provider_type === "cabinet_oftalmologic") return "ophthalmology_office";
  if (resolvedType?.provider_type === "clinica_oftalmologica") return "ophthalmology_clinic";
  return "independent_professional";
}
function inferNationalLocationType(activityText = "") {
  const text = normalizeIdentityText(activityText);
  if (/\bspital\b|\binstitut\b|\bambulator\b|\bsectie\b|\bcompartiment\b/.test(text)) {
    const outpatient = /\bambulator\b|\bcabinet\b/.test(text);
    return {
      provider_type: "clinica_oftalmologica",
      provider_profile_type: "ophthalmology_clinic",
      location_type_code: outpatient ? "hospital_outpatient_unit" : "hospital_department",
      care_setting_code: outpatient ? "hospital_outpatient" : "hospital_inpatient"
    };
  }
  if (/\bpoliclinica\b|\bhiperclinica\b|\bmulti specialitate\b|\bcentru medical\b/.test(text)) {
    return {
      provider_type: "clinica_oftalmologica",
      provider_profile_type: "ophthalmology_clinic",
      location_type_code: "multi_specialty_clinic",
      care_setting_code: "outpatient"
    };
  }
  return inferCanonicalLocationType(activityText);
}
function normalizeNationalDirectoryRow(row = {}) {
  const explicitComplete = [
    row.provider_type,
    row.provider_profile_type,
    row.location_type_code,
    row.care_setting_code
  ].every((value) => Boolean(clean8(value, 120)));
  const activityText = [
    row.confirmed_activity_category,
    row.location_display_name,
    row.organization_display_name,
    row.observations
  ].filter(Boolean).join(" | ");
  const resolvedType = explicitComplete ? {
    provider_type: clean8(row.provider_type, 120),
    provider_profile_type: clean8(row.provider_profile_type, 120),
    location_type_code: clean8(row.location_type_code, 120),
    care_setting_code: clean8(row.care_setting_code, 120)
  } : inferNationalLocationType(activityText);
  const organizationName = clean8(row.organization_display_name || row.location_display_name, 240);
  return {
    ...row,
    organization_display_name: organizationName,
    provider_type: resolvedType?.provider_type || "",
    provider_profile_type: resolvedType?.provider_profile_type || "",
    location_type_code: resolvedType?.location_type_code || "",
    care_setting_code: resolvedType?.care_setting_code || "",
    organization_type_code: nationalOrganizationTypeCode(row, resolvedType),
    classification_contract_version: "viasee-directory-location-first-v1",
    national_original_import_readiness: clean8(row.import_readiness, 120),
    import_readiness: "candidate_for_manual_review",
    national_directory_candidate: true
  };
}
function nationalSelectionReasons(row = {}) {
  const reasons = [];
  const originalReadiness = clean8(row.national_original_import_readiness || row.import_readiness, 120);
  const researchStatus = clean8(row.research_status, 120);
  const operationalStatus = clean8(row.operational_status, 120);
  if (["not_eligible"].includes(originalReadiness) || researchStatus === "excluded") reasons.push("not_eligible");
  if (originalReadiness === "blocked_conflict") reasons.push("conflict_requires_review");
  if (!["official_confirmed", "official_partial"].includes(researchStatus)) reasons.push("source_not_sufficiently_confirmed");
  if (operationalStatus !== "active_confirmed") reasons.push("activity_not_confirmed");
  if (clean8(row.geography_validation_error, 120)) reasons.push(clean8(row.geography_validation_error, 120));
  const pseudoReason = nationalPseudoRowReason(row);
  if (pseudoReason) reasons.push(pseudoReason);
  for (const field of [
    "location_display_name",
    "organization_display_name",
    "official_locality",
    "county_if_confirmed",
    "confirmed_address",
    "official_source_url",
    "locality_siruta_code",
    "county_code",
    "uat_code",
    "uat_name",
    "provider_type",
    "provider_profile_type",
    "organization_type_code",
    "location_type_code",
    "care_setting_code"
  ]) {
    if (!clean8(row[field], 4e3)) reasons.push(`missing_${field}`);
  }
  return Array.from(new Set(reasons));
}
function nationalRowScore(row = {}) {
  let score = 0;
  if (row.research_status === "official_confirmed") score += 100;
  if (!clean8(row.review_flags, 2e3)) score += 20;
  if (clean8(row.confirmed_location_phone, 240)) score += 5;
  if (clean8(row.confirmed_location_email, 240)) score += 3;
  if (clean8(row.confirmed_schedule, 1200)) score += 2;
  if (clean8(row.official_source_url, 1200)) score += 10;
  return score;
}
function nationalIdentityKey(row = {}) {
  const external = clean8(row.location_external_key, 240);
  if (external) return `external:${external}`;
  return `identity:${clean8(row.locality_siruta_code, 40)}|${clean8(row.address_fingerprint, 240)}|${normalizeIdentityText(row.location_display_name)}`;
}
function selectRowsForNationalDirectory(rows = []) {
  const excluded = [];
  const bestByIdentity = /* @__PURE__ */ new Map();
  for (const sourceRow of rows) {
    const row = normalizeNationalDirectoryRow(sourceRow);
    const reasons = nationalSelectionReasons(row);
    if (reasons.length) {
      excluded.push({ row, reasons });
      continue;
    }
    const key = nationalIdentityKey(row);
    const current = bestByIdentity.get(key) || null;
    if (!current || nationalRowScore(row) > nationalRowScore(current)) {
      if (current) excluded.push({ row: current, reasons: ["duplicate_in_national_package"] });
      bestByIdentity.set(key, row);
    } else {
      excluded.push({ row, reasons: ["duplicate_in_national_package"] });
    }
  }
  const selected = Array.from(bestByIdentity.values()).sort((left, right) => clean8(left.official_locality, 160).localeCompare(clean8(right.official_locality, 160), "ro") || clean8(left.organization_display_name, 240).localeCompare(clean8(right.organization_display_name, 240), "ro") || clean8(left.location_display_name, 240).localeCompare(clean8(right.location_display_name, 240), "ro"));
  const reasonCounts = {};
  for (const item of excluded) {
    for (const reason of item.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return {
    selected,
    excluded,
    summary: {
      source_rows: rows.length,
      selected_rows: selected.length,
      excluded_rows: excluded.length,
      reason_counts: reasonCounts
    }
  };
}
function recomputeNationalSelectionSummary(selected = [], excluded = [], sourceRows = 0) {
  const reasonCounts = {};
  for (const item of excluded) {
    for (const reason of asArray2(item.reasons)) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return {
    source_rows: Number(sourceRows || selected.length + excluded.length),
    selected_rows: selected.length,
    excluded_rows: excluded.length,
    reason_counts: reasonCounts
  };
}
function existingLocationIdentityKey(location = {}) {
  const localityKey = normalizeIdentityText(location.locality_name || location.city);
  const addressKey = normalizeAddressForFingerprint(location.address);
  const nameKey = normalizeIdentityText(location.name || location.public_display_name);
  if (!localityKey || !addressKey || !nameKey) return "";
  return `loc:${stableTextHash([localityKey, addressKey, nameKey].join("|"))}`;
}
async function excludeControlledOrAmbiguousLiveMatches(svc, selection) {
  const [locations, states] = await Promise.all([
    requireDirectoryRows(
      svc.entities.ProviderLocation.list("name", 5e3),
      "locatiilor existente pentru deduplicarea campaniei nationale"
    ),
    requireDirectoryRows(
      svc.entities.ProviderLocationDirectoryState.filter({ state_status: "active" }, "-created_date", 5e3),
      "starilor de director pentru deduplicarea campaniei nationale"
    )
  ]);
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const locationIdsByExternalKey = /* @__PURE__ */ new Map();
  const append = (map, key, value) => {
    if (!key) return;
    const values = map.get(key) || [];
    if (!values.includes(value)) values.push(value);
    map.set(key, values);
  };
  for (const state of states) append(locationIdsByExternalKey, clean8(state.directory_external_key, 240), state.location_id);
  for (const location of locations) append(locationIdsByExternalKey, existingLocationIdentityKey(location), location.id);
  const selected = [];
  const excluded = [...selection.excluded];
  for (let index = 0; index < selection.selected.length; index += 1) {
    const row = selection.selected[index];
    const normalized = normalizeDirectoryImportRow(row, {
      source_version: "national-preflight",
      source_row_key: clean8(row.source_row_key || row.__source_row_key || `national:${index + 1}`, 240),
      row_number: index + 1
    });
    const fallbackKey = existingLocationIdentityKey({
      locality_name: normalized.locality_name,
      address: normalized.address,
      name: normalized.location_name
    });
    const candidates = Array.from(/* @__PURE__ */ new Set([
      ...locationIdsByExternalKey.get(normalized.location_external_key) || [],
      ...locationIdsByExternalKey.get(fallbackKey) || []
    ]));
    if (candidates.length > 1) {
      excluded.push({ row, reasons: ["ambiguous_existing_location_match"] });
      continue;
    }
    if (candidates.length === 1) {
      const location = locationsById.get(candidates[0]) || null;
      const controlStatus = clean8(location?.profile_control_status || "directory", 80);
      if (["claimed", "verified", "suspended"].includes(controlStatus)) {
        excluded.push({ row, reasons: ["existing_controlled_location"] });
        continue;
      }
    }
    selected.push(row);
  }
  return {
    selected,
    excluded,
    summary: recomputeNationalSelectionSummary(selected, excluded, selection.summary?.source_rows)
  };
}
function safeHostname(value) {
  const text = clean8(value, 1200);
  if (!text) return "";
  try {
    return new URL(text).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}
async function reconcileNationalOrganizationKeys(svc, selection) {
  const organizations = await requireDirectoryRows(
    svc.entities.ProviderOrganization.list("name", 5e3),
    "organizatiilor live pentru reconcilierea campaniei nationale"
  );
  const byExternalKey = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  const byDomain = /* @__PURE__ */ new Map();
  const append = (map, key, organization) => {
    if (!key) return;
    const values = map.get(key) || [];
    values.push(organization);
    map.set(key, values);
  };
  for (const organization of organizations) {
    append(byExternalKey, clean8(organization.directory_external_key, 240), organization);
    append(byName, normalizeIdentityText(organization.public_display_name || organization.name), organization);
    append(byDomain, safeHostname(organization.website_url || organization.website), organization);
  }
  const selected = [];
  const excluded = [...selection.excluded];
  for (const row of selection.selected) {
    const sourceExternalKey = clean8(row.organization_external_key, 240);
    const externalMatches = sourceExternalKey ? byExternalKey.get(sourceExternalKey) || [] : [];
    if (externalMatches.length > 1) {
      excluded.push({ row, reasons: ["ambiguous_existing_organization_external_key"] });
      continue;
    }
    if (externalMatches.length === 1) {
      selected.push({ ...row, target_organization_id: externalMatches[0].id });
      continue;
    }
    const nameMatches = byName.get(normalizeIdentityText(row.organization_display_name)) || [];
    const domainMatches = byDomain.get(safeHostname(row.official_source_url || row.website)) || [];
    const candidates = Array.from(new Map(
      [...nameMatches, ...domainMatches].map((organization) => [organization.id, organization])
    ).values());
    if (candidates.length > 1) {
      excluded.push({ row, reasons: ["ambiguous_existing_organization_match"] });
      continue;
    }
    if (candidates.length === 1) {
      const existingKey = clean8(candidates[0].directory_external_key, 240);
      selected.push({
        ...row,
        ...existingKey ? { organization_external_key: existingKey } : {},
        target_organization_id: candidates[0].id
      });
      continue;
    }
    selected.push(row);
  }
  return {
    selected,
    excluded,
    summary: recomputeNationalSelectionSummary(selected, excluded, selection.summary?.source_rows)
  };
}
function packNationalRows(rows = []) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = clean8(row.organization_external_key, 240) || `org-name:${normalizeIdentityText(row.organization_display_name)}`;
    const values = groups.get(key) || [];
    values.push(row);
    groups.set(key, values);
  }
  const batches = [];
  let current = [];
  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
  };
  const orderedGroups = Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  for (const [, groupRows] of orderedGroups) {
    if (groupRows.length > MAX_ROWS_PER_BATCH) {
      flush();
      for (let offset = 0; offset < groupRows.length; offset += MAX_ROWS_PER_BATCH) {
        batches.push(groupRows.slice(offset, offset + MAX_ROWS_PER_BATCH));
      }
      continue;
    }
    if (current.length + groupRows.length > MAX_ROWS_PER_BATCH) flush();
    current.push(...groupRows);
  }
  flush();
  return batches;
}
async function nationalRowsFromPrivateSourceBase64(sourceBase64, sourceFilename = "") {
  const sourceBytes = decodeBase64Bytes(sourceBase64);
  if (sourceBytes.byteLength > 8e6) throw new Error("Fisierul privat depaseste limita de 8 MB.");
  const sourceSha256 = await sha256HexBytes(sourceBytes);
  if (/\.json$/i.test(clean8(sourceFilename, 240))) {
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(sourceBytes));
    } catch (_error) {
      throw new Error("Registrul master JSON este invalid.");
    }
    const rows2 = rowsFromPayload(payload);
    if (!rows2.length) throw new Error("Registrul master JSON nu contine randuri de locatie.");
    return {
      archive_filename: clean8(sourceFilename, 240),
      archive_sha256: sourceSha256,
      rows: rows2,
      source_kind: "master_json"
    };
  }
  let entries;
  try {
    entries = unzipSync(sourceBytes);
  } catch (_error) {
    throw new Error("Fisierul trebuie sa fie registrul master JSON sau o arhiva ZIP valida.");
  }
  const names = Object.keys(entries).filter((name) => !name.endsWith("/") && /\.json$/i.test(name));
  let masterRows = [];
  const aggregateRows = [];
  for (const name of names) {
    const baseName = name.split("/").pop()?.toLowerCase() || "";
    if (/(audit|report|manifest|invalid_required_fields)/.test(baseName)) continue;
    let payload;
    try {
      payload = JSON.parse(strFromU8(entries[name]));
    } catch (_error) {
      continue;
    }
    const rows2 = rowsFromPayload(payload);
    if (!rows2.length) continue;
    if (/master|registry_v8_master|registry_v4_location_first_1329/.test(baseName) || rows2.length >= 1e3) {
      masterRows = rows2;
      break;
    }
    if (/batch/.test(baseName) || /mapped_requires_review/.test(baseName) || /requires_explicit_organization_mapping/.test(baseName) || /blocked_and_not_eligible/.test(baseName)) aggregateRows.push(...rows2);
  }
  const rows = masterRows.length ? masterRows : aggregateRows;
  if (!rows.length) throw new Error("Arhiva nationala nu contine registrul master sau randuri de director recunoscute.");
  const unique = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = clean8(row.__source_row_key || row.source_row_key, 260) || nationalIdentityKey(row);
    if (!unique.has(key)) unique.set(key, row);
  }
  return {
    archive_filename: clean8(sourceFilename, 240),
    archive_sha256: sourceSha256,
    rows: Array.from(unique.values()),
    source_kind: masterRows.length ? "zip_master_json" : "zip_aggregated_batches"
  };
}
async function descriptorsForNationalSelection(selection, archiveSha256) {
  const batches = packNationalRows(selection.selected);
  if (batches.length > MAX_BATCHES) throw new Error(`Campania nationala necesita ${batches.length} loturi; limita este ${MAX_BATCHES}.`);
  const descriptors = [];
  for (let index = 0; index < batches.length; index += 1) {
    const rows = batches[index];
    const sourceSha256 = await sha256HexText(stableStringify2(rows));
    descriptors.push({
      source_url: `archive://${archiveSha256}/national-directory-batch-${String(index + 1).padStart(2, "0")}.json`,
      source_filename: `national-directory-batch-${String(index + 1).padStart(2, "0")}.json`,
      source_sha256: sourceSha256,
      expected_sha256: sourceSha256,
      expected_rows: rows.length,
      organization_count: new Set(rows.map((row) => clean8(row.organization_external_key || row.organization_display_name, 300))).size,
      inline_rows: rows,
      national_selection_summary: selection.summary
    });
  }
  return descriptors;
}
async function canonicalGeographyMap(svc, rows = []) {
  const codes = Array.from(new Set(rows.map((row) => clean8(row?.locality_siruta_code, 40)).filter(Boolean)));
  const geographicRows = codes.length ? await requireDirectoryRows(
    svc.entities.GeographicLocality.filter(
      { siruta_code: { $in: codes }, is_active: true },
      "siruta_code",
      Math.max(10, codes.length * 3)
    ),
    "geografiei canonice pentru importul automat"
  ) : [];
  const bySiruta = /* @__PURE__ */ new Map();
  for (const geography of geographicRows) {
    const code = clean8(geography.siruta_code, 40);
    if (code && !bySiruta.has(code)) bySiruta.set(code, geography);
  }
  return bySiruta;
}
async function enrichRowsWithCanonicalGeography(svc, rows = [], existingMap = null) {
  const bySiruta = existingMap instanceof Map ? existingMap : await canonicalGeographyMap(svc, rows);
  return rows.map((row) => {
    const code = clean8(row?.locality_siruta_code, 40);
    const geography = bySiruta.get(code) || null;
    let geographyValidationError = "";
    if (!geography) geographyValidationError = "geography_siruta_not_found";
    else if (clean8(row?.county_if_confirmed, 160) && normalizeIdentityText(row.county_if_confirmed) !== normalizeIdentityText(geography.county_name)) geographyValidationError = "geography_county_mismatch";
    return {
      ...row,
      county_name: clean8(geography?.county_name || row?.county_if_confirmed, 160),
      county_code: clean8(geography?.county_code, 40),
      uat_code: clean8(geography?.uat_code, 40),
      uat_name: clean8(geography?.uat_name, 160),
      geography_validation_error: geographyValidationError
    };
  });
}
function automaticSelectionReasons(row = {}) {
  const reasons = [];
  if (clean8(row.import_readiness, 80) !== "candidate_for_manual_review") reasons.push("not_candidate_for_manual_review");
  if (clean8(row.research_status, 80) !== "official_confirmed") reasons.push("research_not_official_confirmed");
  if (clean8(row.operational_status, 80) !== "active_confirmed") reasons.push("operational_status_not_active_confirmed");
  if (clean8(row.review_flags, 2e3)) reasons.push("review_flags_present");
  if (clean8(row.geography_validation_error, 120)) reasons.push(clean8(row.geography_validation_error, 120));
  for (const field of [
    "location_display_name",
    "organization_display_name",
    "official_locality",
    "county_if_confirmed",
    "confirmed_address",
    "official_source_url",
    "locality_siruta_code",
    "county_code",
    "uat_code",
    "uat_name",
    "provider_type",
    "provider_profile_type",
    "organization_type_code",
    "location_type_code",
    "care_setting_code"
  ]) {
    if (!clean8(row[field], 4e3)) reasons.push(`missing_${field}`);
  }
  if (clean8(row.classification_contract_version, 120) && clean8(row.classification_contract_version, 120) !== "viasee-directory-location-first-v1") reasons.push("classification_contract_version_mismatch");
  return reasons;
}
function selectRowsForAutomaticImport(rows = []) {
  const selected = [];
  const excluded = [];
  const reasonCounts = {};
  for (const row of rows) {
    const reasons = automaticSelectionReasons(row);
    if (!reasons.length) selected.push(row);
    else {
      excluded.push({
        source_row_key: clean8(row?.source_row_key || row?.__source_row_key, 220),
        location_name: clean8(row?.location_display_name || row?.location_name, 300),
        reasons
      });
      for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  return {
    selected,
    excluded,
    summary: {
      source_rows: rows.length,
      selected_rows: selected.length,
      excluded_rows: excluded.length,
      reason_counts: reasonCounts
    }
  };
}
function selectionForRun(run, rows = []) {
  return runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL ? selectRowsForNationalDirectory(rows) : selectRowsForAutomaticImport(rows);
}
function approvalPhrase(run) {
  return `AUTOIMPORT ${clean8(run.run_key, 120)} ${clean8(run.package_sha256, 80).slice(0, 12)} ${Number(run.total_batches || 0)}`;
}
function runKeyFor(packageSha256) {
  return `AUTODIR-${clean8(packageSha256, 80).slice(0, 12)}`;
}
function autoItemRecord(runId, runKey, index, item) {
  const itemKey = `${runKey}-${String(index + 1).padStart(3, "0")}`;
  return {
    run_id: runId,
    sequence: index + 1,
    item_key: itemKey,
    status: item.selected_rows > 0 ? "pending" : "skipped",
    step: item.selected_rows > 0 ? "fetch_source" : "skipped_no_strictly_clean_rows",
    source_url: item.source_url,
    source_filename: item.source_filename,
    source_sha256: item.source_sha256,
    selected_sha256: item.selected_sha256,
    expected_sha256: item.expected_sha256,
    expected_rows: item.selected_rows,
    source_rows: item.source_rows,
    selected_rows: item.selected_rows,
    excluded_rows: item.excluded_rows,
    selection_result_json: JSON.stringify(item.selection_summary),
    source_payload_json: "",
    organization_count: item.organization_count,
    snapshot_id: "",
    batch_id: "",
    execution_lock_token: "",
    applied_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    safety_result_json: "{}",
    result_json: item.selected_rows > 0 ? "{}" : JSON.stringify({ selection: item.selection_summary }),
    failure_message: "",
    ...item.selected_rows > 0 ? {} : { started_at: now2(), finished_at: now2() }
  };
}
async function createRun(svc, user, input) {
  const manifestUrl = clean8(input.manifest_url, 2e3);
  const mode = campaignMode(input.campaign_mode);
  const publicationMode = PUBLICATION_MODE_BASIC;
  let archiveMetadata = null;
  let descriptors = [];
  let campaignSourceRows = 0;
  let campaignExcludedRows = 0;
  let campaignSelectionSummary = null;
  if (mode === CAMPAIGN_MODE_NATIONAL) {
    if (!input.zip_base64) return response2({ error: "Campania nationala necesita registrul master JSON sau arhiva ZIP privata." }, 400);
    archiveMetadata = await nationalRowsFromPrivateSourceBase64(
      input.zip_base64,
      clean8(input.zip_filename, 240)
    );
    const geographyMap2 = await canonicalGeographyMap(svc, archiveMetadata.rows);
    const canonicalRows = await enrichRowsWithCanonicalGeography(svc, archiveMetadata.rows, geographyMap2);
    const selectedNationalRows = selectRowsForNationalDirectory(canonicalRows);
    const liveSafeSelection = await excludeControlledOrAmbiguousLiveMatches(svc, selectedNationalRows);
    const nationalSelection = await reconcileNationalOrganizationKeys(svc, liveSafeSelection);
    campaignSourceRows = nationalSelection.summary.source_rows;
    campaignExcludedRows = nationalSelection.summary.excluded_rows;
    campaignSelectionSummary = {
      ...nationalSelection.summary,
      source_kind: archiveMetadata.source_kind || "private_source"
    };
    descriptors = await descriptorsForNationalSelection(nationalSelection, archiveMetadata.archive_sha256);
  } else if (input.zip_base64) {
    archiveMetadata = await descriptorsFromZipBase64(
      input.zip_base64,
      clean8(input.zip_filename, 240)
    );
    descriptors = archiveMetadata.descriptors;
  } else {
    descriptors = asArray2(input.batch_urls).map((entry, index) => descriptorFor(entry, index)).filter(Boolean);
    if (manifestUrl) {
      const manifest = await fetchJson(manifestUrl, clean8(input.manifest_sha256, 80));
      descriptors = descriptorsFromManifest(manifest.payload, manifestUrl);
    }
  }
  const unique = /* @__PURE__ */ new Map();
  for (const descriptor of descriptors) {
    if (!unique.has(descriptor.source_url)) unique.set(descriptor.source_url, descriptor);
  }
  descriptors = Array.from(unique.values()).slice(0, MAX_BATCHES);
  if (!descriptors.length) return response2({ error: "Nu au fost gasite loturi JSON valide in arhiva, manifest sau lista de URL-uri." }, 400);
  for (const descriptor of descriptors) {
    if (descriptor.expected_rows > MAX_ROWS_PER_BATCH) {
      return response2({ error: `${descriptor.source_filename} depaseste ${MAX_ROWS_PER_BATCH} de randuri.` }, 400);
    }
    if (descriptor.expected_sha256 && !/^[a-f0-9]{64}$/.test(descriptor.expected_sha256)) {
      return response2({ error: `SHA-256 invalid pentru ${descriptor.source_filename}.` }, 400);
    }
  }
  const loadedDescriptors = [];
  const allSourceRows = [];
  for (const descriptor of descriptors) {
    let sourceRows = Array.isArray(descriptor.inline_rows) ? descriptor.inline_rows : [];
    let sourceSha256 = clean8(descriptor.source_sha256, 80).toLowerCase();
    if (!sourceRows.length) {
      const fetched = await fetchJson(descriptor.source_url, descriptor.expected_sha256);
      sourceRows = rowsFromPayload(fetched.payload);
      sourceSha256 = fetched.sha256;
    }
    if (!sourceRows.length || sourceRows.length > MAX_ROWS_PER_BATCH) {
      return response2({ error: `${descriptor.source_filename} are ${sourceRows.length} randuri; limita este ${MAX_ROWS_PER_BATCH}.` }, 400);
    }
    if (descriptor.expected_rows > 0 && descriptor.expected_rows !== sourceRows.length) {
      return response2({ error: `${descriptor.source_filename}: manifestul declara ${descriptor.expected_rows} randuri, fisierul contine ${sourceRows.length}.` }, 400);
    }
    loadedDescriptors.push({ ...descriptor, source_sha256: sourceSha256, source_rows_payload: sourceRows });
    allSourceRows.push(...sourceRows);
  }
  const geographyMap = await canonicalGeographyMap(svc, allSourceRows);
  const preparedDescriptors = [];
  for (const descriptor of loadedDescriptors) {
    const sourceRows = descriptor.source_rows_payload;
    const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows, geographyMap);
    const selection = mode === CAMPAIGN_MODE_NATIONAL ? {
      selected: canonicalRows,
      excluded: [],
      summary: {
        source_rows: canonicalRows.length,
        selected_rows: canonicalRows.length,
        excluded_rows: 0,
        reason_counts: {}
      }
    } : selectRowsForAutomaticImport(canonicalRows);
    const selectedSha256 = await sha256HexText(stableStringify2(selection.selected));
    preparedDescriptors.push({
      ...descriptor,
      source_rows_payload: void 0,
      source_rows: sourceRows.length,
      selected_rows: selection.selected.length,
      excluded_rows: selection.excluded.length,
      selected_sha256: selectedSha256,
      selected_payload_json: JSON.stringify(selection.selected),
      selection_summary: selection.summary,
      organization_count: new Set(selection.selected.map((row) => clean8(row.organization_external_key || row.organization_display_name, 300)).filter(Boolean)).size
    });
  }
  descriptors = preparedDescriptors;
  if (mode === CAMPAIGN_MODE_STRICT) {
    campaignSourceRows = descriptors.reduce((total, item) => total + Number(item.source_rows || 0), 0);
    campaignExcludedRows = descriptors.reduce((total, item) => total + Number(item.excluded_rows || 0), 0);
    campaignSelectionSummary = {
      source_rows: campaignSourceRows,
      selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      excluded_rows: campaignExcludedRows,
      reason_counts: {}
    };
  }
  const packageSha256 = await sha256HexText(stableStringify2({
    campaign_mode: mode,
    selection_summary: campaignSelectionSummary,
    batches: descriptors.map((item) => ({
      source_url: item.source_url,
      source_sha256: item.source_sha256,
      selected_sha256: item.selected_sha256,
      source_rows: item.source_rows,
      selected_rows: item.selected_rows,
      excluded_rows: item.excluded_rows
    }))
  }));
  const runKey = clean8(input.run_key, 120) || runKeyFor(packageSha256);
  const existing = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportRun.filter({ run_key: runKey }, "-created_date", 5),
    "rularilor automate existente"
  );
  if (existing[0]) {
    const run2 = existing[0];
    const currentItems = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run2.id }, "sequence", 100),
      "loturilor rularii automate existente"
    );
    if (run2.status !== "awaiting_approval") {
      return response2({
        success: true,
        reused: true,
        run: run2,
        items: currentItems,
        approval_confirmation: approvalPhrase(run2)
      });
    }
    const bySequence = new Map(currentItems.map((entry) => [Number(entry.sequence), entry]));
    let repairedItems = 0;
    for (let index = 0; index < descriptors.length; index += 1) {
      const descriptor = descriptors[index];
      const expectedRecord = autoItemRecord(run2.id, runKey, index, descriptor);
      let existingItem = bySequence.get(index + 1) || null;
      if (!existingItem) {
        existingItem = await svc.entities.DirectoryAutoImportItem.create(expectedRecord);
        repairedItems += 1;
      }
      await persistPayloadChunks(
        svc,
        run2.id,
        expectedRecord.item_key,
        descriptor.selected_payload_json,
        descriptor.selected_rows
      );
      if (clean8(existingItem.source_payload_json, 2e5)) {
        await svc.entities.DirectoryAutoImportItem.update(existingItem.id, { source_payload_json: "" });
      }
    }
    const runValues = {
      campaign_mode: mode,
      publication_mode: publicationMode,
      total_batches: descriptors.length,
      skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
      excluded_rows: campaignExcludedRows,
      total_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      failure_message: ""
    };
    await svc.entities.DirectoryAutoImportRun.update(run2.id, runValues);
    const items = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run2.id }, "sequence", 100),
      "loturilor rularii automate reparate"
    );
    const repairedRun = { ...run2, ...runValues };
    return response2({
      success: true,
      reused: true,
      repaired: repairedItems > 0,
      repaired_items: repairedItems,
      run: repairedRun,
      items,
      approval_confirmation: approvalPhrase(repairedRun),
      preflight: {
        source_rows: campaignSourceRows,
        selected_rows: runValues.total_rows,
        excluded_rows: campaignExcludedRows,
        skipped_batches: runValues.skipped_batches
      }
    });
  }
  const safetyPolicy = {
    campaign_mode: mode,
    publication_mode: publicationMode,
    max_rows_per_batch: MAX_ROWS_PER_BATCH,
    execution_chunk: EXECUTION_CHUNK2,
    requires_zero_snapshot_blocks: true,
    requires_zero_snapshot_duplicates: true,
    requires_zero_snapshot_warnings: mode === CAMPAIGN_MODE_STRICT,
    allowed_actions: mode === CAMPAIGN_MODE_NATIONAL ? [
      "create_organization_and_location",
      "create_location_use_existing_organization",
      "update_existing_location",
      "skip_unchanged"
    ] : Array.from(ALLOWED_ACTIONS),
    exact_external_key_required_for_existing_organization: true,
    source_filter: mode === CAMPAIGN_MODE_NATIONAL ? {
      import_readiness: "normalized_candidate",
      research_status: ["official_confirmed", "official_partial"],
      operational_status: "active_confirmed",
      conflicts_are_excluded: true,
      deterministic_type_inference_allowed: true
    } : {
      import_readiness: "candidate_for_manual_review",
      research_status: "official_confirmed",
      operational_status: "active_confirmed",
      review_flags_must_be_empty: true,
      explicit_location_first_classification_required: true
    },
    publishes_profiles: true,
    publication_trust_label: "directory_unclaimed_unverified",
    verifies_profiles: false,
    creates_services: false,
    grants_access: false
  };
  const run = await svc.entities.DirectoryAutoImportRun.create({
    run_key: runKey,
    contract_version: DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION,
    campaign_mode: mode,
    publication_mode: publicationMode,
    status: "awaiting_approval",
    manifest_url: manifestUrl,
    package_sha256: packageSha256,
    total_batches: descriptors.length,
    completed_batches: 0,
    blocked_batches: 0,
    failed_batches: 0,
    skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
    excluded_rows: campaignExcludedRows,
    total_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
    applied_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    current_sequence: 1,
    current_step: "awaiting_approval",
    safety_policy_json: JSON.stringify(safetyPolicy),
    result_json: "{}",
    approval_token_hash: "",
    created_by_user_id: user.id,
    created_by_email: user.email || "",
    failure_message: "",
    notes: clean8(input.notes, 2e3) || (mode === CAMPAIGN_MODE_NATIONAL ? "Campanie nationala automata: profile de director neconfirmate, publicate la nivel basic sau summary." : "Import automat controlat cu publicare ca profil de director neconfirmat.")
  });
  for (let index = 0; index < descriptors.length; index += 1) {
    const item = descriptors[index];
    const itemRecord = autoItemRecord(run.id, runKey, index, item);
    await svc.entities.DirectoryAutoImportItem.create(itemRecord);
    await persistPayloadChunks(
      svc,
      run.id,
      itemRecord.item_key,
      item.selected_payload_json,
      item.selected_rows
    );
  }
  await writeAudit2(svc, user, "DirectoryAutoImportRun", run.id, "directory_auto_import_run_created", {}, {
    run_key: runKey,
    package_sha256: packageSha256,
    total_batches: descriptors.length,
    selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
    excluded_rows: campaignExcludedRows,
    campaign_mode: mode
  });
  return response2({
    success: true,
    run,
    approval_confirmation: approvalPhrase(run),
    preflight: {
      source_rows: campaignSourceRows,
      selected_rows: descriptors.reduce((total, item) => total + Number(item.selected_rows || 0), 0),
      excluded_rows: campaignExcludedRows,
      skipped_batches: descriptors.filter((item) => Number(item.selected_rows || 0) === 0).length,
      campaign_mode: mode
    }
  });
}
async function listRuns(svc, input) {
  const limit = Math.max(1, Math.min(50, Number(input.limit || 20)));
  const runs = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportRun.list("-created_date", limit),
    "rularilor automate de import"
  );
  const result = [];
  for (const run of runs) {
    const items = await requireDirectoryRows(
      svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, "sequence", 100),
      "loturilor rularii automate"
    );
    result.push({ ...run, items, approval_confirmation: approvalPhrase(run) });
  }
  return response2({ success: true, runs: result, contract_version: DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION });
}
async function approveRun(svc, user, input) {
  const run = await getDirectoryEntityOrNull(
    svc.entities.DirectoryAutoImportRun.get(clean8(input.run_id, 120)),
    "rularii automate pentru aprobare"
  );
  if (!run) return response2({ error: "Rularea automata nu a fost gasita." }, 404);
  if (run.status !== "awaiting_approval") return response2({ error: "Rularea nu mai asteapta aprobarea." }, 409);
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, "sequence", 100),
    "loturilor rularii automate pentru aprobarea finala"
  );
  if (items.length !== Number(run.total_batches || 0)) {
    return response2({
      error: `Analiza este partiala: ${items.length} din ${Number(run.total_batches || 0)} loturi sunt persistate. Reincarca aceeasi arhiva pentru reparare.`,
      requires_repair: true
    }, 409);
  }
  const sequences = new Set(items.map((item) => Number(item.sequence)));
  for (let sequence = 1; sequence <= Number(run.total_batches || 0); sequence += 1) {
    if (!sequences.has(sequence)) {
      return response2({ error: `Lipseste lotul ${sequence}. Reincarca aceeasi arhiva pentru reparare.`, requires_repair: true }, 409);
    }
  }
  for (const item of items) {
    if (Number(item.selected_rows || 0) < 1) continue;
    const rows = await loadItemSourceRows(svc, item);
    if (!Array.isArray(rows.rows) || rows.rows.length !== Number(item.selected_rows || 0)) {
      return response2({ error: `Payload incomplet pentru ${item.item_key}. Reincarca arhiva pentru reparare.`, requires_repair: true }, 409);
    }
    const selectedSha256 = await sha256HexText(stableStringify2(rows.rows));
    if (selectedSha256 !== clean8(item.selected_sha256, 80)) {
      return response2({ error: `SHA invalid pentru ${item.item_key}. Reincarca arhiva pentru reparare.`, requires_repair: true }, 409);
    }
  }
  const expected = approvalPhrase(run);
  if (clean8(input.confirmation, 300) !== expected) {
    return response2({ error: "Confirmarea nu corespunde.", expected_confirmation: expected }, 400);
  }
  const approvedAt = now2();
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    status: "approved",
    current_step: "scheduled",
    approval_token_hash: stableTextHash(expected),
    approved_by_user_id: user.id,
    approved_by_email: user.email || "",
    approved_at: approvedAt,
    started_at: approvedAt,
    failure_message: ""
  });
  await writeAudit2(svc, user, "DirectoryAutoImportRun", run.id, "directory_auto_import_run_approved", {}, {
    run_key: run.run_key,
    total_batches: run.total_batches
  });
  return response2({ success: true, run_id: run.id, status: "approved" });
}
async function changeRunStatus(svc, user, input, nextStatus) {
  const run = await getDirectoryEntityOrNull(
    svc.entities.DirectoryAutoImportRun.get(clean8(input.run_id, 120)),
    "rularii automate pentru schimbarea starii"
  );
  if (!run) return response2({ error: "Rularea automata nu a fost gasita." }, 404);
  const allowed = {
    paused: /* @__PURE__ */ new Set(["approved", "running"]),
    approved: /* @__PURE__ */ new Set(["paused"]),
    cancelled: /* @__PURE__ */ new Set(["awaiting_approval", "approved", "running", "paused", "blocked"])
  };
  if (!allowed[nextStatus]?.has(run.status)) {
    return response2({ error: `Tranzitie invalida: ${run.status} -> ${nextStatus}.` }, 409);
  }
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    status: nextStatus,
    current_step: nextStatus === "approved" ? "scheduled" : nextStatus,
    failure_message: nextStatus === "approved" ? "" : run.failure_message || "",
    finished_at: nextStatus === "cancelled" ? now2() : null,
    execution_lock_token: "",
    execution_lock_expires_at: null
  });
  await writeAudit2(svc, user, "DirectoryAutoImportRun", run.id, `directory_auto_import_run_${nextStatus}`, { status: run.status }, { status: nextStatus });
  return response2({ success: true, run_id: run.id, status: nextStatus });
}
function lockExpiry2() {
  return new Date(Date.now() + LOCK_MINUTES2 * 6e4).toISOString();
}
async function acquireRunLock(svc, run) {
  const expiry = run.execution_lock_expires_at ? new Date(run.execution_lock_expires_at).getTime() : 0;
  if (clean8(run.execution_lock_token, 200) && expiry > Date.now()) return null;
  const token = `auto_${Date.now()}_${crypto.randomUUID()}`;
  await svc.entities.DirectoryAutoImportRun.update(run.id, {
    execution_lock_token: token,
    execution_lock_expires_at: lockExpiry2(),
    last_heartbeat_at: now2()
  });
  return token;
}
async function releaseRunLock(svc, runId, values = {}) {
  await svc.entities.DirectoryAutoImportRun.update(runId, {
    ...values,
    execution_lock_token: "",
    execution_lock_expires_at: null,
    last_heartbeat_at: now2()
  });
}
async function blockItem(svc, run, item, errors, stage) {
  const message = asArray2(errors).map((value) => clean8(value, 500)).filter(Boolean).join(" | ") || "Lot blocat de verificarea automata.";
  await svc.entities.DirectoryAutoImportItem.update(item.id, {
    status: "blocked",
    step: stage,
    failure_message: message,
    safety_result_json: JSON.stringify({ safe: false, stage, errors: asArray2(errors) }),
    finished_at: now2(),
    last_heartbeat_at: now2()
  });
  await releaseRunLock(svc, run.id, {
    status: "blocked",
    current_step: stage,
    failure_message: message
  });
  return { success: false, blocked: true, error: message };
}
async function inspectSafety(svc, snapshot, batch, run) {
  const errors = [];
  const mode = runCampaignMode(run);
  const national = mode === CAMPAIGN_MODE_NATIONAL;
  const allowedActions = new Set(national ? ["create_organization_and_location", "create_location_use_existing_organization", "update_existing_location", "skip_unchanged"] : Array.from(ALLOWED_ACTIONS));
  const allowedNationalWarnings = /* @__PURE__ */ new Set(["public_contact_missing"]);
  if (!snapshot || snapshot.status !== "ready" || !snapshot.immutable_at) errors.push("snapshot_not_ready");
  if (Number(snapshot?.total_rows || 0) < 1 || Number(snapshot?.total_rows || 0) > MAX_ROWS_PER_BATCH) errors.push("snapshot_row_count_out_of_bounds");
  if (Number(snapshot?.valid_rows || 0) !== Number(snapshot?.total_rows || 0)) errors.push("snapshot_not_all_valid");
  if (Number(snapshot?.blocked_rows || 0)) errors.push("snapshot_has_blocked_rows");
  if (Number(snapshot?.duplicate_rows || 0)) errors.push("snapshot_has_duplicates");
  if (!national && Number(snapshot?.warning_rows || 0)) errors.push("snapshot_has_warnings");
  if (!batch || batch.status !== "ready") errors.push("batch_not_ready");
  if (Number(batch?.blocked_rows || 0)) errors.push("batch_has_blocked_rows");
  if (Number(batch?.ready_rows || 0) !== Number(batch?.total_rows || 0)) errors.push("batch_not_all_ready");
  const summary = safeJson2(batch?.summary_json, {});
  for (const key of ["publishes_profiles", "verifies_profiles", "creates_services", "grants_access", "updates_controlled_profiles", "updates_controlled_organizations"]) {
    if (summary.safety?.[key] === true) errors.push(`unsafe_batch_flag:${key}`);
  }
  const rows = batch?.id ? await requireDirectoryRows(
    svc.entities.DirectoryImportRow.filter({ batch_id: batch.id }, "row_number", MAX_ROWS_PER_BATCH + 5),
    "randurilor lotului automat pentru verificare"
  ) : [];
  if (rows.length !== Number(batch?.total_rows || 0)) errors.push("batch_row_count_mismatch");
  for (const row of rows) {
    const warnings = asArray2(safeJson2(row.validation_warnings_json, []));
    const validationErrors = asArray2(safeJson2(row.validation_errors_json, []));
    const normalized = safeJson2(row.normalized_payload_json, {});
    const override = safeJson2(row.admin_override_json, {});
    const plannedActions = asArray2(safeJson2(row.planned_actions_json, []));
    if (normalized.import_readiness !== "candidate_for_manual_review") errors.push(`row_${row.row_number}:not_candidate_for_manual_review`);
    if (national) {
      if (!["official_confirmed", "official_partial"].includes(normalized.research_status)) errors.push(`row_${row.row_number}:research_not_public_directory_eligible`);
      if (!["source_explicit", "activity_inferred"].includes(normalized.canonical_type_source)) errors.push(`row_${row.row_number}:canonical_type_unresolved`);
      const unexpectedWarnings = warnings.filter((warning) => !allowedNationalWarnings.has(warning));
      if (unexpectedWarnings.length) errors.push(`row_${row.row_number}:warnings:${unexpectedWarnings.join(",")}`);
    } else {
      if (normalized.research_status !== "official_confirmed") errors.push(`row_${row.row_number}:research_not_official_confirmed`);
      if (clean8(normalized.review_flags, 2e3)) errors.push(`row_${row.row_number}:review_flags_present`);
      if (normalized.canonical_type_source !== "source_explicit") errors.push(`row_${row.row_number}:canonical_type_not_explicit`);
      if (warnings.length) errors.push(`row_${row.row_number}:warnings:${warnings.join(",")}`);
    }
    if (normalized.source_operational_status !== "active_confirmed" || normalized.operational_status !== "active") errors.push(`row_${row.row_number}:operational_status_not_active_confirmed`);
    if (normalized.organization_type_source !== "source_explicit") errors.push(`row_${row.row_number}:organization_type_not_explicit`);
    if (normalized.organization_type_legacy_fallback === true) errors.push(`row_${row.row_number}:organization_type_legacy_fallback`);
    if (validationErrors.length) errors.push(`row_${row.row_number}:errors:${validationErrors.join(",")}`);
    if (!allowedActions.has(row.planned_action)) errors.push(`row_${row.row_number}:unsafe_action:${row.planned_action}`);
    if (Object.keys(override).length) errors.push(`row_${row.row_number}:admin_override_present`);
    const targetLocationId = clean8(row.target_location_id, 160);
    if (targetLocationId) {
      if (!national || !["update_existing_location", "skip_unchanged"].includes(row.planned_action)) {
        errors.push(`row_${row.row_number}:existing_location_target`);
      } else {
        const targetLocation = await getDirectoryEntityOrNull(
          svc.entities.ProviderLocation.get(targetLocationId),
          "locatiei existente reutilizate de campania nationala"
        );
        if (!targetLocation || (targetLocation.profile_control_status || "directory") !== "directory") {
          errors.push(`row_${row.row_number}:controlled_existing_location_target`);
        }
      }
    }
    if (row.planned_action === "create_location_use_existing_organization") {
      if (plannedActions.includes("reuse_planned_organization") && !row.target_organization_id) continue;
      if (!row.target_organization_id) {
        errors.push(`row_${row.row_number}:existing_organization_target_missing`);
        continue;
      }
      const organization = await getDirectoryEntityOrNull(
        svc.entities.ProviderOrganization.get(row.target_organization_id),
        "organizatiei reutilizate de importul automat"
      );
      const explicitNationalTarget = national && clean8(normalized.target_organization_id, 160) === clean8(row.target_organization_id, 160);
      if (!organization) {
        errors.push(`row_${row.row_number}:existing_organization_target_not_found`);
      } else if (!explicitNationalTarget && (!normalized.organization_external_key || organization.directory_external_key !== normalized.organization_external_key)) {
        errors.push(`row_${row.row_number}:existing_organization_external_key_mismatch`);
      }
    }
  }
  return { safe: errors.length === 0, errors, checked_rows: rows.length, campaign_mode: mode };
}
async function refreshProgress(svc, run) {
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, "sequence", 100),
    "loturilor rularii automate pentru progres"
  );
  const totals = items.reduce((acc, item) => {
    if (item.status === "completed") acc.completed_batches += 1;
    if (item.status === "blocked") acc.blocked_batches += 1;
    if (item.status === "failed") acc.failed_batches += 1;
    if (item.status === "skipped") acc.skipped_batches += 1;
    const selectedRows = Number(item.selected_rows || 0);
    const sourceRows = Number(item.source_rows || item.expected_rows || 0);
    acc.total_rows += Number(item.source_rows || 0) > 0 ? selectedRows : sourceRows;
    acc.excluded_rows += Number(item.excluded_rows || 0);
    acc.applied_rows += Number(item.applied_rows || 0);
    acc.skipped_rows += Number(item.skipped_rows || 0);
    acc.failed_rows += Number(item.failed_rows || 0);
    return acc;
  }, { completed_batches: 0, blocked_batches: 0, failed_batches: 0, skipped_batches: 0, excluded_rows: 0, total_rows: 0, applied_rows: 0, skipped_rows: 0, failed_rows: 0 });
  if (runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL) {
    totals.excluded_rows = Number(run.excluded_rows || 0);
  }
  const nextItem = items.find((item) => !TERMINAL_ITEM_STATUSES.has(item.status)) || null;
  const completed = !nextItem && totals.blocked_batches === 0 && totals.failed_batches === 0 && totals.completed_batches + totals.skipped_batches === items.length;
  const values = {
    ...totals,
    excluded_rows: runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL ? Number(run.excluded_rows || 0) : totals.excluded_rows,
    current_sequence: nextItem?.sequence || items.length + 1,
    current_step: completed ? "completed" : nextItem?.step || run.current_step || "scheduled",
    status: completed ? "completed" : run.status,
    finished_at: completed ? now2() : null,
    result_json: JSON.stringify({ total_items: items.length, ...totals })
  };
  await svc.entities.DirectoryAutoImportRun.update(run.id, values);
  return { items, nextItem, completed, values };
}
async function reopenItemsMissingPublication(svc, run) {
  const items = await requireDirectoryRows(
    svc.entities.DirectoryAutoImportItem.filter({ run_id: run.id }, "sequence", 100),
    "loturilor pentru reconcilierea publicarii"
  );
  let reopened = 0;
  for (const item of items) {
    if (item.status !== "completed" || !clean8(item.batch_id, 160)) continue;
    const result = safeJson2(item.result_json, {});
    if (result.publication?.success === true) continue;
    await svc.entities.DirectoryAutoImportItem.update(item.id, {
      status: "running",
      step: "publish_batch",
      finished_at: null,
      failure_message: ""
    });
    reopened += 1;
  }
  if (reopened > 0 && run.status === "completed") {
    await svc.entities.DirectoryAutoImportRun.update(run.id, {
      status: "running",
      current_step: "publication_repair",
      finished_at: null,
      failure_message: ""
    });
  }
  return reopened;
}
async function loadItemSourceRows(svc, item) {
  const legacyPersisted = safeJson2(item.source_payload_json, null);
  if (Array.isArray(legacyPersisted)) {
    return {
      rows: legacyPersisted,
      source_sha256: clean8(item.source_sha256, 80),
      persisted: true
    };
  }
  const chunkedPersisted = await loadPayloadChunks(svc, item);
  if (Array.isArray(chunkedPersisted)) {
    return {
      rows: chunkedPersisted,
      source_sha256: clean8(item.source_sha256, 80),
      persisted: true
    };
  }
  if (String(item.source_url || "").startsWith("archive://")) {
    throw new Error(`Payloadul privat lipseste pentru ${item.item_key}. Reanalizeaza aceeasi arhiva pentru reparare.`);
  }
  const fetched = await fetchJson(item.source_url, item.source_sha256 || item.expected_sha256);
  return {
    rows: rowsFromPayload(fetched.payload),
    source_sha256: fetched.sha256,
    persisted: false
  };
}
async function advanceRun(svc, run) {
  if (run.status === "completed") {
    const reopened = await reopenItemsMissingPublication(svc, run);
    if (!reopened) return { success: true, skipped: true, reason: "completed" };
    run = { ...run, status: "running", current_step: "publication_repair", finished_at: null };
  } else if (["approved", "running"].includes(run.status)) {
    const reopened = await reopenItemsMissingPublication(svc, run);
    if (reopened) run = { ...run, current_step: "publication_repair" };
  }
  if (!["approved", "running"].includes(run.status)) return { success: true, skipped: true, reason: `status:${run.status}` };
  const token = await acquireRunLock(svc, run);
  if (!token) return { success: true, skipped: true, reason: "locked" };
  try {
    if (run.status === "approved") {
      await svc.entities.DirectoryAutoImportRun.update(run.id, { status: "running", current_step: "starting", started_at: run.started_at || now2() });
      run = { ...run, status: "running" };
    }
    const progress = await refreshProgress(svc, run);
    if (progress.completed) {
      await releaseRunLock(svc, run.id, { status: "completed", current_step: "completed", finished_at: now2(), failure_message: "" });
      return { success: true, completed: true };
    }
    const item = progress.nextItem;
    if (!item) {
      await releaseRunLock(svc, run.id, { status: "failed", current_step: "missing_item", failure_message: "Nu exista un lot curent." });
      return { success: false, error: "Nu exista un lot curent." };
    }
    const user = automationUser(run);
    const heartbeat = { last_heartbeat_at: now2(), failure_message: "" };
    if (item.step === "fetch_source" || item.status === "pending") {
      const loadedSource = await loadItemSourceRows(svc, item);
      const sourceRows = loadedSource.rows;
      if (!sourceRows.length || sourceRows.length > MAX_ROWS_PER_BATCH) return blockItem(svc, run, item, [`source_row_count:${sourceRows.length}`], "fetch_source");
      if (Number(item.expected_rows || 0) > 0 && Number(item.expected_rows) !== sourceRows.length) {
        return blockItem(svc, run, item, [`expected_rows:${item.expected_rows}`, `actual_rows:${sourceRows.length}`], "fetch_source");
      }
      const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows);
      const selection = selectionForRun(run, canonicalRows);
      const selectedSha256 = await sha256HexText(stableStringify2(selection.selected));
      if (selection.selected.length !== Number(item.selected_rows || 0) || selectedSha256 !== clean8(item.selected_sha256, 80)) {
        return blockItem(svc, run, item, [
          `preflight_selection_changed:${item.selected_rows}->${selection.selected.length}`,
          `preflight_selection_sha_changed:${clean8(item.selected_sha256, 12)}->${selectedSha256.slice(0, 12)}`
        ], "fetch_source");
      }
      if (!selection.selected.length) {
        await svc.entities.DirectoryAutoImportItem.update(item.id, {
          status: "skipped",
          step: "skipped_no_strictly_clean_rows",
          source_sha256: loadedSource.source_sha256,
          source_rows: sourceRows.length,
          selected_rows: 0,
          excluded_rows: selection.excluded.length,
          selection_result_json: JSON.stringify(selection.summary),
          skipped_rows: sourceRows.length,
          result_json: JSON.stringify({ selection: selection.summary }),
          failure_message: "",
          started_at: item.started_at || now2(),
          finished_at: now2(),
          ...heartbeat
        });
        const latestRun = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(run.id), "rularii automate dupa filtrarea lotului") || run;
        const refreshed = await refreshProgress(svc, latestRun);
        await releaseRunLock(svc, run.id, {
          status: refreshed.completed ? "completed" : "running",
          current_step: refreshed.completed ? "completed" : `batch_${refreshed.nextItem?.sequence || item.sequence + 1}:fetch_source`,
          finished_at: refreshed.completed ? now2() : null,
          failure_message: ""
        });
        return { success: true, step: "skipped_no_strictly_clean_rows", excluded_rows: sourceRows.length, run_completed: refreshed.completed };
      }
      const sourceVersion = `${clean8(run.run_key, 70)}_${String(item.sequence).padStart(3, "0")}`;
      const created = await responsePayload(await createSnapshot(svc, user, {
        source_name: "Registru privat VIASEE - import automat controlat",
        source_version: sourceVersion,
        source_sha256: selectedSha256,
        source_format: "json",
        original_filename: item.source_filename || `auto-batch-${item.sequence}.json`,
        total_rows: selection.selected.length,
        notes: `Rulare automata aprobata ${run.run_key}; lot ${item.sequence}/${run.total_batches}; ${Number(item.excluded_rows || 0)} randuri excluse de filtrul strict; SHA sursa completa ${loadedSource.source_sha256}.`,
        column_map: Object.fromEntries(Object.keys(selection.selected[0] || {}).map((key) => [key, key]))
      }));
      if (created.error) return blockItem(svc, run, item, [created.error], "create_snapshot");
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: "snapshot_created",
        step: "append_rows",
        source_sha256: loadedSource.source_sha256,
        selected_rows: selection.selected.length,
        snapshot_id: created.snapshot.id,
        started_at: item.started_at || now2(),
        ...heartbeat
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:append_rows`, failure_message: "" });
      return { success: true, step: "snapshot_created", selected_rows: selection.selected.length, excluded_rows: Number(item.excluded_rows || 0) };
    }
    if (item.step === "append_rows") {
      const loadedSource = await loadItemSourceRows(svc, item);
      const sourceRows = loadedSource.rows;
      const canonicalRows = await enrichRowsWithCanonicalGeography(svc, sourceRows);
      const selection = selectionForRun(run, canonicalRows);
      const selectedSha256 = await sha256HexText(stableStringify2(selection.selected));
      if (selection.selected.length !== Number(item.selected_rows || 0) || selectedSha256 !== clean8(item.selected_sha256, 80)) {
        return blockItem(svc, run, item, [
          `selected_rows_changed:${item.selected_rows}->${selection.selected.length}`,
          `selected_sha_changed:${clean8(item.selected_sha256, 12)}->${selectedSha256.slice(0, 12)}`
        ], "append_rows");
      }
      const appended = await responsePayload(await appendRows(svc, user, {
        snapshot_id: item.snapshot_id,
        start_row_number: 1,
        rows: selection.selected
      }));
      if (appended.error) return blockItem(svc, run, item, [appended.error], "append_rows");
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: "rows_appended", step: "validate_snapshot", ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:validate_snapshot`, failure_message: "" });
      return { success: true, step: "rows_appended", created: appended.created, reused: appended.reused };
    }
    if (item.step === "validate_snapshot") {
      const finalized = await responsePayload(await finalizeSnapshot(svc, user, {
        snapshot_id: item.snapshot_id,
        require_siruta: true,
        limit: 50
      }));
      if (finalized.error) return blockItem(svc, run, item, [finalized.error], "validate_snapshot");
      if (finalized.remaining) {
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:validate_snapshot`, failure_message: "" });
        return { success: true, step: "validate_snapshot", remaining: true };
      }
      const snapshot = finalized.snapshot;
      const errors = [];
      if (snapshot.status !== "ready") errors.push(`snapshot_status:${snapshot.status}`);
      if (Number(snapshot.valid_rows || 0) !== Number(snapshot.total_rows || 0)) errors.push("not_all_rows_valid");
      if (Number(snapshot.blocked_rows || 0)) errors.push(`blocked_rows:${snapshot.blocked_rows}`);
      if (Number(snapshot.duplicate_rows || 0)) errors.push(`duplicate_rows:${snapshot.duplicate_rows}`);
      if (runCampaignMode(run) === CAMPAIGN_MODE_STRICT && Number(snapshot.warning_rows || 0)) errors.push(`warning_rows:${snapshot.warning_rows}`);
      if (errors.length) return blockItem(svc, run, item, errors, "validate_snapshot");
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: "validated", step: "plan_batch", ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:plan_batch`, failure_message: "" });
      return { success: true, step: "validated" };
    }
    if (item.step === "plan_batch") {
      const planned = await responsePayload(await planBatch(svc, user, { snapshot_id: item.snapshot_id, limit: 50 }));
      if (planned.error) return blockItem(svc, run, item, [planned.error], "plan_batch");
      if (planned.remaining) {
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:plan_batch`, failure_message: "" });
        return { success: true, step: "plan_batch", remaining: true };
      }
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: "planned", step: "inspect_batch", batch_id: planned.batch.id, ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:inspect_batch`, failure_message: "" });
      return { success: true, step: "planned", batch_id: planned.batch.id };
    }
    if (item.step === "inspect_batch") {
      const [snapshot, batch] = await Promise.all([
        getDirectoryEntityOrNull(svc.entities.DirectorySourceSnapshot.get(item.snapshot_id), "snapshotului automat pentru inspectie"),
        getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), "lotului automat pentru inspectie")
      ]);
      const safety = await inspectSafety(svc, snapshot, batch, run);
      if (!safety.safe) return blockItem(svc, run, item, safety.errors, "inspect_batch");
      const approved = await responsePayload(await approveBatch(svc, user, {
        batch_id: batch.id,
        confirmation: batchApprovalToken(batch.batch_key, batch.source_sha256, batch.ready_rows)
      }));
      if (approved.error) return blockItem(svc, run, item, [approved.error], "approve_batch");
      await svc.entities.DirectoryAutoImportItem.update(item.id, { status: "approved", step: "execute_batch", safety_result_json: JSON.stringify(safety), ...heartbeat });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:execute_batch`, failure_message: "" });
      return { success: true, step: "approved" };
    }
    if (item.step === "execute_batch") {
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), "lotului automat pentru executie");
      if (!batch) return blockItem(svc, run, item, ["batch_not_found"], "execute_batch");
      if (clean8(batch.failure_message, 1200)) {
        const recovered = await responsePayload(await resumeBatchAfterTransientFailure(svc, user, { batch_id: batch.id, limit: 1 }));
        if (recovered.error) {
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: recovered.error });
          return { success: false, retryable: true, error: recovered.error };
        }
        await svc.entities.DirectoryAutoImportItem.update(item.id, { status: "running", step: "execute_batch", ...heartbeat });
        await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:execute_batch`, failure_message: "" });
        return { success: true, step: "recovered_batch", recovered: recovered.recovered };
      }
      let executed;
      try {
        executed = await responsePayload(await executeBatch(svc, user, {
          batch_id: batch.id,
          lock_token: item.execution_lock_token || "",
          limit: EXECUTION_CHUNK2
        }));
      } catch (error) {
        if (isTransientDirectoryExecutionFailure(error) || isDirectoryReadFailure(error)) {
          await svc.entities.DirectoryAutoImportItem.update(item.id, {
            status: "running",
            step: "execute_batch",
            failure_message: clean8(error?.message || "Intrerupere temporara.", 1200),
            last_heartbeat_at: now2()
          });
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: clean8(error?.message || "Intrerupere temporara.", 1200) });
          return { success: false, retryable: true, error: error?.message || "Intrerupere temporara." };
        }
        throw error;
      }
      if (executed.error) {
        if (executed.retryable || executed.requires_resume) {
          await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:recover_batch`, failure_message: executed.error });
          return { success: false, retryable: true, error: executed.error };
        }
        return blockItem(svc, run, item, [executed.error], "execute_batch");
      }
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: "running",
        step: executed.remaining ? "execute_batch" : "verify_batch",
        execution_lock_token: executed.lock_token || "",
        applied_rows: Number(executed.totals?.applied_rows || 0),
        skipped_rows: Number(executed.totals?.skipped_rows || 0),
        failed_rows: Number(executed.totals?.failed_rows || 0),
        result_json: JSON.stringify(executed),
        failure_message: "",
        last_heartbeat_at: now2()
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:${executed.remaining ? "execute_batch" : "verify_batch"}`, failure_message: "" });
      return { success: true, step: executed.remaining ? "execute_batch" : "verify_batch", processed: executed.processed, remaining: executed.remaining };
    }
    if (item.step === "verify_batch") {
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), "lotului automat pentru verificarea finala");
      const errors = [];
      if (!batch || batch.status !== "completed") errors.push(`batch_status:${batch?.status || "missing"}`);
      if (Number(batch?.failed_rows || 0)) errors.push(`failed_rows:${batch?.failed_rows || 0}`);
      const national = runCampaignMode(run) === CAMPAIGN_MODE_NATIONAL;
      if (!national && Number(batch?.skipped_rows || 0)) errors.push(`skipped_rows:${batch?.skipped_rows || 0}`);
      if (national) {
        if (Number(batch?.applied_rows || 0) + Number(batch?.skipped_rows || 0) !== Number(batch?.ready_rows || 0)) errors.push("processed_rows_mismatch");
      } else if (Number(batch?.applied_rows || 0) !== Number(batch?.ready_rows || 0)) errors.push("applied_rows_mismatch");
      if (errors.length) return blockItem(svc, run, item, errors, "verify_batch");
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: "running",
        step: "publish_batch",
        applied_rows: Number(batch.applied_rows || 0),
        skipped_rows: Number(batch.skipped_rows || 0),
        failed_rows: 0,
        result_json: JSON.stringify({ batch_id: batch.id, status: batch.status, applied_rows: batch.applied_rows, skipped_rows: batch.skipped_rows }),
        failure_message: "",
        last_heartbeat_at: now2()
      });
      await releaseRunLock(svc, run.id, { current_step: `batch_${item.sequence}:publish_batch`, failure_message: "" });
      return { success: true, step: "publish_batch" };
    }
    if (item.step === "publish_batch") {
      const publication = await responsePayload(await publishCompletedBatchAsBasicDirectory(svc, user, { batch_id: item.batch_id }));
      if (publication.error) return blockItem(svc, run, item, [publication.error], "publish_batch");
      const batch = await getDirectoryEntityOrNull(svc.entities.DirectoryImportBatch.get(item.batch_id), "lotului automat dupa publicare");
      await svc.entities.DirectoryAutoImportItem.update(item.id, {
        status: "completed",
        step: "completed",
        applied_rows: Number(batch?.applied_rows || item.applied_rows || 0),
        skipped_rows: Number(batch?.skipped_rows || item.skipped_rows || 0),
        failed_rows: 0,
        result_json: JSON.stringify({
          batch_id: item.batch_id,
          status: batch?.status || "completed",
          applied_rows: Number(batch?.applied_rows || 0),
          skipped_rows: Number(batch?.skipped_rows || 0),
          publication
        }),
        failure_message: "",
        finished_at: now2(),
        last_heartbeat_at: now2()
      });
      const latestRun = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(run.id), "rularii automate dupa publicarea lotului") || run;
      const refreshed = await refreshProgress(svc, latestRun);
      await releaseRunLock(svc, run.id, {
        status: refreshed.completed ? "completed" : "running",
        current_step: refreshed.completed ? "completed" : `batch_${refreshed.nextItem?.sequence || item.sequence + 1}:fetch_source`,
        finished_at: refreshed.completed ? now2() : null,
        failure_message: ""
      });
      return { success: true, step: "completed", publication, run_completed: refreshed.completed };
    }
    return blockItem(svc, run, item, [`unknown_step:${item.step}`], "unknown_step");
  } catch (error) {
    if (isTransientDirectoryExecutionFailure(error) || isDirectoryReadFailure(error)) {
      await releaseRunLock(svc, run.id, { status: "running", current_step: run.current_step || "retry_scheduled", failure_message: clean8(error?.message || "Intrerupere temporara.", 1200) });
      return { success: false, retryable: true, error: error?.message || "Intrerupere temporara." };
    }
    await releaseRunLock(svc, run.id, { status: "failed", current_step: "failed", failure_message: clean8(error?.message || "Rularea automata a esuat.", 1200) });
    return { success: false, error: error?.message || "Rularea automata a esuat." };
  }
}
async function advanceRuns(svc, input = {}) {
  const runId = clean8(input.run_id, 120);
  let runs = [];
  if (runId) {
    const run = await getDirectoryEntityOrNull(svc.entities.DirectoryAutoImportRun.get(runId), "rularii automate pentru avansare");
    if (run) runs = [run];
  } else {
    const approved = await requireDirectoryRows(svc.entities.DirectoryAutoImportRun.filter({ status: "approved" }, "created_date", 10), "rularilor automate aprobate");
    const running = await requireDirectoryRows(svc.entities.DirectoryAutoImportRun.filter({ status: "running" }, "created_date", 10), "rularilor automate in curs");
    runs = [...approved, ...running].sort((left, right) => String(left.created_date || "").localeCompare(String(right.created_date || ""))).slice(0, 1);
    if (!runs.length) {
      const completed = await requireDirectoryRows(
        svc.entities.DirectoryAutoImportRun.filter({ status: "completed" }, "-finished_at", 10),
        "rularilor finalizate pentru reconcilierea publicarii"
      );
      for (const candidate of completed) {
        const items = await requireDirectoryRows(
          svc.entities.DirectoryAutoImportItem.filter({ run_id: candidate.id }, "sequence", 100),
          "loturilor finalizate pentru reconcilierea publicarii"
        );
        const missingPublication = items.some((item) => item.status === "completed" && clean8(item.batch_id, 160) && safeJson2(item.result_json, {}).publication?.success !== true);
        if (missingPublication) {
          runs = [candidate];
          break;
        }
      }
    }
  }
  if (!runs.length) return response2({ success: true, processed_runs: 0, message: "Nu exista rulare automata aprobata." });
  const outcomes = [];
  for (const initialRun of runs) {
    let run = initialRun;
    const initialSequence = Number(run.current_sequence || 1);
    for (let stepIndex = 0; stepIndex < 18; stepIndex += 1) {
      const outcome = await advanceRun(svc, run);
      outcomes.push(outcome);
      if (outcome?.blocked || outcome?.retryable || outcome?.completed || outcome?.run_completed || outcome?.error) break;
      if (["execute_batch", "recovered_batch"].includes(outcome?.step)) {
        await pause(3500);
      }
      const refreshed = await getDirectoryEntityOrNull(
        svc.entities.DirectoryAutoImportRun.get(run.id),
        "rularii automate intre pasii aceleiasi executii"
      );
      if (!refreshed || !["approved", "running", "completed"].includes(refreshed.status)) break;
      run = refreshed;
      if (Number(run.current_sequence || initialSequence) > initialSequence) break;
    }
  }
  return response2({ success: true, processed_runs: runs.length, processed_steps: outcomes.length, outcomes });
}
async function handleDirectoryAutoImport(req) {
  try {
    const input = await req.clone().json().catch(() => ({}));
    const action = clean8(input.action, 100);
    const base44 = createClientFromRequest2(req);
    if (action === "advance_auto_import_runs" && input.__automation_trigger === true) {
      return advanceRuns(base44.asServiceRole, input);
    }
    const auth = await requireAdmin2(base44);
    if (auth.error) return auth.error;
    const { user, svc } = auth;
    if (action === "list_auto_import_runs") return listRuns(svc, input);
    if (action === "create_auto_import_run") return createRun(svc, user, input);
    if (action === "approve_auto_import_run") return approveRun(svc, user, input);
    if (action === "pause_auto_import_run") return changeRunStatus(svc, user, input, "paused");
    if (action === "resume_auto_import_run") return changeRunStatus(svc, user, input, "approved");
    if (action === "cancel_auto_import_run") return changeRunStatus(svc, user, input, "cancelled");
    if (action === "advance_auto_import_run_now") return advanceRuns(svc, { run_id: input.run_id });
    return response2({ error: "Actiune automata necunoscuta." }, 400);
  } catch (error) {
    const retryable = isDirectoryReadFailure(error) || isTransientDirectoryExecutionFailure(error);
    return response2({ error: error?.message || "Eroare in orchestratorul automat.", retryable }, retryable ? 503 : 500);
  }
}

// base44/functions/directoryOps/directoryImportOpsLatest.ts
var DIRECTORY_IMPORT_RUNTIME_REVISION2 = "directory-import-runtime-national-directory-4";
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
      chunked_batch_planning: true,
      reconciles_existing_location_metadata: true,
      reconciles_directory_state: true,
      reconciles_directory_evidence: true,
      preserves_directory_publication_state: true,
      preserves_existing_optional_fields: true,
      fails_closed_on_directory_read_errors: true,
      supports_automated_controlled_import: true,
      automated_import_contract_version: "viasee-directory-auto-import-v2",
      automated_import_schedule_minutes: 5,
      automated_controlled_import_orchestrator: true,
      scheduled_auto_import_runner: true,
      max_automatic_execution_chunk: 5,
      supports_private_zip_upload: true,
      persists_approved_source_subset: true,
      uses_chunked_private_payload_storage: true,
      repairs_partial_preflight_runs: true,
      supports_national_directory_campaign: true,
      supports_private_master_json: true,
      excludes_ambiguous_live_matches: true,
      publishes_unclaimed_unverified_directory_profiles: true,
      excludes_controlled_profiles_from_national_import: true,
      publishes_basic_directory_details_only_when_quality_allows: true,
      preserves_top_three_isolation: true
    });
  }
  if (String(input?.action || "").startsWith("auto_") || input?.action === "advance_auto_import_runs" || input?.action === "list_auto_import_runs" || input?.action === "create_auto_import_run" || input?.action === "approve_auto_import_run" || input?.action === "pause_auto_import_run" || input?.action === "resume_auto_import_run" || input?.action === "cancel_auto_import_run" || input?.action === "advance_auto_import_run_now") {
    return handleDirectoryAutoImport(req);
  }
  return handle2(req);
}

// scripts/bridge-sources/listProviderMemberInvitations.entry.ts
var ROLES = ["organization_owner", "location_manager", "location_staff"];
var DIRECTORY_IMPORT_LOGICAL_NAME = "directoryImportOps";
var DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN = "viasee-auto-7f4d83b1-4d38-45aa-b558-9c20cf63c6c2";
var FUNCTION_DEPLOY_REVISION = "viasee-directory-import-single-file-14";
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
    const base44 = createClientFromRequest3(req);
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
  if (body?.args?.action === "advance_auto_import_runs" && body?.args?.automation_token === DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN) {
    return handle3(routedRequest(req, {
      action: "advance_auto_import_runs",
      __automation_trigger: true
    }));
  }
  if (body?.__function === DIRECTORY_IMPORT_LOGICAL_NAME) {
    return handle3(routedRequest(req, body.payload));
  }
  return handleInvitationList(req);
});
