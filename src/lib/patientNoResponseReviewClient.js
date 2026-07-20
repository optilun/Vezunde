import { base44 } from "@/api/base44Client";
import { readPatientRequestAccess } from "@/lib/patientRequestPersistenceClient";

const REFORMULATION_STORAGE_PREFIX = "viasee.patient_request_reformulation.";
const REFORMULATION_MODES = new Set(["criteria", "county"]);

function clean(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function keepWaitingForPatientRequest(requestId, explicitAccessToken = "") {
  const token = explicitAccessToken || readPatientRequestAccess(requestId);
  if (!token) throw new Error("Tokenul local al cererii nu mai este disponibil.");
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    action: "no_response_keep_waiting",
    request_id: requestId,
    request_access_token: token,
  });
  return responseData(response);
}

export function buildPatientRequestReformulationSeed({ mode, request, workspace }) {
  const normalizedMode = REFORMULATION_MODES.has(mode) ? mode : "criteria";
  const draft = workspace?.request_draft || {};
  return {
    version: "patient-request-reformulation-v1",
    mode: normalizedMode,
    source_public_reference: clean(request?.public_reference, 120),
    created_at: new Date().toISOString(),
    detailed_message: clean(workspace?.detailed_message || draft.original_message, 2000),
    request_draft: {
      contract_version: clean(draft.contract_version, 120),
      questionnaire_version: clean(draft.questionnaire_version, 120),
      questionnaire_key: clean(draft.questionnaire_key, 120),
      intent: clean(draft.intent || request?.intent, 120),
      original_message: clean(draft.original_message || workspace?.detailed_message, 800),
      service_keys: Array.isArray(draft.service_keys) ? draft.service_keys.filter(Boolean).slice(0, 30) : [],
      location_scope: normalizedMode === "county" ? "county" : "locality",
      city: clean(draft.city || request?.city, 120),
      county: clean(draft.county || request?.county, 120),
      locality_siruta_code: clean(draft.locality_siruta_code, 40),
      client_address_text: clean(draft.client_address_text || draft.city || request?.city, 240),
      for_whom: clean(draft.for_whom, 40) || null,
      age_group: clean(draft.age_group, 40) || null,
      timing_key: clean(draft.timing_key, 60) || null,
      preferences: Array.isArray(draft.preferences) ? draft.preferences.filter(Boolean).slice(0, 20) : [],
      answers: Array.isArray(draft.answers) ? draft.answers.slice(0, 30) : [],
      interpretation: draft.interpretation || null,
    },
  };
}

export function createPatientRequestReformulationUrl(seed) {
  const id = randomId();
  try {
    globalThis.sessionStorage?.setItem(`${REFORMULATION_STORAGE_PREFIX}${id}`, JSON.stringify(seed));
  } catch (_error) {
    throw new Error("Cautarea noua nu a putut fi pregatita in acest browser.");
  }
  const query = new URLSearchParams({ reformulation: id });
  return `/cerere?${query.toString()}`;
}

export function readPatientRequestReformulation(id) {
  if (!id) return null;
  const key = `${REFORMULATION_STORAGE_PREFIX}${id}`;
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    globalThis.sessionStorage?.removeItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (parsed?.version !== "patient-request-reformulation-v1") return null;
    if (!REFORMULATION_MODES.has(parsed?.mode)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}
