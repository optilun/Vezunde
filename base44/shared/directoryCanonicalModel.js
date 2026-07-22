export const DIRECTORY_CONTROL_STATUS = Object.freeze({
  DIRECTORY: 'directory',
  CLAIMED: 'claimed',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
});

export const DIRECTORY_PUBLICATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
  ARCHIVED: 'archived',
});

export const DIRECTORY_OPERATIONAL_STATUS = Object.freeze({
  ACTIVE: 'active',
  TEMPORARILY_CLOSED: 'temporarily_closed',
  CLOSED: 'closed',
  UNKNOWN: 'unknown',
});

export const DIRECTORY_DATA_QUALITY_STATUS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  CONFLICT: 'conflict',
});

export const DIRECTORY_DETAIL_LEVEL = Object.freeze({
  SUMMARY: 'summary',
  BASIC: 'basic',
  FULL: 'full',
});

export const ORGANIZATION_LINK_STATUS = Object.freeze({
  CONFIRMED: 'confirmed',
  PROBABLE: 'probable',
  CONFLICT: 'conflict',
  REJECTED: 'rejected',
  UNASSIGNED: 'unassigned',
});

export const DIRECTORY_LOCATION_TYPE = Object.freeze({
  OPTICAL_STORE: 'optical_store',
  OPTOMETRY_OFFICE: 'optometry_office',
  OPHTHALMOLOGY_OFFICE: 'ophthalmology_office',
  OPHTHALMOLOGY_CLINIC: 'ophthalmology_clinic',
  MULTI_SPECIALTY_CLINIC: 'multi_specialty_clinic',
  HOSPITAL_DEPARTMENT: 'hospital_department',
  HOSPITAL_OUTPATIENT_UNIT: 'hospital_outpatient_unit',
  OPTICAL_LABORATORY: 'optical_laboratory',
  INDEPENDENT_PROFESSIONAL_OFFICE: 'independent_professional_office',
  OTHER: 'other',
});

export const DIRECTORY_CARE_SETTING = Object.freeze({
  RETAIL: 'retail',
  OUTPATIENT: 'outpatient',
  HOSPITAL_OUTPATIENT: 'hospital_outpatient',
  HOSPITAL_INPATIENT: 'hospital_inpatient',
  MIXED: 'mixed',
  LABORATORY: 'laboratory',
  OTHER: 'other',
});

export const DIRECTORY_OWNERSHIP_TYPE = Object.freeze({
  PRIVATE: 'private',
  PUBLIC: 'public',
  NONPROFIT: 'nonprofit',
  UNKNOWN: 'unknown',
});

const CONTROL_VALUES = new Set(Object.values(DIRECTORY_CONTROL_STATUS));
const PUBLICATION_VALUES = new Set(Object.values(DIRECTORY_PUBLICATION_STATUS));
const OPERATIONAL_VALUES = new Set(Object.values(DIRECTORY_OPERATIONAL_STATUS));
const DATA_QUALITY_VALUES = new Set(Object.values(DIRECTORY_DATA_QUALITY_STATUS));
const DETAIL_VALUES = new Set(Object.values(DIRECTORY_DETAIL_LEVEL));
const ORGANIZATION_LINK_VALUES = new Set(Object.values(ORGANIZATION_LINK_STATUS));
const LOCATION_TYPE_VALUES = new Set(Object.values(DIRECTORY_LOCATION_TYPE));
const CARE_SETTING_VALUES = new Set(Object.values(DIRECTORY_CARE_SETTING));
const OWNERSHIP_VALUES = new Set(Object.values(DIRECTORY_OWNERSHIP_TYPE));

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

function enumValue(value, allowedValues) {
  const normalized = clean(value);
  return allowedValues.has(normalized) ? normalized : null;
}

function hasVerificationEvidence(record = {}) {
  return clean(record.claim_verification_status) === 'approved'
    || Boolean(String(record.last_verified_at || '').trim());
}

export function deriveCanonicalControlStatus(record = {}) {
  const explicit = enumValue(record.control_status, CONTROL_VALUES);
  const configured = enumValue(record.profile_control_status, CONTROL_VALUES);
  const verificationState = clean(record.verification_state);
  const recordStatus = clean(record.status);
  const activeStatus = clean(record.active_status);

  if (
    explicit === DIRECTORY_CONTROL_STATUS.SUSPENDED
    || configured === DIRECTORY_CONTROL_STATUS.SUSPENDED
    || verificationState === DIRECTORY_CONTROL_STATUS.SUSPENDED
    || recordStatus === 'suspendata'
  ) return DIRECTORY_CONTROL_STATUS.SUSPENDED;

  if (explicit === DIRECTORY_CONTROL_STATUS.VERIFIED) return DIRECTORY_CONTROL_STATUS.VERIFIED;

  const legacyVerified = configured === DIRECTORY_CONTROL_STATUS.VERIFIED
    && verificationState === DIRECTORY_CONTROL_STATUS.VERIFIED
    && record.is_verified === true
    && hasVerificationEvidence(record);
  if (legacyVerified) return DIRECTORY_CONTROL_STATUS.VERIFIED;

  if (explicit === DIRECTORY_CONTROL_STATUS.CLAIMED) return DIRECTORY_CONTROL_STATUS.CLAIMED;

  const claimStatus = clean(record.claim_verification_status);
  const providerAdministered = configured === DIRECTORY_CONTROL_STATUS.CLAIMED
    || ['pending', 'approved'].includes(claimStatus)
    || ['in_verification', 'verified'].includes(verificationState)
    || clean(record.data_source) === 'claim';

  if (providerAdministered) return DIRECTORY_CONTROL_STATUS.CLAIMED;
  if (activeStatus === 'inactiva' && configured === DIRECTORY_CONTROL_STATUS.SUSPENDED) return DIRECTORY_CONTROL_STATUS.SUSPENDED;
  return DIRECTORY_CONTROL_STATUS.DIRECTORY;
}

export function deriveCanonicalPublicationStatus(record = {}) {
  const explicit = enumValue(record.publication_status, PUBLICATION_VALUES);
  if (explicit) return explicit;

  const legacyVisibility = clean(record.public_visibility_status);
  const legacyStatus = clean(record.status);

  if (legacyVisibility === 'archived') return DIRECTORY_PUBLICATION_STATUS.ARCHIVED;
  if (['rejected', 'needs_more_info'].includes(legacyVisibility) || legacyStatus === 'suspendata') {
    return DIRECTORY_PUBLICATION_STATUS.HIDDEN;
  }
  if (legacyVisibility === 'approved' || legacyStatus === 'publicata') {
    return DIRECTORY_PUBLICATION_STATUS.PUBLISHED;
  }
  return DIRECTORY_PUBLICATION_STATUS.DRAFT;
}

export function deriveCanonicalOperationalStatus(record = {}) {
  const explicit = enumValue(record.operational_status, OPERATIONAL_VALUES);
  if (explicit) return explicit;

  const legacyActiveStatus = clean(record.active_status);
  if (legacyActiveStatus === 'activa') return DIRECTORY_OPERATIONAL_STATUS.ACTIVE;
  if (legacyActiveStatus === 'inactiva') return DIRECTORY_OPERATIONAL_STATUS.CLOSED;
  return DIRECTORY_OPERATIONAL_STATUS.UNKNOWN;
}

export function deriveCanonicalDataQualityStatus(record = {}) {
  const explicit = enumValue(record.data_quality_status, DATA_QUALITY_VALUES);
  if (explicit) return explicit;

  const reviewFlags = `${record.review_flags || ''} ${record.research_notes || ''} ${record.source_notes || ''}`.toUpperCase();
  if (reviewFlags.includes('CONFLICT')) return DIRECTORY_DATA_QUALITY_STATUS.CONFLICT;

  const legacyConfidence = enumValue(record.data_confidence, DATA_QUALITY_VALUES);
  if (legacyConfidence) return legacyConfidence;

  const controlStatus = deriveCanonicalControlStatus(record);
  if (controlStatus === DIRECTORY_CONTROL_STATUS.VERIFIED) return DIRECTORY_DATA_QUALITY_STATUS.HIGH;
  if (controlStatus === DIRECTORY_CONTROL_STATUS.CLAIMED) return DIRECTORY_DATA_QUALITY_STATUS.MEDIUM;
  return DIRECTORY_DATA_QUALITY_STATUS.LOW;
}

export function deriveCanonicalOrganizationLinkStatus(record = {}) {
  const explicit = enumValue(record.organization_link_status, ORGANIZATION_LINK_VALUES);
  if (explicit) return explicit;
  return record.organization_id ? ORGANIZATION_LINK_STATUS.PROBABLE : ORGANIZATION_LINK_STATUS.UNASSIGNED;
}

export function deriveCanonicalLocationType(record = {}) {
  const explicit = enumValue(record.location_type_code, LOCATION_TYPE_VALUES);
  if (explicit) return explicit;

  const profileType = clean(record.provider_profile_type);
  const providerType = clean(record.provider_type);

  if (['independent_optical_store', 'optical_chain'].includes(profileType) || providerType === 'optica_medicala') {
    return DIRECTORY_LOCATION_TYPE.OPTICAL_STORE;
  }
  if (profileType === 'ophthalmology_clinic' || providerType === 'clinica_oftalmologica') {
    return DIRECTORY_LOCATION_TYPE.OPHTHALMOLOGY_CLINIC;
  }
  if (profileType === 'ophthalmology_office' || providerType === 'cabinet_oftalmologic') {
    return DIRECTORY_LOCATION_TYPE.OPHTHALMOLOGY_OFFICE;
  }
  if (providerType === 'cabinet_optometric') return DIRECTORY_LOCATION_TYPE.OPTOMETRY_OFFICE;
  if (['optical_laboratory_b2c', 'optical_laboratory_b2b'].includes(profileType) || providerType === 'laborator_optic') {
    return DIRECTORY_LOCATION_TYPE.OPTICAL_LABORATORY;
  }
  if (profileType.startsWith('independent_') || providerType.endsWith('_independent')) {
    return DIRECTORY_LOCATION_TYPE.INDEPENDENT_PROFESSIONAL_OFFICE;
  }
  return DIRECTORY_LOCATION_TYPE.OTHER;
}

export function deriveCanonicalCareSetting(record = {}) {
  const explicit = enumValue(record.care_setting_code, CARE_SETTING_VALUES);
  if (explicit) return explicit;

  const locationType = deriveCanonicalLocationType(record);
  if (locationType === DIRECTORY_LOCATION_TYPE.OPTICAL_STORE) return DIRECTORY_CARE_SETTING.RETAIL;
  if (locationType === DIRECTORY_LOCATION_TYPE.OPTICAL_LABORATORY) return DIRECTORY_CARE_SETTING.LABORATORY;
  if ([DIRECTORY_LOCATION_TYPE.OPHTHALMOLOGY_CLINIC, DIRECTORY_LOCATION_TYPE.OPHTHALMOLOGY_OFFICE, DIRECTORY_LOCATION_TYPE.OPTOMETRY_OFFICE].includes(locationType)) {
    return DIRECTORY_CARE_SETTING.OUTPATIENT;
  }
  if (locationType === DIRECTORY_LOCATION_TYPE.HOSPITAL_OUTPATIENT_UNIT) return DIRECTORY_CARE_SETTING.HOSPITAL_OUTPATIENT;
  if (locationType === DIRECTORY_LOCATION_TYPE.HOSPITAL_DEPARTMENT) return DIRECTORY_CARE_SETTING.HOSPITAL_INPATIENT;
  return DIRECTORY_CARE_SETTING.OTHER;
}

export function deriveCanonicalOwnershipType(record = {}) {
  const explicit = enumValue(record.ownership_type_code, OWNERSHIP_VALUES);
  if (explicit) return explicit;
  return DIRECTORY_OWNERSHIP_TYPE.UNKNOWN;
}

export function deriveCanonicalDetailLevel(record = {}, controlOverride = null, qualityOverride = null) {
  const explicit = enumValue(record.directory_detail_level, DETAIL_VALUES);
  const controlStatus = controlOverride || deriveCanonicalControlStatus(record);
  const dataQualityStatus = qualityOverride || deriveCanonicalDataQualityStatus(record);

  if (controlStatus === DIRECTORY_CONTROL_STATUS.SUSPENDED) return DIRECTORY_DETAIL_LEVEL.SUMMARY;
  if ([DIRECTORY_CONTROL_STATUS.CLAIMED, DIRECTORY_CONTROL_STATUS.VERIFIED].includes(controlStatus)) {
    return DIRECTORY_DETAIL_LEVEL.FULL;
  }

  if (
    explicit === DIRECTORY_DETAIL_LEVEL.BASIC
    && record.directory_basic_details_approved === true
    && [DIRECTORY_DATA_QUALITY_STATUS.HIGH, DIRECTORY_DATA_QUALITY_STATUS.MEDIUM].includes(dataQualityStatus)
  ) return DIRECTORY_DETAIL_LEVEL.BASIC;

  return DIRECTORY_DETAIL_LEVEL.SUMMARY;
}

export function deriveCanonicalDirectoryState(record = {}) {
  const controlStatus = deriveCanonicalControlStatus(record);
  const publicationStatus = deriveCanonicalPublicationStatus(record);
  const operationalStatus = deriveCanonicalOperationalStatus(record);
  const dataQualityStatus = deriveCanonicalDataQualityStatus(record);
  const publicDetailLevel = deriveCanonicalDetailLevel(record, controlStatus, dataQualityStatus);

  return {
    control_status: controlStatus,
    publication_status: publicationStatus,
    operational_status: operationalStatus,
    data_quality_status: dataQualityStatus,
    directory_detail_level: publicDetailLevel,
    organization_link_status: deriveCanonicalOrganizationLinkStatus(record),
    location_type_code: deriveCanonicalLocationType(record),
    care_setting_code: deriveCanonicalCareSetting(record),
    ownership_type_code: deriveCanonicalOwnershipType(record),
    is_publicly_available: publicationStatus === DIRECTORY_PUBLICATION_STATUS.PUBLISHED
      && operationalStatus === DIRECTORY_OPERATIONAL_STATUS.ACTIVE
      && controlStatus !== DIRECTORY_CONTROL_STATUS.SUSPENDED,
  };
}

export function directorySourceCheckedAt(record = {}) {
  return record.source_checked_at || record.last_confirmed_at || record.last_verified_at || null;
}
