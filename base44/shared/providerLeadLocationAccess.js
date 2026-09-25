import { canAccessProviderLeadInbox } from './providerLeadInboxPolicy.js';
import {
  loadOrganizationOwnerScopeResolution,
  providerMembershipAccessRole,
} from './providerOrganizationOwnerScope.js';
import { resolveOrganizationLeadLocations } from './providerOrganizationLeadInboxPolicy.js';

const MEMBERSHIP_PAGE_SIZE = 500;

async function allActiveMemberships(svc, userId) {
  const memberships = [];
  for (let skip = 0; ; skip += MEMBERSHIP_PAGE_SIZE) {
    const page = await svc.entities.ProviderMembership.filter({
      user_id: userId,
      status: 'active',
    }, '-created_date', MEMBERSHIP_PAGE_SIZE, skip);
    memberships.push(...page);
    if (page.length < MEMBERSHIP_PAGE_SIZE) return memberships;
  }
}

export async function findProviderLeadLocationMembership(svc, user, location) {
  if (!user?.id || !location?.id) return null;
  const directRows = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: location.id,
    status: 'active',
  }, '-created_date', 20);
  const direct = directRows.find((row) => canAccessProviderLeadInbox(row?.role));
  if (direct) return direct;

  const organizationId = location.organization_id;
  if (!organizationId) return null;
  const memberships = await allActiveMemberships(svc, user.id);
  const ownerRows = memberships.filter((row) => (
    providerMembershipAccessRole(row) === 'organization_owner'
    && (!row.organization_id || row.organization_id === organizationId)
    && row.location_id
  ));
  if (ownerRows.length === 0) return null;

  const sourceLocations = await Promise.all(ownerRows.map((row) =>
    svc.entities.ProviderLocation.get(row.location_id).catch(() => null)));
  const verifiedOwnerRows = ownerRows.filter((row, index) => (
    sourceLocations[index]?.organization_id === organizationId
  ));
  if (verifiedOwnerRows.length === 0) return null;

  const ownerScopeResolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
  const authorizedLocations = resolveOrganizationLeadLocations({
    organizationId,
    memberships: verifiedOwnerRows,
    locations: [location, ...sourceLocations.filter(Boolean)],
    ownerScopeResolution,
  });
  return authorizedLocations.some((row) => row.id === location.id)
    ? verifiedOwnerRows[0]
    : null;
}
