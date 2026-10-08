import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { providerInboxRow, buildProviderInboxPage } from '../base44/shared/providerInboxConversationPolicy.js';
import { readAllInboxRows, projectProviderInboxRows, addInboxMessagePreviews } from '../base44/shared/providerInboxConversations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lead = { id: 'lead', request_id: 'request', location_id: 'location', intent_label: 'Consultație vedere', preview_summary: 'Vedere la distanță', created_date: '2026-09-26T09:00:00Z', expires_at: '2099-01-01T00:00:00Z', status: 'viewed', delivery_state: 'available', access_tier: 'pro_full', result_bucket_snapshot: 'top3' };
const request = { id: 'request', lifecycle_state: 'active', expires_at: lead.expires_at, persistence_state: 'complete', detailed_message: 'Mesaj sintetic' };
const contact = { id: 'contact', request_id: 'request', status: 'active', provider_request_distribution_consent: true, provider_request_distribution_consent_version: 'patient-request-distribution-top3-pro-v3', contact_name: 'Client sintetic', contact_email: 'synthetic@example.invalid', contact_phone: 'private' };
const response = { id: 'response', lead_id: 'lead', location_id: 'location', request_id: 'request', status: 'active', response_type: 'can_help' };
const entitlement = { plan_code: 'pro', feature_keys: ['provider_chat.access', 'provider_leads.respond', 'provider_leads.full_details', 'provider_contact.access_after_consent'] };
const conversation = { id: 'chat', lead_id: 'lead', request_id: 'request', location_id: 'location', status: 'open', last_message_at: '2026-09-26T11:00:00Z', provider_unread_count: 3 };
const row = providerInboxRow({ lead, request, contact, response, entitlement, conversation });
assert.equal(row.chat_summary.unread_count, 3);
assert.equal(row.access_tier, 'pro_full');
assert.equal(row.provider_response.response_type, 'can_help');
for (const key of ['request_id', 'contact_name', 'contact_email', 'contact_phone', 'full_details']) assert.equal(row[key], undefined);
for (const patch of [
  { entitlement: { plan_code: 'free' } }, { contact: { ...contact, provider_request_distribution_consent: false } },
  { lead: { ...lead, result_bucket_snapshot: 'extended_confirmed' } },
  { response: { ...response, response_type: 'cannot_help' } },
  { response: { ...response, location_id: 'foreign' } }, { response: { ...response, request_id: 'foreign' } },
  { conversation: { ...conversation, location_id: 'foreign' } }, { contact: { ...contact, request_id: 'foreign' } },
]) assert.equal(providerInboxRow({ lead, request, contact, response, entitlement, conversation, ...patch }).chat_summary, null);
const historical = providerInboxRow({ lead: { ...lead, status: 'closed', delivery_state: 'withdrawn' }, request: { ...request, lifecycle_state: 'closed' }, contact, response: { ...response, status: 'withdrawn' }, entitlement, conversation: { ...conversation, status: 'closed' } });
assert.equal(historical.chat_summary.unread_count, 0);
assert.equal(historical.provider_response.response_type, 'can_help');
const newRow = { ...row, id: 'new', status: 'new', chat_summary: null };
const rows = Array.from({ length: 651 }, (_, i) => ({ ...row, id: String(i).padStart(4, '0') }));
let page = buildProviderInboxPage(rows, { offset: 600 });
assert.equal(page.pagination.total, 651); assert.equal(page.leads.length, 50); assert.equal(page.pagination.has_more, true);
assert.equal(buildProviderInboxPage(rows, { offset: 650 }).leads.length, 1);
assert.equal(buildProviderInboxPage(rows, { offset: 9999 }).pagination.offset, 650);
assert.equal(buildProviderInboxPage([newRow, row], { unread_only: true }).leads[0].id, 'lead');
assert.equal(buildProviderInboxPage([newRow], { unread_only: true }).leads.length, 0, 'New lead does not mean unread chat');
assert.equal(buildProviderInboxPage([row], { search: 'consultatie' }).leads.length, 1);
assert.equal(buildProviderInboxPage([historical]).leads.length, 0);
assert.equal(buildProviderInboxPage([historical], { scope: 'history' }).leads.length, 1);
console.log('PASS summary privacy, location bindings, Pro/Top3/consent, history, unread semantics and 651-row pagination');

const calls = [];
let records = { ProviderMembership: [{ id: 'member', user_id: 'admin', location_id: 'location', role: 'location_staff', status: 'active' }], ProviderLead: [lead], PatientRequest: [request], PatientRequestContact: [contact], ProviderLeadResponse: [response], PatientRequestConversation: [conversation], PatientRequestMessage: [
  { id: 'message', conversation_id: 'chat', lead_id: 'lead', location_id: 'location', status: 'active', sender_type: 'patient', body: 'Mesaj sintetic', sent_at: '2026-09-26T11:00:00Z', created_date: '2026-09-26T11:00:00Z' },
], ProviderLocation: [{ id: 'location', name: 'Locație sintetică', organization_id: 'org' }], ProviderSubscription: [{ id: 'pro', location_id: 'location', plan_code: 'pro', status: 'active' }] };
function matches(record, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(next => matches(record, next));
    if (value && typeof value === 'object') return Object.entries(value).every(([op, bound]) => {
      if (op === '$in') return bound.includes(record[key]);
      if (op === '$lt') return record[key] < bound;
      if (op === '$exists') return (record[key] !== undefined) === bound;
      return false;
    });
    return record[key] === value;
  });
}
const svc = { entities: new Proxy({}, { get: (_target, entity) => ({
  filter: async (query = {}, sort = '-created_date', limit = 500, skip = 0) => {
    calls.push({ entity, query, skip });
    const key = sort.replace(/^-/, '');
    return (records[entity] || []).filter(record => matches(record, query)).sort((a,b) => String(b[key] || '').localeCompare(String(a[key] || '')) || String(b.id).localeCompare(String(a.id))).slice(skip, skip + limit);
  },
  get: async id => (records[entity] || []).find(record => record.id === id) || null,
  create: async values => { calls.push({ entity, create: true }); return values; },
  update: async (id, values) => { const record = (records[entity] || []).find(record => record.id === id); Object.assign(record, values); return { ...record }; },
  updateMany: async (query, values) => { const record = (records[entity] || []).find(record => matches(record, query)); if (!record) return { updated: 0 }; Object.assign(record, values.$set); for (const key of Object.keys(values.$unset || {})) delete record[key]; return { updated: 1 }; },
}) }) };
const projected = await projectProviderInboxRows(svc, [lead], { location: entitlement });
assert.equal(projected[0].chat_summary.unread_count, 3);
const previews = await addInboxMessagePreviews(svc, projected);
assert.equal(previews[0].chat_summary.last_message_preview, 'Mesaj sintetic');
assert.equal(previews[0].chat_summary.last_message_sender_type, 'patient');
assert.equal(calls.some(call => call.create), false, 'Summary does not trigger private detail audits');
calls.length = 0;
await addInboxMessagePreviews(svc, await projectProviderInboxRows(svc, [lead], { location: { plan_code: 'free' } }));
assert.equal(calls.length, 0, 'Free rows do not read private requests, contacts, conversations or messages');
records.ProviderLead = Array.from({ length: 651 }, (_, i) => ({ ...lead, id: 'lead-' + i }));
assert.equal((await readAllInboxRows(svc.entities.ProviderLead, { location_id: 'location' })).length, 651);
assert.ok(calls.some(call => call.entity === 'ProviderLead' && call.skip === 500));
records.ProviderLead = [lead];
console.log('PASS bulk projection and message preview queries remain scoped; Free never reads private entities; SDK pagination passes 500');

await mkdir(path.join(root, 'node_modules/.cache'), { recursive: true });
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/inbox-conversations-'));
const previousDeno = globalThis.Deno;
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousObserver = globalThis.IntersectionObserver;
try {
  globalThis.__inboxTestClient = { auth: { me: async () => ({ id: 'admin', role: 'admin' }) }, asServiceRole: svc };
  let handler;
  globalThis.Deno = { serve: callback => { handler = callback; }, env: { get: () => undefined } };
  const serverPlugin = { name: 'synthetic-sdk', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClientFromRequest = () => globalThis.__inboxTestClient;', loader: 'js' }));
  } };
  for (const [name, entry] of [['inbox', 'base44/functions/providerLeadInboxOps/entry.ts'], ['chat', 'base44/functions/controlledChatOps/entry.ts']]) {
    const output = path.join(scratch, name + '.mjs');
    await build({ entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'esm', outfile: output, plugins: [serverPlugin] });
    await import(pathToFileURL(output));
    const invoke = async body => {
      const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ location_id: 'location', ...body }) }));
      return { status: response.status, data: await response.json() };
    };
    if (name === 'inbox') {
      calls.length = 0;
      const listed = await invoke({ action: 'list', inbox_mode: true });
      assert.equal(listed.status, 200); assert.equal(listed.data.leads[0].chat_summary.last_message_preview, 'Mesaj sintetic');
      assert.equal(listed.data.leads[0].full_details, undefined);
      assert.equal(calls.some(call => call.create), false);
      calls.length = 0;
      assert.equal((await invoke({ action: 'summary' })).status, 200);
      assert.equal(calls.some(call => call.entity === 'PatientRequestContact' || call.entity === 'PatientRequestMessage'), false);
      records.ProviderLead.push({ ...lead, id: 'foreign', location_id: 'other' });
      assert.equal((await invoke({ action: 'detail', lead_id: 'foreign' })).status, 404);
      records.ProviderLead.pop();
      const details = await invoke({ action: 'detail', lead_id: 'lead' });
      assert.equal(details.status, 200); assert.equal(details.data.lead.full_details.client_name, 'Client sintetic');
      assert.ok(calls.some(call => call.entity === 'ProviderLeadContactAccessAudit' && call.create));
    } else {
      records.PatientRequestMessage.push({ ...records.PatientRequestMessage[0], id: 'newer', sent_at: '2026-09-26T11:01:00Z', created_date: '2026-09-26T11:01:00Z' });
      conversation.provider_unread_count = 2;
      const stale = await invoke({ actor: 'provider', action: 'mark_read', lead_id: 'lead', read_through_message_id: 'message' });
      assert.equal(stale.status, 200); assert.equal(conversation.provider_unread_count, 2, 'Arrival after render remains unread');
      assert.equal((await invoke({ actor: 'provider', action: 'mark_read', lead_id: 'lead', read_through_message_id: 'newer' })).status, 200);
      assert.equal(conversation.provider_unread_count, 0);
      assert.equal(conversation.message_lock_token, undefined, 'Read lock released');
    }
  }
  console.log('PASS actual HTTP list/detail/summary: private data only on selected audited detail; foreign detail denied; read cursor preserves unseen arrivals');

  const entry = path.join(scratch, 'ui.jsx');
  await writeFile(entry, `export { default as Inbox } from ${JSON.stringify(path.join(root, 'src/components/workspace/provider/ProviderLeadInboxLegacy.jsx'))};\nexport { default as Thread } from ${JSON.stringify(path.join(root, 'src/components/chat/ChatThread.jsx'))};`);
  const uiFile = path.join(scratch, 'ui.mjs');
  await build({ entryPoints: [entry], outfile: uiFile, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@': path.join(root, 'src') }, plugins: [{ name: 'synthetic-client', setup(builder) {
    builder.onResolve({ filter: /api\/base44Client$/ }, () => ({ path: 'client', namespace: 'mock' }));
    builder.onResolve({ filter: /notifications\/ProviderNotificationCenter$/ }, () => ({ path: 'notifications', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'client' ? 'export const base44 = { functions: { invoke: (...args) => globalThis.__inboxUIInvoke(...args) } };' : 'export default function Notifications() { return null; }', loader: 'js' }));
  } }], loader: { '.css': 'empty' } });
  const { Inbox, Thread } = await import(pathToFileURL(uiFile));
  let wide = true;
  globalThis.window = { matchMedia: query => ({ matches: query.includes('1024') && wide, addEventListener() {}, removeEventListener() {} }), setInterval, clearInterval };
  const uiCalls = [];
  globalThis.__inboxUIInvoke = async (name, body) => {
    uiCalls.push({ name, ...body });
    if (name === 'controlledChatOps') return { data: { chat: { id: 'chat', status: 'open', unread_count: 1, can_send: true }, messages: [{ id: 'm', sender_type: 'patient', sent_at: '2026-09-26T11:00:00Z', body: 'Mesaj sintetic' }] } };
    if (body.action === 'detail') return { data: { lead: { ...row, full_details_status: { available: false } } } };
    return { data: { entitlement, leads: [row], counters: { active: 1 }, pagination: { offset: 0, limit: 50, total: 1, has_more: false }, target_lead: body.lead_id ? row : null } };
  };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Inbox, { locationId: 'location', location: { name: 'Sintetic' } })); });
  assert.equal(renderer.root.findAllByProps({ role: 'log' }).length, 1, 'Exactly one mounted chat on desktop');
  assert.equal(uiCalls.filter(call => call.name === 'controlledChatOps' && call.action === 'status').length, 1);
  assert.equal(uiCalls.filter(call => call.action === 'mark_read').length, 0, 'Fetching chat is not reading it');
  await act(async () => renderer.unmount());
  wide = false; uiCalls.length = 0;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Inbox, { locationId: 'location', targetLeadId: 'lead' })); });
  assert.equal(renderer.root.findAllByProps({ role: 'log' }).length, 1);
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Înapoi la cereri' }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: 'log' }).length, 0, 'Back unmounts conversation');
  assert.equal(renderer.root.findByProps({ className: 'provider-inbox' }).props['data-selected'], false, 'Deep-link target does not reopen after Back');
  await act(async () => renderer.unmount());
  console.log('PASS real inbox desktop single chat; mobile deep-link Back remains on list; fetch never auto-marks read');
  let releaseActive;
  globalThis.__inboxUIInvoke = async (_name, body) => body.scope === 'active'
    ? new Promise(resolve => { releaseActive = resolve; })
    : { data: { entitlement, leads: [{ ...row, id: 'history', intent_label: 'Istoric sintetic', is_historical: true }], pagination: { total: 1, offset: 0, limit: 50 }, counters: {} } };
  await act(async () => { renderer = TestRenderer.create(React.createElement(Inbox, { locationId: 'location' })); });
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.children === 'Încheiate').props.onClick());
  await act(async () => releaseActive({ data: { entitlement, leads: [row] } }));
  const historyRows = renderer.root.findAllByProps({ className: 'inbox-row' });
  assert.equal(historyRows.length, 1);
  assert.equal(historyRows[0].findByProps({ className: 'inbox-row-title' }).props.children, 'Istoric sintetic');
  await act(async () => renderer.unmount());
  console.log('PASS late active-filter response cannot replace the current history filter');
  let intersect;
  let visibility;
  let readIds = [];
  globalThis.document = { visibilityState: 'hidden', addEventListener: (_event, callback) => { visibility = callback; }, removeEventListener() {} };
  globalThis.IntersectionObserver = class { constructor(callback) { intersect = callback; } observe() {} disconnect() {} };
  await act(async () => { renderer = TestRenderer.create(React.createElement(Thread, {
    title: 'Synthetic chat', messages: [{ id: 'visible-latest', body: 'Synthetic', sender_type: 'patient' }],
    unreadCount: 1, onMessagesViewed: async id => { readIds.push(id); return true; },
  }), { createNodeMock: () => ({ scrollHeight: 400, scrollTop: 0, clientHeight: 400 }) }); });
  await act(async () => intersect([{ isIntersecting: true }]));
  assert.equal(readIds.length, 0, 'Hidden tab does not mark read');
  globalThis.document.visibilityState = 'visible';
  await act(async () => intersect([{ isIntersecting: false }]));
  await act(async () => visibility());
  assert.equal(readIds.length, 0, 'Latest message outside viewport does not mark read');
  await act(async () => intersect([{ isIntersecting: true }]));
  assert.deepEqual(readIds, ['visible-latest']);
  await act(async () => renderer.unmount());
  console.log('PASS read receipt waits for latest message visibility and visible tab');
} finally {
  globalThis.Deno = previousDeno; globalThis.window = previousWindow;
  globalThis.document = previousDocument; globalThis.IntersectionObserver = previousObserver;
  delete globalThis.__inboxUIInvoke; delete globalThis.__inboxTestClient;
  await rm(scratch, { recursive: true, force: true });
}
