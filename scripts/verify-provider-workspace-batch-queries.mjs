// Spatiul de furnizor nu mai face interogari separate pentru fiecare locatie.
//
// 2026-10-03. Contul de test (3 organizatii) primea „Rate limit exceeded”: getMyProviderWorkspace,
// prezentarea, membrii si completarea profilului citeau datele locatie cu locatie (la o retea de
// 87 de locatii, ~700 de apeluri la o singura incarcare). Acum citirile sunt grupate cu `$in`
// (base44/shared/providerWorkspaceBatchQueries.js). Scriptul verifica:
// 1. ajutoarele de citire grupata (paginare, loturi de ID-uri, revenire la `get`);
// 2. ca functiile reale, rulate pe date false, fac ACELASI numar de apeluri la 3 si la 40 de locatii
//    si numara corect continutul;
// 3. reincercarea cu pauza aleatoare si unirea cererilor de citire identice simultane;
// 4. reincarcarea la `focus` cel mult o data la 30 s.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  chunkIds,
  filterAllPages,
  filterByIdList,
  getManyByIds,
  loadLocationContentIndex,
  rowsFor,
} from '../base44/shared/providerWorkspaceBatchQueries.js';
import { retryDelayMs, withTransientRetry } from '../src/lib/transientRetry.js';
import { READ_ONLY_RETRY_DELAYS_MS, READ_ONLY_RETRY_JITTER_MS, installBase44FunctionRouting } from '../src/api/base44FunctionRouting.js';
import { FOCUS_REFRESH_MIN_INTERVAL_MS, focusRefreshGate } from '../src/lib/focusRefreshGate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

// ---------- Fake Base44 ----------
function matches(row, query = {}) {
  for (const [key, expected] of Object.entries(query || {})) {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected && !expected.$in.includes(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}
function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => ((a[field] ?? '') === (b[field] ?? '') ? 0 : ((a[field] ?? '') < (b[field] ?? '') ? -1 : 1) * (desc ? -1 : 1)));
}
function fakeEntity(rows, calls, name, { filterResult } = {}) {
  return {
    async filter(query, sort, limit, skip) {
      calls.push(`${name}.filter`);
      if (filterResult) return filterResult(query);
      const found = sortRows(rows.filter((row) => matches(row, query)), sort);
      const start = Number(skip) || 0;
      return found.slice(start, limit == null ? undefined : start + limit).map((row) => ({ ...row }));
    },
    async get(id) {
      calls.push(`${name}.get`);
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error('not found');
      return { ...row };
    },
    async create() { throw new Error(`${name}.create nu este permis in citiri`); },
    async update() { throw new Error(`${name}.update nu este permis in citiri`); },
  };
}
function fakeDb(tables) {
  const calls = [];
  const entities = new Proxy({}, { get: (_target, name) => fakeEntity(tables[name] || [], calls, String(name)) });
  return { entities, calls };
}

// ---------- 1. Ajutoarele ----------
assert.deepEqual(chunkIds(['a', 'b', 'a', '', null, 'c'], 2), [['a', 'b'], ['c']]);
{
  const calls = [];
  const rows = Array.from({ length: 7 }, (_, index) => ({ id: `r${index}`, location_id: `L${index % 3}`, created_date: String(index).padStart(2, '0') }));
  const entity = fakeEntity(rows, calls, 'Row');
  assert.equal((await filterAllPages(entity, {}, { pageSize: 3 })).length, 7, 'toate paginile sunt citite');
  assert.equal(calls.length, 3, '7 randuri in pagini de 3 = 3 apeluri');
  calls.length = 0;
  const byLocation = await filterByIdList(entity, 'location_id', ['L0', 'L1', 'L2'], {}, { idsPerQuery: 2, pageSize: 500 });
  assert.equal(byLocation.length, 7);
  assert.equal(calls.length, 2, 'cate un apel pentru fiecare lot de ID-uri');
}
{
  const calls = [];
  const rows = [{ id: 'x1' }, { id: 'x2' }];
  const silent = fakeEntity(rows, calls, 'Silent', { filterResult: () => [] });
  const found = await getManyByIds(silent, ['x1', 'x2', 'lipsa']);
  assert.deepEqual([...found.keys()], ['x1', 'x2'], 'daca citirea grupata nu intoarce nimic, se revine la get, ca inainte');
  const failing = fakeEntity(rows, calls, 'Failing', { filterResult: () => { throw new Error('Rate limit exceeded'); } });
  assert.deepEqual([...(await getManyByIds(failing, ['x2'])).keys()], ['x2'], 'si daca citirea grupata esueaza');
  calls.length = 0;
  const normal = fakeEntity(rows, calls, 'Normal');
  assert.equal((await getManyByIds(normal, ['x1', 'x2'])).size, 2);
  assert.deepEqual(calls, ['Normal.filter'], 'un singur apel cand citirea grupata merge');
}
{
  const db = fakeDb({
    LocationService: [{ id: 's1', location_id: 'L1', is_active: true }, { id: 's2', location_id: 'L1', is_active: false }, { id: 's3', location_id: 'L2', is_active: true }],
    ProviderMediaAsset: [{ id: 'm1', location_id: 'L2', status: 'approved' }],
  });
  const index = await loadLocationContentIndex({ entities: db.entities }, ['L1', 'L2'], { parts: ['services', 'media'] });
  assert.equal(rowsFor(index.services, 'L1').length, 1, 'doar serviciile active');
  assert.equal(rowsFor(index.media, 'L2').length, 1);
  assert.equal(rowsFor(index.team, 'L1').length, 0, 'partile necitite raman goale');
  assert.equal(db.calls.length, 2);
}

// ---------- 2. Functiile reale pe date false ----------
function dataset(locationCount) {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 8, 1, 0, 0, tick++)).toISOString();
  const t = {};
  const add = (entity, row) => { (t[entity] ||= []).push({ created_date: stamp(), updated_date: stamp(), ...row }); };
  add('User', { id: 'u1', email: 'u1@exemplu.test', full_name: 'Utilizator Unu', role: 'user' });
  add('User', { id: 'u2', email: 'u2@exemplu.test', full_name: 'Utilizator Doi', role: 'user' });
  add('ProviderOrganization', { id: 'orgA', name: 'Optica A', status: 'activa' });
  for (let i = 1; i <= locationCount; i += 1) {
    const id = `A${i}`;
    add('ProviderLocation', { id, organization_id: 'orgA', name: `Locatia ${i}`, status: 'publicata', active_status: 'activa' });
    add('ProviderMembership', { id: `m-u1-${id}`, user_id: 'u1', organization_id: 'orgA', location_id: id, role: 'organization_owner', status: 'active', organization_wide_access: true, claim_scope: 'organization' });
    add('LocationService', { id: `s-${id}-1`, location_id: id, is_active: true });
    add('LocationService', { id: `s-${id}-2`, location_id: id, is_active: true });
    add('LocationService', { id: `s-${id}-3`, location_id: id, is_active: false });
    add('ProfessionalLocationAssignment', { id: `t-${id}`, location_id: id, active_status: 'activ', public_status: 'public' });
    add('ProviderMediaAsset', { id: `p-${id}`, location_id: id, status: 'approved', storage_reference: `ref-${id}` });
    add('ProviderWorkspaceSubmission', { id: `w-${id}`, location_id: id, organization_id: 'orgA', access_origin: 'provider_workspace', section: 'services', status: 'pending_review', submitted_by_user_id: 'u1' });
  }
  add('ProviderMembership', { id: 'm-u2-A1', user_id: 'u2', organization_id: 'orgA', location_id: 'A1', role: 'location_manager', status: 'active' });
  return t;
}

const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-ws-batch-'));
const sdkStub = { name: 'sdk-stub', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-stub' }));
  b.onLoad({ filter: /.*/, namespace: 'sdk-stub' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeFakeClient; }', loader: 'js' }));
} };
async function loadHandler(name) {
  const outfile = path.join(outDir, `${name}.mjs`);
  await build({ entryPoints: [path.join(root, `base44/functions/getMyProviderWorkspace/${name}.ts`)], bundle: true, platform: 'node', format: 'esm', outfile, plugins: [sdkStub], logLevel: 'silent' });
  return (await import(pathToFileURL(outfile).href)).handle;
}
async function runHandler(handle, tables, payload) {
  const db = fakeDb(tables);
  globalThis.__viaseeFakeClient = { auth: { me: async () => tables.User[0] }, asServiceRole: { entities: db.entities } };
  const response = await handle(new Request('http://local/fn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
  return { status: response.status, body: await response.json(), calls: db.calls.length };
}

try {
  const cases = [
    ['getMyProviderWorkspace', {}],
    ['getProviderWorkspaceOverview', { location_id: 'A1' }],
    ['getMyProviderMembers', { organization_id: 'orgA' }],
    ['getProviderProfileCompleteness', { location_id: 'A1' }],
    ['getMyAccountDeletionEligibility', {}],
  ];
  for (const [name, payload] of cases) {
    const handle = await loadHandler(name);
    const small = await runHandler(handle, dataset(3), payload);
    const large = await runHandler(handle, dataset(40), payload);
    assert.equal(small.status, 200, `${name}: ${JSON.stringify(small.body)}`);
    assert.equal(large.status, 200, `${name}: ${JSON.stringify(large.body)}`);
    assert.equal(large.calls, small.calls, `${name}: numarul de apeluri nu creste cu locatiile (3 locatii: ${small.calls}, 40 locatii: ${large.calls})`);
    assert.ok(large.calls <= 20, `${name}: ${large.calls} apeluri`);

    if (name === 'getMyProviderWorkspace') {
      assert.equal(large.body.locations.length, 40);
      const first = large.body.locations.find((location) => location.id === 'A1');
      assert.equal(first.content_summary.approved_service_count, 2, 'doar serviciile active');
      assert.equal(first.content_summary.approved_public_team_count, 1);
      assert.equal(first.content_summary.pending_service_review_count, 1);
      assert.equal(large.body.pending_review_count, 40);
      assert.equal(large.body.member_summary.counters.active_members_per_location.A1, 2);
      assert.equal(large.body.member_summary.active_member_count, 2);
    }
    if (name === 'getProviderWorkspaceOverview') {
      assert.equal(large.body.content_summary.approved_service_count, 80);
      assert.equal(large.body.content_summary.pending_service_review_count, 40);
      assert.equal(large.body.pending_submissions.length, 40);
      assert.equal(large.body.organization_summary.location_count, 40);
    }
    if (name === 'getMyProviderMembers') {
      assert.equal(large.body.members.length, 41);
      assert.equal(large.body.counters.active_members_total, 2);
      assert.ok(large.body.members.some((member) => member.user_name === 'Utilizator Doi'), 'numele membrilor vin din citirea grupata');
    }
    if (name === 'getProviderProfileCompleteness') assert.equal(large.body.locations.length, 40);
  }
} finally {
  await rm(outDir, { recursive: true, force: true });
}

const sources = await Promise.all([
  'getMyProviderWorkspace', 'getProviderWorkspaceOverview', 'getMyProviderMembers', 'getProviderProfileCompleteness', 'getMyAccountDeletionEligibility',
].map((name) => read(`base44/functions/getMyProviderWorkspace/${name}.ts`)));
for (const source of sources) {
  assert.match(source, /providerWorkspaceBatchQueries\.js/);
  assert.doesNotMatch(source, /for \(const (locationId|location|candidate) of [^)]*\) [^\n]*await svc\.entities/, 'nicio interogare intr-o bucla pe locatii');
}

// ---------- 3. Reincercare si cereri identice ----------
assert.deepEqual([...READ_ONLY_RETRY_DELAYS_MS], [1500, 4000]);
assert.equal(READ_ONLY_RETRY_JITTER_MS, 1000);
assert.equal(retryDelayMs(1500, 1000, () => 0), 1500);
assert.equal(retryDelayMs(1500, 1000, () => 0.999), 2499);
assert.equal(retryDelayMs(1500, 0, () => 0.9), 1500, 'fara jitter, pauza ramane fixa (paginile publice)');
{
  const waits = [];
  let attempt = 0;
  const result = await withTransientRetry(async () => {
    attempt += 1;
    if (attempt < 3) throw Object.assign(new Error('Rate limit exceeded'), { response: { status: 500 } });
    return 'ok';
  }, { delaysMs: [1500, 4000], jitterMs: 1000, random: () => 0.5, wait: async (ms) => { waits.push(ms); } });
  assert.equal(result, 'ok');
  assert.deepEqual(waits, [2000, 4500]);
}
{
  const invoked = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = { functions: { invoke: async (name, payload) => { invoked.push([name, payload]); await gate; return { data: { name } }; } } };
  const routed = installBase44FunctionRouting(client, { readOnlyRetry: { delaysMs: [], wait: async () => {} } });
  const first = routed.functions.invoke('getProviderEntitlement', { location_id: 'L1' });
  const second = routed.functions.invoke('getProviderEntitlement', { location_id: 'L1' });
  const other = routed.functions.invoke('getProviderEntitlement', { location_id: 'L2' });
  release();
  const [a, b] = await Promise.all([first, second, other]);
  assert.equal(a, b, 'aceeasi cerere de citire simultana primeste acelasi raspuns');
  assert.equal(invoked.length, 2, 'payload diferit = cerere separata');
  await routed.functions.invoke('getProviderEntitlement', { location_id: 'L1' });
  assert.equal(invoked.length, 3, 'dupa raspuns, cererea pleaca din nou (nu e cache)');
}
{
  const invoked = [];
  const client = { functions: { invoke: async (name) => { invoked.push(name); return { data: {} }; } } };
  const routed = installBase44FunctionRouting(client);
  await Promise.all([routed.functions.invoke('submitDirectoryCorrection', { a: 1 }), routed.functions.invoke('submitDirectoryCorrection', { a: 1 })]);
  assert.equal(invoked.length, 2, 'functiile care scriu nu se unesc niciodata');
}

// ---------- 4. Reincarcarea la focus ----------
{
  let now = 0;
  const gate = focusRefreshGate(FOCUS_REFRESH_MIN_INTERVAL_MS, () => now);
  assert.equal(gate.shouldRefresh(), false, 'imediat dupa montare nu se reincarca');
  now = 29999;
  assert.equal(gate.shouldRefresh(), false);
  now = 30000;
  assert.equal(gate.shouldRefresh(), true);
  assert.equal(gate.shouldRefresh(), false, 'doua focus-uri la rand = o singura reincarcare');
  now = 70000;
  gate.markLoaded();
  now = 90000;
  assert.equal(gate.shouldRefresh(), false, 'o incarcare normala reseteaza intervalul');
}
const workspaceRoot = await read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx');
const logoStatus = await read('src/components/workspace/provider/ProviderLogoReviewStatus.jsx');
assert.match(workspaceRoot, /focusRefreshGateRef\.current\?\.shouldRefresh\(\)/);
assert.match(workspaceRoot, /focusRefreshGateRef\.current\?\.markLoaded\(\)/);
assert.match(logoStatus, /gate\.shouldRefresh\(\)/);

console.log('Provider workspace batch queries: OK');
