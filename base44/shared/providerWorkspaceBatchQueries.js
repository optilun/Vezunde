// Citiri grupate pentru spatiul de furnizor.
//
// 2026-10-03. Spatiul de furnizor citea datele cate o locatie pe rand: la fiecare locatie, 6
// interogari pentru continut (servicii, specializari, echipa, media, articole, modificari in
// asteptare), plus membrii si modificarile pentru numaratoare. Pentru o optica cu 3 locatii asta
// insemna ~30 de apeluri, iar pentru o retea cu 87 de locatii ~700 de apeluri la O SINGURA
// incarcare - si ecranul se incarca de mai multe ori (overview, membri, completare profil).
// Base44 raspundea „Rate limit exceeded” (HTTP 500) si contul de furnizor arata eroare.
//
// Aici aceleasi date se citesc cu `$in` pe grupuri de ID-uri, cu paginare completa, deci numarul
// de apeluri nu mai creste cu numarul de locatii. Rezultatele sunt aceleasi randuri, doar adunate
// altfel; numaratorile devin exacte (inainte, unele interogari fara limita explicita se opreau la
// limita implicita a platformei).
//
// Doar citire. Nu atinge matchingul, rankingul sau distribuirea cererilor.

export const IDS_PER_QUERY = 100;
export const PAGE_SIZE = 500;
// Garda: cel mult 40 de pagini (20.000 de randuri) pentru un grup de ID-uri.
export const MAX_PAGES = 40;
export const ACTIVE_SUBMISSION_STATUSES = Object.freeze(['draft', 'pending_review', 'needs_more_info']);

function clean(value) {
  return String(value ?? '').trim();
}

export function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

export function chunkIds(values, size = IDS_PER_QUERY) {
  const ids = uniqueIds(values);
  const step = Math.max(1, Math.floor(Number(size) || IDS_PER_QUERY));
  const chunks = [];
  for (let offset = 0; offset < ids.length; offset += step) chunks.push(ids.slice(offset, offset + step));
  return chunks;
}

export function dedupeById(rows) {
  const byId = new Map();
  const withoutId = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    const id = clean(row.id);
    if (!id) withoutId.push(row);
    else if (!byId.has(id)) byId.set(id, row);
  }
  return [...byId.values(), ...withoutId];
}

/** Toate paginile unei interogari (sau doar primele `maxPages`). */
export async function filterAllPages(entity, query, options = {}) {
  if (!entity?.filter) return [];
  const pageSize = Math.max(1, Math.min(Number(options.pageSize) || PAGE_SIZE, 1000));
  const maxPages = Math.max(1, Math.min(Number(options.maxPages) || MAX_PAGES, MAX_PAGES));
  const sort = options.sort === undefined ? 'created_date' : options.sort;
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await entity.filter(query, sort, pageSize, page * pageSize);
    const list = Array.isArray(result) ? result : [];
    rows.push(...list);
    if (list.length < pageSize) break;
  }
  return dedupeById(rows);
}

/** Randurile al caror `field` este in lista `ids`, cu `$in` pe grupuri si paginare. */
export async function filterByIdList(entity, field, ids, query = {}, options = {}) {
  const rows = [];
  for (const batch of chunkIds(ids, options.idsPerQuery)) {
    rows.push(...await filterAllPages(entity, { ...query, [field]: { $in: batch } }, options));
  }
  return dedupeById(rows);
}

/**
 * Echivalentul grupat pentru `entity.get(id).catch(() => null)` repetat. ID-urile inexistente
 * lipsesc din harta. Ce nu vine din citirea grupata (sau totul, daca ea esueaza) se citeste unul
 * cate unul, ca inainte - deci in cel mai rau caz comportamentul e cel vechi, nu o lista goala.
 */
export async function getManyByIds(entity, ids, options = {}) {
  const wanted = uniqueIds(ids);
  const byId = new Map();
  if (!entity || wanted.length === 0) return byId;
  const rows = await filterByIdList(entity, 'id', wanted, {}, options).catch(() => []);
  for (const row of rows) if (row?.id) byId.set(row.id, row);
  if (options.fallbackToGet !== false && typeof entity.get === 'function') {
    for (const id of wanted) {
      if (byId.has(id)) continue;
      const row = await entity.get(id).catch(() => null);
      if (row) byId.set(id, row);
    }
  }
  return byId;
}

export function groupRowsBy(rows, field) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = clean(row?.[field]);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

export function rowsFor(groups, key) {
  return groups?.get?.(clean(key)) || [];
}

const CONTENT_SOURCES = Object.freeze({
  submissions: { entity: 'ProviderWorkspaceSubmission', query: { access_origin: 'provider_workspace', status: { $in: ACTIVE_SUBMISSION_STATUSES } }, sort: '-created_date' },
  services: { entity: 'LocationService', query: { is_active: true } },
  specialties: { entity: 'LocationSpecialization', query: { is_active: true } },
  team: { entity: 'ProfessionalLocationAssignment', query: { active_status: 'activ', public_status: 'public' } },
  media: { entity: 'ProviderMediaAsset', query: { status: 'approved' } },
  articles: { entity: 'ProviderArticle', query: { status: 'approved' } },
});

export const LOCATION_CONTENT_PARTS = Object.freeze(Object.keys(CONTENT_SOURCES));

/**
 * Continutul aprobat si modificarile active pentru mai multe locatii, grupate pe `location_id`.
 * Aceleasi filtre ca vechile interogari per locatie din overview, workspace si completare profil.
 * `parts` alege ce se citeste (implicit tot).
 */
export async function loadLocationContentIndex(svc, locationIds, options = {}) {
  const ids = uniqueIds(locationIds);
  const parts = Array.isArray(options.parts) && options.parts.length
    ? LOCATION_CONTENT_PARTS.filter((part) => options.parts.includes(part))
    : LOCATION_CONTENT_PARTS;
  const index = Object.fromEntries(LOCATION_CONTENT_PARTS.map((part) => [part, new Map()]));
  if (ids.length === 0) return index;
  const loaded = await Promise.all(parts.map((part) => {
    const source = CONTENT_SOURCES[part];
    return filterByIdList(svc.entities[source.entity], 'location_id', ids, source.query, { sort: source.sort });
  }));
  parts.forEach((part, position) => { index[part] = groupRowsBy(loaded[position], 'location_id'); });
  return index;
}
