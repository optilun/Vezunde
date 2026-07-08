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
  fund_de_ochi: "Fund de ochi",
  topografie_corneana: "Topografie corneana",
  pahimetrie: "Pahimetrie",
  biometrie: "Biometrie",
};

export const FACILITIES = {
  laborator_optic_propriu: "Laborator optic propriu",
  atelier_service_propriu: "Atelier de service propriu",
  reparatii_pe_loc: "Reparatii pe loc",
  laborator_partener: "Laborator partener",
  montaj_lentile_in_locatie: "Montaj lentile in locatie",
};

export const PROVIDER_TYPES = {
  optica_medicala: "Optica medicala",
  clinica_oftalmologica: "Clinica oftalmologica",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  cabinet_optometric: "Cabinet optometric",
  laborator_optic: "Laborator optic",
  optometrist_independent: "Optometrist independent",
  medic_oftalmolog_independent: "Medic oftalmolog independent",
};

export const PROVIDER_PROFILE_TYPES = {
  independent_optical_store: "Optica independenta",
  optical_chain: "Lant de optici",
  ophthalmology_clinic: "Clinica oftalmologica",
  ophthalmology_office: "Cabinet oftalmologic",
  independent_ophthalmologist: "Medic oftalmolog independent",
  independent_optometrist: "Optometrist independent",
  independent_optician: "Optician independent",
  optical_laboratory_b2c: "Laborator optic B2C",
  optical_laboratory_b2b: "Laborator optic B2B",
  future_b2b_distributor: "Furnizor / partener B2B",
};

export const PROFESSIONAL_TYPES = {
  medic_oftalmolog: "Medic oftalmolog",
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

export const PROFESSIONAL_AFFILIATION_STATUS = {
  location_added: "Adaugat de locatie",
  professional_confirmed: "Confirmat de specialist",
  vezunde_verified: "Verificat de Vezunde",
};

export const PATIENT_FACING_PROFILE_TYPES = [
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
];

export const PROFESSIONAL_ONLY_PROFILE_TYPES = [
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
];

export const B2B_ONLY_PROFILE_TYPES = [
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor",
];

export function getProfileAudience(profileType) {
  if (PATIENT_FACING_PROFILE_TYPES.includes(profileType)) return "Director pacienti";
  if (PROFESSIONAL_ONLY_PROFILE_TYPES.includes(profileType)) return "Profil profesional";
  if (B2B_ONLY_PROFILE_TYPES.includes(profileType)) return "Parteneri B2B";
  return "Profil neclasificat";
}

export const CITIES = ["Bucuresti", "Cluj-Napoca", "Timisoara", "Iasi", "Brasov", "Constanta"];

export const CATEGORIES = [
  { key: "control_vedere", label: "Control vedere", services: ["control_vedere_adulti", "control_vedere_copii"] },
  { key: "consult_oftalmologic", label: "Consult oftalmologic", services: ["consult_oftalmologic"] },
  // Modul 3E.1: nevoia legata de copii ramane neutra — nu implica managementul miopiei.
  { key: "copii_miopie", label: "Control vedere copii", services: ["control_vedere_copii"] },
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

// Matching-ul real se face in functia backend matchProviders,
// exclusiv pe baza serviciilor, specializarilor, echipei, locatiei si verificarii.
