// Availability is shown ONLY when explicitly published by the provider and not stale.
export const AVAILABILITY_LABELS = {
  astazi: "Fara programare",
  urmatoarele_zile: "Cu sau fara programare",
  saptamana_aceasta: "Optica fara programare; consultatii cu programare",
  doar_programare: "Numai cu programare",
};

const STALE_DAYS = 30;

export function getAvailabilityLabel(location) {
  if (!location?.availability_status || location.availability_status === "necunoscuta") return null;
  if (!location.availability_updated_at) return null;
  const ageDays = (Date.now() - new Date(location.availability_updated_at).getTime()) / 86400000;
  if (ageDays < 0 || ageDays > STALE_DAYS) return null;
  return AVAILABILITY_LABELS[location.availability_status] || null;
}