import { distanceKm } from "./geoDistance.js";

// 2026-09-29 (audit /cauta, D3): distanta vine din shared/geoDistance.js; ramane exportata si de aici.
export { distanceKm };
export function nearestDirectory(points, origin) {
  if (!origin) return points;
  return [...points].sort((a,b) => distanceKm(origin,a)-distanceKm(origin,b) || String(a.id).localeCompare(String(b.id)));
}

// 2026-09-27. Harta Romaniei: de la acest zoom in sus (cam un judet pe ecran), lista urmeaza
// centrul hartii - locatiile din mijlocul zonei privite apar primele, ca pe Airbnb.
export const MAP_CENTER_ORDER_ZOOM = 9;

// Centrul dreptunghiului vizibil ([[sud, vest], [nord, est]]), doar de la MAP_CENTER_ORDER_ZOOM.
export function mapCenterForOrdering(zoom, bounds) {
  if (!(Number(zoom) >= MAP_CENTER_ORDER_ZOOM) || !Array.isArray(bounds) || bounds.length !== 2) return null;
  const [[south, west], [north, east]] = bounds;
  const center = { lat: (Number(south) + Number(north)) / 2, lng: (Number(west) + Number(east)) / 2 };
  return Number.isFinite(center.lat) && Number.isFinite(center.lng) ? center : null;
}

// Ordine dupa distanta fata de un punct; la egalitate ramane ordinea primita (sortare stabila).
// Nu scoate si nu adauga locatii.
export function orderByDistanceFrom(points, center) {
  if (!center) return points;
  return points
    .map((point, index) => ({ point, index, distance: distanceKm(center, point) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((entry) => entry.point);
}
