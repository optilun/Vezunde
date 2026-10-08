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

// Public preview uses broad, allow-listed categories. Never copy a stored free-text
// summary, age, recipient or specialized service keys into an anonymous inbox.
const PREVIEW_CATEGORIES = Object.freeze({
  control_vedere: ['control_vedere', 'Control de vedere'],
  control_copil: ['control_vedere', 'Control de vedere'],
  ochelari_lentile: ['ochelari_lentile', 'Ochelari sau lentile'],
  lentile_contact: ['lentile_contact', 'Lentile de contact'],
  reparatii_ochelari: ['reparatii_ochelari', 'Reparații sau reglaje'],
  simptome_oftalmologice: ['consultatie', 'Consultație oftalmologică'],
  investigatii: ['consultatie', 'Consultație oftalmologică'],
});
const PREVIEW_TIMING = new Set(['cat_mai_repede', 'zilele_urmatoare', 'saptamana_aceasta', 'nu_e_urgent']);

export function sanitizeProviderLeadForFreeInbox(lead) {
  const deliveryState = clean(lead?.delivery_state, 80) || 'available';
  const status = clean(lead?.status, 80) || 'new';
  const [intent, label] = PREVIEW_CATEGORIES[lead?.intent] || ['unknown', 'Servicii pentru vedere'];
  const city = clean(lead?.city, 120);
  const county = clean(lead?.county, 120);
  return {
    id: clean(lead?.id, 120),
    location_id: clean(lead?.location_id, 120),
    intent,
    intent_label: label,
    service_keys: [],
    matched_service_keys: [],
    city,
    county,
    timing_key: PREVIEW_TIMING.has(lead?.timing_key) ? lead.timing_key : '',
    preview_summary: [label, city || county].filter(Boolean).join(' · '),
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

