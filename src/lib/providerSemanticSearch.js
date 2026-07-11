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
      data: {
        results: [],
        resolved_service_keys: [],
        semantic_resolution: localResolution,
        coverage_status: "query_not_mapped",
      },
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
      data: response?.data || {},
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
      data: {
        ...(response?.data || {}),
        resolved_service_keys: serviceKeys,
        semantic_resolution: localResolution,
      },
      usedSemanticFallback: true,
      localResolution,
    };
  }
}
