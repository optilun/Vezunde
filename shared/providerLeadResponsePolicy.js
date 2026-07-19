export const PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION = 'provider-lead-response-v1';

export const PROVIDER_LEAD_RESPONSE_OPTIONS = Object.freeze([
  { key: 'can_help', label: 'Putem ajuta', lead_status: 'interested' },
  { key: 'needs_details', label: 'Avem nevoie de detalii', lead_status: 'needs_details' },
  { key: 'cannot_help', label: 'Nu putem ajuta', lead_status: 'declined' },
]);

const OPTION_BY_KEY = new Map(PROVIDER_LEAD_RESPONSE_OPTIONS.map((option) => [option.key, option]));

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeProviderLeadResponseType(value) {
  const key = clean(value, 80);
  return OPTION_BY_KEY.has(key) ? key : '';
}

export function providerLeadStatusForResponse(value) {
  return OPTION_BY_KEY.get(normalizeProviderLeadResponseType(value))?.lead_status || '';
}

export function providerLeadResponseLabel(value) {
  return OPTION_BY_KEY.get(normalizeProviderLeadResponseType(value))?.label || '';
}

export function sanitizeProviderLeadResponse(response) {
  return {
    id: clean(response?.id, 120),
    lead_id: clean(response?.lead_id, 120),
    location_id: clean(response?.location_id, 120),
    response_contract_version: PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION,
    response_type: normalizeProviderLeadResponseType(response?.response_type),
    response_label: providerLeadResponseLabel(response?.response_type),
    status: clean(response?.status, 80) || 'active',
    submitted_at: response?.submitted_at || null,
    updated_date: response?.updated_date || null,
  };
}
