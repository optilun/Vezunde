import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(value) { if (value === 'owner') return 'organization_owner'; if (value === 'staff') return 'location_staff'; return ROLES.includes(value) ? value : ''; }
function mask(email) { const [user, domain] = String(email || '').toLowerCase().split('@'); return user && domain ? `${user.slice(0, 2)}***@${domain}` : ''; }
function invLocIds(invitation) { return Array.isArray(invitation.invited_location_ids) ? invitation.invited_location_ids.filter(Boolean) : []; }
function safeInvitation(invitation) { return { id: invitation.id, organization_id: invitation.organization_id || null, invited_location_ids: invLocIds(invitation), invited_email_masked: mask(invitation.invited_email_normalized), proposed_role: invitation.proposed_role, invited_by_user_id: invitation.invited_by_user_id || '', status: invitation.status, expires_at: invitation.expires_at || null, accepted_by_user_id: invitation.accepted_by_user_id || '', accepted_at: invitation.accepted_at || null, revoked_by_user_id: invitation.revoked_by_user_id || '', revoked_at: invitation.revoked_at || null, created_date: invitation.created_date || null, updated_date: invitation.updated_date || null }; }
function safeMembership(membership, userInfo) { return { membership_id: membership.id, user_id: membership.user_id, user_email_masked: mask(userInfo?.email || ''), user_name: userInfo?.full_name || '', organization_id: membership.organization_id || null, location_id: membership.location_id, role: role(membership.role), status: membership.status === 'revoked' ? 'inactive' : membership.status, created_date: membership.created_date || null, updated_date: membership.updated_date || null }; }
async function userInfo(svc, userId) { return await svc.entities.User.get(userId).catch(() => null); }
function highest(roles) { if (roles.includes('organization_owner')) return 'organization_owner'; if (roles.includes('location_manager')) return 'location_manager'; if (roles.includes('location_staff')) return 'location_staff'; return ''; }

async function counters(svc, locationIds) {
  const byId = new Map();
  const perLocation = {};
  for (const locationId of locationIds) {
    const rows = await svc.entities.ProviderMembership.filter({ location_id: locationId, status: 'active' }, '-created_date', 500);
    const valid = rows.filter((membership) => role(membership.role));
    perLocation[locationId] = [...new Set(valid.map((membership) => membership.user_id))].length;
    for (const membership of valid) byId.set(membership.id, membership);
  }
  const rows = [...byId.values()];
  return {
    active_members_total: [...new Set(rows.map((membership) => membership.user_id))].length,
    active_members_per_location: perLocation,
    organization_owners_count: [...new Set(rows.filter((membership) => role(membership.role) === 'organization_owner').map((membership) => membership.user_id))].length,
    location_managers_count: [...new Set(rows.filter((membership) => role(membership.role) === 'location_manager').map((membership) => membership.user_id))].length,
    location_staff_count: [...new Set(rows.filter((membership) => role(membership.role) === 'location_staff').map((membership) => membership.user_id))].length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    await req.json().catch(() => ({}));

    const ownRows = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const own = ownRows.filter((membership) => role(membership.role) && membership.location_id);
    if (own.length === 0) return res({ mode: 'none', members: [], invitations: [], counters: { active_members_total: 0, active_members_per_location: {}, organization_owners_count: 0, location_managers_count: 0, location_staff_count: 0 }, can_manage_members: false, assigned_location_ids: [], manageable_location_ids: [], manageable_organization_ids: [] });

    const assigned = [...new Set(own.map((membership) => membership.location_id))];
    const ownerOrganizationIds = [...new Set(own.filter((membership) => role(membership.role) === 'organization_owner' && membership.organization_id).map((membership) => membership.organization_id))];
    const ownerLocationIds = [...new Set(own.filter((membership) => role(membership.role) === 'organization_owner').map((membership) => membership.location_id))];
    const manageableLocationIds = new Set(ownerLocationIds);
    for (const organizationId of ownerOrganizationIds) {
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      for (const location of locations) manageableLocationIds.add(location.id);
    }
    const manageable = [...manageableLocationIds];
    const canManage = manageable.length > 0;
    const visibleLocationIds = canManage ? manageable : assigned;

    const visibleRows = new Map();
    for (const locationId of visibleLocationIds) {
      const rows = await svc.entities.ProviderMembership.filter({ location_id: locationId }, '-created_date', 500);
      for (const membership of rows) {
        if (role(membership.role) && (canManage || membership.user_id === user.id)) visibleRows.set(membership.id, membership);
      }
    }

    const members = [];
    for (const membership of visibleRows.values()) members.push(safeMembership(membership, await userInfo(svc, membership.user_id)));
    const pendingInvitations = canManage
      ? (await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 500).catch(() => []))
        .filter((invitation) => ownerOrganizationIds.includes(invitation.organization_id) || invLocIds(invitation).some((id) => manageableLocationIds.has(id)))
        .map(safeInvitation)
      : [];
    const roleByLocation = Object.fromEntries(assigned.map((id) => [id, highest(own.filter((membership) => membership.location_id === id).map((membership) => role(membership.role)))]));

    return res({
      mode: 'provider_workspace',
      current_user_role_by_location: roleByLocation,
      assigned_location_ids: assigned,
      manageable_location_ids: manageable,
      manageable_organization_ids: ownerOrganizationIds,
      can_manage_members: canManage,
      members,
      invitations: pendingInvitations,
      counters: await counters(svc, visibleLocationIds),
    });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});