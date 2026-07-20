import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isOrganizationWideProviderRole,
  organizationRoleMarkerForAccessRole,
  storedProviderRoleForAccessRole,
} from '../../../shared/providerOrganizationOwnerScope.js';

const ROLES = [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff'];
const ACTIONS = ['list_mine', 'inspect', 'accept'];

function res(body, status = 200) { return Response.json(body, { status }); }
function normEmail(value) { return String(value || '').trim().toLowerCase(); }
function ids(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}
function eligibleLocation(location) {
  return location
    && location.claim_verification_status === 'approved'
    && location.profile_control_status !== 'suspended'
    && location.status !== 'suspendata'
    && location.active_status !== 'inactiva';
}
function safeMembership(membership, accessRole) {
  return {
    membership_id: membership.id,
    user_id: membership.user_id,
    organization_id: membership.organization_id || null,
    location_id: membership.location_id,
    role: accessRole,
    status: membership.status,
    organization_wide_access: membership.organization_wide_access === true,
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
  const organizationWide = invitation.organization_wide_access === true || isOrganizationWideProviderRole(invitation.proposed_role);
  return {
    id: invitation.id,
    organization: {
      id: organization.id,
      name: organization.public_display_name || organization.name || 'Organizatie',
    },
    proposed_role: invitation.proposed_role,
    organization_wide_access: organizationWide,
    locations: locations.map(safeLocation),
    expires_at: invitation.expires_at || null,
    delivery_status: invitation.delivery_status || 'pending',
    delivery_provider: invitation.delivery_provider || '',
  };
}
async function hash(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function loadContext(svc, invitation) {
  if (!ROLES.includes(invitation.proposed_role)) return { error: 'Rolul invitatiei este invalid', status: 400 };
  const organization = invitation.organization_id
    ? await svc.entities.ProviderOrganization.get(invitation.organization_id).catch(() => null)
    : null;
  if (!organization) return { error: 'Organizatia invitatiei nu mai este disponibila', status: 404 };
  if (organization.status === 'inactiva') return { error: 'Organizatia nu este activa', status: 403 };

  const organizationWide = invitation.organization_wide_access === true || isOrganizationWideProviderRole(invitation.proposed_role);
  let locationIds = ids(invitation.invited_location_ids);
  if (organizationWide) {
    const currentLocations = await svc.entities.ProviderLocation.filter({ organization_id: organization.id }, '-created_date', 500);
    locationIds = currentLocations.filter(eligibleLocation).map((location) => location.id);
  }
  if (locationIds.length === 0) return { error: 'Invitatia nu contine locatii active valide', status: 400 };

  const locations = [];
  for (const locationId of locationIds) {
    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return { error: 'Una dintre locatiile invitatiei nu mai este disponibila', status: 404 };
    if (location.organization_id !== organization.id) return { error: 'Locatia nu apartine organizatiei invitatiei', status: 403 };
    if (!eligibleLocation(location)) return { error: 'Una dintre locatii nu mai este eligibila pentru acces', status: 403 };
    locations.push(location);
  }
  return { organization, locations, organizationWide };
}

async function expireIfNeeded(svc, invitation) {
  if (new Date(invitation.expires_at).getTime() > Date.now()) return false;
  if (invitation.status === 'pending') await svc.entities.ProviderMemberInvitation.update(invitation.id, { status: 'expired' });
  return true;
}

async function invitationForRequest(svc, { token, invitationId }) {
  if (token) {
    const rows = await svc.entities.ProviderMemberInvitation.filter({ secure_token_hash: await hash(token) }, '-created_date', 2);
    return rows[0] || null;
  }
  if (invitationId) return svc.entities.ProviderMemberInvitation.get(invitationId).catch(() => null);
  return null;
}

async function auditAcceptance(svc, user, invitation, memberships, source, organizationWide) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderMemberInvitation',
    entity_id: invitation.id,
    action_type: 'accept_provider_member_invitation',
    changed_fields: ['status', 'accepted_by_user_id', 'accepted_at', 'memberships', 'organization_wide_access'],
    previous_values: JSON.stringify({ status: invitation.status }),
    new_values: JSON.stringify({
      status: 'accepted',
      accepted_by_user_id: user.id,
      proposed_role: invitation.proposed_role,
      organization_wide_access: organizationWide,
      membership_ids: memberships.map((membership) => membership.id),
      source,
    }),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: source === 'account_email_match'
      ? 'Invitatie acceptata din contul Base44 asociat emailului invitat.'
      : 'Invitatie acceptata prin linkul securizat.',
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);

    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'accept').trim();
    if (!ACTIONS.includes(action)) return res({ error: 'Actiune invalida' }, 400);
    if (user.is_verified === false || user.email_verified === false || user.email_verified === 'false') {
      return res({ error: 'Emailul contului trebuie verificat' }, 403);
    }

    const userEmail = normEmail(user.email);
    if (!userEmail) return res({ error: 'Contul nu are un email valid' }, 400);

    if (action === 'list_mine') {
      const rows = await svc.entities.ProviderMemberInvitation.filter({ invited_email_normalized: userEmail, status: 'pending' }, '-created_date', 50);
      const invitations = [];
      for (const invitation of rows) {
        if (await expireIfNeeded(svc, invitation)) continue;
        const context = await loadContext(svc, invitation);
        if (context.error) continue;
        invitations.push(invitationView(invitation, context.organization, context.locations));
      }
      return res({ invitations, count: invitations.length });
    }

    const token = String(new URL(req.url).searchParams.get('token') || payload.token || payload.invitation_token || '').trim();
    const invitationId = String(payload.invitation_id || '').trim();
    if (!token && !invitationId) return res({ error: 'Tokenul sau invitation_id este obligatoriu' }, 400);

    const invitation = await invitationForRequest(svc, { token, invitationId });
    if (!invitation) return res({ error: 'Invitatie invalida' }, 404);
    if (invitation.status !== 'pending') return res({ error: 'Invitatia nu mai este activa' }, 400);
    if (await expireIfNeeded(svc, invitation)) return res({ error: 'Invitatia a expirat' }, 400);
    if (userEmail !== normEmail(invitation.invited_email_normalized)) return res({ error: 'Invitatia este pentru alta adresa de email' }, 403);

    const context = await loadContext(svc, invitation);
    if (context.error) return res({ error: context.error }, context.status);
    const view = invitationView(invitation, context.organization, context.locations);
    if (action === 'inspect') return res({ invitation: view });

    const accessRole = invitation.proposed_role;
    const storedRole = storedProviderRoleForAccessRole(accessRole);
    const organizationRole = organizationRoleMarkerForAccessRole(accessRole);
    const organizationWide = context.organizationWide;
    const now = new Date().toISOString();
    const memberships = [];
    for (const location of context.locations) {
      const existing = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: location.id }, '-created_date', 10);
      const common = {
        organization_id: context.organization.id,
        role: storedRole,
        status: 'active',
        invitation_id: invitation.id,
        access_origin: 'invitation',
        claim_scope: organizationWide ? 'organization' : (context.locations.length > 1 ? 'selected_locations' : 'location'),
        organization_wide_access: organizationWide,
        ...(organizationRole ? { organization_role: organizationRole } : {}),
      };
      if (existing[0]) {
        const updates = {
          ...common,
          reactivated_by_user_id: user.id,
          reactivated_at: now,
        };
        await svc.entities.ProviderMembership.update(existing[0].id, updates);
        memberships.push({ ...existing[0], ...updates });
      } else {
        memberships.push(await svc.entities.ProviderMembership.create({
          user_id: user.id,
          location_id: location.id,
          ...common,
        }));
      }
    }

    const acceptedAt = new Date().toISOString();
    await svc.entities.ProviderMemberInvitation.update(invitation.id, {
      status: 'accepted',
      accepted_by_user_id: user.id,
      accepted_at: acceptedAt,
      organization_wide_access: organizationWide,
      invited_location_ids: context.locations.map((location) => location.id),
    });
    const source = token ? 'secure_link' : 'account_email_match';
    await auditAcceptance(svc, user, invitation, memberships, source, organizationWide);
    return res({
      success: true,
      invitation: view,
      memberships: memberships.map((membership) => safeMembership(membership, accessRole)),
      accepted_at: acceptedAt,
      acceptance_source: source,
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
