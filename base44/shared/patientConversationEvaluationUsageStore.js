const PATIENT_CONVERSATION_EVALUATION_REDIS_PREFIX =
  "viasee:patient-conversation:evaluation:v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 3000;
const MAX_REQUEST_TIMEOUT_MS = 10000;
const MAX_USAGE_TTL_SECONDS = 16 * 60;

const RESERVE_NONCE_SCRIPT = `
local requested_max = tonumber(ARGV[1])
local requested_ttl = tonumber(ARGV[2])
local existing_max = redis.call('HGET', KEYS[2], 'max_calls')
local used = tonumber(redis.call('HGET', KEYS[2], 'used_calls') or '0')

if existing_max and tonumber(existing_max) ~= requested_max then
  return {-1, used, tonumber(existing_max)}
end

if redis.call('EXISTS', KEYS[1]) == 1 then
  return {0, used, tonumber(existing_max or requested_max)}
end

if not existing_max then
  redis.call('HSET', KEYS[2], 'max_calls', requested_max, 'used_calls', 0)
end

redis.call('SET', KEYS[1], '1', 'NX', 'EX', requested_ttl)
local current_ttl = redis.call('TTL', KEYS[2])
if current_ttl < requested_ttl then
  redis.call('EXPIRE', KEYS[2], requested_ttl)
end
return {1, used, requested_max}
`.trim();

const CONSUME_MODEL_CALL_SCRIPT = `
local requested_max = tonumber(ARGV[1])
local requested_ttl = tonumber(ARGV[2])
local existing_max = redis.call('HGET', KEYS[1], 'max_calls')
local used = tonumber(redis.call('HGET', KEYS[1], 'used_calls') or '0')

if existing_max and tonumber(existing_max) ~= requested_max then
  return {-1, used, tonumber(existing_max)}
end

if not existing_max then
  redis.call('HSET', KEYS[1], 'max_calls', requested_max, 'used_calls', 0)
end

local current_ttl = redis.call('TTL', KEYS[1])
if current_ttl < requested_ttl then
  redis.call('EXPIRE', KEYS[1], requested_ttl)
end

if used >= requested_max then
  return {0, used, requested_max}
end

local next_used = redis.call('HINCRBY', KEYS[1], 'used_calls', 1)
return {1, next_used, requested_max}
`.trim();

function usageStoreError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function controlledHttpsEndpoint(value) {
  try {
    const parsed = new URL(String(value ?? "").trim());
    if (parsed.protocol !== "https:") return "";
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/g, "");
  } catch (_error) {
    return "";
  }
}

function normalizedPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function ttlSeconds(expiresAtMs, nowMs) {
  const remainingMs = Number(expiresAtMs) - Number(nowMs);
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    throw usageStoreError(
      "PATIENT_CONVERSATION_EVALUATION_AUTHORIZATION_EXPIRED",
      "Evaluation authorization has expired.",
    );
  }
  return Math.min(
    MAX_USAGE_TTL_SECONDS,
    Math.max(1, Math.ceil(remainingMs / 1000)),
  );
}

async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value ?? "")),
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function opaqueRedisKey(kind, values) {
  const digest = await sha256Hex(values.join(":"));
  return `${PATIENT_CONVERSATION_EVALUATION_REDIS_PREFIX}:${kind}:${digest}`;
}

function normalizedRedisResult(payload) {
  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || !Object.prototype.hasOwnProperty.call(payload, "result")
  ) {
    throw usageStoreError(
      "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
      "Evaluation usage store returned an invalid response.",
    );
  }
  return payload.result;
}

export function createPatientConversationEvaluationRedisUsageStore({
  url,
  token,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  const endpoint = controlledHttpsEndpoint(url);
  const controlledToken = String(token ?? "").trim();
  const controlledTimeoutMs = Math.min(
    MAX_REQUEST_TIMEOUT_MS,
    Math.max(
      250,
      normalizedPositiveInteger(requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  );
  const configured = Boolean(
    endpoint
    && controlledToken.length >= 20
    && typeof fetchImpl === "function",
  );

  async function command(parts) {
    if (!configured) {
      throw usageStoreError(
        "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
        "Evaluation usage store is not configured.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), controlledTimeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${controlledToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parts),
        signal: controller.signal,
      });
      if (!response?.ok) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation usage store request failed.",
        );
      }
      const payload = await response.json();
      if (payload?.error) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation usage store command failed.",
        );
      }
      return normalizedRedisResult(payload);
    } catch (error) {
      if (
        error?.code === "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE"
      ) {
        throw error;
      }
      throw usageStoreError(
        "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
        "Evaluation usage store is unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    scope: "distributed_redis",
    configured,
    async reserveNonce({
      keyId,
      runId,
      nonce,
      maxModelCalls,
      expiresAtMs,
      nowMs,
    } = {}) {
      const controlledMax = normalizedPositiveInteger(maxModelCalls);
      if (!controlledMax) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH",
          "Evaluation model-call budget is invalid.",
        );
      }
      const nonceKey = await opaqueRedisKey("nonce", [keyId, runId, nonce]);
      const runKey = await opaqueRedisKey("run", [keyId, runId]);
      const result = await command([
        "EVAL",
        RESERVE_NONCE_SCRIPT,
        "2",
        nonceKey,
        runKey,
        String(controlledMax),
        String(ttlSeconds(expiresAtMs, nowMs)),
      ]);
      if (!Array.isArray(result) || result.length < 3) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation nonce reservation returned an invalid result.",
        );
      }
      const status = Number(result[0]);
      const modelCallsUsed = Number(result[1]);
      const storedMaxCalls = Number(result[2]);
      if (status === -1) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH",
          "Evaluation run was initialized with a different model-call budget.",
        );
      }
      if (status === 0) {
        return { reserved: false, modelCallsUsed, maxModelCalls: storedMaxCalls };
      }
      if (status === 1) {
        return { reserved: true, modelCallsUsed, maxModelCalls: storedMaxCalls };
      }
      throw usageStoreError(
        "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
        "Evaluation nonce reservation returned an unknown status.",
      );
    },
    async consumeModelCall({
      keyId,
      runId,
      maxModelCalls,
      expiresAtMs,
      nowMs,
    } = {}) {
      const controlledMax = normalizedPositiveInteger(maxModelCalls);
      if (!controlledMax) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH",
          "Evaluation model-call budget is invalid.",
        );
      }
      const key = await opaqueRedisKey("run", [keyId, runId]);
      const result = await command([
        "EVAL",
        CONSUME_MODEL_CALL_SCRIPT,
        "1",
        key,
        String(controlledMax),
        String(ttlSeconds(expiresAtMs, nowMs)),
      ]);
      if (!Array.isArray(result) || result.length < 3) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation run reservation returned an invalid result.",
        );
      }
      const status = Number(result[0]);
      const modelCallsUsed = Number(result[1]);
      const storedMaxCalls = Number(result[2]);
      if (
        !Number.isInteger(modelCallsUsed)
        || modelCallsUsed < 0
        || !Number.isInteger(storedMaxCalls)
        || storedMaxCalls <= 0
      ) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
          "Evaluation run reservation returned invalid counters.",
        );
      }
      if (status === -1) {
        throw usageStoreError(
          "PATIENT_CONVERSATION_EVALUATION_RUN_LIMIT_MISMATCH",
          "Evaluation run was initialized with a different model-call budget.",
        );
      }
      if (status === 0) {
        return {
          allowed: false,
          modelCallsUsed,
          maxModelCalls: storedMaxCalls,
        };
      }
      if (status === 1) {
        return {
          allowed: true,
          modelCallsUsed,
          maxModelCalls: storedMaxCalls,
        };
      }
      throw usageStoreError(
        "PATIENT_CONVERSATION_EVALUATION_USAGE_STORE_UNAVAILABLE",
        "Evaluation run reservation returned an unknown status.",
      );
    },
  };
}
