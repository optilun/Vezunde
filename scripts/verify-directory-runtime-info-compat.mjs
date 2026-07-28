import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync('base44/functions/directoryOps/directoryImportOpsLocationFirst.ts', 'utf8');
assert.match(adapter, /DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-latest-1'/);
assert.match(adapter, /clean\(input\.action, 80\) === 'runtime_info'/);
assert.match(adapter, /preserves_explicit_location_type: true/);
assert.match(adapter, /preserves_explicit_organization_type: true/);
console.log('directory runtime info compatibility verified');
