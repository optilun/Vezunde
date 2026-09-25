import {
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
} from './providerOrganizationOwnerScope.js';
import {
  providerLeadIsHistorical,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from './providerLeadInboxPolicy.js';

export const PROVIDER_ORGANIZATION_LEAD_INBOX_CONTRACT_VERSION = 'provider-organization-lead-inbox-v1';

const FILTERABLE_STATUSES = new Set([
  'new', 'viewed', 'interested', 'needs_details', 'declined', 'closed', 'expired',
]);

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function requestIdentity(lead) {
  return clean(lead?.request_id, 120) || `lead:${clean(lead?.id, 120)}`;
}

function distinctRequestCount(leads) {
  return new Set(leads.map(requestIdentity)).size;
}

function boundedLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 50;
}

function boundedOffset(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1000000, Math.floor(parsed))) : 0;
}

export function safeOrganizationLeadLocation(location) {
  return {
    id: clean(location?.id, 120),
    name: clean(location?.public_display_name || location?.name, 160) || 'Locatie',
    city: clean(location?.locality_name || location?.city, 120),
    county: clean(location?.county_name || location?.county, 120),
  };
}

export function resolveOrganizationLeadLocations({
  organizationId,
  memberships = [],
  locations = [],
  ownerScopeResolution = {},
} = {}) {
  const orgId = clean(organizationId, 120);
  if (!orgId) return [];

  const organizationLocations = locations.filter(
    (location) => location?.organization_id === orgId && clean(location?.id, 120),
  );
  const locationIds = new Set(organizationLocations.map((location) => location.id));
  const ownerMemberships = memberships.filter((membership) => (
    membership?.status === 'active'
    && providerMembershipAccessRole(membership) === 'organization_owner'
    && (!membership.organization_id || membership.organization_id === orgId)
    && locationIds.has(membership.location_id)
  ));
  if (ownerMemberships.length === 0) return [];

  const organizationWide = ownerMemberships.some((membership) => {
    if (membership.organization_wide_access !== true
      && ['location', 'selected_locations'].includes(membership.claim_scope)) return false;
    return membershipHasOrganizationWideAccess(membership, ownerScopeResolution);
  });
  const allowedIds = organizationWide
    ? locationIds
    : new Set(ownerMemberships.map((membership) => membership.location_id));
  return organizationLocations
    .filter((location) => allowedIds.has(location.id))
    .sort((left, right) => (
      safeOrganizationLeadLocation(left).name.localeCompare(safeOrganizationLeadLocation(right).name, 'ro')
      || String(left.id).localeCompare(String(right.id))
    ));
}

export function buildOrganizationLeadInboxPage({
  leads = [],
  locations = [],
  scope = 'active',
  status = '',
  locationId = '',
  offset = 0,
  limit = 50,
  keyFactory = () => crypto.randomUUID(),
} = {}) {
  const allowedLocations = new Map(locations.map((location) => [
    clean(location?.id, 120), safeOrganizationLeadLocation(location),
  ]));
  const rows = (Array.isArray(leads) ? leads : []).filter((lead) => (
    allowedLocations.has(clean(lead?.location_id, 120))
  ));
  const requestedScope = scope === 'history' ? 'history' : 'active';
  const requestedStatus = FILTERABLE_STATUSES.has(status) ? status : '';
  const requestedLocationId = clean(locationId, 120);
  const filtered = rows
    .filter((lead) => providerLeadIsHistorical(lead) === (requestedScope === 'history'))
    .filter((lead) => !requestedStatus || lead?.status === requestedStatus)
    .filter((lead) => !requestedLocationId || lead?.location_id === requestedLocationId)
    .sort((left, right) => (
      String(right?.created_date || '').localeCompare(String(left?.created_date || ''))
      || String(right?.id || '').localeCompare(String(left?.id || ''))
    ));
  const safeOffset = boundedOffset(offset);
  const safeLimit = boundedLimit(limit);
  const pageRows = filtered.slice(safeOffset, safeOffset + safeLimit);
  const pageGroupKeys = new Map();
  const safeLeads = pageRows.map((lead) => {
    const identity = requestIdentity(lead);
    if (!pageGroupKeys.has(identity)) pageGroupKeys.set(identity, clean(keyFactory(), 120));
    return {
      ...sanitizeProviderLeadForFreeInbox(lead),
      location_name: allowedLocations.get(lead.location_id).name,
      group_key: pageGroupKeys.get(identity),
    };
  });
  const counters = summarizeProviderLeadInbox(rows);
  return {
    scope: requestedScope,
    counters: {
      ...counters,
      distinct_requests: distinctRequestCount(rows),
      lead_deliveries_in_scope: filtered.length,
      distinct_requests_in_scope: distinctRequestCount(filtered),
    },
    group_key_scope: 'page',
    pagination: {
      offset: safeOffset,
      limit: safeLimit,
      total: filtered.length,
      has_more: safeOffset + safeLeads.length < filtered.length,
    },
    leads: safeLeads,
  };
}
