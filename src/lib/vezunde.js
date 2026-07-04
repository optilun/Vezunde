export const SERVICES = {
  control_vedere_adulti: "Control vedere adulti",
  control_vedere_copii: "Control vedere copii",
  consult_oftalmologic: "Consult oftalmologic",
  managementul_miopiei: "Managementul miopiei",
  ochi_uscat: "Ochi uscat",
  lentile_contact: "Lentile de contact",
  lentile_progresive: "Lentile progresive",
  reparatii_ochelari: "Reparatii ochelari",
  reglaj_rame: "Reglaj rame",
  montaj_lentile: "Montaj lentile",
  glaucom: "Glaucom",
  cataracta: "Cataracta",
  retina: "Retina",
  chirurgie_refractiva: "Chirurgie refractiva",
  oct: "OCT",
  camp_vizual: "Camp vizual",
  tonometrie: "Tonometrie",
};

export const PROVIDER_TYPES = {
  optica_medicala: "Optica medicala",
  clinica_oftalmologica: "Clinica oftalmologica",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  cabinet_optometric: "Cabinet optometric",
  laborator_optic: "Laborator optic",
};

export const PROFESSIONAL_TYPES = {
  medic_oftalmolog: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

export const CITIES = ["Bucuresti", "Cluj-Napoca", "Timisoara", "Iasi", "Brasov", "Constanta"];

export const CATEGORIES = [
  { key: "control_vedere", label: "Control vedere", services: ["control_vedere_adulti", "control_vedere_copii"] },
  { key: "consult_oftalmologic", label: "Consult oftalmologic", services: ["consult_oftalmologic"] },
  { key: "copii_miopie", label: "Copii si miopie", services: ["control_vedere_copii", "managementul_miopiei"] },
  { key: "lentile_ochelari", label: "Lentile si ochelari", services: ["lentile_contact", "lentile_progresive", "montaj_lentile"] },
  { key: "reparatii", label: "Reparatii ochelari", services: ["reparatii_ochelari", "reglaj_rame", "montaj_lentile"] },
  { key: "ochi_uscat", label: "Ochi uscat", services: ["ochi_uscat"] },
];

const KEYWORD_MAP = [
  { keywords: ["repar", "rupt", "surub", "brat", "balama"], category: "reparatii" },
  { keywords: ["miopie", "copil", "copii", "scoala"], category: "copii_miopie" },
  { keywords: ["uscat", "usturime", "iritat"], category: "ochi_uscat" },
  { keywords: ["lentile", "ochelari noi", "progresiv", "contact"], category: "lentile_ochelari" },
  { keywords: ["glaucom", "cataracta", "retina", "consult", "oftalmolog", "durere", "vedere incetosata"], category: "consult_oftalmologic" },
  { keywords: ["control", "vedere", "dioptri", "reteta"], category: "control_vedere" },
];

export function detectCategory(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((k) => t.includes(k))) return entry.category;
  }
  return null;
}

export function getCategory(key) {
  return CATEGORIES.find((c) => c.key === key) || null;
}

// Relevance scoring: services matched, verified profile, response quality.
// Never company size, chain size or price.
export function scoreLocation(location, serviceKeys = [], city = "") {
  if (city && location.city !== city) return -1;
  const matched = (location.services || []).filter((s) => serviceKeys.includes(s)).length;
  if (serviceKeys.length > 0 && matched === 0) return -1;
  let score = matched * 3;
  if (location.is_verified) score += 2;
  score += (location.response_quality_score || 0) / 50;
  return score;
}

export function rankLocations(locations, serviceKeys = [], city = "") {
  return locations
    .map((l) => ({ location: l, score: scoreLocation(l, serviceKeys, city) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.location);
}