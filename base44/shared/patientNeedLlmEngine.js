// Motor economic pentru interpretarea nevoii pacientului (Etapa 1, 2026-10-05).
// 1) cache dupa amprenta textului normalizat + context (fara textul pacientului salvat);
// 2) model rapid intai; model puternic doar la incredere scazuta sau semnale de risc;
// 3) limita de timp - la depasire se arunca eroare, iar apelantul revine la sistemul fix.

export const FAST_MODEL = "gemini_3_flash";
export const STRONG_MODEL = "claude_sonnet_4_6";
const FAST_TIMEOUT_MS = 8000;
const STRONG_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 30 * 86400000;
export const ENGINE_VERSION = "patient-need-engine-v1";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildCacheKey({ text, deterministicIntent, answers }) {
  const answerPart = (Array.isArray(answers) ? answers : [])
    .map((a) => `${a?.question_key}=${a?.answer_value}`)
    .sort()
    .join("|");
  return sha256(`${ENGINE_VERSION}#${normalize(text)}#${deterministicIntent || ""}#${answerPart}`);
}

function withTimeout(promise, ms) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => {
      const error = new Error("llm_timeout");
      error.code = "LLM_TIMEOUT";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}

function needsEscalation(raw) {
  if (!raw || typeof raw !== "object") return true;
  if (raw.confidence_band === "low") return true;
  if (Array.isArray(raw.possible_safety_flags) && raw.possible_safety_flags.length > 0) return true;
  return false;
}

async function readCache(svc, key) {
  const page = await svc.entities.AIInterpretationCache
    .filter({ cache_key: key }, { sort: "-created_date", limit: 1 })
    .catch(() => null);
  const row = page?.items?.[0];
  if (!row) return null;
  if (Date.now() - new Date(row.created_date).getTime() > CACHE_TTL_MS) return null;
  try {
    return { row, raw: JSON.parse(row.raw_json) };
  } catch {
    return null;
  }
}

// Returneaza { raw, meta: { model_used, escalated, cache_hit, latency_ms } }.
export async function invokePatientNeedLlm(base44, { prompt, schema, cacheKey }) {
  const svc = base44.asServiceRole;
  const started = Date.now();

  const cached = await readCache(svc, cacheKey);
  if (cached) {
    svc.entities.AIInterpretationCache.update(cached.row.id, { hit_count: (cached.row.hit_count || 0) + 1 }).catch(() => null);
    return {
      raw: cached.raw,
      meta: { model_used: cached.row.model_used, escalated: false, cache_hit: true, latency_ms: Date.now() - started },
    };
  }

  const call = (model, ms) => withTimeout(base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: false,
    response_json_schema: schema,
    model,
  }), ms);

  let raw = await call(FAST_MODEL, FAST_TIMEOUT_MS).catch(() => null);
  let modelUsed = FAST_MODEL;
  let escalated = false;
  if (needsEscalation(raw)) {
    escalated = true;
    const strong = await call(STRONG_MODEL, STRONG_TIMEOUT_MS).catch((error) => {
      if (!raw) throw error;
      return null;
    });
    if (strong) {
      raw = strong;
      modelUsed = STRONG_MODEL;
    }
  }

  svc.entities.AIInterpretationCache.create({
    cache_key: cacheKey,
    engine_version: ENGINE_VERSION,
    model_used: modelUsed,
    raw_json: JSON.stringify(raw),
    hit_count: 0,
  }).catch(() => null);

  return { raw, meta: { model_used: modelUsed, escalated, cache_hit: false, latency_ms: Date.now() - started } };
}