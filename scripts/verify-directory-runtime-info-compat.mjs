import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync('base44/functions/directoryOps/directoryImportOpsLocationFirst.ts', 'utf8');
const latestAdapter = readFileSync('base44/functions/directoryOps/directoryImportOpsLatest.ts', 'utf8');
const frontendRouter = readFileSync('src/api/base44FunctionRouting.js', 'utf8');
// Importul are doua straturi, fiecare cu revizia lui:
//  - LocationFirst = implementarea interioara ('read-safe-6'); revizia ei nu ajunge
//    niciodata la frontend, pentru ca stratul de deasupra intercepteaza `runtime_info`.
//  - Latest = stratul activ, dispecerizat de router si de bundle ('national-directory-5');
//    el raspunde la `runtime_info`, deci ACEASTA revizie trebuie sa fie cea pe care o
//    asteapta frontend-ul.
// Testul cerea aceeasi valoare in toate cele trei fisiere, ceea ce nu mai reflecta
// arhitectura de dupa 2026-07-31 si a mascat un handshake rupt in productie.
const LOCATION_FIRST_REVISION = 'directory-import-runtime-read-safe-6';
const ACTIVE_RUNTIME_REVISION = 'directory-import-runtime-national-directory-5';

assert.match(adapter, new RegExp(`DIRECTORY_IMPORT_RUNTIME_REVISION = '${LOCATION_FIRST_REVISION}'`));
assert.match(latestAdapter, new RegExp(`DIRECTORY_IMPORT_RUNTIME_REVISION = '${ACTIVE_RUNTIME_REVISION}'`));
// Handshake-ul care conteaza: frontend-ul trebuie sa astepte exact revizia stratului activ.
assert.match(frontendRouter, new RegExp(`DIRECTORY_IMPORT_RUNTIME_REVISION = '${ACTIVE_RUNTIME_REVISION}'`));
assert.match(adapter, /clean\(input\.action, 80\) === 'runtime_info'/);
assert.match(adapter, /preserves_explicit_location_type: true/);
assert.match(adapter, /preserves_explicit_organization_type: true/);
assert.match(adapter, /supports_extended_organization_types: true/);
assert.match(adapter, /reconciles_directory_organizations: true/);
assert.match(adapter, /rejects_address_only_location_match: true/);
assert.match(adapter, /rejects_ambiguous_organization_match: true/);
assert.match(adapter, /chunked_snapshot_finalization: true/);
assert.match(adapter, /chunked_batch_planning: true/);
assert.match(adapter, /reconciles_existing_location_metadata: true/);
assert.match(adapter, /reconciles_directory_state: true/);
assert.match(adapter, /reconciles_directory_evidence: true/);
assert.match(adapter, /preserves_directory_publication_state: true/);
assert.match(adapter, /preserves_existing_optional_fields: true/);
assert.match(adapter, /fails_closed_on_directory_read_errors: true/);
console.log('directory runtime info compatibility verified');
