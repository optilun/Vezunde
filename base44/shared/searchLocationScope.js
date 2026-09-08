// Optional narrowing from the public directory filter response. It cannot expand public scope.
// An empty array deliberately means no eligible locations, not "ignore the filter".
export function directoryLocationScope(payload) {
  return Array.isArray(payload.directory_filter_location_ids)
    ? new Set(payload.directory_filter_location_ids.filter(id => typeof id === "string"))
    : null;
}
