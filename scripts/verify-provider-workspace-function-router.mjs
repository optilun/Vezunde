import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIRECTORY_FUNCTION_ROUTES } from '../base44/shared/directoryFunctionRouting.js';
import { SERVICE_CONFIGURATION_FUNCTION_ROUTES } from '../base44/shared/serviceConfigurationFunctionRouting.js';
import {
  PROVIDER_WORKSPACE_FUNCTION_ENDPOINT,
  PROVIDER_WORKSPACE_FUNCTION_ROUTES,
} from '../base44/shared/providerWorkspaceFunctionRouting.js';
import { installBase44FunctionRouting } from '../src/api/base44FunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(root, 'base44/functions');
const routerRoot = path.join(functionsRoot, PROVIDER_WORKSPACE_FUNCTION_ENDPOINT);
const expectedLogicalNames = [
  'getMyAccountDeletionEligibility',
  'getMyProviderMembers',
  'getMyProviderOnboardingWorkspace',
  'getProviderEntitlement',
  'getProviderLocationComparison',
  'getProviderLogoReviewStatus',
  'getProviderProfileCompleteness',
  'getProviderWorkspaceOverview',
].sort();
const logicalNames = Object.keys(PROVIDER_WORKSPACE_FUNCTION_ROUTES).sort();

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
assert.deepEqual(logicalNames, expectedLogicalNames, 'Contractul trebuie sa pastreze exact cele 8 nume logice aprobate');
assert.equal(Object.keys(DIRECTORY_FUNCTION_ROUTES).length, 20, 'Cele 20 de rute directory trebuie pastrate (19 + adminFragmentedOrganizations, 2026-08-19)');
assert.equal(Object.keys(SERVICE_CONFIGURATION_FUNCTION_ROUTES).length, 13, 'Cele 13 rute service configuration trebuie pastrate');
assert.ok(physicalEndpoints.includes(PROVIDER_WORKSPACE_FUNCTION_ENDPOINT), 'Endpointul getMyProviderWorkspace trebuie sa existe');

const routerSource = source('base44/functions/getMyProviderWorkspace/router.ts');
for (const logicalName of logicalNames) {
  assert.equal(PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName], PROVIDER_WORKSPACE_FUNCTION_ENDPOINT);
  assert.ok(existsSync(path.join(routerRoot, `${logicalName}.ts`)), `Modul local lipsa pentru ${logicalName}`);
  assert.ok(!existsSync(path.join(functionsRoot, logicalName, 'entry.ts')), `Endpointul vechi ${logicalName} nu a fost eliminat`);
  assert.match(routerSource, new RegExp(`${logicalName}:\\s*${logicalName}Handle`), `Handlerul ${logicalName} nu este in router`);
  const moduleSource = source(`base44/functions/getMyProviderWorkspace/${logicalName}.ts`);
  assert.match(moduleSource, /export async function handle\(req: Request\)/, `${logicalName} nu exporta handlerul local`);
  assert.doesNotMatch(moduleSource, /Deno\.serve\(/, `${logicalName} nu trebuie sa fie deployabil separat`);
  assert.match(moduleSource, /createClientFromRequest\(req\)/, `${logicalName} trebuie sa pastreze clientul si autentificarea requestului`);
}

const entrySource = source('base44/functions/getMyProviderWorkspace/entry.ts');
const directSource = source('base44/functions/getMyProviderWorkspace/getMyProviderWorkspace.ts');
assert.match(entrySource, /Deno\.serve\(handleProviderWorkspaceRequest\)/);
assert.equal((entrySource.match(/Deno\.serve\(/g) || []).length, 1, 'Routerul trebuie sa aiba un singur entrypoint deployabil');
assert.match(routerSource, /if \(!logicalName\) return getMyProviderWorkspaceHandle\(req\)/, 'Implementarea directa getMyProviderWorkspace trebuie pastrata ca fallback');
assert.match(routerSource, /status: 404/, 'Numele logice necunoscute trebuie respinse explicit');
assert.match(directSource, /ProviderMembership\.filter\(\{ user_id: user\.id, status: 'active' \}/);
assert.match(directSource, /memberships\.length === 0/);
assert.match(directSource, /getApplicantPreparationWorkspace/);
assert.match(directSource, /organization_contexts:/);
assert.match(directSource, /assigned_location_ids:/);

const clientSource = source('src/api/base44Client.js');
const frontendRoutingSource = source('src/api/base44FunctionRouting.js');
assert.match(clientSource, /installBase44FunctionRouting\(rawBase44\)/);
assert.match(frontendRoutingSource, /invokeProviderWorkspaceFunction\(client, logicalName, payload\)/);

const invocations = [];
const routedClient = installBase44FunctionRouting({
  functions: {
    invoke(functionName, payload) {
      invocations.push({ functionName, payload });
      return Promise.resolve({ functionName, payload });
    },
  },
});
await routedClient.functions.invoke('getProviderWorkspaceOverview', { location_id: 'loc-1' });
await routedClient.functions.invoke('directoryImportOps', { action: 'list_snapshots' });
await routedClient.functions.invoke('copyProviderOpeningHours', { source_location_id: 'loc-1' });
await routedClient.functions.invoke('getMyProviderWorkspace', { selected_location_id: 'loc-1' });
assert.deepEqual(invocations[0], {
  functionName: 'getMyProviderWorkspace',
  payload: { __function: 'getProviderWorkspaceOverview', payload: { location_id: 'loc-1' } },
});
assert.deepEqual(invocations[1], {
  functionName: 'listProviderMemberInvitations',
  payload: { __function: 'directoryImportOps', payload: { action: 'list_snapshots' } },
});
assert.deepEqual(invocations[2], {
  functionName: 'providerServiceConfigurationOps',
  payload: { __function: 'copyProviderOpeningHours', payload: { source_location_id: 'loc-1' } },
});
assert.deepEqual(invocations[3], {
  functionName: 'getMyProviderWorkspace',
  payload: { selected_location_id: 'loc-1' },
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
    if (
      !physicalEndpoints.includes(logicalName)
      && !DIRECTORY_FUNCTION_ROUTES[logicalName]
      && !SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName]
      && !PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName]
    ) {
      missingRoutes.push(`${relative}:${logicalName}`);
    }
    if (relative.startsWith('base44/functions/') && PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName]) {
      staleBackendInvocations.push(`${relative}:${logicalName}`);
    }
  }
}
assert.deepEqual(missingRoutes, [], `Functii logice fara ruta sau endpoint: ${missingRoutes.join(', ')}`);
assert.deepEqual(staleBackendInvocations, [], `Invocari backend ramase pe endpointuri eliminate: ${staleBackendInvocations.join(', ')}`);

const roleSources = [
  source('base44/functions/getMyProviderWorkspace/getMyProviderMembers.ts'),
  source('base44/functions/getMyProviderWorkspace/getProviderLocationComparison.ts'),
  source('base44/functions/getMyProviderWorkspace/getProviderWorkspaceOverview.ts'),
].join('\n');
assert.match(roleSources, /organization_owner/);
assert.match(roleSources, /location_manager/);
assert.match(roleSources, /location_staff/);
assert.match(roleSources, /organization_id/);
assert.match(roleSources, /location_id/);

const routerFiles = sourceFiles(routerRoot);
const routerBytes = routerFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const routerLines = routerFiles.reduce((sum, file) => sum + source(path.relative(root, file)).split('\n').length - 1, 0);
console.log(JSON.stringify({
  physical_function_count: physicalEndpoints.length,
  provider_workspace_logical_route_count: logicalNames.length,
  directory_logical_route_count: Object.keys(DIRECTORY_FUNCTION_ROUTES).length,
  service_configuration_logical_route_count: Object.keys(SERVICE_CONFIGURATION_FUNCTION_ROUTES).length,
  provider_workspace_router_bytes: routerBytes,
  provider_workspace_router_lines: routerLines,
  provider_workspace_router_files: routerFiles.length,
  missing_static_routes: missingRoutes.length,
  stale_backend_invocations: staleBackendInvocations.length,
}, null, 2));
