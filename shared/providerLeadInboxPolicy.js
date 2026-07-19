export const PROVIDER_LEAD_INBOX_CONTRACT_VERSION = 'provider-lead-inbox-free-v1';

const PROVIDER_ROLES_WITH_REQUEST_ACCESS = new Set([
  'organization_owner',
  'location_manager',
  'location_staff',
]);

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

export function sanitizeProviderLeadForFreeInbox(lead) {
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
    delivery_state: clean(lead?.delivery_state, 80) || 'available',
    status: clean(lead?.status, 80) || 'new',
    created_date: lead?.created_date || null,
    updated_date: lead?.updated_date || null,
    expires_at: lead?.expires_at || null,
  };
}

export function summarizeProviderLeadInbox(leads) {
  const rows = Array.isArray(leads) ? leads : [];
  return {
    total: rows.length,
    new: rows.filter((lead) => lead?.status === 'new').length,
    viewed: rows.filter((lead) => lead?.status === 'viewed').length,
    active: rows.filter((lead) => !['closed', 'declined', 'expired'].includes(lead?.status)).length,
  };
}
