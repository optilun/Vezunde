import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { activeLinksByLocation, claimOrganizationLinkStatus } from '../base44/shared/providerOrganizationLinkIntegrity.js';

const readFunction = (path) => fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\n/gm, '');
const primary = { id: 'loc-1', name: 'Clinica A', organization_id: 'org-1', provider_profile_type: 'ophthalmology_clinic', provider_type: 'clinica_oftalmologica' };
const sibling = { ...primary, id: 'loc-2', name: 'Clinica B' };
const stateRows = [primary, sibling].map((location) => ({ location_id: location.id, organization_link_status: 'confirmed', state_status: 'active' }));
const link = (locationId, organizationId) => ({ location_id: locationId, organization_id: organizationId, link_status: 'confirmed', link_record_status: 'active' });

function setup(path, linkRows) {
  let handler;
  const entities = {
    ProviderLocation: { get: async () => primary, filter: async () => [primary, sibling] },
    ProviderOrganization: { get: async () => ({ id: 'org-1', name: 'Clinica A', status: 'activa' }) },
    DirectoryOrganizationLocationLink: { name: 'links' },
    ProviderLocationDirectoryState: { name: 'states' },
    ProviderMembership: { filter: async () => [] },
  };
  vm.runInNewContext(readFunction(path), {
    Deno: { serve: (fn) => { handler = fn; } },
    Response,
    createClientFromRequest: () => ({ auth: { me: async () => ({ id: 'user-1' }) }, asServiceRole: { entities } }),
    deriveCanonicalDirectoryState: () => ({ is_publicly_available: true, control_status: 'directory', operational_status: 'active' }),
    loadRowsForLocationIds: async (entity, ids) => (entity.name === 'links' ? linkRows : stateRows).filter((row) => ids.includes(row.location_id)),
    activeLinksByLocation,
    claimOrganizationLinkStatus,
  });
  return handler;
}
const optionsPath = 'base44/functions/getProviderClaimScopeOptions/entry.ts';
const disputedPrimary = setup(optionsPath, [link('loc-1', 'org-2'), link('loc-2', 'org-1')]);
const dispute = await (await disputedPrimary({ json: async () => ({ location_id: 'loc-1' }) })).json();
assert.equal(dispute.organization_link_review_required, true);
assert.equal(dispute.supports_organization_claim, false);
assert.deepEqual(dispute.candidate_locations.map((row) => row.id), ['loc-1']);
const disputedSibling = setup(optionsPath, [link('loc-1', 'org-1'), link('loc-2', 'org-2')]);
const scope = await (await disputedSibling({ json: async () => ({ location_id: 'loc-1' }) })).json();
assert.equal(scope.organization_link_review_required, false);
assert.deepEqual(scope.candidate_locations.map((row) => row.id), ['loc-1']);

const submit = setup('base44/functions/submitProviderScopedClaim/entry.ts', [link('loc-1', 'org-2')]);
const attempted = await submit({ json: async () => ({
  location_id: 'loc-1', claimant_relationship: 'owner', claim_scope: 'organization',
  representation_confirmed: true, contact: { contact_name: 'Test', email: 'test@example.com' },
}) });
assert.equal(attempted.status, 409);
assert.match((await attempted.json()).error, /necesita verificare/);

const reviewSource = fs.readFileSync('base44/functions/directoryOps/adminProviderScopedClaimReview.ts', 'utf8');
assert.match(reviewSource, /approvedLocationRows[\s\S]*claimOrganizationLinkStatus[\s\S]*const approvedSet/);
console.log('Claim scope link guards: OK');
