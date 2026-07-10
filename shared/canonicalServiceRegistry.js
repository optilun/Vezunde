// Single canonical registry for provider services.
// This module is consumed by the frontend and Base44 functions.
// Keep all keys, labels, aliases and eligibility defaults here.

export const PROFILE_TYPES = [
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor",
];

export const SERVICE_GROUPS = {
  optical_retail: {
    label: "Produse optice și soluții pentru vedere",
    helper: "Selectează produsele și soluțiile optice disponibile pentru clienți în această locație.",
    ids: {
      eyeglasses: "Ochelari de vedere",
      frames: "Rame de ochelari",
      prescription_lenses: "Lentile pentru ochelari",
      sunglasses: "Ochelari de soare",
      prescription_sunglasses: "Ochelari de soare cu dioptrii",
      children_frames: "Rame pentru copii",
      sports_glasses: "Ochelari sport",
      safety_glasses: "Ochelari de protecție",
      accessories: "Accesorii pentru ochelari",
    },
  },
  lenses_and_measurements: {
    label: "Lentile și măsurători personalizate",
    helper: "Servicii legate de alegerea, măsurarea și personalizarea lentilelor pentru ochelari.",
    ids: {
      single_vision_lenses: "Lentile monofocale",
      progressive_lenses: "Lentile progresive",
      office_lenses: "Lentile office / intermediare",
      reading_lenses: "Lentile pentru aproape",
      thin_lenses: "Lentile subțiate",
      photochromic_lenses: "Lentile fotocromatice",
      polarized_lenses: "Lentile polarizate",
      blue_light_lenses: "Protecție pentru lumină albastră",
      prism_lenses: "Lentile prismatice",
      pd_measurement: "Măsurarea distanței pupilare",
      digital_centering: "Centrare digitală a lentilelor",
    },
  },
  optometry: {
    label: "Optometrie și evaluarea vederii",
    helper: "Servicii de evaluare optometrică, măsurare a dioptriilor și recomandări pentru corecție vizuală.",
    ids: {
      optometry_consultation: "Consult optometric",
      visual_acuity_test: "Test de acuitate vizuală",
      refraction: "Determinarea dioptriilor",
      autorefractometry: "Autorefractometrie",
      binocular_vision: "Evaluarea vederii binoculare",
      dry_eye_screening: "Screening pentru ochi uscat",
      color_vision_test: "Test pentru vederea cromatică",
      occupational_vision: "Evaluare vizuală pentru activitatea profesională",
    },
  },
  contact_lenses: {
    label: "Lentile de contact",
    helper: "Servicii pentru recomandarea, adaptarea și monitorizarea purtării lentilelor de contact.",
    ids: {
      contact_lenses: "Lentile de contact",
      contact_lens_consultation: "Consult pentru lentile de contact",
      contact_lens_fitting: "Adaptare lentile de contact",
      contact_lens_trial: "Probă lentile de contact",
      toric_contact_lenses: "Lentile de contact torice",
      multifocal_contact_lenses: "Lentile de contact multifocale",
      rgp_lenses: "Lentile rigide gaz-permeabile",
      scleral_lenses: "Lentile sclerale",
      contact_lens_followup: "Control pentru lentile de contact",
    },
  },
  ophthalmology_consults: {
    label: "Consultații oftalmologice",
    helper: "Consultații și controale medicale efectuate de un medic oftalmolog.",
    ids: {
      ophthalmology_consultation: "Consult oftalmologic",
      complete_eye_exam: "Examinare oftalmologică completă",
      prescription_check: "Verificarea rețetei pentru ochelari",
      eye_pressure_check: "Măsurarea tensiunii intraoculare",
      fundus_exam: "Examinarea fundului de ochi",
      anterior_segment_exam: "Examinarea segmentului anterior",
      followup_consultation: "Control oftalmologic",
      second_opinion: "A doua opinie medicală",
    },
  },
  investigations: {
    label: "Investigații și aparatură oftalmologică",
    helper: "Investigații disponibile în locație, în funcție de dotări și personalul autorizat.",
    ids: {
      oct: "OCT",
      visual_field_analyzer: "Câmp vizual",
      fundus_camera: "Fotografie de fund de ochi",
      pachymeter: "Pahimetrie",
      biometer: "Biometrie oculară",
      corneal_topography: "Topografie corneană",
      keratometry: "Keratometrie",
      tonometry: "Tonometrie",
      gonioscopy: "Gonioscopie",
      ultrasound: "Ecografie oculară",
      specular_microscopy: "Microscopie speculară",
      angiography: "Angiografie retiniană",
    },
  },
  specialties: {
    label: "Arii medicale specializate",
    helper: "Zone de expertiză medicală sau servicii specializate disponibile în această locație.",
    ids: {
      retina_consultation: "Retină",
      glaucoma_consultation: "Glaucom",
      cataract_consultation: "Cataractă",
      cornea_consultation: "Cornee",
      pediatric_ophthalmology: "Oftalmologie pediatrică",
      strabismus: "Strabism",
      neuro_ophthalmology: "Neuro-oftalmologie",
      uveitis: "Uveită",
      myopia_management: "Managementul miopiei",
      dry_eye_management: "Managementul ochiului uscat",
      diabetic_retinopathy: "Retinopatie diabetică",
      macular_degeneration: "Degenerescență maculară",
      emergency_ophthalmology: "Urgențe oftalmologice",
    },
  },
  procedures_surgery: {
    label: "Proceduri și chirurgie oftalmologică",
    helper: "Proceduri medicale care necesită verificare înainte de publicare și folosire în recomandări.",
    ids: {
      cataract_surgery: "Chirurgia cataractei",
      refractive_surgery: "Chirurgie refractivă",
      laser_procedures: "Proceduri laser",
      yag_laser: "Laser YAG",
      retinal_laser: "Laser retinian",
      intravitreal_injections: "Injecții intravitreene",
      eyelid_surgery: "Chirurgia pleoapelor",
      chalazion_treatment: "Tratamentul șalazionului",
      minor_eye_procedures: "Proceduri oftalmologice minore",
    },
  },
  children_and_prevention: {
    label: "Copii și prevenție vizuală",
    helper: "Servicii pentru copii, screening, monitorizare și prevenție vizuală.",
    ids: {
      children_eye_exam: "Consult pentru copii",
      pediatric_refraction: "Determinarea dioptriilor la copii",
      amblyopia_screening: "Screening pentru ambliopie",
      strabismus_screening: "Screening pentru strabism",
      school_screening: "Screening școlar",
      myopia_control_children: "Controlul miopiei la copii",
      vision_therapy: "Terapie vizuală",
    },
  },
  technical_activities: {
    label: "Atelier optic și activități tehnice",
    helper: "Servicii tehnice pentru ochelari și lentile, realizate în magazin sau atelier.",
    ids: {
      eyeglasses_adjustment: "Reglaj ochelari",
      eyeglasses_repair: "Reparații ochelari",
      lens_fitting: "Montaj lentile",
      frame_repair: "Reparații rame",
      screw_replacement: "Înlocuire șuruburi sau pernițe",
      lens_replacement: "Înlocuire lentile în rama existentă",
      frame_cleaning: "Curățare ochelari",
      workshop_orders: "Comenzi pentru atelier optic",
    },
  },
};

export const SERVICE_GROUP_LAYOUTS = {
  independent_optical_store: {
    primary: ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"],
    secondary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    hidden: ["procedures_surgery"],
  },
  optical_chain: {
    primary: ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"],
    secondary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    hidden: ["procedures_surgery"],
  },
  ophthalmology_clinic: {
    primary: ["ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"],
    secondary: ["optometry", "contact_lenses", "lenses_and_measurements", "optical_retail", "technical_activities"],
    hidden: [],
  },
  ophthalmology_office: {
    primary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    secondary: ["procedures_surgery", "optometry", "contact_lenses", "lenses_and_measurements", "optical_retail"],
    hidden: ["technical_activities"],
  },
  independent_ophthalmologist: {
    primary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    secondary: ["procedures_surgery", "contact_lenses", "optometry"],
    hidden: ["optical_retail", "lenses_and_measurements", "technical_activities"],
  },
  independent_optometrist: {
    primary: ["optometry", "contact_lenses", "lenses_and_measurements", "children_and_prevention"],
    secondary: ["optical_retail", "technical_activities", "investigations", "specialties"],
    hidden: ["ophthalmology_consults", "procedures_surgery"],
  },
  independent_optician: {
    primary: ["optical_retail", "lenses_and_measurements", "technical_activities"],
    secondary: ["contact_lenses", "optometry"],
    hidden: ["ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"],
  },
  optical_laboratory_b2c: {
    primary: ["lenses_and_measurements", "technical_activities"],
    secondary: ["optical_retail"],
    hidden: ["optometry", "contact_lenses", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"],
  },
  optical_laboratory_b2b: {
    primary: ["lenses_and_measurements", "technical_activities"],
    secondary: [],
    hidden: ["optical_retail", "optometry", "contact_lenses", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"],
  },
  future_b2b_distributor: {
    primary: ["optical_retail"],
    secondary: ["lenses_and_measurements"],
    hidden: ["optometry", "contact_lenses", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention", "technical_activities"],
  },
};

export const LEGACY_PROVIDER_TYPE_LAYOUTS = {
  optica_medicala: SERVICE_GROUP_LAYOUTS.independent_optical_store,
  clinica_oftalmologica: SERVICE_GROUP_LAYOUTS.ophthalmology_clinic,
  cabinet_oftalmologic: SERVICE_GROUP_LAYOUTS.ophthalmology_office,
  cabinet_optometric: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  optometrist_independent: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  medic_oftalmolog_independent: SERVICE_GROUP_LAYOUTS.independent_ophthalmologist,
  laborator_optic: SERVICE_GROUP_LAYOUTS.optical_laboratory_b2c,
};

export const LEGACY_SERVICE_ALIASES = {
  control_vedere_adulti: "optometry_consultation",
  control_vedere_copii: "pediatric_refraction",
  consult_oftalmologic: "ophthalmology_consultation",
  lentile_contact: "contact_lenses",
  lentile_progresive: "progressive_lenses",
  reparatii_ochelari: "eyeglasses_repair",
  reglaj_rame: "eyeglasses_adjustment",
  montaj_lentile: "lens_fitting",
  retina: "retina_consultation",
  glaucom: "glaucoma_consultation",
  cataracta: "cataract_consultation",
  chirurgie_refractiva: "refractive_surgery",
  managementul_miopiei: "myopia_management",
  camp_vizual: "visual_field_analyzer",
  tonometrie: "tonometry",
  fund_de_ochi: "fundus_exam",
  topografie_corneana: "corneal_topography",
};

export const AMBIGUOUS_LEGACY_SERVICE_KEYS = [
  "ochi_uscat",
  "eye_exam",
  "children",
  "ophthalmology",
  "dry_eye",
];

const GROUP_POLICY = {
  optical_retail: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [] },
  lenses_and_measurements: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [] },
  optometry: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lenses: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [] },
  ophthalmology_consults: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["ophthalmologist"] },
  investigations: { kind: "investigation", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["ophthalmologist"] },
  specialties: { kind: "specialty", need: "specialized_medical", review: true, specialist: true, equipment: false, infrastructure: false, professionalTypes: ["ophthalmologist"] },
  procedures_surgery: { kind: "procedure", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: true, professionalTypes: ["ophthalmologist"] },
  children_and_prevention: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["optometrist", "ophthalmologist"] },
  technical_activities: { kind: "technical_activity", need: "technical", review: false, specialist: false, equipment: true, infrastructure: false, professionalTypes: ["optician"] },
};

const SERVICE_OVERRIDES = {
  pd_measurement: { kind: "service", need: "technical", review: true, specialist: true, equipment: true, professionalTypes: ["optician", "optometrist"] },
  digital_centering: { kind: "service", need: "technical", review: true, specialist: true, equipment: true, professionalTypes: ["optician", "optometrist"] },
  contact_lens_consultation: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_fitting: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_trial: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_followup: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  cataract_surgery: { kind: "surgery" },
  refractive_surgery: { kind: "surgery" },
  eyelid_surgery: { kind: "surgery" },
};

const REQUIRED_EQUIPMENT = {
  autorefractometry: ["autorefractometer"],
  oct: ["oct"],
  visual_field_analyzer: ["visual_field_analyzer"],
  fundus_camera: ["fundus_camera"],
  pachymeter: ["pachymeter"],
  biometer: ["biometer"],
  corneal_topography: ["corneal_topographer"],
  keratometry: ["keratometer"],
  tonometry: ["tonometer"],
  gonioscopy: ["gonioscope"],
  ultrasound: ["ocular_ultrasound"],
  specular_microscopy: ["specular_microscope"],
  angiography: ["retinal_angiography"],
};

function profilesForGroup(group) {
  const applicable = [];
  const hidden = [];
  for (const profileType of PROFILE_TYPES) {
    const layout = SERVICE_GROUP_LAYOUTS[profileType];
    if ((layout?.hidden || []).includes(group)) hidden.push(profileType);
    else if ([...(layout?.primary || []), ...(layout?.secondary || [])].includes(group)) applicable.push(profileType);
  }
  return { applicable, hidden };
}

function aliasesForKey(key) {
  return Object.entries(LEGACY_SERVICE_ALIASES)
    .filter(([, canonical]) => canonical === key)
    .map(([legacy]) => legacy);
}

function buildRegistry() {
  const registry = {};
  for (const [group, config] of Object.entries(SERVICE_GROUPS)) {
    const base = GROUP_POLICY[group];
    const profileRules = profilesForGroup(group);
    for (const [key, label] of Object.entries(config.ids || {})) {
      const override = SERVICE_OVERRIDES[key] || {};
      const policy = { ...base, ...override };
      const aliases = aliasesForKey(key);
      const publicImmediately = !policy.review && policy.need !== "specialized_medical";
      registry[key] = {
        key,
        label,
        group,
        kind: policy.kind,
        patient_facing: true,
        b2b_only: false,
        service_need_level: policy.need,
        default_confirmation_level: publicImmediately ? "provider_confirmed" : "vezunde_verified",
        requires_review: Boolean(policy.review),
        requires_verified_specialist: Boolean(policy.specialist),
        required_professional_types: [...(policy.professionalTypes || [])],
        requires_equipment: Boolean(policy.equipment),
        required_equipment_types: [...(REQUIRED_EQUIPMENT[key] || [])],
        requires_infrastructure: Boolean(policy.infrastructure),
        public_immediately: publicImmediately,
        matching_allowed_when_provider_confirmed: publicImmediately,
        applicable_profile_types: [...profileRules.applicable],
        hidden_for_profile_types: [...profileRules.hidden],
        aliases: [...aliases],
        legacy_keys: [...aliases],
      };
    }
  }
  return registry;
}

// Intentionally not frozen: adapters may derive local maps without mutating this object.
// Consumers should use returned copies from the helper functions below.
export const CANONICAL_SERVICE_REGISTRY = buildRegistry();
export const CANONICAL_SERVICE_KEYS = Object.keys(CANONICAL_SERVICE_REGISTRY);
export const CANONICAL_SERVICE_KEY_SET = new Set(CANONICAL_SERVICE_KEYS);

export function getCanonicalServiceDefinition(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return null;
  const canonicalKey = CANONICAL_SERVICE_KEY_SET.has(key) ? key : LEGACY_SERVICE_ALIASES[key];
  if (!canonicalKey) return null;
  const definition = CANONICAL_SERVICE_REGISTRY[canonicalKey];
  return definition ? { ...definition, aliases: [...definition.aliases], legacy_keys: [...definition.legacy_keys], required_professional_types: [...definition.required_professional_types], required_equipment_types: [...definition.required_equipment_types], applicable_profile_types: [...definition.applicable_profile_types], hidden_for_profile_types: [...definition.hidden_for_profile_types] } : null;
}

export function normalizeServiceKey(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return { status: "unknown", rawKey: key, canonicalKey: null, definition: null };
  if (CANONICAL_SERVICE_KEY_SET.has(key)) return { status: "canonical", rawKey: key, canonicalKey: key, definition: getCanonicalServiceDefinition(key) };
  if (LEGACY_SERVICE_ALIASES[key]) {
    const canonicalKey = LEGACY_SERVICE_ALIASES[key];
    return { status: "legacy_mapped", rawKey: key, canonicalKey, definition: getCanonicalServiceDefinition(canonicalKey) };
  }
  if (AMBIGUOUS_LEGACY_SERVICE_KEYS.includes(key)) return { status: "legacy_ambiguous", rawKey: key, canonicalKey: null, definition: null };
  return { status: "unknown", rawKey: key, canonicalKey: null, definition: null };
}

export function getCanonicalServiceGroupIds() {
  return Object.fromEntries(Object.entries(SERVICE_GROUPS).map(([group, config]) => [group, Object.keys(config.ids || {})]));
}

export function getServiceGroupLayout(profileType, providerType) {
  const layout = SERVICE_GROUP_LAYOUTS[profileType] || LEGACY_PROVIDER_TYPE_LAYOUTS[providerType];
  const allGroups = Object.keys(SERVICE_GROUPS);
  if (!layout) {
    return {
      primary: ["optical_retail", "optometry", "ophthalmology_consults", "investigations"],
      secondary: allGroups.filter((key) => !["optical_retail", "optometry", "ophthalmology_consults", "investigations"].includes(key)),
      hidden: [],
    };
  }
  const hidden = [...new Set(layout.hidden || [])].filter((key) => SERVICE_GROUPS[key]);
  const primary = [...new Set(layout.primary || [])].filter((key) => SERVICE_GROUPS[key] && !hidden.includes(key));
  const secondary = [...new Set([...(layout.secondary || []), ...allGroups.filter((key) => !primary.includes(key) && !(layout.secondary || []).includes(key) && !hidden.includes(key))])]
    .filter((key) => SERVICE_GROUPS[key] && !primary.includes(key) && !hidden.includes(key));
  return { primary, secondary, hidden };
}

export function classifyServiceNeedLevel(rawKey) {
  return getCanonicalServiceDefinition(rawKey)?.service_need_level || "unknown";
}

export function isServicePubliclyEligible(service, location) {
  if (!service || service.is_active === false || service.active === false) return false;
  if (!location || location.active_status === "inactiva" || location.profile_control_status === "suspended") return false;
  const normalized = normalizeServiceKey(service.service_key || service.key);
  if (!normalized.definition) return false;
  const level = service.confirmation_level || "not_confirmed";
  if (normalized.definition.requires_review || normalized.definition.service_need_level === "specialized_medical") {
    return level === "vezunde_verified" && location.profile_control_status === "verified";
  }
  return normalized.definition.public_immediately && ["publicly_listed", "provider_confirmed", "vezunde_verified"].includes(level);
}

export function isServiceMatchingEligible(service, location) {
  if (!isServicePubliclyEligible(service, location)) return false;
  const normalized = normalizeServiceKey(service.service_key || service.key);
  if (!normalized.definition) return false;
  if (normalized.definition.requires_review || normalized.definition.service_need_level === "specialized_medical") {
    return (service.confirmation_level || "") === "vezunde_verified" && location?.profile_control_status === "verified";
  }
  return normalized.definition.matching_allowed_when_provider_confirmed;
}

export const CLAIM_PREP_SERVICE_GROUPS = ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"];
