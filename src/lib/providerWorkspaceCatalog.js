export const PROVIDER_NAV_KEYS = {
  overview: "overview",
  organization: "organization",
  locations: "locations",
  access: "access",
  settings: "settings",
};

export const SPECIALIST_INVITE_ROLES = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician / specialist optica",
  contact_lens_specialist: "Specialist lentile de contact",
  optical_workshop_specialist: "Specialist atelier optic",
  other_relevant_specialist: "Alt specialist relevant",
};

export const REQUEST_INTAKE_STATUS_LABELS = {
  inactive: "Nu primeste cereri prin Vezunde",
  active: "Primeste cereri compatibile",
  paused: "Pauzat temporar",
};

export const AVAILABILITY_OPTIONS = {
  necunoscuta: "Disponibilitate nepublicata",
  astazi: "Disponibil astazi",
  urmatoarele_zile: "Disponibil in urmatoarele zile",
  saptamana_aceasta: "Disponibil saptamana aceasta",
  doar_programare: "Doar cu programare",
};

export const WEEK_DAYS = [
  ["mon", "Luni"],
  ["tue", "Marti"],
  ["wed", "Miercuri"],
  ["thu", "Joi"],
  ["fri", "Vineri"],
  ["sat", "Sambata"],
  ["sun", "Duminica"],
];

export const SERVICE_GROUPS = {
  patient_services: {
    label: "Servicii pentru pacienti",
    items: [
      ["eyeglasses", "Ochelari"],
      ["frames", "Rame"],
      ["prescription_lenses", "Lentile cu prescriptie"],
      ["contact_lenses", "Lentile de contact"],
      ["optometry_consultation", "Consult optometric"],
      ["ophthalmology_consultation", "Consult oftalmologic"],
    ],
  },
  technical_activities: {
    label: "Servicii tehnice optice",
    items: [
      ["eyeglasses_adjustment", "Reglaj ochelari"],
      ["eyeglasses_repair", "Reparatii ochelari"],
      ["lens_fitting", "Montaj lentile"],
    ],
  },
  investigations: {
    label: "Investigatii oftalmologice",
    items: [
      ["oct", "OCT"],
      ["visual_field_analyzer", "Camp vizual"],
      ["fundus_camera", "Fund de ochi / camera fundus"],
      ["pachymeter", "Pahimetrie"],
      ["biometer", "Biometrie"],
      ["corneal_topography", "Topografie corneana"],
    ],
  },
  specialties: {
    label: "Specializari medicale",
    items: [
      ["retina_consultation", "Consult retina"],
      ["glaucoma_consultation", "Consult glaucom"],
      ["cataract_surgery", "Chirurgie cataracta"],
      ["refractive_surgery", "Chirurgie refractiva"],
      ["pediatric_ophthalmology", "Oftalmologie pediatrica"],
      ["myopia_management", "Managementul miopiei"],
      ["emergency_ophthalmology", "Urgente oftalmologice"],
    ],
  },
};

export const B2B_PROFILE_TYPES = ["optical_laboratory_b2b", "future_b2b_distributor"];

export function isB2BProfile(location) {
  return B2B_PROFILE_TYPES.includes(location?.provider_profile_type);
}

export function getOrderedServiceGroups(location) {
  if (isB2BProfile(location)) return [];
  const type = location?.provider_profile_type || location?.provider_type || "";
  const clinicFirst = type.includes("ophthalmology") || type.includes("oftalmologic") || type.includes("medic_oftalmolog");
  const order = clinicFirst
    ? ["patient_services", "investigations", "specialties", "technical_activities"]
    : ["patient_services", "technical_activities", "investigations", "specialties"];
  return order.map((key) => ({ key, ...SERVICE_GROUPS[key] })).filter(Boolean);
}
