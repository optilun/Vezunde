import { base44 } from "@/api/base44Client";

// Cod aleator per vizita (nu identifica persoana). Inregistrarea nu blocheaza
// si nu poate strica niciodata cautarea.
function sessionHash() {
  try {
    let id = sessionStorage.getItem("viasee_search_session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("viasee_search_session", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function recordSearchEvent(payload = {}, serviceKeys = [], data = {}) {
  try {
    base44.functions.invoke("recordSearchEvent", {
      session_hash: sessionHash(),
      service_key: serviceKeys[0] || "",
      need_category: payload.intent || "",
      county_name: payload.county_name || "",
      locality_siruta_code: payload.locality_siruta_code || "",
      locality_name: payload.locality_name || payload.locality_city || "",
      result_count: Array.isArray(data.results) ? data.results.length : 0,
      entry_point: payload.entry_point || "formular",
    }).catch(() => {});
  } catch {
    // ignorat intentionat
  }
}
