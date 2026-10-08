import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { sanitizeProviderLeadForFreeInbox } from '../base44/shared/providerLeadInboxPolicy.js';
import { sanitizeProviderLeadFullDetailsStatus } from '../base44/shared/providerLeadFullDetailsPolicy.js';
import { sanitizeProviderInAppNotification } from '../base44/shared/inAppNotificationPolicy.js';
import { providerLeadAccessPresentation, providerRequestLocationBlocker } from '../src/lib/providerLeadAccessPresentation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = { id: 'synthetic', location_id: 'location', intent: 'control_copil', intent_label: 'Sensitive label', preview_summary: 'PRIVATE symptoms and contact', for_whom: 'copil', age_group: 'child', service_keys: ['PRIVATE clinical service'], matched_service_keys: ['PRIVATE clinical service'], city: 'Brașov', delivery_state: 'available', status: 'new' };
const safe = sanitizeProviderLeadForFreeInbox(raw);
assert.equal(safe.intent_label, 'Control de vedere');
assert.equal(safe.preview_summary, 'Control de vedere · Brașov');
assert.equal(safe.for_whom, undefined); assert.equal(safe.age_group, undefined);
assert.deepEqual(safe.service_keys, []); assert.deepEqual(safe.matched_service_keys, []);
assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|Sensitive|child/);
assert.equal(sanitizeProviderLeadForFreeInbox({ ...raw, intent: 'unknown-clinical-label' }).intent_label, 'Servicii pentru vedere');
const notification = sanitizeProviderInAppNotification({ event_key: 'provider_lead_available', title: 'PRIVATE recipient', body: 'PRIVATE clinical category', action_target_id: 'synthetic' }, { id: 'location', name: 'Demo' });
assert.doesNotMatch(JSON.stringify(notification), /PRIVATE/);
assert.equal(notification.action_target_id, 'synthetic');
const free = { plan_code: 'free', feature_keys: [] }, pro = { plan_code: 'pro', feature_keys: ['provider_leads.respond'] };
const status = reasons => sanitizeProviderLeadFullDetailsStatus({ eligible: false, reasons });
const eligibleUpgrade = { ...safe, full_details_status: status(['pro_full_details_required']) };
assert.equal(providerLeadAccessPresentation(eligibleUpgrade, free).upgrade, true);
assert.equal(providerLeadAccessPresentation(eligibleUpgrade, pro).upgrade, false);
assert.equal(providerLeadAccessPresentation({ ...eligibleUpgrade, is_historical: true }, free).upgrade, false);
for (const reason of ['lead_not_top3', 'contact_not_active', 'distribution_consent_missing', 'distribution_consent_version_not_supported', 'lead_not_available', 'lead_status_not_eligible', 'detailed_message_missing']) {
 const denied = { ...safe, full_details_status: status(['pro_full_details_required', reason]) };
 assert.equal(denied.full_details_status.reason, reason);
 assert.equal(denied.full_details_status.upgrade_available, false);
 assert.equal(providerLeadAccessPresentation(denied, free).upgrade, false);
}
assert.equal(sanitizeProviderLeadFullDetailsStatus({ eligible: true, reasons: [] }).upgrade_available, false);
assert.match(providerRequestLocationBlocker({ status: 'draft' }), /nu este publicat/);
assert.match(providerRequestLocationBlocker({ status: 'publicata', is_active: false }), /inactivă/);
assert.equal(providerRequestLocationBlocker({ status: 'publicata', is_active: true, profile_control_status: 'verified', request_intake_status: 'active', accepts_patients_directly: true }), '');
assert.equal(providerRequestLocationBlocker({}), '', 'Missing metadata is not a known blocker');
assert.equal(await readFile(path.join(root, 'shared/providerLeadInboxPolicy.js'), 'utf8'), await readFile(path.join(root, 'base44/shared/providerLeadInboxPolicy.js'), 'utf8'));
assert.equal(await readFile(path.join(root, 'shared/providerLeadFullDetailsPolicy.js'), 'utf8'), await readFile(path.join(root, 'base44/shared/providerLeadFullDetailsPolicy.js'), 'utf8'));

const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/free-pro-'));
const oldWindow = globalThis.window;
try {
 const output = path.join(scratch, 'ui.mjs');
 await build({ stdin: { contents: 'export { default as Panel } from "./src/components/workspace/provider/leads/LeadConversationPanel.jsx"; export { default as Empty } from "./src/components/workspace/provider/leads/InboxEmptyState.jsx"; export { default as Notifications } from "./src/components/notifications/ProviderNotificationCenter.jsx";', resolveDir: root, loader: 'jsx' }, outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { '@': path.join(root, 'src') }, plugins: [{ name: 'synthetic-client', setup(builder) {
  builder.onResolve({ filter: /api\/base44Client$/ }, () => ({ path: 'client', namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const base44 = { functions: { invoke: (...args) => globalThis.__freeProInvoke(...args) } };', loader: 'js' }));
 } }] });
 const { Panel, Empty, Notifications } = await import(pathToFileURL(output));
 const calls = [];
 globalThis.__freeProInvoke = async (name, body) => { calls.push({ name, ...body }); return { data: { notifications: [], counters: { total: 0, unread: 0 } } }; };
 globalThis.window = { setInterval, clearInterval };
 let clicks = 0, renderer;
 const render = async element => { await act(async () => { renderer = TestRenderer.create(element); }); };
 const unmount = async () => { await act(async () => renderer.unmount()); };
 await render(React.createElement(Panel, { lead: eligibleUpgrade, entitlement: free, onOpenRequestSettings: () => clicks++ }));
 assert.equal(renderer.root.findAllByProps({ className: 'inbox-upgrade-button' }).length, 1);
 assert.equal(renderer.root.findAllByProps({ role: 'log' }).length, 0, 'Free never mounts a private chat');
 await act(async () => renderer.root.findByProps({ className: 'inbox-upgrade-button' }).props.onClick());
 assert.equal(clicks, 1); assert.equal(calls.length, 0, 'Upgrade preview makes no chat request');
 await unmount();
 for (const [lead, entitlement] of [[{ ...safe, full_details_status: status(['lead_not_top3']) }, free], [eligibleUpgrade, pro], [{ ...eligibleUpgrade, is_historical: true }, free]]) {
  await render(React.createElement(Panel, { lead, entitlement, onOpenRequestSettings: () => clicks++ }));
  assert.equal(renderer.root.findAllByProps({ className: 'inbox-upgrade-button' }).length, 0);
  await unmount();
 }
 await render(React.createElement(Empty, { filter: 'active', location: { status: 'draft' }, entitlement: pro, onOpenLocation: () => clicks++ }));
 assert.equal(renderer.root.findAllByType('button').length, 1);
 await act(async () => renderer.root.findByType('button').props.onClick());
 assert.equal(clicks, 2); await unmount();
 await render(React.createElement(Notifications, { locationId: 'location' }));
 assert.ok(calls.some(call => call.action === 'notifications_list' && call.location_id === 'location'), 'Single-location notifications really load that location');
 await unmount();
} finally {
 globalThis.window = oldWindow; delete globalThis.__freeProInvoke;
 const absolute = path.resolve(scratch);
 assert.ok(absolute.startsWith(path.join(root, 'node_modules/.cache') + path.sep));
 await rm(absolute, { recursive: true, force: true });
}
console.log('PASS minimal anonymous payloads, truthful upgrade eligibility, restricted previews, Pro/closed states, location setup CTA and single-location notifications');
