export const CONTACT_SHARE_APPROVAL_CONTRACT_VERSION = 'patient-phone-share-v2';

export const CONTACT_SHARE_ALLOWED_FIELDS = Object.freeze([
  'contact_phone',
]);

const APPROVABLE_RESPONSE_TYPES = new Set(['can_help', 'needs_details']);

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

export function canApproveContactShareForResponse(response) {
  return response?.status === 'active'
    && APPROVABLE_RESPONSE_TYPES.has(clean(response?.response_type, 80));
}

export function sanitizeContactShareApproval(approval, locationId = '') {
  const status = approval?.status === 'approved' ? 'approved' : 'revoked';
  return {
    location_id: clean(approval?.location_id || locationId, 120),
    status,
    approved_at: approval?.approved_at || null,
    revoked_at: approval?.revoked_at || null,
    allowed_contact_fields: status === 'approved' ? [...CONTACT_SHARE_ALLOWED_FIELDS] : [],
  };
}

export function contactShareStatusForApproval(approval) {
  return approval?.status === 'approved' ? 'approved' : 'not_approved';
}
