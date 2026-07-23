export const PATIENT_CONVERSATION_OPERATIONAL_POLICY_VERSION = "viasee-patient-conversation-operational-policy-v1";
export const PATIENT_CONVERSATION_SERVER_STATE_VERSION = "viasee-patient-conversation-server-state-v1";

export const PATIENT_CONVERSATION_OPERATIONAL_POLICY = Object.freeze({
  rollout_mode: "admin_evaluation_only",
  admin_shadow_enabled: true,
  patient_visible_enabled: false,
  admin_shadow_sample_rate_basis_points: 10000,
  patient_visible_sample_rate_basis_points: 0,
  model_timeout_ms: 15000,
  timeout_behavior: "response_deadline_only",
  max_model_calls_per_request: 1,
  state_authority: "server_recomputed",
  state_persistence: "request_scoped_shadow",
});

const MAX_TURNS = 20;
const MAX_CHARACTERS = 8000;
const MAX_TURN_CHARACTERS = 1200;
const CLIENT_CONTROL_FIELDS = Object.freeze([
  "operational_state",
  "server_state",
  "rollout_mode",
  "rollout_enabled",
  "patient_visible_enabled",
  "sample_rate",
  "sample_rate_basis_points",
  "model_timeout_ms",
  "max_model_calls",
  "model_calls_used",
  "state_authority",
  "state_persistence",
]);

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function boundedConversation(payload = {}) {
  const fallbackText = payload?.search_text
    || payload?.query
    || payload?.free_text
    || payload?.search_query
    || "";
  const conversation = Array.isArray(payload?.conversation)
    ? payload.conversation
    : null;
  const source = conversation && conversation.length > 0
    ? conversation
    : (fallbackText ? [{ role: "user", content: fallbackText }] : []);
  const rows = source
    .slice(-MAX_TURNS)
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : (turn?.role === "user" ? "user" : ""),
      content: clean(turn?.content, MAX_TURN_CHARACTERS),
    }))
    .filter((turn) => turn.role && turn.content);

  let totalCharacters = 0;
  const bounded = [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (totalCharacters + row.content.length > MAX_CHARACTERS) continue;
    bounded.unshift(row);
    totalCharacters += row.content.length;
  }
  return bounded;
}

function normalizedEvaluationCaseId(payload = {}) {
  const value = clean(payload?.evaluation_case_id, 120);
  return /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(value) ? value : "";
}

function clientControlFieldsPresent(payload = {}) {
  return CLIENT_CONTROL_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(payload || {}, field));
}

function buildServerState(payload = {}) {
  const turns = boundedConversation(payload);
  const turnShape = turns.map((turn, index) => ({
    index,
    role: turn.role,
    content_length: turn.content.length,
  }));
  const evaluationCaseId = normalizedEvaluationCaseId(payload);
  const fingerprint = stableHash(JSON.stringify({
    evaluation_case_id: evaluationCaseId || null,
    turn_shape: turnShape,
  }));

  return Object.freeze({
    version: PATIENT_CONVERSATION_SERVER_STATE_VERSION,
    authority: PATIENT_CONVERSATION_OPERATIONAL_POLICY.state_authority,
    persistence: PATIENT_CONVERSATION_OPERATIONAL_POLICY.state_persistence,
    request_state_id: `patient-conversation-request-${fingerprint}`,
    turn_count: turns.length,
    user_turn_count: turns.filter((turn) => turn.role === "user").length,
    assistant_turn_count: turns.filter((turn) => turn.role === "assistant").length,
    character_count: turns.reduce((sum, turn) => sum + turn.content.length, 0),
    prior_state_present: Boolean(payload?.prior_state && typeof payload.prior_state === "object"),
    evaluation_case_id_present: Boolean(evaluationCaseId),
    client_control_fields_ignored: clientControlFieldsPresent(payload),
  });
}

function sampleBucket(serverState) {
  return Number.parseInt(stableHash(serverState?.request_state_id).slice(0, 8), 16) % 10000;
}

function operationalError(code, message) {
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = code;
  return error;
}

export function createPatientConversationOperationalController(payload = {}, options = {}) {
  const audience = options?.audience === "patient_visible" ? "patient_visible" : "admin_shadow";
  const serverState = buildServerState(payload);
  const policy = PATIENT_CONVERSATION_OPERATIONAL_POLICY;
  const enabled = audience === "patient_visible"
    ? policy.patient_visible_enabled
    : policy.admin_shadow_enabled;
  const sampleRateBasisPoints = audience === "patient_visible"
    ? policy.patient_visible_sample_rate_basis_points
    : policy.admin_shadow_sample_rate_basis_points;
  const bucket = sampleBucket(serverState);
  const sampleSelected = enabled && bucket < sampleRateBasisPoints;
  const timeoutOverride = Number(options?.timeoutMsForTest);
  const timeoutMs = Number.isInteger(timeoutOverride) && timeoutOverride > 0
    ? Math.min(timeoutOverride, policy.model_timeout_ms)
    : policy.model_timeout_ms;

  let modelCallsUsed = 0;
  let timeoutTriggered = false;
  let callBudgetExceeded = false;

  const controller = {
    allowed: sampleSelected,
    reason: !enabled
      ? "patient_conversation_rollout_disabled"
      : (!sampleSelected ? "patient_conversation_sample_excluded" : null),
    serverState,
    async invoke(invokeModel) {
      if (!sampleSelected) {
        throw operationalError(
          "PATIENT_CONVERSATION_ROLLOUT_DISABLED",
          "Patient conversation rollout is disabled by server policy.",
        );
      }
      if (modelCallsUsed >= policy.max_model_calls_per_request) {
        callBudgetExceeded = true;
        throw operationalError(
          "PATIENT_CONVERSATION_MODEL_CALL_BUDGET_EXCEEDED",
          "Patient conversation model call budget exceeded.",
        );
      }
      if (typeof invokeModel !== "function") {
        throw operationalError(
          "PATIENT_CONVERSATION_MODEL_INVOKER_REQUIRED",
          "A model invoker function is required.",
        );
      }

      modelCallsUsed += 1;
      let timeoutHandle;
      try {
        return await Promise.race([
          Promise.resolve().then(() => invokeModel()),
          new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
              timeoutTriggered = true;
              reject(operationalError(
                "PATIENT_CONVERSATION_MODEL_TIMEOUT",
                "Patient conversation model timed out.",
              ));
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    },
    snapshot() {
      return Object.freeze({
        policy_version: PATIENT_CONVERSATION_OPERATIONAL_POLICY_VERSION,
        rollout_mode: policy.rollout_mode,
        audience,
        rollout_control_source: "server_policy",
        admin_shadow_enabled: policy.admin_shadow_enabled,
        patient_visible_enabled: policy.patient_visible_enabled,
        sample_rate_basis_points: sampleRateBasisPoints,
        sample_bucket: bucket,
        sample_selected: sampleSelected,
        model_timeout_ms: timeoutMs,
        timeout_behavior: policy.timeout_behavior,
        timeout_control_source: "server_policy",
        timeout_triggered: timeoutTriggered,
        timeout_cancels_underlying_call: false,
        max_model_calls_per_request: policy.max_model_calls_per_request,
        model_calls_used: modelCallsUsed,
        call_budget_source: "server_policy",
        call_budget_exceeded: callBudgetExceeded,
        state_authority: policy.state_authority,
        state_persistence: policy.state_persistence,
        server_state: serverState,
      });
    },
  };

  return controller;
}

export function finalizePatientConversationOperationalEnvelope(envelope, controller) {
  const snapshot = controller?.snapshot?.() || null;
  if (!snapshot) return envelope;

  const timeoutFailed = snapshot.timeout_triggered === true;
  const budgetFailed = snapshot.call_budget_exceeded === true;
  const rolloutSkipped = snapshot.sample_selected !== true;
  const reason = timeoutFailed
    ? "conversation_model_timeout"
    : (budgetFailed
      ? "conversation_model_call_budget_exceeded"
      : (rolloutSkipped ? controller.reason : envelope?.reason));

  return {
    ...(envelope || {}),
    status: timeoutFailed || budgetFailed
      ? "unavailable"
      : (rolloutSkipped ? "skipped" : envelope?.status),
    reason: reason || null,
    interpretation: timeoutFailed || budgetFailed || rolloutSkipped
      ? null
      : (envelope?.interpretation ?? null),
    operational_metadata: snapshot,
  };
}
