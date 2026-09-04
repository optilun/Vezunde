import {
  CANONICAL_SERVICE_REGISTRY,
  LEGACY_SERVICE_ALIASES,
} from "./canonicalServiceCatalog";
import { PROFESSIONAL_TYPES as PROFESSIONAL_TYPE_ENTRIES } from "../../shared/professionalIdentity.js";

const CANONICAL_SERVICE_LABELS = Object.fromEntries(
  Object.entries(CANONICAL_SERVICE_REGISTRY).map(([key, definition]) => [key, definition.label]),
);

const LEGACY_SERVICE_LABELS = Object.fromEntries(
  Object.entries(LEGACY_SERVICE_ALIASES).map(([legacyKey, canonicalKey]) => [
    legacyKey,
    CANONICAL_SERVICE_REGISTRY[canonicalKey]?.label || legacyKey,
  ]),
);

// Compatibility export: canonical labels are authoritative; deterministic legacy
// aliases remain readable until existing intake flows are migrated.
export const SERVICES = {
  ...CANONICAL_SERVICE_LABELS,
  ...LEGACY_SERVICE_LABELS,
  // Ambiguous legacy keys stay display-only and are never normalized automatically.
  ochi_uscat: "Ochi uscat",
};

export const FACILITIES = {
  laborator_optic_propriu: "Laborator optic propriu",
  atelier_service_propriu: "Atelier de service propriu",
  reparatii_pe_loc: "Reparații pe loc",
  laborator_partener: "Laborator partener",
  montaj_lentile_in_locatie: "Montaj lentile în locație",
};

export const PROVIDER_TYPES = {
  optica_medicala: "Optică medicală",
  clinica_oftalmologica: "Clinică oftalmologică",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  cabinet_optometric: "Cabinet optometric",
  laborator_optic: "Laborator optic",
  optometrist_independent: "Optometrist independent",
  medic_oftalmolog_independent: "Medic oftalmolog independent",
};

export const PROVIDER_PROFILE_TYPES = {
  independent_optical_store: "Optică independentă",
  optical_chain: "Lanț de optici",
  ophthalmology_clinic: "Clinică oftalmologică",
  ophthalmology_office: "Cabinet oftalmologic",
  independent_ophthalmologist: "Medic oftalmolog independent",
  independent_optometrist: "Optometrist independent",
  independent_optician: "Optician independent",
  optical_laboratory_b2c: "Laborator optic B2C",
  optical_laboratory_b2b: "Laborator optic B2B",
  future_b2b_distributor: "Furnizor / partener B2B",
};

// 2026-09-03: etichetele profesiilor vin din shared/professionalIdentity.js. Harta e derivata,
// nu rescrisa, si acopera in continuare si codurile canonice (engleza), si rolurile legacy
// (romana), pentru ca ambele exista in date.
export const PROFESSIONAL_TYPES = Object.freeze(Object.fromEntries(
  PROFESSIONAL_TYPE_ENTRIES.flatMap((entry) => [
    [entry.code, entry.label],
    [entry.legacy_role, entry.label],
  ]),
));

export const PROFESSIONAL_AFFILIATION_STATUS = {
  location_added: "Adăugat de locație",
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
  if (PATIENT_FACING_PROFILE_TYPES.includes(profileType)) return "Director pacienți";
  if (PROFESSIONAL_ONLY_PROFILE_TYPES.includes(profileType)) return "Profil profesional";
  if (B2B_ONLY_PROFILE_TYPES.includes(profileType)) return "Parteneri B2B";
  return "Profil neclasificat";
}

export const CITIES = ["Bucuresti", "Cluj-Napoca", "Timisoara", "Iasi", "Brasov", "Constanta"];

export const CITY_LABELS = {
  Bucuresti: "București",
  "Cluj-Napoca": "Cluj-Napoca",
  Timisoara: "Timișoara",
  Iasi: "Iași",
  Brasov: "Brașov",
  Constanta: "Constanța",
};

export function getCityLabel(city) {
  return CITY_LABELS[city] || city;
}

// Existing intake categories keep their legacy keys for backward compatibility.
// matchProviders normalizes deterministic aliases through the canonical registry.
export const CATEGORIES = [
  { key: "control_vedere", label: "Control vedere", services: ["control_vedere_adulti", "control_vedere_copii"] },
  { key: "consult_oftalmologic", label: "Consult oftalmologic", services: ["consult_oftalmologic"] },
  { key: "copii_miopie", label: "Control vedere copii", services: ["control_vedere_copii"] },
  { key: "lentile_ochelari", label: "Lentile și ochelari", services: ["lentile_contact", "lentile_progresive", "montaj_lentile"] },
  { key: "reparatii", label: "Reparații ochelari", services: ["reparatii_ochelari", "reglaj_rame", "montaj_lentile"] },
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
  const normalized = text.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) return entry.category;
  }
  return null;
}

export function getCategory(key) {
  return CATEGORIES.find((category) => category.key === key) || null;
}

// Matching-ul real se face in functia backend matchProviders,
// exclusiv pe baza serviciilor, specializarilor, echipei, locatiei si verificarii.
