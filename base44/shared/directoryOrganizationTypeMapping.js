export const LEGACY_PROVIDER_ORGANIZATION_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
  'optical_laboratory_b2b',
  'future_b2b_distributor',
]);

export const DIRECTORY_ORGANIZATION_TYPE_CODES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'healthcare_network',
  'multi_specialty_healthcare_provider',
  'public_healthcare_institution',
  'independent_professional',
  'optical_laboratory',
  'b2b_distributor',
  'other',
]);

const DIRECT_LEGACY_TYPE_BY_CODE = Object.freeze({
  independent_optical_store: 'independent_optical_store',
  optical_chain: 'optical_chain',
  ophthalmology_clinic: 'ophthalmology_clinic',
  ophthalmology_office: 'ophthalmology_office',
  healthcare_network: 'ophthalmology_clinic',
  multi_specialty_healthcare_provider: 'ophthalmology_clinic',
  public_healthcare_institution: 'ophthalmology_clinic',
  b2b_distributor: 'future_b2b_distributor',
});

const INDEPENDENT_PROFESSIONAL_LEGACY_TYPES = new Set([
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
]);

const OPTICAL_LABORATORY_LEGACY_TYPES = new Set([
  'optical_laboratory_b2c',
  'optical_laboratory_b2b',
]);

function cleanType(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function isDirectoryOrganizationTypeCode(value) {
  return DIRECTORY_ORGANIZATION_TYPE_CODES.has(cleanType(value));
}

const CODE_BY_LEGACY_TYPE = Object.freeze({
  independent_optical_store: 'independent_optical_store',
  optical_chain: 'optical_chain',
  ophthalmology_clinic: 'ophthalmology_clinic',
  ophthalmology_office: 'ophthalmology_office',
  independent_ophthalmologist: 'independent_professional',
  independent_optometrist: 'independent_professional',
  independent_optician: 'independent_professional',
  optical_laboratory_b2c: 'optical_laboratory',
  optical_laboratory_b2b: 'optical_laboratory',
  future_b2b_distributor: 'b2b_distributor',
});

export function legacyTypeToOrganizationTypeCode(legacyType) {
  return CODE_BY_LEGACY_TYPE[cleanType(legacyType)] || '';
}

export function resolveProviderOrganizationType(row = {}) {
  const organizationTypeCode = cleanType(row.organization_type_code);
  const providerProfileType = cleanType(row.provider_profile_type);

  if (!organizationTypeCode) {
    return {
      valid: false,
      organization_type_code: '',
      organization_type: '',
      error_code: 'organization_type_not_resolved',
    };
  }

  if (!DIRECTORY_ORGANIZATION_TYPE_CODES.has(organizationTypeCode)) {
    return {
      valid: false,
      organization_type_code: organizationTypeCode,
      organization_type: '',
      error_code: 'invalid_explicit_organization_type',
    };
  }

  let legacyOrganizationType = DIRECT_LEGACY_TYPE_BY_CODE[organizationTypeCode] || '';
  if (
    organizationTypeCode === 'independent_professional'
    && INDEPENDENT_PROFESSIONAL_LEGACY_TYPES.has(providerProfileType)
  ) {
    legacyOrganizationType = providerProfileType;
  }
  if (
    organizationTypeCode === 'optical_laboratory'
    && OPTICAL_LABORATORY_LEGACY_TYPES.has(providerProfileType)
  ) {
    legacyOrganizationType = providerProfileType;
  }

  if (!LEGACY_PROVIDER_ORGANIZATION_TYPES.has(legacyOrganizationType)) {
    return {
      valid: false,
      organization_type_code: organizationTypeCode,
      organization_type: '',
      error_code: 'organization_type_legacy_mapping_not_resolved',
    };
  }

  return {
    valid: true,
    organization_type_code: organizationTypeCode,
    organization_type: legacyOrganizationType,
    error_code: '',
  };
}