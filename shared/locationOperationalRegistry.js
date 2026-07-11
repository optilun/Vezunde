// Shared registry for the physical spaces and operational capabilities of a provider location.
// Keep physical units separate from capabilities: a cabinet or workshop is a place,
// while contact-lens fitting, pediatric care or B2B distribution are activities.

export const CARE_SETTING_KEYS = [
  "retail_only",
  "outpatient",
  "day_care",
  "inpatient",
  "emergency",
  "mixed",
  "not_applicable",
];

export const CARE_SETTINGS = {
  retail_only: { key: "retail_only", label: "Activitate comercială", publicLabel: "Optică și produse" },
  outpatient: { key: "outpatient", label: "Ambulatoriu / fără internare", publicLabel: "Servicii în ambulatoriu" },
  day_care: { key: "day_care", label: "Spitalizare de zi / proceduri de zi", publicLabel: "Proceduri de zi" },
  inpatient: { key: "inpatient", label: "Spitalizare continuă", publicLabel: "Servicii cu internare" },
  emergency: { key: "emergency", label: "Urgență", publicLabel: "Urgențe" },
  mixed: { key: "mixed", label: "Activitate mixtă", publicLabel: "Servicii mixte" },
  not_applicable: { key: "not_applicable", label: "Nu se aplică", publicLabel: "" },
};

export const FUNCTIONAL_UNIT_KEYS = [
  "optical_store",
  "optical_cabinet",
  "optometry_cabinet",
  "ophthalmology_office",
  "optical_workshop",
  "optical_laboratory",
  "ophthalmology_diagnostics",
  "ophthalmology_procedure_room",
  "ophthalmology_surgery_unit",
  "b2b_distribution_center",
];

export const LOCATION_FUNCTIONAL_UNITS = {
  optical_store: {
    key: "optical_store",
    title: "Magazin optic / showroom",
    shortTitle: "Magazin optic",
    publicLabel: "Produse optice",
    description: "Zona comercială în care clienții găsesc rame, ochelari, lentile, produse de soare, lentile de contact și accesorii.",
    kind: "commercial_space",
    defaultCareSetting: "retail_only",
  },
  optical_cabinet: {
    key: "optical_cabinet",
    title: "Cabinet de optică",
    shortTitle: "Cabinet de optică",
    publicLabel: "Măsurători și servicii de optică",
    description: "Spațiu profesional autorizat pentru activități de optică, distinct de simpla zonă comercială și de cabinetul optometric.",
    kind: "professional_cabinet",
    defaultCareSetting: "outpatient",
  },
  optometry_cabinet: {
    key: "optometry_cabinet",
    title: "Cabinet optometric",
    shortTitle: "Cabinet optometric",
    publicLabel: "Control vedere și dioptrii",
    description: "Spațiu pentru evaluări optometrice, determinarea dioptriilor, vedere binoculară și alte activități realizate de un specialist compatibil.",
    kind: "professional_cabinet",
    defaultCareSetting: "outpatient",
  },
  ophthalmology_office: {
    key: "ophthalmology_office",
    title: "Cabinet oftalmologic",
    shortTitle: "Cabinet oftalmologic",
    publicLabel: "Consultații oftalmologice",
    description: "Spațiu medical pentru consultații și controale efectuate de medicul oftalmolog.",
    kind: "medical_cabinet",
    defaultCareSetting: "outpatient",
  },
  optical_workshop: {
    key: "optical_workshop",
    title: "Atelier optic și montaj",
    shortTitle: "Atelier optic",
    publicLabel: "Reparații și ajustări ochelari",
    description: "Spațiu pentru reglaje, ajustări, reparații, montaj și înlocuirea lentilelor sau a componentelor ramei.",
    kind: "technical_space",
    defaultCareSetting: "not_applicable",
  },
  optical_laboratory: {
    key: "optical_laboratory",
    title: "Laborator optic",
    shortTitle: "Laborator optic",
    publicLabel: "Prelucrare și montaj optic",
    description: "Spațiu tehnic avansat pentru șlefuire, găurire, șanțuire, montaj complex, control final și comenzi speciale.",
    kind: "technical_advanced_space",
    defaultCareSetting: "not_applicable",
  },
  ophthalmology_diagnostics: {
    key: "ophthalmology_diagnostics",
    title: "Zonă de investigații oftalmologice",
    shortTitle: "Investigații",
    publicLabel: "Investigații oftalmologice",
    description: "Spațiu sau zonă dotată pentru investigații, cu aparatura, specialistul și condițiile necesare.",
    kind: "medical_diagnostics_space",
    defaultCareSetting: "outpatient",
  },
  ophthalmology_procedure_room: {
    key: "ophthalmology_procedure_room",
    title: "Sală de proceduri oftalmologice",
    shortTitle: "Sală de proceduri",
    publicLabel: "Proceduri oftalmologice",
    description: "Spațiu dedicat procedurilor minore, injecțiilor sau tratamentelor laser, verificat separat de cabinetul de consultații.",
    kind: "medical_procedure_space",
    defaultCareSetting: "day_care",
  },
  ophthalmology_surgery_unit: {
    key: "ophthalmology_surgery_unit",
    title: "Unitate de chirurgie oftalmologică",
    shortTitle: "Chirurgie oftalmologică",
    publicLabel: "Chirurgie oftalmologică",
    description: "Bloc operator sau unitate chirurgicală cu infrastructură și aparatură verificate pentru intervențiile declarate.",
    kind: "medical_surgical_space",
    defaultCareSetting: "day_care",
  },
  b2b_distribution_center: {
    key: "b2b_distribution_center",
    title: "Centru de distribuție B2B",
    shortTitle: "Distribuție B2B",
    publicLabel: "",
    description: "Activitate profesională de distribuție, logistică și suport pentru optici, cabinete, clinici sau laboratoare.",
    kind: "b2b_space",
    defaultCareSetting: "not_applicable",
  },
};

export const CAPABILITY_KEYS = [
  "contact_lens_sales",
  "contact_lens_professional_services",
  "pediatric_eye_care",
  "ophthalmology_specialties",
  "emergency_ophthalmology",
  "low_vision_rehabilitation",
  "b2b_distribution",
  "b2b_logistics",
  "b2b_technical_support",
];

export const LOCATION_CAPABILITIES = {
  contact_lens_sales: {
    key: "contact_lens_sales",
    title: "Vânzare lentile de contact",
    shortTitle: "Produse pentru lentile de contact",
    publicLabel: "Lentile de contact",
    description: "Produse disponibile pentru cumpărare, fără a implica automat consultație sau adaptare profesională.",
    allowedParentUnits: ["optical_store"],
    kind: "commercial_capability",
  },
  contact_lens_professional_services: {
    key: "contact_lens_professional_services",
    title: "Adaptare și monitorizare lentile de contact",
    shortTitle: "Servicii pentru lentile de contact",
    publicLabel: "Adaptare lentile de contact",
    description: "Consultație, probă, instruire, adaptare și control ulterior realizate într-un cabinet compatibil.",
    allowedParentUnits: ["optometry_cabinet", "ophthalmology_office"],
    kind: "professional_capability",
  },
  pediatric_eye_care: {
    key: "pediatric_eye_care",
    title: "Servicii pentru copii",
    shortTitle: "Copii",
    publicLabel: "Oftalmologie și vedere pentru copii",
    description: "Evaluări, screening, refracție, ambliopie, strabism și monitorizarea miopiei la copii.",
    allowedParentUnits: ["optometry_cabinet", "ophthalmology_office", "ophthalmology_diagnostics"],
    kind: "clinical_capability",
  },
  ophthalmology_specialties: {
    key: "ophthalmology_specialties",
    title: "Arii de expertiză medicală",
    shortTitle: "Specializări medicale",
    publicLabel: "Afecțiuni și specializări",
    description: "Afecțiuni și arii medicale pentru care locația are medici și resurse relevante.",
    allowedParentUnits: ["ophthalmology_office"],
    kind: "medical_expertise_capability",
  },
  emergency_ophthalmology: {
    key: "emergency_ophthalmology",
    title: "Urgențe și traumatisme oculare",
    shortTitle: "Urgențe oftalmologice",
    publicLabel: "Urgențe oftalmologice",
    description: "Evaluarea urgențelor și traumatismelor în limitele programului, personalului și infrastructurii verificate.",
    allowedParentUnits: ["ophthalmology_office", "ophthalmology_procedure_room", "ophthalmology_surgery_unit"],
    kind: "medical_emergency_capability",
  },
  low_vision_rehabilitation: {
    key: "low_vision_rehabilitation",
    title: "Vedere slabă și reabilitare vizuală",
    shortTitle: "Reabilitare vizuală",
    publicLabel: "Vedere slabă și reabilitare",
    description: "Evaluare funcțională, recomandări și soluții pentru persoanele cu vedere slabă.",
    allowedParentUnits: ["optometry_cabinet", "ophthalmology_office"],
    kind: "rehabilitation_capability",
  },
  b2b_distribution: {
    key: "b2b_distribution",
    title: "Portofoliu și distribuție B2B",
    shortTitle: "Distribuție B2B",
    publicLabel: "",
    description: "Categorii de produse, branduri și clienți profesionali deserviți.",
    allowedParentUnits: ["b2b_distribution_center", "optical_laboratory"],
    kind: "b2b_capability",
  },
  b2b_logistics: {
    key: "b2b_logistics",
    title: "Logistică și livrare B2B",
    shortTitle: "Logistică B2B",
    publicLabel: "",
    description: "Preluare comenzi, termene, arie de livrare și modalități de expediere pentru parteneri.",
    allowedParentUnits: ["b2b_distribution_center", "optical_laboratory"],
    kind: "b2b_capability",
  },
  b2b_technical_support: {
    key: "b2b_technical_support",
    title: "Suport tehnic și comercial B2B",
    shortTitle: "Suport B2B",
    publicLabel: "",
    description: "Consultanță tehnică, suport comercial, instruire și servicii pentru parteneri profesionali.",
    allowedParentUnits: ["b2b_distribution_center", "optical_laboratory"],
    kind: "b2b_capability",
  },
};

function layout(primaryUnits, optionalUnits, primaryCapabilities = [], optionalCapabilities = [], careSettings = []) {
  return {
    primary: primaryUnits,
    optional: optionalUnits,
    primaryUnits,
    optionalUnits,
    primaryCapabilities,
    optionalCapabilities,
    careSettings,
  };
}

export const FUNCTIONAL_UNIT_PROFILE_LAYOUTS = {
  independent_optical_store: layout(
    ["optical_store"],
    ["optical_cabinet", "optometry_cabinet", "optical_workshop", "optical_laboratory", "ophthalmology_office", "ophthalmology_diagnostics"],
    ["contact_lens_sales"],
    ["contact_lens_professional_services", "pediatric_eye_care", "ophthalmology_specialties"],
    ["retail_only", "outpatient", "mixed"],
  ),
  optical_chain: layout(
    ["optical_store"],
    ["optical_cabinet", "optometry_cabinet", "optical_workshop", "optical_laboratory", "ophthalmology_office", "ophthalmology_diagnostics"],
    ["contact_lens_sales"],
    ["contact_lens_professional_services", "pediatric_eye_care", "ophthalmology_specialties"],
    ["retail_only", "outpatient", "mixed"],
  ),
  independent_optometrist: layout(
    ["optometry_cabinet"],
    ["optical_store", "optical_cabinet", "optical_workshop"],
    [],
    ["contact_lens_professional_services", "contact_lens_sales", "pediatric_eye_care", "low_vision_rehabilitation"],
    ["outpatient", "mixed"],
  ),
  independent_optician: layout(
    ["optical_store"],
    ["optical_cabinet", "optical_workshop", "optical_laboratory"],
    [],
    ["contact_lens_sales"],
    ["retail_only", "mixed"],
  ),
  ophthalmology_office: layout(
    ["ophthalmology_office"],
    ["ophthalmology_diagnostics", "ophthalmology_procedure_room", "optometry_cabinet", "optical_store"],
    [],
    ["ophthalmology_specialties", "pediatric_eye_care", "contact_lens_professional_services", "emergency_ophthalmology", "low_vision_rehabilitation"],
    ["outpatient", "day_care", "mixed"],
  ),
  independent_ophthalmologist: layout(
    ["ophthalmology_office"],
    ["ophthalmology_diagnostics", "ophthalmology_procedure_room"],
    [],
    ["ophthalmology_specialties", "pediatric_eye_care", "contact_lens_professional_services", "emergency_ophthalmology", "low_vision_rehabilitation"],
    ["outpatient", "day_care", "mixed"],
  ),
  ophthalmology_clinic: layout(
    ["ophthalmology_office", "ophthalmology_diagnostics"],
    ["ophthalmology_procedure_room", "ophthalmology_surgery_unit", "optometry_cabinet", "optical_store", "optical_workshop"],
    ["ophthalmology_specialties"],
    ["pediatric_eye_care", "contact_lens_professional_services", "emergency_ophthalmology", "low_vision_rehabilitation"],
    ["outpatient", "day_care", "inpatient", "emergency", "mixed"],
  ),
  optical_laboratory_b2c: layout(
    ["optical_laboratory"],
    ["optical_workshop", "optical_store"],
    [],
    [],
    ["not_applicable", "retail_only"],
  ),
  optical_laboratory_b2b: layout(
    ["optical_laboratory"],
    ["optical_workshop", "b2b_distribution_center"],
    ["b2b_distribution"],
    ["b2b_logistics", "b2b_technical_support"],
    ["not_applicable"],
  ),
  future_b2b_distributor: layout(
    ["b2b_distribution_center"],
    [],
    ["b2b_distribution"],
    ["b2b_logistics", "b2b_technical_support"],
    ["not_applicable"],
  ),
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

export function normalizeRegistryKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter((item) => allowed.has(item)))];
}

export function normalizeFunctionalUnitKeys(value) {
  return normalizeRegistryKeys(value, FUNCTIONAL_UNIT_KEYS);
}

export function normalizeCapabilityKeys(value) {
  return normalizeRegistryKeys(value, CAPABILITY_KEYS);
}

export function normalizeCareSetting(value, fallback = "not_applicable") {
  const key = String(value || "").trim();
  return CARE_SETTING_KEYS.includes(key) ? key : fallback;
}

export function getFunctionalUnitLayout(profileType, legacyProviderType) {
  return FUNCTIONAL_UNIT_PROFILE_LAYOUTS[profileType]
    || LEGACY_FUNCTIONAL_UNIT_PROFILE_LAYOUTS[legacyProviderType]
    || layout(
      ["optical_store"],
      ["optical_cabinet", "optometry_cabinet", "optical_workshop"],
      [],
      ["contact_lens_sales", "contact_lens_professional_services"],
      ["retail_only", "outpatient", "mixed"],
    );
}

export function getFunctionalUnitDefinition(key) {
  return LOCATION_FUNCTIONAL_UNITS[key] || null;
}

export function getCapabilityDefinition(key) {
  return LOCATION_CAPABILITIES[key] || null;
}

export function isCapabilityParentAllowed(capabilityKey, unitKey) {
  const capability = getCapabilityDefinition(capabilityKey);
  return Boolean(capability && capability.allowedParentUnits.includes(unitKey));
}

export function profileAllowsFunctionalUnit(profileType, legacyProviderType, unitKey) {
  const profileLayout = getFunctionalUnitLayout(profileType, legacyProviderType);
  return [...profileLayout.primaryUnits, ...profileLayout.optionalUnits].includes(unitKey);
}

export function profileAllowsCapability(profileType, legacyProviderType, capabilityKey) {
  const profileLayout = getFunctionalUnitLayout(profileType, legacyProviderType);
  return [...profileLayout.primaryCapabilities, ...profileLayout.optionalCapabilities].includes(capabilityKey);
}
