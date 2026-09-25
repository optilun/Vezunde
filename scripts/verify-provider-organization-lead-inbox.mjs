import assert from 'node:assert/strict';
import {
  PROVIDER_ORGANIZATION_LEAD_INBOX_CONTRACT_VERSION,
  buildOrganizationLeadInboxPage,
  resolveOrganizationLeadLocations,
} from '../base44/shared/providerOrganizationLeadInboxPolicy.js';

assert.equal(PROVIDER_ORGANIZATION_LEAD_INBOX_CONTRACT_VERSION, 'provider-organization-lead-inbox-v1');

const locations = [
  { id: 'a-1', organization_id: 'org-a', name: 'Alfa' },
  { id: 'a-2', organization_id: 'org-a', name: 'Beta' },
  { id: 'b-1', organization_id: 'org-b', name: 'Alta retea' },
];
const owner = {
  user_id: 'owner-1',
  organization_id: 'org-a',
  location_id: 'a-1',
  role: 'organization_owner',
  status: 'active',
};
const resolve = (memberships, resolution = {}) => resolveOrganizationLeadLocations({
  organizationId: 'org-a',
  memberships,
  locations,
  ownerScopeResolution: resolution,
}).map((location) => location.id);

assert.deepEqual(resolve([{ ...owner, organization_wide_access: true }]), ['a-1', 'a-2']);
assert.deepEqual(resolve([{ ...owner, organization_wide_access: false }]), ['a-1']);
assert.deepEqual(resolve([{ ...owner, claim_scope: 'selected_locations' }]), ['a-1']);
assert.deepEqual(resolve([{ ...owner, organization_wide_access: true, status: 'inactive' }]), []);
assert.deepEqual(resolve([{ ...owner, role: 'location_manager', organization_wide_access: true }]), []);
assert.deepEqual(resolve([{ ...owner, role: 'location_staff', organization_wide_access: true }]), []);
assert.deepEqual(resolve([{ ...owner, organization_role: 'organization_admin', organization_wide_access: true }]), []);
assert.deepEqual(resolve([{ ...owner, location_id: 'b-1', organization_wide_access: true }]), []);
assert.deepEqual(resolve([{ ...owner, organization_id: 'org-b', organization_wide_access: true }]), []);
assert.deepEqual(resolve([{ ...owner, organization_wide_access: false }, {
  ...owner, location_id: 'a-2', organization_wide_access: false,
}]), ['a-1', 'a-2']);
assert.deepEqual(resolve([{ ...owner }], { restrictedUserIds: new Set(['owner-1']) }), ['a-1']);
assert.deepEqual(resolve([{ ...owner }], { wideUserIds: new Set(['owner-1']) }), ['a-1', 'a-2']);

const lead = (id, requestId, locationId, status, createdDate) => ({
  id,
  request_id: requestId,
  location_id: locationId,
  status,
  delivery_state: 'available',
  created_date: createdDate,
  preview_summary: 'Date anonimizate',
  access_tier: 'pro_full',
  contact_name: 'Nume privat',
  contact_email: 'privat@example.com',
  full_details: { contact_name: 'Nume privat' },
});
const leads = [
  lead('lead-1', 'request-secret-1', 'a-1', 'new', '2026-09-25T12:00:00Z'),
  lead('lead-2', 'request-secret-1', 'a-2', 'new', '2026-09-25T11:00:00Z'),
  lead('lead-3', 'request-secret-2', 'a-1', 'viewed', '2026-09-25T10:00:00Z'),
  lead('lead-4', 'request-secret-3', 'a-2', 'closed', '2026-09-25T09:00:00Z'),
  lead('forbidden', 'request-secret-4', 'b-1', 'new', '2026-09-25T13:00:00Z'),
];
const authorizedLocations = locations.slice(0, 2);
let nextKey = 0;
const page = buildOrganizationLeadInboxPage({
  leads,
  locations: authorizedLocations,
  limit: 2,
  keyFactory: () => `opaque-${++nextKey}`,
});
assert.equal(page.counters.total, 4);
assert.equal(page.counters.distinct_requests, 3);
assert.equal(page.counters.lead_deliveries_in_scope, 3);
assert.equal(page.counters.distinct_requests_in_scope, 2);
assert.equal(page.pagination.total, 3);
assert.equal(page.pagination.has_more, true);
assert.deepEqual(page.leads.map((item) => item.id), ['lead-1', 'lead-2']);
assert.equal(page.leads[0].group_key, page.leads[1].group_key);
assert.equal(page.leads[0].location_name, 'Alfa');
assert.equal(page.leads[1].location_name, 'Beta');
for (const item of page.leads) {
  assert.equal(item.access_tier, 'free_preview');
  for (const forbiddenField of ['request_id', 'contact_name', 'contact_email', 'full_details']) {
    assert.equal(Object.hasOwn(item, forbiddenField), false, forbiddenField);
  }
  assert.notEqual(item.group_key, 'request-secret-1');
}

const filtered = buildOrganizationLeadInboxPage({
  leads,
  locations: authorizedLocations,
  status: 'new',
  locationId: 'a-2',
});
assert.equal(filtered.pagination.total, 1);
assert.equal(filtered.counters.lead_deliveries_in_scope, 1);
assert.equal(filtered.counters.distinct_requests_in_scope, 1);
assert.equal(filtered.counters.total, 4);

const history = buildOrganizationLeadInboxPage({
  leads,
  locations: authorizedLocations,
  scope: 'history',
});
assert.deepEqual(history.leads.map((item) => item.id), ['lead-4']);
assert.equal(history.counters.distinct_requests_in_scope, 1);

const manyLeads = Array.from({ length: 601 }, (_, index) =>
  lead(`many-${index}`, `request-${index}`, 'a-1', 'new',
    new Date(Date.UTC(2026, 8, 25, 0, 0, index)).toISOString()));
const secondPage = buildOrganizationLeadInboxPage({
  leads: manyLeads,
  locations: authorizedLocations,
  offset: 500,
  limit: 100,
});
assert.equal(secondPage.counters.lead_deliveries_in_scope, 601);
assert.equal(secondPage.counters.distinct_requests_in_scope, 601);
assert.equal(secondPage.pagination.total, 601);
assert.equal(secondPage.leads.length, 100);
assert.equal(secondPage.pagination.has_more, true);
console.log('Provider organization lead inbox policy: OK');
