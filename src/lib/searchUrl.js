// 2026-09-28 (audit /cauta, B4): criteriile cautarii stau in adresa paginii. O cautare se poate
// trimite cuiva, salva sau redeschide exact asa, iar un link primit are prioritate fata de ultima
// cautare din sesiune. Fara parametri, /cauta reia ultima cautare (alegerea din 2026-09-27).
//
// Doar criteriile structurate intra in adresa: serviciul ales din sugestii, localitatea, filtrele si
// fila. Selectia de pe harta, derularea si paginile incarcate raman in sesiune.
//
// Textul scris liber NU se scrie in adresa: poate descrie simptome („vad in ceata”), iar adresa
// ajunge in istoricul browserului, in linkurile trimise si (cu acord) in statisticile de trafic.
// Linkurile care il au deja (ex. /cauta?q=oftalmolog) se citesc in continuare; dupa deschidere,
// textul ramane doar in pagina si in sesiune.

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

// Criteriile curente ca text de adresa (fara `?`). Fara textul liber (vezi mai sus).
export function searchCriteriaFor(state) {
  const out = new URLSearchParams();
  if (state.service) out.set("serviciu", state.service);
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
