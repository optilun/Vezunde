var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/canonicalServiceRegistry.js
var canonicalServiceRegistry_exports = {};
__export(canonicalServiceRegistry_exports, {
  AMBIGUOUS_LEGACY_SERVICE_KEYS: () => AMBIGUOUS_LEGACY_SERVICE_KEYS,
  CANONICAL_SERVICE_KEYS: () => CANONICAL_SERVICE_KEYS,
  CANONICAL_SERVICE_KEY_SET: () => CANONICAL_SERVICE_KEY_SET,
  CANONICAL_SERVICE_REGISTRY: () => CANONICAL_SERVICE_REGISTRY,
  CLAIM_PREP_SERVICE_GROUPS: () => CLAIM_PREP_SERVICE_GROUPS,
  LEGACY_PROVIDER_TYPE_LAYOUTS: () => LEGACY_PROVIDER_TYPE_LAYOUTS,
  LEGACY_SERVICE_ALIASES: () => LEGACY_SERVICE_ALIASES,
  PROFILE_TYPES: () => PROFILE_TYPES,
  SERVICE_GROUPS: () => SERVICE_GROUPS,
  SERVICE_GROUP_LAYOUTS: () => SERVICE_GROUP_LAYOUTS,
  classifyServiceNeedLevel: () => classifyServiceNeedLevel,
  getCanonicalServiceDefinition: () => getCanonicalServiceDefinition,
  getCanonicalServiceGroupIds: () => getCanonicalServiceGroupIds,
  getServiceGroupLayout: () => getServiceGroupLayout,
  isServiceMatchingEligible: () => isServiceMatchingEligible,
  isServicePubliclyEligible: () => isServicePubliclyEligible,
  normalizeServiceKey: () => normalizeServiceKey
});
var PROFILE_TYPES = [
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
  "optical_laboratory_b2b",
  "future_b2b_distributor"
];
var SERVICE_GROUPS = {
  optical_retail: {
    label: "Produse optice \u0219i solu\u021Bii pentru vedere",
    helper: "Selecteaz\u0103 produsele \u0219i solu\u021Biile optice disponibile pentru clien\u021Bi \xEEn aceast\u0103 loca\u021Bie.",
    ids: {
      eyeglasses: "Ochelari de vedere",
      frames: "Rame de ochelari",
      prescription_lenses: "Lentile pentru ochelari",
      sunglasses: "Ochelari de soare",
      prescription_sunglasses: "Ochelari de soare cu dioptrii",
      children_frames: "Rame pentru copii",
      sports_glasses: "Ochelari sport",
      safety_glasses: "Ochelari de protec\u021Bie",
      accessories: "Accesorii pentru ochelari"
    }
  },
  lenses_and_measurements: {
    label: "Lentile oftalmice \u0219i m\u0103sur\u0103tori",
    helper: "Produse, op\u021Biuni \u0219i m\u0103sur\u0103tori pentru alegerea \u0219i montajul lentilelor.",
    ids: {
      single_vision_lenses: "Lentile monofocale",
      progressive_lenses: "Lentile progresive",
      office_lenses: "Lentile office / intermediare",
      reading_lenses: "Lentile pentru aproape",
      thin_lenses: "Lentile sub\u021Biate",
      photochromic_lenses: "Lentile fotocromatice",
      polarized_lenses: "Lentile polarizate",
      blue_light_lenses: "Protec\u021Bie pentru lumin\u0103 albastr\u0103",
      prism_lenses: "Lentile prismatice",
      pd_measurement: "M\u0103surarea distan\u021Bei pupilare",
      digital_centering: "Centrare digital\u0103 a lentilelor"
    }
  },
  optometry: {
    label: "Optometrie \u0219i evaluarea vederii",
    helper: "Servicii de evaluare optometric\u0103, m\u0103surare a dioptriilor \u0219i recomand\u0103ri pentru corec\u021Bie vizual\u0103.",
    ids: {
      optometry_consultation: "Consult optometric",
      visual_acuity_test: "Test de acuitate vizual\u0103",
      refraction: "Determinarea dioptriilor",
      autorefractometry: "Autorefractometrie",
      binocular_vision: "Evaluarea vederii binoculare",
      dry_eye_screening: "Screening pentru ochi uscat",
      color_vision_test: "Test pentru vederea cromatic\u0103",
      occupational_vision: "Evaluare vizual\u0103 pentru activitatea profesional\u0103"
    }
  },
  contact_lenses: {
    label: "Lentile de contact",
    helper: "Produse \u0219i servicii pentru recomandarea, adaptarea \u0219i monitorizarea purt\u0103rii lentilelor de contact.",
    ids: {
      contact_lenses: "Lentile de contact",
      toric_contact_lenses: "Lentile de contact torice",
      multifocal_contact_lenses: "Lentile de contact multifocale",
      rgp_lenses: "Lentile rigide gaz-permeabile",
      scleral_lenses: "Lentile sclerale",
      contact_lens_solutions: "Solu\u021Bii pentru lentile de contact",
      contact_lens_accessories: "Accesorii pentru lentile de contact",
      contact_lens_consultation: "Consult pentru lentile de contact",
      contact_lens_fitting: "Adaptare lentile de contact",
      contact_lens_trial: "Prob\u0103 lentile de contact",
      contact_lens_followup: "Control pentru lentile de contact",
      contact_lens_insertion_training: "Instruire pentru aplicarea \u0219i \xEEndep\u0103rtarea lentilelor",
      specialty_contact_lens_fitting: "Adaptare lentile de contact speciale",
      orthokeratology: "Ortokeratologie",
      myopia_control_contact_lenses: "Controlul miopiei prin lentile de contact"
    }
  },
  ophthalmology_consults: {
    label: "Consulta\u021Bii oftalmologice",
    helper: "Consulta\u021Bii \u0219i controale medicale efectuate de un medic oftalmolog.",
    ids: {
      ophthalmology_consultation: "Consult oftalmologic",
      complete_eye_exam: "Examinare oftalmologic\u0103 complet\u0103",
      prescription_check: "Verificarea re\u021Betei pentru ochelari",
      eye_pressure_check: "M\u0103surarea tensiunii intraoculare",
      fundus_exam: "Examinarea fundului de ochi",
      anterior_segment_exam: "Examinarea segmentului anterior",
      followup_consultation: "Control oftalmologic",
      second_opinion: "A doua opinie medical\u0103"
    }
  },
  investigations: {
    label: "Investiga\u021Bii oftalmologice",
    helper: "Investiga\u021Bii declarate de furnizor ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    ids: {
      oct: "OCT",
      visual_field_analyzer: "C\xE2mp vizual",
      fundus_camera: "Fotografie de fund de ochi",
      pachymeter: "Pahimetrie",
      biometer: "Biometrie ocular\u0103",
      corneal_topography: "Topografie cornean\u0103",
      keratometry: "Keratometrie",
      tonometry: "Tonometrie",
      gonioscopy: "Gonioscopie",
      ultrasound: "Ecografie ocular\u0103",
      specular_microscopy: "Microscopie specular\u0103",
      angiography: "Angiografie retinian\u0103",
      electroretinography: "Electroretinografie",
      visual_evoked_potentials: "Poten\u021Biale evocate vizuale"
    }
  },
  specialties: {
    label: "Arii medicale specializate",
    helper: "Zone de expertiz\u0103 medical\u0103 disponibile \xEEn aceast\u0103 loca\u021Bie.",
    ids: {
      retina_consultation: "Retin\u0103",
      vitreoretinal_consultation: "Retin\u0103 \u0219i vitros",
      glaucoma_consultation: "Glaucom",
      cataract_consultation: "Cataract\u0103",
      cornea_consultation: "Cornee",
      pediatric_ophthalmology: "Oftalmologie pediatric\u0103",
      strabismus: "Strabism",
      neuro_ophthalmology: "Neuro-oftalmologie",
      uveitis: "Uveit\u0103",
      myopia_management: "Managementul miopiei",
      dry_eye_management: "Managementul ochiului uscat",
      diabetic_retinopathy: "Retinopatie diabetic\u0103",
      macular_degeneration: "Degenerescen\u021B\u0103 macular\u0103",
      oculoplastics_consultation: "Oculoplastic\u0103 \u0219i afec\u021Biuni ale pleoapelor",
      lacrimal_system_consultation: "Afec\u021Biuni ale c\u0103ilor lacrimale",
      emergency_ophthalmology: "Urgen\u021Be oftalmologice",
      ocular_trauma: "Traumatisme oculare",
      low_vision_rehabilitation: "Vedere slab\u0103 \u0219i reabilitare vizual\u0103",
      ocular_oncology: "Oncologie ocular\u0103"
    }
  },
  procedures_surgery: {
    label: "Proceduri \u0219i chirurgie oftalmologic\u0103",
    helper: "Proceduri \u0219i interven\u021Bii declarate de furnizor ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    ids: {
      cataract_surgery: "Chirurgia cataractei",
      refractive_surgery: "Chirurgie refractiv\u0103",
      laser_procedures: "Proceduri laser",
      yag_laser: "Laser YAG",
      retinal_laser: "Laser retinian",
      intravitreal_injections: "Injec\u021Bii intravitreene",
      eyelid_surgery: "Chirurgia pleoapelor",
      chalazion_treatment: "Tratamentul \u0219alazionului",
      minor_eye_procedures: "Proceduri oftalmologice minore",
      vitreoretinal_surgery: "Chirurgie vitreoretinian\u0103",
      corneal_crosslinking: "Cross-linking cornean",
      lacrimal_procedures: "Proceduri ale c\u0103ilor lacrimale",
      oculoplastic_procedures: "Proceduri oculoplastice",
      foreign_body_removal: "\xCEndep\u0103rtarea corpilor str\u0103ini oculari"
    }
  },
  children_and_prevention: {
    label: "Copii \u0219i preven\u021Bie vizual\u0103",
    helper: "Servicii pentru copii, screening, monitorizare \u0219i preven\u021Bie vizual\u0103.",
    ids: {
      children_eye_exam: "Consult pentru copii",
      pediatric_refraction: "Determinarea dioptriilor la copii",
      amblyopia_screening: "Screening pentru ambliopie",
      strabismus_screening: "Screening pentru strabism",
      school_screening: "Screening \u0219colar",
      myopia_control_children: "Controlul miopiei la copii",
      vision_therapy: "Terapie vizual\u0103"
    }
  },
  technical_activities: {
    label: "Atelier optic \u0219i activit\u0103\u021Bi tehnice",
    helper: "Servicii tehnice pentru ochelari \u0219i lentile, realizate \xEEn magazin, atelier sau laborator.",
    ids: {
      eyeglasses_adjustment: "Reglaj ochelari",
      frame_straightening: "\xCEndreptarea ramei",
      temple_adjustment: "Reglarea bra\u021Belor ramei",
      bridge_adjustment: "Reglarea pun\u021Bii ramei",
      hinge_adjustment: "Reglarea balamalelor",
      screw_replacement: "\xCEnlocuire sau str\xE2ngere \u0219uruburi",
      nose_pad_replacement: "\xCEnlocuire perni\u021Be nazale",
      temple_tip_replacement: "\xCEnlocuire terminale bra\u021Be",
      eyeglasses_repair: "Repara\u021Bii ochelari",
      frame_repair: "Repara\u021Bii rame",
      temple_replacement: "\xCEnlocuire bra\u021Be rame",
      hinge_repair: "Reparare balamale",
      acetate_frame_repair: "Repara\u021Bii rame din acetat",
      metal_frame_soldering: "Lipire sau sudare rame metalice",
      frame_polishing: "Lustruire rame",
      lens_fitting: "Montaj lentile",
      lens_replacement: "\xCEnlocuire lentile \xEEn rama existent\u0103",
      client_frame_lens_mounting: "Montaj lentile \xEEn rama clientului",
      rimless_drilling: "G\u0103urire pentru rame f\u0103r\u0103 contur",
      semi_rimless_grooving: "\u0218an\u021Buire pentru rame cu fir",
      optical_quality_check: "Verificarea centr\u0103rii \u0219i control final",
      frame_cleaning: "Cur\u0103\u021Bare ochelari",
      ultrasonic_cleaning: "Cur\u0103\u021Bare cu ultrasunete",
      workshop_orders: "Comenzi pentru atelier optic"
    }
  },
  b2b_capabilities: {
    label: "Produse \u0219i servicii B2B",
    helper: "Ofert\u0103 pentru optici, cabinete, clinici, laboratoare \u0219i al\u021Bi parteneri profesionali.",
    ids: {
      wholesale_frames: "Distribu\u021Bie B2B de rame",
      wholesale_ophthalmic_lenses: "Distribu\u021Bie B2B de lentile oftalmice",
      wholesale_contact_lenses: "Distribu\u021Bie B2B de lentile de contact",
      ophthalmic_equipment_distribution: "Distribu\u021Bie de echipamente pentru optic\u0103 \u0219i oftalmologie",
      consumables_distribution: "Distribu\u021Bie de consumabile \u0219i accesorii profesionale",
      b2b_lens_processing: "Prelucrare lentile pentru parteneri",
      b2b_frame_lens_mounting: "Montaj rame \u0219i lentile pentru parteneri",
      b2b_private_label: "Servicii private label / marc\u0103 proprie",
      b2b_logistics_delivery: "Logistic\u0103 \u0219i livrare B2B",
      b2b_technical_support: "Suport tehnic \u0219i comercial B2B"
    }
  }
};
var ALL_PATIENT_GROUPS = [
  "optical_retail",
  "lenses_and_measurements",
  "optometry",
  "contact_lenses",
  "ophthalmology_consults",
  "investigations",
  "specialties",
  "procedures_surgery",
  "children_and_prevention",
  "technical_activities"
];
var SERVICE_GROUP_LAYOUTS = {
  independent_optical_store: {
    primary: ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"],
    secondary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    hidden: ["procedures_surgery", "b2b_capabilities"]
  },
  optical_chain: {
    primary: ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"],
    secondary: ["ophthalmology_consults", "investigations", "specialties", "children_and_prevention"],
    hidden: ["procedures_surgery", "b2b_capabilities"]
  },
  ophthalmology_clinic: {
    primary: ["ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"],
    secondary: ["optometry", "contact_lenses", "lenses_and_measurements", "optical_retail", "technical_activities"],
    hidden: ["b2b_capabilities"]
  },
  ophthalmology_office: {
    primary: ["ophthalmology_consults", "specialties", "children_and_prevention"],
    secondary: ["investigations", "procedures_surgery", "optometry", "contact_lenses", "lenses_and_measurements", "optical_retail"],
    hidden: ["technical_activities", "b2b_capabilities"]
  },
  independent_ophthalmologist: {
    primary: ["ophthalmology_consults", "specialties", "children_and_prevention"],
    secondary: ["investigations", "procedures_surgery", "contact_lenses", "optometry"],
    hidden: ["optical_retail", "lenses_and_measurements", "technical_activities", "b2b_capabilities"]
  },
  independent_optometrist: {
    primary: ["optometry", "lenses_and_measurements", "children_and_prevention"],
    secondary: ["contact_lenses", "optical_retail", "technical_activities", "investigations", "specialties"],
    hidden: ["ophthalmology_consults", "procedures_surgery", "b2b_capabilities"]
  },
  independent_optician: {
    primary: ["optical_retail", "lenses_and_measurements", "technical_activities"],
    secondary: ["contact_lenses"],
    hidden: ["optometry", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention", "b2b_capabilities"]
  },
  optical_laboratory_b2c: {
    primary: ["lenses_and_measurements", "technical_activities"],
    secondary: ["optical_retail"],
    hidden: ["optometry", "contact_lenses", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention", "b2b_capabilities"]
  },
  optical_laboratory_b2b: {
    primary: ["b2b_capabilities", "lenses_and_measurements", "technical_activities"],
    secondary: [],
    hidden: ["optical_retail", "optometry", "contact_lenses", "ophthalmology_consults", "investigations", "specialties", "procedures_surgery", "children_and_prevention"]
  },
  future_b2b_distributor: {
    primary: ["b2b_capabilities"],
    secondary: [],
    hidden: [...ALL_PATIENT_GROUPS]
  }
};
var LEGACY_PROVIDER_TYPE_LAYOUTS = {
  optica_medicala: SERVICE_GROUP_LAYOUTS.independent_optical_store,
  clinica_oftalmologica: SERVICE_GROUP_LAYOUTS.ophthalmology_clinic,
  cabinet_oftalmologic: SERVICE_GROUP_LAYOUTS.ophthalmology_office,
  cabinet_optometric: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  optometrist_independent: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  medic_oftalmolog_independent: SERVICE_GROUP_LAYOUTS.independent_ophthalmologist,
  laborator_optic: SERVICE_GROUP_LAYOUTS.optical_laboratory_b2c
};
var LEGACY_SERVICE_ALIASES = {
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
  indreptare_rame: "frame_straightening",
  schimb_suruburi: "screw_replacement",
  schimb_pernite: "nose_pad_replacement",
  sudura_rame: "metal_frame_soldering"
};
var AMBIGUOUS_LEGACY_SERVICE_KEYS = [
  "ochi_uscat",
  "eye_exam",
  "children",
  "ophthalmology",
  "dry_eye"
];
var GROUP_POLICY = {
  optical_retail: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [], patientFacing: true, b2bOnly: false },
  lenses_and_measurements: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [], patientFacing: true, b2bOnly: false },
  optometry: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["optometrist", "ophthalmologist"], patientFacing: true, b2bOnly: false },
  contact_lenses: { kind: "product", need: "general", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [], patientFacing: true, b2bOnly: false },
  ophthalmology_consults: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["ophthalmologist"], patientFacing: true, b2bOnly: false },
  investigations: { kind: "investigation", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["ophthalmologist"], patientFacing: true, b2bOnly: false },
  specialties: { kind: "specialty", need: "specialized_medical", review: true, specialist: true, equipment: false, infrastructure: false, professionalTypes: ["ophthalmologist"], patientFacing: true, b2bOnly: false },
  procedures_surgery: { kind: "procedure", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: true, professionalTypes: ["ophthalmologist"], patientFacing: true, b2bOnly: false },
  children_and_prevention: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, infrastructure: false, professionalTypes: ["optometrist", "ophthalmologist"], patientFacing: true, b2bOnly: false },
  technical_activities: { kind: "technical_activity", need: "technical", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: ["optician"], patientFacing: true, b2bOnly: false },
  b2b_capabilities: { kind: "b2b_service", need: "technical", review: false, specialist: false, equipment: false, infrastructure: false, professionalTypes: [], patientFacing: false, b2bOnly: true }
};
var SERVICE_OVERRIDES = {
  pd_measurement: { kind: "service", need: "technical", review: true, specialist: true, equipment: true, professionalTypes: ["optician", "optometrist"] },
  digital_centering: { kind: "service", need: "technical", review: true, specialist: true, equipment: true, professionalTypes: ["optician", "optometrist"] },
  contact_lens_consultation: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_fitting: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_trial: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_followup: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  contact_lens_insertion_training: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: false, professionalTypes: ["optometrist", "ophthalmologist"] },
  specialty_contact_lens_fitting: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  orthokeratology: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  myopia_control_contact_lenses: { kind: "service", need: "specialized_medical", review: true, specialist: true, equipment: true, professionalTypes: ["optometrist", "ophthalmologist"] },
  low_vision_rehabilitation: { professionalTypes: ["optometrist", "ophthalmologist"] },
  cataract_surgery: { kind: "surgery" },
  refractive_surgery: { kind: "surgery" },
  eyelid_surgery: { kind: "surgery" },
  vitreoretinal_surgery: { kind: "surgery" },
  eyeglasses_repair: { equipment: true, infrastructure: true },
  frame_repair: { equipment: true, infrastructure: true },
  hinge_repair: { equipment: true, infrastructure: true },
  acetate_frame_repair: { equipment: true, infrastructure: true },
  metal_frame_soldering: { equipment: true, infrastructure: true },
  frame_polishing: { equipment: true, infrastructure: true },
  lens_fitting: { equipment: true, infrastructure: true },
  lens_replacement: { equipment: true, infrastructure: true },
  client_frame_lens_mounting: { equipment: true, infrastructure: true },
  rimless_drilling: { equipment: true, infrastructure: true },
  semi_rimless_grooving: { equipment: true, infrastructure: true },
  optical_quality_check: { equipment: true, infrastructure: true },
  ultrasonic_cleaning: { equipment: true, infrastructure: true },
  b2b_lens_processing: { equipment: true, infrastructure: true },
  b2b_frame_lens_mounting: { equipment: true, infrastructure: true }
};
var REQUIRED_EQUIPMENT = {
  pd_measurement: ["pupillometer", "digital_centering_system"],
  digital_centering: ["digital_centering_system"],
  autorefractometry: ["autorefractometer"],
  contact_lens_consultation: ["slit_lamp", "contact_lens_trial_set"],
  contact_lens_fitting: ["slit_lamp", "contact_lens_trial_set"],
  contact_lens_trial: ["slit_lamp", "contact_lens_trial_set"],
  contact_lens_followup: ["slit_lamp"],
  specialty_contact_lens_fitting: ["slit_lamp", "contact_lens_trial_set", "corneal_topographer"],
  orthokeratology: ["slit_lamp", "contact_lens_trial_set", "corneal_topographer"],
  myopia_control_contact_lenses: ["slit_lamp", "contact_lens_trial_set"],
  oct: ["oct"],
  visual_field_analyzer: ["visual_field_analyzer"],
  fundus_camera: ["fundus_camera"],
  pachymeter: ["pachymeter"],
  biometer: ["biometer"],
  corneal_topography: ["corneal_topographer"],
  keratometry: ["keratometer"],
  tonometry: ["tonometer"],
  gonioscopy: ["gonioscope"],
  ultrasound: ["ophthalmic_ultrasound"],
  specular_microscopy: ["specular_microscope"],
  angiography: ["retinal_angiography_system"],
  electroretinography: ["electroretinography_system"],
  visual_evoked_potentials: ["visual_electrophysiology_system"],
  cataract_surgery: ["operating_microscope", "phacoemulsification_system"],
  refractive_surgery: ["excimer_laser", "femtosecond_laser"],
  vitreoretinal_surgery: ["operating_microscope", "vitrectomy_system"],
  corneal_crosslinking: ["corneal_crosslinking_system"],
  lacrimal_procedures: ["minor_procedure_set"],
  oculoplastic_procedures: ["minor_procedure_set"],
  foreign_body_removal: ["slit_lamp", "minor_procedure_set"],
  eyeglasses_repair: ["drill", "groover", "polisher"],
  frame_repair: ["drill", "groover", "polisher"],
  hinge_repair: ["drill", "frame_welding_system"],
  acetate_frame_repair: ["frame_heater", "polisher"],
  metal_frame_soldering: ["frame_welding_system"],
  frame_polishing: ["polisher"],
  lens_fitting: ["tracer", "blocker", "edger"],
  lens_replacement: ["tracer", "blocker", "edger"],
  client_frame_lens_mounting: ["tracer", "blocker", "edger"],
  rimless_drilling: ["drill"],
  semi_rimless_grooving: ["groover"],
  optical_quality_check: ["lensmeter"],
  ultrasonic_cleaning: ["ultrasonic_cleaner"],
  b2b_lens_processing: ["tracer", "blocker", "edger"],
  b2b_frame_lens_mounting: ["tracer", "blocker", "edger"]
};
var REQUIRED_INFRASTRUCTURE = {
  cataract_surgery: ["surgical_infrastructure"],
  refractive_surgery: ["surgical_infrastructure"],
  vitreoretinal_surgery: ["surgical_infrastructure"],
  eyelid_surgery: ["surgical_infrastructure"],
  laser_procedures: ["clinical_procedure_infrastructure"],
  yag_laser: ["clinical_procedure_infrastructure"],
  retinal_laser: ["clinical_procedure_infrastructure"],
  intravitreal_injections: ["clinical_procedure_infrastructure"],
  chalazion_treatment: ["clinical_procedure_infrastructure"],
  minor_eye_procedures: ["clinical_procedure_infrastructure"],
  corneal_crosslinking: ["clinical_procedure_infrastructure"],
  lacrimal_procedures: ["clinical_procedure_infrastructure"],
  oculoplastic_procedures: ["clinical_procedure_infrastructure"],
  foreign_body_removal: ["clinical_procedure_infrastructure"],
  eyeglasses_repair: ["optical_workshop_infrastructure"],
  frame_repair: ["optical_workshop_infrastructure"],
  hinge_repair: ["optical_workshop_infrastructure"],
  acetate_frame_repair: ["optical_workshop_infrastructure"],
  metal_frame_soldering: ["optical_workshop_infrastructure"],
  frame_polishing: ["optical_workshop_infrastructure"],
  lens_fitting: ["optical_workshop_infrastructure"],
  lens_replacement: ["optical_workshop_infrastructure"],
  client_frame_lens_mounting: ["optical_workshop_infrastructure"],
  rimless_drilling: ["optical_workshop_infrastructure"],
  semi_rimless_grooving: ["optical_workshop_infrastructure"],
  optical_quality_check: ["optical_workshop_infrastructure"],
  ultrasonic_cleaning: ["optical_workshop_infrastructure"],
  b2b_lens_processing: ["optical_laboratory_infrastructure"],
  b2b_frame_lens_mounting: ["optical_laboratory_infrastructure"]
};
function profilesForGroup(group) {
  const applicable = [];
  const hidden = [];
  for (const profileType of PROFILE_TYPES) {
    const layout = SERVICE_GROUP_LAYOUTS[profileType];
    if ((layout?.hidden || []).includes(group)) hidden.push(profileType);
    else if ([...layout?.primary || [], ...layout?.secondary || []].includes(group)) applicable.push(profileType);
  }
  return { applicable, hidden };
}
function aliasesForKey(key) {
  return Object.entries(LEGACY_SERVICE_ALIASES).filter(([, canonical]) => canonical === key).map(([legacy]) => legacy);
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
      const publicImmediately = policy.patientFacing !== false && policy.b2bOnly !== true;
      registry[key] = {
        key,
        label,
        group,
        kind: policy.kind,
        patient_facing: policy.patientFacing !== false,
        b2b_only: policy.b2bOnly === true,
        service_need_level: policy.need,
        default_confirmation_level: publicImmediately ? "provider_confirmed" : "not_confirmed",
        requires_review: Boolean(policy.review),
        requires_verified_specialist: Boolean(policy.specialist),
        required_professional_types: [...policy.professionalTypes || []],
        requires_equipment: Boolean(policy.equipment),
        required_equipment_types: [...REQUIRED_EQUIPMENT[key] || []],
        requires_infrastructure: Boolean(policy.infrastructure) || Boolean(REQUIRED_INFRASTRUCTURE[key]?.length),
        required_infrastructure_types: [...REQUIRED_INFRASTRUCTURE[key] || []],
        public_immediately: publicImmediately,
        matching_allowed_when_provider_confirmed: publicImmediately,
        applicable_profile_types: [...profileRules.applicable],
        hidden_for_profile_types: [...profileRules.hidden],
        aliases: [...aliases],
        legacy_keys: [...aliases]
      };
    }
  }
  return registry;
}
var CANONICAL_SERVICE_REGISTRY = buildRegistry();
var CANONICAL_SERVICE_KEYS = Object.keys(CANONICAL_SERVICE_REGISTRY);
var CANONICAL_SERVICE_KEY_SET = new Set(CANONICAL_SERVICE_KEYS);
function getCanonicalServiceDefinition(rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return null;
  const canonicalKey = CANONICAL_SERVICE_KEY_SET.has(key) ? key : LEGACY_SERVICE_ALIASES[key];
  if (!canonicalKey) return null;
  const definition = CANONICAL_SERVICE_REGISTRY[canonicalKey];
  return definition ? {
    ...definition,
    aliases: [...definition.aliases],
    legacy_keys: [...definition.legacy_keys],
    required_professional_types: [...definition.required_professional_types],
    required_equipment_types: [...definition.required_equipment_types],
    required_infrastructure_types: [...definition.required_infrastructure_types],
    applicable_profile_types: [...definition.applicable_profile_types],
    hidden_for_profile_types: [...definition.hidden_for_profile_types]
  } : null;
}
function normalizeServiceKey(rawKey) {
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
function getCanonicalServiceGroupIds() {
  return Object.fromEntries(Object.entries(SERVICE_GROUPS).map(([group, config]) => [group, Object.keys(config.ids || {})]));
}
function getServiceGroupLayout(profileType, providerType) {
  const layout = SERVICE_GROUP_LAYOUTS[profileType] || LEGACY_PROVIDER_TYPE_LAYOUTS[providerType];
  const allGroups = Object.keys(SERVICE_GROUPS);
  if (!layout) {
    return {
      primary: ["optical_retail", "optometry", "ophthalmology_consults", "investigations"],
      secondary: allGroups.filter((key) => !["optical_retail", "optometry", "ophthalmology_consults", "investigations"].includes(key)),
      hidden: []
    };
  }
  const hidden = [...new Set(layout.hidden || [])].filter((key) => SERVICE_GROUPS[key]);
  const primary = [...new Set(layout.primary || [])].filter((key) => SERVICE_GROUPS[key] && !hidden.includes(key));
  const secondary = [.../* @__PURE__ */ new Set([...layout.secondary || [], ...allGroups.filter((key) => !primary.includes(key) && !(layout.secondary || []).includes(key) && !hidden.includes(key))])].filter((key) => SERVICE_GROUPS[key] && !primary.includes(key) && !hidden.includes(key));
  return { primary, secondary, hidden };
}
function classifyServiceNeedLevel(rawKey) {
  return getCanonicalServiceDefinition(rawKey)?.service_need_level || "unknown";
}
function isServicePubliclyEligible(service, location) {
  if (!service || service.is_active === false || service.active === false) return false;
  if (["removal_pending", "provider_suspended"].includes(service.provider_visibility_status)) return false;
  if (!location || location.active_status === "inactiva" || location.profile_control_status === "suspended") return false;
  const normalized = normalizeServiceKey(service.service_key || service.key);
  if (!normalized.definition || normalized.definition.patient_facing === false || normalized.definition.b2b_only === true) return false;
  const level = service.confirmation_level || "not_confirmed";
  return normalized.definition.public_immediately && ["publicly_listed", "provider_confirmed", "vezunde_verified"].includes(level);
}
function isServiceMatchingEligible(service, location) {
  if (!isServicePubliclyEligible(service, location)) return false;
  const normalized = normalizeServiceKey(service.service_key || service.key);
  if (!normalized.definition) return false;
  return normalized.definition.matching_allowed_when_provider_confirmed;
}
var CLAIM_PREP_SERVICE_GROUPS = ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"];

// shared/canonicalServiceRegistryExtended.js
var {
  AMBIGUOUS_LEGACY_SERVICE_KEYS: AMBIGUOUS_LEGACY_SERVICE_KEYS2,
  CANONICAL_SERVICE_KEYS: CANONICAL_SERVICE_KEYS2,
  CANONICAL_SERVICE_KEY_SET: CANONICAL_SERVICE_KEY_SET2,
  CANONICAL_SERVICE_REGISTRY: CANONICAL_SERVICE_REGISTRY2,
  CLAIM_PREP_SERVICE_GROUPS: CLAIM_PREP_SERVICE_GROUPS2,
  LEGACY_PROVIDER_TYPE_LAYOUTS: LEGACY_PROVIDER_TYPE_LAYOUTS2,
  LEGACY_SERVICE_ALIASES: LEGACY_SERVICE_ALIASES2,
  PROFILE_TYPES: PROFILE_TYPES2,
  SERVICE_GROUP_LAYOUTS: SERVICE_GROUP_LAYOUTS2,
  SERVICE_GROUPS: SERVICE_GROUPS2
} = canonicalServiceRegistry_exports;
var NEW_KEYS = {
  cas_reimbursed_services: {
    label: "Servicii decontate prin CAS",
    group: "business_attributes",
    kind: "service",
    need: "general",
    review: false,
    specialist: false,
    professionalTypes: []
  },
  onsite_eye_testing_b2b: {
    label: "Consulta\u021Bii/Test\u0103ri la domiciliu sau sediul firmelor (B2B)",
    group: "business_attributes",
    kind: "service",
    need: "specialized_medical",
    review: true,
    specialist: true,
    professionalTypes: ["optometrist", "ophthalmologist"]
  },
  computer_screen_glasses: {
    label: "Ochelari pentru calculator / protec\u021Bie ecrane",
    group: "optical_retail",
    kind: "product",
    need: "general",
    review: false,
    specialist: false,
    professionalTypes: []
  },
  myopia_control_spectacle_lenses: {
    label: "Lentile speciale pentru controlul miopiei (Stellest / MiYOSMART)",
    group: "children_and_prevention",
    kind: "service",
    need: "specialized_medical",
    review: true,
    specialist: true,
    professionalTypes: ["optometrist", "ophthalmologist"],
    equipment: ["autorefractometer"]
  }
};
var SPECIFIC_SEARCH_KEYWORDS = {
  cas_reimbursed_services: ["cas", "cnas", "decontat", "decontare", "bilet de trimitere", "asigurare de sanatate"],
  onsite_eye_testing_b2b: ["testare la sediu", "control vedere la birou", "testare angajati", "consultatie la domiciliu", "control acasa", "screening vedere firma"],
  computer_screen_glasses: ["ochelari calculator", "ochelari pentru ecran", "protectie ecrane", "ochelari lumina albastra", "ochelari birou"],
  myopia_control_spectacle_lenses: ["stellest", "miyosmart", "mi yosmart", "lentile control miopie", "lentile speciale miopie copii"],
  orthokeratology: ["ortokeratologie", "lentile de noapte", "lentile purtate noaptea", "ortho k", "fara ochelari ziua"],
  vision_therapy: ["ortoptica", "exercitii vizuale", "terapie vizuala", "ambliopie exercitii", "strabism exercitii", "ochi lenes terapie"],
  specular_microscopy: ["microscopie speculara", "microscopie endoteliala", "endoteliu cornean", "celule endoteliale"],
  dry_eye_management: ["ochi uscati", "ma ustura ochii", "roseata", "nisip in ochi", "lacrimare", "arsura ochi"],
  dry_eye_screening: ["test ochi uscat", "ma ustura ochii", "nisip in ochi", "ochi rosii"],
  pachymeter: ["pahimetrie", "grosime cornee", "masurare cornee", "ochi uscati", "roseata"],
  optometry_consultation: ["control vedere", "control ochelari", "consult optometrist", "vad in ceata", "mi au crescut dioptriile", "verificare dioptrii"],
  refraction: ["determinare dioptrii", "masurat dioptrii", "mi au crescut dioptriile", "schimbat ochelari"],
  photochromic_lenses: ["lentile fotocromatice", "ochelari heliomati", "lentile heliomate", "lentile care se inchid la soare"],
  prescription_sunglasses: ["ochelari de soare cu dioptrii", "lentile de soare cu dioptrii", "ochelari soare vedere"],
  emergency_ophthalmology: ["urgenta oftalmologica", "mi a intrat ceva in ochi", "durere insuportabila", "durere oculara brusca", "pierdere brusca vedere", "ochi rosu dureros"],
  ocular_trauma: ["traumatism ocular", "lovitura in ochi", "accident ochi"],
  foreign_body_removal: ["corp strain ochi", "mi a intrat ceva in ochi", "aschie in ochi"],
  children_eye_exam: ["control ochelari copii", "control ochi copil", "medici copii", "consult pediatric"],
  pediatric_ophthalmology: ["oftalmolog copii", "medic ochi copii", "control ochi copil"],
  pediatric_refraction: ["dioptrii copii", "ochelari copii", "masurat vedere copil"],
  amblyopia_screening: ["ochi lenes", "ambliopie", "screening ochi lenes"],
  strabismus: ["strabism", "ochi incrucisati", "ochi fugit"],
  myopia_management: ["management miopie", "control miopie", "miopie progresiva", "incetinire miopie"],
  myopia_control_children: ["control miopie copii", "miopie progresiva copil", "incetinire miopie"],
  myopia_control_contact_lenses: ["lentile contact control miopie", "miopie copii lentile contact"],
  blue_light_lenses: ["filtru lumina albastra", "protectie calculator", "protectie ecrane", "blue light"],
  office_lenses: ["lentile office", "lentile birou", "lentile intermediare", "ochelari calculator birou"],
  ophthalmology_consultation: ["oftalmolog", "doctor de ochi", "medic de ochi", "consult ochi"],
  oct: ["oct", "tomografie ochi", "oct retina", "oct macula", "oct nerv optic"],
  visual_field_analyzer: ["camp vizual", "perimetrie", "test camp vizual"],
  fundus_exam: ["fund de ochi", "examinare retina", "control retina"],
  tonometry: ["tonometrie", "tensiune oculara", "presiune intraoculara"],
  eyeglasses_repair: [
    "reparatii ochelari",
    "reparat ochelari",
    "ochelari rupti",
    "ochelarii rupti",
    "rupt ochelari",
    "s-au rupt ochelarii",
    "ochelari stricati"
  ],
  eyeglasses_adjustment: ["reglaj ochelari", "ajustare rame", "ochelari largi"],
  lens_replacement: ["schimb lentile", "inlocuire sticle"],
  metal_frame_soldering: ["sudura rame", "lipire rama metalica"],
  oculoplastics_consultation: ["oculoplastica", "pleoape", "orbita", "orbitei"]
};
var GROUP_SEARCH_HINTS = {
  business_attributes: ["optiuni locatie", "acces servicii"],
  optical_retail: ["optica", "ochelari", "rame"],
  lenses_and_measurements: ["lentile ochelari", "masuratori optice"],
  optometry: ["control vedere", "dioptrii"],
  contact_lenses: ["lentile de contact"],
  ophthalmology_consults: ["consult ochi", "oftalmolog"],
  investigations: ["investigatii ochi", "aparatura oftalmologica"],
  specialties: ["specialist ochi", "afectiuni oculare"],
  procedures_surgery: ["proceduri ochi", "chirurgie ochi"],
  children_and_prevention: ["ochi copii", "vedere copii"],
  technical_activities: ["atelier optic", "reparatii ochelari"],
  b2b_capabilities: ["servicii b2b optica"]
};
function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function aliasesForKey2(key) {
  return Object.entries(LEGACY_SERVICE_ALIASES2).filter(([, canonical]) => canonical === key).map(([legacy]) => legacy);
}
function profileRulesForGroup(group) {
  const applicable = [];
  const hidden = [];
  for (const profileType of PROFILE_TYPES2) {
    const layout = SERVICE_GROUP_LAYOUTS2[profileType];
    if ((layout?.hidden || []).includes(group)) hidden.push(profileType);
    else if ([...layout?.primary || [], ...layout?.secondary || []].includes(group)) applicable.push(profileType);
  }
  return { applicable, hidden };
}
function keywordsForDefinition(definition) {
  const group = SERVICE_GROUPS2[definition.group];
  const aliases = definition.aliases || aliasesForKey2(definition.key);
  return [...new Set([
    definition.label,
    normalizeText(definition.label),
    group?.label,
    ...GROUP_SEARCH_HINTS[definition.group] || [],
    ...aliases,
    ...aliases.map((value) => value.replaceAll("_", " ")),
    ...SPECIFIC_SEARCH_KEYWORDS[definition.key] || []
  ].map((value) => String(value || "").trim()).filter(Boolean))];
}
function addGroupAndKeys() {
  SERVICE_GROUPS2.business_attributes = {
    label: "Op\u021Biuni generale ale loca\u021Biei",
    helper: "Atribute comerciale \u0219i de acces valabile la nivelul \xEEntregii loca\u021Bii.",
    ids: {
      cas_reimbursed_services: NEW_KEYS.cas_reimbursed_services.label,
      onsite_eye_testing_b2b: NEW_KEYS.onsite_eye_testing_b2b.label
    }
  };
  SERVICE_GROUPS2.optical_retail.ids.computer_screen_glasses = NEW_KEYS.computer_screen_glasses.label;
  SERVICE_GROUPS2.children_and_prevention.ids.myopia_control_spectacle_lenses = NEW_KEYS.myopia_control_spectacle_lenses.label;
  SERVICE_GROUPS2.contact_lenses.ids.orthokeratology = "Lentile de noapte / Ortokeratologie";
  SERVICE_GROUPS2.children_and_prevention.ids.vision_therapy = "Ortoptic\u0103 \u0219i exerci\u021Bii vizuale (pentru ambliopie/strabism)";
  SERVICE_GROUPS2.optometry.ids.optometry_consultation = "Consult optometric complet";
  SERVICE_GROUPS2.children_and_prevention.ids.children_eye_exam = "Consult oftalmologic/optometric pediatric";
  for (const [profileType, layout] of Object.entries(SERVICE_GROUP_LAYOUTS2)) {
    if (["optical_laboratory_b2b", "future_b2b_distributor"].includes(profileType)) {
      if (!layout.hidden.includes("business_attributes")) layout.hidden.push("business_attributes");
      continue;
    }
    if (!layout.primary.includes("business_attributes") && !layout.secondary.includes("business_attributes")) {
      layout.secondary.unshift("business_attributes");
    }
  }
  for (const layout of Object.values(LEGACY_PROVIDER_TYPE_LAYOUTS2)) {
    if (!layout.primary.includes("business_attributes") && !layout.secondary.includes("business_attributes") && !layout.hidden.includes("business_attributes")) {
      layout.secondary.unshift("business_attributes");
    }
  }
  if (!CLAIM_PREP_SERVICE_GROUPS2.includes("business_attributes")) CLAIM_PREP_SERVICE_GROUPS2.unshift("business_attributes");
  Object.assign(LEGACY_SERVICE_ALIASES2, {
    microscopie_endoteliala: "specular_microscopy",
    servicii_cas: "cas_reimbursed_services",
    testare_la_sediu: "onsite_eye_testing_b2b",
    ochelari_calculator: "computer_screen_glasses",
    lentile_noapte: "orthokeratology",
    stellest_miyosmart: "myopia_control_spectacle_lenses",
    ortoptica: "vision_therapy"
  });
  for (const [key, config] of Object.entries(NEW_KEYS)) {
    if (CANONICAL_SERVICE_KEY_SET2.has(key)) continue;
    const rules = profileRulesForGroup(config.group);
    const aliases = aliasesForKey2(key);
    const publicImmediately = true;
    CANONICAL_SERVICE_REGISTRY2[key] = {
      key,
      label: config.label,
      group: config.group,
      kind: config.kind,
      patient_facing: true,
      b2b_only: false,
      service_need_level: config.need,
      default_confirmation_level: "provider_confirmed",
      requires_review: Boolean(config.review),
      requires_verified_specialist: Boolean(config.specialist),
      required_professional_types: [...config.professionalTypes || []],
      requires_equipment: Boolean(config.equipment?.length),
      required_equipment_types: [...config.equipment || []],
      requires_infrastructure: false,
      required_infrastructure_types: [],
      public_immediately: publicImmediately,
      matching_allowed_when_provider_confirmed: publicImmediately,
      applicable_profile_types: [...rules.applicable],
      hidden_for_profile_types: [...rules.hidden],
      aliases,
      legacy_keys: [...aliases],
      search_keywords: []
    };
    CANONICAL_SERVICE_KEYS2.push(key);
    CANONICAL_SERVICE_KEY_SET2.add(key);
  }
}
addGroupAndKeys();
for (const definition of Object.values(CANONICAL_SERVICE_REGISTRY2)) {
  definition.label = SERVICE_GROUPS2[definition.group]?.ids?.[definition.key] || definition.label;
  definition.aliases = [.../* @__PURE__ */ new Set([...definition.aliases || [], ...aliasesForKey2(definition.key)])];
  definition.legacy_keys = [...definition.aliases];
  definition.search_keywords = keywordsForDefinition(definition);
}
function getCanonicalServiceDefinition2(rawKey) {
  const definition = getCanonicalServiceDefinition(rawKey);
  return definition ? {
    ...definition,
    search_keywords: [...CANONICAL_SERVICE_REGISTRY2[definition.key]?.search_keywords || []]
  } : null;
}
var isServiceMatchingEligible2 = isServiceMatchingEligible;
var isServicePubliclyEligible2 = isServicePubliclyEligible;
var normalizeServiceKey2 = normalizeServiceKey;

// shared/serviceOperationalTaxonomy.js
var PROVIDER_SERVICE_SECTIONS = [
  {
    key: "optical_products",
    unitKey: "optical_store",
    capabilityKey: null,
    area: "products",
    kind: "product",
    title: "Rame, ochelari \u0219i accesorii",
    publicNeedKey: "glasses_frames",
    publicLabel: "Ochelari \u0219i rame",
    description: "Produsele pe care clien\u021Bii le pot g\u0103si \u0219i cump\u0103ra \xEEn aceast\u0103 loca\u021Bie.",
    searchTerms: ["ochelari", "rame", "rame vedere", "accesorii ochelari"],
    items: [
      ["optical_retail", "eyeglasses"],
      ["optical_retail", "frames"],
      ["optical_retail", "prescription_lenses"],
      ["optical_retail", "children_frames"],
      ["optical_retail", "accessories"]
    ]
  },
  {
    key: "sun_and_protection",
    unitKey: "optical_store",
    capabilityKey: null,
    area: "products",
    kind: "product",
    title: "Ochelari de soare \u0219i protec\u021Bie",
    publicNeedKey: "sun_protection",
    publicLabel: "Ochelari de soare \u0219i protec\u021Bie",
    description: "Produse de soare, sport \u0219i protec\u021Bie, cu sau f\u0103r\u0103 dioptrii.",
    searchTerms: ["ochelari soare", "ochelari protectie", "ochelari sport", "soare cu dioptrii"],
    items: [
      ["optical_retail", "sunglasses"],
      ["optical_retail", "prescription_sunglasses"],
      ["optical_retail", "sports_glasses"],
      ["optical_retail", "safety_glasses"]
    ]
  },
  {
    key: "ophthalmic_lenses",
    unitKey: "optical_cabinet",
    fallbackUnitKeys: ["optical_store", "optical_laboratory"],
    capabilityKey: null,
    area: "products",
    kind: "product_option",
    title: "Lentile oftalmice",
    publicNeedKey: "ophthalmic_lenses",
    publicLabel: "Lentile pentru ochelari",
    description: "Tipurile \u0219i op\u021Biunile de lentile pentru ochelari disponibile \xEEn ofert\u0103.",
    searchTerms: ["lentile ochelari", "lentile progresive", "lentile subtiri", "lentile fotocromatice"],
    items: [
      ["lenses_and_measurements", "single_vision_lenses"],
      ["lenses_and_measurements", "progressive_lenses"],
      ["lenses_and_measurements", "office_lenses"],
      ["lenses_and_measurements", "reading_lenses"],
      ["lenses_and_measurements", "thin_lenses"],
      ["lenses_and_measurements", "photochromic_lenses"],
      ["lenses_and_measurements", "polarized_lenses"],
      ["lenses_and_measurements", "blue_light_lenses"],
      ["lenses_and_measurements", "prism_lenses"]
    ]
  },
  {
    key: "optical_measurements",
    unitKey: "optical_cabinet",
    fallbackUnitKeys: ["optometry_cabinet"],
    capabilityKey: null,
    area: "professional_services",
    kind: "measurement",
    title: "M\u0103sur\u0103tori \u0219i centrare",
    publicNeedKey: "optical_measurements",
    publicLabel: "M\u0103sur\u0103tori \u0219i centrare",
    description: "M\u0103sur\u0103tori realizate pentru alegerea \u0219i montajul corect al lentilelor.",
    searchTerms: ["distanta pupilara", "pd", "centrare lentile", "centrare digitala"],
    items: [
      ["lenses_and_measurements", "pd_measurement"],
      ["lenses_and_measurements", "digital_centering"]
    ]
  },
  {
    key: "optometry",
    unitKey: "optometry_cabinet",
    capabilityKey: null,
    area: "professional_services",
    kind: "professional_service",
    title: "Evaluarea vederii \u0219i dioptriilor",
    publicNeedKey: "eye_exam",
    publicLabel: "Control vedere \u0219i dioptrii",
    description: "Servicii optometrice declarate ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    note: "Speciali\u0219tii \u0219i dot\u0103rile pot fi completate op\u021Bional; nu blocheaz\u0103 selectarea sau publicarea serviciilor.",
    searchTerms: ["control vedere", "verificare vedere", "masurat dioptrii", "test vedere", "control ochi", "optometrist"],
    items: [
      ["optometry", "optometry_consultation"],
      ["optometry", "visual_acuity_test"],
      ["optometry", "refraction"],
      ["optometry", "autorefractometry"],
      ["optometry", "binocular_vision"],
      ["optometry", "dry_eye_screening"],
      ["optometry", "color_vision_test"],
      ["optometry", "occupational_vision"]
    ]
  },
  {
    key: "contact_lens_products",
    unitKey: "optical_store",
    capabilityKey: "contact_lens_sales",
    area: "products",
    kind: "product",
    title: "Produse pentru lentile de contact",
    publicNeedKey: "contact_lens_products",
    publicLabel: "Lentile de contact",
    description: "Lentile \u0219i produse de \xEEntre\u021Binere disponibile pentru cump\u0103rare.",
    searchTerms: ["lentile contact", "solutie lentile", "lentile torice", "lentile multifocale", "lentile rigide"],
    items: [
      ["contact_lenses", "contact_lenses"],
      ["contact_lenses", "toric_contact_lenses"],
      ["contact_lenses", "multifocal_contact_lenses"],
      ["contact_lenses", "rgp_lenses"],
      ["contact_lenses", "scleral_lenses"],
      ["contact_lenses", "contact_lens_solutions"],
      ["contact_lenses", "contact_lens_accessories"]
    ]
  },
  {
    key: "contact_lens_services",
    unitKey: "optometry_cabinet",
    fallbackUnitKeys: ["ophthalmology_office"],
    capabilityKey: "contact_lens_professional_services",
    area: "professional_services",
    kind: "professional_service",
    title: "Adaptare \u0219i monitorizare lentile de contact",
    publicNeedKey: "contact_lens_services",
    publicLabel: "Adaptare lentile de contact",
    description: "Consulta\u021Bie, prob\u0103, instruire, adaptare \u0219i control ulterior, declarate ca fiind disponibile \xEEn loca\u021Bie.",
    note: "V\xE2nzarea lentilelor de contact nu activeaz\u0103 automat serviciile profesionale de adaptare.",
    searchTerms: ["adaptare lentile contact", "proba lentile", "invatat lentile", "lentile speciale", "ortokeratologie"],
    items: [
      ["contact_lenses", "contact_lens_consultation"],
      ["contact_lenses", "contact_lens_fitting"],
      ["contact_lenses", "contact_lens_trial"],
      ["contact_lenses", "contact_lens_followup"],
      ["contact_lenses", "contact_lens_insertion_training"],
      ["contact_lenses", "specialty_contact_lens_fitting"],
      ["contact_lenses", "orthokeratology"],
      ["contact_lenses", "myopia_control_contact_lenses"]
    ]
  },
  {
    key: "workshop_adjustments",
    unitKey: "optical_workshop",
    capabilityKey: null,
    area: "technical_services",
    kind: "technical_service",
    title: "Reglaje, ajust\u0103ri \u0219i \xEEndrept\u0103ri",
    publicNeedKey: "repairs_adjustments",
    publicLabel: "Reglaje \u0219i ajust\u0103ri ochelari",
    description: "Opera\u021Biuni uzuale pentru potrivirea, alinierea \u0219i confortul ochelarilor.",
    searchTerms: ["reglat ochelari", "indreptat rame", "ajustat brate", "strans suruburi", "schimb pernute"],
    items: [
      ["technical_activities", "eyeglasses_adjustment"],
      ["technical_activities", "frame_straightening"],
      ["technical_activities", "temple_adjustment"],
      ["technical_activities", "bridge_adjustment"],
      ["technical_activities", "hinge_adjustment"],
      ["technical_activities", "screw_replacement"],
      ["technical_activities", "nose_pad_replacement"],
      ["technical_activities", "temple_tip_replacement"]
    ]
  },
  {
    key: "workshop_repairs",
    unitKey: "optical_workshop",
    capabilityKey: null,
    area: "technical_services",
    kind: "technical_service",
    title: "Repara\u021Bii rame \u0219i componente",
    publicNeedKey: "repairs_adjustments",
    publicLabel: "Repara\u021Bii ochelari",
    description: "Repara\u021Bii ale ramei, balamalelor \u0219i componentelor, \xEEn limitele dot\u0103rii atelierului.",
    searchTerms: ["reparat ochelari", "lipit ochelari", "sudat rame", "schimb brat", "reparat balama"],
    items: [
      ["technical_activities", "eyeglasses_repair"],
      ["technical_activities", "frame_repair"],
      ["technical_activities", "temple_replacement"],
      ["technical_activities", "hinge_repair"],
      ["technical_activities", "acetate_frame_repair"],
      ["technical_activities", "metal_frame_soldering"],
      ["technical_activities", "frame_polishing"]
    ]
  },
  {
    key: "workshop_lens_services",
    unitKey: "optical_workshop",
    fallbackUnitKeys: ["optical_laboratory"],
    capabilityKey: null,
    area: "technical_services",
    kind: "technical_service",
    title: "Montaj \u0219i \xEEnlocuire lentile",
    publicNeedKey: "lens_mounting",
    publicLabel: "Montaj \u0219i \xEEnlocuire lentile",
    description: "Montaj, \xEEnlocuire, g\u0103urire, \u0219an\u021Buire \u0219i verificarea final\u0103 a lentilelor.",
    searchTerms: ["montaj lentile", "schimb lentile", "lentile in rama clientului", "gaurire rame", "santuire"],
    items: [
      ["technical_activities", "lens_fitting"],
      ["technical_activities", "lens_replacement"],
      ["technical_activities", "client_frame_lens_mounting"],
      ["technical_activities", "rimless_drilling"],
      ["technical_activities", "semi_rimless_grooving"],
      ["technical_activities", "optical_quality_check"],
      ["technical_activities", "workshop_orders"]
    ]
  },
  {
    key: "workshop_maintenance",
    unitKey: "optical_workshop",
    capabilityKey: null,
    area: "technical_services",
    kind: "technical_service",
    title: "Cur\u0103\u021Bare \u0219i \xEEntre\u021Binere",
    publicNeedKey: "repairs_adjustments",
    publicLabel: "\xCEntre\u021Binere ochelari",
    description: "Cur\u0103\u021Bare profesional\u0103 \u0219i \xEEntre\u021Binerea periodic\u0103 a ramei.",
    searchTerms: ["curatare ochelari", "ultrasunete ochelari", "intretinere rame"],
    items: [
      ["technical_activities", "frame_cleaning"],
      ["technical_activities", "ultrasonic_cleaning"]
    ]
  },
  {
    key: "ophthalmology_consults",
    unitKey: "ophthalmology_office",
    capabilityKey: null,
    area: "medical_services",
    kind: "medical_service",
    title: "Consulta\u021Bii \u0219i controale oftalmologice",
    publicNeedKey: "ophthalmology_consults",
    publicLabel: "Consulta\u021Bii oftalmologice",
    description: "Consulta\u021Bii, controale \u0219i examin\u0103ri efectuate de medicul oftalmolog.",
    note: "Serviciile sunt informa\u021Bii declarate de furnizor. Profilurile profesionale \u0219i resursele sunt op\u021Bionale \xEEn aceast\u0103 etap\u0103.",
    searchTerms: ["oftalmolog", "doctor de ochi", "medic de ochi", "consult ochi", "control oftalmologic"],
    items: [
      ["ophthalmology_consults", "ophthalmology_consultation"],
      ["ophthalmology_consults", "complete_eye_exam"],
      ["ophthalmology_consults", "prescription_check"],
      ["ophthalmology_consults", "eye_pressure_check"],
      ["ophthalmology_consults", "fundus_exam"],
      ["ophthalmology_consults", "anterior_segment_exam"],
      ["ophthalmology_consults", "followup_consultation"],
      ["ophthalmology_consults", "second_opinion"]
    ]
  },
  {
    key: "ophthalmology_investigations",
    unitKey: "ophthalmology_diagnostics",
    capabilityKey: null,
    area: "medical_services",
    kind: "investigation",
    title: "Investiga\u021Bii \u0219i imagistic\u0103",
    publicNeedKey: "ophthalmology_investigations",
    publicLabel: "Investiga\u021Bii oftalmologice",
    description: "Investiga\u021Bii declarate de furnizor ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    searchTerms: ["oct ochi", "camp vizual", "fund de ochi", "poza retina", "tensiune oculara", "topografie corneana", "ecografie ochi"],
    items: [
      ["investigations", "oct"],
      ["investigations", "visual_field_analyzer"],
      ["investigations", "fundus_camera"],
      ["investigations", "pachymeter"],
      ["investigations", "biometer"],
      ["investigations", "corneal_topography"],
      ["investigations", "keratometry"],
      ["investigations", "tonometry"],
      ["investigations", "gonioscopy"],
      ["investigations", "ultrasound"],
      ["investigations", "specular_microscopy"],
      ["investigations", "angiography"],
      ["investigations", "electroretinography"],
      ["investigations", "visual_evoked_potentials"]
    ]
  },
  {
    key: "retina_macula",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Retin\u0103, vitros \u0219i macul\u0103",
    publicNeedKey: "retina_macula",
    publicLabel: "Retin\u0103 \u0219i macul\u0103",
    description: "Evaluarea \u0219i monitorizarea afec\u021Biunilor retiniene, vitreene \u0219i maculare.",
    searchTerms: ["retina", "macula", "retinopatie diabetica", "degenerescenta maculara", "vitros"],
    items: [
      ["specialties", "retina_consultation"],
      ["specialties", "vitreoretinal_consultation"],
      ["specialties", "diabetic_retinopathy"],
      ["specialties", "macular_degeneration"]
    ]
  },
  {
    key: "glaucoma",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Glaucom",
    publicNeedKey: "glaucoma",
    publicLabel: "Glaucom",
    description: "Consulta\u021Bie \u0219i monitorizare specializat\u0103 pentru glaucom.",
    searchTerms: ["glaucom", "presiune oculara", "tensiune ochi"],
    items: [["specialties", "glaucoma_consultation"]]
  },
  {
    key: "cataract_refractive",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Cataract\u0103 \u0219i corec\u021Bie refractiv\u0103",
    publicNeedKey: "cataract",
    publicLabel: "Cataract\u0103 \u0219i chirurgie refractiv\u0103",
    description: "Evaluare specializat\u0103 pentru cataract\u0103 \u0219i op\u021Biuni de corec\u021Bie refractiv\u0103.",
    searchTerms: ["cataracta", "operatie cataracta", "laser dioptrii", "chirurgie refractiva"],
    items: [["specialties", "cataract_consultation"]]
  },
  {
    key: "cornea_surface",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Cornee \u0219i suprafa\u021B\u0103 ocular\u0103",
    publicNeedKey: "cornea_dry_eye",
    publicLabel: "Cornee \u0219i ochi uscat",
    description: "Cornee, ochi uscat \u0219i managementul miopiei.",
    searchTerms: ["cornee", "ochi uscat", "usturime ochi", "miopie"],
    items: [
      ["specialties", "cornea_consultation"],
      ["specialties", "dry_eye_management"],
      ["specialties", "myopia_management"]
    ]
  },
  {
    key: "pediatric_strabismus",
    unitKey: "ophthalmology_office",
    fallbackUnitKeys: ["optometry_cabinet"],
    capabilityKey: "pediatric_eye_care",
    area: "medical_specialties",
    kind: "pediatric_service",
    title: "Oftalmologie pediatric\u0103, strabism \u0219i ambliopie",
    publicNeedKey: "pediatric_eye_care",
    publicLabel: "Oftalmologie \u0219i vedere pentru copii",
    description: "Consulta\u021Bii, screening, refrac\u021Bie \u0219i monitorizare pentru copii.",
    searchTerms: ["control ochi copil", "oftalmolog copii", "ochi lenes", "ambliopie", "strabism copil", "miopie copii"],
    items: [
      ["specialties", "pediatric_ophthalmology"],
      ["specialties", "strabismus"],
      ["children_and_prevention", "children_eye_exam"],
      ["children_and_prevention", "pediatric_refraction"],
      ["children_and_prevention", "amblyopia_screening"],
      ["children_and_prevention", "strabismus_screening"],
      ["children_and_prevention", "school_screening"],
      ["children_and_prevention", "myopia_control_children"],
      ["children_and_prevention", "vision_therapy"]
    ]
  },
  {
    key: "neuro_inflammation",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Neuro-oftalmologie \u0219i inflama\u021Bii",
    publicNeedKey: "neuro_inflammation",
    publicLabel: "Neuro-oftalmologie \u0219i uveit\u0103",
    description: "Evaluare pentru afec\u021Biuni neuro-oftalmologice \u0219i inflamatorii.",
    searchTerms: ["neuro oftalmologie", "uveita", "inflamatie oculara", "nerv optic"],
    items: [["specialties", "neuro_ophthalmology"], ["specialties", "uveitis"]]
  },
  {
    key: "oculoplastics_lacrimal",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Oculoplastic\u0103, pleoape \u0219i c\u0103i lacrimale",
    publicNeedKey: "oculoplastics_lacrimal",
    publicLabel: "Pleoape \u0219i c\u0103i lacrimale",
    description: "Evaluarea afec\u021Biunilor pleoapelor, orbitei \u0219i sistemului lacrimal.",
    searchTerms: ["pleoape", "canal lacrimal", "lacrimare", "oculoplastica", "orbij"],
    items: [["specialties", "oculoplastics_consultation"], ["specialties", "lacrimal_system_consultation"]]
  },
  {
    key: "emergency_trauma",
    unitKey: "ophthalmology_office",
    fallbackUnitKeys: ["ophthalmology_procedure_room", "ophthalmology_surgery_unit"],
    capabilityKey: "emergency_ophthalmology",
    area: "medical_specialties",
    kind: "emergency_service",
    title: "Urgen\u021Be \u0219i traumatisme oculare",
    publicNeedKey: "emergency_ophthalmology",
    publicLabel: "Urgen\u021Be oftalmologice",
    description: "Evaluarea urgen\u021Belor \u0219i traumatismelor, conform disponibilit\u0103\u021Bii declarate de loca\u021Bie.",
    searchTerms: ["urgenta ochi", "traumatism ochi", "corp strain ochi", "durere oculara brusca"],
    items: [["specialties", "emergency_ophthalmology"], ["specialties", "ocular_trauma"]]
  },
  {
    key: "low_vision",
    unitKey: "optometry_cabinet",
    fallbackUnitKeys: ["ophthalmology_office"],
    capabilityKey: "low_vision_rehabilitation",
    area: "medical_specialties",
    kind: "rehabilitation_service",
    title: "Vedere slab\u0103 \u0219i reabilitare vizual\u0103",
    publicNeedKey: "low_vision",
    publicLabel: "Vedere slab\u0103 \u0219i reabilitare",
    description: "Evaluare func\u021Bional\u0103 \u0219i recomand\u0103ri pentru persoanele cu vedere slab\u0103.",
    searchTerms: ["vedere slaba", "low vision", "reabilitare vizuala", "ajutoare vedere"],
    items: [["specialties", "low_vision_rehabilitation"]]
  },
  {
    key: "ocular_oncology",
    unitKey: "ophthalmology_office",
    capabilityKey: "ophthalmology_specialties",
    area: "medical_specialties",
    kind: "specialty",
    title: "Oncologie ocular\u0103",
    publicNeedKey: "ocular_oncology",
    publicLabel: "Oncologie ocular\u0103",
    description: "Evaluare specializat\u0103 pentru tumori oculare \u0219i ale anexelor.",
    searchTerms: ["oncologie oculara", "tumora ochi", "tumora pleoapa"],
    items: [["specialties", "ocular_oncology"]]
  },
  {
    key: "procedure_room",
    unitKey: "ophthalmology_procedure_room",
    capabilityKey: null,
    area: "medical_procedures",
    kind: "procedure",
    title: "Proceduri, injec\u021Bii \u0219i laser",
    publicNeedKey: "procedures_treatments",
    publicLabel: "Proceduri \u0219i tratamente oftalmologice",
    description: "Proceduri declarate de furnizor ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    searchTerms: ["laser ochi", "injectie ochi", "yag", "laser retina", "chalazion", "corp strain"],
    items: [
      ["procedures_surgery", "laser_procedures"],
      ["procedures_surgery", "yag_laser"],
      ["procedures_surgery", "retinal_laser"],
      ["procedures_surgery", "intravitreal_injections"],
      ["procedures_surgery", "chalazion_treatment"],
      ["procedures_surgery", "minor_eye_procedures"],
      ["procedures_surgery", "corneal_crosslinking"],
      ["procedures_surgery", "foreign_body_removal"],
      ["procedures_surgery", "lacrimal_procedures"],
      ["procedures_surgery", "oculoplastic_procedures"]
    ]
  },
  {
    key: "surgery",
    unitKey: "ophthalmology_surgery_unit",
    capabilityKey: null,
    area: "medical_procedures",
    kind: "surgery",
    title: "Chirurgie oftalmologic\u0103",
    publicNeedKey: "ophthalmology_surgery",
    publicLabel: "Chirurgie oftalmologic\u0103",
    description: "Interven\u021Bii chirurgicale declarate de furnizor ca fiind disponibile \xEEn aceast\u0103 loca\u021Bie.",
    searchTerms: ["operatie ochi", "chirurgie cataracta", "chirurgie retina", "vitrectomie", "chirurgie pleoape"],
    items: [
      ["procedures_surgery", "cataract_surgery"],
      ["procedures_surgery", "refractive_surgery"],
      ["procedures_surgery", "eyelid_surgery"],
      ["procedures_surgery", "vitreoretinal_surgery"]
    ]
  },
  {
    key: "b2b_products",
    unitKey: "b2b_distribution_center",
    fallbackUnitKeys: ["optical_laboratory"],
    capabilityKey: "b2b_distribution",
    area: "b2b",
    kind: "b2b_product",
    title: "Portofoliu \u0219i distribu\u021Bie B2B",
    publicNeedKey: null,
    publicLabel: "",
    description: "Categorii de produse \u0219i solu\u021Bii furnizate partenerilor profesionali.",
    searchTerms: ["distributie b2b", "rame en gros", "lentile en gros", "furnizor optica"],
    items: [
      ["b2b_capabilities", "wholesale_frames"],
      ["b2b_capabilities", "wholesale_ophthalmic_lenses"],
      ["b2b_capabilities", "wholesale_contact_lenses"],
      ["b2b_capabilities", "ophthalmic_equipment_distribution"],
      ["b2b_capabilities", "consumables_distribution"]
    ]
  },
  {
    key: "b2b_processing",
    unitKey: "optical_laboratory",
    capabilityKey: "b2b_distribution",
    area: "b2b",
    kind: "b2b_service",
    title: "Prelucrare \u0219i montaj pentru parteneri",
    publicNeedKey: null,
    publicLabel: "",
    description: "Capabilit\u0103\u021Bi tehnice oferite opticilor \u0219i altor parteneri profesionali.",
    searchTerms: ["prelucrare lentile b2b", "montaj b2b", "laborator partener"],
    items: [
      ["b2b_capabilities", "b2b_lens_processing"],
      ["b2b_capabilities", "b2b_frame_lens_mounting"],
      ["b2b_capabilities", "b2b_private_label"]
    ]
  },
  {
    key: "b2b_logistics_support",
    unitKey: "b2b_distribution_center",
    fallbackUnitKeys: ["optical_laboratory"],
    capabilityKey: "b2b_logistics",
    area: "b2b",
    kind: "b2b_service",
    title: "Logistic\u0103 \u0219i suport B2B",
    publicNeedKey: null,
    publicLabel: "",
    description: "Livrare, suport tehnic, instruire \u0219i servicii comerciale pentru parteneri.",
    searchTerms: ["livrare b2b", "suport tehnic", "training optica", "logistica"],
    items: [
      ["b2b_capabilities", "b2b_logistics_delivery"],
      ["b2b_capabilities", "b2b_technical_support"]
    ]
  }
].map((section) => ({
  ...section,
  items: section.items.map(([group, id]) => ({ group, id }))
}));
var PUBLIC_NEED_SECTIONS = [
  ["glasses_frames", "Ochelari \u0219i rame"],
  ["ophthalmic_lenses", "Lentile pentru ochelari"],
  ["sun_protection", "Ochelari de soare \u0219i protec\u021Bie"],
  ["contact_lens_products", "Lentile de contact"],
  ["eye_exam", "Control vedere \u0219i dioptrii"],
  ["optical_measurements", "M\u0103sur\u0103tori \u0219i centrare"],
  ["contact_lens_services", "Adaptare lentile de contact"],
  ["repairs_adjustments", "Repara\u021Bii \u0219i ajust\u0103ri ochelari"],
  ["lens_mounting", "Montaj \u0219i \xEEnlocuire lentile"],
  ["ophthalmology_consults", "Consulta\u021Bii oftalmologice"],
  ["ophthalmology_investigations", "Investiga\u021Bii oftalmologice"],
  ["pediatric_eye_care", "Oftalmologie \u0219i vedere pentru copii"],
  ["glaucoma", "Glaucom"],
  ["cataract", "Cataract\u0103 \u0219i chirurgie refractiv\u0103"],
  ["retina_macula", "Retin\u0103 \u0219i macul\u0103"],
  ["cornea_dry_eye", "Cornee \u0219i ochi uscat"],
  ["neuro_inflammation", "Neuro-oftalmologie \u0219i uveit\u0103"],
  ["oculoplastics_lacrimal", "Pleoape \u0219i c\u0103i lacrimale"],
  ["emergency_ophthalmology", "Urgen\u021Be oftalmologice"],
  ["low_vision", "Vedere slab\u0103 \u0219i reabilitare"],
  ["ocular_oncology", "Oncologie ocular\u0103"],
  ["procedures_treatments", "Proceduri \u0219i tratamente"],
  ["ophthalmology_surgery", "Chirurgie oftalmologic\u0103"]
].map(([key, label]) => ({ key, label }));
var SERVICE_OPERATIONAL_CONTEXT = Object.fromEntries(
  PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, {
    serviceKey: item.id,
    group: item.group,
    sectionKey: section.key,
    unitKey: section.unitKey,
    fallbackUnitKeys: [...section.fallbackUnitKeys || []],
    capabilityKey: section.capabilityKey || null,
    publicNeedKey: section.publicNeedKey || null,
    kind: section.kind
  }]))
);
function getServiceOperationalContext(serviceKey) {
  const context = SERVICE_OPERATIONAL_CONTEXT[String(serviceKey || "").trim()];
  return context ? { ...context, fallbackUnitKeys: [...context.fallbackUnitKeys] } : null;
}

// shared/servicePrerequisiteEngine.js
var SERVICE_PREREQUISITE_POLICY = Object.freeze({
  enforce_profile_compatibility: false,
  enforce_functional_unit: false,
  enforce_capability: false,
  enforce_verified_specialist: false,
  enforce_verified_equipment: false,
  enforce_verified_infrastructure: false,
  show_review_status: false
});
var PROFESSIONAL_ALIASES = {
  medic_oftalmolog: "ophthalmologist",
  ophthalmologist: "ophthalmologist",
  optometrist: "optometrist",
  optician: "optician"
};
var EQUIPMENT_ALIASES = {
  ocular_ultrasound: "ophthalmic_ultrasound",
  ultrasound: "ophthalmic_ultrasound",
  corneal_topography: "corneal_topographer",
  visual_field: "visual_field_analyzer",
  retinal_angiography: "retinal_angiography_system"
};
var GROUP_EQUIPMENT_DEFAULTS = {
  optometry: { mode: "any", types: ["visual_acuity_chart", "phoropter", "autorefractometer", "slit_lamp"] },
  ophthalmology_consults: { mode: "any", types: ["slit_lamp", "visual_acuity_chart", "tonometer"] },
  children_and_prevention: { mode: "any", types: ["visual_acuity_chart", "phoropter", "autorefractometer", "slit_lamp"] }
};
var EQUIPMENT_MODE_OVERRIDES = {
  complete_eye_exam: "all",
  contact_lens_fitting: "all",
  specialty_contact_lens_fitting: "all",
  orthokeratology: "all",
  cataract_surgery: "all",
  vitreoretinal_surgery: "all"
};
var PROFESSIONAL_OVERRIDES = {
  children_eye_exam: ["ophthalmologist"],
  pediatric_refraction: ["optometrist", "ophthalmologist"],
  amblyopia_screening: ["ophthalmologist"],
  strabismus_screening: ["ophthalmologist"],
  school_screening: ["optometrist", "ophthalmologist"],
  myopia_control_children: ["optometrist", "ophthalmologist"],
  vision_therapy: ["optometrist", "ophthalmologist"],
  low_vision_rehabilitation: ["optometrist", "ophthalmologist"]
};
var INFRASTRUCTURE_ALIASES = {
  optical_workshop_infrastructure: ["laborator_optic_propriu", "atelier_service_propriu", "reparatii_pe_loc", "montaj_lentile_in_locatie", "optical_workshop"],
  optical_laboratory_infrastructure: ["laborator_optic_propriu", "optical_laboratory"],
  clinical_procedure_infrastructure: ["clinical_procedure_room", "sterile_procedure_room", "day_procedure_unit", "ophthalmology_procedure_room"],
  surgical_infrastructure: ["operating_room", "day_surgery_unit", "surgical_unit", "ophthalmology_surgery_unit"]
};
function clean(value) {
  return String(value || "").trim();
}
function normalizeProfessionalType(value) {
  const raw = clean(value);
  return PROFESSIONAL_ALIASES[raw] || raw;
}
function normalizeEquipmentType(value) {
  const raw = clean(value);
  return EQUIPMENT_ALIASES[raw] || raw;
}
function activeRow(row) {
  return Boolean(row) && row.is_active !== false && row.active !== false && row.active_status !== "inactiv";
}
function profileMap(profiles) {
  if (!profiles) return /* @__PURE__ */ new Map();
  if (!Array.isArray(profiles)) return new Map(Object.entries(profiles));
  return new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
}
function rowUnitKeys(row) {
  const values = [
    ...Array.isArray(row?.functional_unit_keys) ? row.functional_unit_keys : [],
    row?.functional_unit_key,
    row?.unit_key
  ];
  return [...new Set(values.map(clean).filter(Boolean))];
}
function rowMatchesUnit(row, unitKey, enforceUnitScope) {
  if (!unitKey) return true;
  const keys = rowUnitKeys(row);
  if (keys.includes(unitKey)) return true;
  return !enforceUnitScope && keys.length === 0;
}
function activeContextKeys(rows, keyField) {
  return new Set((rows || []).filter(activeRow).map((row) => clean(row?.[keyField] || row?.key)).filter(Boolean));
}
function verifiedProfessionalTypes(assignments, profiles, unitKey, enforceUnitScope) {
  const byId = profileMap(profiles);
  const result = /* @__PURE__ */ new Set();
  const scopedAssignments = [];
  for (const assignment of assignments || []) {
    if (!activeRow(assignment) || !rowMatchesUnit(assignment, unitKey, enforceUnitScope)) continue;
    const profile = byId.get(assignment.professional_id) || assignment.professional_profile || null;
    const verified = assignment.affiliation_status === "vezunde_verified" || assignment.confirmation_level === "vezunde_verified" || profile?.verification_status === "verified" || profile?.confirmation_level === "vezunde_verified" || profile?.verified === true;
    if (!verified) continue;
    const type = normalizeProfessionalType(assignment.professional_type || profile?.professional_type || profile?.role);
    if (type) result.add(type);
    scopedAssignments.push(assignment.id || assignment.professional_id);
  }
  return { types: result, scopedAssignments };
}
function verifiedEquipmentTypes(equipment, medical, unitKey, enforceUnitScope) {
  const result = /* @__PURE__ */ new Set();
  const scopedEquipment = [];
  for (const item of equipment || []) {
    if (!activeRow(item) || !rowMatchesUnit(item, unitKey, enforceUnitScope)) continue;
    const evidenceApproved = item.evidence_status === "approved" || item.verification_status === "verified" || item.verified === true;
    const confirmation = clean(item.confirmation_level);
    const confirmationAccepted = medical ? confirmation === "vezunde_verified" : ["provider_confirmed", "vezunde_verified"].includes(confirmation);
    if (!evidenceApproved || !confirmationAccepted) continue;
    const type = normalizeEquipmentType(item.equipment_category_key || item.equipment_key || item.key);
    if (type) result.add(type);
    scopedEquipment.push(item.id || type);
  }
  return { types: result, scopedEquipment };
}
function activeFacilityTypes(facilities, unitKey, enforceUnitScope) {
  const result = /* @__PURE__ */ new Set();
  const scopedFacilities = [];
  for (const facility of facilities || []) {
    if (!activeRow(facility) || !rowMatchesUnit(facility, unitKey, enforceUnitScope)) continue;
    const type = clean(facility.facility_key || facility.key);
    if (type) result.add(type);
    scopedFacilities.push(facility.id || type);
  }
  return { types: result, scopedFacilities };
}
function infrastructureSatisfied(requirement, facilities, location, unitKeys) {
  if (unitKeys.has(requirement)) return true;
  if (requirement === "clinical_procedure_infrastructure") {
    if (location?.clinical_infrastructure_verified === true || location?.has_procedure_room === true) return true;
  }
  if (requirement === "surgical_infrastructure") {
    if (location?.surgical_infrastructure_verified === true || location?.has_operating_room === true) return true;
  }
  const aliases = INFRASTRUCTURE_ALIASES[requirement] || [];
  return aliases.some((key) => facilities.has(key) || unitKeys.has(key));
}
function resolveUnitKey(serviceKey, context) {
  const explicit = clean(context.serviceUnitKey || context.service_unit_key || context.service_unit_map?.[serviceKey]);
  if (explicit) return explicit;
  return getServiceOperationalContext(serviceKey)?.unitKey || "";
}
function resolveCapabilityKey(serviceKey, context) {
  const explicit = clean(context.capabilityKey || context.capability_key || context.service_capability_map?.[serviceKey]);
  if (explicit) return explicit;
  return getServiceOperationalContext(serviceKey)?.capabilityKey || "";
}
function getServicePrerequisiteDefinition(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  if (!normalized.canonicalKey || !normalized.definition) return null;
  const base = normalized.definition;
  const groupEquipment = GROUP_EQUIPMENT_DEFAULTS[base.group] || null;
  const requiredEquipmentTypes = Array.isArray(base.required_equipment_types) && base.required_equipment_types.length > 0 ? base.required_equipment_types : groupEquipment?.types || [];
  const requiredInfrastructureTypes = Array.isArray(base.required_infrastructure_types) ? base.required_infrastructure_types : [];
  return {
    ...base,
    required_professional_types: [...PROFESSIONAL_OVERRIDES[normalized.canonicalKey] || base.required_professional_types || []],
    required_equipment_types: [...requiredEquipmentTypes],
    equipment_requirement_mode: EQUIPMENT_MODE_OVERRIDES[normalized.canonicalKey] || groupEquipment?.mode || "all",
    required_infrastructure_types: [...requiredInfrastructureTypes]
  };
}
function evaluateServicePrerequisites(rawKey, context = {}) {
  const definition = getServicePrerequisiteDefinition(rawKey);
  if (!definition) {
    return {
      service_key: clean(rawKey),
      canonical_key: null,
      eligible: false,
      status: "unknown_service",
      blockers: [{ code: "unknown_service", message: "Serviciul nu exist\u0103 \xEEn registrul canonic." }],
      definition: null,
      evidence: { verified_professional_types: [], verified_equipment_types: [], active_facility_types: [], service_unit_key: "", capability_key: "" }
    };
  }
  const location = context.location || {};
  const assignments = context.assignments || [];
  const professionals = context.professionals || [];
  const equipment = context.equipment || [];
  const facilities = context.facilities || [];
  const functionalUnits = context.functionalUnits || context.functional_units || [];
  const capabilities = context.capabilities || [];
  const blockers = [];
  const serviceKey = definition.key;
  const serviceContext = getServiceOperationalContext(serviceKey);
  const serviceUnitKey = resolveUnitKey(serviceKey, context);
  const prerequisiteUnitKey = serviceContext?.scope === "location" ? "" : serviceUnitKey;
  const capabilityKey = resolveCapabilityKey(serviceKey, context);
  const hasPersistedUnits = functionalUnits.length > 0;
  const enforceUnitScope = context.enforceUnitScope === true || hasPersistedUnits;
  const activeUnitKeys = activeContextKeys(functionalUnits, "unit_key");
  const activeCapabilityKeys = activeContextKeys(capabilities, "capability_key");
  const profileType = clean(location.provider_profile_type);
  if (SERVICE_PREREQUISITE_POLICY.enforce_profile_compatibility && profileType && definition.hidden_for_profile_types.includes(profileType)) {
    blockers.push({
      code: "incompatible_profile_type",
      message: "Serviciul nu este compatibil cu tipul acestei loca\u021Bii.",
      required: definition.applicable_profile_types,
      actual: profileType
    });
  }
  if (SERVICE_PREREQUISITE_POLICY.enforce_functional_unit && enforceUnitScope && prerequisiteUnitKey && !activeUnitKeys.has(prerequisiteUnitKey)) {
    const fallbackUnits = serviceContext?.fallbackUnitKeys || [];
    const fallbackMatched = fallbackUnits.some((unitKey) => activeUnitKeys.has(unitKey));
    if (!fallbackMatched) {
      blockers.push({
        code: "functional_unit_missing",
        message: "Lipse\u0219te spa\u021Biul sau unitatea func\u021Bional\u0103 \xEEn care poate fi realizat\u0103 aceast\u0103 activitate.",
        required: [serviceUnitKey, ...fallbackUnits],
        actual: [...activeUnitKeys]
      });
    }
  }
  if (SERVICE_PREREQUISITE_POLICY.enforce_capability && enforceUnitScope && capabilityKey && !activeCapabilityKeys.has(capabilityKey)) {
    blockers.push({
      code: "capability_missing",
      message: "Capabilitatea necesar\u0103 nu este declarat\u0103 pentru aceast\u0103 loca\u021Bie.",
      required: [capabilityKey],
      actual: [...activeCapabilityKeys]
    });
  }
  const professionalResult = verifiedProfessionalTypes(assignments, professionals, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_verified_specialist && SERVICE_PREREQUISITE_POLICY.enforce_verified_specialist) {
    const required = definition.required_professional_types || [];
    const matched = required.some((type) => professionalResult.types.has(normalizeProfessionalType(type)));
    if (!matched) {
      blockers.push({
        code: "verified_specialist_missing",
        message: enforceUnitScope ? "Este necesar un specialist verificat \u0219i asociat acestei unit\u0103\u021Bi." : "Este necesar un specialist verificat \u0219i asociat activ loca\u021Biei.",
        required,
        actual: [...professionalResult.types]
      });
    }
  }
  const medical = definition.requires_review || definition.service_need_level === "specialized_medical";
  const equipmentResult = verifiedEquipmentTypes(equipment, medical, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_equipment && SERVICE_PREREQUISITE_POLICY.enforce_verified_equipment) {
    const required = definition.required_equipment_types || [];
    if (required.length === 0) {
      blockers.push({
        code: "equipment_requirement_not_configured",
        message: "Cerin\u021Bele de echipament pentru acest serviciu trebuie configurate \xEEn registru.",
        required: [],
        actual: [...equipmentResult.types]
      });
    } else {
      const checks = required.map((type) => equipmentResult.types.has(normalizeEquipmentType(type)));
      const matched = definition.equipment_requirement_mode === "any" ? checks.some(Boolean) : checks.every(Boolean);
      if (!matched) {
        blockers.push({
          code: "verified_equipment_missing",
          message: enforceUnitScope ? "Lipse\u0219te echipamentul verificat \u0219i asociat unit\u0103\u021Bii \xEEn care este realizat serviciul." : "Lipse\u0219te echipamentul verificat necesar acestui serviciu.",
          mode: definition.equipment_requirement_mode,
          required,
          actual: [...equipmentResult.types]
        });
      }
    }
  }
  const facilityResult = activeFacilityTypes(facilities, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_infrastructure && SERVICE_PREREQUISITE_POLICY.enforce_verified_infrastructure) {
    const required = definition.required_infrastructure_types || [];
    const matched = required.length > 0 && required.every((requirement) => infrastructureSatisfied(requirement, facilityResult.types, location, activeUnitKeys));
    if (!matched) {
      blockers.push({
        code: "verified_infrastructure_missing",
        message: "Lipse\u0219te dovada infrastructurii necesare acestui serviciu.",
        required,
        actual: [...facilityResult.types]
      });
    }
  }
  let status = "available";
  if (blockers.some((blocker) => blocker.code === "incompatible_profile_type")) status = "incompatible_profile";
  else if (blockers.some((blocker) => blocker.code === "functional_unit_missing")) status = "requires_functional_unit";
  else if (blockers.some((blocker) => blocker.code === "capability_missing")) status = "requires_capability";
  else if (blockers.some((blocker) => blocker.code === "verified_specialist_missing")) status = "requires_verified_specialist";
  else if (blockers.some((blocker) => blocker.code.includes("equipment"))) status = "requires_equipment";
  else if (blockers.some((blocker) => blocker.code.includes("infrastructure"))) status = "requires_infrastructure";
  else if (definition.requires_review && SERVICE_PREREQUISITE_POLICY.show_review_status) status = "ready_for_review";
  return {
    service_key: definition.key,
    canonical_key: definition.key,
    eligible: blockers.length === 0,
    status,
    blockers,
    definition,
    evidence: {
      verified_professional_types: [...professionalResult.types],
      profile_compatibility_enforced: SERVICE_PREREQUISITE_POLICY.enforce_profile_compatibility,
      functional_unit_enforced: SERVICE_PREREQUISITE_POLICY.enforce_functional_unit,
      capability_enforced: SERVICE_PREREQUISITE_POLICY.enforce_capability,
      verified_specialist_enforced: SERVICE_PREREQUISITE_POLICY.enforce_verified_specialist,
      verified_equipment_types: [...equipmentResult.types],
      verified_equipment_enforced: SERVICE_PREREQUISITE_POLICY.enforce_verified_equipment,
      active_facility_types: [...facilityResult.types],
      verified_infrastructure_enforced: SERVICE_PREREQUISITE_POLICY.enforce_verified_infrastructure,
      active_functional_unit_keys: [...activeUnitKeys],
      active_capability_keys: [...activeCapabilityKeys],
      service_unit_key: serviceUnitKey,
      prerequisite_unit_key: prerequisiteUnitKey,
      validation_scope: serviceContext?.scope || "unit",
      capability_key: capabilityKey,
      unit_scope_enforced: enforceUnitScope && SERVICE_PREREQUISITE_POLICY.enforce_functional_unit,
      scoped_assignment_ids: professionalResult.scopedAssignments,
      scoped_equipment_ids: equipmentResult.scopedEquipment,
      scoped_facility_ids: facilityResult.scopedFacilities
    }
  };
}
export {
  evaluateServicePrerequisites,
  getCanonicalServiceDefinition2 as getCanonicalServiceDefinition,
  isServiceMatchingEligible2 as isServiceMatchingEligible,
  isServicePubliclyEligible2 as isServicePubliclyEligible,
  normalizeServiceKey2 as normalizeServiceKey
};
