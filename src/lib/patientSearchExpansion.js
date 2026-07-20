import { base44 } from "@/api/base44Client";

export const PATIENT_COUNTY_EXPANSION_VERSION = "patient-county-expansion-v1";

function clean(value, maxLength = 800) {
  return String(value || "").trim().slice(0, maxLength);
}

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  if (data.query_scope !== "county") {
    throw new Error("Extinderea cautarii nu a returnat aria solicitata.");
  }
  return data;
}

export function patientSearchTextFromDraft(draft = {}) {
  const descriptions = (Array.isArray(draft.answers) ? draft.answers : [])
    .filter((answer) => answer?.question_key === "descriere")
    .map((answer) => clean(answer?.answer_value, 800))
    .filter(Boolean);
  return [...new Set([clean(draft.original_message, 800), ...descriptions].filter(Boolean))].join(". ");
}

export function countyExpansionDraft(draft = {}, data = {}) {
  return {
    ...draft,
    location_scope: "county",
    county: clean(data.selected_county_name || draft.county, 120),
    county_code: clean(data.selected_county_code || draft.county_code, 10),
  };
}

export async function matchProvidersInSelectedCounty(draft = {}) {
  const sirutaCode = clean(draft.locality_siruta_code, 40);
  if (!sirutaCode) throw new Error("Localitatea selectata nu mai este disponibila.");

  const response = await base44.functions.invoke("matchProvidersSemantic", {
    search_text: patientSearchTextFromDraft(draft),
    intent: clean(draft.intent, 80),
    service_keys: Array.isArray(draft.service_keys) ? draft.service_keys : [],
    locality_siruta_code: sirutaCode,
    client_address_text: clean(draft.client_address_text, 240),
    for_whom: clean(draft.for_whom, 40),
    age_group: clean(draft.age_group, 40),
    timing_key: clean(draft.timing_key, 60),
    query_scope: "county",
    expansion_version: PATIENT_COUNTY_EXPANSION_VERSION,
    limit: 50,
  });

  return responseData(response);
}
