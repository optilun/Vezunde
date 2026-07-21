import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ['organization_owner', 'location_manager', 'location_staff'].includes(r) ? r : ''; }
async function isOwner(svc, userId, locId) { const ms = await svc.entities.ProviderMembership.filter({ user_id: userId, location_id: locId, status: 'active' }); return ms.some((m) => role(m.role) === 'organization_owner'); }

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const m = await svc.entities.ProviderMembership.get(String(p.membership_id || '')).catch(() => null);
    if (!m) return res({ error: 'Membrul nu exista' }, 404);
    if (!(await isOwner(svc, user.id, m.location_id))) return res({ error: 'Doar ownerul locatiei poate reactiva membri' }, 403);
    if (!role(m.role)) return res({ error: 'Rol invalid' }, 400);
    const loc = await svc.entities.ProviderLocation.get(m.location_id).catch(() => null);
    if (!loc || loc.claim_verification_status !== 'approved') return res({ error: 'Locatia nu este eligibila' }, 403);
    await svc.entities.ProviderMembership.update(m.id, { status: 'active', organization_id: loc.organization_id || m.organization_id || null, reactivated_by_user_id: user.id, reactivated_at: new Date().toISOString() });
    return res({ success: true });
  } catch (error) { return res({ error: error.message }, 500); }
}
