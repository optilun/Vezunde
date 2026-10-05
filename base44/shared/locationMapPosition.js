// Shared by the editor and the approval flow. Coordinates alone are not confirmation.
export function locationCoordinates(location = {}) {
  location = location || {};
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


export function locationLocalityFields(geo = {}) {
  return {
    locality_siruta_code: String(geo.siruta_code || "").trim(),
    city: String(geo.name || "").trim(),
    locality_name: String(geo.name || "").trim(),
    county: String(geo.county_name || "").trim(),
    county_name: String(geo.county_name || "").trim(),
    county_code: String(geo.county_code || "").trim(),
    uat_code: String(geo.uat_code || "").trim(),
    uat_name: String(geo.uat_name || "").trim(),
  };
}

export function locationAddressChanged(payload = {}, current = {}) {
  const fields = [["address", "address"], ["city", "locality_name"], ["county", "county_name"], ["locality_siruta_code", "locality_siruta_code"]];
  return fields.some(([key, canonical]) => key in payload
    && normalizedAddress(payload[key]) !== normalizedAddress(current[canonical] || current[key]));
}

// Street/locality edits discard the old pin and Google reference immediately in forms.
export function resetLocationAddressPosition(current = {}, changes = {}) {
  if (!locationAddressChanged(changes, current)) return { ...current, ...changes };
  return { ...current, ...changes, lat: null, lng: null, place_id: "", map_precision: "approximate" };
}

export function locationMapApprovalFields(payload = {}, current = {}) {
  const merged = { ...current, ...payload };
  const before = locationCoordinates(current);
  const after = locationCoordinates(merged);
  const addressChanged = locationAddressChanged(payload, current);
  const pointChanged = ("lat" in payload || "lng" in payload) && (before?.lat !== after?.lat || before?.lng !== after?.lng);
  const reset = addressChanged ? {
    place_id: "", geocode_source: "", geocoded_address: "", geocoded_at: null,
    geocode_attempt_count: 0, geocode_attempt_signature: "", geocode_review_status: "none",
  } : {};
  // A legacy full payload often repeats old coordinates: these are not the new address.
  if (addressChanged && payload.map_precision !== "exact" && !pointChanged) {
    return { ...reset, lat: null, lng: null, map_precision: "approximate" };
  }
  if (!after || payload.map_precision === "approximate") return { ...reset, map_precision: "approximate" };
  if (payload.map_precision === "exact") return { ...reset, map_precision: "exact" };
  return { ...reset, ...(pointChanged ? { map_precision: "approximate" } : {}) };
}
