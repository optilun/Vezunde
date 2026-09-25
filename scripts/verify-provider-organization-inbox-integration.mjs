import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { expandOwnerWorkspaceScope } from '../base44/shared/providerOwnerWorkspaceScope.js';
import { findProviderLeadLocationMembership } from '../base44/shared/providerLeadLocationAccess.js';
import { projectOrganizationLeadExpirations } from '../base44/shared/providerOrganizationLeadLifecycle.js';
import { buildOrganizationLeadInboxPage } from '../base44/shared/providerOrganizationLeadInboxPolicy.js';

const user = { id: 'owner', role: 'user' };
const locations = [
  { id: 'a', organization_id: 'org', name: 'A' },
  { id: 'b', organization_id: 'org', name: 'B' },
  { id: 'foreign', organization_id: 'elsewhere', name: 'Foreign' },
];
const owner = { id: 'membership', user_id: user.id, location_id: 'a', organization_id: 'org',
  role: 'organization_owner', status: 'active', organization_wide_access: true };
let rows = {};
const calls = [];
const svc = { entities: new Proxy({}, { get: (_target, entity) => ({
  filter: async (query = {}, sort = '', limit = 500, skip = 0) => {
    calls.push({ entity, query, skip, limit });
    return (rows[entity] || []).filter((row) => Object.entries(query).every(([key, value]) =>
      value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value))
      .slice(skip, skip + limit);
  },
  get: async (id) => (rows[entity] || []).find((row) => row.id === id) || null,
}) }) };
function reset(membership = owner) {
  rows = { ProviderLocation: locations, ProviderMembership: [membership], ProviderClaimScopeSelection: [],
    ProviderSubscription: [], ProviderLead: [], PatientRequest: [] };
  calls.length = 0;
}
reset();
const expanded = await expandOwnerWorkspaceScope(svc, user, [owner], [locations[0]]);
assert.deepEqual(expanded.locations.map((row) => row.id).sort(), ['a', 'b']);
assert.equal(expanded.memberships.find((row) => row.location_id === 'b').virtual_owner_access, true);
assert.ok(await findProviderLeadLocationMembership(svc, user, locations[1]));
assert.equal(await findProviderLeadLocationMembership(svc, user, locations[2]), null);
for (const patch of [
  { organization_wide_access: false },
  { organization_wide_access: undefined, claim_scope: 'selected_locations' },
  { role: 'location_manager' }, { role: 'location_staff' },
  { organization_role: 'organization_admin' }, { status: 'inactive' },
  { organization_id: 'elsewhere' },
]) {
  reset({ ...owner, ...patch });
  const result = await expandOwnerWorkspaceScope(svc, user, rows.ProviderMembership, [locations[0]]);
  assert.deepEqual(result.locations.map((row) => row.id), ['a'], JSON.stringify(patch));
  assert.equal(await findProviderLeadLocationMembership(svc, user, locations[1]), null, JSON.stringify(patch));
}
reset({ ...owner, role: 'location_staff', organization_wide_access: false });
assert.ok(await findProviderLeadLocationMembership(svc, user, locations[0]), 'Direct staff access remains valid');
reset();
rows.ProviderLocation = Array.from({ length: 601 }, (_, i) => ({ id: i === 0 ? 'a' : 'loc-' + i, organization_id: 'org', name: 'Locatie ' + i }));
assert.equal((await expandOwnerWorkspaceScope(svc, user, [owner], [rows.ProviderLocation[0]])).locations.length, 601);
assert.ok(calls.some((call) => call.entity === 'ProviderLocation' && call.skip === 500));

reset();
const now = new Date('2026-09-26T10:00:00Z');
const expiredLead = { id: 'expired', location_id: 'a', request_id: 'req-expired', status: 'new',
  delivery_state: 'available', expires_at: '2026-09-25T10:00:00Z' };
const extendedLead = { ...expiredLead, id: 'extended', request_id: 'req-extended' };
rows.PatientRequest = [
  { id: 'req-expired', lifecycle_state: 'active', expires_at: expiredLead.expires_at },
  { id: 'req-extended', lifecycle_state: 'active', expires_at: '2026-10-01T10:00:00Z' },
];
const projection = await projectOrganizationLeadExpirations(svc, [expiredLead, extendedLead], now);
assert.equal(projection[0].status, 'expired');
assert.equal(projection[1].status, 'new', 'Current request expiry overrides the old lead snapshot');
assert.equal(expiredLead.status, 'new', 'Projection never mutates the stored row');
assert.equal(buildOrganizationLeadInboxPage({ leads: projection, locations }).counters.lead_deliveries_in_scope, 1);
assert.equal(buildOrganizationLeadInboxPage({ leads: projection, locations, scope: 'history' }).leads[0].id, 'expired');

// Execute the actual read-only endpoint with in-memory entities, including SDK pagination.
const endpointUrl = new URL('../base44/functions/getMyProviderWorkspace/providerOrganizationLeadInboxOps.ts', import.meta.url);
let source = await readFile(endpointUrl, 'utf8');
source = source.replace(/import \{ createClientFromRequest \} from 'npm:@base44\/sdk@[^']+';/,
  'const createClientFromRequest = () => globalThis.__organizationInboxTestClient;');
source = source.replace(/from '(\.\.[^']+)'/g, (_match, path) => 'from ' + JSON.stringify(new URL(path, endpointUrl).href));
source = source.replace('req: Request', 'req');
globalThis.__organizationInboxTestClient = { auth: { me: async () => user }, asServiceRole: svc };
globalThis.__organizationInboxTestHandler = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).handle;
const invoke = async (body) => {
  const response = await globalThis.__organizationInboxTestHandler(new Request('https://test.invalid', {
    method: 'POST', body: JSON.stringify({ organization_id: 'org', action: 'list', ...body }),
  }));
  return { status: response.status, data: await response.json() };
};
reset();
rows.ProviderLead = Array.from({ length: 601 }, (_, i) => ({
  id: 'lead-' + String(i).padStart(4, '0'), location_id: 'a', request_id: 'request-' + i,
  status: 'new', delivery_state: 'available', created_date: '2026-09-25T10:00:00Z',
  contact_name: 'Private name', full_details: { contact_email: 'private@example.test' },
}));
rows.ProviderLead.push({ id: 'lead-b', location_id: 'b', request_id: 'request-0', status: 'new', delivery_state: 'available' });
rows.ProviderSubscription = [{ id: 'pro-a', location_id: 'a', plan_code: 'pro', status: 'active' }];
const response = await invoke({ offset: 500, limit: 100 });
assert.equal(response.status, 200);
assert.equal(response.data.pagination.total, 602);
assert.equal(response.data.leads.length, 100);
assert.equal(response.data.counters.distinct_requests, 601);
assert.equal(response.data.entitlements_by_location.a.plan_code, 'pro');
assert.equal(response.data.entitlements_by_location.b.plan_code, 'free');
assert.ok(calls.some((call) => call.entity === 'ProviderLead' && call.skip === 500));
for (const lead of response.data.leads) {
  for (const field of ['request_id', 'contact_name', 'full_details']) assert.equal(Object.hasOwn(lead, field), false);
}
assert.equal((await invoke({ location_id: 'foreign' })).status, 403);
assert.equal((await invoke({ action: 'submit' })).status, 400);
reset({ ...owner, organization_wide_access: false });
assert.deepEqual((await invoke({ location_ids: ['a', 'b', 'foreign'] })).data.locations.map((row) => row.id), ['a']);
for (const patch of [{ role: 'location_manager' }, { role: 'location_staff' }, { organization_role: 'organization_admin' }, { status: 'inactive' }]) {
  reset({ ...owner, ...patch });
  assert.equal((await invoke({})).status, 403, JSON.stringify(patch));
}
delete globalThis.__organizationInboxTestClient;
delete globalThis.__organizationInboxTestHandler;
console.log('Organization inbox integration: owner scope, future locations, expiry, isolation and >500 SDK pagination passed.');
