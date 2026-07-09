export const CLIENT_NEED_SECTIONS = [
  {
    key: "buy_glasses",
    title: "Cumpără ochelari / lentile",
    publicLabel: "Ochelari și lentile",
    description: "Produse standard pentru o optică. Nu diferențiază singure locația, dar confirmă ce poate cumpăra clientul.",
    note: "De obicei, o optică are rame și lentile. Diferențierea vine din particularitățile de mai jos.",
    items: [
      { group: "optical_retail", id: "eyeglasses" },
      { group: "optical_retail", id: "frames" },
      { group: "optical_retail", id: "prescription_lenses" },
      { group: "optical_retail", id: "sunglasses" },
      { group: "optical_retail", id: "prescription_sunglasses" },
      { group: "optical_retail", id: "accessories" },
    ],
  },
  {
    key: "eye_test",
    title: "Face control vedere / determinare dioptrii",
    publicLabel: "Control vedere",
    description: "Servicii căutate frecvent de clienți înainte de ochelari noi sau schimbarea prescripției.",
    items: [
      { group: "optometry", id: "refraction" },
      { group: "optometry", id: "optometry_consultation" },
      { group: "optometry", id: "visual_acuity_test" },
      { group: "optometry", id: "autorefractometry" },
      { group: "optometry", id: "binocular_vision" },
      { group: "optometry", id: "dry_eye_screening" },
      { group: "optometry", id: "color_vision_test" },
      { group: "optometry", id: "occupational_vision" },
    ],
  },
  {
    key: "repairs_adjustments",
    title: "Repară sau reglează ochelari",
    publicLabel: "Reparații și reglaje",
    description: "Pentru clienți cu rame strâmbe, șuruburi lipsă, lentile de montat sau probleme rapide de atelier.",
    items: [
      { group: "technical_activities", id: "eyeglasses_adjustment" },
      { group: "technical_activities", id: "eyeglasses_repair" },
      { group: "technical_activities", id: "frame_repair" },
      { group: "technical_activities", id: "screw_replacement" },
      { group: "technical_activities", id: "lens_fitting" },
      { group: "technical_activities", id: "lens_replacement" },
      { group: "technical_activities", id: "frame_cleaning" },
      { group: "technical_activities", id: "workshop_orders" },
    ],
  },
  {
    key: "special_lenses",
    title: "Comandă lentile speciale / personalizate",
    publicLabel: "Lentile personalizate",
    description: "Diferențiază opticile care lucrează cu lentile progresive, office, subțiate sau măsurători avansate.",
    items: [
      { group: "lenses_and_measurements", id: "single_vision_lenses" },
      { group: "lenses_and_measurements", id: "progressive_lenses" },
      { group: "lenses_and_measurements", id: "office_lenses" },
      { group: "lenses_and_measurements", id: "reading_lenses" },
      { group: "lenses_and_measurements", id: "thin_lenses" },
      { group: "lenses_and_measurements", id: "photochromic_lenses" },
      { group: "lenses_and_measurements", id: "polarized_lenses" },
      { group: "lenses_and_measurements", id: "blue_light_lenses" },
      { group: "lenses_and_measurements", id: "prism_lenses" },
      { group: "lenses_and_measurements", id: "pd_measurement" },
      { group: "lenses_and_measurements", id: "digital_centering" },
    ],
  },
  {
    key: "contact_lenses_need",
    title: "Primește ajutor pentru lentile de contact",
    publicLabel: "Lentile de contact",
    description: "Pentru consult, adaptare, probă și monitorizarea purtării lentilelor de contact.",
    specialistNote: "Termeni folosiți pentru specialiști: contact lens fitting, trial, follow-up, lentile torice, multifocale, RGP, sclerale.",
    items: [
      { group: "contact_lenses", id: "contact_lenses" },
      { group: "contact_lenses", id: "contact_lens_consultation" },
      { group: "contact_lenses", id: "contact_lens_fitting" },
      { group: "contact_lenses", id: "contact_lens_trial" },
      { group: "contact_lenses", id: "contact_lens_followup" },
      { group: "contact_lenses", id: "toric_contact_lenses" },
      { group: "contact_lenses", id: "multifocal_contact_lenses" },
      { group: "contact_lenses", id: "rgp_lenses" },
      { group: "contact_lenses", id: "scleral_lenses" },
    ],
  },
  {
    key: "children_need",
    title: "Vine cu copilul pentru vedere / ochelari",
    publicLabel: "Servicii pentru copii",
    description: "Pentru părinți care caută rame copii, determinare dioptrii copii, screening sau monitorizare miopie.",
    items: [
      { group: "optical_retail", id: "children_frames" },
      { group: "children_and_prevention", id: "children_eye_exam" },
      { group: "children_and_prevention", id: "pediatric_refraction" },
      { group: "children_and_prevention", id: "amblyopia_screening" },
      { group: "children_and_prevention", id: "strabismus_screening" },
      { group: "children_and_prevention", id: "school_screening" },
      { group: "children_and_prevention", id: "myopia_control_children" },
      { group: "children_and_prevention", id: "vision_therapy" },
    ],
  },
  {
    key: "ophthalmology_consult_need",
    title: "Face consult oftalmologic",
    publicLabel: "Consult oftalmologic",
    description: "Pentru locații cu medic oftalmolog: consultații, prescripție, tensiune oculară, fund de ochi și controale medicale.",
    specialistNote: "Termeni specialiști: comprehensive eye exam, intraocular pressure/tonometry, fundus exam, anterior segment exam, prescription check.",
    items: [
      { group: "ophthalmology_consults", id: "ophthalmology_consultation" },
      { group: "ophthalmology_consults", id: "complete_eye_exam" },
      { group: "ophthalmology_consults", id: "prescription_check" },
      { group: "ophthalmology_consults", id: "eye_pressure_check" },
      { group: "ophthalmology_consults", id: "fundus_exam" },
      { group: "ophthalmology_consults", id: "anterior_segment_exam" },
      { group: "ophthalmology_consults", id: "followup_consultation" },
      { group: "ophthalmology_consults", id: "second_opinion" },
    ],
  },
  {
    key: "investigations_need",
    title: "Face investigații / aparatură",
    publicLabel: "Investigații oftalmologice",
    description: "Pentru clinici sau cabinete cu aparatură: OCT, câmp vizual, topografie, pahimetrie, biometrie și alte investigații.",
    specialistNote: "Termeni specialiști: OCT, visual field, fundus photography, pachymetry, biometry, corneal topography, keratometry, gonioscopy, ocular ultrasound, specular microscopy, angiography.",
    items: [
      { group: "investigations", id: "oct" },
      { group: "investigations", id: "visual_field_analyzer" },
      { group: "investigations", id: "fundus_camera" },
      { group: "investigations", id: "pachymeter" },
      { group: "investigations", id: "biometer" },
      { group: "investigations", id: "corneal_topography" },
      { group: "investigations", id: "keratometry" },
      { group: "investigations", id: "tonometry" },
      { group: "investigations", id: "gonioscopy" },
      { group: "investigations", id: "ultrasound" },
      { group: "investigations", id: "specular_microscopy" },
      { group: "investigations", id: "angiography" },
    ],
  },
  {
    key: "medical_specialties_need",
    title: "Are specializări medicale",
    publicLabel: "Specializări oftalmologice",
    description: "Arii medicale utile pentru recomandare, mai ales când clientul caută o problemă specifică.",
    specialistNote: "Arii: retină, glaucom, cataractă, cornee, strabism, neuro-oftalmologie, uveită, miopie, ochi uscat, retinopatie diabetică, degenerescență maculară, urgențe.",
    items: [
      { group: "specialties", id: "retina_consultation" },
      { group: "specialties", id: "glaucoma_consultation" },
      { group: "specialties", id: "cataract_consultation" },
      { group: "specialties", id: "cornea_consultation" },
      { group: "specialties", id: "pediatric_ophthalmology" },
      { group: "specialties", id: "strabismus" },
      { group: "specialties", id: "neuro_ophthalmology" },
      { group: "specialties", id: "uveitis" },
      { group: "specialties", id: "myopia_management" },
      { group: "specialties", id: "dry_eye_management" },
      { group: "specialties", id: "diabetic_retinopathy" },
      { group: "specialties", id: "macular_degeneration" },
      { group: "specialties", id: "emergency_ophthalmology" },
    ],
  },
  {
    key: "procedures_need",
    title: "Face proceduri / chirurgie",
    publicLabel: "Proceduri oftalmologice",
    description: "Proceduri medicale care trebuie validate atent înainte de publicare și matching.",
    items: [
      { group: "procedures_surgery", id: "cataract_surgery" },
      { group: "procedures_surgery", id: "refractive_surgery" },
      { group: "procedures_surgery", id: "laser_procedures" },
      { group: "procedures_surgery", id: "yag_laser" },
      { group: "procedures_surgery", id: "retinal_laser" },
      { group: "procedures_surgery", id: "intravitreal_injections" },
      { group: "procedures_surgery", id: "eyelid_surgery" },
      { group: "procedures_surgery", id: "chalazion_treatment" },
      { group: "procedures_surgery", id: "minor_eye_procedures" },
    ],
  },
];

export const PRIMARY_CLIENT_NEED_KEYS = [
  "buy_glasses",
  "eye_test",
  "repairs_adjustments",
  "special_lenses",
  "contact_lenses_need",
  "children_need",
];

export const ADVANCED_CLIENT_NEED_KEYS = [
  "ophthalmology_consult_need",
  "investigations_need",
  "medical_specialties_need",
  "procedures_need",
];

export const CLIENT_NEED_BY_KEY = CLIENT_NEED_SECTIONS.reduce((acc, section) => {
  acc[section.key] = section;
  return acc;
}, {});

export const ITEM_TO_PUBLIC_SECTION = CLIENT_NEED_SECTIONS.reduce((acc, section) => {
  for (const item of section.items) {
    const key = `${item.group}:${item.id}`;
    if (!acc[key]) acc[key] = section;
  }
  return acc;
}, {});

export function getSectionSelectedCount(selected = {}, section) {
  return (section?.items || []).reduce((sum, item) => sum + ((selected[item.group] || []).includes(item.id) ? 1 : 0), 0);
}

export function getSelectedNeedSections(selected = {}) {
  return CLIENT_NEED_SECTIONS.filter((section) => getSectionSelectedCount(selected, section) > 0);
}

export function summarizePublicServiceKeys(keys = []) {
  const set = new Set(keys.filter(Boolean));
  const results = [];
  for (const section of CLIENT_NEED_SECTIONS) {
    const matchedIds = section.items.filter((item) => set.has(item.id));
    if (matchedIds.length > 0) {
      results.push({
        key: section.key,
        label: section.publicLabel,
        count: matchedIds.length,
        matchedIds: matchedIds.map((item) => item.id),
      });
    }
  }
  const knownIds = new Set(CLIENT_NEED_SECTIONS.flatMap((section) => section.items.map((item) => item.id)));
  const unknownCount = [...set].filter((id) => !knownIds.has(id)).length;
  if (unknownCount > 0) {
    results.push({ key: "other", label: "Alte servicii", count: unknownCount, matchedIds: [] });
  }
  return results;
}

export function summarizePublicServices(services = []) {
  return summarizePublicServiceKeys(services.map((service) => service?.key || service).filter(Boolean));
}
