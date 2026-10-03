// Etichetele listei „Cererile mele” din contul personal (2026-10-03, structura conturilor, pasul 1).
// Fara importuri, ca sa poata fi testat direct in Node.

export const PATIENT_REQUEST_LIFECYCLE_LABELS = Object.freeze({
  active: { label: "Activă", cls: "bg-green-100 text-green-800" },
  resolved: { label: "Rezolvată", cls: "bg-secondary text-foreground" },
  closed: { label: "Închisă", cls: "bg-secondary text-muted-foreground" },
  expired: { label: "Expirată", cls: "bg-secondary text-muted-foreground" },
});

// Starea salvata se actualizeaza abia cand cineva deschide cererea, deci o cerere activa cu
// termenul trecut se arata deja ca expirata.
export function patientRequestLifecycle(request, now = Date.now()) {
  const state = request?.lifecycle_state || "active";
  const expiresAt = Date.parse(String(request?.expires_at || ""));
  if (state === "active" && Number.isFinite(expiresAt) && expiresAt <= now) return PATIENT_REQUEST_LIFECYCLE_LABELS.expired;
  return PATIENT_REQUEST_LIFECYCLE_LABELS[state] || PATIENT_REQUEST_LIFECYCLE_LABELS.active;
}

export function patientRequestResponseLabel(count) {
  const value = Number(count) || 0;
  return value === 1 ? "1 răspuns" : `${value} răspunsuri`;
}
