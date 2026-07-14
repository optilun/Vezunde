import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function res(body, status = 200) { return Response.json(body, { status }); }
function normEmail(value) { return String(value || '').trim().toLowerCase(); }
function ids(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}
function safeMembership(membership) {
  return {
    membership_id: membership.id,
    user_id: membership.user_id,
    organization_id: membership.organization_id || null,
    location_id: membership.location_id,
    role: membership.role,
    status: membership.status,
  };
}
function safeLocation(location) {
  return {
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    city: location.locality_name || location.city || '',
    county: location.county_name || location.county || '',
    address: location.address || '',
  };
}
function invitationView(invitation, organization, locations) {
  return {
    id: invitation.id,
    organization: {
      id: organization.id,
      name: organization.public_display_name || organization.name || 'Organizatie',
    },
    proposed_role: invitation.proposed_role,
    locations: locations.map(safeLocation),
    expires_at: invitation.expires_at || null,
  };
}
async function hash(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function loadContext(svc, invitation) {
  if (!ROLES.includes(invitation.proposed_role)) return { error: 'Rolul invitatiei este invalid', status: 400 };
  const locationIds = ids(invitation.invited_location_ids);
  if (locationIds.length === 0) return { error: 'Invitatia nu contine locatii valide', status: 400 };

  const organization = invitation.organization_id
    ? await svc.entities.ProviderOrganization.get(invitation.organization_id).catch(() => null)
    : null;
  if (!organization) return { error: 'Organizatia invitatiei nu mai este disponibila', status: 404 };
  if (organization.status === 'inactiva') return { error: 'Organizatia nu este activa', status: 403 };

  const locations = [];
  for (const locationId of locationIds) {
    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return { error: 'Una dintre locatiile invitatiei nu mai este disponibila', status: 404 };
    if (location.organization_id !== organization.id) return { error: 'Locatia nu apartine organizatiei invitatiei', status: 403 };
    if (location.claim_verification_status !== 'approved') return { error: 'Una dintre locatii nu mai este eligibila pentru acces', status: 403 };
    if (location.profile_control_status === 'suspended' || location.status === 'suspendata' || location.active_status === 'inactiva') {
      return { error: 'Una dintre locatii nu este activa', status: 403 };
    }
    locations.push(location);
  }
  return { organization, locations };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'accept').trim();
    const token = String(new URL(req.url).searchParams.get('token') || payload.token || payload.invitation_token || '').trim();
    if (!token) return res({ error: 'Token obligatoriu' }, 400);
    if (!['inspect', 'accept'].includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (user.email_verified === false || user.email_verified === 'false') {
      return res({ error: 'Emailul contului trebuie verificat' }, 403);
    }

    const rows = await svc.entities.ProviderMemberInvitation.filter({ secure_token_hash: await hash(token) }, '-created_date', 2);
    const invitation = rows[0] || null;
    if (!invitation) return res({ error: 'Invitatie invalida' }, 404);
    if (invitation.status !== 'pending') return res({ error: 'Invitatia nu mai este activa' }, 400);
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await svc.entities.ProviderMemberInvitation.update(invitation.id, { status: 'expired' });
      return res({ error: 'Invitatia a expirat' }, 400);
    }
    if (normEmail(user.email) !== normEmail(invitation.invited_email_normalized)) {
      return res({ error: 'Invitatia este pentru alta adresa de email' }, 403);
    }

    const context = await loadContext(svc, invitation);
    if (context.error) return res({ error: context.error }, context.status);
    const view = invitationView(invitation, context.organization, context.locations);

    if (action === 'inspect') {
      return res({ invitation: view });
    }

    const memberships = [];
    for (const location of context.locations) {
      const existing = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: location.id }, '-created_date', 10);
      if (existing[0]) {
        const updates = {
          organization_id: context.organization.id,
          role: invitation.proposed_role,
          status: 'active',
          invitation_id: invitation.id,
          reactivated_by_user_id: user.id,
          reactivated_at: new Date().toISOString(),
        };
        await svc.entities.ProviderMembership.update(existing[0].id, updates);
        memberships.push({ ...existing[0], ...updates });
      } else {
        memberships.push(await svc.entities.ProviderMembership.create({
          user_id: user.id,
          organization_id: context.organization.id,
          location_id: location.id,
          role: invitation.proposed_role,
          status: 'active',
          invitation_id: invitation.id,
        }));
      }
    }

    await svc.entities.ProviderMemberInvitation.update(invitation.id, {
      status: 'accepted',
      accepted_by_user_id: user.id,
      accepted_at: new Date().toISOString(),
    });
    return res({ success: true, invitation: view, memberships: memberships.map(safeMembership) });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
