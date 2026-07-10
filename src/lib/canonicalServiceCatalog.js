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

const ALL_PATIENT_SERVICE_GROUPS = Object.keys(SERVICE_GROUPS);

const SERVICE_GROUP_LAYOUTS = {
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

const LEGACY_PROVIDER_TYPE_LAYOUTS = {
  optica_medicala: SERVICE_GROUP_LAYOUTS.independent_optical_store,
  clinica_oftalmologica: SERVICE_GROUP_LAYOUTS.ophthalmology_clinic,
  cabinet_oftalmologic: SERVICE_GROUP_LAYOUTS.ophthalmology_office,
  cabinet_optometric: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  optometrist_independent: SERVICE_GROUP_LAYOUTS.independent_optometrist,
  medic_oftalmolog_independent: SERVICE_GROUP_LAYOUTS.independent_ophthalmologist,
  laborator_optic: SERVICE_GROUP_LAYOUTS.optical_laboratory_b2c,
};

export function getServiceGroupLayout(profileType, providerType) {
  const layout = SERVICE_GROUP_LAYOUTS[profileType] || LEGACY_PROVIDER_TYPE_LAYOUTS[providerType];
  if (!layout) {
    return {
      primary: ["optical_retail", "optometry", "ophthalmology_consults", "investigations"],
      secondary: ALL_PATIENT_SERVICE_GROUPS.filter((key) => !["optical_retail", "optometry", "ophthalmology_consults", "investigations"].includes(key)),
      hidden: [],
    };
  }

  const hidden = [...new Set(layout.hidden || [])].filter((key) => SERVICE_GROUPS[key]);
  const primary = [...new Set(layout.primary || [])].filter((key) => SERVICE_GROUPS[key] && !hidden.includes(key));
  const secondary = [...new Set([
    ...(layout.secondary || []),
    ...ALL_PATIENT_SERVICE_GROUPS.filter((key) => !primary.includes(key) && !(layout.secondary || []).includes(key) && !hidden.includes(key)),
  ])].filter((key) => SERVICE_GROUPS[key] && !primary.includes(key) && !hidden.includes(key));

  return { primary, secondary, hidden };
}

export const CLAIM_PREP_SERVICE_GROUPS = ["optical_retail", "lenses_and_measurements", "optometry", "contact_lenses", "technical_activities"];
