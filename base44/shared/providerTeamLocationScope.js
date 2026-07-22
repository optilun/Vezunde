const TEAM_SCOPE_ROLES = new Set(['organization_owner', 'location_manager']);

function clean(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'manager') return 'location_manager';
  if (value === 'staff') return 'location_staff';
  return clean(value);
}

export function resolveProviderTeamLocationScope(memberships = [], organizationLocations = []) {
  const organizationLocationIds = new Set(
    organizationLocations.map((location) => clean(location?.id)).filter(Boolean),
  );
  if (organizationLocationIds.size === 0) return [];

  const scopedMemberships = memberships.filter((membership) => {
    if (!membership || (membership.status && membership.status !== 'active')) return false;
    const locationId = clean(membership.location_id);
    return locationId && organizationLocationIds.has(locationId);
  });

  if (scopedMemberships.some((membership) => normalizeRole(membership.role) === 'organization_owner')) {
    return [...organizationLocationIds].sort();
  }

  return [...new Set(scopedMemberships
    .filter((membership) => TEAM_SCOPE_ROLES.has(normalizeRole(membership.role)))
    .map((membership) => clean(membership.location_id))
    .filter(Boolean))].sort();
}