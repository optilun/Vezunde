// Hide branches only when their linked organization is actually displayed.
// Names alone never establish that two locations belong to the same organization.
export function standaloneClaimLocations(locations = [], organizations = []) {
  const groupedIds = new Set(organizations.flatMap((organization) => (organization.locations || []).map((location) => location.id)));
  return locations.filter((location) => !groupedIds.has(location.id));
}
