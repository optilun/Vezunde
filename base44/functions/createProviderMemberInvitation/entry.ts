import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function role(value) { if (value === 'owner') return 'organization_owner'; if (value === 'staff') return 'location_staff'; return ROLES.includes(value) ? value : ''; }
function email(value) { return String(value || '').trim().toLowerCase(); }
function ids(value) { return [...new Set((Array.isArray(value) ? value : (value ? [value] : [])).map((item) => String(item || '').trim()).filter(Boolean))]; }
function includesAll(set, values) { return values.every((id) => set.has(id)); }
function sameSet(a, b) { const aa = ids(a).sort(); const bb = ids(b).sort(); return aa.length === bb.length && aa.every((item, index) => item === bb[index]); }
function invLocIds(invitation) { return ids(invitation.invited_location_ids); }
function mask(value) { const [user, domain] = String(value || '').split('@'); return user && domain ? `${user.slice(0, 2)}***@${domain}` : ''; }
function safe(invitation) { return { id: invitation.id, organization_id: invitation.organization_id || null, invited_location_ids: invLocIds(invitation), invited_email_masked: mask(invitation.invited_email_normalized), proposed_role: invitation.proposed_role, invited_by_user_id: invitation.invited_by_user_id || '', status: invitation.status, expires_at: invitation.expires_at || null, created_date: invitation.created_date || null, updated_date: invitation.updated_date || null }; }
async function hash(tokenValue) { const bytes = new TextEncoder().encode(tokenValue); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function token() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function ownerScope(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const ownerLocationIds = new Set();
  const ownerOrganizationIds = new Set();
  for (const membership of memberships) {
    if (role(membership.role) !== 'organization_owner') continue;
    if (membership.location_id) ownerLocationIds.add(membership.location_id);
    if (membership.organization_id) ownerOrganizationIds.add(membership.organization_id);
  }
  for (const organizationId of ownerOrganizationIds) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    for (const location of locations) ownerLocationIds.add(location.id);
  }
  return { ownerLocationIds, ownerOrganizationIds };
}

async function loadLocations(svc, locationIds) {
  const locations = [];
  for (const id of locationIds) {
    const location = await svc.entities.ProviderLocation.get(id).catch(() => null);
    if (!location) return { error: 'Locatie invalida', status: 404 };
    if (location.claim_verification_status !== 'approved') return { error: 'Invitatiile sunt disponibile doar dupa aprobarea revendicarii', status: 403 };
    if ((location.profile_control_status || '') === 'suspended' || location.status === 'suspendata') return { error: 'Locatia este suspendata', status: 403 };
    locations.push(location);
  }
  return { locations };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const proposedRole = role(payload.proposed_role);
    const invitedEmail = email(payload.invited_email || payload.email || payload.invited_email_normalized);
    const locationIds = ids(payload.invited_location_ids || payload.location_ids || payload.location_id);
    if (!proposedRole) return res({ error: 'Rol invalid' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return res({ error: 'Email invalid' }, 400);
    if (locationIds.length === 0) return res({ error: 'Cel putin o locatie este obligatorie' }, 400);

    const scope = await ownerScope(svc, user.id);
    if (user.role !== 'admin' && !includesAll(scope.ownerLocationIds, locationIds)) {
      return res({ error: 'Doar ownerul organizatiei poate invita utilizatori' }, 403);
    }

    const loaded = await loadLocations(svc, locationIds);
    if (loaded.error) return res({ error: loaded.error }, loaded.status);
    const organizationIds = [...new Set(loaded.locations.map((location) => location.organization_id || ''))];
    if (organizationIds.length !== 1 || !organizationIds[0]) return res({ error: 'Locatiile trebuie sa apartina aceleiasi organizatii' }, 400);
    if (payload.organization_id && payload.organization_id !== organizationIds[0]) return res({ error: 'Organizatia nu corespunde locatiilor' }, 403);
    if (user.role !== 'admin' && !scope.ownerOrganizationIds.has(organizationIds[0])) return res({ error: 'Nu administrezi aceasta organizatie' }, 403);

    const existing = await svc.entities.ProviderMemberInvitation.filter({ invited_email_normalized: invitedEmail, status: 'pending' }, '-created_date', 50);
    if (existing.some((invitation) => invitation.proposed_role === proposedRole && sameSet(invLocIds(invitation), locationIds) && new Date(invitation.expires_at).getTime() > Date.now())) {
      return res({ error: 'Exista deja o invitatie activa pentru acest email si aceste locatii' }, 409);
    }

    const rawToken = token();
    const days = Math.min(Math.max(Number(payload.expires_in_days || 7), 1), 30);
    const invitation = await svc.entities.ProviderMemberInvitation.create({
      organization_id: organizationIds[0],
      invited_location_ids: locationIds,
      invited_email_normalized: invitedEmail,
      proposed_role: proposedRole,
      invited_by_user_id: user.id,
      status: 'pending',
      secure_token_hash: await hash(rawToken),
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    });
    const base = String(payload.invitation_base_url || payload.app_base_url || new URL(req.url).origin).replace(/\/$/, '');
    return res({ invitation: safe(invitation), invitation_token: rawToken, invitation_link: `${base}/accept-provider-invitation?token=${encodeURIComponent(rawToken)}`, email_sent: false });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});