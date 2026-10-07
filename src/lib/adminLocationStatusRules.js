// Regulile prin care o locație e marcată „cu neconcordanțe” în panoul de admin (2026-10-07).
//
// Înainte, „publicată, dar nerevendicată/neverificată” era tratată ca problemă (la Integritate chiar
// ca „eroare critică”), deși este starea normală după import: directory + publicată + nerevendicată
// (VIASEE_CODEX_CONTEXT §7.3). Datele reale arătau ~1.200–1.500 de alarme false, iar problemele
// adevărate se pierdeau printre ele.
//
// Regulile de mai jos oglindesc ce consideră contradicție backend-ul (adminDataIntegrityOps /
// modelul canonic), nu ce „arată altfel decât un profil verificat”:
//  - suspendarea setează DOAR profile_control_status (directoryOps.suspend_profile), deci
//    „suspendat + publicată” este normal și NU e marcat;
//  - „verificat, dar nepublicat” e o stare legitimă (ciornă/arhivat) și se vede din etichetă,
//    nu din alarmă.
// Fără React, ca să poată fi verificate din scripts/.

import { publicVisibilityLabel } from "./adminLabels.js";

const text = (value) => String(value ?? "").trim();

export function locationStatusIssues(location) {
  const issues = [];
  if (!location) return issues;
  const control = location.profile_control_status || "directory";

  if (location.claim_verification_status === "approved" && !["claimed", "verified"].includes(control)) {
    issues.push({
      code: "claim_without_control",
      severity: "error",
      category: "Statusuri",
      text: "Revendicarea e aprobată, dar profilul nu apare ca revendicat.",
      detail: `claim_verification_status = approved, dar profile_control_status = ${control}.`,
    });
  }

  if (control === "verified" && (location.verification_state !== "verified" || location.is_verified !== true)) {
    issues.push({
      code: "verification_fields_mismatch",
      severity: "warning",
      category: "Statusuri",
      text: "Verificat, dar câmpurile de verificare nu coincid.",
      detail: `profile_control_status = verified, dar verification_state = ${location.verification_state || "lipsă"} și is_verified = ${location.is_verified === true}.`,
    });
  }

  if (location.status === "publicata" && location.public_visibility_status !== "approved") {
    issues.push({
      code: "published_not_visible",
      severity: "warning",
      category: "Statusuri",
      text: `Publicată, dar vizibilitatea e „${publicVisibilityLabel(location.public_visibility_status).toLowerCase()}”.`,
      detail: `status = publicata, dar public_visibility_status = ${location.public_visibility_status || "lipsă"}.`,
    });
  }

  if (text(location.pending_changes)) {
    issues.push({
      code: "legacy_pending_changes",
      severity: "warning",
      category: "Legacy",
      text: "Are modificări vechi rămase neprocesate (pending_changes).",
      detail: "Modificările noi trebuie să folosească ProviderWorkspaceSubmission.",
    });
  }

  return issues;
}

export const hasStatusIssues = (location) => locationStatusIssues(location).length > 0;
