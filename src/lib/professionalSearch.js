import { base44 } from "@/api/base44Client";
import { PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION } from "../../shared/professionalRecommendation.js";

// Clientul pentru recomandarea de specialisti.
//
// 2026-09-03. Nu reinterpreteaza cererea si nu porneste o a doua cautare semantica: primeste
// cheile de serviciu si nivelul de nevoie deja rezolvate de pasul de locatii si le trimite mai
// departe. Asa cele doua taburi ale aceleiasi cautari raspund la exact aceeasi intrebare, iar
// interpretarea ramane intr-un singur loc.

export { PROFESSIONAL_RECOMMENDATION_CONTRACT_VERSION };

const PROFESSIONAL_MATCHING_TIMEOUT_MS = 15000;

function clean(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function serviceKeysFromMeta(meta) {
  const safeMeta = /** @type {any} */ (meta || {});
  const resolved = Array.isArray(safeMeta.resolved_service_keys) ? safeMeta.resolved_service_keys : [];
  if (resolved.length > 0) return resolved;
  return Array.isArray(safeMeta.service_keys) ? safeMeta.service_keys : [];
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("Căutarea de specialiști a durat prea mult.")), timeoutMs);
    }),
  ]);
}

/**
 * Recomandarile de specialisti pentru contextul unei cereri deja interpretate.
 *
 * @param {object} meta raspunsul motorului de locatii (`matchProvidersSemantic`)
 * @param {object} [draft] draftul cererii, folosit doar ca sursa de rezerva pentru localitate
 */
export async function matchProfessionalsForRequest(meta, draft = {}) {
  const safeMeta = /** @type {any} */ (meta || {});
  const safeDraft = /** @type {any} */ (draft || {});
  const sirutaCode = clean(safeMeta.selected_locality_siruta_code || safeDraft.locality_siruta_code, 40);
  const queryScope = clean(safeMeta.query_scope, 20) || "locality";

  if (queryScope !== "national" && !sirutaCode) {
    throw new Error("Localitatea selectată nu mai este disponibilă.");
  }

  const response = await withTimeout(
    base44.functions.invoke("matchProfessionals", {
      service_keys: serviceKeysFromMeta(safeMeta),
      need_level: clean(safeMeta.need_level, 40) || "general",
      locality_siruta_code: sirutaCode,
      query_scope: queryScope,
      limit: 30,
    }),
    PROFESSIONAL_MATCHING_TIMEOUT_MS,
  );

  const data = /** @type {any} */ (response || {}).data || {};
  if (data.error) throw new Error(data.error);
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : [],
  };
}

/**
 * Rasfoirea specialistilor publici dintr-o localitate, pentru /cauta.
 *
 * Foloseste aceeasi functie ca recomandarea, nu una noua: fara chei de serviciu, toate intrarile
 * cad in grupul `directory` si ies in ordine determinista - exact ce inseamna o listare, nu un
 * clasament. Un al doilea endpoint ar fi insemnat o a doua definitie a lui "specialist public".
 *
 * @param {{ localitySirutaCode: string, serviceKeys?: string[], limit?: number }} input
 */
export async function browsePublicProfessionals({ localitySirutaCode, serviceKeys = [], limit = 30 } = {}) {
  const sirutaCode = clean(localitySirutaCode, 40);
  if (!sirutaCode) return { results: [] };

  const response = await withTimeout(
    base44.functions.invoke("matchProfessionals", {
      service_keys: Array.isArray(serviceKeys) ? serviceKeys : [],
      need_level: "general",
      locality_siruta_code: sirutaCode,
      query_scope: "locality",
      limit,
    }),
    PROFESSIONAL_MATCHING_TIMEOUT_MS,
  );

  const data = /** @type {any} */ (response || {}).data || {};
  if (data.error) throw new Error(data.error);
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : [],
  };
}
