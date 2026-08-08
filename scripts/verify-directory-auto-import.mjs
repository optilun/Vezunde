import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const auto = read('base44/functions/directoryOps/directoryAutoImportOps.ts');
const importOps = read('base44/functions/directoryOps/directoryImportOps.ts');
const importPipeline = read('base44/shared/directoryImportPipeline.js');
const browseDirectory = read('base44/functions/browseDirectoryProviders/entry.ts');
const latest = read('base44/functions/directoryOps/directoryImportOpsLatest.ts');
const bridge = read('scripts/bridge-sources/listProviderMemberInvitations.entry.ts');
const deployed = read('base44/functions/listProviderMemberInvitations/entry.ts');
const ui = read('src/components/admin/directory/DirOpsImportPipeline.jsx');
const runSchema = JSON.parse(read('base44/entities/DirectoryAutoImportRun.jsonc'));
const itemSchema = JSON.parse(read('base44/entities/DirectoryAutoImportItem.jsonc'));
const payloadChunkSchema = JSON.parse(read('base44/entities/DirectoryAutoImportPayloadChunk.jsonc'));
const functionConfig = JSON.parse(read('base44/functions/listProviderMemberInvitations/function.jsonc'));
assert.equal(fs.existsSync('base44/entities/_noop_invalid.jsonc'), false, 'Schema temporara invalida nu trebuie publicata.');

assert.equal(runSchema.name, 'DirectoryAutoImportRun');
assert.equal(itemSchema.name, 'DirectoryAutoImportItem');
assert.equal(payloadChunkSchema.name, 'DirectoryAutoImportPayloadChunk');
for (const field of ['run_id', 'item_key', 'chunk_index', 'chunk_count', 'payload_chunk', 'payload_sha256']) {
  assert.ok(payloadChunkSchema.properties[field], `Lipseste campul payloadChunk.${field}`);
}
for (const field of ['run_key', 'campaign_mode', 'publication_mode', 'status', 'package_sha256', 'current_step', 'failure_message', 'skipped_batches', 'excluded_rows']) {
  assert.ok(runSchema.properties[field], `Lipseste campul run.${field}`);
}
for (const field of ['run_id', 'sequence', 'status', 'step', 'source_url', 'source_sha256', 'selected_sha256', 'snapshot_id', 'batch_id', 'source_rows', 'selected_rows', 'excluded_rows', 'selection_result_json', 'source_payload_json']) {
  assert.ok(itemSchema.properties[field], `Lipseste campul item.${field}`);
}

assert.match(auto, /DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION = 'viasee-directory-auto-import-v2'/);
assert.match(auto, /const MAX_ROWS_PER_BATCH = 40/);
assert.match(auto, /unzipSync/);
assert.match(auto, /descriptorsFromZipBase64/);
assert.match(auto, /archive:\/\//);
assert.match(auto, /source_payload_json/);
assert.match(auto, /PAYLOAD_CHUNK_SIZE = 12_000/);
assert.match(auto, /persistPayloadChunks/);
assert.match(auto, /loadPayloadChunks/);
assert.match(auto, /DirectoryAutoImportPayloadChunk\.filter/);
assert.match(latest, /repairs_partial_preflight_runs:\s*true/);
assert.match(latest, /scheduled_runner_uses_cron:\s*true/);
assert.match(latest, /accepts_multiple_automation_payload_shapes:\s*true/);
assert.match(latest, /browser_watchdog_fallback:\s*true/);
assert.match(auto, /loadItemSourceRows/);
assert.match(auto, /const EXECUTION_CHUNK = 5/);
assert.match(auto, /requires_zero_snapshot_warnings: mode === CAMPAIGN_MODE_STRICT/);
assert.match(auto, /exact_external_key_required_for_existing_organization: true/);
assert.match(auto, /function automaticSelectionReasons/);
assert.match(auto, /candidate_for_manual_review/);
assert.match(auto, /research_not_official_confirmed/);
assert.match(auto, /operational_status_not_active_confirmed/);
assert.match(auto, /review_flags_present/);
assert.match(auto, /skipped_no_strictly_clean_rows/);
assert.match(auto, /canonical_type_not_explicit/);
assert.match(auto, /organization_type_not_explicit/);
assert.match(auto, /needs-review\|excluded\|audit\|report\|manifest/);
assert.match(auto, /snapshot_has_duplicates/);
assert.match(auto, /existing_organization_external_key_mismatch/);
assert.match(auto, /resumeBatchAfterTransientFailure/);
assert.match(auto, /automaticSelectionReasons/);
assert.match(auto, /enrichRowsWithCanonicalGeography/);
assert.match(auto, /GeographicLocality\.filter/);
assert.match(auto, /geography_siruta_not_found/);
assert.match(auto, /geography_county_mismatch/);
assert.match(auto, /selectRowsForAutomaticImport\(canonicalRows\)/);
assert.match(auto, /const preparedDescriptors = \[\]/);
assert.match(auto, /selectedSha256 = await sha256HexText\(stableStringify\(selection\.selected\)\)/);
// Arhitectura verificarii s-a schimbat pe 2026-08-04 si e mai stricta, nu mai slaba:
// selectia se face O SINGURA DATA la preflight (createRun), iar subsetul aprobat se
// persista in fragmente. La executie nu se mai re-ruleaza filtrul (ceea ce ar putea da
// alt rezultat daca datele de referinta s-au schimbat intre timp), ci se verifica:
//   1. numarul de randuri (`selected_rows_changed`, mai jos)
//   2. integritatea criptografica a payloadului persistat (SHA per fragment, in
//      loadPayloadChunks - vezi assert-ul dedicat)
assert.match(auto, /selected_rows_changed/);
assert.match(auto, /actualSha256 !== clean\(chunks\[0\]\.payload_sha256, 80\)/);
assert.match(auto, /Analiza este partiala/);
assert.match(auto, /requires_repair:\s*true/);
assert.match(auto, /persistPayloadChunks/);
assert.match(auto, /skipped_no_strictly_clean_rows/);
assert.match(auto, /review_flags_present/);
assert.match(auto, /advance_auto_import_run_now/);
assert.match(auto, /__automation_trigger === true/);
assert.doesNotMatch(auto, /LocationService\.(create|update|delete)/);
assert.doesNotMatch(auto, /ProviderMembership\.(create|update|delete)/);

assert.match(latest, /handleDirectoryAutoImport/);
assert.match(latest, /advance_auto_import_runs/);
assert.match(bridge, /DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN/);
assert.match(bridge, /body\?\.args \|\| body\?\.payload\?\.args \|\| body \|\| \{\}/);
assert.match(bridge, /automationArgs\?\.automation_token === DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN/);
assert.match(bridge, /viasee-directory-import-single-file-15/);
assert.match(deployed, /viasee-directory-auto-import-v2/);
assert.match(deployed, /viasee-directory-import-single-file-15/);
assert.doesNotMatch(deployed, /from ['"]\.\.?\//);

assert.equal(functionConfig.name, 'listProviderMemberInvitations');
assert.equal(functionConfig.automations.length, 1);
const automation = functionConfig.automations[0];
assert.equal(automation.type, 'scheduled');
assert.equal(automation.name, 'viasee_directory_auto_import_runner_v2');
assert.equal(automation.schedule_type, 'cron');
assert.equal(automation.cron_expression, '*/5 * * * *');
assert.equal(automation.ends_type, 'after');
assert.equal(automation.ends_after_count, 400);
assert.equal(automation.function_args.action, 'advance_auto_import_runs');
assert.ok(automation.function_args.automation_token);

for (const action of [
  'list_auto_import_runs',
  'create_auto_import_run',
  'approve_auto_import_run',
  'pause_auto_import_run',
  'resume_auto_import_run',
  'cancel_auto_import_run',
  'advance_auto_import_run_now',
]) {
  assert.match(ui, new RegExp(action));
}
assert.match(ui, /Import automat controlat/);
assert.match(ui, /Aproba procesarea automata/);
assert.match(ui, /La fiecare 5 minute/);
assert.match(ui, /Excluse automat/);
assert.match(ui, /Fisier privat recomandat/);
assert.match(ui, /zip_base64/);
assert.match(ui, /attempt <= 5/);
assert.match(ui, /user-exception\|timeout\|timed out\|temporar/);
assert.match(ui, /incompletePreflight/);
assert.match(ui, /Repara analiza partiala/);
assert.match(ui, /window\.setInterval\(load, 30_000\)/);
assert.match(ui, /Watchdog import/);
assert.match(ui, /2 \* 60 \* 1000/);
assert.match(ui, /90_000/);
assert.match(ui, /national_directory/);
assert.match(ui, /Campanie nationala/);
assert.match(auto, /selectRowsForNationalDirectory/);
assert.match(auto, /excludeControlledOrAmbiguousLiveMatches/);
assert.match(auto, /reconcileNationalOrganizationKeys/);
assert.match(auto, /target_organization_id/);
assert.match(auto, /nationalRowsFromPrivateSourceBase64/);
assert.match(auto, /publish_batch/);
assert.match(auto, /publishCompletedBatchAsBasicDirectory/);
assert.match(auto, /stepIndex < 18/);
assert.match(auto, /existing_controlled_location/);
assert.match(importOps, /export async function publishCompletedBatchAsBasicDirectory/);
assert.match(importOps, /public_visibility_status: 'approved'/);
assert.match(importOps, /verification_state: 'unclaimed'/);
assert.match(importOps, /is_verified: false/);
assert.match(importOps, /directory_detail_level: basicApproved \? 'basic' : 'summary'/);
assert.doesNotMatch(importOps, /directory_profile_published_basic[\s\S]{0,2000}LocationService\.(create|update|delete)/);
assert.match(importPipeline, /target_organization_id: \["target_organization_id"\]/);
assert.match(importPipeline, /target_organization_id: fields\.target_organization_id/);
for (const profileType of ['independent_ophthalmologist', 'independent_optometrist', 'independent_optician', 'optical_laboratory_b2c']) {
  assert.match(browseDirectory, new RegExp(`'${profileType}'`));
}

console.log('Directory auto-import orchestrator contract verified.');
