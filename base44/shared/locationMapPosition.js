// Shared by the editor and the approval flow. Coordinates alone are not confirmation.
export function locationCoordinates(location = {}) {
  const parse = (value, limit) => {
    if (value == null || String(value).trim() === "") return null;
    const number = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  };
  const lat = parse(location.lat, 90);
  const lng = parse(location.lng, 180);
  return lat === null || lng === null || (lat === 0 && lng === 0) ? null : { lat, lng };
}

export function locationPositionLabel(location = {}) {
  if (!locationCoordinates(location)) return "Poziție necompletată";
  return location.map_precision === "exact" ? "Poziție confirmată" : "Poziție de confirmat";
}

// The confirmation carries the address and both coordinates it refers to.
// Partial/legacy updates remain supported, but cannot silently confirm a point.
export function locationPrecisionError(payload = {}, clean = payload) {
  if (!Object.prototype.hasOwnProperty.call(payload, "map_precision")) return "";
  if (!["exact", "approximate"].includes(payload.map_precision)) return "Precizia poziției este invalidă.";
  if (payload.map_precision === "exact" && (!locationCoordinates(clean) || !String(clean.address || "").trim())) {
    return "Confirmă poziția doar după completarea adresei și a ambelor coordonate valide.";
  }
  return "";
}

const normalizedAddress = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO");

export function locationMapApprovalFields(payload = {}, current = {}) {
  const merged = { ...current, ...payload };
  const before = locationCoordinates(current);
  const after = locationCoordinates(merged);
  const changed = ("address" in payload && normalizedAddress(payload.address) !== normalizedAddress(current.address))
    || (("lat" in payload || "lng" in payload) && (before?.lat !== after?.lat || before?.lng !== after?.lng));
  if (!after || payload.map_precision === "approximate") return { map_precision: "approximate" };
  if (payload.map_precision === "exact") return { map_precision: "exact" };
  return changed ? { map_precision: "approximate" } : {};
}
