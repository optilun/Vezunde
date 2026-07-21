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
  read('base44/functions/getMyProviderMembers/entry.ts'),
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
assert.match(roleScope, /ORGANIZATION_ADMIN_ROLE\) return 'location_manager'/);
assert.match(roleScope, /isPrivilegedProviderRole/);
assert.match(roleScope, /roleRequiresOrganizationWideAccess/);
assert.match(roleScope, /membership\.organization_wide_access === true/);

assert.match(createInvitation, /roleRequiresOrganizationWideAccess\(proposedRole\)/);
assert.match(createInvitation, /proposedRole === ORGANIZATION_OWNER_ROLE && payload\.organization_wide_access === true/);
assert.match(createInvitation, /scope\.wideOwnerOrganizationIds/);
assert.match(createInvitation, /scope\.adminOrganizationIds/);
assert.match(createInvitation, /organization_wide_access: organizationWide/);
assert.match(createInvitation, /invited_location_ids: locationIds/);

assert.match(acceptInvitation, /storedProviderRoleForAccessRole\(accessRole\)/);
assert.match(acceptInvitation, /organization_role: organizationRole \|\| 'none'/);
assert.match(acceptInvitation, /organization_wide_access: organizationWide/);
assert.match(acceptInvitation, /claim_scope: organizationWide \? 'organization'/);
assert.match(acceptInvitation, /ProviderMembership\.update|ProviderMembership\.create/);

assert.match(setAccess, /Un utilizator trebuie sa aiba un singur rol clar in organizatie/);
assert.match(setAccess, /actor\.role === ORGANIZATION_ADMIN_ROLE && isPrivilegedProviderRole/);
assert.match(setAccess, /roleRequiresOrganizationWideAccess\(selectedRole\)/);
assert.match(setAccess, /Doar un owner global poate acorda acces la intreaga organizatie/);
assert.match(setAccess, /Nu poti elimina ultimul owner activ al locatiei/);
assert.match(setAccess, /organization_role: assignment\.role === ORGANIZATION_ADMIN_ROLE/);
assert.match(setAccess, /organization_wide_access: organizationWide/);

assert.match(members, /organization_admins_count/);
assert.match(members, /global_owners_count/);
assert.match(members, /current_actor_wide_access/);
assert.match(members, /can_manage_privileged_roles/);
assert.match(members, /can_grant_organization_admin/);
assert.match(members, /available_invitation_roles/);
assert.match(members, /manageable_location_ids/);

assert.match(revokeInvitation, /isPrivilegedProviderRole|ORGANIZATION_ADMIN_ROLE/);
assert.match(revokeInvitation, /organization_wide_access/);
assert.match(syncAccess, /membershipHasOrganizationWideAccess/);
assert.match(syncAccess, /ORGANIZATION_ADMIN_ROLE/);
assert.match(syncAccess, /organization_wide_access: true/);
assert.match(expansion, /propagateOrganizationWideAccess/);
assert.match(expansion, /organization_wide_memberships/);
assert.match(expansion, /storedProviderRoleForAccessRole\(accessRole\)/);

assert.match(workspace, /organization_admin:/);
assert.match(workspace, /"organization\.manage_members"/);
assert.doesNotMatch(
  workspace.match(/organization_admin:\s*\[[\s\S]*?\],/s)?.[0] || '',
  /organization\.manage_settings|organization\.manage_locations|location\.archive|location\.request_closure/,
);
assert.match(workspace, /actorHasWideOrganizationAccess/);
assert.match(workspace, /current_actor_wide_access/);
assert.match(workspace, /OWNER_SENSITIVE_ORGANIZATION_CAPABILITIES/);
assert.match(workspace, /scopedLocationIds/);
assert.match(workspace, /syncProviderOrganizationOwnerAccess/);

assert.match(accessUi, /organization_owner/);
assert.match(accessUi, /organization_admin/);
assert.match(accessUi, /location_manager/);
assert.match(accessUi, /location_staff/);
assert.match(accessUi, /Toată organizația/);
assert.match(accessUi, /Locații selectate/);
assert.match(accessUi, /organization_wide_access: form\.scope === "all"/);
assert.match(accessUi, /organization_wide_access: edit\.scope === "all"/);
assert.match(labels, /organization_admin: "Administrator organizație"/);
assert.match(invitationUi, /organization_admin/);
assert.match(invitationUi, /organization_wide_access/);
assert.match(invitationUi, /locațiilor actuale și viitoare/);

console.log('Provider organization administrator access checks passed.');
