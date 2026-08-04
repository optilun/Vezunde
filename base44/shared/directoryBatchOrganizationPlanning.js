import { normalizeIdentityText } from './directoryImportPipeline.js';
import { legacyTypeToOrganizationTypeCode, resolveProviderOrganizationType } from './directoryOrganizationTypeMapping.js';

function clean(value, maxLength = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function directoryBatchOrganizationDescriptor(row = {}) {
  const organizationName = clean(row.organization_name, 240);
  const organizationExternalKey = clean(row.organization_external_key, 240);
  const normalizedName = normalizeIdentityText(organizationName);
  const typeResolution = resolveProviderOrganizationType(row);
  const groupKey = organizationExternalKey
    ? `external:${organizationExternalKey}`
    : (normalizedName ? `name:${normalizedName}` : '');
  if (!groupKey) {
    return {
      valid: false,
      error_code: 'organization_identity_not_resolved',
      group_key: '',
      organization_name_normalized: normalizedName,
      organization_external_key: organizationExternalKey,
      organization_type_code: typeResolution.organization_type_code || '',
      organization_type: typeResolution.organization_type || '',
    };
  }
  if (!typeResolution.valid) {
    return {
      valid: false,
      error_code: typeResolution.error_code,
      group_key: groupKey,
      organization_name_normalized: normalizedName,
      organization_external_key: organizationExternalKey,
      organization_type_code: typeResolution.organization_type_code || '',
      organization_type: typeResolution.organization_type || '',
    };
  }
  return {
    valid: true,
    error_code: '',
    group_key: groupKey,
    organization_name_normalized: normalizedName,
    organization_external_key: organizationExternalKey,
    organization_type_code: typeResolution.organization_type_code,
    organization_type: typeResolution.organization_type,
  };
}

export function validateDirectoryBatchOrganizationCompatibility(current, incoming) {
  if (!current?.valid) return { valid: false, error_code: current?.error_code || 'organization_identity_not_resolved' };
  if (!incoming?.valid) return { valid: false, error_code: incoming?.error_code || 'organization_identity_not_resolved' };
  if (current.group_key !== incoming.group_key) {
    return { valid: false, error_code: 'batch_organization_group_key_conflict' };
  }
  if (current.organization_name_normalized !== incoming.organization_name_normalized) {
    return { valid: false, error_code: 'batch_organization_name_conflict' };
  }
  if (current.organization_external_key !== incoming.organization_external_key) {
    return { valid: false, error_code: 'batch_organization_external_key_conflict' };
  }
  if (
    current.organization_type_code !== incoming.organization_type_code
    || current.organization_type !== incoming.organization_type
  ) {
    return { valid: false, error_code: 'batch_organization_type_conflict' };
  }
  return { valid: true, error_code: '' };
}

export function validateExplicitDirectoryOrganizationTarget(organization = {}, row = {}) {
  const descriptor = directoryBatchOrganizationDescriptor(row);
  if (!descriptor.valid) return { valid: false, error_code: descriptor.error_code, descriptor };
  const organizationId = clean(organization.id, 160);
  if (!organizationId) {
    return { valid: false, error_code: 'admin_target_organization_not_found', descriptor };
  }
  const existingExternalKey = clean(organization.directory_external_key, 240);
  if (
    existingExternalKey
    && descriptor.organization_external_key
    && existingExternalKey !== descriptor.organization_external_key
  ) {
    return { valid: false, error_code: 'admin_target_organization_external_key_conflict', descriptor };
  }
  const existingLegacyType = clean(organization.organization_type, 120);
  if (existingLegacyType && existingLegacyType !== descriptor.organization_type) {
    const existingTypeCode = legacyTypeToOrganizationTypeCode(existingLegacyType);
    return {
      valid: true,
      error_code: '',
      descriptor: {
        ...descriptor,
        organization_type: existingLegacyType,
        organization_type_code: existingTypeCode || descriptor.organization_type_code,
      },
      organization_id: organizationId,
      preserves_controlled_organization: true,
    };
  }
  return {
    valid: true,
    error_code: '',
    descriptor,
    organization_id: organizationId,
    preserves_controlled_organization: true,
  };
}