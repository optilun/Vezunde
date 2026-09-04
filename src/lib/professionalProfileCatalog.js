// Catalogul de specialisti pentru interfata.
//
// 2026-09-03. Fisierul asta era a cincea copie a aceleiasi taxonomii (langa cele din
// getPublicProfessionalProfile, manageMyProfessionalProfile, adminProfessionalProfileReview si
// professionalInvitationOps). Acum este doar un adaptor peste shared/professionalIdentity.js:
// numele exportate raman identice, ca cele cinci componente care il folosesc sa nu se atinga,
// dar adevarul este unul singur. O profesie noua se adauga in shared, si apare peste tot.
import {
  PROFESSIONAL_SPECIALIZATION_LABELS,
  PROFESSIONAL_TYPES,
  professionalSpecializationLabel,
  professionalSpecializationsFor,
  professionalTypeLabel,
} from "../../shared/professionalIdentity.js";

export {
  PROFESSIONAL_TYPES as PROFESSIONAL_TYPE_ENTRIES,
  PROFESSIONAL_SPECIALIZATION_LABELS,
  professionalTypeLabel,
};

export const PROFESSIONAL_TYPE_LABELS = Object.freeze(
  Object.fromEntries(PROFESSIONAL_TYPES.map((entry) => [entry.code, entry.label])),
);

// Forma [cheie, eticheta] este pastrata pentru ca editorul de profil si checklist-ul o folosesc
// ca sa randeze selectorul de specializari.
export const PROFESSIONAL_SPECIALIZATIONS = Object.freeze(
  Object.fromEntries(PROFESSIONAL_TYPES.map((entry) => [
    entry.code,
    entry.specializations.map((key) => [key, professionalSpecializationLabel(key)]),
  ])),
);

export const PROFESSIONAL_REVIEW_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  pending_review: "În verificare",
  approved: "Aprobat",
  rejected: "Respins",
  needs_more_info: "Necesită completări",
});

export function specializationLabel(professionalType, key) {
  // Vocabularul ramane filtrat pe tip: o cheie care nu apartine profesiei nu primeste eticheta
  // ei prietenoasa, ca sa nu se strecoare vizual o competenta pe care profilul nu o poate avea.
  const allowed = professionalSpecializationsFor(professionalType);
  if (allowed.length > 0 && !allowed.includes(key)) return key;
  return professionalSpecializationLabel(key);
}
