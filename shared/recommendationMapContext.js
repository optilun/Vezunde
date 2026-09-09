import { mapPointFromResult } from './resultsMapPoints.js';

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// National directory supplies geography only. Ranking always belongs to the request.
export function recommendationMapContext(results = [], directory = [], meta = {}) {
  const publicById = new Map(directory.filter(row => row?.id).map(row => [row.id, row]));
  const byId = new Map();
  for (const row of directory) {
    if (!row?.id || !mapPointFromResult(row)) continue;
    byId.set(row.id, { ...row, result_bucket: '', bucket_rank: null, is_request_result: false });
  }
  const requestRows = results.filter(row => row?.id).map(row => {
    const publicRow = publicById.get(row.id);
    const coordinates = !mapPointFromResult(row) && mapPointFromResult(publicRow)
      ? { lat: publicRow.lat, lng: publicRow.lng, map_precision: publicRow.map_precision }
      : {};
    const merged = { ...row, ...coordinates, is_request_result: true };
    byId.set(row.id, merged);
    return merged;
  });
  const requestPoints = requestRows.filter(mapPointFromResult);
  const scope = meta.query_scope || meta.routing_mode || 'locality';
  let focusResults = scope === 'national' ? [] : requestPoints;
  if (scope !== 'national' && !focusResults.length) {
    const city = norm(meta.selected_locality_name);
    const county = norm(meta.selected_county_name);
    focusResults = directory.filter(row => mapPointFromResult(row) && (
      scope === 'county'
        ? county && norm(row.county) === county
        : city && norm(row.city) === city && (!county || norm(row.county) === county)
    ));
  }
  return { mapResults: [...byId.values()], focusResults };
}
