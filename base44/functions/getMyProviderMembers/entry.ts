import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ROLES.includes(r) ? r : ''; }
function mask(email) { const [u, d] = String(email || '').toLowerCase().split('@'); return u && d ? `${u.slice(0, 2)}***@${d}` : ''; }
function invLocIds(inv) { return Array.isArray(inv.invited_location_ids) ? inv.invited_location_ids.filter(Boolean) : []; }
function safeInvitation(inv) { return { id: inv.id, organization_id: inv.organization_id || null, invited_location_ids: invLocIds(inv), invited_email_masked: mask(inv.invited_email_normalized), proposed_role: inv.proposed_role, invited_by_user_id: inv.invited_by_user_id || '', status: inv.status, expires_at: inv.expires_at || null, accepted_by_user_id: inv.accepted_by_user_id || '', accepted_at: inv.accepted_at || null, revoked_by_user_id: inv.revoked_by_user_id || '', revoked_at: inv.revoked_at || null, created_date: inv.created_date || null, updated_date: inv.updated_date || null }; }
function safeMembership(m, userInfo) { return { membership_id: m.id, user_id: m.user_id, user_email_masked: mask(userInfo?.email || ''), user_name: userInfo?.full_name || '', organization_id: m.organization_id || null, location_id: m.location_id, role: role(m.role), status: m.status === 'revoked' ? 'inactive' : m.status, created_date: m.created_date || null, updated_date: m.updated_date || null }; }
async function userInfo(svc, userId) { return await svc.entities.User.get(userId).catch(() => null); }
function highest(roles) { if (roles.includes('organization_owner')) return 'organization_owner'; if (roles.includes('location_manager')) return 'location_manager'; if (roles.includes('location_staff')) return 'location_staff'; return ''; }
async function counters(svc, locIds) {
  const byId = new Map(); const perLocation = {};
  for (const locId of locIds) {
    const rows = await svc.entities.ProviderMembership.filter({ location_id: locId, status: 'active' }, '-created_date', 200);
    const valid = rows.filter((m) => role(m.role));
    perLocation[locId] = [...new Set(valid.map((m) => m.user_id))].length;
    for (const m of valid) byId.set(m.id, m);
  }
  const rows = [...byId.values()];
  return {
    active_members_total: [...new Set(rows.map((m) => m.user_id))].length,
    active_members_per_location: perLocation,
    organization_owners_count: [...new Set(rows.filter((m) => role(m.role) === 'organization_owner').map((m) => m.user_id))].length,
    location_managers_count: [...new Set(rows.filter((m) => role(m.role) === 'location_manager').map((m) => m.user_id))].length,
    location_staff_count: [...new Set(rows.filter((m) => role(m.role) === 'location_staff').map((m) => m.user_id))].length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    await req.json().catch(() => ({}));

    const ownRows = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 200);
    const own = ownRows.filter((m) => role(m.role) && m.location_id);
    if (own.length === 0) return res({ mode: 'none', members: [], invitations: [], counters: { active_members_total: 0, active_members_per_location: {}, organization_owners_count: 0, location_managers_count: 0, location_staff_count: 0 }, can_manage_members: false, assigned_location_ids: [] });

    const assigned = [...new Set(own.map((m) => m.location_id))];
    const manageable = [...new Set(own.filter((m) => ['organization_owner', 'location_manager'].includes(role(m.role))).map((m) => m.location_id))];
    const visibleLocs = manageable.length ? manageable : assigned;
    const visibleRows = new Map();
    for (const locId of visibleLocs) {
      const rows = await svc.entities.ProviderMembership.filter({ location_id: locId }, '-created_date', 200);
      for (const m of rows) if (role(m.role) && (manageable.length || m.user_id === user.id)) visibleRows.set(m.id, m);
    }
    const members = [];
    for (const m of visibleRows.values()) members.push(safeMembership(m, await userInfo(svc, m.user_id)));
    const pendingInvitations = manageable.length
      ? (await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 200).catch(() => [])).filter((inv) => invLocIds(inv).some((id) => manageable.includes(id))).map(safeInvitation)
      : [];
    const roleByLocation = Object.fromEntries(assigned.map((id) => [id, highest(own.filter((m) => m.location_id === id).map((m) => role(m.role)))]));
    return res({
      mode: 'provider_workspace',
      current_user_role_by_location: roleByLocation,
      assigned_location_ids: assigned,
      manageable_location_ids: manageable,
      can_manage_members: manageable.length > 0,
      members,
      invitations: pendingInvitations,
      counters: await counters(svc, visibleLocs),
    });
  } catch (error) { return res({ error: error.message }, 500); }
});