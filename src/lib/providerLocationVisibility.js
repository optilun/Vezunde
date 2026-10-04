// 2026-10-04 (audit cont organizație, #4, #14, #15, #17). Când o locație are pagină publică.
// Aceeași regulă ca la „Salvate” (mySavedItemsOps.isSavableLocation): publicată, aprobată,
// activă și nesuspendată. Pagina publică face oricum verificarea finală.
export function isLocationPubliclyVisible(location) {
  return Boolean(location?.id)
    && location.status === "publicata"
    && location.public_visibility_status === "approved"
    && location.active_status !== "inactiva"
    && location.is_active !== false
    && location.profile_control_status !== "suspended";
}

export function isLocationClosed(location) {
  return location?.active_status === "inactiva";
}
