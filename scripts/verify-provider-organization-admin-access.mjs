import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  membershipSchema,
  invitationSchema,
  roleScope,
  createInvitation,
  acceptInvitation,
  setAccess,
  members,
  revokeInvitation,
  syncAccess,
  expansion,
  workspace,
  accessUi,
  labels,
  invitationUi,
] = await Promise.all([
  read('base44/entities/ProviderMembership.jsonc'),
  read('base44/entities/ProviderMemberInvitation.jsonc'),
  read('shared/providerOrganizationOwnerScope.js'),
  read('base44/functions/createProviderMemberInvitation/entry.ts'),
  read('base44/functions/acceptProviderMemberInvitation/entry.ts'),
  read('base44/functions/setProviderMemberAccess/entry.ts'),
  read('base44/functions/getMyProviderWorkspace/getMyProviderMembers.ts'),
  read('base44/functions/revokeProviderMemberInvitation/entry.ts'),
  read('base44/functions/syncProviderOrganizationOwnerAccess/entry.ts'),
  read('base44/functions/providerLocationExpansionOps/entry.ts'),
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('src/components/workspace/provider/ProviderAccess.jsx'),
  read('src/lib/workspaceStatusLabels.js'),
  read('src/pages/AcceptProviderInvitation.jsx'),
]);

assert.match(membershipSchema, /"organization_role"/);
assert.match(membershipSchema, /"organization_admin"/);
assert.match(membershipSchema, /"organization_wide_access"/);
assert.match(invitationSchema, /"organization_admin"/);
assert.match(invitationSchema, /"organization_wide_access"/);

assert.match(roleScope, /ORGANIZATION_ADMIN_ROLE/);
assert.match(roleScope, /storedProviderRoleForAccessRole/);
assert.match(roleScope, /from '\.\/providerRolePolicy\.js'/);
assert.match(roleScope, /isPrivilegedProviderRole/);
assert.match(roleScope, /roleRequiresOrganizationWideAccess/);
assert.match(roleScope, /membership\.organization_wide_access === true/);

// 2026-10-03 (structura conturilor, pasul 3): fara „owner selectiv”. Proprietarul si administratorul
// primesc mereu toata organizatia; cine ce poate da vine din matricea comuna.
assert.match(createInvitation, /const organizationWide = providerRoleCoversOrganization\(proposedRole\);/);
assert.doesNotMatch(createInvitation, /payload\.organization_wide_access === true/);
assert.match(createInvitation, /canAssignProviderRole\(scope\.roleByOrganization\.get\(organizationId\), proposedRole\)/);
assert.match(createInvitation, /scope\.locationIdsByOrganization/);
assert.match(createInvitation, /organization_wide_access: organizationWide/);
assert.match(createInvitation, /invited_location_ids: locationIds/);

assert.match(acceptInvitation, /storedProviderRoleForAccessRole\(accessRole\)/);
assert.match(acceptInvitation, /organization_role: organizationRole \|\| 'none'/);
assert.match(acceptInvitation, /organization_wide_access: organizationWide/);
assert.match(acceptInvitation, /claim_scope: organizationWide \? 'organization'/);
assert.match(acceptInvitation, /ProviderMembership\.update|ProviderMembership\.create/);

assert.match(setAccess, /Un utilizator trebuie sa aiba un singur rol clar in organizatie/);
assert.match(setAccess, /canManageProviderMember\(actor\.role, currentTargetRole\)/);
assert.match(setAccess, /canAssignProviderRole\(actor\.role, selectedRole\)/);
assert.match(setAccess, /const organizationWide = providerRoleCoversOrganization\(selectedRole\);/);
assert.doesNotMatch(setAccess, /requestedWideAccess/);
assert.match(setAccess, /Nu poti elimina ultimul proprietar activ al locatiei/);
assert.match(setAccess, /organization_role: assignment\.role === ORGANIZATION_ADMIN_ROLE/);
assert.match(setAccess, /organization_wide_access: organizationWide/);

assert.match(members, /organization_admins_count/);
assert.match(members, /global_owners_count/);
assert.match(members, /assignableProviderRoles\(/);
assert.match(members, /current_actor_wide_access/);
assert.match(members, /can_manage_privileged_roles/);
assert.match(members, /can_grant_organization_admin/);
assert.match(members, /available_invitation_roles/);
assert.match(members, /manageable_location_ids/);

assert.match(revokeInvitation, /canAssignProviderRole\(actor\.role, invitation\.proposed_role\)/);
assert.match(revokeInvitation, /organization_wide_access/);
assert.match(syncAccess, /membershipHasOrganizationWideAccess/);
assert.match(syncAccess, /ORGANIZATION_ADMIN_ROLE/);
assert.match(syncAccess, /organization_wide_access: true/);
assert.match(expansion, /propagateOrganizationWideAccess/);
assert.match(expansion, /organization_wide_memberships/);
// 2026-10-03: planul de acces e in shared (planNewLocationAccess), comun cu rezolutia de identitate.
assert.match(expansion, /planNewLocationAccess\(\{ memberships, resolution, organizationId, locationId, requesterUserId \}\)/);
assert.match(roleScope, /export function planNewLocationAccess\(/);
assert.match(roleScope, /role: storedProviderRoleForAccessRole\(accessRole\)/);

assert.match(workspace, /const ROLE_CAPABILITIES = PROVIDER_ROLE_CAPABILITIES;/);
assert.match(workspace, /"organization\.manage_members"/);
assert.match(workspace, /actorHasWideOrganizationAccess/);
assert.match(workspace, /current_actor_wide_access/);
assert.match(workspace, /OWNER_SENSITIVE_ORGANIZATION_CAPABILITIES/);
assert.match(workspace, /scopedLocationIds/);
assert.match(workspace, /syncProviderOrganizationOwnerAccess/);

assert.match(accessUi, /PROVIDER_ACCESS_ROLES/);
assert.match(accessUi, /organization_owner/);
assert.match(accessUi, /organization_admin/);
assert.doesNotMatch(accessUi, /ScopeChoice|· selectiv|Owneri globali|ownerul global|Scope owner/);
assert.match(accessUi, /organization_wide_access: providerRoleCoversOrganization\(form\.role\)/);
assert.match(accessUi, /organization_wide_access: providerRoleCoversOrganization\(edit\.role\)/);
assert.match(labels, /PROVIDER_ROLE_LABELS as ROLE_LABELS/);
assert.match(invitationUi, /organization_admin/);
assert.match(invitationUi, /organization_wide_access/);
assert.match(invitationUi, /locațiilor actuale și viitoare/);

console.log('Provider organization administrator access checks passed.');
