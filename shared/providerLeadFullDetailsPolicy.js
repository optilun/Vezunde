import { PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION } from './providerLeadEligibility.js';
import { hasProviderFeature } from './providerEntitlementPolicy.js';

export const PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION = 'provider-lead-full-details-top3-pro-v1';

function clean(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

export function providerLeadFullDetailsEligibility({ lead, request, contact, entitlement }) {
  const reasons = [];
  if (!lead || lead.delivery_state !== 'available') reasons.push('lead_not_available');
  if (lead?.result_bucket_snapshot !== 'top3') reasons.push('lead_not_top3');
  if (lead?.access_tier !== 'pro_full') reasons.push('lead_not_full_details_scoped');
  if (['declined', 'closed', 'expired'].includes(lead?.status)) reasons.push('lead_status_not_eligible');
  if (!hasProviderFeature(entitlement, 'provider_leads.full_details')) reasons.push('pro_full_details_required');
  if (!request || request.persistence_state !== 'complete') reasons.push('request_not_complete');
  if (!contact || contact.status !== 'active') reasons.push('contact_not_active');
  if (contact?.provider_request_distribution_consent !== true) reasons.push('distribution_consent_missing');
  if (contact?.provider_request_distribution_consent_version !== PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION) {
    reasons.push('distribution_consent_version_not_supported');
  }
  if (!clean(request?.detailed_message, 2000)) reasons.push('detailed_message_missing');
  return { eligible: reasons.length === 0, reasons };
}

export function buildProviderLeadFullDetails({ request, contact }) {
  const emailVerified = contact?.contact_email_verified === true;
  return {
    client_name: clean(contact?.contact_name, 120),
    client_email: emailVerified ? clean(contact?.contact_email, 254) : '',
    client_email_verified: emailVerified,
    detailed_message: clean(request?.detailed_message, 2000),
    phone_available_for_request: Boolean(clean(contact?.contact_phone, 32)),
  };
}

export function sanitizeProviderLeadFullDetailsStatus({ eligible, reasons = [] }) {
  return {
    available: eligible === true,
    contract_version: PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION,
    reason: eligible === true ? '' : clean(reasons[0] || 'full_details_locked', 120),
  };
}
