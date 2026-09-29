// 2026-09-29 (audit /cauta, D1): o singura lista de denumiri scurte pentru tipul locatiei pe harta.
// O foloseau separat pastila (mapMarkerPresentation), harta vectoriala si harta 2D, cu texte diferite
// pentru acelasi tip ("Cabinet" intr-un loc, "Cabinet oftalmologic" in altul).
export const MAP_TYPE_LABELS = Object.freeze({
  optica_medicala: "Optică",
  cabinet_optometric: "Optometrie",
  cabinet_oftalmologic: "Cabinet oftalmologic",
  clinica_oftalmologica: "Clinică",
  laborator_optic: "Laborator",
});
export function shortTypeLabel(providerType) {
  return MAP_TYPE_LABELS[providerType] || "Locație";
}

// Marker labels distinguish one public profile from a geographic group.
export function mapMarkerLabel(cluster) {
  if (cluster.count > 1) return `${cluster.count} locații`;
  const name = String(cluster.lead?.name || "Locație").replace(/\s+/g, " ").trim();
  return name.length > 27 ? name.slice(0, 26).trimEnd() + "…" : name;
}
export function clusterSharesPosition(cluster) {
  return cluster.count > 1 && cluster.points.every(point =>
    point.lat === cluster.points[0].lat && point.lng === cluster.points[0].lng);
}
