export const PROVIDER_LEAD_INBOX_CONTRACT_VERSION = 'provider-lead-inbox-v2';

const PROVIDER_ROLES_WITH_REQUEST_ACCESS = new Set([
  'organization_owner',
  'location_manager',
  'location_staff',
]);

const FILTERABLE_STATUSES = new Set([
  'new',
  'viewed',
  'interested',
  'needs_details',
  'declined',
  'closed',
  'expired',
]);

const TERMINAL_STATUSES = new Set(['closed', 'expired']);

export function normalizeProviderMemberRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return PROVIDER_ROLES_WITH_REQUEST_ACCESS.has(value) ? value : '';
}

export function canAccessProviderLeadInbox(role) {
  return PROVIDER_ROLES_WITH_REQUEST_ACCESS.has(normalizeProviderMemberRole(role));
}

function clean(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function stringArray(value, maxItems = 20) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 120)).filter(Boolean))].slice(0, maxItems)
    : [];
}

export function providerLeadIsHistorical(lead) {
  return lead?.delivery_state !== 'available' || TERMINAL_STATUSES.has(lead?.status);
}

export function filterProviderLeadInbox(leads, { scope = 'active', status = '', limit = 50 } = {}) {
  const rows = Array.isArray(leads) ? leads : [];
  const requestedScope = scope === 'history' ? 'history' : 'active';
  const requestedStatus = FILTERABLE_STATUSES.has(status) ? status : '';
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));

  return [...rows]
    .filter((lead) => providerLeadIsHistorical(lead) === (requestedScope === 'history'))
    .filter((lead) => !requestedStatus || lead?.status === requestedStatus)
    .sort((left, right) => String(right?.created_date || '').localeCompare(String(left?.created_date || '')))
    .slice(0, boundedLimit);
}

export function sanitizeProviderLeadForFreeInbox(lead) {
  const deliveryState = clean(lead?.delivery_state, 80) || 'available';
  const status = clean(lead?.status, 80) || 'new';
  return {
    id: clean(lead?.id, 120),
    location_id: clean(lead?.location_id, 120),
    intent: clean(lead?.intent, 120),
    intent_label: clean(lead?.intent_label, 160),
    service_keys: stringArray(lead?.service_keys),
    matched_service_keys: stringArray(lead?.matched_service_keys),
    city: clean(lead?.city, 120),
    county: clean(lead?.county, 120),
    for_whom: clean(lead?.for_whom, 80),
    age_group: clean(lead?.age_group, 80),
    timing_key: clean(lead?.timing_key, 120),
    preview_summary: clean(lead?.preview_summary, 240),
    access_tier: 'free_preview',
    contact_access_state: 'hidden',
    conversation_access_state: 'locked',
    delivery_state: deliveryState,
    status,
    closure_reason: clean(lead?.closure_reason, 80),
    is_historical: providerLeadIsHistorical({ delivery_state: deliveryState, status }),
    created_date: lead?.created_date || null,
    updated_date: lead?.updated_date || null,
    expires_at: lead?.expires_at || null,
    closed_at: lead?.closed_at || null,
  };
}

export function summarizeProviderLeadInbox(leads) {
  const rows = Array.isArray(leads) ? leads : [];
  const availableRows = rows.filter((lead) => !providerLeadIsHistorical(lead));
  const historyRows = rows.filter(providerLeadIsHistorical);
  return {
    total: rows.length,
    available: availableRows.length,
    history: historyRows.length,
    new: availableRows.filter((lead) => lead?.status === 'new').length,
    viewed: availableRows.filter((lead) => lead?.status === 'viewed').length,
    active: availableRows.filter((lead) => !['declined', 'closed', 'expired'].includes(lead?.status)).length,
    closed: historyRows.filter((lead) => lead?.status === 'closed').length,
    expired: historyRows.filter((lead) => lead?.status === 'expired').length,
  };
}