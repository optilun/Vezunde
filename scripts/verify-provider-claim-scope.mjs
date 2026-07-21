import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_CLAIM_SCOPES,
  allowedRolesForClaimScope,
  isApprovedRoleAllowed,
  normalizeClaimScopeSelection,
  requestedRoleForClaimScope,
} from '../shared/providerClaimScopePolicy.js';
import {
  membershipHasOrganizationWideAccess,
  organizationApprovalIsWide,
} from '../shared/providerOrganizationOwnerScope.js';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

assert.equal(requestedRoleForClaimScope('owner', PROVIDER_CLAIM_SCOPES.LOCATION), 'location_manager');
assert.equal(requestedRoleForClaimScope('organization_representative', PROVIDER_CLAIM_SCOPES.SELECTED_LOCATIONS), 'location_manager');
assert.equal(requestedRoleForClaimScope('owner', PROVIDER_CLAIM_SCOPES.ORGANIZATION), 'organization_owner');
assert.deepEqual(allowedRolesForClaimScope(PROVIDER_CLAIM_SCOPES.LOCATION), ['location_manager', 'location_staff']);
assert.equal(isApprovedRoleAllowed(PROVIDER_CLAIM_SCOPES.LOCATION, 'owner', 'organization_owner'), false);
assert.equal(isApprovedRoleAllowed(PROVIDER_CLAIM_SCOPES.ORGANIZATION, 'location_manager', 'organization_owner'), false);
assert.equal(isApprovedRoleAllowed(PROVIDER_CLAIM_SCOPES.ORGANIZATION, 'owner', 'organization_owner'), true);

const locationClaim = normalizeClaimScopeSelection({
  primaryLocationId: 'loc-1',
  organizationId: 'org-1',
  relationship: 'owner',
  claimScope: 'location',
  candidateLocationIds: ['loc-1', 'loc-2'],
  requestedLocationIds: ['loc-1', 'loc-2'],
});
assert.equal(locationClaim.ok, true);
assert.deepEqual(locationClaim.requested_location_ids, ['loc-1']);
assert.deepEqual(locationClaim.excluded_location_ids, ['loc-2']);
assert.equal(locationClaim.requested_membership_role, 'location_manager');

const invalidMulti = normalizeClaimScopeSelection({
  primaryLocationId: 'loc-1',
  organizationId: 'org-1',
  relationship: 'owner',
  claimScope: 'selected_locations',
  candidateLocationIds: ['loc-1', 'loc-2'],
  requestedLocationIds: ['loc-1'],
});
assert.equal(invalidMulti.ok, false);

const organizationClaim = normalizeClaimScopeSelection({
  primaryLocationId: 'loc-1',
  organizationId: 'org-1',
  relationship: 'owner',
  claimScope: 'organization',
  candidateLocationIds: ['loc-1', 'loc-2', 'loc-3'],
  requestedLocationIds: ['loc-1', 'loc-2'],
  excludedLocationIds: ['loc-3'],
  reportedMissingLocation: 'Punct de lucru lipsa in Sibiu',
});
assert.equal(organizationClaim.ok, true);
assert.deepEqual(organizationClaim.requested_location_ids, ['loc-1', 'loc-2']);
assert.deepEqual(organizationClaim.excluded_location_ids, ['loc-3']);
assert.equal(organizationClaim.requested_membership_role, 'organization_owner');

assert.equal(organizationApprovalIsWide({
  claim_scope: 'organization',
  approved_membership_role: 'organization_owner',
  approval_status: 'approved',
  candidate_location_count: 3,
  approved_location_count: 3,
  excluded_location_count: 0,
}), true);
assert.equal(organizationApprovalIsWide({
  claim_scope: 'organization',
  approved_membership_role: 'organization_owner',
  approval_status: 'approved',
  candidate_location_count: 3,
  approved_location_count: 2,
  excluded_location_count: 1,
}), false);
const resolution = { wideUserIds: new Set(), restrictedUserIds: new Set(['user-1']) };
assert.equal(membershipHasOrganizationWideAccess({ user_id: 'user-1', role: 'organization_owner', status: 'active' }, resolution), false);
assert.equal(membershipHasOrganizationWideAccess({ user_id: 'legacy', role: 'organization_owner', status: 'active' }, resolution), true);
assert.equal(membershipHasOrganizationWideAccess({ user_id: 'user-1', role: 'organization_owner', status: 'active', organization_wide_access: true }, resolution), true);

const scopeEntity = await source('base44/entities/ProviderClaimScopeSelection.jsonc');
const locationEntity = await source('base44/entities/ProviderClaimLocationSelection.jsonc');
const membershipEntity = await source('base44/entities/ProviderMembership.jsonc');
const optionsFunction = await source('base44/functions/getProviderClaimScopeOptions/entry.ts');
const submitFunction = await source('base44/functions/submitProviderScopedClaim/entry.ts');
const reviewFunction = await source('base44/functions/directoryOps/adminProviderScopedClaimReview.ts');
const syncFunction = await source('base44/functions/syncProviderOrganizationOwnerAccess/entry.ts');
const claimForm = await source('src/components/provider/ClaimForm.jsx');
const claimScopeStep = await source('src/components/provider/ClaimScopeStep.jsx');
const addOrClaim = await source('src/pages/AddOrClaim.jsx');
const adminClaims = await source('src/components/admin/directory/DirOpsClaims.jsx');
const claimStatus = await source('src/components/account/ClaimStatusRow.jsx');

for (const value of ['location', 'selected_locations', 'organization']) assert.match(scopeEntity, new RegExp(`"${value}"`));
for (const value of ['included', 'excluded', 'not_requested', 'approved', 'rejected']) assert.match(locationEntity, new RegExp(`"${value}"`));
assert.match(scopeEntity, /"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/);
assert.match(locationEntity, /"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/);
assert.match(membershipEntity, /"organization_wide_access"/);
assert.match(membershipEntity, /"claim_request_id"/);

assert.match(optionsFunction, /already_has_access/);
assert.match(optionsFunction, /DirectoryOrganizationLocationLink/);
assert.match(optionsFunction, /supports_selected_locations/);
assert.match(submitFunction, /normalizeClaimScopeSelection/);
assert.match(submitFunction, /ProviderClaimScopeSelection\.create/);
assert.match(submitFunction, /ProviderClaimLocationSelection\.create/);
assert.match(submitFunction, /claim_verification_status:\s*'pending'/);
assert.match(submitFunction, /Ai deja o solicitare activa sau aprobata/);
assert.match(reviewFunction, /approved_location_ids/);
assert.match(reviewFunction, /Locatia principala trebuie sa ramana inclusa/);
assert.match(reviewFunction, /Aprobarea contine o locatie care nu a fost solicitata/);
assert.match(reviewFunction, /request_more_info/);
assert.match(reviewFunction, /notification_sent/);
assert.match(syncFunction, /loadOrganizationOwnerScopeResolution/);
assert.match(syncFunction, /membershipHasOrganizationWideAccess/);
assert.doesNotMatch(syncFunction, /filter\(\(membership\) => normalizeRole\(membership\.role\) === 'organization_owner'/);

assert.match(claimForm, /pending_claim_scope/);
assert.match(claimForm, /getProviderClaimScopeOptions/);
assert.match(claimForm, /submitProviderScopedClaim/);
assert.match(claimScopeStep, /Lipseste o locatie din lista/);
assert.match(claimScopeStep, /already_has_access/);
assert.match(addOrClaim, /Alege accesul/);
assert.match(addOrClaim, /claimStep === "scope"/);
assert.match(addOrClaim, /PENDING_CLAIM_SCOPE_KEY/);
assert.match(adminClaims, /adminProviderScopedClaimReview/);
assert.match(adminClaims, /approved_location_ids/);
assert.match(adminClaims, /Aprobarea poate fi partiala/);
assert.match(claimStatus, /approved_location_ids/);
assert.match(claimStatus, /Aprobarea este partiala/);

console.log('Provider claim scope checks passed.');

