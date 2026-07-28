export const DIRECTORY_IMPORT_CONTRACT_VERSION = "viasee-directory-import-v1";
export const DIRECTORY_CLASSIFICATION_CONTRACT_VERSION = "viasee-directory-location-first-v1";
export const DIRECTORY_IMPORT_MAX_CHUNK_SIZE = 100;

export const DIRECTORY_SOURCE_FORMATS = ["json", "ndjson", "csv", "markdown"];
export const DIRECTORY_SNAPSHOT_STATUSES = [
  "draft",
  "uploading",
  "validating",
  "ready",
  "blocked",
  "imported",
  "archived",
];
export const DIRECTORY_BATCH_STATUSES = [
  "draft",
  "planning",
  "ready",
  "approved",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "rolling_back",
  "rolled_back",
  "rollback_failed",
];
export const DIRECTORY_ROW_STATUSES = [
  "raw",
  "valid",
  "blocked",
  "ready",
  "applied",
  "skipped",
  "failed",
  "rolled_back",
];

export const DIRECTORY_PLANNED_ACTIONS = [
  "create_organization_and_location",
  "create_location_use_existing_organization",
  "create_location_without_organization",
  "update_existing_location",
  "link_existing_location",
  "skip_unchanged",
  "skip_duplicate",
  "block_conflict",
  "reject_invalid",
];

const FIELD_ALIASES = {
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
  ownership_type_code: ["ownership_type_code"],
};

const PROVIDER_TYPES = new Set([
  "optica_medicala",
  "clinica_oftalmologica",
  "cabinet_oftalmologic",
  "cabinet_optometric",
  "laborator_optic",
  "optometrist_independent",
  "medic_oftalmolog_independent",
]);

// Legacy compatibility field required by ProviderLocation. Canonical location identity
// is location_type_code; network/brand identity belongs to organization_type_code.
const PROVIDER_PROFILE_TYPES = new Set([
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

const ORGANIZATION_TYPE_CODES = new Set([
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
  "other",
]);

const LOCATION_TYPE_CODES = new Set([
  "optical_store",
  "optometry_office",
  "ophthalmology_office",
  "ophthalmology_clinic",
  "multi_specialty_clinic",
  "hospital_department",
  "hospital_outpatient_unit",
  "optical_laboratory",
  "independent_professional_office",
  "other",
]);

const CARE_SETTING_CODES = new Set([
  "retail",
  "outpatient",
  "hospital_outpatient",
  "hospital_inpatient",
  "mixed",
  "laboratory",
  "other",
]);

const OWNERSHIP_TYPE_CODES = new Set(["private", "public", "nonprofit", "unknown"]);

function clean(value, maxLength = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeIdentityText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableTextHash(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function firstValue(raw, aliases) {
  for (const alias of aliases) {
    const value = raw?.[alias];
    if (value !== undefined && value !== null && clean(value)) return clean(value);
  }
  return "";
}

function canonicalFields(raw = {}) {
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([key, aliases]) => [key, firstValue(raw, aliases)]),
  );
}

function explicitCanonicalType(fields) {
  const hasAnyExplicitType = Boolean(
    fields.provider_type
    || fields.provider_profile_type
    || fields.location_type_code
    || fields.care_setting_code,
  );
  if (!hasAnyExplicitType) return null;

  const complete = PROVIDER_TYPES.has(fields.provider_type)
    && PROVIDER_PROFILE_TYPES.has(fields.provider_profile_type)
    && LOCATION_TYPE_CODES.has(fields.location_type_code)
    && CARE_SETTING_CODES.has(fields.care_setting_code);

  if (!complete) return {
    invalid: true,
    provider_type: "",
    provider_profile_type: "",
    location_type_code: "",
    care_setting_code: "",
  };

  return {
    invalid: false,
    provider_type: fields.provider_type,
    provider_profile_type: fields.provider_profile_type,
    location_type_code: fields.location_type_code,
    care_setting_code: fields.care_setting_code,
  };
}

function resolveOrganizationType(fields, locationType) {
  if (fields.organization_type_code) {
    return {
      organization_type_code: ORGANIZATION_TYPE_CODES.has(fields.organization_type_code)
        ? fields.organization_type_code
        : "",
      organization_type_source: "source_explicit",
      organization_type_invalid: !ORGANIZATION_TYPE_CODES.has(fields.organization_type_code),
      organization_type_legacy_fallback: false,
    };
  }

  const legacyProfile = locationType?.provider_profile_type || "";
  return {
    organization_type_code: ORGANIZATION_TYPE_CODES.has(legacyProfile) ? legacyProfile : "",
    organization_type_source: legacyProfile ? "legacy_profile_fallback" : "unresolved",
    organization_type_invalid: false,
    organization_type_legacy_fallback: Boolean(legacyProfile),
  };
}

export function normalizeAddressForFingerprint(value) {
  return normalizeIdentityText(value)
    .replace(/\b(strada|str|bulevardul|bulevard|bd|calea|sos|soseaua|piata|p-ta)\b/g, " ")
    .replace(/\b(numarul|numar|nr)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferCanonicalLocationType(activityCategory = "") {
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
  // An optical store may offer optometry. The physical retail identity remains
  // optical_store; optometry is represented later as a service/capability.
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
  if (name === "organizatie" || /^(locatii|locatii deja|acoperire|retea|network|total)/.test(name)) return "aggregate_or_summary_row";
  if (/^~?\d+\+?$/.test(locality)) return "aggregate_count_row";
  if (/^~?\d+\+?$/.test(clean(fields.location_name))) return "aggregate_count_row";
  if (!address && /\b(locatii|puncte|sedii)\b/.test(name)) return "aggregate_without_address";
  return "";
}

export function normalizeDirectoryImportRow(raw = {}, context = {}) {
  const fields = canonicalFields(raw);
  const explicitType = explicitCanonicalType(fields);
  const inferredType = explicitType || inferCanonicalLocationType(fields.activity_category);
  const organizationType = resolveOrganizationType(fields, inferredType);
  const localityKey = normalizeIdentityText(fields.locality_name);
  const addressKey = normalizeAddressForFingerprint(fields.address);
  const organizationKey = fields.organization_external_key || (
    fields.organization_name
      ? `org:${stableTextHash(normalizeIdentityText(fields.organization_name))}`
      : ""
  );
  const locationKey = fields.location_external_key || (
    fields.location_name && localityKey && addressKey
      ? `loc:${stableTextHash([localityKey, addressKey, normalizeIdentityText(fields.location_name)].join("|"))}`
      : ""
  );
  const addressFingerprint = localityKey && addressKey
    ? `addr:${stableTextHash([fields.locality_siruta_code || localityKey, addressKey].join("|"))}`
    : "";

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
    canonical_type_source: explicitType ? "source_explicit" : (inferredType ? "activity_inferred" : "unresolved"),
    canonical_type_invalid: Boolean(explicitType?.invalid),
    organization_type_source: organizationType.organization_type_source,
    organization_type_invalid: organizationType.organization_type_invalid,
    organization_type_legacy_fallback: organizationType.organization_type_legacy_fallback,
  };
}

export function validateNormalizedDirectoryRow(row = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const sourceEligible = !["excluded", "not_eligible"].includes(row.research_status)
    && row.import_readiness !== "not_eligible";

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
    validation_codes: [...errors, ...warnings],
  };
}

export function batchApprovalToken(batchKey, sourceSha256, readyRows) {
  return `IMPORT ${clean(batchKey, 120)} ${clean(sourceSha256, 80).slice(0, 12)} ${Number(readyRows || 0)}`;
}

export function rollbackApprovalToken(batchKey, appliedRows) {
  return `ROLLBACK ${clean(batchKey, 120)} ${Number(appliedRows || 0)}`;
}

export function rowIdempotencyKey(snapshotKey, sourceRowKey, rowHash) {
  return `row:${stableTextHash([snapshotKey, sourceRowKey, rowHash].join("|"))}`;
}
