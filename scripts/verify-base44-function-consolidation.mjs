import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const FUNCTIONS_ROOT = path.join(ROOT, 'base44', 'functions');
const MODULES_ROOT = path.join(ROOT, 'base44', 'function_modules');

const functionNames = fs.readdirSync(FUNCTIONS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(FUNCTIONS_ROOT, entry.name, 'entry.ts')))
  .map((entry) => entry.name)
  .sort();

assert.ok(functionNames.length <= 45, `Suprafata Base44 are ${functionNames.length} functii, peste bugetul de 45.`);

const routingModule = await import(pathToFileURL(path.join(ROOT, 'src', 'api', 'base44FunctionRouting.js')).href);
const routes = routingModule.BASE44_FUNCTION_ROUTES;

const requiredRoutes = {
  directoryImportOps: 'directoryOps',
  directoryMappingOps: 'directoryOps',
  getMyProviderMembers: 'getMyProviderWorkspace',
  getProviderEntitlement: 'getMyProviderWorkspace',
  setProviderMemberAccess: 'createProviderMemberInvitation',
  updateProviderMemberRole: 'createProviderMemberInvitation',
  submitProviderScopedClaim: 'submitProviderClaim',
  getProviderServiceConfiguration: 'providerServiceConfigurationOps',
  providerLocationLifecycleOps: 'submitProviderClaim',
  getProviderProfileCompleteness: 'getMyProviderWorkspace',
};

for (const [logicalName, router] of Object.entries(requiredRoutes)) {
  assert.equal(routes[logicalName], router, `Ruta lipsa sau incorecta pentru ${logicalName}.`);
  assert.ok(functionNames.includes(router), `Routerul ${router} nu este o functie Base44 deployabila.`);
  assert.ok(fs.existsSync(path.join(MODULES_ROOT, `${logicalName}.ts`)), `Implementarea ${logicalName} lipseste din function_modules.`);
  if (logicalName !== router) {
    assert.equal(fs.existsSync(path.join(FUNCTIONS_ROOT, logicalName, 'entry.ts')), false, `${logicalName} nu trebuie sa consume un endpoint separat.`);
  }
}

const directoryRouter = fs.readFileSync(path.join(FUNCTIONS_ROOT, 'directoryOps', 'entry.ts'), 'utf8');
assert.match(directoryRouter, /"directoryImportOps": handle_directoryImportOps/);
assert.match(directoryRouter, /"directoryMappingOps": handle_directoryMappingOps/);
assert.match(directoryRouter, /envelope\?\.__function/);
assert.match(directoryRouter, /envelope\?\.payload/);

const providerRouter = fs.readFileSync(path.join(FUNCTIONS_ROOT, 'getMyProviderWorkspace', 'entry.ts'), 'utf8');
assert.match(providerRouter, /"getMyProviderMembers": handle_getMyProviderMembers/);
assert.match(providerRouter, /"getProviderEntitlement": handle_getProviderEntitlement/);
assert.match(providerRouter, /"getProviderProfileCompleteness": handle_getProviderProfileCompleteness/);

const memberRouter = fs.readFileSync(path.join(FUNCTIONS_ROOT, 'createProviderMemberInvitation', 'entry.ts'), 'utf8');
assert.match(memberRouter, /"setProviderMemberAccess": handle_setProviderMemberAccess/);
assert.match(memberRouter, /"updateProviderMemberRole": handle_updateProviderMemberRole/);

const importModule = fs.readFileSync(path.join(MODULES_ROOT, 'directoryImportOps.ts'), 'utf8');
const mappingModule = fs.readFileSync(path.join(MODULES_ROOT, 'directoryMappingOps.ts'), 'utf8');
assert.match(importModule, /export async function handle\(req: Request\)/);
assert.match(importModule, /action === 'list_snapshots'/);
assert.match(mappingModule, /export async function handle\(req: Request\)/);
assert.match(mappingModule, /action === 'overview'/);

const client = fs.readFileSync(path.join(ROOT, 'src', 'api', 'base44Client.js'), 'utf8');
const frontendRouting = fs.readFileSync(path.join(ROOT, 'src', 'api', 'base44FunctionRouting.js'), 'utf8');
assert.match(client, /installBase44FunctionRouting/);
assert.match(client, /installBase44FunctionRouting\(rawBase44\)/);
assert.match(frontendRouting, /rawInvoke\(router, \{ __function: functionName, payload \}\)/);

const runtime = fs.readFileSync(path.join(MODULES_ROOT, 'runtime.ts'), 'utf8');
assert.match(runtime, /invokeConsolidatedFunction/);
assert.match(runtime, /base44\.functions\.invoke\(router, \{ __function: functionName, payload \}\)/);

console.log(`Base44 consolidation verified: ${functionNames.length} deployable functions, ${Object.keys(routes).length} routed logical functions.`);
