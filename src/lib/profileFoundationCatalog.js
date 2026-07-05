// MODULE 3H.1A — Provider Profile Foundation: shared frontend catalog.
// Classification only — no matching, ranking or trust logic lives here.

export const PROVIDER_PROFILE_TYPES = [
  { key: "independent_optical_store", label: "Optica independenta", is_b2b: false },
  { key: "optical_chain", label: "Lant de optici", is_b2b: false },
  { key: "ophthalmology_clinic", label: "Clinica oftalmologica", is_b2b: false },
  { key: "ophthalmology_office", label: "Cabinet oftalmologic", is_b2b: false },
  { key: "independent_ophthalmologist", label: "Medic oftalmolog independent", is_b2b: false },
  { key: "independent_optometrist", label: "Optometrist independent", is_b2b: false },
  { key: "independent_optician", label: "Optician independent", is_b2b: false },
  { key: "optical_laboratory_b2c", label: "Laborator optic (B2C)", is_b2b: false },
  { key: "optical_laboratory_b2b", label: "Laborator optic (B2B)", is_b2b: true },
  { key: "future_b2b_distributor", label: "Distribuitor B2B (viitor)", is_b2b: true },
];

// B2B profiles are classified only — they NEVER enter patient search or matching.
export const B2B_PROFILE_TYPES = ["optical_laboratory_b2b", "future_b2b_distributor"];

// Shared cross-role field-state contract.
export const FIELD_STATES = ["draft", "pending_review", "approved", "rejected", "needs_more_info", "archived"];
export const FIELD_STATE_LABELS = {
  draft: "Ciorna",
  pending_review: "In verificare",
  approved: "Aprobat",
  rejected: "Respins",
  needs_more_info: "Necesita clarificari",
  archived: "Arhivat",
};

// Equipment taxonomy — equipment never creates services, specializations or matching.
export const EQUIPMENT_TAXONOMY = [
  {
    group: "optica_optometrie",
    label: "Optica / optometrie",
    keys: ["autorefractometer", "keratometer", "lensmeter", "phoropter", "visual_acuity_chart", "slit_lamp", "tonometer", "corneal_topographer"],
  },
  {
    group: "lentile_contact",
    label: "Lentile de contact",
    keys: ["contact_lens_trial_set", "corneal_topographer", "keratometer", "slit_lamp"],
  },
  {
    group: "diagnostic_oftalmologic",
    label: "Diagnostic oftalmologic",
    keys: ["oct", "visual_field_analyzer", "fundus_camera", "pachymeter", "biometer", "ophthalmic_ultrasound"],
  },
  {
    group: "chirurgie_oftalmologica",
    label: "Chirurgie oftalmologica",
    keys: ["operating_microscope", "phacoemulsification_system", "vitrectomy_system", "yag_laser", "excimer_laser", "femtosecond_laser", "corneal_crosslinking_system"],
  },
  {
    group: "laborator_optic",
    label: "Laborator optic",
    keys: ["tracer", "blocker", "edger", "groover", "drill", "generator", "polisher", "coater", "ultrasonic_cleaner"],
  },
];

export const EQUIPMENT_LABELS = {
  autorefractometer: "Autorefractometru", keratometer: "Keratometru", lensmeter: "Lensmetru",
  phoropter: "Foropter", visual_acuity_chart: "Optotip", slit_lamp: "Biomicroscop (lampa cu fanta)",
  tonometer: "Tonometru", corneal_topographer: "Topograf cornean", contact_lens_trial_set: "Set lentile de proba",
  oct: "OCT", visual_field_analyzer: "Analizor camp vizual", fundus_camera: "Camera fund de ochi",
  pachymeter: "Pahimetru", biometer: "Biometru", ophthalmic_ultrasound: "Ecograf oftalmologic",
  operating_microscope: "Microscop operator", phacoemulsification_system: "Sistem facoemulsificare",
  vitrectomy_system: "Sistem vitrectomie", yag_laser: "Laser YAG", excimer_laser: "Laser excimer",
  femtosecond_laser: "Laser femtosecond", corneal_crosslinking_system: "Sistem crosslinking cornean",
  tracer: "Tracer", blocker: "Blocker", edger: "Masina de taiat lentile (edger)", groover: "Groover",
  drill: "Masina de gaurit", generator: "Generator", polisher: "Masina de polisat",
  coater: "Instalatie de tratamente (coater)", ultrasonic_cleaner: "Curatator cu ultrasunete",
};

export const OFFERING_TYPES = [
  { key: "frames", label: "Rame" },
  { key: "ophthalmic_lenses", label: "Lentile oftalmice" },
  { key: "contact_lenses", label: "Lentile de contact" },
  { key: "sunglasses", label: "Ochelari de soare" },
  { key: "care_products", label: "Produse de ingrijire" },
  { key: "medical_devices", label: "Dispozitive medicale" },
];