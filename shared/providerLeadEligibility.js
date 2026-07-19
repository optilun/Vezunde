export const PROVIDER_LEAD_CONTRACT_VERSION = 'provider-lead-v1';
export const PROVIDER_LEAD_ELIGIBILITY_POLICY_VERSION = 'provider-lead-eligibility-v1';
export const PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION = 'patient-request-distribution-v1';

const SPECIALIZED_CONFIRMATION_LEVELS = new Set(['vezunde_verified']);
const GENERAL_CONFIRMATION_LEVELS = new Set(['provider_confirmed', 'vezunde_verified']);
const ELIGIBLE_BUCKETS = new Set(['top3', 'extended_confirmed']);

const INTENT_LABELS = Object.freeze({
  control_vedere: 'Control de vedere',
  control_copil: 'Control pentru copil',
  ochelari_lentile: 'Ochelari sau lentile',
  lentile_contact: 'Lentile de contact',
  reparatii_ochelari: 'Reparatii sau reglaje',
  simptome_oftalmologice: 'Evaluare pentru o problema la ochi',
  investigatii: 'Investigatii',
  unknown: 'Nevoie nespecificata',
});

const TIMING_LABELS = Object.freeze({
  cat_mai_repede: 'Cat mai repede',
  zilele_urmatoare: 'In zilele urmatoare',
  saptamana_aceasta: 'Saptamana aceasta',
  nu_e_urgent: 'Nu este urgent',
});

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function active(value) {
  const status = clean(value?.active_status || '').toLowerCase();
  return Boolean(value)
    && value.is_active !== false
    && !['inactiv', 'inactiva', 'inactive'].includes(status);
}

function serviceRowsForRequest(serviceRows, requestedKeys) {
  const requested = new Set(requestedKeys || []);
  return (serviceRows || []).filter((row) => requested.has(clean(row?.service_key)));
}

export function evaluateProviderLeadEligibility({ request, match, location, services }) {
  const reasons = [];
  if (!request || request.persistence_state !== 'complete') reasons.push('request_not_complete');
  if (!match || !ELIGIBLE_BUCKETS.has(match.result_bucket)) reasons.push('match_bucket_not_distributable');
  if (!location || location.status !== 'publicata') reasons.push('location_not_published');
  if (!active(location)) reasons.push('location_not_active');
  if (location?.profile_control_status === 'suspended') reasons.push('location_suspended');
  if (!['claimed', 'verified'].includes(location?.profile_control_status)) reasons.push('location_not_claimed');
  if (location?.request_intake_status !== 'active') reasons.push('request_intake_inactive');
  if (location?.accepts_patients_directly !== true) reasons.push('direct_patient_intake_disabled');

  const requestedKeys = Array.isArray(request?.service_keys) ? request.service_keys : [];
  const matchingRows = serviceRowsForRequest(services, requestedKeys).filter((row) => (
    active(row)
    && row.accepts_requests !== false
    && row.matching_allowed === true
    && row.migration_review_required !== true
  ));
  if (matchingRows.length === 0) reasons.push('no_request_service_eligible');

  const specialized = request?.matching_need_level === 'specialized_medical'
    || match?.need_level_snapshot === 'specialized_medical';
  if (specialized && location?.profile_control_status !== 'verified') reasons.push('specialized_requires_verified_profile');

  const allowedConfirmationLevels = specialized ? SPECIALIZED_CONFIRMATION_LEVELS : GENERAL_CONFIRMATION_LEVELS;
  const eligibleServiceRows = matchingRows.filter((row) => allowedConfirmationLevels.has(row.confirmation_level));
  if (matchingRows.length > 0 && eligibleServiceRows.length === 0) {
    reasons.push(specialized ? 'specialized_service_not_verified' : 'service_not_provider_confirmed');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    matched_service_keys: [...new Set(eligibleServiceRows.map((row) => clean(row.service_key)).filter(Boolean))],
  };
}

export function buildProviderLeadPreview(request) {
  const timingKey = clean(request?.timing_key);
  const parts = [
    INTENT_LABELS[request?.intent] || INTENT_LABELS.unknown,
    clean(request?.city),
    TIMING_LABELS[timingKey] || timingKey,
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 240);
}

export function patientIntentLabel(intent) {
  return INTENT_LABELS[intent] || INTENT_LABELS.unknown;
}
