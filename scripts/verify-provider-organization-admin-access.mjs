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
assert.match(roleScope, /organization_admin.*location_manager/s);
assert.match(roleScope, /membership\.organization_wide_access === true/);

assert.match(createInvitation, /Doar ownerul organizatiei poate acorda rol de owner sau administrator/);
assert.match(createInvitation, /current\/future|actuale si viitoare|locatiile actuale si viitoare/i);
assert.match(createInvitation, /organization_wide_access: organizationWide/);
assert.match(createInvitation, /scope\.adminOrganizationIds/);

assert.match(acceptInvitation, /organization_role: organizationRole/);
assert.match(acceptInvitation, /storedProviderRoleForAccessRole\(accessRole\)/);
assert.match(acceptInvitation, /organization_wide_access: organizationWide/);
assert.match(acceptInvitation, /ProviderLocation\.filter\(\{ organization_id: organization\.id \}/);

assert.match(setAccess, /Administratorul organizatiei nu poate modifica owneri sau alti administratori/);
assert.match(setAccess, /Numai ownerul poate acorda rol de owner sau administrator/);
assert.match(setAccess, /Nu poti elimina ultimul owner activ al organizatiei/);
assert.match(setAccess, /organization_role: assignment\.role === ORGANIZATION_ADMIN_ROLE/);
assert.match(setAccess, /organization_wide_access: organizationWide/);

assert.match(members, /organization_admins_count/);
assert.match(members, /can_manage_privileged_roles/);
assert.match(members, /available_invitation_roles/);
assert.match(members, /ORGANIZATION_ADMIN_ROLE.*location_manager.*location_staff/s);

assert.match(revokeInvitation, /nu poate revoca invitatii pentru owneri sau administratori/);
assert.match(syncAccess, /Ownerii si administratorii/);
assert.match(syncAccess, /organization_role: wideUser\.accessRole === ORGANIZATION_ADMIN_ROLE/);
assert.match(expansion, /propagateOrganizationWideAccess/);
assert.match(expansion, /organization_wide_memberships/);
assert.match(expansion, /storedProviderRoleForAccessRole\(accessRole\)/);

assert.match(workspace, /organization_admin:/);
assert.match(workspace, /"organization\.manage_members"/);
assert.doesNotMatch(workspace.match(/organization_admin:\s*\[[\s\S]*?\],/s)?.[0] || '', /organization\.manage_settings|organization\.manage_locations|location\.archive|location\.request_closure/);
assert.match(workspace, /canManageSettings = Boolean\(isOrganizationOwner/);
assert.match(workspace, /current_actor_role/);
assert.match(workspace, /syncProviderOrganizationOwnerAccess/);

assert.match(accessUi, /Administrator organizație/);
assert.match(accessUi, /Gestionat de owner/);
assert.match(accessUi, /Numai ownerul poate acorda sau retrage roluri organizaționale/);
assert.match(accessUi, /Toate locațiile actuale și viitoare/);
assert.doesNotMatch(accessUi, /manager regional/i);
assert.match(labels, /organization_admin: "Administrator organizație"/);
assert.match(invitationUi, /organization_admin/);
assert.match(invitationUi, /locațiilor actuale și viitoare/);

console.log('Provider organization administrator access checks passed.');
