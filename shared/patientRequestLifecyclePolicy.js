export const PATIENT_REQUEST_LIFECYCLE_CONTRACT_VERSION = 'patient-request-lifecycle-v1';

export const PATIENT_REQUEST_LIFECYCLE_STATES = Object.freeze({
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  EXPIRED: 'expired',
});

export const PATIENT_REQUEST_LIFECYCLE_STAGES = Object.freeze({
  SUBMITTED: 'submitted',
  DISTRIBUTED: 'distributed',
  WAITING_RESPONSES: 'waiting_responses',
  HAS_RESPONSES: 'has_responses',
  CONVERSATION_ACTIVE: 'conversation_active',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  EXPIRED: 'expired',
});

/** @type {Set<string>} */
const LIFECYCLE_STATE_VALUES = new Set(Object.values(PATIENT_REQUEST_LIFECYCLE_STATES));
/** @type {Set<string>} */
const LIFECYCLE_STAGE_VALUES = new Set(Object.values(PATIENT_REQUEST_LIFECYCLE_STAGES));
/** @type {Set<string>} */
const TERMINAL_STATES = new Set([
  PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED,
  PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED,
  PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED,
]);

/** @type {Record<string, string>} */
const STATE_LABELS = Object.freeze({
  active: 'Activa',
  resolved: 'Rezolvata',
  closed: 'Inchisa',
  expired: 'Expirata',
});

/** @type {Record<string, string>} */
const STAGE_LABELS = Object.freeze({
  submitted: 'Trimisa',
  distributed: 'Distribuita',
  waiting_responses: 'Asteapta raspunsuri',
  has_responses: 'Are raspunsuri',
  conversation_active: 'Conversatie activa',
  resolved: 'Rezolvata',
  closed: 'Inchisa',
  expired: 'Expirata',
});

function clean(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

export function isPatientRequestLifecycleTerminal(state) {
  return TERMINAL_STATES.has(clean(state, 40));
}

export function patientRequestHasExpired(request, now = new Date()) {
  const timestamp = Date.parse(String(request?.expires_at || ''));
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function persistedPatientRequestLifecycleState(request) {
  const explicit = clean(request?.lifecycle_state, 40);
  if (LIFECYCLE_STATE_VALUES.has(explicit)) return explicit;
  if (request?.status === 'expirata') return PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED;
  if (request?.status === 'inchisa') return PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED;
  return PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE;
}

export function derivePatientRequestLifecycle({
  request,
  leadCount = 0,
  activeResponseCount = 0,
  openConversationCount = 0,
  now = new Date(),
} = {}) {
  const persistedState = persistedPatientRequestLifecycleState(request);
  if (persistedState === PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED) {
    return { state: persistedState, stage: PATIENT_REQUEST_LIFECYCLE_STAGES.RESOLVED, terminal: true };
  }
  if (persistedState === PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED) {
    return { state: persistedState, stage: PATIENT_REQUEST_LIFECYCLE_STAGES.CLOSED, terminal: true };
  }
  if (persistedState === PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED || patientRequestHasExpired(request, now)) {
    return { state: PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED, stage: PATIENT_REQUEST_LIFECYCLE_STAGES.EXPIRED, terminal: true };
  }

  let stage = PATIENT_REQUEST_LIFECYCLE_STAGES.SUBMITTED;
  if (Number(openConversationCount) > 0) stage = PATIENT_REQUEST_LIFECYCLE_STAGES.CONVERSATION_ACTIVE;
  else if (Number(activeResponseCount) > 0) stage = PATIENT_REQUEST_LIFECYCLE_STAGES.HAS_RESPONSES;
  else if (Number(leadCount) > 0) stage = PATIENT_REQUEST_LIFECYCLE_STAGES.WAITING_RESPONSES;
  else if (['pregatita_pentru_distribuire', 'procesata'].includes(request?.status)) stage = PATIENT_REQUEST_LIFECYCLE_STAGES.DISTRIBUTED;

  return { state: PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE, stage, terminal: false };
}

export function canTransitionPatientRequestLifecycle(currentState, targetState) {
  const current = clean(currentState, 40) || PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE;
  const target = clean(targetState, 40);
  if (!LIFECYCLE_STATE_VALUES.has(target)) return false;
  if (current === target) return true;
  return current === PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE
    && TERMINAL_STATES.has(target);
}

export function patientRequestLifecyclePatch(targetState, actor = 'patient', now = new Date()) {
  const state = clean(targetState, 40);
  const timestamp = now.toISOString();
  const base = {
    lifecycle_contract_version: PATIENT_REQUEST_LIFECYCLE_CONTRACT_VERSION,
    lifecycle_state: state,
    lifecycle_stage: state,
    lifecycle_updated_at: timestamp,
  };
  if (state === PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED) {
    return { ...base, status: 'inchisa', resolved_at: timestamp, closed_by: clean(actor, 40) || 'patient' };
  }
  if (state === PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED) {
    return { ...base, status: 'inchisa', closed_at: timestamp, closed_by: clean(actor, 40) || 'patient' };
  }
  if (state === PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED) {
    return { ...base, status: 'expirata', expiration_processed_at: timestamp, closed_by: 'system' };
  }
  return { ...base, status: 'salvata' };
}

export function sanitizePatientRequestLifecycle(lifecycle) {
  const state = LIFECYCLE_STATE_VALUES.has(lifecycle?.state)
    ? lifecycle.state
    : PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE;
  const stage = LIFECYCLE_STAGE_VALUES.has(lifecycle?.stage)
    ? lifecycle.stage
    : PATIENT_REQUEST_LIFECYCLE_STAGES.SUBMITTED;
  return {
    contract_version: PATIENT_REQUEST_LIFECYCLE_CONTRACT_VERSION,
    state,
    state_label: STATE_LABELS[state] || 'Activa',
    stage,
    stage_label: STAGE_LABELS[stage] || 'Trimisa',
    terminal: isPatientRequestLifecycleTerminal(state),
    can_resolve: state === PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE,
    can_close: state === PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE,
  };
}
