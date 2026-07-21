import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveProviderTeamLocationScope } from '../shared/providerTeamLocationScope.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const submit = read('base44/function_modules/submitProviderWorkspaceChange.ts');
const organization = read('base44/function_modules/manageProviderOrganizationProfile.ts');
const adminLocation = read('base44/function_modules/adminWorkspaceReview.ts');
const adminOrganization = read('base44/function_modules/adminOrganizationProfileReview.ts');
const client = read('src/api/base44Client.js');

const checks = [
  [submit.includes("hasPublishedSectionChanges('location_details'"), 'location create/update/submit compares published values'],
  [submit.includes('sameSubmissionPayload(submission.section'), 'location pending duplicates use canonical comparison'],
  [submit.includes("status: 'withdrawn'"), 'location no-op drafts can be withdrawn'],
  [submit.includes('resolveProviderTeamLocationScope(allMemberships, organizationLocations)'), 'team assignment scope uses the organization-scoped resolver'],
  [submit.includes("ProviderLocation.filter({ organization_id: loc.organization_id }"), 'team assignment scope loads only locations from the active organization'],
  [adminLocation.includes('assertLocationsInScope'), 'admin approval revalidates team location organization scope'],
  [organization.includes("hasPublishedSectionChanges('public_profile'"), 'organization compares canonical published values'],
  [organization.includes('activeAfterCreate'), 'organization has post-create race guard'],
  [organization.includes("status: 'withdrawn'"), 'organization no-op drafts can be withdrawn'],
  [adminLocation.includes('Cererea nu contine modificari reale fata de datele publicate.'), 'admin blocks no-op location approval'],
  [adminOrganization.includes('Cererea nu contine modificari reale fata de profilul publicat.'), 'admin blocks no-op organization approval'],
  [!client.includes('new Proxy'), 'global Base44 client Proxy was removed'],
];
for (const [condition, message] of checks) assert.equal(condition, true, message);

const organizationLocations = [{ id: 'org-a-1' }, { id: 'org-a-2' }];
const crossOrganizationMemberships = [
  { location_id: 'org-a-1', role: 'location_manager', status: 'active' },
  { location_id: 'org-b-1', role: 'organization_owner', status: 'active' },
  { location_id: 'org-a-2', role: 'location_staff', status: 'active' },
];
assert.deepEqual(
  resolveProviderTeamLocationScope(crossOrganizationMemberships, organizationLocations),
  ['org-a-1'],
  'roles from another organization and staff memberships must not expand team assignment scope',
);

assert.deepEqual(
  resolveProviderTeamLocationScope([
    { location_id: 'org-a-1', role: 'organization_owner', status: 'active' },
    { location_id: 'org-b-1', role: 'location_manager', status: 'active' },
  ], organizationLocations),
  ['org-a-1', 'org-a-2'],
  'an organization owner may assign team members to every location in that organization only',
);

assert.deepEqual(
  resolveProviderTeamLocationScope([
    { location_id: 'independent', role: 'location_manager', status: 'active' },
    { location_id: 'other', role: 'location_manager', status: 'active' },
  ], [{ id: 'independent' }]),
  ['independent'],
  'an independent location remains isolated from unrelated memberships',
);

assert.deepEqual(
  resolveProviderTeamLocationScope([
    { location_id: 'org-a-1', role: 'location_manager', status: 'inactive' },
  ], organizationLocations),
  [],
  'inactive memberships cannot grant team assignment scope',
);

console.log(`provider submission backend: ${checks.length} source checks and 4 scope checks passed`);
