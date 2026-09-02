import { SUPPORTED_PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSIONS } from './providerLeadEligibility.js';
import { redactPatientConversationText } from './patientConversationGuardrails.js';
import { hasProviderFeature } from './providerEntitlementPolicy.js';

export const PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION = 'provider-lead-full-details-top3-pro-v2';

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
  if (!SUPPORTED_PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSIONS.includes(
    contact?.provider_request_distribution_consent_version,
  )) {
    reasons.push('distribution_consent_version_not_supported');
  }
  // 2026-09-01 (contract v2): pana acum, un detailed_message gol facea lead-ul inelegibil
  // pentru detalii complete, desi textul de deschidere (`original_message`) exista si el pe
  // cerere. Asta obliga pacientul sa scrie inca o data ceva ce descrisese deja in caseta din
  // hero. Acum e suficient ca cererea sa contina cel putin un text liber; codul de motiv
  // ramane acelasi ca sa nu se schimbe contractul de erori catre client.
  if (!clean(request?.detailed_message, 2000) && !clean(request?.original_message, 800)) {
    reasons.push('detailed_message_missing');
  }
  return { eligible: reasons.length === 0, reasons };
}

// 2026-09-01: pana acum, furnizorul primea numai `detailed_message` - campul "mai e ceva
// ce ar trebui sa stie?" de la finalul chestionarului. Textul cu care pacientul a pornit
// cautarea (`original_message`, caseta din hero) era persistat pe PatientRequest, dar nu
// ajungea niciodata la furnizor, desi e adesea singurul loc unde pacientul isi descrie
// problema cu cuvintele lui. Il trimitem acum separat, nu concatenat, ca furnizorul sa
// vada ce a scris pacientul la inceput si ce a adaugat la final.
// Contract v2. Ramane strict in full_details (Top 3 + Pro + acord activ); preview-ul Free
// nu il primeste - sanitizeProviderLeadForFreeInbox lucreaza pe lista alba.
// Acordurile al caror text enumera si mesajul de deschidere. Un acord mai vechi ramane
// valid pentru distribuire, dar nu autorizeaza livrarea acestui camp.
const PATIENT_REQUEST_OPENING_MESSAGE_CONSENT_VERSIONS = Object.freeze([
  'patient-request-distribution-top3-pro-v3',
]);

export function buildProviderLeadFullDetails({ request, contact }) {
  const emailVerified = contact?.contact_email_verified === true;
  const openingMessageAuthorized = PATIENT_REQUEST_OPENING_MESSAGE_CONSENT_VERSIONS.includes(
    contact?.provider_request_distribution_consent_version,
  );
  // Textul din hero e o caseta de cautare: pacientul poate scrie acolo un telefon sau un
  // email fara sa realizeze ca ajunge la furnizor. Il redactam cu exact aceleasi reguli ca
  // mesajele din chatul controlat, ca promisiunea "telefonul ramane ascuns pana il aprobi
  // tu" sa nu fie ocolita pe canalul asta.
  const originalMessage = openingMessageAuthorized
    ? redactPatientConversationText(request?.original_message, 800)
    : '';
  const detailedMessage = clean(request?.detailed_message, 2000);
  return {
    client_name: clean(contact?.contact_name, 120),
    client_email: emailVerified ? clean(contact?.contact_email, 254) : '',
    client_email_verified: emailVerified,
    // Nu il repetam daca pacientul a scris acelasi lucru in ambele campuri.
    original_message: originalMessage === detailedMessage ? '' : originalMessage,
    detailed_message: detailedMessage,
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
