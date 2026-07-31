import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const auto = read('base44/functions/directoryOps/directoryAutoImportOps.ts');
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
for (const field of ['run_key', 'status', 'package_sha256', 'current_step', 'failure_message', 'skipped_batches', 'excluded_rows']) {
  assert.ok(runSchema.properties[field], `Lipseste campul run.${field}`);
}
for (const field of ['run_id', 'sequence', 'status', 'step', 'source_url', 'source_sha256', 'selected_sha256', 'snapshot_id', 'batch_id', 'source_rows', 'selected_rows', 'excluded_rows', 'selection_result_json', 'source_payload_json']) {
  assert.ok(itemSchema.properties[field], `Lipseste campul item.${field}`);
}

assert.match(auto, /DIRECTORY_AUTO_IMPORT_CONTRACT_VERSION = 'viasee-directory-auto-import-v1'/);
assert.match(auto, /const MAX_ROWS_PER_BATCH = 40/);
assert.match(auto, /unzipSync/);
assert.match(auto, /descriptorsFromZipBase64/);
assert.match(auto, /archive:\/\//);
assert.match(auto, /source_payload_json/);
assert.match(auto, /loadItemSourceRows/);
assert.match(auto, /const EXECUTION_CHUNK = 5/);
assert.match(auto, /requires_zero_snapshot_warnings: true/);
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
assert.match(auto, /preflight_selection_changed/);
assert.match(auto, /skipped_no_strictly_clean_rows/);
assert.match(auto, /review_flags_present/);
assert.match(auto, /advance_auto_import_run_now/);
assert.match(auto, /__automation_trigger === true/);
assert.doesNotMatch(auto, /LocationService\.(create|update|delete)/);
assert.doesNotMatch(auto, /ProviderMembership\.(create|update|delete)/);

assert.match(latest, /handleDirectoryAutoImport/);
assert.match(latest, /advance_auto_import_runs/);
assert.match(bridge, /DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN/);
assert.match(bridge, /body\?\.args\?\.automation_token === DIRECTORY_AUTO_IMPORT_AUTOMATION_TOKEN/);
assert.match(bridge, /viasee-directory-import-single-file-12/);
assert.match(deployed, /viasee-directory-auto-import-v1/);
assert.match(deployed, /viasee-directory-import-single-file-12/);
assert.doesNotMatch(deployed, /from ['"]\.\.?\//);

assert.equal(functionConfig.name, 'listProviderMemberInvitations');
assert.equal(functionConfig.automations.length, 1);
const automation = functionConfig.automations[0];
assert.equal(automation.type, 'scheduled');
assert.equal(automation.schedule_type, 'simple');
assert.equal(automation.repeat_unit, 'minutes');
assert.equal(automation.repeat_interval, 5);
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
assert.match(ui, /Arhiva privata ZIP recomandata/);
assert.match(ui, /zip_base64/);

console.log('Directory auto-import orchestrator contract verified.');
