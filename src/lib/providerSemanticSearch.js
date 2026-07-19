import { base44 } from "@/api/base44Client";
import { resolveServiceSearchQuery } from "@/lib/serviceSemanticSearch";

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

export async function interpretPatientNeedForConfirmation(payload = {}) {
  const request = interpretationRequest(payload);
  if (!request) return { status: "skipped", reason: "search_text_required" };

  try {
    const response = await base44.functions.invoke("matchProvidersSemantic", request.body);
    const data = response?.data || { status: "unavailable", reason: "empty_interpretation_response" };
    trackInterpretation("patient_need_interpretation_confirmation", interpretationAnalytics(data, request));
    return data;
  } catch (_error) {
    trackInterpretation("patient_need_interpretation_confirmation", {
      status: "request_failed",
      deterministic_intent: request.deterministicIntent,
    });
    return { status: "unavailable", reason: "ai_interpretation_unavailable" };
  }
}

export async function interpretPatientNeedInShadow(payload = {}) {
  const request = interpretationRequest(payload);
  if (!request) return null;

  try {
    const response = await base44.functions.invoke("matchProvidersSemantic", request.body);
    const data = response?.data || null;
    trackInterpretation("patient_need_interpretation_shadow", interpretationAnalytics(data, request));
    return data;
  } catch (_error) {
    trackInterpretation("patient_need_interpretation_shadow", {
      status: "request_failed",
      deterministic_intent: request.deterministicIntent,
    });
    return null;
  }
}

export async function matchProvidersWithSemanticFallback(payload = {}) {
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

  try {
    const response = await base44.functions.invoke("matchProvidersSemantic", semanticPayload);
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
    const response = await base44.functions.invoke("matchProviders", {
      ...payload,
      service_keys: serviceKeys,
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
