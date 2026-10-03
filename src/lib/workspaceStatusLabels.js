export const SUBMISSION_STATUS_LABELS = {
  draft: "Draft salvat",
  pending_review: "Modificări trimise spre aprobare",
  needs_more_info: "Necesită completări",
  approved: "Aprobat",
  rejected: "Respins",
  withdrawn: "Retras",
};

export const CLAIM_STATUS_LABELS = {
  in_asteptare: "În verificare",
  needs_more_info: "Necesită completări",
  aprobata: "Aprobat",
  respinsa: "Respins",
};

export const PROFILE_CONTROL_LABELS = {
  directory: "În director",
  claimed: "Profil revendicat",
  verified: "Verificat",
  suspended: "Suspendat",
};

// 2026-10-03 (structura conturilor, pasul 3): etichetele rolurilor vin din matricea comuna.
export { PROVIDER_ROLE_LABELS as ROLE_LABELS } from "../../shared/providerRolePolicy.js";
