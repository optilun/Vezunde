export const PATIENT_NO_RESPONSE_REVIEW_CONTRACT_VERSION = 'patient-no-response-review-v1';
export const PATIENT_NO_RESPONSE_INITIAL_REVIEW_HOURS = 48;
export const PATIENT_NO_RESPONSE_FOLLOW_UP_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function earliestLeadTimestamp(leads = []) {
  const values = (Array.isArray(leads) ? leads : [])
    .filter((lead) => lead?.delivery_state === 'available')
    .map((lead) => timestamp(lead?.eligible_at || lead?.created_date))
    .filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : null;
}

function cappedReviewAt(request, value) {
  const expiresAt = timestamp(request?.expires_at);
  if (!Number.isFinite(expiresAt)) return value;
  return Math.min(value, expiresAt);
}

export function patientNoResponseKeepWaitingPatch(request, now = new Date()) {
  const nowMs = now.getTime();
  const nextReviewMs = cappedReviewAt(request, nowMs + (PATIENT_NO_RESPONSE_FOLLOW_UP_HOURS * HOUR_MS));
  return {
    no_response_review_contract_version: PATIENT_NO_RESPONSE_REVIEW_CONTRACT_VERSION,
    no_response_review_action: 'keep_waiting',
    no_response_reviewed_at: now.toISOString(),
    no_response_next_review_at: iso(nextReviewMs),
    no_response_review_count: Math.max(0, Number(request?.no_response_review_count) || 0) + 1,
  };
}

export function derivePatientNoResponseReview({
  request = {},
  leads = [],
  activeResponseCount = 0,
  lifecycle = null,
  queryScope = 'locality',
  now = new Date(),
} = {}) {
  const safeRequest = /** @type {any} */ (request || {});
  const safeLifecycle = /** @type {any} */ (lifecycle || {});
  const availableLeads = (Array.isArray(leads) ? leads : []).filter((lead) => lead?.delivery_state === 'available');
  const leadCount = availableLeads.length;
  const responseCount = Math.max(0, Number(activeResponseCount) || 0);
  const terminal = safeLifecycle.terminal === true || ['resolved', 'closed', 'expired'].includes(clean(safeLifecycle.state, 40));
  const distributedAtMs = earliestLeadTimestamp(availableLeads) || timestamp(safeRequest.submitted_at);
  const storedNextReviewMs = timestamp(safeRequest.no_response_next_review_at);
  const initialReviewMs = Number.isFinite(distributedAtMs)
    ? distributedAtMs + (PATIENT_NO_RESPONSE_INITIAL_REVIEW_HOURS * HOUR_MS)
    : null;
  const reviewAtMs = Number.isFinite(storedNextReviewMs)
    ? storedNextReviewMs
    : initialReviewMs;
  const nowMs = now.getTime();
  const reviewAvailable = !terminal
    && responseCount === 0
    && leadCount > 0
    && Number.isFinite(reviewAtMs)
    && nowMs >= reviewAtMs;
  const hoursRemaining = Number.isFinite(reviewAtMs) && nowMs < reviewAtMs
    ? Math.max(1, Math.ceil((reviewAtMs - nowMs) / HOUR_MS))
    : 0;

  let state = 'not_distributed';
  let stateLabel = 'Cererea nu a fost distribuita';
  if (terminal) {
    state = 'terminal';
    stateLabel = 'Cererea este finalizata';
  } else if (responseCount > 0) {
    state = 'responded';
    stateLabel = 'Exista raspunsuri';
  } else if (leadCount > 0 && reviewAvailable) {
    state = 'review_available';
    stateLabel = 'Este disponibila o revizuire';
  } else if (leadCount > 0) {
    state = 'waiting';
    stateLabel = 'Se asteapta raspunsuri';
  }

  const normalizedScope = clean(queryScope, 40) === 'county' ? 'county' : 'locality';
  return {
    contract_version: PATIENT_NO_RESPONSE_REVIEW_CONTRACT_VERSION,
    state,
    state_label: stateLabel,
    lead_count: leadCount,
    response_count: responseCount,
    distributed_at: iso(distributedAtMs),
    review_after: iso(reviewAtMs),
    hours_remaining: hoursRemaining,
    review_available: reviewAvailable,
    can_keep_waiting: reviewAvailable,
    can_reformulate: reviewAvailable,
    can_expand_county: reviewAvailable && normalizedScope !== 'county',
    query_scope: normalizedScope,
    review_count: Math.max(0, Number(safeRequest.no_response_review_count) || 0),
    last_action: clean(safeRequest.no_response_review_action, 40) || null,
    last_reviewed_at: safeRequest.no_response_reviewed_at || null,
    next_review_at: safeRequest.no_response_next_review_at || null,
    automatic_transition: false,
  };
}
