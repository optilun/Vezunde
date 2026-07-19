const DEFAULT_LOCALITY_LOCATION_LIMIT = 1000;
const DEFAULT_PER_LOCATION_LIMIT = 300;
const DEFAULT_CONCURRENCY = 12;

function clean(value) {
  return String(value || '').trim();
}

function unique(values) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

export async function loadPublicLocationsForLocality(svc, localitySirutaCode, options = {}) {
  const sirutaCode = clean(localitySirutaCode);
  if (!sirutaCode) return [];
  const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LOCALITY_LOCATION_LIMIT, 5000));
  return svc.entities.ProviderLocation.filter({
    status: 'publicata',
    locality_siruta_code: sirutaCode,
  }, options.sort || 'name', limit);
}

export async function loadRowsForLocationIds(entity, locationIds, options = {}) {
  if (!entity?.filter) return [];
  const ids = unique(locationIds);
  if (ids.length === 0) return [];

  const perLocationLimit = Math.max(1, Math.min(Number(options.perLocationLimit) || DEFAULT_PER_LOCATION_LIMIT, 1000));
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || DEFAULT_CONCURRENCY, 25));
  const baseQuery = options.query && typeof options.query === 'object' ? options.query : {};
  const rows = [];

  for (let offset = 0; offset < ids.length; offset += concurrency) {
    const batch = ids.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map((locationId) => entity.filter({
      ...baseQuery,
      location_id: locationId,
    }, options.sort || null, perLocationLimit).catch(() => [])));
    for (const result of results) rows.push(...(Array.isArray(result) ? result : []));
  }

  return rows;
}

export function paginateRows(rows, options = {}) {
  const pageSize = Math.max(1, Math.min(Number(options.pageSize) || 20, 50));
  const offset = Math.max(0, Math.floor(Number(options.offset) || 0));
  const source = Array.isArray(rows) ? rows : [];
  const page = source.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  return {
    page,
    pagination: {
      offset,
      page_size: pageSize,
      returned: page.length,
      total: source.length,
      has_more: nextOffset < source.length,
      next_offset: nextOffset < source.length ? nextOffset : null,
    },
  };
}
