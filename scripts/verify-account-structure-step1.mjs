// Structura conturilor, pasul 1 (2026-10-03, aprobat de Alex).
//
// - Contul personal este contul de pacient: „Cererile mele” arata cererile trimise ca pacient
//   (getMyPatientRequests), nu revendicarile de organizatii.
// - Revendicarile stau in grupul Organizatii („Solicitări de organizație”), cu istoric complet.
// - „Echipă” este in meniul organizatiei: acces + specialisti afisati public.
// - Setarile contului sunt intr-un singur loc (contul personal / meniul avatarului).
// - Profilul profesional se poate crea din cont.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { patientRequestLifecycle, patientRequestResponseLabel } from '../src/lib/myPatientRequests.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES } from '../base44/shared/providerWorkspaceFunctionRouting.js';
import { READ_ONLY_RETRY_FUNCTIONS } from '../src/api/base44FunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

// ---------- getMyPatientRequests, rulat pe date false ----------
function matches(row, query = {}) {
  return Object.entries(query).every(([key, expected]) => (
    expected && typeof expected === 'object' && !Array.isArray(expected) && '$in' in expected
      ? expected.$in.includes(row[key])
      : row[key] === expected
  ));
}
function fakeDb(tables) {
  const calls = [];
  const entities = new Proxy({}, {
    get: (_target, name) => ({
      async filter(query, _sort, limit, skip) {
        calls.push(`${String(name)}.filter`);
        const found = (tables[name] || []).filter((row) => matches(row, query));
        const start = Number(skip) || 0;
        return found.slice(start, limit == null ? undefined : start + limit).map((row) => ({ ...row }));
      },
      async get(id) { const row = (tables[name] || []).find((item) => item.id === id); if (!row) throw new Error('not found'); return { ...row }; },
      async create() { throw new Error('scriere interzisa'); },
      async update() { throw new Error('scriere interzisa'); },
    }),
  });
  return { entities, calls };
}

const tables = {
  PatientRequest: [
    { id: 'r1', requester_user_id: 'u1', persistence_state: 'complete', public_reference: 'VS-AAA', intent: 'control_vedere', city: 'Timișoara', lifecycle_state: 'active', status: 'procesata', created_date: '2026-10-01T10:00:00Z', submitted_at: '2026-10-01T10:00:00Z', distribution_lock_token: 'secret', contact_email_hash: 'hash' },
    { id: 'r2', requester_user_id: 'u1', persistence_state: 'complete', public_reference: 'VS-BBB', intent: 'necunoscut', lifecycle_state: 'resolved', created_date: '2026-09-01T10:00:00Z' },
    { id: 'r3', requester_user_id: 'u1', persistence_state: 'creating', public_reference: 'VS-CCC', intent: 'control_vedere' },
    { id: 'r4', requester_user_id: 'u2', persistence_state: 'complete', public_reference: 'VS-DDD', intent: 'control_vedere' },
  ],
  ProviderLeadResponse: [
    { id: 'p1', request_id: 'r1', location_id: 'L1', status: 'active' },
    { id: 'p2', request_id: 'r1', location_id: 'L2', status: 'active' },
    { id: 'p3', request_id: 'r1', location_id: 'L2', status: 'active' },
    { id: 'p4', request_id: 'r1', location_id: 'L3', status: 'withdrawn' },
    { id: 'p5', request_id: 'r4', location_id: 'L1', status: 'active' },
  ],
};

const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-step1-'));
try {
  const outfile = path.join(outDir, 'getMyPatientRequests.mjs');
  await build({
    entryPoints: [path.join(root, 'base44/functions/getMyProviderWorkspace/getMyPatientRequests.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
    plugins: [{ name: 'sdk', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeStep1Client; }', loader: 'js' }));
    } }],
  });
  const { handle } = await import(pathToFileURL(outfile).href);
  const run = async (user) => {
    const db = fakeDb(tables);
    globalThis.__viaseeStep1Client = { auth: { me: async () => user }, asServiceRole: { entities: db.entities } };
    const response = await handle(new Request('http://local/fn', { method: 'POST', body: '{}' }));
    return { status: response.status, body: await response.json(), calls: db.calls };
  };

  const anonymous = await run(null);
  assert.equal(anonymous.status, 401, 'fara login nu se listeaza nimic');

  const mine = await run({ id: 'u1' });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.requests.map((request) => request.public_reference), ['VS-AAA', 'VS-BBB'], 'doar cererile contului, complet salvate');
  assert.equal(mine.body.requests[0].response_count, 2, 'raspunsurile active, cate o locatie o singura data');
  assert.equal(mine.body.requests[1].response_count, 0);
  assert.equal(mine.body.requests[0].intent_label, 'Control de vedere');
  const serialized = JSON.stringify(mine.body);
  assert.doesNotMatch(serialized, /secret|hash|token|contact_/i, 'fara token, hash-uri sau date de contact');
  assert.equal(mine.calls.length, 2, 'o citire pentru cereri si una grupata pentru raspunsuri');
} finally {
  await rm(outDir, { recursive: true, force: true });
}

assert.equal(PROVIDER_WORKSPACE_FUNCTION_ROUTES.getMyPatientRequests, 'getMyProviderWorkspace');
assert.ok(READ_ONLY_RETRY_FUNCTIONS.has('getMyPatientRequests'), 'citire: se poate reincerca');
const router = await read('base44/functions/getMyProviderWorkspace/router.ts');
assert.match(router, /getMyPatientRequests: getMyPatientRequestsHandle/);

// ---------- etichetele listei ----------
assert.equal(patientRequestLifecycle({ lifecycle_state: 'active', expires_at: '2026-01-01T00:00:00Z' }, Date.parse('2026-10-03')).label, 'Expirată');
assert.equal(patientRequestLifecycle({ lifecycle_state: 'active', expires_at: '2027-01-01T00:00:00Z' }, Date.parse('2026-10-03')).label, 'Activă');
assert.equal(patientRequestLifecycle({ lifecycle_state: 'resolved' }).label, 'Rezolvată');
assert.equal(patientRequestResponseLabel(1), '1 răspuns');
assert.equal(patientRequestResponseLabel(3), '3 răspunsuri');

// ---------- interfata ----------
const [personalRequests, personalWorkspace, personalOverview, claimHistory, applicantRoot, myAccount, sidebar, nav, professionalRoot, providerRoot, teamLinks] = await Promise.all([
  read('src/components/workspace/personal/PersonalRequests.jsx'),
  read('src/components/workspace/personal/PersonalAccountWorkspace.jsx'),
  read('src/components/workspace/personal/PersonalOverview.jsx'),
  read('src/components/workspace/applicant/OrganizationClaimHistory.jsx'),
  read('src/components/workspace/applicant/ApplicantWorkspaceRoot.jsx'),
  read('src/pages/MyAccount.jsx'),
  read('src/components/provider/shell/ProviderSidebarContent.jsx'),
  read('src/lib/workspaceNav.js'),
  read('src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx'),
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('src/components/workspace/provider/ProviderTeamSpecialistsLinks.jsx'),
]);

assert.match(personalRequests, /invoke\("getMyPatientRequests"/, 'Cererile mele = cererile de pacient');
assert.doesNotMatch(personalRequests, /ProviderClaimRequest/, 'revendicarile nu mai sunt in contul personal');
assert.doesNotMatch(personalWorkspace, /PersonalSaved|"saved"/, 'ecranul gol „Locații salvate” a iesit din meniu');
assert.match(personalOverview, /\/profil-profesional\/nou/, 'profilul profesional se poate crea din cont');
assert.match(personalOverview, /onOpenOrganization\?\.\(\{ mode: "applicant" \}\)/, 'ultima solicitare duce la Organizatii');
assert.match(claimHistory, /ProviderClaimRequest\.filter\(\{ user_id: user\.id \}/);
assert.match(applicantRoot, /getApplicantNav\(\{ hasActiveClaim \}\)/);
assert.match(applicantRoot, /OrganizationClaimHistory/);
assert.match(myAccount, /const hasApplicantSpace = hasApplicantWorkspace \|\| hasClaimHistory;/);
assert.match(myAccount, /key: "create-professional"/);
assert.match(myAccount, /key: "create-organization"/);
assert.match(myAccount, /\.\.\.\(hasApplicantWorkspace \? \["applicant"\] : \[\]\), "personal"\]/, 'istoricul singur nu devine spatiul implicit');
assert.match(sidebar, /if \(kind === "create"\) return Plus;/);
assert.match(sidebar, /organizationItems\.filter\(\(item\) => item\.kind !== "create"\)\.length/);
assert.match(nav, /key: "requests", label: "Cererile mele"/);
assert.match(nav, /key: "access", label: "Echipă"/);
assert.doesNotMatch(professionalRoot, /key: "settings"/, 'profilul profesional nu mai dubleaza setarile contului');
assert.doesNotMatch(professionalRoot, /<AccountSettings/);
assert.match(providerRoot, /<ProviderTeamSpecialistsLinks/);
assert.match(teamLinks, /onOpenModule\?\.\("specialisti", location\.id\)/);

console.log('Account structure step 1: OK');
