export const PATIENT_INTAKE_SESSION_VERSION = 1;
export const PATIENT_INTAKE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const PATIENT_INTAKE_SESSION_STORAGE_KEY = "viasee.patient_intake_session.v1";
export const PATIENT_INTAKE_HISTORY_LIMIT = 20;

const RELEVANT_ENTRY_QUERY_KEYS = Object.freeze([
  "intent",
  "q",
  "query",
  "message",
  "categorie",
  "category",
  "city",
  "locality",
  "siruta",
  "scope",
  "mode",
  "source",
]);

function clean(value, maxLength = 800) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function storageOrNull(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch (_error) {
    return null;
  }
}

function removeStoredSnapshot(storage) {
  try {
    storageOrNull(storage)?.removeItem(PATIENT_INTAKE_SESSION_STORAGE_KEY);
  } catch (_error) {
    // Intake remains usable when browser storage is unavailable.
  }
}

function safeAnswer(answer) {
  const questionKey = clean(answer?.question_key, 80);
  const answerValue = clean(answer?.answer_value, 500);
  if (!questionKey || !answerValue) return null;
  return { question_key: questionKey, answer_value: answerValue };
}

function safeLocality(locality) {
  if (!locality || typeof locality !== "object" || Array.isArray(locality)) return null;
  const normalized = {
    siruta_code: clean(locality.siruta_code, 40),
    city_name: clean(locality.city_name || locality.name, 120),
    county_name: clean(locality.county_name, 120),
    county_code: clean(locality.county_code, 10),
  };
  const latitude = Number(locality.latitude ?? locality.lat);
  const longitude = Number(locality.longitude ?? locality.lng);
  if (Number.isFinite(latitude)) normalized.latitude = latitude;
  if (Number.isFinite(longitude)) normalized.longitude = longitude;
  return normalized.siruta_code || normalized.city_name ? normalized : null;
}

function safeState(state = {}) {
  return {
    intent: clean(state.intent, 80) || null,
    answers: (Array.isArray(state.answers) ? state.answers : [])
      .slice(0, 30)
      .map(safeAnswer)
      .filter(Boolean),
    serviceKeys: [...new Set((Array.isArray(state.serviceKeys) ? state.serviceKeys : [])
      .map((value) => clean(value, 120))
      .filter(Boolean))]
      .slice(0, 60),
    city: clean(state.city, 120),
    scope: clean(state.scope, 40),
    locality: safeLocality(state.locality),
    clientAddressText: clean(state.clientAddressText, 240),
  };
}

function safeDraftAnswer(answer) {
  const base = safeAnswer(answer);
  if (!base) return null;
  return {
    ...base,
    question_label: clean(answer?.question_label, 160),
    answer_label: clean(answer?.answer_label, 240),
  };
}

function safeRequestDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  const interpretation = draft.interpretation && typeof draft.interpretation === "object"
    ? {
      version: clean(draft.interpretation.version, 80) || null,
      confidence_band: clean(draft.interpretation.confidence_band, 20) || null,
      agreement_status: clean(draft.interpretation.agreement_status, 30) || null,
      possible_safety_flags: [...new Set((Array.isArray(draft.interpretation.possible_safety_flags)
        ? draft.interpretation.possible_safety_flags
        : []).map((value) => clean(value, 120)).filter(Boolean))].slice(0, 20),
    }
    : null;

  const normalized = {
    contract_version: clean(draft.contract_version, 80),
    questionnaire_version: clean(draft.questionnaire_version, 80),
    questionnaire_key: clean(draft.questionnaire_key, 120),
    intent: clean(draft.intent, 80),
    intent_label: clean(draft.intent_label, 120),
    original_message: clean(draft.original_message, 800),
    service_keys: [...new Set((Array.isArray(draft.service_keys) ? draft.service_keys : [])
      .map((value) => clean(value, 120))
      .filter(Boolean))]
      .slice(0, 60),
    location_scope: clean(draft.location_scope, 40),
    city: clean(draft.city, 120),
    county: clean(draft.county, 120),
    county_code: clean(draft.county_code, 10),
    locality_siruta_code: clean(draft.locality_siruta_code, 40),
    client_address_text: clean(draft.client_address_text, 240),
    for_whom: clean(draft.for_whom, 40) || null,
    age_group: clean(draft.age_group, 40) || null,
    timing_key: clean(draft.timing_key, 60) || null,
    answers: (Array.isArray(draft.answers) ? draft.answers : [])
      .slice(0, 30)
      .map(safeDraftAnswer)
      .filter(Boolean),
    interpretation,
  };
  return normalized.contract_version && normalized.questionnaire_version && normalized.intent
    ? normalized
    : null;
}

export function createPatientIntakeEntrySignature({
  initialMessage = "",
  initialIntent = null,
  search = "",
} = {}) {
  const message = clean(initialMessage, 800);
  const intent = clean(initialIntent, 80);
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const relevantQuery = RELEVANT_ENTRY_QUERY_KEYS
    .flatMap((key) => params.getAll(key).map((value) => [key, clean(value, 240)]))
    .filter(([, value]) => Boolean(value))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    ));
  const entryMode = message ? "free_text" : "guided";
  const canonical = JSON.stringify({ entryMode, intent, message, relevantQuery });
  return `patient-intake-v1:${entryMode}:${stableHash(canonical)}`;
}

export function restorablePatientIntakePhase(phase, requestDraft, {
  initialMessage = "",
  initialIntent = null,
} = {}) {
  if (phase === "review") return requestDraft ? "review" : "questions";
  if (phase === "submitting" || phase === "error" || phase === "results") {
    return requestDraft ? "review" : "questions";
  }
  if (phase === "interpreting" || phase === "confirm_intent") {
    return clean(initialMessage, 800) && !clean(initialIntent, 80) ? "interpreting" : "questions";
  }
  return "questions";
}

export function createPatientIntakeSnapshot(options = {}) {
  const {
    entrySignature,
    initialMessage = "",
    initialIntent = null,
    state = {},
    history = [],
    phase = "questions",
    requestDraft = null,
    timestamp = Date.now(),
  } = /** @type {any} */ (options);
  const safeMessage = clean(initialMessage, 800);
  const safeIntent = clean(initialIntent, 80) || null;
  const safeDraft = safeRequestDraft(requestDraft);
  return {
    version: PATIENT_INTAKE_SESSION_VERSION,
    timestamp: Number(timestamp),
    entrySignature: clean(entrySignature, 160),
    initialMessage: safeMessage,
    initialIntent: safeIntent,
    ...safeState(state),
    history: (Array.isArray(history) ? history : [])
      .slice(-PATIENT_INTAKE_HISTORY_LIMIT)
      .map(safeState),
    phase: restorablePatientIntakePhase(phase, safeDraft, {
      initialMessage: safeMessage,
      initialIntent: safeIntent,
    }),
    requestDraft: safeDraft,
  };
}

export function validatePatientIntakeSnapshot(snapshot, options = {}) {
  const {
    entrySignature,
    now = Date.now(),
    ttlMs = PATIENT_INTAKE_SESSION_TTL_MS,
  } = /** @type {any} */ (options);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  if (snapshot.version !== PATIENT_INTAKE_SESSION_VERSION) return null;
  const timestamp = Number(snapshot.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (timestamp > Number(now) + 5 * 60 * 1000) return null;
  if (Number(now) - timestamp > Number(ttlMs)) return null;
  if (clean(snapshot.entrySignature, 160) !== clean(entrySignature, 160)) return null;
  if (!snapshot.entrySignature) return null;
  return createPatientIntakeSnapshot({
    entrySignature: snapshot.entrySignature,
    initialMessage: snapshot.initialMessage,
    initialIntent: snapshot.initialIntent,
    state: snapshot,
    history: snapshot.history,
    phase: snapshot.phase,
    requestDraft: snapshot.requestDraft,
    timestamp,
  });
}

export function writePatientIntakeSession(snapshot, storage) {
  try {
    const target = storageOrNull(storage);
    if (!target) return false;
    target.setItem(PATIENT_INTAKE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (_error) {
    return false;
  }
}

export function readPatientIntakeSession(options = {}) {
  const {
    entrySignature,
    storage,
    now = Date.now(),
    ttlMs = PATIENT_INTAKE_SESSION_TTL_MS,
  } = /** @type {any} */ (options);
  const target = storageOrNull(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(PATIENT_INTAKE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const restored = validatePatientIntakeSnapshot(JSON.parse(raw), {
      entrySignature,
      now,
      ttlMs,
    });
    if (!restored) removeStoredSnapshot(target);
    return restored;
  } catch (_error) {
    removeStoredSnapshot(target);
    return null;
  }
}

export function clearPatientIntakeSession(storage) {
  removeStoredSnapshot(storage);
}

export function patientIntakeStateFromSnapshot(snapshot) {
  return safeState(snapshot || {});
}
