import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
  storedProviderRoleForAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function highestRole(roles) {
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  return '';
}

async function audit(svc, user, organizationId, changes) {
  if (changes.created.length === 0 && changes.reactivated.length === 0 && changes.updated.length === 0) return;
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderOrganization',
    entity_id: organizationId,
    action_type: 'sync_organization_wide_access',
    changed_fields: ['ProviderMembership'],
    previous_values: JSON.stringify({}),
    new_values: JSON.stringify(changes),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: 'Ownerii si administratorii cu acces explicit la intreaga organizatie au fost propagati pe toate locatiile.',
    performed_at: new Date().toISOString(),
  });
}

async function organizationIdForMembership(svc, membership) {
  if (membership.organization_id) return membership.organization_id;
  if (!membership.location_id) return '';
  const location = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
  return clean(location?.organization_id);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const actorOrganizations = new Set();
    for (const membership of ownMemberships) {
      const organizationId = await organizationIdForMembership(svc, membership);
      if (!organizationId) continue;
      const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
      if (membershipHasOrganizationWideAccess(membership, resolution)) actorOrganizations.add(organizationId);
    }

    const requestedOrganizationId = clean(payload.organization_id);
    const organizationIds = requestedOrganizationId ? [requestedOrganizationId] : [...actorOrganizations];
    if (user.role !== 'admin' && organizationIds.some((id) => !actorOrganizations.has(id))) {
      return res({ error: 'Doar ownerul sau administratorul cu acces la intreaga organizatie poate sincroniza locatiile' }, 403);
    }

    let totalCreated = 0;
    let totalReactivated = 0;
    let totalUpdated = 0;
    for (const organizationId of organizationIds) {
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      const membershipRows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1500);
      const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
      const rolesByUser = new Map();
      for (const membership of membershipRows) {
        if (!membershipHasOrganizationWideAccess(membership, resolution)) continue;
        const userId = clean(membership.user_id);
        if (!userId) continue;
        const roles = rolesByUser.get(userId) || [];
        roles.push(providerMembershipAccessRole(membership));
        rolesByUser.set(userId, roles);
      }

      const wideUsers = [...rolesByUser.entries()]
        .map(([userId, roles]) => ({ userId, accessRole: highestRole(roles) }))
        .filter((item) => item.accessRole);
      const changes = { created: [], reactivated: [], updated: [] };
      for (const wideUser of wideUsers) {
        for (const location of locations) {
          const existing = membershipRows.find((membership) => membership.user_id === wideUser.userId && membership.location_id === location.id);
          const desired = {
            organization_id: organizationId,
            role: storedProviderRoleForAccessRole(wideUser.accessRole),
            organization_role: wideUser.accessRole === ORGANIZATION_ADMIN_ROLE ? ORGANIZATION_ADMIN_ROLE : 'none',
            status: 'active',
            access_origin: existing?.access_origin || 'organization_sync',
            claim_scope: 'organization',
            organization_wide_access: true,
          };
          if (!existing) {
            const membership = await svc.entities.ProviderMembership.create({
              user_id: wideUser.userId,
              location_id: location.id,
              ...desired,
            });
            changes.created.push({ id: membership.id, user_id: wideUser.userId, location_id: location.id, role: wideUser.accessRole });
            totalCreated += 1;
            membershipRows.push(membership);
            continue;
          }
          const existingRole = providerMembershipAccessRole(existing);
          if (existing.status !== 'active') {
            await svc.entities.ProviderMembership.update(existing.id, {
              ...desired,
              reactivated_by_user_id: user.id,
              reactivated_at: new Date().toISOString(),
            });
            changes.reactivated.push({ id: existing.id, user_id: wideUser.userId, location_id: location.id, role: wideUser.accessRole });
            totalReactivated += 1;
          } else if (existingRole !== wideUser.accessRole || existing.organization_wide_access !== true || existing.organization_id !== organizationId) {
            await svc.entities.ProviderMembership.update(existing.id, desired);
            changes.updated.push({ id: existing.id, user_id: wideUser.userId, location_id: location.id, from_role: existingRole, role: wideUser.accessRole });
            totalUpdated += 1;
          }
        }
      }
      await audit(svc, user, organizationId, changes);
    }

    return res({
      success: true,
      created: totalCreated,
      reactivated: totalReactivated,
      updated: totalUpdated,
      changed: totalCreated + totalReactivated + totalUpdated > 0,
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
