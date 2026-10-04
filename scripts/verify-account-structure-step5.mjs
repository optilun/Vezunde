// Structura conturilor, pasul 5 (2026-10-04, aprobat de Alex).
//
// - Cererea de pacient se deschide din cont, fara linkul din email (openMyPatientRequest + accesele
//   din cont verificate de toate functiile cererii).
// - „Notificări” in contul personal: actualizarile tuturor cererilor contului.
// - „Salvate”: locatii si specialisti salvati de pe paginile publice.
// - Cabinetul propriu al specialistului porneste fluxul de locatie noua.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  ACCOUNT_ACCESS_GRANT_TTL_MS,
  MAX_ACCOUNT_ACCESS_GRANTS,
  contactMatchesAccessTokenHash,
  findPatientRequestContactForToken,
  nextAccountAccessGrants,
  sha256Hex,
} from '../base44/shared/patientRequestAccessGrant.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as FRONTEND_ROUTES } from '../shared/providerWorkspaceFunctionRouting.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as BACKEND_ROUTES } from '../base44/shared/providerWorkspaceFunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

function matches(row, query = {}) {
  return Object.entries(query).every(([key, expected]) => (
    expected && typeof expected === 'object' && !Array.isArray(expected) && '$in' in expected
      ? expected.$in.includes(row[key])
      : row[key] === expected
  ));
}

function fakeDb(tables) {
  let sequence = 0;
  const writes = [];
  const entities = new Proxy({}, {
    get: (_target, rawName) => {
      const name = String(rawName);
      tables[name] ||= [];
      return {
        async filter(query, _sort, limit, skip) {
          const found = tables[name].filter((row) => matches(row, query));
          const start = Number(skip) || 0;
          return found.slice(start, limit == null ? undefined : start + limit).map((row) => structuredClone(row));
        },
        async get(id) {
          const row = tables[name].find((item) => item.id === id);
          if (!row) throw new Error('not found');
          return structuredClone(row);
        },
        async create(data) {
          const row = { id: `${name}-${++sequence}`, created_date: new Date().toISOString(), ...structuredClone(data) };
          tables[name].push(row);
          writes.push(`${name}.create`);
          return structuredClone(row);
        },
        async update(id, data) {
          const row = tables[name].find((item) => item.id === id);
          if (!row) throw new Error('not found');
          Object.assign(row, structuredClone(data));
          writes.push(`${name}.update`);
          return structuredClone(row);
        },
      };
    },
  });
  return { entities, writes };
}

// ---------- 1. accesele din cont (helper comun) ----------
{
  const now = Date.parse('2026-10-04T10:00:00Z');
  const linkHash = await sha256Hex('link-token');
  const accountHash = await sha256Hex('account-token');
  const expiredHash = await sha256Hex('expired-token');
  const contact = {
    id: 'c1', request_id: 'r1', status: 'active', access_token_hash: linkHash,
    account_access_grants: [
      { token_hash: accountHash, expires_at: new Date(now + 1000).toISOString() },
      { token_hash: expiredHash, expires_at: new Date(now - 1000).toISOString() },
    ],
  };
  assert.ok(contactMatchesAccessTokenHash(contact, linkHash, now), 'linkul din email ramane valabil');
  assert.ok(contactMatchesAccessTokenHash(contact, accountHash, now), 'accesul din cont este valabil');
  assert.ok(!contactMatchesAccessTokenHash(contact, expiredHash, now), 'accesul expirat nu mai merge');
  assert.ok(!contactMatchesAccessTokenHash(contact, await sha256Hex('altceva'), now));

  const grants = nextAccountAccessGrants({ account_access_grants: Array.from({ length: 7 }, (_, index) => ({ token_hash: 'a'.repeat(63) + index, expires_at: new Date(now + 5000).toISOString() })) }, { tokenHash: 'b'.repeat(64), userId: 'u1', now });
  assert.equal(grants.length, MAX_ACCOUNT_ACCESS_GRANTS, 'cel mult 5 accese din cont');
  assert.equal(grants[0].token_hash, 'b'.repeat(64), 'cel nou primul');
  assert.equal(Date.parse(grants[0].expires_at) - now, ACCOUNT_ACCESS_GRANT_TTL_MS, '30 de zile');

  const db = fakeDb({ PatientRequestContact: [structuredClone(contact), { id: 'c2', request_id: 'r2', status: 'active', access_token_hash: await sha256Hex('r2-token') }] });
  const svc = { entities: db.entities };
  assert.equal((await findPatientRequestContactForToken(svc, 'r1', 'link-token'))?.id, 'c1');
  assert.equal((await findPatientRequestContactForToken(svc, 'r1', 'account-token'))?.id, 'c1');
  assert.equal(await findPatientRequestContactForToken(svc, 'r1', 'expired-token'), null);
  assert.equal(await findPatientRequestContactForToken(svc, 'r1', 'r2-token'), null, 'tokenul altei cereri nu deschide cererea');
  assert.equal(await findPatientRequestContactForToken(svc, 'r1', ''), null);
}

// ---------- 2. functiile logice, rulate pe date false ----------
const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-step5-'));
try {
  const handlers = {};
  for (const name of ['openMyPatientRequest', 'mySavedItemsOps', 'myPatientNotificationsOps']) {
    const outfile = path.join(outDir, `${name}.mjs`);
    await build({
      entryPoints: [path.join(root, `base44/functions/getMyProviderWorkspace/${name}.ts`)],
      bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
      plugins: [{ name: 'sdk', setup(b) {
        b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
        b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeStep5Client; }', loader: 'js' }));
      } }],
    });
    handlers[name] = (await import(pathToFileURL(outfile).href)).handle;
  }
  const call = async (db, name, user, body = {}) => {
    globalThis.__viaseeStep5Client = { auth: { me: async () => user }, asServiceRole: { entities: db.entities } };
    const response = await handlers[name](new Request('http://local/fn', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };

  // --- deschiderea cererii din cont ---
  {
    const tables = {
      PatientRequest: [
        { id: 'r1', requester_user_id: 'u1', persistence_state: 'complete', public_reference: 'VS-AAA' },
        { id: 'r2', requester_user_id: 'u2', persistence_state: 'complete', public_reference: 'VS-BBB' },
        { id: 'r3', requester_user_id: 'u1', persistence_state: 'complete', public_reference: 'VS-CCC' },
      ],
      PatientRequestContact: [
        { id: 'c1', request_id: 'r1', status: 'active', access_token_hash: await sha256Hex('link-token') },
        { id: 'c2', request_id: 'r2', status: 'active', access_token_hash: 'x' },
        { id: 'c3', request_id: 'r3', status: 'active', access_token_hash: 'y', retention_until: '2020-01-01T00:00:00Z' },
      ],
    };
    const db = fakeDb(tables);
    assert.equal((await call(db, 'openMyPatientRequest', null, { request_id: 'r1' })).status, 401);
    assert.equal((await call(db, 'openMyPatientRequest', { id: 'u1' }, { request_id: 'r2' })).status, 404, 'cererea altui cont nu se deschide');
    assert.equal((await call(db, 'openMyPatientRequest', { id: 'u1' }, { request_id: 'r3' })).status, 410, 'cererea fara date pastrate nu se deschide');
    const opened = await call(db, 'openMyPatientRequest', { id: 'u1' }, { request_id: 'r1' });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.public_reference, 'VS-AAA');
    assert.ok(opened.body.access_token.length >= 32);
    const stored = tables.PatientRequestContact.find((row) => row.id === 'c1');
    assert.equal(stored.access_token_hash, await sha256Hex('link-token'), 'linkul din email ramane neschimbat');
    assert.equal(stored.account_access_grants[0].token_hash, await sha256Hex(opened.body.access_token), 'se pastreaza doar hash-ul');
    assert.doesNotMatch(JSON.stringify(stored), new RegExp(opened.body.access_token), 'tokenul nu se salveaza in clar');
    assert.equal((await findPatientRequestContactForToken({ entities: db.entities }, 'r1', opened.body.access_token))?.id, 'c1', 'functiile cererii accepta accesul din cont');
  }

  // --- salvate ---
  {
    const tables = {
      ProviderLocation: [
        { id: 'L1', name: 'Optica Test', status: 'publicata', public_visibility_status: 'approved', active_status: 'activa', profile_control_status: 'claimed', provider_type: 'optica_medicala', city: 'Cluj', photo_url: 'https://img.exemplu.test/a.jpg' },
        { id: 'L2', name: 'Ascunsa', status: 'in_verificare', public_visibility_status: 'archived', active_status: 'inactiva' },
      ],
      ProfessionalProfile: [
        { id: 'P1', full_name: 'Specialist Test', is_public: true, verification_status: 'verified', public_visibility_status: 'approved', professional_type: 'optometrist', profile_review_status: 'approved' },
      ],
      SavedItem: [],
    };
    const db = fakeDb(tables);
    assert.equal((await call(db, 'mySavedItemsOps', null, { action: 'list' })).status, 401);
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'location', item_id: 'L2' })).status, 404, 'profilurile nepublice nu se salveaza');
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'altceva', item_id: 'L1' })).status, 400);
    let result = await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'location', item_id: 'L1' });
    assert.equal(result.body.saved, true);
    await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'location', item_id: 'L1' });
    assert.equal(tables.SavedItem.length, 1, 'salvarea repetata nu dubleaza');
    const professionalSave = await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'professional', item_id: 'P1' });
    assert.equal(professionalSave.status, 200, JSON.stringify(professionalSave.body));
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'status', item_type: 'location', item_id: 'L1' })).body.saved, true);
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u2' }, { action: 'status', item_type: 'location', item_id: 'L1' })).body.saved, false, 'salvatele sunt ale fiecarui cont');
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u2' }, { action: 'list' })).body.items.length, 0);

    result = await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'list' });
    const location = result.body.items.find((item) => item.item_type === 'location');
    assert.equal(location.available, true);
    assert.equal(location.name, 'Optica Test');
    assert.equal(location.url, '/furnizor/L1');
    assert.equal(result.body.items.find((item) => item.item_type === 'professional').url, '/specialist/P1');

    tables.ProviderLocation[0].status = 'suspendata';
    result = await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'list' });
    const hidden = result.body.items.find((item) => item.item_type === 'location');
    assert.equal(hidden.available, false, 'un profil care nu mai e public ramane fara date');
    assert.equal(hidden.name, undefined);
    tables.ProviderLocation[0].status = 'publicata';

    await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'remove', item_type: 'location', item_id: 'L1' });
    assert.equal(tables.SavedItem.find((row) => row.item_id === 'L1').status, 'removed', 'scoaterea nu sterge randul');
    assert.equal((await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'list' })).body.items.length, 1);
    await call(db, 'mySavedItemsOps', { id: 'u1' }, { action: 'save', item_type: 'location', item_id: 'L1' });
    assert.equal(tables.SavedItem.filter((row) => row.item_id === 'L1').length, 1, 'o salvare noua reactiveaza randul');
    assert.equal(tables.SavedItem.find((row) => row.item_id === 'L1').status, 'active');
  }

  // --- notificari ---
  {
    const tables = {
      PatientRequest: [
        { id: 'r1', requester_user_id: 'u1', persistence_state: 'complete', public_reference: 'VS-AAA', intent: 'control_vedere', lifecycle_state: 'resolved' },
        { id: 'r2', requester_user_id: 'u2', persistence_state: 'complete', public_reference: 'VS-BBB', intent: 'control_vedere', lifecycle_state: 'resolved' },
      ],
      InAppNotification: [
        { id: 'n1', recipient_type: 'patient_request', recipient_ref_id: 'r1', request_id: 'r1', event_key: 'patient_response_received', title: 'Raspuns nou', body: 'O optica a raspuns.', status: 'unread', created_date: '2026-10-03T10:00:00Z' },
        { id: 'n2', recipient_type: 'patient_request', recipient_ref_id: 'r1', request_id: 'r1', title: 'Mesaj nou', status: 'read', created_date: '2026-10-04T10:00:00Z' },
        { id: 'n3', recipient_type: 'patient_request', recipient_ref_id: 'r2', request_id: 'r2', title: 'Al altcuiva', status: 'unread', created_date: '2026-10-04T11:00:00Z' },
        { id: 'n4', recipient_type: 'provider_location', recipient_ref_id: 'L1', request_id: 'r1', title: 'Pentru furnizor', status: 'unread', created_date: '2026-10-04T12:00:00Z' },
      ],
    };
    const db = fakeDb(tables);
    assert.equal((await call(db, 'myPatientNotificationsOps', null, { action: 'list' })).status, 401);
    let result = await call(db, 'myPatientNotificationsOps', { id: 'u1' }, { action: 'list' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.notifications.map((item) => item.id), ['n2', 'n1'], 'doar notificarile cererilor contului, cele noi primele');
    assert.equal(result.body.counters.unread, 1);
    assert.equal(result.body.notifications[1].request_reference, 'VS-AAA');
    assert.equal(result.body.notifications[1].request_label, 'Control de vedere');
    assert.equal((await call(db, 'myPatientNotificationsOps', { id: 'u1' }, { action: 'mark_read', notification_id: 'n3' })).status, 404, 'notificarea altui cont nu se poate marca');
    assert.equal((await call(db, 'myPatientNotificationsOps', { id: 'u1' }, { action: 'mark_read', notification_id: 'n4' })).status, 404, 'notificarile furnizorului nu apar la pacient');
    await call(db, 'myPatientNotificationsOps', { id: 'u1' }, { action: 'mark_all_read' });
    assert.equal(tables.InAppNotification.find((row) => row.id === 'n1').status, 'read');
    assert.equal(tables.InAppNotification.find((row) => row.id === 'n3').status, 'unread', 'notificarile altui cont raman neatinse');
    assert.equal(tables.InAppNotification.find((row) => row.id === 'n4').status, 'unread');
  }
} finally {
  await rm(outDir, { recursive: true, force: true });
}

// ---------- 3. rute si functiile cererii ----------
for (const name of ['openMyPatientRequest', 'myPatientNotificationsOps', 'mySavedItemsOps']) {
  assert.equal(FRONTEND_ROUTES[name], 'getMyProviderWorkspace');
  assert.equal(BACKEND_ROUTES[name], 'getMyProviderWorkspace');
}
for (const fn of ['getPatientRequestStatus', 'authorizePatientRequestDistribution', 'controlledChatOps', 'managePatientContactShareApproval', 'patientRequestEmailVerificationOps']) {
  const source = await read(`base44/functions/${fn}/entry.ts`);
  assert.match(source, /findPatientRequestContactForToken\(svc, /, `${fn} accepta si accesul din cont`);
  assert.doesNotMatch(source, /access_token_hash: tokenHash/, `${fn} nu mai are verificarea veche, separata`);
}
const contactSchema = JSON.parse(await read('base44/entities/PatientRequestContact.jsonc'));
assert.equal(contactSchema.properties.account_access_grants.type, 'array');
assert.equal(contactSchema.rls.read.user_condition.role, 'admin');
const savedSchema = JSON.parse(await read('base44/entities/SavedItem.jsonc'));
assert.deepEqual(savedSchema.properties.item_type.enum, ['location', 'professional']);
for (const operation of ['create', 'read', 'update', 'delete']) assert.equal(savedSchema.rls[operation].user_condition.role, 'admin', 'salvatele trec doar prin functie');

// ---------- 4. interfata ----------
const [nav, personalWorkspace, personalRequests, notifications, saved, saveButton, providerProfile, professionalProfile, professionalRoot, myAccount, overview] = await Promise.all([
  read('src/lib/workspaceNav.js'),
  read('src/components/workspace/personal/PersonalAccountWorkspace.jsx'),
  read('src/components/workspace/personal/PersonalRequests.jsx'),
  read('src/components/workspace/personal/PersonalNotifications.jsx'),
  read('src/components/workspace/personal/PersonalSaved.jsx'),
  read('src/components/saved/SaveToAccountButton.jsx'),
  read('src/pages/ProviderProfile.jsx'),
  read('src/pages/ProfessionalProfile.jsx'),
  read('src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx'),
  read('src/pages/MyAccount.jsx'),
  read('src/components/workspace/personal/PersonalOverview.jsx'),
]);
assert.match(nav, /key: "notifications", label: "Notificări"/);
assert.match(nav, /key: "saved", label: "Salvate"/);
assert.match(personalWorkspace, /section === "notifications" && <PersonalNotifications \/>/);
assert.match(personalWorkspace, /section === "saved" && <PersonalSaved \/>/);
assert.match(personalRequests, /openMyPatientRequest\(request\.id\)/, 'cererea se deschide din cont, fara link');
assert.doesNotMatch(personalRequests, /deschide cererea din emailul primit/);
assert.match(notifications, /invoke\("myPatientNotificationsOps"/);
assert.match(notifications, /openMyPatientRequest\(notification\.request_id\)/);
assert.match(saved, /invoke\("mySavedItemsOps"/);
assert.match(saveButton, /navigateToLogin\(window\.location\.href\)/, 'fara cont, salvarea trece prin autentificare');
assert.match(providerProfile, /<SaveToAccountButton itemType="location" itemId=\{profile\.id\} \/>/);
assert.match(professionalProfile, /<SaveToAccountButton itemType="professional"/);
assert.match(professionalRoot, /state=\{\{ startFlow: "new_location" \}\}/, 'cabinetul propriu porneste fluxul de locatie noua');
assert.match(myAccount, /duplicateReviewRedirect/);
assert.match(overview, /onNavigate\?\.\("notifications"\)/);
assert.match(overview, /onNavigate\?\.\("saved"\)/);

console.log('Account structure step 5: OK');
