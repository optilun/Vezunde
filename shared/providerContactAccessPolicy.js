export const PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION = 'provider-contact-access-v1';

export const PROVIDER_CONTACT_ACCESS_ALLOWED_FIELDS = Object.freeze([
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_preference',
]);

const ALLOWED_FIELD_SET = new Set(PROVIDER_CONTACT_ACCESS_ALLOWED_FIELDS);
const ELIGIBLE_RESPONSE_TYPES = new Set(['can_help', 'needs_details']);

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeApprovedContactFields(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, 80)).filter((value) => ALLOWED_FIELD_SET.has(value)))];
}

export function providerContactAccessEligibility({ lead, response, approval, contact }) {
  const reasons = [];
  if (!lead || lead.delivery_state !== 'available') reasons.push('lead_not_available');
  if (lead && ['declined', 'closed', 'expired'].includes(lead.status)) reasons.push('lead_status_not_eligible');
  if (!response || response.status !== 'active' || !ELIGIBLE_RESPONSE_TYPES.has(response.response_type)) {
    reasons.push('provider_response_not_eligible');
  }
  if (!approval || approval.status !== 'approved') reasons.push('patient_approval_missing');
  if (approval && lead && approval.lead_id !== lead.id) reasons.push('approval_lead_mismatch');
  if (approval && lead && approval.location_id !== lead.location_id) reasons.push('approval_location_mismatch');
  if (!contact || contact.status !== 'active') reasons.push('contact_not_active');
  if (contact?.contact_email_verified !== true) reasons.push('patient_email_not_verified');
  const fields = normalizeApprovedContactFields(approval?.allowed_contact_fields);
  if (fields.length === 0) reasons.push('no_contact_fields_approved');
  return {
    eligible: reasons.length === 0,
    reasons,
    approved_fields: fields,
  };
}

export function buildApprovedProviderContact(contact, approvedFields) {
  const fields = normalizeApprovedContactFields(approvedFields);
  const result = {};
  for (const field of fields) {
    const value = clean(contact?.[field], field === 'contact_email' ? 254 : 160);
    if (value) result[field] = value;
  }
  return result;
}

export function sanitizeProviderContactAccessStatus({ eligible, reasons, approvedFields }) {
  return {
    available: eligible === true,
    state: eligible === true ? 'patient_approved' : 'locked',
    approved_fields: eligible === true ? normalizeApprovedContactFields(approvedFields) : [],
    reason: eligible === true ? '' : clean(reasons?.[0] || 'contact_locked', 120),
  };
}
