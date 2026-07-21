import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTORY_FUNCTION_ROUTES } from '../base44/shared/directoryFunctionRouting.js';
import {
  SERVICE_CONFIGURATION_FUNCTION_ENDPOINT,
  SERVICE_CONFIGURATION_FUNCTION_ROUTES,
} from '../base44/shared/serviceConfigurationFunctionRouting.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../base44/shared/providerWorkspaceFunctionRouting.js';
import { installBase44FunctionRouting } from '../src/api/base44FunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(root, 'base44/functions');
const routerRoot = path.join(functionsRoot, SERVICE_CONFIGURATION_FUNCTION_ENDPOINT);
const expectedLogicalNames = [
  'getProviderServiceConfiguration',
  'getProviderLocationServices',
  'copyProviderServiceConfiguration',
  'copyProviderOpeningHours',
  'saveProviderOperatingHours',
  'saveProviderRoutineProfile',
  'submitProviderWorkspaceChange',
  'manageProviderOrganizationProfile',
  'profileFoundationOps',
  'locationPhotoOps',
  'providerPhotoUploadLifecycleOps',
  'preserveLegacyLocationLogo',
  'submitProviderLogoForReview',
].sort();
const logicalNames = Object.keys(SERVICE_CONFIGURATION_FUNCTION_ROUTES).sort();

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

assert.equal(physicalEndpoints.length, 48, 'Suprafata Base44 trebuie sa contina exact 48 de functii fizice dupa PR 3');
assert.deepEqual(logicalNames, expectedLogicalNames, 'Contractul trebuie sa pastreze exact cele 13 nume logice aprobate');
assert.ok(physicalEndpoints.includes(SERVICE_CONFIGURATION_FUNCTION_ENDPOINT), 'Endpointul providerServiceConfigurationOps trebuie sa existe');

const routerSource = source('base44/functions/providerServiceConfigurationOps/router.ts');
for (const logicalName of logicalNames) {
  assert.equal(SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName], SERVICE_CONFIGURATION_FUNCTION_ENDPOINT);
  assert.ok(existsSync(path.join(routerRoot, `${logicalName}.ts`)), `Modul local lipsa pentru ${logicalName}`);
  assert.ok(!existsSync(path.join(functionsRoot, logicalName, 'entry.ts')), `Endpointul vechi ${logicalName} nu a fost eliminat`);
  assert.match(routerSource, new RegExp(`${logicalName}:\\s*${logicalName}Handle`), `Handlerul ${logicalName} nu este in router`);
  const moduleSource = source(`base44/functions/providerServiceConfigurationOps/${logicalName}.ts`);
  assert.match(moduleSource, /export async function handle\(req: Request\)/, `${logicalName} nu exporta handlerul local`);
  assert.doesNotMatch(moduleSource, /Deno\.serve\(/, `${logicalName} nu trebuie sa fie deployabil separat`);
}

const entrySource = source('base44/functions/providerServiceConfigurationOps/entry.ts');
assert.match(entrySource, /Deno\.serve\(handleProviderServiceConfigurationRequest\)/);
assert.equal((entrySource.match(/Deno\.serve\(/g) || []).length, 1, 'Routerul trebuie sa aiba un singur entrypoint deployabil');
assert.match(routerSource, /return providerServiceConfigurationOpsHandle\(req\)/, 'Contractul existent providerServiceConfigurationOps trebuie pastrat');
assert.match(routerSource, /status: 404/, 'Numele logice necunoscute trebuie respinse explicit');

const clientSource = source('src/api/base44Client.js');
const frontendRoutingSource = source('src/api/base44FunctionRouting.js');
assert.match(clientSource, /installBase44FunctionRouting\(rawBase44\)/);
assert.match(frontendRoutingSource, /invokeServiceConfigurationFunction\(client, logicalName, payload\)/);

const invocations = [];
const routedClient = installBase44FunctionRouting({
  functions: {
    invoke(functionName, payload) {
      invocations.push({ functionName, payload });
      return Promise.resolve({ functionName, payload });
    },
  },
});
await routedClient.functions.invoke('copyProviderOpeningHours', { source_location_id: 'loc-1' });
await routedClient.functions.invoke('directoryImportOps', { action: 'list_snapshots' });
await routedClient.functions.invoke('providerServiceConfigurationOps', { action: 'list_mine' });
assert.deepEqual(invocations[0], {
  functionName: 'providerServiceConfigurationOps',
  payload: { __function: 'copyProviderOpeningHours', payload: { source_location_id: 'loc-1' } },
});
assert.deepEqual(invocations[1], {
  functionName: 'directoryOps',
  payload: { __function: 'directoryImportOps', payload: { action: 'list_snapshots' } },
});
assert.deepEqual(invocations[2], {
  functionName: 'providerServiceConfigurationOps',
  payload: { action: 'list_mine' },
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
    if (relative.startsWith('base44/functions/') && !relative.startsWith('base44/functions/providerServiceConfigurationOps/') && SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName]) {
      staleBackendInvocations.push(`${relative}:${logicalName}`);
    }
  }
}
assert.deepEqual(missingRoutes, [], `Functii logice fara ruta sau endpoint: ${missingRoutes.join(', ')}`);
assert.deepEqual(staleBackendInvocations, [], `Invocari backend ramase pe endpointuri eliminate: ${staleBackendInvocations.join(', ')}`);

const routerBytes = sourceFiles(routerRoot).reduce((sum, file) => sum + statSync(file).size, 0);
console.log(JSON.stringify({
  physical_function_count: physicalEndpoints.length,
  service_configuration_logical_route_count: logicalNames.length,
  service_configuration_router_bytes: routerBytes,
  service_configuration_router_files: sourceFiles(routerRoot).length,
}, null, 2));
