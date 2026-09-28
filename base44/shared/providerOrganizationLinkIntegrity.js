function clean(value) {
  return String(value || '').trim();
}

export function activeLinksByLocation(links = []) {
  const byLocation = new Map();
  for (const link of links) {
    if (link?.link_record_status !== 'active' || !clean(link.location_id)) continue;
    const rows = byLocation.get(link.location_id) || [];
    rows.push(link);
    byLocation.set(link.location_id, rows);
  }
  return byLocation;
}

// A location's organization_id and directory link must agree before access can be
// granted to an organization. A public profile may still be claimed individually,
// but an administrator must reconcile a disputed link before approving access.
export function claimOrganizationLinkStatus(location, links = [], directoryState = null) {
  const organizationId = clean(location?.organization_id);
  const active = links.filter((link) => link?.link_record_status === 'active' && clean(link.location_id) === clean(location?.id));
  if (active.length > 1 || active.some((link) => clean(link.organization_id) !== organizationId)) return 'conflict';
  if (['conflict', 'rejected'].includes(clean(directoryState?.organization_link_status))) return clean(directoryState.organization_link_status);
  return clean(active[0]?.link_status) || (organizationId ? 'probable' : 'unassigned');
}
