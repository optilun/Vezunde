export const SERVICE_GROUPS = {
  patient_services: {
    label: "Servicii pentru pacienti",
    ids: { eyeglasses: "Ochelari", frames: "Rame", prescription_lenses: "Lentile pe reteta", contact_lenses: "Lentile de contact", optometry_consultation: "Consult optometric", ophthalmology_consultation: "Consult oftalmologic" },
  },
  investigations: {
    label: "Investigatii",
    ids: { oct: "OCT", visual_field_analyzer: "Camp vizual", fundus_camera: "Fund de ochi", pachymeter: "Pahimetrie", biometer: "Biometrie", corneal_topography: "Topografie corneana" },
  },
  specialties: {
    label: "Arii specializate",
    ids: { retina_consultation: "Consult retina", glaucoma_consultation: "Consult glaucom", cataract_surgery: "Chirurgie cataracta", refractive_surgery: "Chirurgie refractiva", pediatric_ophthalmology: "Oftalmologie pediatrica", myopia_management: "Managementul miopiei", emergency_ophthalmology: "Urgente oftalmologice" },
  },
  technical_activities: {
    label: "Activitati tehnice",
    ids: { eyeglasses_adjustment: "Reglaj ochelari", eyeglasses_repair: "Reparatii ochelari", lens_fitting: "Montaj lentile" },
  },
};

export const CLAIM_PREP_SERVICE_GROUPS = ["patient_services", "technical_activities"];