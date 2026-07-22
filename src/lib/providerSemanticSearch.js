import { base44 } from "@/api/base44Client";
import { resolveServiceSearchQuery } from "@/lib/serviceSemanticSearch";
import { isPatientOperationTimeout, withPatientOperationTimeout } from "./patientOperationControl.js";

const CONFIRMATION_REUSE_TTL_MS = 2 * 60 * 1000;
const completedConfirmationBySignature = new Map();

export const PATIENT_INTERPRETATION_TIMEOUT_MS = 8_000;
export const PATIENT_MATCHING_TIMEOUT_MS = 15_000;

function invokePatientFunction(functionName, payload, { timeoutMs, operation, requestId = null } = {}) {
  return withPatientOperationTimeout(
    () => base44.functions.invoke(functionName, payload),
    { timeoutMs, operation, requestId },
  );
}

function searchTextFromPayload(payload = {}) {
  return String(
    payload.search_text
    || payload.query
    || payload.free_text
    || payload.search_query
    || "",
  ).trim();
}

function functionUnavailable(error) {
  const payload = error?.response?.data || error?.data || {};
  const message = String(payload.error || payload.message || error?.message || "").toLowerCase();
  const status = Number(error?.response?.status || payload.status || 0);
  return status === 404 || /not found|not deployed|backend function|404/.test(message);
}

function trackInterpretation(eventName, properties) {
  try {
    base44.analytics.track({
      eventName,
      properties: {
        analytics_version: "patient-search-v1",
        ...properties,
      },
    });
  } catch (_error) {
    // Interpretation analytics must never affect deterministic search.
  }
}

function interpretationRequest(payload = {}) {
  const searchText = searchTextFromPayload(payload);
  if (!searchText) return null;

  const localResolution = resolveServiceSearchQuery(searchText, {
    limit: payload.semantic_limit || 15,
    minScore: payload.semantic_min_score || 0.34,
  });
  const explicitKeys = Array.isArray(payload.service_keys) ? payload.service_keys.filter(Boolean) : [];
  const deterministicServiceKeys = [...new Set([...explicitKeys, ...localResolution.service_keys])];

  return {
    searchText,
    deterministicIntent: payload.deterministic_intent || payload.intent || "unknown",
    deterministicServiceKeys,
    body: {
      mode: "interpret_only",
      search_text: searchText,
      deterministic_intent: payload.deterministic_intent || payload.intent || "unknown",
      service_keys: deterministicServiceKeys,
      answers: Array.isArray(payload.answers) ? payload.answers : [],
    },
  };
}

function interpretationSignature(request) {
  const firstPatientPhrase = String(request?.searchText || "")
    .split(". ")[0]
    .trim()
    .toLowerCase();
  return `${firstPatientPhrase}::${request?.deterministicIntent || "unknown"}`;
}

function rememberCompletedConfirmation(request, data) {
  if (data?.status !== "completed") return;
  const signature = interpretationSignature(request);
  if (!signature) return;
  completedConfirmationBySignature.set(signature, Date.now());
  if (completedConfirmationBySignature.size > 50) {
    const oldest = completedConfirmationBySignature.keys().next().value;
    if (oldest) completedConfirmationBySignature.delete(oldest);
  }
}

function hasRecentCompletedConfirmation(request) {
  const signature = interpretationSignature(request);
  const completedAt = completedConfirmationBySignature.get(signature);
  if (!completedAt) return false;
  if (Date.now() - completedAt > CONFIRMATION_REUSE_TTL_MS) {
    completedConfirmationBySignature.delete(signature);
    return false;
  }
  return true;
}

function interpretationAnalytics(data, request) {
  const interpretation = data?.interpretation;
  return {
    status: data?.status || "unknown",
    reason: data?.reason || null,
    version: interpretation?.version || "unknown",
    deterministic_intent: request?.deterministicIntent || "unknown",
    ai_intent: interpretation?.intent || "unknown",
    agreement_status: interpretation?.agreement_status || "unknown",
    confidence_band: interpretation?.confidence_band || "low",
    clarification_required: interpretation?.clarification_required === true,
    safety_flag_count: interpretation?.possible_safety_flags?.length || 0,
    service_key_count: interpretation?.service_keys?.length || 0,
  };
}

function normalizeRecommendationResponse(data = {}) {
  const contractVersion = data.recommendation_contract_version || "provider-recommendation-legacy";
  return {
    ...data,
    recommendation_contract_version: contractVersion,
    results: (data.results || []).map((result) => {
      const explanations = Array.isArray(result.recommendation_explanations)
        ? result.recommendation_explanations
        : (result.match_reasons || [])
          .filter((label) => label && label !== "service_alias_match")
          .map((label) => ({ code: "legacy_match_reason", label }));
      return {
        ...result,
        recommendation_contract_version: result.recommendation_contract_version || contractVersion,
        recommendation_explanations: explanations,
      };
    }),
  };
}

export async function interpretPatientNeedForConfirmation(payload = {}, options = {}) {
  const request = interpretationRequest(payload);
  if (!request) return { status: "skipped", reason: "search_text_required" };

  try {
    const response = await invokePatientFunction("matchProvidersSemantic", request.body, {
      timeoutMs: options.timeoutMs || PATIENT_INTERPRETATION_TIMEOUT_MS,
      operation: "patient_need_interpretation",
      requestId: options.requestId || null,
    });
    const data = response?.data || { status: "unavailable", reason: "empty_interpretation_response" };
    rememberCompletedConfirmation(request, data);
    trackInterpretation("patient_need_interpretation_confirmation", interpretationAnalytics(data, request));
    return data;
  } catch (error) {
    const timedOut = isPatientOperationTimeout(error);
    trackInterpretation("patient_need_interpretation_confirmation", {
      status: timedOut ? "timeout" : "request_failed",
      deterministic_intent: request.deterministicIntent,
    });
    return {
      status: "unavailable",
      reason: timedOut ? "ai_interpretation_timeout" : "ai_interpretation_unavailable",
    };
  }
}

export async function interpretPatientNeedInShadow(payload = {}, options = {}) {
  const request = interpretationRequest(payload);
  if (!request) return null;

  if (hasRecentCompletedConfirmation(request)) {
    trackInterpretation("patient_need_interpretation_shadow", {
      status: "skipped_duplicate_confirmation",
      deterministic_intent: request.deterministicIntent,
    });
    return null;
  }

  try {
    const response = await invokePatientFunction("matchProvidersSemantic", request.body, {
      timeoutMs: options.timeoutMs || PATIENT_INTERPRETATION_TIMEOUT_MS,
      operation: "patient_need_shadow_interpretation",
      requestId: options.requestId || null,
    });
    const data = response?.data || null;
    trackInterpretation("patient_need_interpretation_shadow", interpretationAnalytics(data, request));
    return data;
  } catch (error) {
    trackInterpretation("patient_need_interpretation_shadow", {
      status: isPatientOperationTimeout(error) ? "timeout" : "request_failed",
      deterministic_intent: request.deterministicIntent,
    });
    return null;
  }
}

export async function matchProvidersWithSemanticFallback(payload = {}, options = {}) {
  const searchText = searchTextFromPayload(payload);
  const localResolution = resolveServiceSearchQuery(searchText, {
    limit: payload.semantic_limit || 15,
    minScore: payload.semantic_min_score || 0.34,
  });
  const explicitKeys = Array.isArray(payload.service_keys) ? payload.service_keys.filter(Boolean) : [];
  const serviceKeys = [...new Set([...explicitKeys, ...localResolution.service_keys])];
  if (searchText && serviceKeys.length === 0) {
    return {
      data: normalizeRecommendationResponse({
        results: [],
        resolved_service_keys: [],
        semantic_resolution: localResolution,
        coverage_status: "query_not_mapped",
      }),
      usedSemanticFallback: true,
      localResolution,
    };
  }
  const semanticPayload = {
    ...payload,
    search_text: searchText,
    service_keys: serviceKeys,
  };
  const timeoutMs = options.timeoutMs || PATIENT_MATCHING_TIMEOUT_MS;

  try {
    const response = await invokePatientFunction("matchProvidersSemantic", semanticPayload, {
      timeoutMs,
      operation: "patient_provider_matching_semantic",
      requestId: options.requestId || null,
    });
    if (response?.data?.error) {
      const error = Object.assign(new Error(response.data.error), { data: response.data });
      if (!functionUnavailable(error)) throw error;
      throw error;
    }
    return {
      data: normalizeRecommendationResponse(response?.data || {}),
      usedSemanticFallback: false,
      localResolution,
    };
  } catch (error) {
    if (!functionUnavailable(error)) throw error;
    const response = await invokePatientFunction("matchProviders", {
      ...payload,
      service_keys: serviceKeys,
    }, {
      timeoutMs,
      operation: "patient_provider_matching_deterministic",
      requestId: options.requestId || null,
    });
    return {
      data: normalizeRecommendationResponse({
        ...(response?.data || {}),
        resolved_service_keys: serviceKeys,
        semantic_resolution: localResolution,
      }),
      usedSemanticFallback: true,
      localResolution,
    };
  }
}
