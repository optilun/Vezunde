import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { activeLinksByLocation, claimOrganizationLinkStatus } from '../base44/shared/providerOrganizationLinkIntegrity.js';

const location = { id: 'loc-1', organization_id: 'org-1' };
const aligned = { location_id: 'loc-1', organization_id: 'org-1', link_status: 'confirmed', link_record_status: 'active' };
const disputed = { location_id: 'loc-1', organization_id: 'org-2', link_status: 'confirmed', link_record_status: 'active' };
assert.equal(claimOrganizationLinkStatus(location, [aligned]), 'confirmed');
assert.equal(claimOrganizationLinkStatus(location, [disputed]), 'conflict', 'A confirmed label cannot hide a different organization id');
assert.equal(claimOrganizationLinkStatus(location, [], { organization_link_status: 'conflict' }), 'conflict');
assert.equal(claimOrganizationLinkStatus(location, [aligned, aligned]), 'conflict', 'Multiple active links need review');
assert.deepEqual(activeLinksByLocation([aligned, { ...disputed, link_record_status: 'superseded' }]).get('loc-1'), [aligned]);

const source = fs.readFileSync('base44/functions/getClaimableProviderLocations/entry.ts', 'utf8').replace(/^import[\s\S]*?;\n/gm, '');
const organizations = Array.from({ length: 550 }, (_, index) => ({
  id: `org-${index}`, name: `Other ${index}`, status: 'activa',
}));
organizations.push({ id: 'org-lensa', name: 'Lensa', status: 'activa', organization_type: 'optical_chain' });
const locations = Array.from({ length: 550 }, (_, index) => ({
  id: `loc-${index}`, name: `Other location ${index}`, organization_id: `org-${index % 250}`,
  status: 'publicata', active_status: 'activa', profile_control_status: 'directory',
  provider_profile_type: 'optical_chain', provider_type: 'optica_medicala',
}));
locations.push(...Array.from({ length: 87 }, (_, index) => ({
  ...locations[0], id: `lensa-${index}`, name: `Lensa location ${index}`, organization_id: 'org-lensa',
})));
const pages = [];
const svc = { entities: {
  ProviderLocation: { filter: async (_query, _sort, limit, skip) => { pages.push(['location', skip]); return locations.slice(skip, skip + limit); } },
  ProviderOrganization: { list: async (_sort, limit, skip) => { pages.push(['organization', skip]); return organizations.slice(skip, skip + limit); } },
} };
let handler;
vm.runInNewContext(source, {
  Deno: { serve: (fn) => { handler = fn; } },
  Response, Date,
  createClientFromRequest: () => ({ asServiceRole: svc }),
});
const response = await handler({ json: async () => ({ q: 'lensa' }) });
const result = await response.json();
assert.equal(result.locations.length, 10);
assert.equal(result.organizations.length, 1);
assert.equal(result.organizations[0].location_count, 87);
assert.equal(result.organizations[0].locations.length, 87);
assert.ok(pages.some(([entity, skip]) => entity === 'location' && skip === 500));
assert.ok(pages.some(([entity, skip]) => entity === 'organization' && skip === 500));
console.log('Claim directory coverage and organization link integrity: OK');
