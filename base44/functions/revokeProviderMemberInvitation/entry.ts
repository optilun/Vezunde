import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ROLES.includes(r) ? r : ''; }
function ids(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function includesAll(set, arr) { return arr.every((id) => set.has(id)); }
async function scope(svc, userId) { const ms = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 200); const owner = new Set(); const manager = new Set(); for (const m of ms) { const r = role(m.role); if (r === 'organization_owner') owner.add(m.location_id); if (r === 'location_manager') manager.add(m.location_id); } return { owner, manager }; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const inv = await svc.entities.ProviderMemberInvitation.get(String(p.invitation_id || '')).catch(() => null);
    if (!inv) return res({ error: 'Invitatia nu exista' }, 404);
    if (!['draft', 'pending'].includes(inv.status)) return res({ error: 'Invitatia nu mai poate fi revocata' }, 400);
    const locs = ids(inv.invited_location_ids);
    const s = await scope(svc, user.id);
    if (inv.proposed_role === 'location_staff') {
      if (!includesAll(s.owner, locs) && !includesAll(s.manager, locs)) return res({ error: 'Nu poti revoca aceasta invitatie' }, 403);
    } else if (!includesAll(s.owner, locs)) return res({ error: 'Doar ownerul poate revoca aceasta invitatie' }, 403);
    await svc.entities.ProviderMemberInvitation.update(inv.id, { status: 'revoked', revoked_by_user_id: user.id, revoked_at: new Date().toISOString() });
    return res({ success: true });
  } catch (error) { return res({ error: error.message }, 500); }
});