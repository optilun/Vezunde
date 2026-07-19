import { base44 } from "@/api/base44Client";

export const PATIENT_REQUEST_PROCESSING_CONSENT_VERSION = "patient-request-processing-v1";
export const PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION = "patient-request-distribution-v1";
const DRAFT_STORAGE_KEY = "viasee.patient_request_draft.v1";
const ACCESS_STORAGE_PREFIX = "viasee.patient_request_access.";

export function createPatientRequestIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `patient:${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return `patient:${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function storePatientRequestDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft || null));
  } catch (_error) {
    // Search and matching must remain usable when storage is unavailable.
  }
}

export function readPatientRequestDraft() {
  try {
    const value = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    return null;
  }
}

export function storePatientRequestAccess(requestId, accessToken) {
  if (!requestId || !accessToken) return;
  try {
    sessionStorage.setItem(`${ACCESS_STORAGE_PREFIX}${requestId}`, accessToken);
  } catch (_error) {
    // The public reference remains available even without local storage.
  }
}

export function readPatientRequestAccess(requestId) {
  if (!requestId) return "";
  try {
    return sessionStorage.getItem(`${ACCESS_STORAGE_PREFIX}${requestId}`) || "";
  } catch (_error) {
    return "";
  }
}

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { field: data.field || "" });
  return data;
}

export async function persistPatientRequest({
  idempotencyKey,
  requestDraft,
  contact,
  results,
  meta,
}) {
  const response = await base44.functions.invoke("createPatientRequest", {
    idempotency_key: idempotencyKey,
    request_draft: requestDraft,
    contact,
    consent: {
      processing: true,
      version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION,
      provider_contact_sharing: false,
    },
    recommendation: {
      contract_version: meta?.recommendation_contract_version || "legacy",
      coverage_status: meta?.coverage_status || "unknown",
      need_level: meta?.need_level || "",
      results: Array.isArray(results) ? results : [],
    },
  });
  const data = responseData(response);
  storePatientRequestAccess(data.request_id, data.request_access_token);
  return data;
}

export async function authorizePatientRequestDistribution(requestId, explicitAccessToken = "") {
  const requestAccessToken = explicitAccessToken || readPatientRequestAccess(requestId);
  if (!requestAccessToken) throw new Error("Tokenul local al cererii nu mai este disponibil.");
  const response = await base44.functions.invoke("authorizePatientRequestDistribution", {
    request_id: requestId,
    request_access_token: requestAccessToken,
    distribution_consent: true,
    consent_version: PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION,
  });
  return responseData(response);
}

export async function getPatientRequestStatus(requestId, explicitAccessToken = "") {
  const requestAccessToken = explicitAccessToken || readPatientRequestAccess(requestId);
  if (!requestAccessToken) throw new Error("Tokenul local al cererii nu mai este disponibil.");
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    request_id: requestId,
    request_access_token: requestAccessToken,
  });
  return responseData(response);
}
