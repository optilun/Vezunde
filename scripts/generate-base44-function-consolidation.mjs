import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_ROOT = path.join(ROOT, 'base44', 'functions');
const MODULES_ROOT = path.join(ROOT, 'base44', 'function_modules');

const GROUPS = {
  directoryOps: [
    'directoryOps',
    'adminDataIntegrityOps',
    'adminDirectoryCorrectionReview',
    'adminOrganizationProfileReview',
    'adminProfessionalProfileReview',
    'adminProviderClaimReview',
    'adminProviderScopedClaimReview',
    'adminServiceConfigurationReview',
    'adminServicePrerequisiteReview',
    'adminWorkspaceReview',
    'aiResearchOps',
    'backfillLocationServiceMatching',
    'backfillProviderOrganizationProfile',
    'directoryImportOps',
    'directoryMappingOps',
    'geoImportOps',
    'getAdminServiceManagementData',
    'researchOps',
    'reviewProfileChanges',
  ],
  getMyProviderWorkspace: [
    'getMyProviderWorkspace',
    'getMyAccountDeletionEligibility',
    'getMyProviderMembers',
    'getMyProviderOnboardingWorkspace',
    'getProviderEntitlement',
    'getProviderLocationComparison',
    'getProviderLogoReviewStatus',
    'getProviderProfileCompleteness',
    'getProviderWorkspaceOverview',
  ],
  createProviderMemberInvitation: [
    'createProviderMemberInvitation',
    'acceptProviderMemberInvitation',
    'deactivateProviderMember',
    'reactivateProviderMember',
    'revokeProviderMemberInvitation',
    'listProviderMemberInvitations',
    'setProviderMemberAccess',
    'updateProviderMemberRole',
    'syncProviderOrganizationOwnerAccess',
  ],
  submitProviderClaim: [
    'submitProviderClaim',
    'submitProviderScopedClaim',
    'getProviderClaimScopeOptions',
    'providerLocationExpansionOps',
    'providerLocationIdentityResolutionOps',
    'providerLocationLifecycleOps',
    'updateProviderLocation',
  ],
  providerServiceConfigurationOps: [
    'providerServiceConfigurationOps',
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
  ],
  getMyProfessionalWorkspace: [
    'getMyProfessionalWorkspace',
    'manageMyProfessionalProfile',
    'manageProfessionalAssignment',
    'professionalInvitationOps',
  ],
};

const ROUTE_MAP = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([router, names]) => names.filter((name) => name !== router).map((name) => [name, router])),
);

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Lipseste fisierul: ${path.relative(ROOT, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function routeServerInvocations(source) {
  let changed = false;
  const escapedNames = Object.keys(ROUTE_MAP)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!escapedNames) return source;
  const pattern = new RegExp(`([A-Za-z_$][\\w$]*)\\.functions\\s*\\.\\s*invoke\\s*\\(\\s*(['"])(${escapedNames})\\2\\s*,`, 'g');
  const output = source.replace(pattern, (_full, client, quote, name) => {
    if (!ROUTE_MAP[name]) return _full;
    changed = true;
    return `invokeConsolidatedFunction(${client}, ${quote}${name}${quote},`;
  });
  if (!changed || output.includes("from './runtime.ts'")) return output;
  return `import { invokeConsolidatedFunction } from './runtime.ts';\n${output}`;
}

function transformEntryToModule(name, source) {
  let output = source.replaceAll('../../../shared/', '../../shared/');
  output = output.replaceAll('../../../src/', '../../src/');
  output = routeServerInvocations(output);
  const servePattern = /Deno\.serve\(\s*async\s*\(\s*req(?:\s*:\s*[^)]+)?\s*\)\s*=>\s*\{/;
  if (!servePattern.test(output)) throw new Error(`Nu pot transforma Deno.serve pentru ${name}`);
  output = output.replace(servePattern, 'export async function handle(req: Request) {');
  if (!/\}\);\s*$/.test(output)) throw new Error(`Final Deno.serve neasteptat pentru ${name}`);
  return output.replace(/\}\);\s*$/, '}\n');
}

function identifier(name) {
  return `handle_${name.replace(/[^A-Za-z0-9_$]/g, '_')}`;
}

function routerSource(router, names) {
  const imports = names.map((name) => `import { handle as ${identifier(name)} } from '../../function_modules/${name}.ts';`).join('\n');
  const handlers = names.map((name) => `  ${JSON.stringify(name)}: ${identifier(name)},`).join('\n');
  return `${imports}\n\nconst ROUTER_NAME = ${JSON.stringify(router)};\nconst HANDLERS: Record<string, (req: Request) => Promise<Response>> = {\n${handlers}\n};\n\nfunction response(body: unknown, status = 200) {\n  return Response.json(body, { status });\n}\n\nDeno.serve(async (req) => {\n  try {\n    const envelope = await req.clone().json().catch(() => ({}));\n    const requested = typeof envelope?.__function === 'string' ? envelope.__function : ROUTER_NAME;\n    const handler = HANDLERS[requested];\n    if (!handler) return response({ error: 'Operatie consolidata necunoscuta.', requested }, 400);\n    const payload = requested === ROUTER_NAME ? envelope : (envelope?.payload ?? {});\n    const forwarded = new Request(req.url, {\n      method: req.method,\n      headers: req.headers,\n      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(payload),\n    });\n    return handler(forwarded);\n  } catch (error) {\n    return response({ error: error?.message || 'Routerul Base44 nu a putut procesa cererea.' }, 500);\n  }\n});\n`;
}

function runtimeSource() {
  return `export const BASE44_FUNCTION_ROUTES: Record<string, string> = ${JSON.stringify(ROUTE_MAP, null, 2)};\n\nexport function invokeConsolidatedFunction(base44: any, functionName: string, payload: unknown = {}) {\n  const router = BASE44_FUNCTION_ROUTES[functionName];\n  if (!router) return base44.functions.invoke(functionName, payload);\n  return base44.functions.invoke(router, { __function: functionName, payload });\n}\n`;
}

function frontendRoutingSource() {
  return `export const BASE44_FUNCTION_ROUTES = ${JSON.stringify(ROUTE_MAP, null, 2)};\n\nexport function installBase44FunctionRouting(client) {\n  const rawFunctions = client.functions;\n  const rawInvoke = rawFunctions.invoke.bind(rawFunctions);\n  const routedFunctions = new Proxy(rawFunctions, {\n    get(target, property, receiver) {\n      if (property === 'invoke') {\n        return (functionName, payload = {}) => {\n          const router = BASE44_FUNCTION_ROUTES[functionName];\n          if (!router) return rawInvoke(functionName, payload);\n          return rawInvoke(router, { __function: functionName, payload });\n        };\n      }\n      return Reflect.get(target, property, receiver);\n    },\n  });\n  return new Proxy(client, {\n    get(target, property, receiver) {\n      if (property === 'functions') return routedFunctions;\n      return Reflect.get(target, property, receiver);\n    },\n  });\n}\n`;
}

function clientSource() {
  return `import { createClient } from '@base44/sdk';\nimport { appParams } from '@/lib/app-params';\nimport { installBase44FunctionRouting } from '@/api/base44FunctionRouting';\n\nconst { appId, token, functionsVersion, appBaseUrl } = appParams;\n\nconst rawBase44 = createClient({\n  appId,\n  token,\n  functionsVersion,\n  serverUrl: '',\n  requiresAuth: false,\n  appBaseUrl,\n});\n\nexport const base44 = installBase44FunctionRouting(rawBase44);\n`;
}

fs.rmSync(MODULES_ROOT, { recursive: true, force: true });
fs.mkdirSync(MODULES_ROOT, { recursive: true });
write(path.join(MODULES_ROOT, 'runtime.ts'), runtimeSource());

const consolidated = new Set();
for (const [router, names] of Object.entries(GROUPS)) {
  for (const name of names) {
    if (consolidated.has(name)) throw new Error(`Functie duplicata in grupuri: ${name}`);
    consolidated.add(name);
    const entry = path.join(FUNCTIONS_ROOT, name, 'entry.ts');
    write(path.join(MODULES_ROOT, `${name}.ts`), transformEntryToModule(name, read(entry)));
  }
  write(path.join(FUNCTIONS_ROOT, router, 'entry.ts'), routerSource(router, names));
}

for (const name of consolidated) {
  if (Object.hasOwn(GROUPS, name)) continue;
  fs.rmSync(path.join(FUNCTIONS_ROOT, name, 'entry.ts'), { force: true });
}

write(path.join(ROOT, 'src', 'api', 'base44FunctionRouting.js'), frontendRoutingSource());
write(path.join(ROOT, 'src', 'api', 'base44Client.js'), clientSource());

const remaining = fs.readdirSync(FUNCTIONS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(FUNCTIONS_ROOT, entry.name, 'entry.ts')))
  .map((entry) => entry.name)
  .sort();

if (remaining.length > 45) throw new Error(`Suprafata consolidata are inca ${remaining.length} functii; limita interna este 45.`);
console.log(`Consolidare generata: ${consolidated.size} implementari in ${Object.keys(GROUPS).length} routere.`);
console.log(`Functii Base44 ramase: ${remaining.length}`);
console.log(remaining.join('\n'));
