// Datele din care se calculeaza harta nationala a directorului (browseDirectoryProviders,
// map_scope: 'national'), citite pe pagini mari in loc de o interogare pe fiecare judet.
//
// 2026-09-24. Calcularea citea locatiile publicate cu cate o interogare pe fiecare cod de judet
// (94 de coduri: 52 numerice SIRUTA plus 42 de abrevieri vechi, majoritatea goale), apoi starea de
// director in loturi de 200 de ID-uri (~8 citiri): ~100 de citiri in 4-5 secunde. Chiar si cu
// copia tinuta 10 minute (nationalMapCache.js), imediat dupa o recalculare o alta instanta a
// primit o data 503 (limita de trafic Base44). Acum: ~3 citiri pentru locatii si ~4 pentru stari,
// pentru ~1.400 de locatii.
//
// Ce ramane identic:
// - aceleasi locatii: `status: 'publicata'` si un cod de judet din aceeasi lista ca pana acum
//   (ROMANIA_COUNTY_CODES din locationScopedEntityQuery.js), filtrat aici in memorie;
// - aceeasi stare de director pe locatie: cea activa cu `normalized_at` cel mai recent, din care
//   se iau doar cele trei campuri de nivel de detaliu (ca `loadDirectoryDetailOverlay`).
// Folosit DOAR de harta nationala. Cautarea si recomandarile (getPublicLocationsForSearch,
// matchProviders etc.) raman pe interogarile lor; nu ordoneaza si nu filtreaza nimic in plus.
//
// Paginarea foloseste sortarea dupa `id` (unica), ca un rand sa nu apara pe doua pagini sau pe
// niciuna cand multe randuri au aceeasi data. O eroare de citire NU este inghitita: calcularea
// esueaza, iar nationalMapCache.js serveste ultima copie buna, in loc sa salveze 10 minute o
// harta careia ii lipsesc date.

export const NATIONAL_MAP_PAGE_SIZE = 500;
export const NATIONAL_MAP_MAX_PAGES = 60; // 30.000 de randuri; peste, calcularea esueaza explicit.

// Aceeasi lista ca in locationScopedEntityQuery.js (ROMANIA_COUNTY_CODES): coduri SIRUTA de judet
// "1".."52" plus abrevierile scrise manual inainte de contractul geografic.
const MAP_COUNTY_CODES = new Set([
  ...Array.from({ length: 52 }, (_, index) => String(index + 1)),
  'AB', 'AR', 'AG', 'BC', 'BH', 'BN', 'BT', 'BV', 'BR', 'BZ',
  'CS', 'CL', 'CJ', 'CT', 'CV', 'DB', 'DJ', 'GL', 'GR', 'GJ',
  'HR', 'HD', 'IL', 'IS', 'IF', 'MM', 'MH', 'MS', 'NT', 'OT',
  'PH', 'SM', 'SJ', 'SB', 'SV', 'TR', 'TM', 'TL', 'VS', 'VL',
  'VN', 'B',
]);

const DIRECTORY_DETAIL_OVERLAY_FIELDS = Object.freeze([
  'directory_detail_level',
  'directory_basic_details_approved',
  'data_quality_status',
]);

/**
 * Toate randurile care corespund interogarii, pe pagini de `pageSize`, in ordinea `id`.
 * Se opreste la prima pagina incompleta. Randurile repetate (acelasi id) sunt pastrate o data.
 */
export async function readAllPages(entity, query, {
  pageSize = NATIONAL_MAP_PAGE_SIZE,
  maxPages = NATIONAL_MAP_MAX_PAGES,
  sort = 'id',
} = {}) {
  if (!entity?.filter) throw new Error('entity unavailable');
  const size = Math.max(1, Math.min(Number(pageSize) || NATIONAL_MAP_PAGE_SIZE, 1000));
  const rows = [];
  const seen = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await entity.filter(query, sort, size, page * size);
    const list = Array.isArray(batch) ? batch : [];
    for (const row of list) {
      const id = row?.id ? String(row.id) : '';
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      rows.push(row);
    }
    if (list.length < size) return { rows, reads: page + 1 };
  }
  throw new Error(`national map source exceeded ${maxPages} pages of ${size}`);
}

/** Locatiile publicate, aceleasi ca `loadAllPublicLocationsByCounty`, din cateva citiri. */
export async function loadPublishedLocationsForMap(svc, options = {}) {
  const { rows, reads } = await readAllPages(svc?.entities?.ProviderLocation, { status: 'publicata' }, options);
  return {
    locations: rows.filter((row) => MAP_COUNTY_CODES.has(String(row?.county_code ?? '').trim())),
    reads,
  };
}

function normalizedAtValue(state) {
  const time = Date.parse(state?.normalized_at);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/**
 * Harta locationId -> campurile de detaliu din starea activa cea mai recenta, doar pentru
 * `locationIds`. Aceeasi alegere ca `loadDirectoryDetailOverlay` (sortare `-normalized_at`,
 * prima stare pe locatie), calculata in memorie.
 */
export async function loadDirectoryDetailOverlayForMap(svc, locationIds, options = {}) {
  const wanted = new Set((Array.isArray(locationIds) ? locationIds : []).filter(Boolean).map(String));
  const overlay = new Map();
  if (wanted.size === 0) return { overlay, reads: 0 };

  const { rows, reads } = await readAllPages(
    svc?.entities?.ProviderLocationDirectoryState,
    { state_status: 'active' },
    options,
  );
  const latest = new Map();
  for (const state of rows) {
    const locationId = state?.location_id ? String(state.location_id) : '';
    if (!locationId || !wanted.has(locationId)) continue;
    const current = latest.get(locationId);
    if (!current || normalizedAtValue(state) > normalizedAtValue(current)) latest.set(locationId, state);
  }
  for (const [locationId, state] of latest) {
    const fields = {};
    for (const field of DIRECTORY_DETAIL_OVERLAY_FIELDS) {
      if (state[field] !== undefined && state[field] !== null) fields[field] = state[field];
    }
    overlay.set(locationId, fields);
  }
  return { overlay, reads };
}
