// 2026-09-28 (audit /cauta, B4): criteriile cautarii stau in adresa paginii. O cautare se poate
// trimite cuiva, salva sau redeschide exact asa, iar un link primit are prioritate fata de ultima
// cautare din sesiune. Fara parametri, /cauta reia ultima cautare (alegerea din 2026-09-27).
//
// Doar criteriile intra in adresa: ce cauta pacientul, unde si cu ce filtre. Selectia de pe harta,
// derularea si paginile incarcate raman in sesiune.

export const SEARCH_URL_KEYS = ["serviciu", "q", "oras", "siruta", "tip", "filtre", "cas", "mod", "specialist"];

const PROFESSIONALS_MODE = "professionals";
const LOCATIONS_MODE = "locations";
const PROFESSIONALS_URL_VALUE = "specialisti";

function toParams(search) {
  return new URLSearchParams(typeof search === "string" ? search : "");
}

// Parametrii de criterii dintr-o adresa, in ordine fixa (fara `?`). Doua adrese cu aceleasi
// criterii dau acelasi text, indiferent de ordinea parametrilor sau de alti parametri.
export function criteriaQuery(search) {
  const params = toParams(search);
  const out = new URLSearchParams();
  SEARCH_URL_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) out.set(key, value);
  });
  return out.toString();
}

export function searchStateFromUrl(search, serviceLabels = {}) {
  const params = toParams(search);
  const service = params.get("serviciu") || "";
  const siruta = params.get("siruta") || "";
  const name = params.get("oras") || "";
  return {
    service,
    query: params.get("q") || serviceLabels[service] || "",
    locality: siruta && name ? { name, display_label: name, county_name: "", siruta_code: siruta } : null,
    providerType: params.get("tip") || "",
    filterServiceKeys: (params.get("filtre") || "").split(",").map((key) => key.trim()).filter(Boolean),
    casOnly: params.get("cas") === "1",
    searchMode: params.get("mod") === PROFESSIONALS_URL_VALUE ? PROFESSIONALS_MODE : LOCATIONS_MODE,
    professionalType: params.get("specialist") || "",
  };
}

// Criteriile curente ca text de adresa (fara `?`). Textul cautat se scrie doar daca difera de
// eticheta serviciului ales, ca adresa sa ramana scurta.
export function searchCriteriaFor(state, serviceLabels = {}) {
  const out = new URLSearchParams();
  const query = (state.query || "").trim();
  if (state.service) out.set("serviciu", state.service);
  if (query && query !== serviceLabels[state.service]) out.set("q", query);
  if (state.locality?.siruta_code && state.locality?.name) {
    out.set("oras", state.locality.name);
    out.set("siruta", String(state.locality.siruta_code));
  }
  if (state.providerType) out.set("tip", state.providerType);
  if (state.filterServiceKeys?.length) out.set("filtre", [...state.filterServiceKeys].join(","));
  if (state.casOnly) out.set("cas", "1");
  if (state.searchMode === PROFESSIONALS_MODE) {
    out.set("mod", PROFESSIONALS_URL_VALUE);
    if (state.professionalType) out.set("specialist", state.professionalType);
  }
  return criteriaQuery(out.toString());
}

// Adresa noua: parametrii care nu tin de cautare raman neatinsi, criteriile se scriu la final.
export function searchUrlFor(currentSearch, criteria) {
  const params = toParams(currentSearch);
  SEARCH_URL_KEYS.forEach((key) => params.delete(key));
  const rest = params.toString();
  const joined = [rest, criteria].filter(Boolean).join("&");
  return joined ? `?${joined}` : "";
}
