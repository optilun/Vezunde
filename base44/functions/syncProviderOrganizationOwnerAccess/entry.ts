import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
} from '../../../shared/providerOrganizationOwnerScope.js';

function res(body, status = 200) { return Response.json(body, { status }); }
function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  return ['organization_owner', 'location_manager', 'location_staff'].includes(value) ? value : '';
}

async function audit(svc, user, organizationId, created, reactivated, promoted) {
  if (created.length === 0 && reactivated.length === 0 && promoted.length === 0) return;
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderOrganization',
    entity_id: organizationId,
    action_type: 'sync_organization_owner_access',
    changed_fields: ['ProviderMembership'],
    previous_values: JSON.stringify({}),
    new_values: JSON.stringify({ created, reactivated, promoted }),
    admin_user_id: user.id,
    admin_email: user.email,
    note: 'Numai ownerii cu acces explicit la intreaga organizatie au fost propagati pe locatii.',
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

    const ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const ownOrganizationIds = [...new Set(ownMemberships.map((membership) => membership.organization_id).filter(Boolean))];
    const ownedOrganizationIds = [];
    for (const organizationId of ownOrganizationIds) {
      const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
      if (ownMemberships.some((membership) => membership.organization_id === organizationId
        && membershipHasOrganizationWideAccess(membership, resolution))) {
        ownedOrganizationIds.push(organizationId);
      }
    }

    const requestedOrganizationId = String(payload.organization_id || '').trim();
    const organizationIds = requestedOrganizationId ? [requestedOrganizationId] : ownedOrganizationIds;
    if (user.role !== 'admin' && organizationIds.some((id) => !ownedOrganizationIds.includes(id))) {
      return res({ error: 'Doar ownerul cu acces la intreaga organizatie poate sincroniza locatiile' }, 403);
    }

    let totalCreated = 0;
    let totalReactivated = 0;
    let totalPromoted = 0;
    for (const organizationId of organizationIds) {
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      const membershipRows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1000);
      const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
      const activeOwnerUserIds = [...new Set(membershipRows
        .filter((membership) => membershipHasOrganizationWideAccess(membership, resolution))
        .map((membership) => membership.user_id))];
      const created = [];
      const reactivated = [];
      const promoted = [];
      for (const ownerUserId of activeOwnerUserIds) {
        for (const location of locations) {
          const existing = membershipRows.find((membership) => membership.user_id === ownerUserId && membership.location_id === location.id);
          if (!existing) {
            const membership = await svc.entities.ProviderMembership.create({
              user_id: ownerUserId,
              organization_id: organizationId,
              location_id: location.id,
              role: 'organization_owner',
              status: 'active',
              access_origin: 'organization_sync',
              claim_scope: 'organization',
              organization_wide_access: true,
            });
            created.push(membership.id);
            totalCreated += 1;
          } else if (existing.status !== 'active') {
            await svc.entities.ProviderMembership.update(existing.id, {
              role: 'organization_owner',
              status: 'active',
              access_origin: existing.access_origin || 'organization_sync',
              claim_scope: existing.claim_scope || 'organization',
              organization_wide_access: true,
              reactivated_by_user_id: user.id,
              reactivated_at: new Date().toISOString(),
            });
            reactivated.push(existing.id);
            totalReactivated += 1;
          } else if (normalizeRole(existing.role) !== 'organization_owner' || existing.organization_wide_access === false) {
            await svc.entities.ProviderMembership.update(existing.id, {
              role: 'organization_owner',
              organization_wide_access: true,
            });
            promoted.push(existing.id);
            totalPromoted += 1;
          }
        }
      }
      await audit(svc, user, organizationId, created, reactivated, promoted);
    }

    return res({
      success: true,
      created: totalCreated,
      reactivated: totalReactivated,
      promoted: totalPromoted,
      changed: totalCreated + totalReactivated + totalPromoted > 0,
    });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});
