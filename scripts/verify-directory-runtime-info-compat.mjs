import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync('base44/functions/directoryOps/directoryImportOpsLocationFirst.ts', 'utf8');
assert.match(adapter, /DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-identity-safe-4'/);
assert.match(adapter, /clean\(input\.action, 80\) === 'runtime_info'/);
assert.match(adapter, /preserves_explicit_location_type: true/);
assert.match(adapter, /preserves_explicit_organization_type: true/);
assert.match(adapter, /supports_extended_organization_types: true/);
assert.match(adapter, /reconciles_directory_organizations: true/);
assert.match(adapter, /rejects_address_only_location_match: true/);
assert.match(adapter, /rejects_ambiguous_organization_match: true/);
assert.match(adapter, /chunked_snapshot_finalization: true/);
assert.match(adapter, /chunked_batch_planning: true/);
console.log('directory runtime info compatibility verified');
