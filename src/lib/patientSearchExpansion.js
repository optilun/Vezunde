import { base44 } from "@/api/base44Client";
import {
  PATIENT_COUNTY_EXPANSION_VERSION,
  PATIENT_NATIONAL_EXPANSION_VERSION,
  countyExpansionDraft,
  nationalExpansionDraft,
  patientSearchTextFromDraft,
} from "../../shared/patientSearchExpansion.js";

export {
  PATIENT_COUNTY_EXPANSION_VERSION,
  PATIENT_NATIONAL_EXPANSION_VERSION,
  countyExpansionDraft,
  nationalExpansionDraft,
  patientSearchTextFromDraft,
};

function clean(value, maxLength = 800) {
  return String(value || "").trim().slice(0, maxLength);
}

function responseData(response) {
  const safeResponse = /** @type {any} */ (response || {});
  const data = safeResponse.data || {};
  if (data.error) throw new Error(data.error);
  if (data.query_scope !== "county") {
    throw new Error("Extinderea cautarii nu a returnat aria solicitata.");
  }
  return data;
}

export async function matchProvidersInSelectedCounty(draft = {}) {
  const safeDraft = /** @type {any} */ (draft || {});
  const sirutaCode = clean(safeDraft.locality_siruta_code, 40);
  if (!sirutaCode) throw new Error("Localitatea selectata nu mai este disponibila.");

  const response = await base44.functions.invoke("matchProvidersSemantic", {
    search_text: patientSearchTextFromDraft(safeDraft),
    intent: clean(safeDraft.intent, 80),
    service_keys: Array.isArray(safeDraft.service_keys) ? safeDraft.service_keys : [],
    locality_siruta_code: sirutaCode,
    client_address_text: clean(safeDraft.client_address_text, 240),
    for_whom: clean(safeDraft.for_whom, 40),
    age_group: clean(safeDraft.age_group, 40),
    timing_key: clean(safeDraft.timing_key, 60),
    query_scope: "county",
    expansion_version: PATIENT_COUNTY_EXPANSION_VERSION,
    limit: 50,
  });

  return responseData(response);
}
