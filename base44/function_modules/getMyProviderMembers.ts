import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';

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
function safeMembership(membership, userInfo, organizationId = '', resolution = {}) {
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
    organization_wide_access: membershipHasOrganizationWideAccess(membership, resolution),
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

async function counters(svc, locationIds, resolutionByOrganization, organizationIdByLocation) {
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
    global_owners_count: [...new Set(rows.filter((membership) => {
      const organizationId = organizationIdByLocation.get(membership.location_id) || membership.organization_id;
      return providerMembershipAccessRole(membership) === ORGANIZATION_OWNER_ROLE
        && membershipHasOrganizationWideAccess(membership, resolutionByOrganization.get(organizationId));
    }).map((membership) => membership.user_id))].length,
    location_managers_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === 'location_manager').map((membership) => membership.user_id))].length,
    location_staff_count: [...new Set(rows.filter((membership) => providerMembershipAccessRole(membership) === 'location_staff').map((membership) => membership.user_id))].length,
  };
}

export async function handle(req: Request) {
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
        counters: { active_members_total: 0, active_members_per_location: {}, organization_owners_count: 0, organization_admins_count: 0, global_owners_count: 0, location_managers_count: 0, location_staff_count: 0 },
        current_actor_role: '', can_manage_members: false, can_manage_privileged_roles: false, can_grant_organization_admin: false,
        available_invitation_roles: [], assigned_location_ids: [], manageable_location_ids: [], manageable_organization_ids: [],
      });
    }

    const organizationIdByLocation = new Map();
    const organizationIdByMembership = new Map();
    const resolutionByOrganization = new Map();
    const locationsByOrganization = new Map();
    for (const membership of own) {
      let organizationId = clean(membership.organization_id);
      if (!organizationId) {
        const location = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
        organizationId = clean(location?.organization_id);
      }
      if (organizationId) organizationIdByLocation.set(membership.location_id, organizationId);
      organizationIdByMembership.set(membership.id, organizationId);
    }

    const managementByOrganization = new Map();
    for (const membership of own) {
      const accessRole = providerMembershipAccessRole(membership);
      if (![ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE].includes(accessRole)) continue;
      const organizationId = organizationIdByMembership.get(membership.id);
      if (!organizationId) continue;
      if (!resolutionByOrganization.has(organizationId)) resolutionByOrganization.set(organizationId, await loadOrganizationOwnerScopeResolution(svc, organizationId));
      const current = managementByOrganization.get(organizationId) || {
        role: '', wideOwner: false, organizationAdmin: false, ownerLocationIds: new Set(), manageableLocationIds: new Set(),
      };
      if (accessRole === ORGANIZATION_OWNER_ROLE) {
        current.role = ORGANIZATION_OWNER_ROLE;
        current.ownerLocationIds.add(membership.location_id);
        current.manageableLocationIds.add(membership.location_id);
        if (membershipHasOrganizationWideAccess(membership, resolutionByOrganization.get(organizationId))) current.wideOwner = true;
      }
      if (accessRole === ORGANIZATION_ADMIN_ROLE && membership.organization_wide_access === true) {
        if (current.role !== ORGANIZATION_OWNER_ROLE) current.role = ORGANIZATION_ADMIN_ROLE;
        current.organizationAdmin = true;
      }
      managementByOrganization.set(organizationId, current);
    }

    for (const [organizationId, management] of managementByOrganization.entries()) {
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      locationsByOrganization.set(organizationId, locations);
      for (const location of locations) organizationIdByLocation.set(location.id, organizationId);
      if (management.wideOwner || management.organizationAdmin) for (const location of locations) management.manageableLocationIds.add(location.id);
    }

    if (requestedOrganizationId && !managementByOrganization.has(requestedOrganizationId) && user.role !== 'admin') {
      return res({ error: 'Nu ai dreptul sa gestionezi utilizatorii acestei organizatii' }, 403);
    }

    const relevantOrganizationIds = requestedOrganizationId ? [requestedOrganizationId] : [...managementByOrganization.keys()];
    const scopedOwn = requestedOrganizationId
      ? own.filter((membership) => organizationIdByMembership.get(membership.id) === requestedOrganizationId)
      : own;
    const assigned = [...new Set(scopedOwn.map((membership) => membership.location_id))];
    const manageableLocationIds = new Set();
    for (const organizationId of relevantOrganizationIds) {
      const management = managementByOrganization.get(organizationId);
      for (const locationId of management?.manageableLocationIds || []) manageableLocationIds.add(locationId);
    }
    const manageable = [...manageableLocationIds];
    const canManage = manageable.length > 0;

    const visibleRows = new Map();
    for (const locationId of canManage ? manageable : assigned) {
      const rows = await svc.entities.ProviderMembership.filter({ location_id: locationId }, '-created_date', 500);
      for (const membership of rows) {
        if (role(providerMembershipAccessRole(membership)) && (canManage || membership.user_id === user.id)) visibleRows.set(membership.id, membership);
      }
    }

    const members = [];
    const userCache = new Map();
    for (const membership of visibleRows.values()) {
      if (!userCache.has(membership.user_id)) userCache.set(membership.user_id, await userInfo(svc, membership.user_id));
      const organizationId = organizationIdByLocation.get(membership.location_id) || membership.organization_id || '';
      if (!resolutionByOrganization.has(organizationId)) resolutionByOrganization.set(organizationId, await loadOrganizationOwnerScopeResolution(svc, organizationId));
      members.push(safeMembership(membership, userCache.get(membership.user_id), organizationId, resolutionByOrganization.get(organizationId)));
    }

    const pendingInvitations = canManage
      ? (await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 500).catch(() => []))
        .filter((invitation) => relevantOrganizationIds.includes(invitation.organization_id) && invLocIds(invitation).some((id) => manageableLocationIds.has(id)))
        .map(safeInvitation)
      : [];
    const roleByLocation = Object.fromEntries(assigned.map((id) => [id, highest(scopedOwn.filter((membership) => membership.location_id === id).map(providerMembershipAccessRole))]));
    const selectedManagement = requestedOrganizationId ? managementByOrganization.get(requestedOrganizationId) : null;
    const currentActorRole = selectedManagement?.role || highest([...managementByOrganization.values()].map((item) => item.role));
    const anyOwner = currentActorRole === ORGANIZATION_OWNER_ROLE || user.role === 'admin';
    const wideOwner = user.role === 'admin' || Boolean(selectedManagement?.wideOwner || (!requestedOrganizationId && [...managementByOrganization.values()].some((item) => item.wideOwner)));
    const availableRoles = wideOwner
      ? [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff']
      : (anyOwner ? [ORGANIZATION_OWNER_ROLE, 'location_manager', 'location_staff'] : (currentActorRole === ORGANIZATION_ADMIN_ROLE ? ['location_manager', 'location_staff'] : []));
    const visibleLocationIds = canManage ? manageable : assigned;

    return res({
      mode: 'provider_workspace',
      current_organization_id: requestedOrganizationId || null,
      current_actor_role: currentActorRole,
      current_actor_wide_access: wideOwner || currentActorRole === ORGANIZATION_ADMIN_ROLE,
      current_user_role_by_location: roleByLocation,
      assigned_location_ids: assigned,
      manageable_location_ids: manageable,
      manageable_organization_ids: relevantOrganizationIds,
      can_manage_members: canManage,
      can_manage_privileged_roles: anyOwner,
      can_grant_organization_admin: wideOwner,
      available_invitation_roles: availableRoles,
      members,
      invitations: pendingInvitations,
      counters: await counters(svc, visibleLocationIds, resolutionByOrganization, organizationIdByLocation),
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
}
