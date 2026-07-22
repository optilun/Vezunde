import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isPrivilegedProviderRole,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function ids(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => clean(item))
    .filter(Boolean))];
}
function includesAll(set, values) { return values.every((value) => set.has(value)); }

async function actorScopeForOrganization(svc, userId, organizationId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
  const ownerLocationIds = new Set();
  const adminLocationIds = new Set();
  let wideOwner = false;
  let organizationAdmin = false;

  for (const row of rows) {
    let rowOrganizationId = clean(row.organization_id);
    if (!rowOrganizationId && row.location_id) {
      const location = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
      rowOrganizationId = clean(location?.organization_id);
    }
    if (rowOrganizationId !== organizationId) continue;
    const accessRole = providerMembershipAccessRole(row);
    if (accessRole === ORGANIZATION_OWNER_ROLE) {
      if (row.location_id) ownerLocationIds.add(row.location_id);
      if (membershipHasOrganizationWideAccess(row, resolution)) wideOwner = true;
    }
    if (accessRole === ORGANIZATION_ADMIN_ROLE && row.organization_wide_access === true) organizationAdmin = true;
  }

  if (wideOwner || organizationAdmin) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    for (const location of locations) {
      if (wideOwner) ownerLocationIds.add(location.id);
      if (organizationAdmin) adminLocationIds.add(location.id);
    }
  }
  return {
    role: wideOwner || ownerLocationIds.size > 0 ? ORGANIZATION_OWNER_ROLE : (organizationAdmin ? ORGANIZATION_ADMIN_ROLE : ''),
    wideOwner,
    organizationAdmin,
    ownerLocationIds,
    manageableLocationIds: new Set([...ownerLocationIds, ...adminLocationIds]),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const invitation = await svc.entities.ProviderMemberInvitation.get(clean(payload.invitation_id)).catch(() => null);
    if (!invitation) return res({ error: 'Invitatia nu exista' }, 404);
    if (!['draft', 'pending'].includes(invitation.status)) return res({ error: 'Invitatia nu mai poate fi revocata' }, 400);
    const organizationId = clean(invitation.organization_id);
    if (!organizationId) return res({ error: 'Organizatia invitatiei nu poate fi determinata' }, 409);

    const isPlatformAdmin = user.role === 'admin';
    const actor = isPlatformAdmin
      ? { role: 'platform_admin', wideOwner: true, organizationAdmin: false, ownerLocationIds: new Set(), manageableLocationIds: new Set() }
      : await actorScopeForOrganization(svc, user.id, organizationId);
    if (![ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'platform_admin'].includes(actor.role)) {
      return res({ error: 'Nu poti revoca aceasta invitatie' }, 403);
    }

    const invitedLocationIds = ids(invitation.invited_location_ids);
    const privilegedInvitation = isPrivilegedProviderRole(invitation.proposed_role);
    const wideInvitation = invitation.organization_wide_access === true || invitation.proposed_role === ORGANIZATION_ADMIN_ROLE;
    if (actor.role === ORGANIZATION_ADMIN_ROLE && privilegedInvitation) {
      return res({ error: 'Administratorul organizatiei nu poate revoca invitatii pentru owneri sau administratori' }, 403);
    }
    if (actor.role === ORGANIZATION_ADMIN_ROLE && !includesAll(actor.manageableLocationIds, invitedLocationIds)) {
      return res({ error: 'Invitatia include locatii din afara accesului tau' }, 403);
    }
    if (actor.role === ORGANIZATION_OWNER_ROLE && !actor.wideOwner) {
      if (wideInvitation || invitation.proposed_role === ORGANIZATION_ADMIN_ROLE) {
        return res({ error: 'Doar un owner global poate revoca invitatii cu acces organizational' }, 403);
      }
      if (!includesAll(actor.ownerLocationIds, invitedLocationIds)) {
        return res({ error: 'Poti revoca numai invitatiile care acopera integral locatiile tale' }, 403);
      }
    }

    const revokedAt = new Date().toISOString();
    await svc.entities.ProviderMemberInvitation.update(invitation.id, {
      status: 'revoked',
      revoked_by_user_id: user.id,
      revoked_at: revokedAt,
    });
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderMemberInvitation',
      entity_id: invitation.id,
      action_type: 'revoke_provider_member_invitation',
      changed_fields: ['status', 'revoked_by_user_id', 'revoked_at'],
      previous_values: JSON.stringify({
        status: invitation.status,
        proposed_role: invitation.proposed_role,
        organization_wide_access: wideInvitation,
        invited_location_ids: invitedLocationIds,
      }),
      new_values: JSON.stringify({ status: 'revoked', actor_role: actor.role }),
      admin_user_id: user.id,
      admin_email: user.email || '',
      note: `Invitatie revocata de ${actor.role} in limita scope-ului sau.`,
      performed_at: revokedAt,
    });
    return res({ success: true });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
