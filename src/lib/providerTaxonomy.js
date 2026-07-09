// Taxonomia pentru fluxul de adaugare / revendicare furnizor (Modul 2).

export const ONBOARDING_PROVIDER_TYPES = {
  optica_medicala: "Optica medicala",
  cabinet_optometric: "Cabinet optometric",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  clinica_oftalmologica: "Clinica oftalmologica",
  optometrist_independent: "Optometrist independent",
  medic_oftalmolog_independent: "Medic oftalmolog independent",
};

export const SPECIALIZATIONS = {
  glaucom: "Glaucom",
  retina: "Retina",
  degenerescenta_maculara: "Degenerescenta maculara",
  retinopatie_diabetica: "Retinopatie diabetica",
  cataracta: "Cataracta",
  chirurgie_refractiva: "Chirurgie refractiva",
  cornee_keratoconus: "Cornee si keratoconus",
  ochi_uscat: "Ochi uscat",
  oftalmopediatrie: "Oftalmopediatrie",
  strabism: "Strabism",
  managementul_miopiei: "Managementul miopiei",
  low_vision: "Low vision",
};

export const INVESTIGATIONS = {
  oct: "OCT",
  camp_vizual: "Camp vizual",
  tonometrie: "Tonometrie",
  fund_de_ochi: "Fund de ochi",
  topografie_corneana: "Topografie corneana",
  pahimetrie: "Pahimetrie",
  biometrie: "Biometrie",
};

export const TEAM_ROLES = {
  medic_oftalmolog: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

// Folosim in continuare valorile tehnice existente in schema Base44
// (availability_status) ca sa nu rupem compatibilitatea. In UI, campul
// reprezinta regula de acces in locatie, nu disponibilitate dinamica pe zile.
export const AVAILABILITY_OPTIONS = {
  astazi: "Primeste clienti fara programare",
  urmatoarele_zile: "Primeste clienti si cu programare",
  saptamana_aceasta: "Walk-in pentru optica, programare pentru consultatii",
  doar_programare: "Doar cu programare",
};

export const VERIFICATION_STATE_LABELS = {
  unclaimed: "Nerevendicat",
  in_verification: "In verificare",
  verified: "Profil verificat",
  suspended: "Suspendat",
};