// Audit Setări, S5 (2026-10-09; Alex: „Fiecare își alege”): emailul la cereri noi poate fi oprit de
// fiecare proprietar sau manager, pe fiecare locație. Notificarea din aplicație rămâne pentru toți.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { notifyProviderLeadAvailable } from '../base44/shared/leadCommunicationNotifications.js';
import { saveLeadEmailPreference, usersWithLeadEmailOff } from '../base44/shared/providerLeadEmailPreference.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as FRONT } from '../shared/providerWorkspaceFunctionRouting.js';
import { PROVIDER_WORKSPACE_FUNCTION_ROUTES as BACK } from '../base44/shared/providerWorkspaceFunctionRouting.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    return {
      async filter(query, _sort, limit) { return tables[name].filter((row) => matches(row, query)).slice(0, limit ?? undefined).map((row) => structuredClone(row)); },
      async get(id) { const row = tables[name].find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { const row = { id: `${name}-${++sequence}`, created_date: new Date().toISOString(), updated_date: new Date().toISOString(), ...structuredClone(data) }; tables[name].push(row); return structuredClone(row); },
      async update(id, data) { const row = tables[name].find((item) => item.id === id); Object.assign(row, structuredClone(data), { updated_date: new Date().toISOString() }); return structuredClone(row); },
    };
  } });
  return { entities };
}

const tables = {
  ProviderMembership: [
    { id: 'm1', user_id: 'owner', location_id: 'L1', status: 'active', role: 'organization_owner' },
    { id: 'm2', user_id: 'manager', location_id: 'L1', status: 'active', role: 'location_manager' },
    { id: 'm3', user_id: 'member', location_id: 'L1', status: 'active', role: 'location_member' },
  ],
  ProviderLocation: [{ id: 'L1', organization_id: 'O1', name: 'Locația test', city: 'Cluj-Napoca', status: 'publicata' }],
  User: [{ id: 'owner', email: 'owner@example.test' }, { id: 'manager', email: 'manager@example.test' }, { id: 'member', email: 'member@example.test' }],
  ProviderActivityPreference: [],
};
const db = fakeDb(tables);
const svc = { entities: db.entities };
const sent = [];
const base44 = { integrations: { Core: { SendEmail: async (message) => { sent.push(message.to); } } } };
const lead = { id: 'lead-1', request_id: 'req-1', organization_id: 'O1', location_id: 'L1', city: 'Cluj-Napoca', intent_label: 'Consult' };
const location = tables.ProviderLocation[0];

// Implicit: proprietarul și managerul primesc email (ca înainte); membrul nu.
let result = await notifyProviderLeadAvailable({ base44, svc, lead, location });
assert.deepEqual(sent.sort(), ['manager@example.test', 'owner@example.test']);
assert.equal(result.sent, 2);

// Managerul oprește emailul: rezumatul săptămânal (weekly_enabled) rămâne neatins.
await saveLeadEmailPreference(svc, 'manager', 'L1', false);
assert.equal(tables.ProviderActivityPreference[0].weekly_enabled, true);
assert.deepEqual([...await usersWithLeadEmailOff(svc, 'L1')], ['manager']);
sent.length = 0;
result = await notifyProviderLeadAvailable({ base44, svc, lead: { ...lead, id: 'lead-2' }, location });
assert.deepEqual(sent, ['owner@example.test'], 'cine a oprit emailul nu-l mai primește');
assert.equal(result.skipped, 1);
assert.ok(tables.CommunicationDelivery.some((row) => row.recipient_ref_id === 'manager' && /email_turned_off_by_user/.test(JSON.stringify(row))), 'oprirea e înregistrată');
const inApp = (tables.InAppNotification || []).filter((row) => row.source_entity_id === 'lead-2');
assert.ok(inApp.length >= 1, 'notificarea din aplicație rămâne');

// Preferința setată de rezumatul săptămânal (fără câmpul nou) nu oprește emailul.
tables.ProviderActivityPreference.push({ id: 'p-weekly', user_id: 'owner', location_id: 'L1', weekly_enabled: false, updated_date: new Date().toISOString() });
assert.ok(!(await usersWithLeadEmailOff(svc, 'L1')).has('owner'));

// Funcția din Setările contului.
assert.equal(FRONT.myNotificationPreferencesOps, BACK.myNotificationPreferencesOps);
const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-lead-email-'));
try {
  const outfile = path.join(outDir, 'ops.mjs');
  await build({
    entryPoints: [path.join(root, 'base44/functions/getMyProviderWorkspace/myNotificationPreferencesOps.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
    plugins: [{ name: 'sdk', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeLeadEmailClient; }', loader: 'js' }));
    } }],
  });
  const { handle } = await import(pathToFileURL(outfile).href);
  const call = async (userId, body) => {
    globalThis.__viaseeLeadEmailClient = { auth: { me: async () => ({ id: userId }) }, asServiceRole: { entities: db.entities } };
    const response = await handle(new Request('http://local/fn', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
  let res = await call('manager', { action: 'list' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((item) => [item.location_id, item.role_label, item.lead_email_enabled]), [['L1', 'Manager', false]]);
  res = await call('member', { action: 'list' });
  assert.deepEqual(res.body.items, [], 'membrul nu primește emailuri, deci nu are ce alege');
  res = await call('member', { action: 'set', location_id: 'L1', lead_email_enabled: false });
  assert.equal(res.status, 403);
  res = await call('manager', { action: 'set', location_id: 'L1', lead_email_enabled: 'nu' });
  assert.equal(res.status, 400);
  res = await call('manager', { action: 'set', location_id: 'L1', lead_email_enabled: true });
  assert.equal(res.status, 200);
  assert.ok(!(await usersWithLeadEmailOff(svc, 'L1')).has('manager'), 'emailul pornit din nou');
} finally {
  await rm(outDir, { recursive: true, force: true });
}

const account = await readFile(path.join(root, 'src/components/workspace/account/AccountSettings.jsx'), 'utf8');
assert.match(account, /title="Notificări pe email"/);
assert.match(account, /if \(state\.status === "ready" && state\.items\.length === 0\) return null;/, 'fără locații, secțiunea lipsește');
const settings = await readFile(path.join(root, 'src/components/workspace/provider/ProviderSettings.jsx'), 'utf8');
assert.match(settings, /title="Notificări pe email"/);

console.log('Lead email preferences: OK');
