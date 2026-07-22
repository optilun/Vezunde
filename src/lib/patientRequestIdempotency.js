export const PATIENT_REQUEST_IDEMPOTENCY_VERSION = 1;
export const PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX = "viasee.patient_request_idempotency.v1.";
export const PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY = "viasee.patient_request_idempotency.active.v1";

const memoryRecords = new Map();
let activeMemoryFingerprint = "";

function clean(value, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function hash32(value, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableHash(value) {
  const left = hash32(value, 0x811c9dc5).toString(16).padStart(8, "0");
  const right = hash32(`viasee:${value}`, 0x9e3779b9).toString(16).padStart(8, "0");
  return `${left}${right}`;
}

function storageOrNull(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch (_error) {
    return null;
  }
}

function normalizedAnswers(answers) {
  return (Array.isArray(answers) ? answers : [])
    .map((answer) => ({
      question_key: clean(answer?.question_key, 80),
      answer_hash: stableHash(clean(answer?.answer_value, 500)),
    }))
    .filter((answer) => answer.question_key)
    .sort((left, right) => (
      left.question_key.localeCompare(right.question_key)
      || left.answer_hash.localeCompare(right.answer_hash)
    ));
}

function normalizedContact(contact = {}) {
  return {
    name_hash: stableHash(clean(contact.name || contact.contact_name, 120).toLowerCase()),
    email_hash: stableHash(clean(contact.email || contact.contact_email, 254).toLowerCase()),
    phone_hash: stableHash(clean(contact.phone || contact.contact_phone, 32).replace(/\s+/g, "")),
    preference: clean(contact.preference || contact.contact_preference, 20),
  };
}

function stableDraftIdentity({ requestDraft = {}, detailedMessage = "", contact = {} } = {}) {
  return {
    version: "patient-request-idempotency-fingerprint-v1",
    intent: clean(requestDraft.intent, 80),
    answers: normalizedAnswers(requestDraft.answers),
    locality: {
      city: clean(requestDraft.city, 120).toLowerCase(),
      siruta: clean(requestDraft.locality_siruta_code, 40),
      scope: clean(requestDraft.location_scope, 40),
      address_hash: stableHash(clean(requestDraft.client_address_text, 240).toLowerCase()),
    },
    service_keys: [...new Set((Array.isArray(requestDraft.service_keys) ? requestDraft.service_keys : [])
      .map((value) => clean(value, 120))
      .filter(Boolean))]
      .sort(),
    original_message_hash: stableHash(clean(requestDraft.original_message, 800)),
    detailed_message_hash: stableHash(clean(detailedMessage, 2000)),
    contact: normalizedContact(contact),
  };
}

function validRecord(record, fingerprint) {
  return Boolean(
    record
    && record.version === PATIENT_REQUEST_IDEMPOTENCY_VERSION
    && record.fingerprint === fingerprint
    && /^[A-Za-z0-9:_-]{16,120}$/.test(record.idempotency_key || ""),
  );
}

function readStoredRecord(fingerprint, storage) {
  const target = storageOrNull(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(`${PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX}${fingerprint}`);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (validRecord(record, fingerprint)) return record;
    target.removeItem(`${PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX}${fingerprint}`);
  } catch (_error) {
    return null;
  }
  return null;
}

function storeRecord(record, storage) {
  memoryRecords.set(record.fingerprint, record);
  activeMemoryFingerprint = record.fingerprint;
  const target = storageOrNull(storage);
  if (!target) return false;
  try {
    target.setItem(
      `${PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX}${record.fingerprint}`,
      JSON.stringify(record),
    );
    target.setItem(PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY, record.fingerprint);
    return true;
  } catch (_error) {
    return false;
  }
}

function activeFingerprint(storage) {
  const target = storageOrNull(storage);
  if (target) {
    try {
      return target.getItem(PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY) || activeMemoryFingerprint;
    } catch (_error) {
      return activeMemoryFingerprint;
    }
  }
  return activeMemoryFingerprint;
}

function removeFingerprint(fingerprint, storage) {
  if (!fingerprint) return;
  memoryRecords.delete(fingerprint);
  if (activeMemoryFingerprint === fingerprint) activeMemoryFingerprint = "";
  const target = storageOrNull(storage);
  if (!target) return;
  try {
    target.removeItem(`${PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX}${fingerprint}`);
    if (target.getItem(PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY) === fingerprint) {
      target.removeItem(PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY);
    }
  } catch (_error) {
    // Current-page in-memory idempotency remains available without storage.
  }
}

export function createPatientRequestIdempotencyKey() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return `patient:${globalThis.crypto.randomUUID()}`;
    }
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const bytes = new Uint8Array(24);
      globalThis.crypto.getRandomValues(bytes);
      return `patient:${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    }
  } catch (_error) {
    // A local consistency key does not rely on cryptographic secrecy.
  }
  return `patient:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function fingerprintPatientRequestDraft(input = {}) {
  return `patient-draft-v1:${stableHash(JSON.stringify(stableDraftIdentity(input)))}`;
}

export function getOrCreatePatientRequestIdempotency(input = {}, {
  storage,
  createKey = createPatientRequestIdempotencyKey,
  now = Date.now(),
} = {}) {
  const fingerprint = fingerprintPatientRequestDraft(input);
  const existing = memoryRecords.get(fingerprint) || readStoredRecord(fingerprint, storage);
  if (validRecord(existing, fingerprint)) {
    memoryRecords.set(fingerprint, existing);
    activeMemoryFingerprint = fingerprint;
    return {
      fingerprint,
      idempotencyKey: existing.idempotency_key,
      reused: true,
    };
  }

  const record = {
    version: PATIENT_REQUEST_IDEMPOTENCY_VERSION,
    fingerprint,
    idempotency_key: createKey(),
    created_at: Number(now),
  };
  storeRecord(record, storage);
  return {
    fingerprint,
    idempotencyKey: record.idempotency_key,
    reused: false,
  };
}

export function completePatientRequestIdempotency({ fingerprint = "", storage } = {}) {
  removeFingerprint(fingerprint, storage);
}

export function abandonPatientRequestIdempotency({ fingerprint = "", storage } = {}) {
  removeFingerprint(fingerprint || activeFingerprint(storage), storage);
}

export function abandonAllPatientRequestIdempotency({ storage } = {}) {
  memoryRecords.clear();
  activeMemoryFingerprint = "";
  const target = storageOrNull(storage);
  if (!target) return;
  try {
    const keys = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key?.startsWith(PATIENT_REQUEST_IDEMPOTENCY_RECORD_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
    target.removeItem(PATIENT_REQUEST_IDEMPOTENCY_ACTIVE_KEY);
  } catch (_error) {
    // Explicit abandonment remains safe when storage is unavailable.
  }
}
