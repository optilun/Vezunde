import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRECTORY_FUNCTION_ENDPOINT,
  DIRECTORY_IMPORT_FUNCTION_ENDPOINT,
  DIRECTORY_FUNCTION_ROUTES,
} from '../base44/shared/directoryFunctionRouting.js';
import { SERVICE_CONFIGURATION_FUNCTION_ROUTES } from '../base44/shared/serviceConfigurationFunctionRouting.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../base44/shared/providerWorkspaceFunctionRouting.js';
import { installBase44FunctionRouting } from '../src/api/base44FunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(root, 'base44/functions');
const routerRoot = path.join(functionsRoot, DIRECTORY_FUNCTION_ENDPOINT);
const logicalNames = Object.keys(DIRECTORY_FUNCTION_ROUTES).sort();

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sourceFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(absolute));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

const physicalEndpoints = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(functionsRoot, entry.name, 'entry.ts')))
  .map((entry) => entry.name)
  .sort();

assert.equal(physicalEndpoints.length, 48, 'Suprafata Base44 trebuie sa contina exact 48 de functii fizice dupa folosirea bridge-ului existent');
assert.equal(logicalNames.length, 18, 'Contractul directory trebuie sa pastreze exact cele 18 nume logice consolidate');
assert.ok(physicalEndpoints.includes(DIRECTORY_FUNCTION_ENDPOINT), 'Endpointul fizic directoryOps trebuie sa existe');
assert.ok(physicalEndpoints.includes(DIRECTORY_IMPORT_FUNCTION_ENDPOINT), 'Endpointul fizic dedicat importului trebuie sa existe');

const routerSource = source('base44/functions/directoryOps/router.ts');
for (const logicalName of logicalNames) {
  const expectedEndpoint = logicalName === 'directoryImportOps'
    ? DIRECTORY_IMPORT_FUNCTION_ENDPOINT
    : DIRECTORY_FUNCTION_ENDPOINT;
  assert.equal(DIRECTORY_FUNCTION_ROUTES[logicalName], expectedEndpoint);
  assert.ok(existsSync(path.join(routerRoot, `${logicalName}.ts`)), `Modul local lipsa pentru ${logicalName}`);
  assert.ok(!existsSync(path.join(functionsRoot, logicalName, 'entry.ts')), `Endpointul vechi ${logicalName} nu a fost reintrodus`);
  assert.match(routerSource, new RegExp(`${logicalName}:\\s*${logicalName}Handle`), `Handlerul ${logicalName} nu este in router`);
  const moduleSource = source(`base44/functions/directoryOps/${logicalName}.ts`);
  assert.match(moduleSource, /export async function handle\(req: Request\)/, `${logicalName} nu exporta handlerul local`);
  assert.doesNotMatch(moduleSource, /Deno\.serve\(/, `${logicalName} nu trebuie sa fie deployabil separat`);
}

const entrySource = source('base44/functions/directoryOps/entry.ts');
assert.match(entrySource, /Deno\.serve\(handleDirectoryRequest\)/);
assert.equal((entrySource.match(/Deno\.serve\(/g) || []).length, 1, 'directoryOps trebuie sa aiba un singur entrypoint deployabil');
assert.match(routerSource, /return directoryOpsHandle\(req\)/, 'Contractul existent directoryOps trebuie pastrat pentru apelurile directe');
assert.match(routerSource, /status: 404/, 'Numele logice necunoscute trebuie respinse explicit');

const bridgeRoot = 'base44/functions/listProviderMemberInvitations';
const bridgeEntrySource = source(`${bridgeRoot}/entry.ts`);
assert.match(bridgeEntrySource, /Bundled single-file Base44 function/);
assert.match(bridgeEntrySource, /viasee-directory-import-single-file-5/);
assert.match(bridgeEntrySource, /directory-import-runtime-extended-organization-types-3/);
assert.match(bridgeEntrySource, /supports_extended_organization_types:\s*true/);
assert.match(bridgeEntrySource, /reconciles_directory_organizations:\s*true/);
assert.doesNotMatch(bridgeEntrySource, /from ['"]\.\.?\//, 'Functia Base44 trebuie sa fie complet autonoma, fara importuri locale');
assert.match(bridgeEntrySource, /DIRECTORY_IMPORT_LOGICAL_NAME/);
assert.match(bridgeEntrySource, /handleInvitationList/);
assert.equal(
  bridgeEntrySource,
  source('.tmp/listProviderMemberInvitations.entry.bundle.ts'),
  'Bundle-ul verificat si entrypointul Base44 trebuie sa fie identice',
);

for (const fileName of [
  'directoryImportOps.ts',
  'directoryImportOpsLocationFirst.ts',
  'directoryImportOpsLatest.ts',
]) {
  assert.ok(
    !existsSync(path.join(root, bridgeRoot, fileName)),
    `${fileName} nu trebuie sa existe ca utilitar separat in /functions`,
  );
}

const clientSource = source('src/api/base44Client.js');
const frontendRoutingSource = source('src/api/base44FunctionRouting.js');
assert.match(clientSource, /installBase44FunctionRouting\(rawBase44\)/);
assert.match(frontendRoutingSource, /invokeDirectoryFunction\(client, logicalName, payload\)/);

const invocations = [];
const routedClient = installBase44FunctionRouting({
  functions: {
    invoke(functionName, payload) {
      invocations.push({ functionName, payload });
      return Promise.resolve({ functionName, payload });
    },
  },
});
await routedClient.functions.invoke('directoryImportOps', { action: 'list_snapshots' });
await routedClient.functions.invoke('getPublicProviderProfile', { location_id: 'loc-1' });
assert.deepEqual(invocations[0], {
  functionName: 'listProviderMemberInvitations',
  payload: { __function: 'directoryImportOps', payload: { action: 'list_snapshots' } },
});
assert.deepEqual(invocations[1], {
  functionName: 'getPublicProviderProfile',
  payload: { location_id: 'loc-1' },
});

const scannedFiles = [
  ...sourceFiles(path.join(root, 'src')),
  ...sourceFiles(functionsRoot),
];
const missingRoutes = [];
const staleBackendInvocations = [];
for (const absolute of scannedFiles) {
  const content = readFileSync(absolute, 'utf8');
  const relative = path.relative(root, absolute);
  const invocationPattern = /\.functions\.invoke\(\s*['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(invocationPattern)) {
    const logicalName = match[1];
    if (!physicalEndpoints.includes(logicalName) && !DIRECTORY_FUNCTION_ROUTES[logicalName] && !SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName] && !PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName]) {
      missingRoutes.push(`${relative}:${logicalName}`);
    }
    if (relative.startsWith('base44/functions/') && !relative.startsWith('base44/functions/directoryOps/') && DIRECTORY_FUNCTION_ROUTES[logicalName]) {
      staleBackendInvocations.push(`${relative}:${logicalName}`);
    }
  }
}
assert.deepEqual(missingRoutes, [], `Functii logice fara ruta sau endpoint: ${missingRoutes.join(', ')}`);
assert.deepEqual(staleBackendInvocations, [], `Invocari backend ramase pe endpointuri eliminate: ${staleBackendInvocations.join(', ')}`);

for (const relativePath of [
  'base44/functions/directoryOps/adminServiceConfigurationReview.ts',
  'base44/functions/directoryOps/adminServicePrerequisiteReview.ts',
]) {
  const content = source(relativePath);
  assert.match(content, /invokeDirectoryFunction\(base44, 'adminWorkspaceReview'/);
}

const routerBytes = sourceFiles(routerRoot).reduce((sum, file) => sum + statSync(file).size, 0);
console.log(JSON.stringify({
  physical_function_count: physicalEndpoints.length,
  directory_logical_route_count: logicalNames.length,
  directory_router_bytes: routerBytes,
  directory_router_files: sourceFiles(routerRoot).length,
  directory_import_endpoint: DIRECTORY_IMPORT_FUNCTION_ENDPOINT,
  directory_import_self_contained: true,
}, null, 2));
