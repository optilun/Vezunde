import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function res(body, status = 200) { return Response.json(body, { status }); }
function normEmail(v) { return String(v || '').trim().toLowerCase(); }
function ids(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function safe(m) { return { membership_id: m.id, user_id: m.user_id, organization_id: m.organization_id || null, location_id: m.location_id, role: m.role, status: m.status }; }
async function hash(token) { const bytes = new TextEncoder().encode(token); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function approvedLocs(svc, locIds) { const out = []; for (const id of locIds) { const loc = await svc.entities.ProviderLocation.get(id).catch(() => null); if (!loc) return { error: 'Locatie invalida', status: 404 }; if (loc.claim_verification_status !== 'approved') return { error: 'Locatia nu este eligibila', status: 403 }; out.push(loc); } return { locs: out }; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const token = String(new URL(req.url).searchParams.get('token') || p.token || p.invitation_token || '').trim();
    if (!token) return res({ error: 'Token obligatoriu' }, 400);
    if (user.email_verified === false || user.email_verified === 'false') return res({ error: 'Emailul contului trebuie verificat' }, 403);
    const rows = await svc.entities.ProviderMemberInvitation.filter({ secure_token_hash: await hash(token) }, '-created_date', 2);
    const inv = rows[0] || null;
    if (!inv) return res({ error: 'Invitatie invalida' }, 404);
    if (inv.status !== 'pending') return res({ error: 'Invitatia nu mai este activa' }, 400);
    if (new Date(inv.expires_at).getTime() <= Date.now()) { await svc.entities.ProviderMemberInvitation.update(inv.id, { status: 'expired' }); return res({ error: 'Invitatia a expirat' }, 400); }
    if (normEmail(user.email) !== inv.invited_email_normalized) return res({ error: 'Invitatia este pentru alt email' }, 403);
    const loaded = await approvedLocs(svc, ids(inv.invited_location_ids));
    if (loaded.error) return res({ error: loaded.error }, loaded.status);
    const memberships = [];
    for (const loc of loaded.locs) {
      const organizationId = inv.organization_id || loc.organization_id || null;
      const existing = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: loc.id }, '-created_date', 10);
      if (existing[0]) {
        await svc.entities.ProviderMembership.update(existing[0].id, { organization_id: organizationId, role: inv.proposed_role, status: 'active', invitation_id: inv.id, reactivated_by_user_id: user.id, reactivated_at: new Date().toISOString() });
        memberships.push({ ...existing[0], organization_id: organizationId, role: inv.proposed_role, status: 'active' });
      } else {
        memberships.push(await svc.entities.ProviderMembership.create({ user_id: user.id, organization_id: organizationId, location_id: loc.id, role: inv.proposed_role, status: 'active', invitation_id: inv.id }));
      }
    }
    await svc.entities.ProviderMemberInvitation.update(inv.id, { status: 'accepted', accepted_by_user_id: user.id, accepted_at: new Date().toISOString() });
    return res({ success: true, memberships: memberships.map(safe) });
  } catch (error) { return res({ error: error.message }, 500); }
});