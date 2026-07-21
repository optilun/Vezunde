import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ROLES.includes(r) ? r : ''; }
function locIds(inv) { return Array.isArray(inv.invited_location_ids) ? inv.invited_location_ids.filter(Boolean) : []; }
function mask(email) { const [u, d] = String(email || '').toLowerCase().split('@'); return u && d ? `${u.slice(0, 2)}***@${d}` : ''; }
function safe(inv) { return { id: inv.id, organization_id: inv.organization_id || null, invited_location_ids: locIds(inv), invited_email_masked: mask(inv.invited_email_normalized), proposed_role: inv.proposed_role, invited_by_user_id: inv.invited_by_user_id || '', status: inv.status, expires_at: inv.expires_at || null, accepted_by_user_id: inv.accepted_by_user_id || '', accepted_at: inv.accepted_at || null, revoked_by_user_id: inv.revoked_by_user_id || '', revoked_at: inv.revoked_at || null, created_date: inv.created_date || null, updated_date: inv.updated_date || null }; }
async function access(svc, userId) {
  const ms = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 200);
  const managerLocs = new Set();
  for (const m of ms) if (['organization_owner', 'location_manager'].includes(role(m.role)) && m.location_id) managerLocs.add(m.location_id);
  return managerLocs;
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const allowedLocs = await access(svc, user.id);
    if (allowedLocs.size === 0) return res({ error: 'Nu ai dreptul sa vezi invitatii' }, 403);
    const validStatuses = ['draft', 'pending', 'accepted', 'expired', 'revoked'];
    const statuses = Array.isArray(p.statuses) ? p.statuses.filter((s) => validStatuses.includes(s)) : (validStatuses.includes(p.status) ? [p.status] : ['draft', 'pending']);
    const out = [];
    for (const status of statuses) {
      const rows = await svc.entities.ProviderMemberInvitation.filter({ status }, '-created_date', 200);
      out.push(...rows.filter((inv) => locIds(inv).some((id) => allowedLocs.has(id))).map(safe));
    }
    return res({ invitations: out });
  } catch (error) { return res({ error: error.message }, 500); }
}
