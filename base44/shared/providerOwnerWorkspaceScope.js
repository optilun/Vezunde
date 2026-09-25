import {
  loadOrganizationOwnerScopeResolution,
  providerMembershipAccessRole,
} from './providerOrganizationOwnerScope.js';
import { resolveOrganizationLeadLocations } from './providerOrganizationLeadInboxPolicy.js';

const LOCATION_PAGE_SIZE = 500;

async function allOrganizationLocations(svc, organizationId) {
  const locations = [];
  for (let skip = 0; ; skip += LOCATION_PAGE_SIZE) {
    const page = await svc.entities.ProviderLocation.filter({
      organization_id: organizationId,
    }, '-created_date', LOCATION_PAGE_SIZE, skip);
    locations.push(...page);
    if (page.length < LOCATION_PAGE_SIZE) return locations;
  }
}

export async function expandOwnerWorkspaceScope(svc, user, memberships, currentLocations) {
  const locationMap = new Map(currentLocations.map((location) => [location.id, location]));
  const effectiveMemberships = [...memberships];
  const ownerOrganizationIds = new Set();

  for (const membership of memberships) {
    if (membership.status !== 'active'
      || providerMembershipAccessRole(membership) !== 'organization_owner') continue;
    const sourceLocation = locationMap.get(membership.location_id);
    if (!sourceLocation?.organization_id) continue;
    if (membership.organization_id && membership.organization_id !== sourceLocation.organization_id) continue;
    ownerOrganizationIds.add(sourceLocation.organization_id);
  }

  for (const organizationId of ownerOrganizationIds) {
    const [organizationLocations, ownerScopeResolution] = await Promise.all([
      allOrganizationLocations(svc, organizationId),
      loadOrganizationOwnerScopeResolution(svc, organizationId),
    ]);
    const allowedLocations = resolveOrganizationLeadLocations({
      organizationId,
      memberships,
      locations: organizationLocations,
      ownerScopeResolution,
    });
    for (const location of allowedLocations) {
      locationMap.set(location.id, location);
      const hasOwnerRole = effectiveMemberships.some((membership) => (
        membership.location_id === location.id
        && membership.status === 'active'
        && providerMembershipAccessRole(membership) === 'organization_owner'
      ));
      if (hasOwnerRole) continue;
      effectiveMemberships.push({
        id: null,
        user_id: user.id,
        organization_id: organizationId,
        location_id: location.id,
        role: 'organization_owner',
        status: 'active',
        organization_wide_access: true,
        virtual_owner_access: true,
      });
    }
  }

  return { locations: [...locationMap.values()], memberships: effectiveMemberships };
}
