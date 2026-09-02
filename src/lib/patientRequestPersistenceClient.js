import { base44 } from "@/api/base44Client";
import { withPatientOperationTimeout } from "./patientOperationControl.js";
import { createPatientRequestIdempotencyKey as createDurablePatientRequestIdempotencyKey } from "./patientRequestIdempotency.js";

export const PATIENT_REQUEST_PROCESSING_CONSENT_VERSION = "patient-request-processing-v1";
// Trebuie sa ramana identica cu PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION din
// shared/providerLeadEligibility.js. v3 = textul acordului enumera si mesajul cu care
// pacientul a pornit cautarea.
export const PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION = "patient-request-distribution-top3-pro-v3";
export const PATIENT_REQUEST_RECOVERY_CONSENT_VERSION = "patient-request-recovery-review-v1";
const DRAFT_STORAGE_KEY = "viasee.patient_request_draft.v1";
const ACCESS_STORAGE_PREFIX = "viasee.patient_request_access.";
const RESUME_REFERENCE_PREFIX = "viasee.patient_request_resume.reference.";
const RESUME_REQUEST_PREFIX = "viasee.patient_request_resume.request.";
export const PATIENT_REQUEST_CREATE_TIMEOUT_MS = 20_000;

export function createPatientRequestIdempotencyKey() {
  return createDurablePatientRequestIdempotencyKey();
}

export function createControlledChatMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `chat:${globalThis.crypto.randomUUID()}`;
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return `chat:${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function storageValue(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    return null;
  }
}

function writeStorageValue(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // Request persistence must remain usable when browser storage is unavailable.
  }
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

export function storePatientRequestResumeAccess({ requestId = "", publicReference = "", accessToken = "" }) {
  if (!accessToken || (!requestId && !publicReference)) return;
  const snapshot = {
    request_id: requestId,
    public_reference: publicReference,
    access_token: accessToken,
    stored_at: new Date().toISOString(),
  };
  if (publicReference) writeStorageValue(globalThis.localStorage, `${RESUME_REFERENCE_PREFIX}${publicReference}`, snapshot);
  if (requestId) writeStorageValue(globalThis.localStorage, `${RESUME_REQUEST_PREFIX}${requestId}`, snapshot);
}

export function readPatientRequestResumeAccess(publicReference) {
  if (!publicReference) return null;
  return storageValue(globalThis.localStorage, `${RESUME_REFERENCE_PREFIX}${publicReference}`);
}

export function readPatientRequestResumeAccessByRequestId(requestId) {
  if (!requestId) return null;
  return storageValue(globalThis.localStorage, `${RESUME_REQUEST_PREFIX}${requestId}`);
}

export function storePatientRequestAccess(requestId, accessToken, publicReference = "") {
  if (!requestId || !accessToken) return;
  try {
    sessionStorage.setItem(`${ACCESS_STORAGE_PREFIX}${requestId}`, accessToken);
  } catch (_error) {
    // The public reference remains available even without session storage.
  }
  storePatientRequestResumeAccess({ requestId, publicReference, accessToken });
}

export function readPatientRequestAccess(requestId) {
  if (!requestId) return "";
  try {
    const sessionToken = sessionStorage.getItem(`${ACCESS_STORAGE_PREFIX}${requestId}`) || "";
    if (sessionToken) return sessionToken;
  } catch (_error) {
    // Fall through to durable resume storage.
  }
  return readPatientRequestResumeAccessByRequestId(requestId)?.access_token || "";
}

export function buildPatientRequestResumeUrl(publicReference, accessToken, baseUrl = "") {
  if (!publicReference || !accessToken) return "";
  const fallbackBase = typeof window !== "undefined" ? window.location.origin : "";
  const resolvedBase = String(baseUrl || fallbackBase).replace(/\/$/, "");
  if (!resolvedBase) return "";
  const query = new URLSearchParams({ ref: publicReference });
  const hash = new URLSearchParams({ access: accessToken });
  return `${resolvedBase}/cerere?${query.toString()}#${hash.toString()}`;
}

function replaceWithPatientRequestResumeRoute(publicReference) {
  if (typeof window === "undefined" || !publicReference) return;
  const query = new URLSearchParams({ ref: publicReference });
  window.history.replaceState(null, "", `/cerere?${query.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), {
    field: data.field || "",
    verification: data.verification || null,
    reasons: data.reasons || [],
  });
  return data;
}

function resolveRequestAccessToken(requestId, explicitAccessToken = "") {
  const token = explicitAccessToken || readPatientRequestAccess(requestId);
  if (!token) throw new Error("Tokenul local al cererii nu mai este disponibil.");
  return token;
}

export async function persistPatientRequest({
  idempotencyKey,
  requestDraft,
  detailedMessage,
  contact,
  results,
  meta,
  requestId = null,
  timeoutMs = PATIENT_REQUEST_CREATE_TIMEOUT_MS,
}) {
  const response = await withPatientOperationTimeout(
    () => base44.functions.invoke("createPatientRequest", {
    idempotency_key: idempotencyKey,
    request_draft: requestDraft,
    detailed_message: detailedMessage,
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
    }),
    {
      timeoutMs,
      operation: "create_patient_request",
      requestId,
    },
  );
  const data = responseData(response);
  const replayToken = data.request_access_token || readPatientRequestAccess(data.request_id);
  storePatientRequestAccess(data.request_id, replayToken, data.public_reference || "");
  return { ...data, request_access_token: replayToken };
}

export async function authorizePatientRequestDistribution(requestId, explicitAccessToken = "") {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("authorizePatientRequestDistribution", {
    request_id: requestId,
    request_access_token: token,
    distribution_consent: true,
    consent_version: PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION,
  });
  const data = responseData(response);
  const resume = readPatientRequestResumeAccessByRequestId(requestId);
  if (resume?.public_reference) replaceWithPatientRequestResumeRoute(resume.public_reference);
  return data;
}

export async function requestPatientRequestRecovery({
  requestId,
  coverageCounts = {},
  explicitAccessToken = "",
}) {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    action: "recovery_request",
    request_id: requestId,
    request_access_token: token,
    recovery_consent: true,
    recovery_consent_version: PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
    coverage_counts: coverageCounts,
  });
  const data = responseData(response);
  const resume = readPatientRequestResumeAccessByRequestId(requestId);
  if (resume?.public_reference) replaceWithPatientRequestResumeRoute(resume.public_reference);
  return data;
}

export async function getPatientRequestStatus(requestId, explicitAccessToken = "") {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    action: "status",
    request_id: requestId,
    request_access_token: token,
  });
  return responseData(response);
}

export async function getPatientRequestStatusByReference(publicReference, explicitAccessToken = "") {
  const stored = readPatientRequestResumeAccess(publicReference);
  const token = explicitAccessToken || stored?.access_token || "";
  if (!token) throw new Error("Linkul securizat al cererii nu mai este disponibil in acest browser.");
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    action: "status",
    public_reference: publicReference,
    request_access_token: token,
  });
  const data = responseData(response);
  if (data?.request?.id) storePatientRequestAccess(data.request.id, token, data.request.public_reference || publicReference);
  return data;
}

export async function updatePatientRequestLifecycle({
  requestId,
  action,
  explicitAccessToken = "",
}) {
  if (!["resolve", "close"].includes(action)) throw new Error("Actiunea de lifecycle nu este valida.");
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("getPatientRequestStatus", {
    action,
    request_id: requestId,
    request_access_token: token,
  });
  return responseData(response);
}

export async function patientRequestEmailVerification({
  requestId,
  action,
  code = "",
  explicitAccessToken = "",
}) {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const resume = readPatientRequestResumeAccessByRequestId(requestId);
  const response = await base44.functions.invoke("patientRequestEmailVerificationOps", {
    action,
    request_id: requestId,
    request_access_token: token,
    code,
    resume_url: buildPatientRequestResumeUrl(resume?.public_reference || "", token),
  });
  return responseData(response);
}

export async function managePatientContactShareApproval({
  requestId,
  locationId,
  action,
  explicitAccessToken = "",
}) {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("managePatientContactShareApproval", {
    action,
    request_id: requestId,
    request_access_token: token,
    location_id: locationId || "",
  });
  return responseData(response);
}

export async function patientControlledChat({
  requestId,
  locationId,
  action = "status",
  message = "",
  clientMessageId = "",
  explicitAccessToken = "",
}) {
  const token = resolveRequestAccessToken(requestId, explicitAccessToken);
  const response = await base44.functions.invoke("controlledChatOps", {
    actor: "patient",
    action,
    request_id: requestId,
    request_access_token: token,
    location_id: locationId,
    message,
    client_message_id: clientMessageId,
  });
  return responseData(response);
}
