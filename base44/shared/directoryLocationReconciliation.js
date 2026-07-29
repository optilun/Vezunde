function clean(value, maxLength = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeDirectoryDate(value) {
  const text = clean(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function directoryConfidenceFor(row = {}) {
  if (row.data_quality_status === 'high') return 'high';
  if (row.data_quality_status === 'medium') return 'medium';
  return 'low';
}

function comparableValue(key, value, expected) {
  if (expected === null) {
    return value === undefined || value === null || value === '' ? null : value;
  }
  if (typeof expected === 'string' && key.endsWith('_at')) {
    return normalizeDirectoryDate(value);
  }
  if (typeof expected === 'string') return clean(value);
  if (typeof expected === 'boolean') return Boolean(value);
  if (typeof expected === 'number') return Number(value);
  return value ?? null;
}

export function directoryFieldsEqual(current = {}, expected = {}) {
  return Object.entries(expected).every(
    ([key, value]) => comparableValue(key, current?.[key], value) === value,
  );
}

export function resolveDirectoryLocationUpdatePayload(row = {}) {
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  const values = {
    name: clean(row.location_name, 240),
    provider_type: clean(row.provider_type, 120),
    provider_profile_type: clean(row.provider_profile_type, 120),
    city: clean(row.locality_name, 160),
    locality_name: clean(row.locality_name, 160),
    locality_siruta_code: clean(row.locality_siruta_code, 40),
    county: clean(row.county_name, 160),
    county_name: clean(row.county_name, 160),
    address: clean(row.address, 600),
    phone_public: clean(row.phone, 160),
    public_email: clean(row.email, 240),
    website: clean(row.website, 600),
    opening_hours: clean(row.schedule, 1200),
    active_status: row.operational_status === 'active' ? 'activa' : 'inactiva',
    source_url: clean(row.source_url, 1200),
    source_name: clean(
      row.source_name || row.organization_name || row.location_name,
      300,
    ),
    source_type: clean(row.source_type || 'official', 120),
    data_confidence: directoryConfidenceFor(row),
    data_source: 'public_source',
    migration_review_required: false,
  };

  for (const [key, value, maxLength] of [
    ['county_code', row.county_code, 40],
    ['uat_code', row.uat_code, 40],
    ['uat_name', row.uat_name, 160],
  ]) {
    const normalized = clean(value, maxLength);
    if (normalized) values[key] = normalized;
  }

  if (sourceCheckedAt) {
    values.source_checked_at = sourceCheckedAt;
    values.last_confirmed_at = sourceCheckedAt;
  }
  return values;
}

export function resolveDirectoryStateUpdatePayload(
  row = {},
  locationId = '',
  organizationLinked = false,
) {
  const values = {
    location_id: clean(locationId, 160),
    directory_external_key: clean(row.location_external_key, 240),
    directory_source_version: clean(row.source_version, 160),
    address_fingerprint: clean(row.address_fingerprint, 240),
    location_type_code: clean(row.location_type_code, 120),
    care_setting_code: clean(row.care_setting_code, 120),
    ownership_type_code: clean(row.ownership_type_code || 'unknown', 120),
    operational_status: clean(row.operational_status || 'unknown', 120),
    data_quality_status: clean(row.data_quality_status || 'low', 120),
    organization_link_status: organizationLinked ? 'confirmed' : 'unassigned',
    organization_link_confidence: organizationLinked
      ? directoryConfidenceFor(row)
      : 'low',
    organization_link_review_note: organizationLinked
      ? 'Confirmat prin aprobarea administrativa a lotului de import.'
      : 'Fara organizatie confirmata la import.',
  };
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  if (sourceCheckedAt) values.source_checked_at = sourceCheckedAt;
  return values;
}

export function resolveDirectoryStateCreatePayload(
  row = {},
  locationId = '',
  organizationLinked = false,
) {
  return {
    ...resolveDirectoryStateUpdatePayload(row, locationId, organizationLinked),
    publication_status: 'draft',
    control_status: 'directory',
    directory_detail_level: 'summary',
    directory_basic_details_approved: false,
    state_status: 'active',
  };
}

export function resolveDirectoryLinkPayload(
  row = {},
  locationId = '',
  organizationId = '',
) {
  return {
    organization_id: clean(organizationId, 160),
    location_id: clean(locationId, 160),
    source_row_key: clean(row.source_row_key, 240),
    source_version: clean(row.source_version, 160),
    link_status: 'confirmed',
    confidence: directoryConfidenceFor(row),
    evidence_summary: clean(
      row.evidence_note || 'Asociere confirmata prin sursa directorului.',
      2000,
    ),
    link_record_status: 'active',
  };
}

export function resolveDirectoryEvidencePayload(
  row = {},
  entityType = 'ProviderLocation',
  entityId = '',
) {
  const values = {
    entity_type: clean(entityType, 120),
    entity_id: clean(entityId, 160),
    field_name: 'directory_import_snapshot',
    value_snapshot: JSON.stringify({
      source_version: clean(row.source_version, 160),
      source_row_key: clean(row.source_row_key, 240),
    }),
    source_url: clean(row.source_url, 1200),
    source_type: clean(row.source_type || 'official', 120),
    source_title: clean(
      row.source_name || row.organization_name || row.location_name,
      300,
    ),
    confidence: directoryConfidenceFor(row),
    evidence_status: 'active',
    notes: clean(
      [row.evidence_note, row.observations].filter(Boolean).join(' | '),
      2000,
    ),
  };
  const sourceCheckedAt = normalizeDirectoryDate(row.source_checked_at);
  if (sourceCheckedAt) values.checked_at = sourceCheckedAt;
  return values;
}

function activeRows(rows, field, activeValue) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && (!row[field] || row[field] === activeValue));
}

export function planDirectoryLocationReconciliation({
  location = {},
  directoryStates = [],
  organizationLinks = [],
  evidenceRows = [],
  row = {},
  organizationId = '',
} = {}) {
  const locationValues = resolveDirectoryLocationUpdatePayload(row);
  const activeStates = activeRows(directoryStates, 'state_status', 'active');
  const stateValues = resolveDirectoryStateUpdatePayload(
    row,
    location.id,
    Boolean(organizationId),
  );
  const activeLinks = activeRows(
    organizationLinks,
    'link_record_status',
    'active',
  );
  const linkValues = organizationId
    ? resolveDirectoryLinkPayload(row, location.id, organizationId)
    : null;
  const matchingLinks = linkValues
    ? activeLinks.filter((link) => link.organization_id === organizationId)
    : [];
  const activeEvidence = activeRows(
    evidenceRows,
    'evidence_status',
    'active',
  );
  const evidenceValues = resolveDirectoryEvidencePayload(
    row,
    'ProviderLocation',
    location.id,
  );
  const matchingEvidence = activeEvidence.filter(
    (evidence) => directoryFieldsEqual(evidence, evidenceValues),
  );

  const components = {
    location: !directoryFieldsEqual(location, locationValues),
    directory_state:
      activeStates.length !== 1
      || !directoryFieldsEqual(activeStates[0], stateValues),
    organization_link: Boolean(linkValues) && (
      activeLinks.length !== 1
      || matchingLinks.length !== 1
      || !directoryFieldsEqual(matchingLinks[0], linkValues)
    ),
    evidence:
      activeEvidence.length !== 1
      || matchingEvidence.length !== 1,
  };

  return {
    valid: true,
    error_code: '',
    requires_update: Object.values(components).some(Boolean),
    components,
    location_values: locationValues,
    state_values: stateValues,
    link_values: linkValues,
    evidence_values: evidenceValues,
  };
}
