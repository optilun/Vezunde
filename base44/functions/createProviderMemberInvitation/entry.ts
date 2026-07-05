import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(r) { if (r === 'owner') return 'organization_owner'; if (r === 'staff') return 'location_staff'; return ROLES.includes(r) ? r : ''; }
function email(v) { return String(v || '').trim().toLowerCase(); }
function ids(v) { return [...new Set((Array.isArray(v) ? v : (v ? [v] : [])).map((x) => String(x || '').trim()).filter(Boolean))]; }
function includesAll(set, arr) { return arr.every((id) => set.has(id)); }
function sameSet(a, b) { const aa = ids(a).sort(); const bb = ids(b).sort(); return aa.length === bb.length && aa.every((x, i) => x === bb[i]); }
function invLocIds(inv) { return ids(inv.invited_location_ids); }
function mask(e) { const [u, d] = String(e || '').split('@'); return u && d ? `${u.slice(0, 2)}***@${d}` : ''; }
function safe(inv) { return { id: inv.id, organization_id: inv.organization_id || null, invited_location_ids: invLocIds(inv), invited_email_masked: mask(inv.invited_email_normalized), proposed_role: inv.proposed_role, invited_by_user_id: inv.invited_by_user_id || '', status: inv.status, expires_at: inv.expires_at || null, created_date: inv.created_date || null, updated_date: inv.updated_date || null }; }
async function hash(token) { const bytes = new TextEncoder().encode(token); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function token() { const b = new Uint8Array(32); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function actorScope(svc, userId) {
  const ms = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 200);
  const ownerLocs = new Set(); const managerLocs = new Set();
  for (const m of ms) { const r = role(m.role); if (r === 'organization_owner') ownerLocs.add(m.location_id); if (r === 'location_manager') managerLocs.add(m.location_id); }
  return { ownerLocs, managerLocs };
}
async function loadLocs(svc, locIds) {
  const locs = [];
  for (const id of locIds) {
    const loc = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!loc) return { error: 'Locatie invalida', status: 404 };
    if (loc.claim_verification_status !== 'approved') return { error: 'Invitatiile sunt disponibile doar dupa aprobarea revendicarii', status: 403 };
    if ((loc.profile_control_status || '') === 'suspended' || loc.status === 'suspendata') return { error: 'Locatia este suspendata', status: 403 };
    locs.push(loc);
  }
  return { locs };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const proposedRole = role(p.proposed_role);
    const invitedEmail = email(p.invited_email || p.email || p.invited_email_normalized);
    const locIds = ids(p.invited_location_ids || p.location_ids || p.location_id);
    if (!proposedRole) return res({ error: 'Rol invalid' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return res({ error: 'Email invalid' }, 400);
    if (locIds.length === 0) return res({ error: 'Cel putin o locatie este obligatorie' }, 400);
    const scope = await actorScope(svc, user.id);
    if (proposedRole === 'organization_owner' || proposedRole === 'location_manager') {
      if (!includesAll(scope.ownerLocs, locIds)) return res({ error: 'Doar ownerul poate invita owneri sau manageri in locatiile sale' }, 403);
    } else if (!includesAll(scope.ownerLocs, locIds) && !includesAll(scope.managerLocs, locIds)) return res({ error: 'Nu poti invita staff in afara locatiilor administrate' }, 403);
    const loaded = await loadLocs(svc, locIds);
    if (loaded.error) return res({ error: loaded.error }, loaded.status);
    const orgs = [...new Set(loaded.locs.map((l) => l.organization_id || ''))];
    if (orgs.length !== 1) return res({ error: 'Locatiile trebuie sa apartina aceluiasi provider' }, 400);
    if (p.organization_id && p.organization_id !== orgs[0]) return res({ error: 'Organizatia nu corespunde locatiilor' }, 403);
    const existing = await svc.entities.ProviderMemberInvitation.filter({ invited_email_normalized: invitedEmail, status: 'pending' }, '-created_date', 50);
    if (existing.some((inv) => inv.proposed_role === proposedRole && sameSet(invLocIds(inv), locIds) && new Date(inv.expires_at).getTime() > Date.now())) return res({ error: 'Exista deja o invitatie activa pentru acest email si aceasta locatie' }, 409);
    const rawToken = token();
    const days = Math.min(Math.max(Number(p.expires_in_days || 7), 1), 30);
    const inv = await svc.entities.ProviderMemberInvitation.create({ organization_id: orgs[0] || null, invited_location_ids: locIds, invited_email_normalized: invitedEmail, proposed_role: proposedRole, invited_by_user_id: user.id, status: 'pending', secure_token_hash: await hash(rawToken), expires_at: new Date(Date.now() + days * 86400000).toISOString() });
    const base = String(p.invitation_base_url || p.app_base_url || new URL(req.url).origin).replace(/\/$/, '');
    return res({ invitation: safe(inv), invitation_token: rawToken, invitation_link: `${base}/accept-provider-invitation?token=${encodeURIComponent(rawToken)}`, email_sent: false });
  } catch (error) { return res({ error: error.message }, 500); }
});