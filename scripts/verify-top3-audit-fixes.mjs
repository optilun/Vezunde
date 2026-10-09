// Audit Top 3 (2026-10-09; Alex: „1 + 2 + 3 întâi”):
//  T1  comutatorul „Primesc cereri de la clienți” (nicio locație nu putea primi cereri);
//  T7  cererea ajunge doar la locații cu cel puțin un membru cu acces la Cereri;
//  T3  pacientul vede exact unde a ajuns cererea;
//  T6  cererea care nu ajunge la nicio locație poate primi ajutorul echipei.
// Potrivirea, clasamentul și Top 3 nu se schimbă.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  buildRequestIntakeReadiness,
  canManageRequestIntake,
  countRequestReadyServices,
  isRequestIntakeEnabled,
  locationHasActiveLeadMember,
  requestIntakeUpdate,
} from '../base44/shared/providerRequestIntake.js';
import {
  PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  buildPatientRequestRecoveryRecord,
  patientRequestRecoveryTrigger,
} from '../base44/shared/patientRequestRecovery.js';
import { buildProviderStatusCenter } from '../shared/providerStatusCenter.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as FRONT } from '../shared/providerWorkspaceFunctionRouting.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as BACK } from '../base44/shared/providerWorkspaceFunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

function matches(row, query = {}) {
  return Object.entries(query || {}).every(([key, expected]) => (
    expected && typeof expected === 'object' && !Array.isArray(expected) && '$in' in expected
      ? expected.$in.includes(row[key])
      : row[key] === expected));
}
function fakeDb(tables) {
  let sequence = 0;
  const entities = new Proxy({}, { get: (_t, raw) => {
    const name = String(raw);
    tables[name] ||= [];
    const create = (data) => { const row = { id: `${name}-${++sequence}`, created_date: new Date().toISOString(), ...structuredClone(data) }; tables[name].push(row); return structuredClone(row); };
    return {
      async filter(query, _sort, limit) { return tables[name].filter((row) => matches(row, query)).slice(0, limit ?? undefined).map((row) => structuredClone(row)); },
      async get(id) { const row = tables[name].find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { return create(data); },
      async bulkCreate(rows) { return rows.map(create); },
      async update(id, data) { const row = tables[name].find((item) => item.id === id); Object.assign(row, structuredClone(data)); return structuredClone(row); },
    };
  } });
  return { entities };
}

const readyService = { location_id: 'L1', service_key: 'eyeglasses', confirmation_level: 'provider_confirmed', matching_allowed: true, is_active: true };

// ---- T1: reguli simple -------------------------------------------------------------------------
assert.deepEqual(requestIntakeUpdate(true), { request_intake_status: 'active', accepts_patients_directly: true });
assert.deepEqual(requestIntakeUpdate(false), { request_intake_status: 'paused', accepts_patients_directly: false });
assert.equal(isRequestIntakeEnabled({ request_intake_status: 'active', accepts_patients_directly: true }), true);
assert.equal(isRequestIntakeEnabled({ request_intake_status: 'active', accepts_patients_directly: false }), false);
assert.equal(isRequestIntakeEnabled({ request_intake_status: 'inactive', accepts_patients_directly: true }), false);
assert.equal(canManageRequestIntake('organization_owner'), true);
assert.equal(canManageRequestIntake('owner'), true);
assert.equal(canManageRequestIntake('location_manager'), true);
assert.equal(canManageRequestIntake('location_staff'), false);
assert.equal(countRequestReadyServices([
  readyService,
  { ...readyService, confirmation_level: 'publicly_listed' },
  { ...readyService, matching_allowed: false },
  { ...readyService, is_active: false },
  { ...readyService, migration_review_required: true },
  { ...readyService, accepts_requests: false },
]), 1, 'aceleași condiții pe serviciu ca eligibilitatea cererii');
const readiness = buildRequestIntakeReadiness({
  location: { status: 'publicata', profile_control_status: 'claimed', request_intake_status: 'inactive' },
  services: [readyService],
  hasActiveMember: true,
});
assert.deepEqual(readiness.items.map((item) => [item.key, item.ok]), [
  ['controlled', true], ['published', true], ['services', true], ['member', true], ['intake', false],
]);
assert.equal(readiness.ready, false);

// Statusul locației spune când primirea e oprită; fără câmp (date vechi) nu blochează nimic.
const off = buildProviderStatusCenter({ location: { status: 'publicata', profile_control_status: 'claimed', request_intake_status: 'inactive', accepts_patients_directly: false }, entitlement: { plan_code: 'free' } });
assert.ok(off.blockers.includes('Primirea cererilor este oprită.'));
assert.equal(off.capabilities.find((item) => item.key === 'lead_preview').state, 'blocked');
const on = buildProviderStatusCenter({ location: { status: 'publicata', profile_control_status: 'claimed', request_intake_status: 'active', accepts_patients_directly: true }, entitlement: { plan_code: 'free' } });
assert.ok(!on.blockers.includes('Primirea cererilor este oprită.'));
assert.equal(on.capabilities.find((item) => item.key === 'lead_preview').state, 'active');

// ---- T7: locația are cine să citească cererea ------------------------------------------------------
{
  const tables = {
    ProviderMembership: [
      { id: 'ms1', user_id: 'u-staff', location_id: 'L1', organization_id: 'O1', status: 'active', role: 'location_staff' },
      { id: 'ms2', user_id: 'u-old', location_id: 'L2', organization_id: 'O2', status: 'inactive', role: 'organization_owner' },
    ],
    ProviderLocation: [],
  };
  const svc = { entities: fakeDb(tables).entities };
  assert.equal(await locationHasActiveLeadMember(svc, { id: 'L1', organization_id: 'O1' }), true);
  assert.equal(await locationHasActiveLeadMember(svc, { id: 'L2', organization_id: 'O2' }), false, 'membru inactiv nu contează');
  assert.equal(await locationHasActiveLeadMember(svc, { id: 'L3', organization_id: '' }), false);
}

async function bundle(entry, stubs, outDir) {
  const outfile = path.join(outDir, `${path.basename(path.dirname(entry))}-${path.basename(entry, '.ts')}.mjs`);
  await build({
    entryPoints: [path.join(root, entry)],
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
      for (const [pattern] of stubs) b.onResolve({ filter: pattern }, (args) => ({ path: args.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
        if (args.path === 'sdk') return { contents: 'export function createClientFromRequest() { return globalThis.__viaseeTop3Client; }', loader: 'js' };
        const found = stubs.find(([pattern]) => pattern.test(args.path));
        return { contents: found[1], loader: 'js' };
      });
    } }],
  });
  return outfile;
}

const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-top3-'));
try {
  // ---- T1: funcția din Setări → Plan și acces -------------------------------------------------------
  assert.equal(FRONT.providerRequestIntakeOps, BACK.providerRequestIntakeOps);
  const tables = {
    ProviderLocation: [
      { id: 'L1', organization_id: 'O1', name: 'Optica Test', status: 'publicata', profile_control_status: 'claimed', request_intake_status: 'inactive', accepts_patients_directly: false },
      { id: 'L9', organization_id: 'O9', name: 'Din director', status: 'publicata', profile_control_status: 'directory', request_intake_status: 'inactive', accepts_patients_directly: false },
    ],
    ProviderMembership: [
      { id: 'm1', user_id: 'owner', location_id: 'L1', organization_id: 'O1', status: 'active', role: 'organization_owner' },
      { id: 'm2', user_id: 'staff', location_id: 'L1', organization_id: 'O1', status: 'active', role: 'location_staff' },
      { id: 'm9', user_id: 'owner9', location_id: 'L9', organization_id: 'O9', status: 'active', role: 'organization_owner' },
    ],
    LocationService: [readyService],
    DirectoryAuditRecord: [],
  };
  const db = fakeDb(tables);
  const opsFile = await bundle('base44/functions/getMyProviderWorkspace/providerRequestIntakeOps.ts', [], outDir);
  const { handle } = await import(pathToFileURL(opsFile).href);
  const call = async (userId, body) => {
    globalThis.__viaseeTop3Client = { auth: { me: async () => (userId ? { id: userId, email: `${userId}@example.test` } : null) }, asServiceRole: { entities: db.entities } };
    const response = await handle(new Request('http://local/fn', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
  let res = await call('staff', { action: 'get', location_id: 'L1' });
  assert.equal(res.status, 200);
  assert.equal(res.body.enabled, false);
  assert.equal(res.body.can_manage, false, 'personalul vede starea, dar nu o schimbă');
  assert.equal(res.body.readiness.ready_service_count, 1);
  res = await call('staff', { action: 'set', location_id: 'L1', enabled: true });
  assert.equal(res.status, 403);
  res = await call('stranger', { action: 'get', location_id: 'L1' });
  assert.equal(res.status, 403);
  res = await call(null, { action: 'get', location_id: 'L1' });
  assert.equal(res.status, 401);
  res = await call('owner', { action: 'set', location_id: 'L1', enabled: 'da' });
  assert.equal(res.status, 400);
  res = await call('owner', { action: 'set', location_id: 'L1', enabled: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.enabled, true);
  assert.equal(res.body.readiness.ready, true);
  assert.equal(tables.ProviderLocation[0].request_intake_status, 'active');
  assert.equal(tables.ProviderLocation[0].accepts_patients_directly, true);
  assert.equal(tables.DirectoryAuditRecord.length, 1);
  assert.equal(tables.DirectoryAuditRecord[0].action_type, 'provider_request_intake_update');
  res = await call('owner', { action: 'set', location_id: 'L1', enabled: true });
  assert.equal(tables.DirectoryAuditRecord.length, 1, 'fără schimbare, fără înregistrare nouă');
  res = await call('owner', { action: 'set', location_id: 'L1', enabled: false });
  assert.equal(res.body.enabled, false);
  assert.equal(tables.ProviderLocation[0].request_intake_status, 'paused');
  assert.equal(tables.ProviderLocation[0].accepts_patients_directly, false);
  res = await call('owner9', { action: 'set', location_id: 'L9', enabled: true });
  assert.equal(res.status, 409, 'profilul din director nu poate porni primirea');
  assert.equal(tables.ProviderLocation[1].request_intake_status, 'inactive');

  // ---- T7 + T3: trimiterea cererii -------------------------------------------------------------
  const dist = {
    PatientRequest: [{ id: 'R1', persistence_state: 'complete', status: 'salvata', intent: 'ochelari_lentile', service_keys: ['eyeglasses'], city: 'Cluj-Napoca', matching_need_level: 'general' }],
    PatientRequestContact: [{ id: 'C1', request_id: 'R1', status: 'active' }],
    RequestMatch: [
      { id: 'M1', request_id: 'R1', location_id: 'A', rank: 1, result_bucket: 'top3' },
      { id: 'M2', request_id: 'R1', location_id: 'B', rank: 2, result_bucket: 'top3' },
      { id: 'M3', request_id: 'R1', location_id: 'D', rank: 3, result_bucket: 'extended_directory' },
    ],
    ProviderLocation: [
      { id: 'A', organization_id: 'OA', status: 'publicata', profile_control_status: 'claimed', request_intake_status: 'active', accepts_patients_directly: true },
      { id: 'B', organization_id: 'OB', status: 'publicata', profile_control_status: 'verified', request_intake_status: 'active', accepts_patients_directly: true },
      { id: 'D', organization_id: 'OD', status: 'publicata', profile_control_status: 'directory', request_intake_status: 'inactive', accepts_patients_directly: false },
    ],
    LocationService: [
      { ...readyService, location_id: 'A' },
      { ...readyService, location_id: 'B' },
    ],
    ProviderMembership: [{ id: 'mA', user_id: 'uA', location_id: 'A', organization_id: 'OA', status: 'active', role: 'organization_owner' }],
    ProviderLead: [],
  };
  const distDb = fakeDb(dist);
  const notified = [];
  globalThis.__viaseeTop3Notified = notified;
  const distFile = await bundle('base44/functions/authorizePatientRequestDistribution/entry.ts', [
    [/patientRequestAccessGrant\.js$/, 'export async function findPatientRequestContactForToken(svc, requestId) { const rows = await svc.entities.PatientRequestContact.filter({ request_id: requestId, status: "active" }); return rows[0] || null; }'],
    [/patientRequestDistributionLock\.js$/, 'export async function acquirePatientRequestDistributionLock(_svc, requestId) { return { requestId, token: "t" }; } export async function releasePatientRequestDistributionLock() {}'],
    [/leadCommunicationNotifications\.js$/, 'export async function notifyProviderLeadAvailable({ lead }) { globalThis.__viaseeTop3Notified.push(lead.location_id); }'],
    [/patientCommunicationNotifications\.js$/, 'export async function notifyPatientRequestDistributed() {}'],
  ], outDir);
  let served = null;
  globalThis.Deno = { serve: (handler) => { served = handler; } };
  await import(pathToFileURL(distFile).href);
  assert.ok(served, 'funcția își înregistrează handlerul');
  globalThis.__viaseeTop3Client = { auth: { me: async () => null }, asServiceRole: { entities: distDb.entities } };
  const distResponse = await served(new Request('http://local/fn', { method: 'POST', body: JSON.stringify({
    request_id: 'R1', request_access_token: 'token-1', distribution_consent: true, consent_version: 'patient-request-distribution-top3-pro-v3',
  }) }));
  const distBody = await distResponse.json();
  assert.equal(distResponse.status, 200, JSON.stringify(distBody));
  assert.equal(distBody.lead_count, 1, 'B e eligibilă, dar nu are niciun membru: cererea nu ajunge acolo');
  assert.deepEqual(distBody.delivered_location_ids, ['A']);
  assert.deepEqual(dist.ProviderLead.map((lead) => lead.location_id), ['A']);
  assert.deepEqual(notified, ['A']);
  delete globalThis.Deno;
} finally {
  await rm(outDir, { recursive: true, force: true });
}

// ---- T6: ajutorul echipei ----------------------------------------------------------------------
assert.equal(patientRequestRecoveryTrigger({ match_count: 0 }), 'no_search_results');
assert.equal(patientRequestRecoveryTrigger({ match_count: 12 }, 0), 'no_receiving_locations');
assert.equal(patientRequestRecoveryTrigger({ match_count: 12 }, 2), '');
assert.equal(patientRequestRecoveryTrigger({ match_count: 12 }, null), '', 'fără trimitere, nu știm încă dacă a ajuns undeva');
const noDelivery = buildPatientRequestRecoveryRecord({
  request: { id: 'R2', match_count: 12, matching_coverage_status: 'no_local_results' },
  consentVersion: PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  deliveredLeadCount: 0,
});
assert.equal(noDelivery.trigger, 'no_receiving_locations');
assert.equal(noDelivery.reason, 'no_receiving_locations');
assert.throws(() => buildPatientRequestRecoveryRecord({
  request: { id: 'R3', match_count: 12 },
  consentVersion: PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  deliveredLeadCount: 1,
}), /numai pentru cererile fara rezultate/);

const statusFn = await read('base44/functions/getPatientRequestStatus/entry.ts');
assert.match(statusFn, /delivered_location_ids: \[\.\.\.new Set\(leadRows\.map/);
assert.match(statusFn, /contact\.provider_request_distribution_consent === true && leadRows\.length === 0/);
assert.match(statusFn, /createRecoveryCase\(svc, authorized\.request, input, authorized\.contact\)/);
assert.match(statusFn, /deliveredLeadCount !== 0/);
const adminQueue = await read('src/components/admin/review/AdminPatientRequestRecoveryQueue.jsx');
assert.match(adminQueue, /no_receiving_locations: "Locațiile găsite nu primesc încă cereri prin VIASEE"/);

// ---- Ecrane -----------------------------------------------------------------------------------
const card = await read('src/components/intake2/RequestWorkspaceLocationCard.jsx');
assert.match(card, /delivered === false \? "Nu primește cereri prin VIASEE încă" : "Cerere trimisă"/);
const workspace = await read('src/components/intake2/RequestWorkspace.jsx');
assert.match(workspace, /status\?\.delivered_location_ids/);
assert.equal((workspace.match(/delivered=\{deliveredFor\(location\)\}/g) || []).length, 3, 'toate grupurile de carduri');
assert.match(workspace, /Cererea nu a ajuns aici/);
assert.match(workspace, /Cererea a ajuns la/);
const submission = await read('src/components/intake2/PatientRequestSubmission.jsx');
assert.match(submission, /<PatientNoDeliveryRecovery/);
assert.match(submission, /Cererea nu a ajuns la nicio locație\./);
assert.doesNotMatch(submission, /Locațiile sunt vizibile mai jos imediat/);
const resume = await read('src/pages/PatientRequestResume.jsx');
assert.match(resume, /snapshot\.recovery_allowed && !noResults && \(/);
const recoveryBox = await read('src/components/intake2/PatientNoDeliveryRecovery.jsx');
assert.match(recoveryBox, /requestPatientRequestRecovery/);
assert.match(recoveryBox, /Verificarea nu promite identificarea unei locații/);
const access = await read('src/components/workspace/provider/ProviderRequestAccessSettings.jsx');
assert.match(access, /<ProviderRequestIntakeSwitch locationId=\{locationId\} onChange=\{setIntakeOverride\} \/>/);
const intakeSwitch = await read('src/components/workspace/provider/ProviderRequestIntakeSwitch.jsx');
assert.match(intakeSwitch, /Primesc cereri de la clienți/);
assert.match(intakeSwitch, /providerRequestIntakeOps/);

// Potrivirea, clasamentul și Top 3 nu folosesc noile reguli.
for (const file of ['base44/functions/matchProvidersSemantic/entry.ts', 'base44/functions/matchProviders/entry.ts', 'base44/shared/providerLeadEligibility.js']) {
  assert.doesNotMatch(await read(file), /providerRequestIntake|locationHasActiveLeadMember/, file);
}

console.log('Top 3 audit fixes (T1, T3, T6, T7): OK');
