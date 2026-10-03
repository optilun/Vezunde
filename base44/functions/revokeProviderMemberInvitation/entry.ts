import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';
import {
  PROVIDER_MANAGER_ROLE,
  canAssignProviderRole,
  highestProviderAccessRole,
  providerRoleCoversOrganization,
} from '../../shared/providerRolePolicy.js';

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function ids(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => clean(item))
    .filter(Boolean))];
}
function includesAll(set, values) { return values.every((value) => set.has(value)); }

// 2026-10-03 (structura conturilor, pasul 3). Rolul actorului dupa matricea comuna
// (shared/providerRolePolicy.js). Poate revoca o invitatie cine ar putea da rolul ei, pentru
// locatiile pe care le gestioneaza: proprietarul orice, administratorul manageri si membri,
// managerul doar membri la locatiile lui.
async function actorScopeForOrganization(svc, userId, organizationId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
  const managerLocationIds = new Set();
  let role = '';

  for (const row of rows) {
    let rowOrganizationId = clean(row.organization_id);
    if (!rowOrganizationId && row.location_id) {
      const location = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
      rowOrganizationId = clean(location?.organization_id);
    }
    if (rowOrganizationId !== organizationId) continue;
    let accessRole = providerMembershipAccessRole(row);
    if (accessRole === ORGANIZATION_OWNER_ROLE && !membershipHasOrganizationWideAccess(row, resolution)) accessRole = PROVIDER_MANAGER_ROLE;
    if (accessRole === PROVIDER_MANAGER_ROLE && row.location_id) managerLocationIds.add(row.location_id);
    if ([ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, PROVIDER_MANAGER_ROLE].includes(accessRole)) role = highestProviderAccessRole([role, accessRole]);
  }

  const manageableLocationIds = new Set(managerLocationIds);
  if (providerRoleCoversOrganization(role)) {
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    for (const location of locations) manageableLocationIds.add(location.id);
  }
  return { role, manageableLocationIds };
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
      ? { role: 'platform_admin', manageableLocationIds: new Set() }
      : await actorScopeForOrganization(svc, user.id, organizationId);
    if (!actor.role) {
      return res({ error: 'Nu poti revoca aceasta invitatie' }, 403);
    }

    const invitedLocationIds = ids(invitation.invited_location_ids);
    const wideInvitation = invitation.organization_wide_access === true || providerRoleCoversOrganization(invitation.proposed_role);
    if (!canAssignProviderRole(actor.role, invitation.proposed_role)) {
      return res({
        error: actor.role === ORGANIZATION_ADMIN_ROLE
          ? 'Administratorul organizatiei nu poate revoca invitatii pentru proprietari sau administratori'
          : 'Poti revoca doar invitatiile pentru roluri pe care le poti acorda',
      }, 403);
    }
    if (!isPlatformAdmin && !includesAll(actor.manageableLocationIds, invitedLocationIds)) {
      return res({ error: 'Invitatia include locatii din afara accesului tau' }, 403);
    }

    const revokedAt = new Date().toISOString();
    await svc.entities.ProviderMemberInvitation.update(invitation.id, {
      status: 'revoked',
      revoked_by_user_id: user.id,
      revoked_at: revokedAt,
    });
    // 2026-10-03 (structura conturilor, pasul 2): invitatiile de specialist trimise impreuna cu
    // aceasta invitatie se revoca odata cu ea.
    const bundled = await svc.entities.ProfessionalInvitation.filter({ bundled_member_invitation_id: invitation.id, status: 'pending' }, '-created_date', 20).catch(() => []);
    for (const row of bundled) {
      await svc.entities.ProfessionalInvitation.update(row.id, { status: 'revoked', revoked_by_user_id: user.id, revoked_at: revokedAt });
    }
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
      new_values: JSON.stringify({ status: 'revoked', actor_role: actor.role, revoked_specialist_invitation_ids: bundled.map((row) => row.id) }),
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
