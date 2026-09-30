// Filtrele listei de recomandari (2026-09-30).
//
// Ca filtrul de harta al ecranului de recomandari, aceste filtre sunt PUR VIZUALE: ascund carduri
// din lista deja primita, in ordinea primita. Nu cheama serverul, nu recalculeaza bucketul sau
// rangul si nu schimba cine primeste cererea (cererea se trimite pe lista completa).
//
// Filtrele au doar date reale in spate: tipul locatiei (`provider_type`) si starea profilului
// (`profile_control_status`). Nu exista filtru pentru CAS sau „deschis acum”, pentru ca
// rezultatele recomandarii nu poarta aceste informatii.
//
// Fisierul nu importa nimic din aplicatie, ca sa poata fi verificat direct cu node.

export const TRUSTED_PROFILE_STATUSES = Object.freeze(["verified", "claimed"]);

// Ordinea in care apar tipurile in filtre (aceeasi ca la filtrele de pe /cauta).
export const TYPE_ORDER = Object.freeze([
  "optica_medicala",
  "clinica_oftalmologica",
  "cabinet_oftalmologic",
  "cabinet_optometric",
  "laborator_optic",
  "optometrist_independent",
  "medic_oftalmolog_independent",
]);

export const NO_FILTERS = Object.freeze({ types: Object.freeze([]), trustedOnly: false });

export function normalizeFilters(value) {
  const types = Array.isArray(value?.types)
    ? value.types.filter((key) => typeof key === "string" && key.length > 0)
    : [];
  return { types: [...new Set(types)], trustedOnly: value?.trustedOnly === true };
}

export function countActiveFilters(filters) {
  return (filters?.types?.length || 0) + (filters?.trustedOnly ? 1 : 0);
}

export function isTrustedProfile(result) {
  return TRUSTED_PROFILE_STATUSES.includes(result?.profile_control_status);
}

// Un subset al listei, in aceeasi ordine. Fara filtre intoarce chiar lista primita.
export function applyRecommendationFilters(list, filters) {
  if (!Array.isArray(list) || countActiveFilters(filters) === 0) return list;
  const types = new Set(filters.types);
  return list.filter((result) => (
    (types.size === 0 || types.has(result?.provider_type))
    && (!filters.trustedOnly || isTrustedProfile(result))
  ));
}

// Tipurile prezente in lista, cu numarul de locatii. Un tip ales care nu mai exista in lista (dupa
// o extindere de arie) ramane in optiuni cu 0, ca sa poata fi debifat.
export function typeCountsFor(list, filters) {
  const counts = new Map();
  for (const result of Array.isArray(list) ? list : []) {
    const key = result?.provider_type;
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const key of filters?.types || []) if (!counts.has(key)) counts.set(key, 0);
  const rank = (key) => {
    const index = TYPE_ORDER.indexOf(key);
    return index === -1 ? TYPE_ORDER.length : index;
  };
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => rank(a.key) - rank(b.key));
}

export function trustedCountFor(list) {
  return (Array.isArray(list) ? list : []).filter(isTrustedProfile).length;
}
