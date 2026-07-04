// Catalogul canonic de servicii aprobat pentru Modulul 3C (fara chei libere).
export const SERVICE_CATALOG_3C = {
  general: [
    { key: "eyeglasses", label: "Ochelari" },
    { key: "frames", label: "Rame" },
    { key: "prescription_lenses", label: "Lentile cu prescriptie" },
    { key: "contact_lenses", label: "Lentile de contact" },
    { key: "optometry_consultation", label: "Consult optometric" },
    { key: "ophthalmology_consultation", label: "Consult oftalmologic" },
  ],
  technical: [
    { key: "eyeglasses_adjustment", label: "Reglaj ochelari" },
    { key: "eyeglasses_repair", label: "Reparatii ochelari" },
    { key: "lens_fitting", label: "Montaj lentile" },
  ],
  specialized_medical: [
    { key: "oct", label: "OCT" },
    { key: "retina_consultation", label: "Consult retina" },
    { key: "glaucoma_consultation", label: "Consult glaucom" },
    { key: "cataract_surgery", label: "Chirurgie cataracta" },
    { key: "refractive_surgery", label: "Chirurgie refractiva" },
    { key: "pediatric_ophthalmology", label: "Oftalmologie pediatrica" },
    { key: "myopia_management", label: "Managementul miopiei" },
    { key: "emergency_ophthalmology", label: "Urgente oftalmologice" },
  ],
};

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