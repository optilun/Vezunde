function hasCoordinates(location = {}) {
  if (location.lat == null || location.lng == null || String(location.lat).trim() === "" || String(location.lng).trim() === "") return false;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function buildAddressQuery(location = {}) {
  if (![location.address, location.city || location.locality_name].some(value => String(value || "").trim())) return "";
  return [
    location.address,
    location.city || location.locality_name,
    location.county || location.county_name,
    "Romania",
  ].filter(Boolean).join(", ");
}

export function buildCoordinateQuery(location = {}) {
  if (!hasCoordinates(location)) return "";
  return `${Number(location.lat)},${Number(location.lng)}`;
}

export function buildLocationQuery(location = {}) {
  const addressQuery = buildAddressQuery(location);
  if (addressQuery) return addressQuery;
  return buildCoordinateQuery(location);
}

export function buildGoogleMapsUrl(location = {}) {
  const query = buildLocationQuery(location);
  if (!query) return "";
  if (location.place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(location.place_id)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsEmbedUrl(location = {}) {
  const query = buildAddressQuery(location) || buildCoordinateQuery(location);
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&output=embed`;
}

export function hasMapLocation(location = {}) {
  return Boolean(buildAddressQuery(location) || buildCoordinateQuery(location) || location.place_id);
}

export function buildGoogleMapsDirectionsUrl(location = {}) {
  const exactPosition = location.map_precision === "exact" && hasCoordinates(location);
  const destination = exactPosition
    ? buildCoordinateQuery(location) : buildAddressQuery(location) || buildCoordinateQuery(location);
  if (!destination) return "";
  // A legacy Place ID must not override a newly confirmed pin.
  const placeId = !exactPosition && location.place_id ? `&destination_place_id=${encodeURIComponent(location.place_id)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${placeId}`;
}
