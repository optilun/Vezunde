export const PATIENT_REQUEST_STATUS_CONTRACT_VERSION = 'patient-request-status-v4';

const RESPONSE_LABELS = Object.freeze({
  can_help: 'Poate ajuta',
  needs_details: 'Are nevoie de detalii',
  cannot_help: 'Nu poate ajuta',
});

const CONTACT_SHARE_APPROVABLE_RESPONSES = new Set(['can_help', 'needs_details']);

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

export function sanitizePatientRequestStatus(request) {
  return {
    id: clean(request?.id, 120),
    public_reference: clean(request?.public_reference, 120),
    status: clean(request?.status, 80),
    lifecycle_state: clean(request?.lifecycle_state, 40),
    lifecycle_stage: clean(request?.lifecycle_stage, 60),
    intent: clean(request?.intent, 120),
    city: clean(request?.city, 120),
    county: clean(request?.county, 120),
    submitted_at: request?.submitted_at || null,
    expires_at: request?.expires_at || null,
    resolved_at: request?.resolved_at || null,
    closed_at: request?.closed_at || null,
  };
}

export function sanitizePatientProviderResponse(response, location, approval = null) {
  const responseType = Object.hasOwn(RESPONSE_LABELS, response?.response_type)
    ? response.response_type
    : '';
  const locationPublic = location?.status === 'publicata'
    && location?.active_status !== 'inactiva'
    && location?.profile_control_status !== 'suspended';
  const contactShareAllowed = CONTACT_SHARE_APPROVABLE_RESPONSES.has(responseType);
  const contactShareApproved = contactShareAllowed && approval?.status === 'approved';
  return {
    location_id: clean(location?.id || response?.location_id, 120),
    location_name: clean(location?.public_display_name || location?.name || 'Locatie', 180),
    city: clean(location?.locality_name || location?.city, 120),
    response_type: responseType,
    response_label: RESPONSE_LABELS[responseType] || 'Raspuns disponibil',
    submitted_at: response?.submitted_at || response?.updated_date || null,
    profile_available: Boolean(locationPublic),
    contact_share_allowed: contactShareAllowed,
    contact_share_status: contactShareApproved ? 'approved' : 'not_approved',
  };
}
