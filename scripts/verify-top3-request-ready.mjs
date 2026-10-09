// Audit Top 3, T4 + T5 (2026-10-09; Alex: „Începe”, după recomandarea din research):
//  T4  în Top 3 intră doar locațiile care pot primi cererea; ordinea rămâne cea de până acum;
//  T5  serverul verifică clasamentul trimis din browser (cel mult 3 „top3”, aceeași regulă,
//      nivelul nevoii calculat pe server), iar la trimitere detaliile complete merg la cel mult 3.
// Planul plătit nu intră în nicio decizie.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  TOP3_LIMIT,
  assignRequestReadyTop3,
  evaluateRequestReadiness,
  loadRequestReadiness,
  locationIdsWithDirectLeadMember,
  requestReadyServiceKeys,
  serverNeedLevel,
  stricterNeedLevel,
} from '../base44/shared/requestReadyRecommendation.js';
import { evaluateProviderLeadEligibility } from '../base44/shared/providerLeadEligibility.js';
import {
  PATIENT_QUESTIONNAIRE_VERSION,
  PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
  PATIENT_REQUEST_PROCESSING_CONSENT_VERSION,
} from '../base44/shared/patientRequestPersistence.js';

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
    const create = (data) => { const row = { id: `${name}-${++sequence}`, created_date: new Date(Date.now() + sequence).toISOString(), ...structuredClone(data) }; tables[name].push(row); return structuredClone(row); };
    return {
      async filter(query, _sort, limit) { return tables[name].filter((row) => matches(row, query)).slice(0, limit ?? undefined).map((row) => structuredClone(row)); },
      async get(id) { const row = tables[name].find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { return create(data); },
      async bulkCreate(rows) { return rows.map(create); },
      async update(id, data) { const row = tables[name].find((item) => item.id === id); Object.assign(row, structuredClone(data)); return structuredClone(row); },
      async delete(id) { tables[name] = tables[name].filter((row) => row.id !== id); },
      async deleteMany(query) { tables[name] = tables[name].filter((row) => !matches(row, query)); },
    };
  } });
  return { entities };
}

const service = (locationId, key = 'eyeglasses', extra = {}) => ({
  location_id: locationId, service_key: key, confirmation_level: 'provider_confirmed', matching_allowed: true, is_active: true, ...extra,
});
const readyLocation = (id, extra = {}) => ({
  id, organization_id: `O-${id}`, name: `Locația ${id}`, status: 'publicata', profile_control_status: 'claimed',
  request_intake_status: 'active', accepts_patients_directly: true, ...extra,
});
const member = (locationId, role = 'organization_owner') => ({ id: `m-${locationId}-${role}`, user_id: `u-${locationId}`, location_id: locationId, organization_id: `O-${locationId}`, status: 'active', role });

// ---- Regula comună ------------------------------------------------------------------------------
assert.equal(serverNeedLevel(['eyeglasses']), 'general');
assert.equal(serverNeedLevel(['eyeglasses', 'refraction']), 'technical');
assert.equal(serverNeedLevel(['contact_lens_fitting']), 'specialized_medical');
assert.equal(serverNeedLevel(['necunoscut']), '');
assert.equal(stricterNeedLevel('general', 'specialized_medical'), 'specialized_medical');
assert.equal(stricterNeedLevel('specialized_medical', 'general'), 'specialized_medical');
assert.equal(stricterNeedLevel('', 'technical'), 'technical');
assert.deepEqual(
  requestReadyServiceKeys([service('A', 'lentile_progresive')], ['progressive_lenses']),
  ['progressive_lenses'],
  'cheile vechi (alias) se potrivesc normalizat',
);
assert.deepEqual(requestReadyServiceKeys([service('A', 'eyeglasses', { confirmation_level: 'publicly_listed' })], ['eyeglasses']), [], 'listat public nu ajunge');
assert.deepEqual(requestReadyServiceKeys([service('A', 'contact_lens_fitting')], ['contact_lens_fitting'], 'specialized_medical'), [], 'la nevoi specializate: doar servicii verificate de VIASEE');

const ready = evaluateRequestReadiness({ location: readyLocation('A'), services: [service('A')], requestedKeys: ['eyeglasses'], needLevel: 'general', hasActiveMember: true });
assert.equal(ready.ready, true);
const reasonsFor = (overrides) => evaluateRequestReadiness({ location: readyLocation('A'), services: [service('A')], requestedKeys: ['eyeglasses'], needLevel: 'general', hasActiveMember: true, ...overrides }).reasons;
assert.deepEqual(reasonsFor({ location: readyLocation('A', { profile_control_status: 'directory' }) }), ['profile_not_controlled']);
assert.deepEqual(reasonsFor({ needLevel: 'specialized_medical', services: [service('A', 'eyeglasses', { confirmation_level: 'vezunde_verified' })] }), ['specialized_requires_verified_profile']);
assert.deepEqual(reasonsFor({ location: readyLocation('A', { status: 'in_verificare' }) }), ['location_not_published']);
assert.deepEqual(reasonsFor({ location: readyLocation('A', { accepts_patients_directly: false }) }), ['request_intake_off']);
assert.deepEqual(reasonsFor({ requestedKeys: ['frames'] }), ['no_request_ready_service']);
assert.deepEqual(reasonsFor({ hasActiveMember: false }), ['no_active_member']);

assert.deepEqual([...locationIdsWithDirectLeadMember([
  member('A', 'location_staff'),
  member('B', 'location_member'),
  { ...member('C'), status: 'inactive' },
])], ['A'], 'doar membri activi cu acces la Cereri');

// ---- T4: Top 3 din locațiile care pot primi cererea, în ordinea de până acum -------------------------
const ordered = [
  { id: 'c1', recommendation_group: 'confirmed', accepts_requests_via_viasee: false },
  { id: 'c2', recommendation_group: 'confirmed', accepts_requests_via_viasee: true },
  { id: 'c3', recommendation_group: 'confirmed', accepts_requests_via_viasee: false },
  { id: 'c4', recommendation_group: 'confirmed', accepts_requests_via_viasee: true },
  { id: 'c5', recommendation_group: 'confirmed', accepts_requests_via_viasee: true },
  { id: 'c6', recommendation_group: 'confirmed', accepts_requests_via_viasee: true },
  { id: 'd1', recommendation_group: 'directory', result_bucket: 'extended_directory', bucket_rank: 1 },
];
const bucketed = assignRequestReadyTop3(ordered, 20);
assert.deepEqual(bucketed.map((row) => [row.id, row.result_bucket, row.bucket_rank]), [
  ['c2', 'top3', 1], ['c4', 'top3', 2], ['c5', 'top3', 3],
  ['c1', 'extended_confirmed', 1], ['c3', 'extended_confirmed', 2], ['c6', 'extended_confirmed', 3],
  ['d1', 'extended_directory', 1],
]);
assert.equal(bucketed.find((row) => row.id === 'c1').is_top3_eligible, false);
assert.equal(assignRequestReadyTop3(ordered, 2).length, 2, 'limita listei rămâne');
assert.ok(assignRequestReadyTop3(ordered.map((row) => ({ ...row, accepts_requests_via_viasee: false })), 20).every((row) => row.result_bucket !== 'top3'), 'fără locații care primesc cereri, Top 3 e gol');

// Verificarea în lot (un singur apel pentru membri).
{
  const tables = {
    ProviderMembership: [member('A'), member('B', 'location_staff')],
    ProviderLocation: [],
  };
  const svc = { entities: fakeDb(tables).entities };
  const result = await loadRequestReadiness(svc, [
    { location: readyLocation('A'), services: [service('A')], requestedKeys: ['eyeglasses'] },
    { location: readyLocation('B'), services: [service('B')], requestedKeys: ['eyeglasses'] },
    { location: readyLocation('C'), services: [service('C')], requestedKeys: ['eyeglasses'] },
  ], 'general');
  assert.equal(result.get('A').ready, true);
  assert.equal(result.get('B').ready, true);
  assert.deepEqual(result.get('C').reasons, ['no_active_member']);
}

// Eligibilitatea la trimitere compară cheile normalizate.
assert.equal(evaluateProviderLeadEligibility({
  request: { persistence_state: 'complete', service_keys: ['progressive_lenses'], matching_need_level: 'general' },
  match: { result_bucket: 'top3' },
  location: readyLocation('A'),
  services: [service('A', 'lentile_progresive')],
}).eligible, true);

async function bundle(entry, stubs, outDir) {
  const outfile = path.join(outDir, `${path.basename(path.dirname(entry))}.mjs`);
  await build({
    entryPoints: [path.join(root, entry)],
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
      for (const [pattern] of stubs) b.onResolve({ filter: pattern }, (args) => ({ path: args.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
        if (args.path === 'sdk') return { contents: 'export function createClientFromRequest() { return globalThis.__viaseeTop3ReadyClient; }', loader: 'js' };
        return { contents: stubs.find(([pattern]) => pattern.test(args.path))[1], loader: 'js' };
      });
    } }],
  });
  return outfile;
}

async function loadHandler(file) {
  let served = null;
  globalThis.Deno = { serve: (handler) => { served = handler; } };
  await import(pathToFileURL(file).href);
  delete globalThis.Deno;
  assert.ok(served, 'funcția își înregistrează handlerul');
  return served;
}

const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-top3-ready-'));
try {
  // ---- T5: salvarea cererii -------------------------------------------------------------------
  const createFile = await bundle('base44/functions/createPatientRequest/entry.ts', [
    [/patientCommunicationNotifications\.js$/, 'export async function notifyPatientRequestReceived() {}'],
  ], outDir);
  const createHandler = await loadHandler(createFile);
  const save = async ({ serviceKeys, clientNeed, results, idem }) => {
    const tables = {
      GeographicLocality: [{ id: 'g1', siruta_code: '54975', is_active: true, name: 'Cluj-Napoca', county_name: 'Cluj' }],
      ProviderLocation: [
        readyLocation('A'), readyLocation('B', { profile_control_status: 'directory', request_intake_status: 'inactive', accepts_patients_directly: false }),
        readyLocation('C', { request_intake_status: 'paused', accepts_patients_directly: false }),
        readyLocation('D'), readyLocation('E'), readyLocation('F'), readyLocation('G', { profile_control_status: 'directory' }),
        readyLocation('V', { profile_control_status: 'verified' }),
      ],
      LocationService: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => service(id)).concat([
        service('A', 'contact_lens_fitting'), service('V', 'contact_lens_fitting', { confirmation_level: 'vezunde_verified' }),
      ]),
      ProviderMembership: ['A', 'C', 'D', 'E', 'F', 'V'].map((id) => member(id)),
    };
    globalThis.__viaseeTop3ReadyClient = { auth: { me: async () => { throw new Error('anonymous'); } }, asServiceRole: { entities: fakeDb(tables).entities } };
    const response = await createHandler(new Request('http://local/fn', { method: 'POST', body: JSON.stringify({
      idempotency_key: idem,
      request_draft: {
        contract_version: PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
        questionnaire_version: PATIENT_QUESTIONNAIRE_VERSION,
        intent: 'ochelari_lentile',
        questionnaire_key: 'test',
        locality_siruta_code: '54975',
        city: 'Cluj-Napoca',
        original_message: 'Am nevoie de o pereche nouă de ochelari.',
        service_keys: serviceKeys,
      },
      contact: { name: 'Pacient Test', email: 'pacient@example.test', preference: 'email' },
      consent: { processing: true, version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION },
      recommendation: { contract_version: 'test', need_level: clientNeed, results },
    }) }));
    return { status: response.status, body: await response.json(), tables };
  };
  const result = (id, bucket) => ({ id, result_bucket: bucket });

  let saved = await save({
    serviceKeys: ['eyeglasses'], clientNeed: 'general', idem: 'idem-top3-ready-0001',
    results: [result('A', 'top3'), result('B', 'top3'), result('C', 'top3'), result('D', 'top3'), result('E', 'top3'), result('F', 'top3'), result('G', 'extended_confirmed')],
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const stored = Object.fromEntries(saved.tables.RequestMatch.map((row) => [row.location_id, row]));
  assert.deepEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => stored[id].result_bucket), [
    'top3', 'extended_directory', 'extended_confirmed', 'top3', 'top3', 'extended_confirmed', 'extended_directory',
  ]);
  assert.deepEqual(['A', 'D', 'E'].map((id) => stored[id].bucket_rank), [1, 2, 3]);
  assert.ok(stored.B.exclusion_reasons.includes('server_validation:profile_not_eligible'));
  assert.ok(stored.C.exclusion_reasons.some((reason) => reason.startsWith('server_validation:not_request_ready:request_intake_off')));
  assert.ok(stored.F.exclusion_reasons.includes('server_validation:top3_limit'));
  assert.ok(stored.G.exclusion_reasons.includes('server_validation:profile_not_eligible'));
  assert.ok(saved.tables.RequestMatch.every((row) => row.snapshot_source === 'client_confirmed_search_server_validated'));
  assert.equal(saved.body.top3_count, 3);
  assert.equal(saved.tables.PatientRequest[0].top3_count, 3);

  // Nevoie specializată: browserul spune „general”, serverul știe mai bine.
  saved = await save({
    serviceKeys: ['contact_lens_fitting'], clientNeed: 'general', idem: 'idem-top3-ready-0002',
    results: [result('A', 'top3'), result('V', 'top3')],
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.tables.PatientRequest[0].matching_need_level, 'specialized_medical');
  const special = Object.fromEntries(saved.tables.RequestMatch.map((row) => [row.location_id, row]));
  assert.equal(special.A.result_bucket, 'extended_directory', 'profil doar revendicat: nu intră în Top 3 la nevoi specializate');
  assert.equal(special.V.result_bucket, 'top3');
  assert.equal(special.V.need_level_snapshot, 'specialized_medical');

  // ---- T5: plasa de la trimitere --------------------------------------------------------------
  const dist = {
    PatientRequest: [{ id: 'R1', persistence_state: 'complete', status: 'salvata', intent: 'ochelari_lentile', service_keys: ['eyeglasses'], city: 'Cluj-Napoca', matching_need_level: 'general' }],
    PatientRequestContact: [{ id: 'C1', request_id: 'R1', status: 'active' }],
    RequestMatch: ['A', 'D', 'E', 'F'].map((id, index) => ({ id: `M${id}`, request_id: 'R1', location_id: id, rank: index + 1, result_bucket: 'top3' })),
    ProviderLocation: ['A', 'D', 'E', 'F'].map((id) => readyLocation(id)),
    LocationService: ['A', 'D', 'E', 'F'].map((id) => service(id)),
    ProviderMembership: ['A', 'D', 'E', 'F'].map((id) => member(id)),
    ProviderLead: [],
  };
  const distFile = await bundle('base44/functions/authorizePatientRequestDistribution/entry.ts', [
    [/patientRequestAccessGrant\.js$/, 'export async function findPatientRequestContactForToken(svc, requestId) { const rows = await svc.entities.PatientRequestContact.filter({ request_id: requestId, status: "active" }); return rows[0] || null; }'],
    [/patientRequestDistributionLock\.js$/, 'export async function acquirePatientRequestDistributionLock(_svc, requestId) { return { requestId, token: "t" }; } export async function releasePatientRequestDistributionLock() {}'],
    [/leadCommunicationNotifications\.js$/, 'export async function notifyProviderLeadAvailable() {}'],
    [/patientCommunicationNotifications\.js$/, 'export async function notifyPatientRequestDistributed() {}'],
  ], outDir);
  const distHandler = await loadHandler(distFile);
  globalThis.__viaseeTop3ReadyClient = { auth: { me: async () => null }, asServiceRole: { entities: fakeDb(dist).entities } };
  const distResponse = await distHandler(new Request('http://local/fn', { method: 'POST', body: JSON.stringify({
    request_id: 'R1', request_access_token: 'token-1', distribution_consent: true, consent_version: 'patient-request-distribution-top3-pro-v3',
  }) }));
  const distBody = await distResponse.json();
  assert.equal(distResponse.status, 200, JSON.stringify(distBody));
  assert.equal(distBody.lead_count, 4);
  assert.equal(distBody.top3_full_detail_count, TOP3_LIMIT, 'detaliile complete merg la cel mult 3 locații');
  const lead = Object.fromEntries(dist.ProviderLead.map((row) => [row.location_id, row]));
  assert.deepEqual(['A', 'D', 'E', 'F'].map((id) => [lead[id].access_tier, lead[id].result_bucket_snapshot]), [
    ['pro_full', 'top3'], ['pro_full', 'top3'], ['pro_full', 'top3'], ['free_preview', 'extended_confirmed'],
  ]);
} finally {
  await rm(outDir, { recursive: true, force: true });
}

// ---- Căutarea și ecranele ---------------------------------------------------------------------
const semantic = await read('base44/functions/matchProvidersSemantic/entry.ts');
assert.match(semantic, /await markRequestReadyResults\(svc, results, scopedLocations, servicesByLocation, needLevel\);/);
assert.match(semantic, /assignRequestReadyTop3\(\s*assignRecommendationBuckets\(results, Math\.max\(results\.length, 1\)\),\s*limit,\s*\)/);
assert.match(semantic, /result\.accepts_requests_via_viasee = readiness\.get\(result\.id\)\?\.ready === true/);
const fallback = await read('base44/functions/matchProviders/entry.ts');
assert.match(fallback, /const readyTop3 = eligibleByScore\.filter\(\(entry\) => entry\.acceptsRequests\)\.slice\(0, 3\);/);
assert.match(fallback, /accepts_requests_via_viasee:/);
for (const file of ['base44/shared/requestReadyRecommendation.js', 'base44/functions/createPatientRequest/entry.ts']) {
  assert.doesNotMatch(await read(file), /plan_code|entitlement|hasProviderFeature/, `${file}: planul nu intră în alegerea Top 3`);
}
const card = await read('src/components/intake2/MatchResultCard.jsx');
assert.match(card, /variant === "confirmed" && location\.accepts_requests_via_viasee === false/);
assert.match(card, /Nu primește încă cereri prin VIASEE · o poți contacta direct/);
const resultsScreen = await read('src/components/intake2/MatchResults.jsx');
assert.match(resultsScreen, /Selectate dintre locațiile care primesc cereri prin VIASEE/);
assert.match(resultsScreen, /Plata nu influențează ordinea/);

console.log('Top 3 request-ready (T4, T5): OK');
