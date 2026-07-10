import {
  CANONICAL_SERVICE_KEYS,
  CANONICAL_SERVICE_REGISTRY,
  classifyServiceNeedLevel,
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from "./canonicalServiceCatalog";

const buckets = {
  general: [],
  technical: [],
  specialized_medical: [],
};

for (const key of CANONICAL_SERVICE_KEYS) {
  const definition = CANONICAL_SERVICE_REGISTRY[key];
  const level = classifyServiceNeedLevel(key);
  const bucket = buckets[level] || buckets.specialized_medical;
  bucket.push({ key, label: definition.label });
}

// Kept for the existing admin UI, now generated from all 94 canonical keys.
export const SERVICE_CATALOG_3C = buckets;

export const SERVICE_CATALOG_META = Object.fromEntries(
  CANONICAL_SERVICE_KEYS.map((key) => [key, getCanonicalServiceDefinition(key)]),
);

export { getCanonicalServiceDefinition, normalizeServiceKey };

export const PROVIDER_TYPES_3C = [
  { key: "optica_medicala", label: "Optica medicala" },
  { key: "clinica_oftalmologica", label: "Clinica oftalmologica" },
  { key: "cabinet_oftalmologic", label: "Cabinet oftalmologic" },
  { key: "cabinet_optometric", label: "Cabinet optometric" },
  { key: "laborator_optic", label: "Laborator optic" },
  { key: "optometrist_independent", label: "Optometrist independent" },
  { key: "medic_oftalmolog_independent", label: "Medic oftalmolog independent" },
];

export const CONFIRMATION_LABELS = {
  not_confirmed: "Neconfirmat",
  publicly_listed: "Listat public",
  provider_confirmed: "Confirmat de furnizor",
  vezunde_verified: "Verificat Vezunde",
};

export const PCS_LABELS = {
  directory: "Directory",
  claimed: "Revendicat",
  verified: "Verificat",
  suspended: "Suspendat",
};
