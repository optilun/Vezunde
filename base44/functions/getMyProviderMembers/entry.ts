import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  providerMembershipAccessRole,
} from '../../../shared/providerOrganizationOwnerScope.js';

const ACCESS_ROLES = [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function role(value) {
  if (value === 'owner') return ORGANIZATION_OWNER_ROLE;
  if (value === 'admin') return ORGANIZATION_ADMIN_ROLE;
  if (value === 'manager') return 'location_manager';
  if (value === 'staff') return 'location_staff';
  return ACCESS_ROLES.includes(value) ? value : '';
}
function mask(email) { const [user, domain] = String(email || '').toLowerCase().split('@'); return user && domain ? `${user.slice(0, 2)}***@${domain}` : ''; }
function invLocIds(invitation) { return Array.isArray(invitation.invited_location_ids) ? invitation.invited_location_ids.filter(Boolean) : []; }
function safeInvitation(invitation) {
  return {
    id: invitation.id,
    organization_id: invitation.organization_id || null,
    invited_location_ids: invLocIds(invitation),
    invited_email_masked: mask(invitation.invited_email_normalized),
    proposed_role: role(invitation.proposed_role),
    organization_wide_access: invitation.organization_wide_access === true,
    invited_by_user_id: invitation.invited_by_user_id || '',
    status: invitation.status,
    expires_at: invitation.expires_at || null,
    delivery_status: invitation.delivery_status || 'pending',
    delivery_provider: invitation.delivery_provider || '',
    last_delivery_attempt_at: invitation.last_delivery_attempt_at || null,
    accepted_by_user_id: invitation.accepted_by_user_id || '',
    accepted_at: invitation.accepted_at || null,
    revoked_by_user_id: invitation.revoked_by_user_id || '',
    revoked_at: invitation.revoked_at || null,
    created_date: invitation.created_date || null,
    updated_date: invitation.updated_date || null,
  };
}
function safeMembership(membership, userInfo, organizationId = '') {
  return {
    membership_id: membership.id,
    user_id: membership.user_id,
    user_email_masked: mask(userInfo?.email || ''),
    user_name: userInfo?.full_name || '',
    organization_id: membership.organization_id || organizationId || null,
    location_id: membership.location_id,
    role: providerMembershipAccessRole(membership),
    stored_role: membership.role || '',
    organization_role: membership.organization_role || 'none',
    organization_wide_access: membership.organization_wide_access === true,
    status: membership.status === 'revoked' ? 'inactive' : membership.status,
    created_date: membership.created_date || null,
    updated_date: membership.updated_date || null,
  };
}
async function userInfo(svc, userId) { return await svc.entities.User.get(userId).catch(() => null); }
function highest(roles) {
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  if (roles.includes('location_manager')) return 'location_manager';
  if (roles.includes('location_staff')) return 'location_staff';
  return '';
}

async function counters(svc, locationIds) {
  const byId = new Map();
  const perLocation = {};
  for (const locationId of locationIds) {
    const rows = await svc.entities.ProviderMembership.filter({ location_id: locationId, status: 'active' }, '-created_date', 500);
    const valid = rows.filter((membership) => role(providerMembershipAccessRole(membership)));
    perLocation[locationId] = [...new Set(valid.map((membership) => membership.user_id))].length;
    for (const membership of valid) byId.set(membership.id, membership);
  }
  const rows = [...byId.values()];
  return {
    active_members_total: [...new Set(rows.map((membership) => membership.user_id))].length,
    active_members_per_location: perLocation,
    organization_owners_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === ORGANIZATION_OWNER_ROLE).map((membership) => membership.user_id))].length,
    organization_admins_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === ORGANIZATION_ADMIN_ROLE).map((membership) => membership.user_id))].length,
    location_managers_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === 'location_manager').map((membership) => membership.user_id))].length,
    location_staff_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === 'location_staff').map((membership) => membership.user_id))].length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const requestedOrganizationId = clean(payload.organization_id);

    const ownRows = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const own = ownRows.filter((membership) => role(providerMembershipAccessRole(membership)) && membership.location_id);
    if (own.length === 0) {
      return res({
        mode: 'none', members: [], invitations: [],
        counters: { active_members_total: 0, active_members_per_location: {}, organization_owners_count: 0, organization_admins_count: 0, location_managers_count: 0, location_staff_count: 0 },
        current_actor_role: '', can_manage_members: false, can_manage_privileged_roles: false,
        available_invitation_roles: [], assigned_location_ids: [], manageable_location_ids: [], manageable_organization_ids: [],
      });
    }

    const organizationIdByLocation = new Map();
    const organizationIdByMembership = new Map();
    for (const membership of own) {
      let organizationId = clean(membership.organization_id);
      if (!organizationId) {
        const location = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
        organizationId = clean(location?.organization_id);
      }
      if (organizationId) organizationIdByLocation.set(membership.location_id, organizationId);
      organizationIdByMembership.set(membership.id, organizationId);
    }

    const actorOrganizations = new Map();
    for (const membership of own) {
      const accessRole = providerMembershipAccessRole(membership);
      if (![ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE].includes(accessRole)) continue;
      const organizationId = organizationIdByMembership.get(membership.id);
      if (!organizationId) continue;
      const previous = actorOrganizations.get(organizationId) || '';
      actorOrganizations.set(organizationId, highest([previous, accessRole].filter(Boolean)));
    }
    if (requestedOrganizationId && !actorOrganizations.has(requestedOrganizationId) && user.role !== 'admin') {
      return res({ error: 'Nu ai dreptul sa gestionezi utilizatorii acestei organizatii' }, 403);
    }

    const scopedOwn = requestedOrganizationId
      ? own.filter((membership) => organizationIdByMembership.get(membership.id) === requestedOrganizationId)
      : own;
    const assigned = [...new Set(scopedOwn.map((membership) => membership.location_id))];
    const manageableOrganizationIds = requestedOrganizationId ? [requestedOrganizationId] : [...actorOrganizations.keys()];
    const manageableLocationIds = new Set();
    for (const organizationId of manageableOrganizationIds) {
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      for (const location of locations) {
        manageableLocationIds.add(location.id);
        organizationIdByLocation.set(location.id, organizationId);
      }
    }
    const manageable = [...manageableLocationIds];
    const canManage = manageable.length > 0;
    const visibleLocationIds = canManage ? manageable : assigned;

    const visibleRows = new Map();
    for (const locationId of visibleLocationIds) {
      const rows = await svc.entities.ProviderMembership.filter({ location_id: locationId }, '-created_date', 500);
      for (const membership of rows) {
        if (role(providerMembershipAccessRole(membership)) && (canManage || membership.user_id === user.id)) visibleRows.set(membership.id, membership);
      }
    }

    const members = [];
    const userCache = new Map();
    for (const membership of visibleRows.values()) {
      if (!userCache.has(membership.user_id)) userCache.set(membership.user_id, await userInfo(svc, membership.user_id));
      members.push(safeMembership(membership, userCache.get(membership.user_id), organizationIdByLocation.get(membership.location_id)));
    }
    const pendingInvitations = canManage
      ? (await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 500).catch(() => []))
        .filter((invitation) => manageableOrganizationIds.includes(invitation.organization_id) || invLocIds(invitation).some((id) => manageableLocationIds.has(id)))
        .map(safeInvitation)
      : [];
    const roleByLocation = Object.fromEntries(assigned.map((id) => [id, highest(scopedOwn.filter((membership) => membership.location_id === id).map(providerMembershipAccessRole))]));
    const currentActorRole = requestedOrganizationId
      ? (actorOrganizations.get(requestedOrganizationId) || '')
      : highest([...actorOrganizations.values()]);
    const canManagePrivilegedRoles = currentActorRole === ORGANIZATION_OWNER_ROLE || user.role === 'admin';

    return res({
      mode: 'provider_workspace',
      current_organization_id: requestedOrganizationId || null,
      current_actor_role: currentActorRole,
      current_user_role_by_location: roleByLocation,
      assigned_location_ids: assigned,
      manageable_location_ids: manageable,
      manageable_organization_ids: manageableOrganizationIds,
      can_manage_members: canManage,
      can_manage_privileged_roles: canManagePrivilegedRoles,
      available_invitation_roles: canManagePrivilegedRoles
        ? [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff']
        : (currentActorRole === ORGANIZATION_ADMIN_ROLE ? ['location_manager', 'location_staff'] : []),
      members,
      invitations: pendingInvitations,
      counters: await counters(svc, visibleLocationIds),
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
