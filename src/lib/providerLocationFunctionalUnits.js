export const FUNCTIONAL_UNIT_KEYS = [
  "optical_store",
  "optometry_cabinet",
  "contact_lens_center",
  "optical_workshop",
  "optical_laboratory",
  "ophthalmology_office",
  "ophthalmology_diagnostics",
  "ophthalmology_specialties",
  "ophthalmology_procedures",
];

export const LOCATION_FUNCTIONAL_UNITS = {
  optical_store: {
    key: "optical_store",
    title: "Magazin optic / showroom",
    shortTitle: "Magazin optic",
    publicLabel: "Produse optice",
    description: "Rame, ochelari, lentile pentru ochelari, ochelari de soare, lentile de contact și accesorii disponibile pentru clienți.",
    kind: "commercial",
  },
  optometry_cabinet: {
    key: "optometry_cabinet",
    title: "Cabinet optometric",
    shortTitle: "Cabinet optometric",
    publicLabel: "Control vedere și dioptrii",
    description: "Evaluări optometrice, determinarea dioptriilor și măsurători realizate de un specialist compatibil.",
    kind: "professional_cabinet",
  },
  contact_lens_center: {
    key: "contact_lens_center",
    title: "Lentile de contact",
    shortTitle: "Lentile de contact",
    publicLabel: "Lentile de contact",
    description: "Separă produsele vândute de consultația, adaptarea, proba și controlul profesional al lentilelor de contact.",
    kind: "mixed",
  },
  optical_workshop: {
    key: "optical_workshop",
    title: "Atelier optic și montaj",
    shortTitle: "Atelier optic",
    publicLabel: "Reparații și ajustări ochelari",
    description: "Reglaje, ajustări, reparații, montaj și înlocuirea lentilelor sau a componentelor ramei.",
    kind: "technical",
  },
  optical_laboratory: {
    key: "optical_laboratory",
    title: "Laborator optic",
    shortTitle: "Laborator optic",
    publicLabel: "Prelucrare și montaj optic",
    description: "Capabilități tehnice avansate de prelucrare, șlefuire, montaj și comenzi speciale, distincte de reglajele uzuale din magazin.",
    kind: "technical_advanced",
  },
  ophthalmology_office: {
    key: "ophthalmology_office",
    title: "Cabinet oftalmologic",
    shortTitle: "Cabinet oftalmologic",
    publicLabel: "Consultații oftalmologice",
    description: "Consultații și controale medicale efectuate de un medic oftalmolog într-un spațiu compatibil.",
    kind: "medical_cabinet",
  },
  ophthalmology_diagnostics: {
    key: "ophthalmology_diagnostics",
    title: "Investigații oftalmologice",
    shortTitle: "Investigații",
    publicLabel: "Investigații oftalmologice",
    description: "Investigații disponibile în funcție de aparatura, specialistul și condițiile verificate ale locației.",
    kind: "medical_diagnostics",
  },
  ophthalmology_specialties: {
    key: "ophthalmology_specialties",
    title: "Arii de expertiză medicală",
    shortTitle: "Specializări medicale",
    publicLabel: "Afecțiuni și specializări",
    description: "Afecțiuni și arii de expertiză pentru care locația are medici și resurse relevante.",
    kind: "medical_specialty",
  },
  ophthalmology_procedures: {
    key: "ophthalmology_procedures",
    title: "Proceduri și chirurgie",
    shortTitle: "Proceduri și chirurgie",
    publicLabel: "Proceduri oftalmologice",
    description: "Proceduri care necesită verificarea individuală a medicului, aparaturii și infrastructurii.",
    kind: "medical_procedure",
  },
};

export const FUNCTIONAL_UNIT_PROFILE_LAYOUTS = {
  independent_optical_store: {
    primary: ["optical_store"],
    optional: ["optometry_cabinet", "contact_lens_center", "optical_workshop", "ophthalmology_office", "ophthalmology_diagnostics"],
  },
  optical_chain: {
    primary: ["optical_store"],
    optional: ["optometry_cabinet", "contact_lens_center", "optical_workshop", "ophthalmology_office", "ophthalmology_diagnostics"],
  },
  independent_optometrist: {
    primary: ["optometry_cabinet", "contact_lens_center"],
    optional: ["optical_store", "optical_workshop"],
  },
  independent_optician: {
    primary: ["optical_store", "optical_workshop"],
    optional: ["contact_lens_center", "optical_laboratory"],
  },
  ophthalmology_office: {
    primary: ["ophthalmology_office", "ophthalmology_diagnostics"],
    optional: ["ophthalmology_specialties", "ophthalmology_procedures", "optometry_cabinet", "contact_lens_center", "optical_store"],
  },
  independent_ophthalmologist: {
    primary: ["ophthalmology_office"],
    optional: ["ophthalmology_diagnostics", "ophthalmology_specialties", "ophthalmology_procedures", "contact_lens_center"],
  },
  ophthalmology_clinic: {
    primary: ["ophthalmology_office", "ophthalmology_diagnostics", "ophthalmology_specialties"],
    optional: ["ophthalmology_procedures", "optometry_cabinet", "contact_lens_center", "optical_store", "optical_workshop"],
  },
  optical_laboratory_b2c: {
    primary: ["optical_laboratory", "optical_workshop"],
    optional: ["optical_store"],
  },
  optical_laboratory_b2b: {
    primary: ["optical_laboratory"],
    optional: ["optical_workshop"],
  },
  future_b2b_distributor: {
    primary: ["optical_laboratory"],
    optional: [],
  },
};

export const LEGACY_FUNCTIONAL_UNIT_PROFILE_LAYOUTS = {
  optica_medicala: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.independent_optical_store,
  clinica_oftalmologica: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.ophthalmology_clinic,
  cabinet_oftalmologic: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.ophthalmology_office,
  cabinet_optometric: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.independent_optometrist,
  optometrist_independent: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.independent_optometrist,
  medic_oftalmolog_independent: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.independent_ophthalmologist,
  laborator_optic: FUNCTIONAL_UNIT_PROFILE_LAYOUTS.optical_laboratory_b2c,
};

export function getFunctionalUnitLayout(profileType, legacyProviderType) {
  return FUNCTIONAL_UNIT_PROFILE_LAYOUTS[profileType]
    || LEGACY_FUNCTIONAL_UNIT_PROFILE_LAYOUTS[legacyProviderType]
    || { primary: ["optical_store"], optional: ["optometry_cabinet", "contact_lens_center", "optical_workshop"] };
}

export function getFunctionalUnitDefinition(key) {
  return LOCATION_FUNCTIONAL_UNITS[key] || null;
}

export function normalizeFunctionalUnitKeys(value, allowedKeys = FUNCTIONAL_UNIT_KEYS) {
  const allowed = new Set(allowedKeys);
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
}
