export const PATIENT_REQUEST_RECOVERY_CONTRACT_VERSION = 'patient-request-recovery-v1';
export const PATIENT_REQUEST_RECOVERY_CONSENT_VERSION = 'patient-request-recovery-review-v1';

export const PATIENT_REQUEST_RECOVERY_STATUSES = Object.freeze([
  'queued',
  'in_review',
  'completed',
  'closed',
]);

export const PATIENT_REQUEST_RECOVERY_OUTCOMES = Object.freeze([
  'pending',
  'criteria_revision_recommended',
  'location_change_recommended',
  'no_confirmed_option',
  'directory_option_identified',
  'data_correction_needed',
]);

const STATUS_LABELS = Object.freeze({
  queued: 'In asteptare pentru verificare',
  in_review: 'In verificare',
  completed: 'Verificare finalizata',
  closed: 'Verificare inchisa',
});

const OUTCOME_LABELS = Object.freeze({
  pending: 'Rezultat in asteptare',
  criteria_revision_recommended: 'Este recomandata revizuirea criteriilor',
  location_change_recommended: 'Este recomandata schimbarea localitatii',
  no_confirmed_option: 'Nu a fost identificata o optiune confirmata',
  directory_option_identified: 'A fost identificata o optiune din director',
  data_correction_needed: 'Datele directorului necesita verificare',
});

const REASON_LABELS = Object.freeze({
  no_local_providers: 'Nu exista inca furnizori publicati pentru aceasta nevoie in localitatea selectata',
  local_service_data_missing: 'Exista furnizori locali, dar lipsesc datele necesare pentru potrivire',
  no_eligible_local_results: 'Nu exista momentan un profil eligibil pentru aceasta nevoie',
  query_not_mapped: 'Descrierea nu a putut fi legata de un serviciu din catalog',
  query_required: 'Descrierea cererii necesita clarificare',
  canonical_locality_required: 'Localitatea nu a putut fi validata',
  no_local_results: 'Nu exista rezultate locale potrivite',
  no_search_results: 'Cautarea nu a returnat rezultate',
});

const REASON_SET = new Set(Object.keys(REASON_LABELS));
const STATUS_SET = new Set(PATIENT_REQUEST_RECOVERY_STATUSES);
const OUTCOME_SET = new Set(PATIENT_REQUEST_RECOVERY_OUTCOMES);

export class PatientRequestRecoveryValidationError extends Error {
  constructor(message, field = '') {
    super(message);
    this.name = 'PatientRequestRecoveryValidationError';
    this.field = field;
  }
}

function clean(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanList(values, maxItems = 30, maxLength = 120) {
  return [...new Set((Array.isArray(values) ? values : [])
    .slice(0, maxItems)
    .map((value) => clean(value, maxLength))
    .filter(Boolean))];
}

function boundedCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100000, Math.floor(parsed)));
}

export function patientRequestRecoveryReason(coverageStatus) {
  const value = clean(coverageStatus, 80);
  return REASON_SET.has(value) ? value : 'no_search_results';
}

export function sanitizePatientRequestRecoveryCoverageCounts(value = {}) {
  return {
    local_provider_count: boundedCount(value.local_provider_count),
    configured_matching_provider_count: boundedCount(value.configured_matching_provider_count),
    eligible_provider_count: boundedCount(value.eligible_provider_count),
  };
}

export function buildPatientRequestRecoveryRecord({
  request,
  consentVersion,
  coverageCounts = {},
} = {}) {
  if (!request?.id) {
    throw new PatientRequestRecoveryValidationError('Cererea nu a putut fi identificata.', 'request_id');
  }
  if (consentVersion !== PATIENT_REQUEST_RECOVERY_CONSENT_VERSION) {
    throw new PatientRequestRecoveryValidationError('Acordul pentru verificarea cererii nu este valid.', 'recovery_consent_version');
  }
  if (Number(request.match_count || 0) > 0) {
    throw new PatientRequestRecoveryValidationError('Verificarea interna este disponibila numai pentru cererile fara rezultate.', 'request_id');
  }

  const counts = sanitizePatientRequestRecoveryCoverageCounts(coverageCounts);
  const now = new Date().toISOString();
  return {
    contract_version: PATIENT_REQUEST_RECOVERY_CONTRACT_VERSION,
    request_id: clean(request.id, 120),
    public_reference: clean(request.public_reference, 120),
    trigger: 'no_search_results',
    reason: patientRequestRecoveryReason(request.matching_coverage_status),
    status: 'queued',
    outcome: 'pending',
    intent: clean(request.intent, 120),
    service_keys: cleanList(request.service_keys, 30, 120),
    city: clean(request.city, 120),
    county: clean(request.county, 120),
    coverage_status: clean(request.matching_coverage_status, 80),
    ...counts,
    consent_version: consentVersion,
    consent_at: now,
    queued_at: now,
    patient_update: '',
    internal_note: '',
  };
}

export function sanitizePatientRequestRecovery(row) {
  if (!row?.id) return null;
  const status = STATUS_SET.has(row.status) ? row.status : 'queued';
  const outcome = OUTCOME_SET.has(row.outcome) ? row.outcome : 'pending';
  const reason = patientRequestRecoveryReason(row.reason || row.coverage_status);
  return {
    contract_version: PATIENT_REQUEST_RECOVERY_CONTRACT_VERSION,
    id: clean(row.id, 120),
    status,
    status_label: STATUS_LABELS[status],
    outcome,
    outcome_label: OUTCOME_LABELS[outcome],
    reason,
    reason_label: REASON_LABELS[reason],
    requested_at: row.consent_at || row.queued_at || row.created_date || null,
    updated_at: row.updated_date || row.review_started_at || row.completed_at || null,
    patient_update: clean(row.patient_update, 500),
  };
}
