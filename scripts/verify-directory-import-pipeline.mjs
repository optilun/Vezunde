import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
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
assert.equal(normalized.location_name, 'Optica Test Centru');
assert.equal(normalized.provider_type, 'optica_medicala');
assert.equal(normalized.provider_profile_type, 'independent_optical_store');
assert.equal(normalized.location_type_code, 'optical_store');
assert.equal(normalized.operational_status, 'active');
assert.equal(normalized.publication_status, 'draft');
assert.equal(normalized.control_status, 'directory');
assert.ok(normalized.location_external_key.startsWith('loc:'));
assert.ok(normalized.address_fingerprint.startsWith('addr:'));
assert.equal(validateNormalizedDirectoryRow(normalized).valid, true);

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

const backend = await readFile(new URL('../base44/function_modules/directoryImportOps.ts', import.meta.url), 'utf8');
const ui = await readFile(new URL('../src/components/admin/directory/DirOpsImportPipeline.jsx', import.meta.url), 'utf8');
const parser = await readFile(new URL('../src/lib/directoryImportFileParser.js', import.meta.url), 'utf8');
const nav = await readFile(new URL('../src/lib/adminNavConfig.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/AdminDirectoryOps.jsx', import.meta.url), 'utf8');

assert.match(backend, /user\.role !== 'admin'/);
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
