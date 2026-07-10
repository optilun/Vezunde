export const PROFESSIONAL_TYPE_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

export const PROFESSIONAL_SPECIALIZATIONS = {
  ophthalmologist: [
    ["general_ophthalmology", "Oftalmologie generală"],
    ["pediatric_ophthalmology", "Oftalmologie pediatrică"],
    ["glaucoma", "Glaucom"],
    ["retina", "Retină"],
    ["cornea", "Cornee"],
    ["cataract", "Cataractă"],
    ["refractive_surgery", "Chirurgie refractivă"],
    ["dry_eye", "Ochi uscat"],
    ["myopia_management", "Managementul miopiei"],
  ],
  optometrist: [
    ["refraction", "Refracție și determinarea dioptriilor"],
    ["contact_lenses", "Lentile de contact"],
    ["pediatric_optometry", "Optometrie pediatrică"],
    ["binocular_vision", "Vedere binoculară"],
    ["myopia_management", "Managementul miopiei"],
    ["low_vision", "Low vision"],
    ["occupational_vision", "Vedere ocupațională"],
  ],
  optician: [
    ["frame_consulting", "Consiliere rame"],
    ["ophthalmic_lenses", "Lentile oftalmice"],
    ["progressive_lenses", "Lentile progresive"],
    ["lens_fitting", "Montaj lentile"],
    ["adjustments_repairs", "Reglaje și reparații"],
    ["children_eyewear", "Ochelari pentru copii"],
    ["protective_eyewear", "Ochelari de protecție"],
  ],
};

export const PROFESSIONAL_REVIEW_STATUS_LABELS = {
  draft: "Draft",
  pending_review: "În verificare",
  approved: "Aprobat",
  rejected: "Respins",
  needs_more_info: "Necesită completări",
};

export function specializationLabel(professionalType, key) {
  return (PROFESSIONAL_SPECIALIZATIONS[professionalType] || []).find(([id]) => id === key)?.[1] || key;
}
