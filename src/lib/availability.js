// Availability is shown ONLY when explicitly published by the provider and not stale.
export const AVAILABILITY_LABELS = {
  astazi: "Disponibil astazi",
  urmatoarele_zile: "Disponibil in urmatoarele zile",
  saptamana_aceasta: "Disponibil saptamana aceasta",
  doar_programare: "Doar cu programare",
};

const STALE_DAYS = 30;

export function getAvailabilityLabel(location) {
  if (!location?.availability_status || location.availability_status === "necunoscuta") return null;
  if (!location.availability_updated_at) return null;
  const ageDays = (Date.now() - new Date(location.availability_updated_at).getTime()) / 86400000;
  if (ageDays < 0 || ageDays > STALE_DAYS) return null;
  return AVAILABILITY_LABELS[location.availability_status] || null;
}