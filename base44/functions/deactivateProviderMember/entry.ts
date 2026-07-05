import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ['organization_owner', 'location_manager', 'location_staff'].includes(r) ? r : ''; }
async function isOwner(svc, userId, locId) { const ms = await svc.entities.ProviderMembership.filter({ user_id: userId, location_id: locId, status: 'active' }); return ms.some((m) => role(m.role) === 'organization_owner'); }
async function ownerCount(svc, locId, excludeId = '') { const rows = await svc.entities.ProviderMembership.filter({ location_id: locId, status: 'active' }, '-created_date', 200); return rows.filter((m) => m.id !== excludeId && role(m.role) === 'organization_owner').length; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const m = await svc.entities.ProviderMembership.get(String(p.membership_id || '')).catch(() => null);
    if (!m) return res({ error: 'Membrul nu exista' }, 404);
    if (!(await isOwner(svc, user.id, m.location_id))) return res({ error: 'Doar ownerul locatiei poate dezactiva membri' }, 403);
    if (m.user_id === user.id) return res({ error: 'Nu iti poti dezactiva propriul acces' }, 403);
    if (role(m.role) === 'organization_owner' && await ownerCount(svc, m.location_id, m.id) === 0) return res({ error: 'Nu poti elimina ultimul owner activ al locatiei' }, 400);
    await svc.entities.ProviderMembership.update(m.id, { status: 'inactive', deactivated_by_user_id: user.id, deactivated_at: new Date().toISOString() });
    return res({ success: true });
  } catch (error) { return res({ error: error.message }, 500); }
});