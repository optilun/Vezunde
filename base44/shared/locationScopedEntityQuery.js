const DEFAULT_LOCALITY_LOCATION_LIMIT = 1000;
const DEFAULT_PER_LOCATION_LIMIT = 300;
const ROMANIA_COUNTY_CODES = [
  'AB', 'AR', 'AG', 'BC', 'BH', 'BN', 'BT', 'BV', 'BR', 'BZ',
  'CS', 'CL', 'CJ', 'CT', 'CV', 'DB', 'DJ', 'GL', 'GR', 'GJ',
  'HR', 'HD', 'IL', 'IS', 'IF', 'MM', 'MH', 'MS', 'NT', 'OT',
  'PH', 'SM', 'SJ', 'SB', 'SV', 'TR', 'TM', 'TL', 'VS', 'VL',
  'VN', 'B',
];

function clean(value) {
  return String(value || '').trim();
}

function unique(values) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function dedupeRowsById(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const key = clean(row?.id) || `${clean(row?.locality_siruta_code)}:${clean(row?.name)}`;
    if (key && !byId.has(key)) byId.set(key, row);
  }
  return [...byId.values()];
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

export async function loadAllPublicLocationsByCounty(svc, options = {}) {
  const perCountyLimit = Math.max(1, Math.min(Number(options.perCountyLimit) || 1000, 5000));
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 8, 16));
  const rows = [];

  for (let offset = 0; offset < ROMANIA_COUNTY_CODES.length; offset += concurrency) {
    const batch = ROMANIA_COUNTY_CODES.slice(offset, offset + concurrency);
    const results = await Promise.all(batch.map((countyCode) => svc.entities.ProviderLocation.filter({
      status: 'publicata',
      county_code: countyCode,
    }, options.sort || 'name', perCountyLimit).catch(() => [])));
    for (const result of results) rows.push(...(Array.isArray(result) ? result : []));
  }

  return dedupeRowsById(rows);
}

export async function loadRowsForLocationIds(entity, locationIds, options = {}) {
  if (!entity?.filter) return [];
  const ids = unique(locationIds);
  if (ids.length === 0) return [];

  const perLocationLimit = Math.max(1, Math.min(Number(options.perLocationLimit) || DEFAULT_PER_LOCATION_LIMIT, 1000));
  const baseQuery = options.query && typeof options.query === 'object' ? options.query : {};
  const rows = [];

  // Grupam ID-urile in loturi si folosim $in intr-o singura interogare per lot, in loc
  // de un apel separat pentru fiecare locatie. Fix 2026-08-06: pentru un oras mare (ex.
  // Bucuresti, 170+ locatii), varianta veche (un apel per locatie, concurenta 12) insemna
  // ~15 valuri secventiale de retea DOAR pentru acest tabel - iar functia apeleaza acest
  // helper de 6 ori (servicii, asignari, echipament, facilitati, unitati, capabilitati),
  // deci ~90 valuri secventiale in total. Timpul cumulat putea depasi limita de executie
  // a functiei, dand eroare generica pentru orasele mari, indiferent de alte date.
  const idsPerBatch = Math.max(1, Math.min(Number(options.idsPerBatch) || 200, 500));
  const limitPerBatch = Math.min(perLocationLimit * idsPerBatch, 5000);

  for (let offset = 0; offset < ids.length; offset += idsPerBatch) {
    const batch = ids.slice(offset, offset + idsPerBatch);
    const result = await entity.filter({
      ...baseQuery,
      location_id: { $in: batch },
    }, options.sort || null, limitPerBatch).catch(() => []);
    if (Array.isArray(result)) rows.push(...result);
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

// Nivelul de detaliu public al unui profil din director nu sta pe locatie, ci pe starea ei de
// director (`ProviderLocationDirectoryState`): acolo scriu importul si aprobarea editoriala
// `directory_detail_level`, `directory_basic_details_approved` si `data_quality_status`.
//
// 2026-09-06. Pagina publica de profil imbina de mult starea inainte sa calculeze vizibilitatea.
// Cautarea si recomandarile nu o faceau, deci aceeasi locatie primea doua raspunsuri diferite
// despre ce e public: pe profil adresa se vedea, in rezultate nu. Efectul secundar era ca
// aprobarea editoriala nu producea niciun efect in cautare, iar harta rezultatelor nu avea
// coordonate de desenat.
//
// Se imbina DOAR cele trei campuri care decid nivelul de detaliu. Statusul de control, cel de
// publicare si cel operational raman citite de pe locatie, exact ca pana acum - ele hranesc
// eligibilitatea si ordonarea, iar acelea nu au voie sa se schimbe aici.
const DIRECTORY_DETAIL_OVERLAY_FIELDS = Object.freeze([
  'directory_detail_level',
  'directory_basic_details_approved',
  'data_quality_status',
]);

/**
 * Harta locationId -> campurile de detaliu din starea activa de director.
 *
 * @returns {Promise<Map<string, object>>}
 */
export async function loadDirectoryDetailOverlay(svc, locationIds, options = {}) {
  const ids = [...new Set((Array.isArray(locationIds) ? locationIds : []).filter(Boolean))];
  const overlay = new Map();
  if (ids.length === 0) return overlay;

  const states = await loadRowsForLocationIds(
    svc.entities.ProviderLocationDirectoryState,
    ids,
    // Aceeasi selectie ca pe pagina publica de profil: doar starea activa, cea mai recenta intai.
    { query: { state_status: 'active' }, sort: '-normalized_at', ...options },
  ).catch(() => []);

  for (const state of states) {
    const locationId = state?.location_id;
    if (!locationId || overlay.has(locationId)) continue;
    const fields = {};
    for (const field of DIRECTORY_DETAIL_OVERLAY_FIELDS) {
      if (state[field] !== undefined && state[field] !== null) fields[field] = state[field];
    }
    overlay.set(locationId, fields);
  }
  return overlay;
}

/**
 * Locatia, cu nivelul de detaliu adus din starea de director. Fara stare, ramane neschimbata.
 */
export function withDirectoryDetail(location, overlay) {
  const fields = overlay?.get?.(location?.id);
  return fields ? { ...location, ...fields } : location;
}
