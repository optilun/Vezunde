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

assert.equal(DIRECTORY_IMPORT_CONTRACT_VERSION, 'viasee-directory-import-v1');
assert.equal(DIRECTORY_CLASSIFICATION_CONTRACT_VERSION, 'viasee-directory-location-first-v1');

const normalized = normalizeDirectoryImportRow({
  location_display_name: 'Optica Test Centru',
  organization_display_name: 'Optica Test',
  official_locality: 'Timisoara',
  county_if_confirmed: 'Timis',
  siruta: '155243',
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

assert.equal(base44Pipeline, sharedPipeline);
assert.match(sharedPipeline, /DIRECTORY_CLASSIFICATION_CONTRACT_VERSION/);
assert.match(sharedPipeline, /organization_type_code/);
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
assert.doesNotMatch(backend, /LocationService\.create|ProfessionalProfile\.create|ProviderMembership\.create/);

assert.match(ui, /directoryImportOps/);
assert.match(ui, /Snapshot imuabil/);
assert.match(ui, /Confirmare pentru import/);
assert.match(ui, /Rollback controlat/);
assert.match(ui, /sm:w-auto/);
assert.match(ui, /xl:grid-cols-\[320px_minmax\(0,1fr\)\]/);
assert.match(parser, /parseMarkdownTables/);
assert.match(parser, /crypto\.subtle\.digest\("SHA-256"/);
assert.match(nav, /key: "import_directory"/);
assert.match(page, /DirOpsImportPipeline/);

console.log('Directory import pipeline contract verified.');
