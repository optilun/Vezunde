import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROVIDER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return PROVIDER_ROLES.includes(value) ? value : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });

    const svc = base44.asServiceRole;
    await req.json().catch(() => ({}));

    const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    const activeMemberships = memberships.filter((membership) => normalizeRole(membership.role) && membership.location_id);
    const ownerOrganizationIds = new Set();
    const assignedLocationIds = unique(activeMemberships.map((membership) => membership.location_id));

    for (const membership of activeMemberships.filter((item) => normalizeRole(item.role) === 'organization_owner')) {
      if (membership.organization_id) {
        ownerOrganizationIds.add(membership.organization_id);
        continue;
      }
      const location = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
      if (location?.organization_id) ownerOrganizationIds.add(location.organization_id);
    }

    const blockers = [];
    for (const organizationId of ownerOrganizationIds) {
      const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
      const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      const activeOwnerUserIds = new Set();

      for (const location of locations) {
        const rows = await svc.entities.ProviderMembership.filter({ location_id: location.id, status: 'active' }, '-created_date', 500);
        for (const row of rows) {
          if (normalizeRole(row.role) === 'organization_owner' && row.user_id) activeOwnerUserIds.add(row.user_id);
        }
      }

      if (activeOwnerUserIds.size === 1 && activeOwnerUserIds.has(user.id)) {
        const organizationName = organization?.public_display_name || organization?.name || 'organizatia administrata';
        blockers.push({
          code: 'LAST_ORGANIZATION_OWNER',
          organization_id: organizationId,
          organization_name: organizationName,
          message: `Esti ultimul owner activ pentru ${organizationName}. Rolul trebuie transferat inainte de stergerea contului.`,
        });
      }
    }

    const professionalProfiles = await svc.entities.ProfessionalProfile.filter({ user_id: user.id }, '-created_date', 10).catch(() => []);
    const organizationIds = unique(activeMemberships.map((membership) => membership.organization_id));

    return Response.json({
      can_request_deletion: blockers.length === 0,
      blockers,
      account_summary: {
        active_provider_membership_count: activeMemberships.length,
        provider_organization_count: organizationIds.length,
        provider_location_count: assignedLocationIds.length,
        has_professional_profile: professionalProfiles.length > 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

