export function distanceKm(origin, point) {
  const values = [origin?.lat, origin?.lng, point?.lat, point?.lng];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return Infinity;
  if (Math.abs(values[0]) > 90 || Math.abs(values[2]) > 90 || Math.abs(values[1]) > 180 || Math.abs(values[3]) > 180) return Infinity;
  const rad = Math.PI / 180;
  const a = Math.sin((point.lat-origin.lat)*rad/2)**2 + Math.cos(origin.lat*rad)*Math.cos(point.lat*rad)*Math.sin((point.lng-origin.lng)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function nearestDirectory(points, origin) {
  if (!origin) return points;
  return [...points].sort((a,b) => distanceKm(origin,a)-distanceKm(origin,b) || String(a.id).localeCompare(String(b.id)));
}
