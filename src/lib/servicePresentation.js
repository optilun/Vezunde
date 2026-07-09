export const CLIENT_NEED_SECTIONS = [
  {
    key: "glasses_lenses",
    title: "Ochelari si lentile",
    publicLabel: "Ochelari si lentile",
    description: "Produse si solutii optice disponibile in locatie.",
    note: "Pentru multe optici, rame si lentile sunt standard. Detaliile ajuta recomandarea sa aleaga mai bine intre locatii.",
    items: [
      { group: "optical_retail", id: "eyeglasses" },
      { group: "optical_retail", id: "frames" },
      { group: "optical_retail", id: "prescription_lenses" },
      { group: "optical_retail", id: "sunglasses" },
      { group: "optical_retail", id: "prescription_sunglasses" },
      { group: "optical_retail", id: "children_frames" },
      { group: "optical_retail", id: "accessories" },
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
    key: "eye_test",
    title: "Control vedere / dioptrii",
    publicLabel: "Control vedere",
    description: "Evaluari optometrice si masuratori pentru recomandarea corectiei vizuale.",
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
    key: "repairs",
    title: "Reglaje si reparatii",
    publicLabel: "Reparatii si reglaje",
    description: "Servicii de atelier pentru rame, lentile si mici interventii rapide la ochelari.",
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
    key: "contact_lenses",
    title: "Lentile de contact",
    publicLabel: "Lentile de contact",
    description: "Consult, adaptare, proba si monitorizare pentru lentile de contact.",
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
    key: "children",
    title: "Copii",
    publicLabel: "Servicii pentru copii",
    description: "Produse, evaluari si monitorizare pentru copii.",
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
    key: "medical",
    title: "Cabinet medical / investigatii",
    publicLabel: "Consultatii si investigatii",
    description: "Pentru locatii cu medic, cabinet, aparatura, specializari sau proceduri oftalmologice.",
    items: [
      { group: "ophthalmology_consults", id: "ophthalmology_consultation" },
      { group: "ophthalmology_consults", id: "complete_eye_exam" },
      { group: "ophthalmology_consults", id: "prescription_check" },
      { group: "ophthalmology_consults", id: "eye_pressure_check" },
      { group: "ophthalmology_consults", id: "fundus_exam" },
      { group: "ophthalmology_consults", id: "anterior_segment_exam" },
      { group: "ophthalmology_consults", id: "followup_consultation" },
      { group: "ophthalmology_consults", id: "second_opinion" },
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

export const PRIMARY_CLIENT_NEED_KEYS = CLIENT_NEED_SECTIONS.map((section) => section.key);
export const ADVANCED_CLIENT_NEED_KEYS = [];

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
      results.push({ key: section.key, label: section.publicLabel, count: matchedIds.length, matchedIds: matchedIds.map((item) => item.id) });
    }
  }
  const knownIds = new Set(CLIENT_NEED_SECTIONS.flatMap((section) => section.items.map((item) => item.id)));
  const unknownCount = [...set].filter((id) => !knownIds.has(id)).length;
  if (unknownCount > 0) results.push({ key: "other", label: "Alte servicii", count: unknownCount, matchedIds: [] });
  return results;
}

export function summarizePublicServices(services = []) {
  return summarizePublicServiceKeys(services.map((service) => service?.key || service).filter(Boolean));
}
