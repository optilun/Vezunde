export function buildLocationQuery(location = {}) {
  if (location.lat && location.lng) return `${location.lat},${location.lng}`;
  return [
    location.address,
    location.city || location.locality_name,
    location.county || location.county_name,
    "Romania",
  ].filter(Boolean).join(", ");
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
  const query = buildLocationQuery(location);
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

export function hasMapLocation(location = {}) {
  return Boolean((location.lat && location.lng) || location.place_id || location.address);
}
