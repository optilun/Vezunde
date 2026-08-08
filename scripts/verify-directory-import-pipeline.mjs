import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DIRECTORY_CLASSIFICATION_CONTRACT_VERSION,
  DIRECTORY_IMPORT_CONTRACT_VERSION,
  batchApprovalToken,
  normalizeDirectoryImportRow,
  rollbackApprovalToken,
  validateNormalizedDirectoryRow,
} from '../shared/directoryImportPipeline.js';
import {
  parseDirectorySource,
  sourceColumns,
} from '../src/lib/directoryImportFileParser.js';
import {
  isDirectoryOrganizationTypeCode,
  resolveProviderOrganizationType,
} from '../base44/shared/directoryOrganizationTypeMapping.js';
import {
  isMutableDirectoryOrganization,
  planDirectoryOrganizationReconciliation,
  resolveDirectoryOrganizationCanonicalPayload,
} from '../base44/shared/directoryOrganizationReconciliation.js';
import {
  resolveDirectoryLocationMatch,
  resolveDirectoryOrganizationMatch,
} from '../base44/shared/directoryIdentityMatchPolicy.js';
import {
  planDirectoryLocationReconciliation,
  resolveDirectoryEvidencePayload,
  resolveDirectoryLinkPayload,
  resolveDirectoryLocationUpdatePayload,
  resolveDirectoryStateUpdatePayload,
} from '../base44/shared/directoryLocationReconciliation.js';
import {
  getDirectoryEntityOrNull,
  isDirectoryReadFailure,
  isTransientDirectoryExecutionFailure,
  requireDirectoryRows,
} from '../base44/shared/directoryImportReadPolicy.js';
import {
  directoryBatchOrganizationDescriptor,
  validateDirectoryBatchOrganizationCompatibility,
  validateExplicitDirectoryOrganizationTarget,
} from '../base44/shared/directoryBatchOrganizationPlanning.js';

assert.equal(DIRECTORY_IMPORT_CONTRACT_VERSION, 'viasee-directory-import-v1');
assert.equal(DIRECTORY_CLASSIFICATION_CONTRACT_VERSION, 'viasee-directory-location-first-v1');


const networkOrganizationRow = {
  organization_name: 'Vitreum',
  organization_external_key: 'org:vitreum',
  organization_type_code: 'healthcare_network',
  provider_profile_type: 'ophthalmology_clinic',
};
const networkOrganizationDescriptor = directoryBatchOrganizationDescriptor(networkOrganizationRow);
assert.equal(networkOrganizationDescriptor.valid, true);
assert.equal(networkOrganizationDescriptor.group_key, 'external:org:vitreum');
assert.deepEqual(
  validateDirectoryBatchOrganizationCompatibility(
    networkOrganizationDescriptor,
    directoryBatchOrganizationDescriptor({ ...networkOrganizationRow }),
  ),
  { valid: true, error_code: '' },
);
assert.equal(
  validateDirectoryBatchOrganizationCompatibility(
    networkOrganizationDescriptor,
    directoryBatchOrganizationDescriptor({
      ...networkOrganizationRow,
      organization_type_code: 'optical_chain',
      provider_profile_type: 'optical_chain',
    }),
  ).error_code,
  'batch_organization_type_conflict',
);
assert.deepEqual(
  validateExplicitDirectoryOrganizationTarget(
    {
      id: 'org-dr-holhos',
      name: 'Clinica Dr. Holhos Sibiu',
      organization_type: 'ophthalmology_clinic',
      control_status: 'verified',
      publication_status: 'approved',
    },
    {
      organization_name: 'Dr. Holhos',
      organization_external_key: 'org:ef547aca',
      organization_type_code: 'healthcare_network',
      provider_profile_type: 'ophthalmology_clinic',
    },
  ),
  {
    valid: true,
    error_code: '',
    descriptor: {
      valid: true,
      error_code: '',
      group_key: 'external:org:ef547aca',
      organization_name_normalized: 'dr holhos',
      organization_external_key: 'org:ef547aca',
      organization_type_code: 'healthcare_network',
      organization_type: 'ophthalmology_clinic',
    },
    organization_id: 'org-dr-holhos',
    preserves_controlled_organization: true,
  },
);
assert.equal(
  validateExplicitDirectoryOrganizationTarget(
    {
      id: 'org-conflict',
      organization_type: 'optical_chain',
    },
    networkOrganizationRow,
  ).error_code,
  '',
);
// Comportament schimbat (verificat 2026-08-06 direct in bundle-ul deploy-uit): cand un
// admin alege explicit o organizatie tinta si tipul legacy difera de cel al randului
// importat, sistemul NU mai respinge importul cu o eroare de conflict. Accepta importul,
// dar pastreaza tipul organizatiei deja controlate, ca sa nu-l suprascrie silentios -
// mai permisiv la import, la fel de sigur pentru profilurile controlate.
const preservedTypeResult = validateExplicitDirectoryOrganizationTarget(
  {
    id: 'org-conflict',
    organization_type: 'optical_chain',
  },
  networkOrganizationRow,
);
assert.equal(preservedTypeResult.valid, true);
assert.equal(preservedTypeResult.preserves_controlled_organization, true);
assert.equal(preservedTypeResult.descriptor.organization_type, 'optical_chain');

assert.deepEqual(
  await requireDirectoryRows(Promise.resolve([]), 'locatiilor de test'),
  [],
);
await assert.rejects(
  requireDirectoryRows(
    Promise.reject(Object.assign(new Error('indisponibil temporar'), { status: 503 })),
    'locatiilor de test',
  ),
  (error) => (
    error?.code === 'directory_read_failed'
    && error?.status === 503
    && /Importul a fost oprit/.test(error.message)
  ),
);
assert.equal(
  isDirectoryReadFailure({ code: 'directory_read_failed' }),
  true,
);
assert.equal(isDirectoryReadFailure(new Error('alta eroare')), false);
assert.equal(isTransientDirectoryExecutionFailure(new Error('Rate limit exceeded')), true);
assert.equal(isTransientDirectoryExecutionFailure(Object.assign(new Error('prea multe cereri'), { status: 429 })), true);
assert.equal(isTransientDirectoryExecutionFailure(Object.assign(new Error('indisponibil'), { response: { status: 503 } })), true);
assert.equal(isTransientDirectoryExecutionFailure(new Error('conflict de identitate')), false);
await assert.rejects(
  requireDirectoryRows(Promise.resolve(null), 'locatiilor de test'),
  (error) => (
    error?.code === 'directory_read_failed'
    && /nu este o lista/.test(error.message)
  ),
);
assert.equal(
  await getDirectoryEntityOrNull(
    Promise.reject(Object.assign(new Error('nu exista'), { response: { status: 404 } })),
    'locatiei de test',
  ),
  null,
);
await assert.rejects(
  getDirectoryEntityOrNull(
    Promise.reject(Object.assign(new Error('indisponibil temporar'), { response: { status: 503 } })),
    'locatiei de test',
  ),
  (error) => (
    error?.code === 'directory_read_failed'
    && error?.status === 503
    && /Importul a fost oprit/.test(error.message)
  ),
);

for (const [organizationTypeCode, providerProfileType, expectedLegacyType] of [
  ['independent_optical_store', 'independent_optical_store', 'independent_optical_store'],
  ['optical_chain', 'optical_chain', 'optical_chain'],
  ['ophthalmology_clinic', 'ophthalmology_clinic', 'ophthalmology_clinic'],
  ['ophthalmology_office', 'ophthalmology_office', 'ophthalmology_office'],
  ['healthcare_network', 'ophthalmology_clinic', 'ophthalmology_clinic'],
  ['multi_specialty_healthcare_provider', 'ophthalmology_clinic', 'ophthalmology_clinic'],
  ['public_healthcare_institution', 'ophthalmology_clinic', 'ophthalmology_clinic'],
  ['independent_professional', 'independent_ophthalmologist', 'independent_ophthalmologist'],
  ['optical_laboratory', 'optical_laboratory_b2b', 'optical_laboratory_b2b'],
  ['b2b_distributor', 'future_b2b_distributor', 'future_b2b_distributor'],
]) {
  const resolution = resolveProviderOrganizationType({
    organization_type_code: organizationTypeCode,
    provider_profile_type: providerProfileType,
  });
  assert.equal(resolution.valid, true, organizationTypeCode);
  assert.equal(resolution.organization_type_code, organizationTypeCode);
  assert.equal(resolution.organization_type, expectedLegacyType);
  assert.equal(resolution.error_code, '');
  assert.equal(isDirectoryOrganizationTypeCode(organizationTypeCode), true);
}

assert.deepEqual(
  resolveProviderOrganizationType({
    organization_type_code: 'independent_professional',
    provider_profile_type: 'ophthalmology_clinic',
  }),
  {
    valid: false,
    organization_type_code: 'independent_professional',
    organization_type: '',
    error_code: 'organization_type_legacy_mapping_not_resolved',
  },
);
assert.equal(
  resolveProviderOrganizationType({
    organization_type_code: 'other',
    provider_profile_type: 'ophthalmology_clinic',
  }).error_code,
  'organization_type_legacy_mapping_not_resolved',
);
assert.equal(
  resolveProviderOrganizationType({
    organization_type_code: 'tip_organizatie_inexistent',
    provider_profile_type: 'ophthalmology_clinic',
  }).error_code,
  'invalid_explicit_organization_type',
);
assert.equal(
  resolveProviderOrganizationType({
    organization_type_code: '',
    provider_profile_type: 'ophthalmology_clinic',
  }).error_code,
  'organization_type_not_resolved',
);

const extendedOrganizationRow = {
  organization_name: 'Vista Vision',
  organization_external_key: 'org:vista-vision',
  source_version: 'V7-test',
  organization_type_code: 'healthcare_network',
  provider_profile_type: 'ophthalmology_clinic',
};
assert.deepEqual(
  resolveDirectoryOrganizationCanonicalPayload(extendedOrganizationRow).values,
  {
    name: 'Vista Vision',
    public_display_name: 'Vista Vision',
    organization_type: 'ophthalmology_clinic',
    organization_type_code: 'healthcare_network',
    directory_external_key: 'org:vista-vision',
    directory_source_version: 'V7-test',
  },
);
assert.equal(isMutableDirectoryOrganization({
  control_status: 'directory',
  publication_status: 'draft',
  public_visibility_status: 'draft',
}), true);
assert.equal(isMutableDirectoryOrganization({
  control_status: 'claimed',
  publication_status: 'draft',
  public_visibility_status: 'draft',
}), false);

const organizationOne = { id: 'org-1', name: 'Vista Vision' };
const organizationTwo = { id: 'org-2', name: 'Vista Vision' };
assert.equal(
  resolveDirectoryOrganizationMatch({
    externalCandidates: [organizationOne],
    nameCandidates: [organizationOne, organizationTwo],
  }).target.id,
  'org-1',
);
assert.equal(
  resolveDirectoryOrganizationMatch({
    externalCandidates: [organizationOne, organizationTwo],
  }).error_code,
  'multiple_organizations_for_external_key',
);
assert.equal(
  resolveDirectoryOrganizationMatch({
    nameCandidates: [organizationOne, organizationTwo],
  }).error_code,
  'multiple_organizations_for_exact_name',
);

const locationOne = { id: 'loc-1', name: 'Optica Unu' };
const locationTwo = { id: 'loc-2', name: 'Optica Doi' };
const locationsById = new Map([
  [locationOne.id, locationOne],
  [locationTwo.id, locationTwo],
]);
assert.equal(
  resolveDirectoryLocationMatch({
    externalStates: [{ id: 'state-1', location_id: 'loc-1' }],
    addressStates: [
      { id: 'state-1', location_id: 'loc-1' },
      { id: 'state-2', location_id: 'loc-2' },
    ],
    locationsById,
  }).target.id,
  'loc-1',
);
assert.equal(
  resolveDirectoryLocationMatch({
    exactFallbackCandidates: [locationTwo],
    addressStates: [{ id: 'state-1', location_id: 'loc-1' }],
    locationsById,
  }).target.id,
  'loc-2',
);
assert.equal(
  resolveDirectoryLocationMatch({
    addressStates: [
      { id: 'state-1', location_id: 'loc-1' },
      { id: 'state-2', location_id: 'loc-2' },
    ],
    locationsById,
  }).error_code,
  'address_match_requires_manual_identity_review',
);
assert.equal(
  resolveDirectoryLocationMatch({
    externalStates: [{ id: 'orphan-state', location_id: 'missing-location' }],
    locationsById,
  }).error_code,
  'location_external_state_target_missing',
);
assert.equal(
  resolveDirectoryLocationMatch({
    addressStates: [{ id: 'orphan-state', location_id: 'missing-location' }],
    locationsById,
  }).error_code,
  'address_state_target_missing',
);

const mutableOrganizationPlan = planDirectoryOrganizationReconciliation({
  id: 'org-1',
  name: 'Vista Vision',
  public_display_name: 'Vista Vision',
  organization_type: 'ophthalmology_clinic',
  organization_type_code: 'ophthalmology_clinic',
  directory_external_key: 'org:vista-vision',
  directory_source_version: 'V6-test',
  control_status: 'directory',
  publication_status: 'draft',
  public_visibility_status: 'draft',
}, extendedOrganizationRow);
assert.equal(mutableOrganizationPlan.valid, true);
assert.equal(mutableOrganizationPlan.requires_update, true);
assert.deepEqual(mutableOrganizationPlan.updates, {
  organization_type_code: 'healthcare_network',
  directory_source_version: 'V7-test',
});

const protectedCompatiblePlan = planDirectoryOrganizationReconciliation({
  id: 'org-2',
  name: 'Lensa',
  organization_type: 'optical_chain',
  organization_type_code: 'optical_chain',
  control_status: 'verified',
  publication_status: 'published',
}, {
  organization_name: 'LENSA',
  organization_external_key: 'org:lensa',
  source_version: 'V7-test',
  organization_type_code: 'optical_chain',
  provider_profile_type: 'optical_chain',
});
assert.equal(protectedCompatiblePlan.valid, true);
assert.equal(protectedCompatiblePlan.requires_update, false);
assert.deepEqual(protectedCompatiblePlan.updates, {});

assert.equal(
  planDirectoryOrganizationReconciliation({
    name: 'Vista Vision',
    organization_type: 'ophthalmology_clinic',
    control_status: 'claimed',
    publication_status: 'published',
  }, extendedOrganizationRow).error_code,
  'controlled_organization_canonical_type_missing',
);
assert.equal(
  planDirectoryOrganizationReconciliation({
    name: 'Vista Vision',
    organization_type: 'ophthalmology_clinic',
    directory_external_key: 'org:vista-vision',
    control_status: 'directory',
    publication_status: 'draft',
    public_visibility_status: 'draft',
  }, extendedOrganizationRow).error_code,
  'directory_organization_canonical_type_missing',
);
assert.equal(
  planDirectoryOrganizationReconciliation({
    name: 'Vista Vision',
    organization_type: 'ophthalmology_clinic',
    organization_type_code: 'healthcare_network',
    directory_external_key: 'org:alta-retea',
    control_status: 'directory',
    publication_status: 'draft',
    public_visibility_status: 'draft',
  }, extendedOrganizationRow).error_code,
  'organization_external_key_conflict',
);

const normalized = normalizeDirectoryImportRow({
  location_display_name: 'Optica Test Centru',
  organization_display_name: 'Optica Test',
  official_locality: 'Timișoara',
  locality_name: 'Timisoara',
  county_if_confirmed: 'Timis',
  county_code: '35',
  siruta: '155243',
  uat_code: '155243',
  uat_name: 'Timisoara',
  confirmed_address: 'Str. Exemplu nr. 10',
  confirmed_location_phone: '0256000000',
  official_source_url: 'https://example.com/locatie',
  official_source_type: 'official_website',
  source_checked_at: '2026-07-20',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  confirmed_activity_category: 'optica medicala',
}, { source_version: 'V3-test', source_row_key: 'row-1', row_number: 1 });
assert.equal(normalized.classification_contract_version, 'viasee-directory-location-first-v1');
assert.equal(normalized.location_name, 'Optica Test Centru');
assert.equal(normalized.locality_name, 'Timișoara');
assert.equal(normalized.county_code, '35');
assert.equal(normalized.uat_code, '155243');
assert.equal(normalized.uat_name, 'Timisoara');
assert.equal(normalized.provider_type, 'optica_medicala');
assert.equal(normalized.provider_profile_type, 'independent_optical_store');
assert.equal(normalized.organization_type_code, 'independent_optical_store');
assert.equal(normalized.organization_type_source, 'legacy_profile_fallback');
assert.equal(normalized.location_type_code, 'optical_store');
assert.equal(normalized.operational_status, 'active');
assert.equal(normalized.publication_status, 'draft');
assert.equal(normalized.control_status, 'directory');
assert.ok(normalized.location_external_key.startsWith('loc:'));
assert.ok(normalized.address_fingerprint.startsWith('addr:'));
assert.equal(validateNormalizedDirectoryRow(normalized).valid, true);
assert.ok(validateNormalizedDirectoryRow(normalized).warnings.includes('organization_type_inferred_from_legacy_profile'));

const correctedPilotRow = normalizeDirectoryImportRow({
  location_display_name: 'Centrul Oftalmologic Prof. Dr. Munteanu',
  organization_display_name: 'Centrul Oftalmologic Prof. Dr. Munteanu',
  official_locality: 'Timișoara',
  locality_name: 'Timisoara',
  county_if_confirmed: 'Timis',
  county_code: '35',
  locality_siruta_code: '155243',
  uat_code: '155243',
  uat_name: 'Timisoara',
  confirmed_address: 'Str. 3 August 1919 nr. 2, Timișoara',
  confirmed_location_phone: '0711 955 525 / 0744 559 070',
  confirmed_location_email: 'receptie@profmunteanu.ro',
  official_source_url: 'https://www.facebook.com/drmihneamunteanu/',
  official_source_type: 'official_social',
  source_checked_at: '2026-07-29',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  confirmed_activity_category: 'clinica oftalmologica',
  evidence_note: 'Canalul social oficial confirma activitatea curenta.',
  observations: 'Domeniul propriu nu mai este folosit ca dovada.',
  organization_external_key: 'org:86f1fcdc',
  location_external_key: 'loc:17ba81c4',
  provider_type: 'clinica_oftalmologica',
  provider_profile_type: 'ophthalmology_clinic',
  organization_type_code: 'ophthalmology_clinic',
  location_type_code: 'ophthalmology_clinic',
  care_setting_code: 'outpatient',
  ownership_type_code: 'private',
}, {
  source_version: 'viasee-directory-v8',
  source_row_key: 'v6:316:7fa0465f',
  row_number: 315,
});
const correctedLocationValues = resolveDirectoryLocationUpdatePayload(
  correctedPilotRow,
);
assert.equal(correctedLocationValues.county_code, '35');
assert.equal(correctedLocationValues.uat_code, '155243');
assert.equal(correctedLocationValues.uat_name, 'Timisoara');
assert.equal(correctedLocationValues.locality_name, 'Timișoara');
assert.equal(
  correctedLocationValues.source_url,
  'https://www.facebook.com/drmihneamunteanu/',
);

const sparseOptionalPilotRow = {
  ...correctedPilotRow,
  phone: '',
  email: '',
  website: '',
  schedule: '',
};
const sparseOptionalValues = resolveDirectoryLocationUpdatePayload(
  sparseOptionalPilotRow,
);
for (const key of [
  'phone_public',
  'public_email',
  'website',
  'opening_hours',
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(sparseOptionalValues, key),
    false,
    `${key} gol nu trebuie inclus in update`,
  );
}
const existingOptionalFields = {
  phone_public: '0256 111 222',
  public_email: 'contact@existent.ro',
  website: 'https://existent.ro',
  opening_hours: 'Luni-Vineri 09:00-18:00',
};
assert.deepEqual(
  {
    ...existingOptionalFields,
    ...sparseOptionalValues,
  },
  {
    ...sparseOptionalValues,
    ...existingOptionalFields,
  },
);
const sparseLocationPlan = planDirectoryLocationReconciliation({
  location: {
    id: 'loc-with-existing-optional-fields',
    ...sparseOptionalValues,
    ...existingOptionalFields,
  },
  row: sparseOptionalPilotRow,
});
assert.equal(sparseLocationPlan.components.location, false);

const stalePilotLocation = {
  id: 'loc-munteanu',
  organization_id: 'org-munteanu',
  ...correctedLocationValues,
  county_code: null,
  uat_code: null,
  uat_name: null,
  source_url: 'https://profmunteanu.ro/',
  source_type: 'official_website',
  source_checked_at: '2026-07-18T00:00:00.000Z',
  last_confirmed_at: '2026-07-18T00:00:00.000Z',
  profile_control_status: 'directory',
};
const stalePilotState = {
  id: 'state-munteanu',
  location_id: stalePilotLocation.id,
  directory_external_key: correctedPilotRow.location_external_key,
  directory_source_version: 'pilot-v10',
  address_fingerprint: correctedPilotRow.address_fingerprint,
  location_type_code: correctedPilotRow.location_type_code,
  care_setting_code: correctedPilotRow.care_setting_code,
  ownership_type_code: 'unknown',
  operational_status: 'active',
  data_quality_status: 'high',
  organization_link_status: 'confirmed',
  organization_link_confidence: 'high',
  source_checked_at: '2026-07-18T00:00:00.000Z',
  state_status: 'active',
};
const stalePilotLink = {
  id: 'link-munteanu',
  organization_id: 'org-munteanu',
  location_id: stalePilotLocation.id,
  source_row_key: 'v2-md-line:993',
  source_version: 'pilot-v10',
  link_status: 'confirmed',
  confidence: 'high',
  evidence_summary: 'Vechea dovada.',
  link_record_status: 'active',
};
const stalePilotEvidence = {
  id: 'evidence-munteanu',
  entity_type: 'ProviderLocation',
  entity_id: stalePilotLocation.id,
  field_name: 'directory_import_snapshot',
  value_snapshot: JSON.stringify({
    source_version: 'pilot-v10',
    source_row_key: 'v2-md-line:993',
  }),
  source_url: 'https://profmunteanu.ro/',
  source_type: 'official_website',
  source_title: correctedPilotRow.location_name,
  checked_at: '2026-07-18T00:00:00.000Z',
  confidence: 'high',
  evidence_status: 'active',
  notes: 'Vechea dovada.',
};
const stalePilotPlan = planDirectoryLocationReconciliation({
  location: stalePilotLocation,
  directoryStates: [stalePilotState],
  organizationLinks: [stalePilotLink],
  evidenceRows: [stalePilotEvidence],
  row: correctedPilotRow,
  organizationId: 'org-munteanu',
});
assert.equal(stalePilotPlan.requires_update, true);
assert.deepEqual(stalePilotPlan.components, {
  location: true,
  directory_state: true,
  organization_link: true,
  evidence: true,
});

const reconciledPilotPlan = planDirectoryLocationReconciliation({
  location: {
    id: stalePilotLocation.id,
    organization_id: 'org-munteanu',
    ...correctedLocationValues,
    profile_control_status: 'directory',
  },
  directoryStates: [{
    id: stalePilotState.id,
    ...resolveDirectoryStateUpdatePayload(
      correctedPilotRow,
      stalePilotLocation.id,
      true,
    ),
    publication_status: 'published',
    control_status: 'directory',
    directory_detail_level: 'basic',
    directory_basic_details_approved: true,
    state_status: 'active',
  }],
  organizationLinks: [{
    id: stalePilotLink.id,
    ...resolveDirectoryLinkPayload(
      correctedPilotRow,
      stalePilotLocation.id,
      'org-munteanu',
    ),
    reviewed_at: '2026-07-29T12:00:00.000Z',
  }],
  evidenceRows: [{
    id: stalePilotEvidence.id,
    ...resolveDirectoryEvidencePayload(
      correctedPilotRow,
      'ProviderLocation',
      stalePilotLocation.id,
    ),
  }],
  row: correctedPilotRow,
  organizationId: 'org-munteanu',
});
assert.equal(reconciledPilotPlan.requires_update, false);
assert.deepEqual(reconciledPilotPlan.components, {
  location: false,
  directory_state: false,
  organization_link: false,
  evidence: false,
});

const mixedOptical = normalizeDirectoryImportRow({
  location_display_name: 'Optica si optometrie Test',
  organization_display_name: 'Optica Test',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  siruta: '155243',
  confirmed_address: 'Str. Exemplu nr. 11',
  official_source_url: 'https://example.com/optica-optometrie',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  confirmed_activity_category: 'optica; optometrie',
});
assert.equal(mixedOptical.provider_type, 'optica_medicala');
assert.equal(mixedOptical.provider_profile_type, 'independent_optical_store');
assert.equal(mixedOptical.organization_type_code, 'independent_optical_store');
assert.equal(mixedOptical.location_type_code, 'optical_store');
assert.equal(mixedOptical.care_setting_code, 'retail');
assert.equal(mixedOptical.canonical_type_source, 'activity_inferred');

const explicitCanonical = normalizeDirectoryImportRow({
  location_display_name: 'Lensa Timisoara Test',
  organization_display_name: 'Lensa',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  locality_siruta_code: '155243',
  confirmed_address: 'Str. Exemplu nr. 12',
  official_source_url: 'https://example.com/lensa',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  confirmed_activity_category: 'optica; optometrie',
  provider_type: 'optica_medicala',
  provider_profile_type: 'optical_chain',
  organization_type_code: 'optical_chain',
  location_type_code: 'optical_store',
  care_setting_code: 'retail',
  ownership_type_code: 'private',
});
assert.equal(explicitCanonical.provider_profile_type, 'optical_chain');
assert.equal(explicitCanonical.organization_type_code, 'optical_chain');
assert.equal(explicitCanonical.organization_type_source, 'source_explicit');
assert.equal(explicitCanonical.organization_type_legacy_fallback, false);
assert.equal(explicitCanonical.canonical_type_source, 'source_explicit');
assert.equal(explicitCanonical.canonical_type_invalid, false);
assert.equal(explicitCanonical.organization_type_invalid, false);
assert.equal(explicitCanonical.ownership_type_code, 'private');
assert.equal(validateNormalizedDirectoryRow(explicitCanonical).valid, true);
assert.equal(validateNormalizedDirectoryRow(explicitCanonical).warnings.includes('organization_type_inferred_from_legacy_profile'), false);

const legacyChainCanonical = normalizeDirectoryImportRow({
  location_display_name: 'Lensa Timisoara Legacy',
  organization_display_name: 'Lensa',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  locality_siruta_code: '155243',
  confirmed_address: 'Str. Exemplu nr. 12A',
  official_source_url: 'https://example.com/lensa-legacy',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  provider_type: 'optica_medicala',
  provider_profile_type: 'optical_chain',
  location_type_code: 'optical_store',
  care_setting_code: 'retail',
});
assert.equal(legacyChainCanonical.organization_type_code, 'optical_chain');
assert.equal(legacyChainCanonical.organization_type_source, 'legacy_profile_fallback');
assert.equal(legacyChainCanonical.organization_type_legacy_fallback, true);
assert.ok(validateNormalizedDirectoryRow(legacyChainCanonical).warnings.includes('organization_type_inferred_from_legacy_profile'));

const invalidExplicitCanonical = normalizeDirectoryImportRow({
  location_display_name: 'Tip explicit invalid',
  organization_display_name: 'Organizatie Test',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  locality_siruta_code: '155243',
  confirmed_address: 'Str. Exemplu nr. 13',
  official_source_url: 'https://example.com/invalid',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  provider_type: 'tip_inexistent',
  provider_profile_type: 'optical_chain',
  organization_type_code: 'optical_chain',
  location_type_code: 'optical_store',
  care_setting_code: 'retail',
});
assert.equal(invalidExplicitCanonical.canonical_type_invalid, true);
assert.ok(validateNormalizedDirectoryRow(invalidExplicitCanonical).errors.includes('invalid_explicit_canonical_type'));

const invalidOrganizationType = normalizeDirectoryImportRow({
  location_display_name: 'Organizatie cu tip invalid',
  organization_display_name: 'Organizatie Test',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  locality_siruta_code: '155243',
  confirmed_address: 'Str. Exemplu nr. 14',
  official_source_url: 'https://example.com/invalid-org',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  provider_type: 'optica_medicala',
  provider_profile_type: 'independent_optical_store',
  organization_type_code: 'tip_organizatie_inexistent',
  location_type_code: 'optical_store',
  care_setting_code: 'retail',
});
assert.equal(invalidOrganizationType.organization_type_invalid, true);
assert.ok(validateNormalizedDirectoryRow(invalidOrganizationType).errors.includes('invalid_explicit_organization_type'));

const conflict = normalizeDirectoryImportRow({
  location_display_name: 'Clinica neclara',
  organization_display_name: 'Retea neclara',
  official_locality: 'Iasi',
  county_if_confirmed: 'Iasi',
  siruta: '95060',
  confirmed_address: 'Str. Test nr. 1',
  official_source_url: 'https://example.com',
  research_status: 'official_partial',
  operational_status: 'active_confirmed',
  import_readiness: 'blocked_conflict',
  confirmed_activity_category: 'clinica oftalmologica',
});
assert.ok(validateNormalizedDirectoryRow(conflict).errors.includes('research_conflict_requires_review'));

const pseudo = normalizeDirectoryImportRow({
  location_display_name: 'Locatii deja descoperite in registru',
  organization_display_name: 'Retea',
  official_locality: 'Bucuresti',
  confirmed_address: '',
  official_source_url: 'https://example.com',
});
assert.equal(pseudo.pseudo_row_reason, 'aggregate_or_summary_row');
assert.equal(validateNormalizedDirectoryRow(pseudo).valid, false);

const aggregateNetwork = normalizeDirectoryImportRow({
  location_display_name: 'Lensa',
  organization_display_name: 'Lensa',
  official_locality: '~25+',
  confirmed_address: '',
  research_status: 'discovery_only',
  import_readiness: 'blocked_missing_data',
});
assert.equal(aggregateNetwork.pseudo_row_reason, 'aggregate_count_row');
assert.equal(validateNormalizedDirectoryRow(aggregateNetwork).valid, false);

const legitimateTotalBrand = normalizeDirectoryImportRow({
  location_display_name: 'Total Clinic Barlad — Oftalmologie',
  organization_display_name: 'Total Clinic',
  official_locality: 'Barlad',
  county_if_confirmed: 'Vaslui',
  locality_siruta_code: '161794',
  confirmed_address: 'Str. Republicii nr. 1',
  official_source_url: 'https://example.com/total-clinic',
  research_status: 'official_confirmed',
  operational_status: 'active_confirmed',
  import_readiness: 'candidate_for_manual_review',
  provider_type: 'clinica_oftalmologica',
  provider_profile_type: 'ophthalmology_clinic',
  organization_type_code: 'multi_specialty_healthcare_provider',
  location_type_code: 'multi_specialty_clinic',
  care_setting_code: 'outpatient',
});
assert.equal(legitimateTotalBrand.pseudo_row_reason, '');
assert.equal(validateNormalizedDirectoryRow(legitimateTotalBrand).valid, true);

const aggregateTotal = normalizeDirectoryImportRow({
  location_display_name: 'Total 25 locatii',
  organization_display_name: 'Retea',
  official_locality: 'Bucuresti',
  confirmed_address: '',
  official_source_url: 'https://example.com',
});
assert.equal(aggregateTotal.pseudo_row_reason, 'aggregate_or_summary_row');
assert.equal(validateNormalizedDirectoryRow(aggregateTotal).valid, false);

assert.equal(batchApprovalToken('DIR-TEST-001', 'abcdef1234567890', 3), 'IMPORT DIR-TEST-001 abcdef123456 3');
assert.equal(rollbackApprovalToken('DIR-TEST-001', 3), 'ROLLBACK DIR-TEST-001 3');

const markdown = `
| location_display_name | organization_display_name | official_locality | confirmed_address |
|---|---|---|---|
| Optica 1 | Retea | Sibiu | Str. A nr. 1 |

| location_display_name | organization_display_name | official_locality | confirmed_address |
|---|---|---|---|
| Optica 2 | Retea | Sibiu | Str. B nr. 2 |
`;
const markdownRows = parseDirectorySource(markdown, 'markdown');
assert.equal(markdownRows.length, 2);
assert.deepEqual(sourceColumns(markdownRows).sort(), ['confirmed_address', 'location_display_name', 'official_locality', 'organization_display_name'].sort());

const batchSchema = JSON.parse(await readFile(new URL('../base44/entities/DirectoryImportBatch.jsonc', import.meta.url), 'utf8'));
const rowSchema = JSON.parse(await readFile(new URL('../base44/entities/DirectoryImportRow.jsonc', import.meta.url), 'utf8'));
const snapshotSchema = JSON.parse(await readFile(new URL('../base44/entities/DirectorySourceSnapshot.jsonc', import.meta.url), 'utf8'));
const mutationSchema = JSON.parse(await readFile(new URL('../base44/entities/DirectoryImportMutation.jsonc', import.meta.url), 'utf8'));
assert.ok(batchSchema.properties.execution_lock_token);
assert.ok(batchSchema.properties.approved_at);
assert.ok(rowSchema.properties.idempotency_key);
assert.ok(rowSchema.properties.admin_override_json);
assert.equal(snapshotSchema.properties.status.enum.includes('imported'), true);
assert.equal(mutationSchema.properties.rollback_status.enum.includes('failed'), true);
assert.deepEqual(snapshotSchema.rls.read.user_condition, { role: 'admin' });
assert.deepEqual(mutationSchema.rls.write.user_condition, { role: 'admin' });

const backend = await readFile(new URL('../base44/functions/directoryOps/directoryImportOps.ts', import.meta.url), 'utf8');
const ui = await readFile(new URL('../src/components/admin/directory/DirOpsImportPipeline.jsx', import.meta.url), 'utf8');
const parser = await readFile(new URL('../src/lib/directoryImportFileParser.js', import.meta.url), 'utf8');
const nav = await readFile(new URL('../src/lib/adminNavConfig.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/AdminDirectoryOps.jsx', import.meta.url), 'utf8');
const sharedPipeline = await readFile(new URL('../shared/directoryImportPipeline.js', import.meta.url), 'utf8');
const base44Pipeline = await readFile(new URL('../base44/shared/directoryImportPipeline.js', import.meta.url), 'utf8');
const sharedBatchPlanning = await readFile(new URL('../shared/directoryBatchOrganizationPlanning.js', import.meta.url), 'utf8');
const base44BatchPlanning = await readFile(new URL('../base44/shared/directoryBatchOrganizationPlanning.js', import.meta.url), 'utf8');

assert.equal(base44Pipeline, sharedPipeline);
assert.equal(base44BatchPlanning, sharedBatchPlanning);
assert.match(sharedPipeline, /DIRECTORY_CLASSIFICATION_CONTRACT_VERSION/);
assert.match(sharedPipeline, /organization_type_code/);
assert.match(sharedPipeline, /county_code/);
assert.match(sharedPipeline, /uat_code/);
assert.match(sharedPipeline, /uat_name/);
assert.match(sharedPipeline, /location_type_code; network\/brand identity belongs to organization_type_code/);
assert.match(backend, /user\.role !== 'admin'/);
assert.match(backend, /batchApprovalToken/);
assert.match(backend, /clean\(input\.confirmation, 240\) !== expected/);
assert.match(backend, /immutable_at/);
assert.match(backend, /DIRECTORY_IMPORT_MAX_CHUNK_SIZE/);
assert.match(backend, /planBatch/);
assert.match(backend, /batchApprovalToken/);
assert.match(backend, /execution_lock_token/);
assert.match(backend, /CONTROLLED_PROFILES/);
assert.match(backend, /DirectoryImportMutation/);
assert.match(backend, /equalFieldSubset/);
assert.match(backend, /rollbackMutation/);
assert.match(backend, /public_visibility_status: 'draft'/);
assert.match(backend, /profile_control_status: 'directory'/);
assert.match(backend, /request_intake_status: 'inactive'/);
assert.match(backend, /resolveProviderOrganizationType/);
assert.match(backend, /'organization_type_code', 'location_type_code'/);
assert.match(backend, /resolveDirectoryOrganizationCanonicalPayload/);
assert.doesNotMatch(backend, /row\.provider_profile_type === 'optical_chain'/);
assert.match(backend, /planDirectoryOrganizationReconciliation/);
assert.match(backend, /update_directory_organization/);
assert.match(backend, /reuse_planned_organization/);
assert.match(backend, /use_admin_target_organization/);
assert.match(backend, /target_organization_id/);
assert.match(backend, /planned_new_organization_count/);
assert.match(backend, /updates_controlled_organizations: false/);
assert.match(backend, /directory_import_organization_updated/);
assert.match(backend, /Organizatia s-a schimbat dupa dry-run/);
assert.match(backend, /planDirectoryLocationReconciliation/);
assert.match(backend, /resolveDirectoryLocationUpdatePayload/);
assert.match(backend, /resolveDirectoryStateUpdatePayload/);
assert.match(backend, /directory_import_evidence_superseded/);
assert.match(backend, /evidence_status: 'superseded'/);
assert.match(backend, /Locatia s-a schimbat dupa dry-run/);
assert.match(backend, /requireDirectoryRows/);
assert.match(backend, /getDirectoryEntityOrNull/);
assert.match(backend, /persistBatchInterruption/);
assert.match(backend, /resumeBatchAfterTransientFailure/);
assert.match(backend, /repairTransientRowArtifacts/);
assert.match(backend, /recoverCreateMutation/);
assert.match(backend, /executionProgressFromRows\(reconciledRows, mutations\)/);
assert.match(backend, /isTransientDirectoryExecutionFailure\(error\)/);
assert.match(backend, /EXECUTION_CHUNK = 5/);
assert.match(backend, /retryableFailure \? 503 : 500/);
assert.doesNotMatch(backend, /\.catch\(\(\) => \[\]\)/);
assert.doesNotMatch(backend, /locationComparablePayload/);
assert.match(backend, /FINALIZATION_CHUNK = 50/);
assert.match(backend, /PLANNING_CHUNK = 50/);
assert.match(backend, /boundedChunkSize/);
assert.match(backend, /snapshotDuplicateKey/);
assert.match(backend, /remaining_rows: remainingRows/);
assert.doesNotMatch(backend, /LocationService\.create|ProfessionalProfile\.create|ProviderMembership\.create/);

assert.match(ui, /directoryImportOps/);
assert.match(ui, /target_organization_id/);
assert.match(ui, /mapare explicita/);
assert.match(ui, /Snapshot imuabil/);
assert.match(ui, /Confirmare pentru import/);
assert.match(ui, /Genereaza dry-run nou/);
assert.match(ui, /batch\.failure_message/);
assert.match(ui, /retryableDryRunFailure/);
assert.match(ui, /Pregateste reluarea/);
assert.match(ui, /resume_batch/);
assert.match(ui, /EXECUTION_CHUNK_SIZE = 5/);
assert.match(ui, /RECOVERY_CHUNK_SIZE = 1/);
assert.match(ui, /EXECUTION_PAUSE_MS = 2500/);
assert.match(ui, /Pana la final, cu pauze/);
assert.match(ui, /Rollback controlat/);
assert.match(ui, /finishSnapshotValidation/);
assert.match(ui, /snapshot\.status !== "validating"/);
assert.match(ui, /Continua validarea/);
assert.match(ui, /s-a oprit fara progres/);
assert.match(ui, /sm:w-auto/);
assert.match(ui, /xl:grid-cols-\[320px_minmax\(0,1fr\)\]/);
assert.match(parser, /parseMarkdownTables/);
assert.match(parser, /crypto\.subtle\.digest\("SHA-256"/);
assert.match(nav, /key: "import_directory"/);
assert.match(page, /DirOpsImportPipeline/);

console.log('Directory import pipeline contract verified.');
