import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isPrivilegedProviderRole,
  providerMembershipAccessRole,
} from '../../../shared/providerOrganizationOwnerScope.js';

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }

async function actorRoleForOrganization(svc, userId, organizationId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const roles = [];
  for (const row of rows) {
    let rowOrganizationId = clean(row.organization_id);
    if (!rowOrganizationId && row.location_id) {
      const location = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
      rowOrganizationId = clean(location?.organization_id);
    }
    if (rowOrganizationId === organizationId) roles.push(providerMembershipAccessRole(row));
  }
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  return '';
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

    const actorRole = user.role === 'admin' ? 'platform_admin' : await actorRoleForOrganization(svc, user.id, organizationId);
    if (![ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'platform_admin'].includes(actorRole)) {
      return res({ error: 'Nu poti revoca aceasta invitatie' }, 403);
    }
    if (actorRole === ORGANIZATION_ADMIN_ROLE && isPrivilegedProviderRole(invitation.proposed_role)) {
      return res({ error: 'Administratorul organizatiei nu poate revoca invitatii pentru owneri sau administratori' }, 403);
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
      previous_values: JSON.stringify({ status: invitation.status, proposed_role: invitation.proposed_role }),
      new_values: JSON.stringify({ status: 'revoked', actor_role: actorRole }),
      admin_user_id: user.id,
      admin_email: user.email || '',
      note: `Invitatie revocata de ${actorRole}.`,
      performed_at: revokedAt,
    });
    return res({ success: true });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
