import { resolveProviderOrganizationType } from './directoryOrganizationTypeMapping.js';

function clean(value, maxLength = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeIdentity(value) {
  return clean(value, 240)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveDirectoryOrganizationCanonicalPayload(row = {}) {
  const typeResolution = resolveProviderOrganizationType(row);
  if (!typeResolution.valid) {
    return {
      valid: false,
      error_code: typeResolution.error_code,
      values: {},
      type_resolution: typeResolution,
    };
  }

  const organizationName = clean(row.organization_name, 240);
  const organizationExternalKey = clean(row.organization_external_key, 240);
  if (!organizationName || !organizationExternalKey) {
    return {
      valid: false,
      error_code: 'organization_identity_not_resolved',
      values: {},
      type_resolution: typeResolution,
    };
  }

  return {
    valid: true,
    error_code: '',
    values: {
      name: organizationName,
      public_display_name: organizationName,
      organization_type: typeResolution.organization_type,
      organization_type_code: typeResolution.organization_type_code,
      directory_external_key: organizationExternalKey,
      directory_source_version: clean(row.source_version, 160),
    },
    type_resolution: typeResolution,
  };
}

export function isMutableDirectoryOrganization(organization = {}) {
  return organization.control_status === 'directory'
    && organization.publication_status === 'draft'
    && (!organization.public_visibility_status || organization.public_visibility_status === 'draft');
}

export function planDirectoryOrganizationReconciliation(organization = {}, row = {}) {
  const canonical = resolveDirectoryOrganizationCanonicalPayload(row);
  if (!canonical.valid) {
    return {
      valid: false,
      error_code: canonical.error_code,
      updates: {},
      requires_update: false,
      protected: true,
      canonical,
    };
  }

  const desired = canonical.values;
  const currentExternalKey = clean(organization.directory_external_key, 240);
  if (currentExternalKey && currentExternalKey !== desired.directory_external_key) {
    return {
      valid: false,
      error_code: 'organization_external_key_conflict',
      updates: {},
      requires_update: false,
      protected: true,
      canonical,
    };
  }

  const mutable = isMutableDirectoryOrganization(organization);
  if (!mutable) {
    const currentName = organization.public_display_name || organization.name;
    if (normalizeIdentity(currentName) !== normalizeIdentity(desired.name)) {
      return {
        valid: false,
        error_code: 'controlled_organization_identity_conflict',
        updates: {},
        requires_update: false,
        protected: true,
        canonical,
      };
    }
    if (clean(organization.organization_type, 120) !== desired.organization_type) {
      return {
        valid: false,
        error_code: 'controlled_organization_legacy_type_conflict',
        updates: {},
        requires_update: false,
        protected: true,
        canonical,
      };
    }

    const currentCanonicalType = clean(organization.organization_type_code, 120);
    if (currentCanonicalType && currentCanonicalType !== desired.organization_type_code) {
      return {
        valid: false,
        error_code: 'controlled_organization_canonical_type_conflict',
        updates: {},
        requires_update: false,
        protected: true,
        canonical,
      };
    }
    if (!currentCanonicalType && desired.organization_type_code !== desired.organization_type) {
      return {
        valid: false,
        error_code: 'controlled_organization_canonical_type_missing',
        updates: {},
        requires_update: false,
        protected: true,
        canonical,
      };
    }

    return {
      valid: true,
      error_code: '',
      updates: {},
      requires_update: false,
      protected: true,
      canonical,
    };
  }

  const updates = {};
  const currentCanonicalType = clean(organization.organization_type_code, 120);
  if (!currentCanonicalType && desired.organization_type_code !== desired.organization_type) {
    return {
      valid: false,
      error_code: 'directory_organization_canonical_type_missing',
      updates: {},
      requires_update: false,
      protected: false,
      canonical,
    };
  }

  for (const key of ['name', 'organization_type']) {
    if (clean(organization[key], key.includes('type') ? 120 : 240) !== desired[key]) {
      updates[key] = desired[key];
    }
  }
  for (const key of [
    'public_display_name',
    'organization_type_code',
    'directory_external_key',
    'directory_source_version',
  ]) {
    const currentValue = clean(organization[key], key.includes('type') ? 120 : 240);
    if (currentValue && currentValue !== desired[key]) updates[key] = desired[key];
  }
  return {
    valid: true,
    error_code: '',
    updates,
    requires_update: Object.keys(updates).length > 0,
    protected: false,
    canonical,
  };
}
