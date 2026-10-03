import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { activeLinksByLocation, claimOrganizationLinkStatus } from '../base44/shared/providerOrganizationLinkIntegrity.js';
// 2026-10-03: getClaimableProviderLocations filtreaza cu poarta canonica de publicare.
import { deriveCanonicalDirectoryState } from '../base44/shared/directoryCanonicalModel.js';

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
  Response, Date, deriveCanonicalDirectoryState,
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

// Organization suggestions must use the same public-state gate as individual profiles.
organizations.push(
  { id: 'org-exact', name: 'Vedere', status: 'activa', organization_type: 'ophthalmology_clinic' },
  { id: 'org-prefix', name: 'Vedere Plus', status: 'activa' },
  { id: 'org-suffix', name: 'A Vedere', status: 'activa' },
  { id: 'org-display', name: 'Company SRL', public_display_name: 'Vedere', status: 'activa' },
  { id: 'org-single', name: 'Vedere Single', status: 'activa' },
  { id: 'org-inactive', name: 'Vedere Inactive', status: 'inactiva' },
);
for (const id of ['org-exact', 'org-prefix', 'org-suffix', 'org-display', 'org-inactive']) {
  locations.push(
    { ...locations[0], id: id + '-1', name: 'Branch first', organization_id: id },
    { ...locations[0], id: id + '-2', name: 'Branch second', organization_id: id, city: 'Brașov', address: 'Unică 12' },
  );
}
locations.push(
  { ...locations[0], id: 'single-public', name: 'Vedere Single', organization_id: 'org-single' },
  { ...locations[0], id: 'single-hidden', organization_id: 'org-single', public_visibility_status: 'archived' },
  { ...locations[0], id: 'unlinked', name: 'Vedere independent', organization_id: null },
  { ...locations[0], id: 'fake-name-link', name: 'Lensa independent', organization_id: null },
  { ...locations[0], id: 'approved', name: 'Lensa controlled', organization_id: 'org-lensa', claim_verification_status: 'approved' },
);
for (const [index, visibility] of ['archived', 'rejected', 'needs_more_info'].entries()) {
  locations.push({ ...locations[0], id: 'hidden-' + index, organization_id: 'org-lensa', public_visibility_status: visibility });
}
locations.push(
  { ...locations[0], id: 'inactive-branch', organization_id: 'org-lensa', active_status: 'inactiva' },
  { ...locations[0], id: 'suspended-branch', organization_id: 'org-lensa', profile_control_status: 'suspended' },
  { ...locations[0], id: 'b2b-branch', organization_id: 'org-lensa', provider_profile_type: 'optical_laboratory_b2b' },
);
async function search(q) {
  return (await handler({ json: async () => ({ q }) })).json();
}
const grouped = await search('Lénsa');
assert.equal(grouped.organizations[0].location_count, 88);
assert.equal(grouped.organizations[0].locations.length, 88);
assert.ok(grouped.organizations[0].locations.every((row) => row.organization_id === 'org-lensa'));
assert.equal(grouped.organizations[0].locations.find((row) => row.id === 'approved').claim_action, 'request_access');
assert.equal(grouped.organizations[0].locations[0].provider_type, 'optica_medicala');
assert.ok(grouped.organizations[0].locations.every((row) => !row.id.startsWith('hidden-')));
const ranked = await search('vedere');
assert.equal(ranked.organizations[0].name, 'Vedere');
assert.ok(ranked.organizations.slice(0, 2).every((row) => row.name === 'Vedere'));
assert.equal(ranked.organizations[2].id, 'org-prefix');
assert.ok(!ranked.organizations.some((row) => ['org-single', 'org-inactive'].includes(row.id)));
assert.equal((await search('company')).organizations[0].name, 'Vedere', 'Legal name and display name both match');
const addressMatch = await search('unica');
assert.equal(addressMatch.organizations.find((row) => row.id === 'org-exact').primary_location_id, 'org-exact-2');
assert.deepEqual(await search('v'), { locations: [], organizations: [] });
const { standaloneClaimLocations } = await import('../src/lib/claimSearchResults.js');
assert.deepEqual(standaloneClaimLocations(result.locations, result.organizations), []);
assert.equal(standaloneClaimLocations([{ id: 'fake-name-link', name: 'Lensa independent' }], grouped.organizations).length, 1, 'Similar names are not organization links');
assert.equal(standaloneClaimLocations([{ id: 'single-public' }], ranked.organizations).length, 1, 'A single location remains selectable');
assert.equal(standaloneClaimLocations([{ id: 'other-org-location' }], ranked.organizations).length, 1, 'Branches of an omitted organization stay selectable');

console.log('Claim directory coverage and organization link integrity: OK');
