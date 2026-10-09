import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { buildLocalInterest, deduplicateActivityNotifications, LOCAL_INTEREST_VERSION, DAY } from '../shared/providerLocalInterestPolicy.js';
import { ensureLocalInterestDigest, saveActivityPreference } from '../base44/shared/providerLocalInterestOps.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const now = Date.parse('2026-10-09T12:00:00Z');
const location = { id: 'owned', county_name: 'Timiș', locality_name: 'Giroc', locality_siruta_code: '1234' };
const services = [{ service_key: 'eyeglasses', is_active: true, matching_allowed: true }];
const make = (session, date = '2026-10-08T12:00:00Z', fields = {}) => ({ id: session + date, created_date: date, session_hash: 'session-00000000-' + session,
 analytics_version: LOCAL_INTEREST_VERSION, analytics_eligible: true, county_key: 'timis', locality_siruta_code: '1234', service_key: 'eyeglasses', ...fields });
const recent = Array.from({ length: 6 }, (_, i) => make(String(i)));
const weekly = Array.from({ length: 6 }, (_, i) => make('weekly-' + i, '2026-09-30T12:00:00Z'));
const summary = extra => buildLocalInterest({ events: recent, location, services, now, ...extra });
assert.equal(summary().metrics[0].total, 6);
assert.equal(summary({ events: [...recent, ...recent, make('0', '2026-10-08T18:00:00Z')] }).metrics[0].total, 6);
assert.equal(summary({ events: recent.slice(0, 4) }).metrics[0].total, null);
assert.equal(summary({ events: Array.from({ length: 12 }, (_, i) => make('same', new Date(now - (i + 1) * DAY).toISOString())) }).metrics[0].total, null, 'Many searches from one session do not satisfy the threshold');
for (const fields of [{ analytics_version: '' }, { analytics_eligible: false }, { county_key: 'brasov' }, { service_key: 'unknown' }, { created_date: new Date(now + DAY).toISOString() }]) {
 assert.equal(summary({ events: recent.map(row => ({ ...row, ...fields })) }).metrics[0].total, null);
}
assert.equal(summary({ complete: false }).status, 'incomplete');
assert.equal(summary({ complete: false }).metrics[0].total, null);
assert.equal(summary({ services: [{ ...services[0], matching_allowed: false }] }).status, 'missing_services');
const county = summary({ events: recent.map(row => ({ ...row, locality_siruta_code: '9999' })) });
assert.equal(county.area_scope, 'county'); assert.equal(county.metrics[0].total, 6);
const free = summary({ events: [...recent, ...weekly] });
assert.deepEqual(free.metrics.map(m => m.days), [7]); assert.deepEqual(free.breakdown, []); assert.equal(free.comparison, null);
assert.doesNotMatch(JSON.stringify(free), /session-000|eyeglasses|1234/);
const pro = summary({ events: [...recent, ...weekly], planCode: 'pro' });
assert.deepEqual(pro.metrics.map(m => m.days), [7, 30, 90]); assert.equal(pro.breakdown[0].total, 12);
const repair = make('repair', undefined, { service_key: 'eyeglasses_repair' });
const repairService = { ...services[0], service_key: 'eyeglasses_repair' };
assert.deepEqual(summary({ events: [...recent, repair], services: [...services, repairService], planCode: 'pro' }).breakdown, [], 'A small complementary category suppresses the entire breakdown');
assert.equal(free.weekly.total, 6);
assert.equal(await readFile(path.join(root, 'shared/providerLocalInterestPolicy.js'), 'utf8'), await readFile(path.join(root, 'base44/shared/providerLocalInterestPolicy.js'), 'utf8'));
console.log('PASS deduplication, thresholds, county fallback, eligibility, complete windows, Free/Pro privacy and complementary suppression');

const tables = { ProviderLocation: [location], LocationService: services.map(row => ({ ...row, location_id: location.id })),
 PatientSearchEvent: [...recent, ...weekly], ProviderActivityPreference: [], InAppNotification: [], ProviderSubscription: [],
 ProviderMembership: [{ user_id: 'member', location_id: 'owned', status: 'active', role: 'location_staff' }],
 GeographicLocality: [{ siruta_code: '1234', name: 'Giroc', county_name: 'Timiș', is_active: true }] };
const calls = []; let id = 0;
const match = (row, query) => Object.entries(query).every(([key, value]) => typeof value === 'object' && value !== null
 ? Object.entries(value).every(([operator, expected]) => operator === '$gte' ? row[key] >= expected : operator === '$lt' ? row[key] < expected : false)
 : row[key] === value);
const svc = { entities: new Proxy({}, { get: (_, name) => ({
 get: async key => (tables[name] || []).find(row => row.id === key) || null,
 filter: async (query, _sort, limit = 500, skip = 0) => { calls.push({ name, query, limit, skip }); return (tables[name] || []).filter(row => match(row, query)).slice(skip, skip + limit); },
 count: async query => (tables[name] || []).filter(row => match(row, query)).length,
 create: async data => { const row = { id: name + '-' + (++id), created_date: new Date(now).toISOString(), ...data }; (tables[name] ||= []).push(row); return row; },
 update: async (key, data) => { const row = (tables[name] || []).find(row => row.id === key); Object.assign(row, data); return row; },
 }) }) };
const user = { id: 'member', role: 'user' };
await Promise.all([ensureLocalInterestDigest({ svc, user, location, entitlement: { plan_code: 'free' }, now }), ensureLocalInterestDigest({ svc, user, location, entitlement: { plan_code: 'free' }, now })]);
await ensureLocalInterestDigest({ svc, user, location, entitlement: { plan_code: 'free' }, now });
const deduped = deduplicateActivityNotifications(tables.InAppNotification);
assert.equal(deduped.length, 1, 'Concurrent projections have a single visible digest');
assert.match(deduped[0].body, /6 căutări/);
assert.doesNotMatch(deduped[0].body, /persoane au|clienți au/);
tables.InAppNotification[0].status = 'read';
assert.equal(deduplicateActivityNotifications(tables.InAppNotification)[0].status, 'read');
await saveActivityPreference(svc, user.id, location.id, false);
assert.equal(await ensureLocalInterestDigest({ svc, user, location, entitlement: { plan_code: 'free' }, now }), null);
console.log('PASS one visible completed-week digest, concurrent duplicate suppression, read preservation and personal opt-out');

await mkdir(path.join(root, 'node_modules/.cache'), { recursive: true });
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/local-interest-'));
const oldDeno = globalThis.Deno, oldWindow = globalThis.window, oldNow = Date.now;
try {
 Date.now = () => now;
 globalThis.__interestClient = { auth: { me: async () => user }, asServiceRole: svc };
 let handler;
 globalThis.Deno = { serve: fn => { handler = fn; }, env: { get: () => undefined } };
 const sdk = { name: 'synthetic-sdk', setup(builder) {
  builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const createClientFromRequest = () => globalThis.__interestClient;', loader: 'js' }));
 } };
 const inboxFile = path.join(scratch, 'inbox.mjs');
 await build({ entryPoints: [path.join(root, 'base44/functions/providerLeadInboxOps/entry.ts')], bundle: true, platform: 'node', format: 'esm', outfile: inboxFile, plugins: [sdk] });
 await import(pathToFileURL(inboxFile));
 const invoke = body => handler(new Request('https://synthetic.test/inbox', { method: 'POST', body: JSON.stringify(body) }));
 let result = await invoke({ action: 'local_interest', location_id: 'owned', plan_code: 'pro', user_id: 'someone' });
 assert.equal(result.status, 200); assert.equal((await result.json()).plan_code, 'free', 'Client cannot upgrade analytics');
 result = await invoke({ action: 'local_interest', location_id: 'foreign' }); assert.equal(result.status, 404);
 tables.ProviderLocation.push({ ...location, id: 'foreign' });
 const before = calls.filter(call => call.name === 'PatientSearchEvent').length;
 result = await invoke({ action: 'local_interest', location_id: 'foreign' }); assert.equal(result.status, 403);
 assert.equal(calls.filter(call => call.name === 'PatientSearchEvent').length, before, 'Foreign location is denied before raw-event queries');
 result = await invoke({ action: 'local_interest_preference', location_id: 'foreign', weekly_enabled: true }); assert.equal(result.status, 403);
 tables.ProviderSubscription.push({ id: 'plan', location_id: 'owned', plan_code: 'pro', status: 'active' });
 result = await invoke({ action: 'local_interest', location_id: 'owned' }); assert.equal((await result.json()).metrics.length, 3);
 globalThis.__interestClient.auth.me = async () => null;
 result = await invoke({ action: 'local_interest', location_id: 'owned' }); assert.equal(result.status, 401);
 globalThis.__interestClient.auth.me = async () => user;

 const ingestionFile = path.join(scratch, 'ingest.mjs');
 await build({ entryPoints: [path.join(root, 'base44/functions/recordSearchEvent/entry.ts')], bundle: true, platform: 'node', format: 'esm', outfile: ingestionFile, plugins: [sdk] });
 const ingestion = (await import(pathToFileURL(ingestionFile))).default;
 const body = { session_hash: 'production-session-12345', service_key: 'eyeglasses', locality_siruta_code: '1234', county_name: 'PRIVATE', need_category: 'PRIVATE', analytics_eligible: true };
 const record = (origin, payload = body) => ingestion(new Request('https://synthetic.test/ingest', { method: 'POST', headers: { origin }, body: JSON.stringify(payload) }));
 let count = tables.PatientSearchEvent.length;
 await record('http://localhost:4173'); assert.equal(tables.PatientSearchEvent.length, count);
 await record('https://preview-sandbox.base44.app'); assert.equal(tables.PatientSearchEvent.length, count);
 await record('https://viasee.ro', { ...body, locality_siruta_code: '9999' }); assert.equal(tables.PatientSearchEvent.length, count);
 await record('https://viasee.ro'); assert.equal(tables.PatientSearchEvent.length, count + 1);
 assert.equal(tables.PatientSearchEvent.at(-1).county_name, 'Timiș'); assert.equal(tables.PatientSearchEvent.at(-1).analytics_version, LOCAL_INTEREST_VERSION);
 assert.doesNotMatch(JSON.stringify(tables.PatientSearchEvent.at(-1)), /PRIVATE/);
 globalThis.__interestClient.auth.me = async () => ({ id: 'admin', role: 'admin' });
 await record('https://viasee.ro'); assert.equal(tables.PatientSearchEvent.length, count + 1);
 console.log('PASS actual authenticated HTTP access, server plan enforcement, owned preferences, canonical SIRUTA and exclusion of preview/admin traffic');

 const uiFile = path.join(scratch, 'ui.mjs');
 await build({ stdin: { contents: 'export { default as Panel } from "./src/components/notifications/ProviderLocalActivityPanel.jsx"; export { default as Center } from "./src/components/notifications/NotificationCenter.jsx";', resolveDir: root, loader: 'jsx' },
 outfile: uiFile, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@': path.join(root, 'src') },
 plugins: [{ name: 'synthetic-ui', setup(builder) { builder.onResolve({ filter: /api\/base44Client$/ }, () => ({ path: 'client', namespace: 'mock' })); builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const base44 = { functions: { invoke: (...args) => globalThis.__interestInvoke(...args) } };', loader: 'js' })); } }] });
 const { Panel, Center } = await import(pathToFileURL(uiFile));
 globalThis.__interestInvoke = async () => ({ data: { ...free, weekly_enabled: true } });
 globalThis.window = { setInterval: () => 1, clearInterval() {} };
 let renderer;
 await act(async () => { renderer = TestRenderer.create(React.createElement(Panel, { locationId: 'owned', onClose() {} })); });
 const text = JSON.stringify(renderer.toJSON());
 assert.match(text, /Date insuficiente|6 căutări/); assert.match(text, /Anonimatul se păstrează/); assert.doesNotMatch(text, /session-000/);
 await act(async () => renderer.unmount());
 await act(async () => { renderer = TestRenderer.create(React.createElement(Center, { showActivityFilters: true, refreshIntervalMs: 0,
 loadNotifications: async () => ({ notifications: [{ id: 'digest', title: 'Digest', action_kind: 'activity', status: 'unread' }, { id: 'request', title: 'Cerere', action_kind: 'lead', status: 'read' }], counters: { total: 2, unread: 1 } }), markNotificationRead: async () => {}, markAllNotificationsRead: async () => {} })); });
 const buttons = () => renderer.root.findAllByType('button');
 await act(async () => buttons()[0].props.onClick());
 const activity = buttons().find(button => button.props.children === 'Activitate în zonă');
 await act(async () => activity.props.onClick());
 assert.match(JSON.stringify(renderer.toJSON()), /Digest/); assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /"Cerere"/);
 await act(async () => renderer.unmount());
 console.log('PASS actual Free panel, privacy copy, and activity-only notification filter');
} finally {
 globalThis.Deno = oldDeno; globalThis.window = oldWindow; Date.now = oldNow; delete globalThis.__interestClient; delete globalThis.__interestInvoke;
 const absolute = await realpath(scratch), allowed = await realpath(path.join(root, 'node_modules/.cache'));
 assert.ok(absolute.startsWith(allowed + path.sep));
 await rm(absolute, { recursive: true, force: true });
}
