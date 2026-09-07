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
