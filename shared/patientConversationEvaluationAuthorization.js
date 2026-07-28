export const PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION =
  "viasee-patient-conversation-evaluation-authorization-v1";

export const PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE =
  "repository_fixture_manifest";

const MAX_AUTHORIZATION_LIFETIME_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizedJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Evaluation authorization contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  throw new Error("Evaluation authorization contains an unsupported value.");
}

function payloadWithoutAuthorization(payload = {}) {
  const controlled = normalizedJson(isPlainObject(payload) ? payload : {});
  delete controlled.evaluation_authorization;
  return controlled;
}

function authorizationClaims(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    version: clean(source.version),
    key_id: clean(source.key_id, 80),
    run_id: clean(source.run_id, 120),
    nonce: clean(source.nonce, 160),
    issued_at: clean(source.issued_at, 40),
    expires_at: clean(source.expires_at, 40),
    max_model_calls: Number(source.max_model_calls),
  };
}

function authorizationMessage(payload, claims) {
  return canonicalJson({
    authorization: authorizationClaims(claims),
    payload: payloadWithoutAuthorization(payload),
  });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hmacSignature(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return base64Url(new Uint8Array(signature));
}

function constantTimeEqual(left, right) {
  const leftText = String(left ?? "");
  const rightText = String(right ?? "");
  const length = Math.max(leftText.length, rightText.length);
  let difference = leftText.length ^ rightText.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftText.charCodeAt(index) || 0) ^ (rightText.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function validIdentifier(value, maxLength = 120) {
  const text = clean(value, maxLength);
  return /^[a-z0-9][a-z0-9._:-]*$/i.test(text) ? text : "";
}

function validIsoTimestamp(value) {
  const text = clean(value, 40);
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? { text, timestamp } : null;
}

function normalizedPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function rejection(reason, replayProtectionScope = "unavailable") {
  return {
    allowed: false,
    reason,
    metadata: {
      authorization_version: PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
      synthetic_fixture_verified: false,
      replay_protection_scope: replayProtectionScope,
    },
  };
}

function authorizationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function fixtureMetadata(payload = {}) {
  const source = isPlainObject(payload?.evaluation_fixture)
    ? payload.evaluation_fixture
    : {};
  const fingerprint = clean(source.fixture_fingerprint, 64).toLowerCase();
  return {
    synthetic: source.synthetic === true,
    source: clean(source.source, 80),
    fixture_fingerprint: /^[a-f0-9]{64}$/.test(fingerprint) ? fingerprint : "",
  };
}

export async function createPatientConversationEvaluationAuthorization({
  payload,
  secret,
  keyId,
  runId,
  nonce,
  issuedAt,
  expiresAt,
  maxModelCalls,
} = {}) {
  const controlledSecret = String(secret ?? "");
  if (controlledSecret.length < 32) {
    throw new Error("Evaluation signing secret must contain at least 32 characters.");
  }
  const claims = authorizationClaims({
    version: PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
    key_id: keyId,
    run_id: runId,
    nonce,
    issued_at: issuedAt,
    expires_at: expiresAt,
    max_model_calls: maxModelCalls,
  });
  if (!validIdentifier(claims.key_id, 80)) throw new Error("Evaluation key id is invalid.");
  if (!validIdentifier(claims.run_id, 120)) throw new Error("Evaluation run id is invalid.");
  if (!validIdentifier(claims.nonce, 160) || claims.nonce.length < 16) {
    throw new Error("Evaluation nonce is invalid.");
  }
  if (!validIsoTimestamp(claims.issued_at) || !validIsoTimestamp(claims.expires_at)) {
    throw new Error("Evaluation authorization timestamps are invalid.");
  }
  if (!normalizedPositiveInteger(claims.max_model_calls)) {
    throw new Error("Evaluation model-call budget is invalid.");
  }
  const signature = await hmacSignature(
    controlledSecret,
    authorizationMessage(payload, claims),
  );
  return {
    ...claims,
    signature,
  };
}

export async function authorizePatientConversationSyntheticEvaluation(
  payload = {},
  options = {},
) {
  if (options?.enabled !== true) {
    return rejection("patient_conversation_evaluation_disabled");
  }
  if (clean(options?.runtimeContext, 80) !== "isolated_evaluation") {
    return rejection("patient_conversation_evaluation_context_invalid");
  }

  const secret = String(options?.secret ?? "");
  const expectedKeyId = validIdentifier(options?.keyId, 80);
  const serverMaxCalls = normalizedPositiveInteger(options?.maxModelCallsPerRun);
  const usageStore = options?.usageStore;
  const usageStoreScope = validIdentifier(usageStore?.scope, 80) || "unavailable";
  if (
    secret.length < 32
    || !expectedKeyId
    || !serverMaxCalls
    || usageStore?.configured !== true
    || typeof usageStore?.reserveNonce !== "function"
    || typeof usageStore?.consumeModelCall !== "function"
  ) {
    return rejection("patient_conversation_evaluation_misconfigured");
  }

  const evaluationCaseId = validIdentifier(payload?.evaluation_case_id, 120);
  const evaluationAttempt = normalizedPositiveInteger(payload?.evaluation_attempt);
  const fixture = fixtureMetadata(payload);
  if (
    !evaluationCaseId
    || !evaluationAttempt
    || evaluationAttempt > 5
    || !fixture.synthetic
    || fixture.source !== PATIENT_CONVERSATION_EVALUATION_FIXTURE_SOURCE
    || !fixture.fixture_fingerprint
  ) {
    return rejection("patient_conversation_synthetic_fixture_required");
  }

  const rawAuthorization = isPlainObject(payload?.evaluation_authorization)
    ? payload.evaluation_authorization
    : {};
  const claims = authorizationClaims(rawAuthorization);
  const signature = clean(rawAuthorization.signature, 120);
  const runId = validIdentifier(claims.run_id, 120);
  const nonce = validIdentifier(claims.nonce, 160);
  const issuedAt = validIsoTimestamp(claims.issued_at);
  const expiresAt = validIsoTimestamp(claims.expires_at);
  const maxModelCalls = normalizedPositiveInteger(claims.max_model_calls);
  const nowMs = Number.isFinite(Number(options?.nowMs))
    ? Number(options.nowMs)
    : Date.now();

  if (
    claims.version !== PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION
    || claims.key_id !== expectedKeyId
    || !runId
    || !nonce
    || nonce.length < 16
    || !issuedAt
    || !expiresAt
    || !maxModelCalls
    || maxModelCalls > serverMaxCalls
    || !signature
  ) {
    return rejection("patient_conversation_evaluation_authorization_invalid");
  }
  if (
    issuedAt.timestamp > nowMs + CLOCK_SKEW_MS
    || expiresAt.timestamp <= nowMs
    || expiresAt.timestamp <= issuedAt.timestamp
    || expiresAt.timestamp - issuedAt.timestamp > MAX_AUTHORIZATION_LIFETIME_MS
  ) {
    return rejection("patient_conversation_evaluation_authorization_expired");
  }

  const expectedSignature = await hmacSignature(
    secret,
    authorizationMessage(payload, claims),
  );
  if (!constantTimeEqual(signature, expectedSignature)) {
    return rejection("patient_conversation_evaluation_authorization_invalid");
  }

  let nonceReservation;
  try {
    nonceReservation = await usageStore.reserveNonce({
      keyId: expectedKeyId,
      runId,
      nonce,
      maxModelCalls: Math.min(maxModelCalls, serverMaxCalls),
      expiresAtMs: expiresAt.timestamp,
      nowMs,
    });
  } catch (error) {
    if (
      error?.code === "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH"
    ) {
      return rejection(
        "patient_conversation_evaluation_run_limit_mismatch",
        usageStoreScope,
      );
    }
    return rejection(
      "patient_conversation_evaluation_usage_store_unavailable",
      usageStoreScope,
    );
  }
  if (nonceReservation?.reserved !== true) {
    return rejection(
      "patient_conversation_evaluation_replay_blocked",
      usageStoreScope,
    );
  }

  const metadata = {
    authorization_version: PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_VERSION,
    synthetic_fixture_verified: true,
    fixture_source: fixture.source,
    fixture_fingerprint: fixture.fixture_fingerprint,
    key_id: expectedKeyId,
    run_id: runId,
    expires_at: expiresAt.text,
    max_model_calls: maxModelCalls,
    model_calls_used_global: null,
    replay_protection_scope: usageStoreScope,
  };
  let modelCallConsumed = false;

  return {
    allowed: true,
    reason: null,
    metadata,
    async consumeModelCall() {
      if (modelCallConsumed) {
        throw authorizationError(
          "PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_CONSUMED",
          "Evaluation authorization has already consumed its model-call reservation.",
        );
      }
      modelCallConsumed = true;

      let consumption;
      try {
        consumption = await usageStore.consumeModelCall({
          keyId: expectedKeyId,
          runId,
          maxModelCalls: Math.min(maxModelCalls, serverMaxCalls),
          expiresAtMs: expiresAt.timestamp,
          nowMs: Number.isFinite(Number(options?.nowMs))
            ? nowMs
            : Date.now(),
        });
      } catch (error) {
        if (
          error?.code === "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH"
        ) {
          throw authorizationError(
            "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH",
            "Evaluation run was initialized with a different model-call budget.",
          );
        }
        throw authorizationError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation usage store is unavailable.",
        );
      }
      if (consumption?.allowed !== true) {
        throw authorizationError(
          "PATIENT_CONVERSATION_EVALUATION_RUN_BUDGET_EXCEEDED",
          "Evaluation model-call budget has been exceeded.",
        );
      }

      const nextCallsUsed = Number(consumption.modelCallsUsed);
      if (!Number.isInteger(nextCallsUsed) || nextCallsUsed <= 0) {
        throw authorizationError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation usage store returned an invalid counter.",
        );
      }
      metadata.model_calls_used_global = nextCallsUsed;
      return {
        max_model_calls: maxModelCalls,
        model_calls_used_global: nextCallsUsed,
        replay_protection_scope: usageStoreScope,
      };
    },
  };
}
