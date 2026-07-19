from pathlib import Path

backend_path = Path("base44/functions/submitProviderWorkspaceChange/entry.ts")
backend = backend_path.read_text(encoding="utf-8")

old_import = """import {
  hasPublishedSectionChanges,
  sameSubmissionPayload,
} from '../../../shared/providerWorkspaceSubmissionComparison.js';
"""
new_import = """import {
  hasPublishedSectionChanges,
  sameSubmissionPayload,
} from '../../../shared/providerWorkspaceSubmissionComparison.js';
import { resolveProviderTeamLocationScope } from '../../../shared/providerTeamLocationScope.js';
"""
if old_import not in backend:
    raise SystemExit("provider workspace comparison import block not found")
backend = backend.replace(old_import, new_import, 1)

old_scope = """      const allMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' });
      const permittedLocationIds = [...new Set(allMemberships
        .filter((membership) => ['organization_owner', 'location_manager'].includes(normalizeMemberRole(membership.role)))
        .map((membership) => membership.location_id)
        .filter(Boolean))];
"""
new_scope = """      const allMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' });
      const organizationLocations = loc.organization_id
        ? await svc.entities.ProviderLocation.filter({ organization_id: loc.organization_id }, '-created_date', 500)
        : [loc];
      const permittedLocationIds = resolveProviderTeamLocationScope(allMemberships, organizationLocations);
"""
if old_scope not in backend:
    raise SystemExit("unscoped provider team location block not found")
backend = backend.replace(old_scope, new_scope, 1)
backend_path.write_text(backend, encoding="utf-8")

helper_path = Path("shared/providerTeamLocationScope.js")
helper_path.write_text("""const TEAM_SCOPE_ROLES = new Set(['organization_owner', 'location_manager']);

function clean(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'manager') return 'location_manager';
  if (value === 'staff') return 'location_staff';
  return clean(value);
}

export function resolveProviderTeamLocationScope(memberships = [], organizationLocations = []) {
  const organizationLocationIds = new Set(
    organizationLocations.map((location) => clean(location?.id)).filter(Boolean),
  );
  if (organizationLocationIds.size === 0) return [];

  const scopedMemberships = memberships.filter((membership) => {
    if (!membership || (membership.status && membership.status !== 'active')) return false;
    const locationId = clean(membership.location_id);
    return locationId && organizationLocationIds.has(locationId);
  });

  if (scopedMemberships.some((membership) => normalizeRole(membership.role) === 'organization_owner')) {
    return [...organizationLocationIds].sort();
  }

  return [...new Set(scopedMemberships
    .filter((membership) => TEAM_SCOPE_ROLES.has(normalizeRole(membership.role)))
    .map((membership) => clean(membership.location_id))
    .filter(Boolean))].sort();
}
""", encoding="utf-8")

test_path = Path("scripts/verify-provider-submission-backend.mjs")
test_path.write_text("""import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveProviderTeamLocationScope } from '../shared/providerTeamLocationScope.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const submit = read('base44/functions/submitProviderWorkspaceChange/entry.ts');
const organization = read('base44/functions/manageProviderOrganizationProfile/entry.ts');
const adminLocation = read('base44/functions/adminWorkspaceReview/entry.ts');
const adminOrganization = read('base44/functions/adminOrganizationProfileReview/entry.ts');
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
""", encoding="utf-8")
