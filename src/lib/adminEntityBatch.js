// Citire țintită în panoul de admin (2026-10-07).
//
// Mai multe ecrane încărcau tot directorul (limite fixe de 1.000 / 1.500 / 5.000) doar ca să afle
// câteva nume. Cu ~1.600 de locații, limitele de 1.000 și 1.500 tăiau rezultate în tăcere
// („Locație necunoscută”, număr greșit de locații active). Aici se citesc doar înregistrările
// de care ecranul are nevoie, în pachete de id-uri.

export const ID_CHUNK = 100;

export function chunk(list, size = ID_CHUNK) {
  const rows = Array.isArray(list) ? list : [];
  const parts = [];
  for (let index = 0; index < rows.length; index += size) parts.push(rows.slice(index, index + size));
  return parts;
}

export function uniqueIds(...lists) {
  const seen = new Set();
  for (const list of lists) {
    for (const value of Array.isArray(list) ? list : []) {
      const id = String(value ?? "").trim();
      if (id) seen.add(id);
    }
  }
  return [...seen];
}

function rowsOf(page) {
  if (Array.isArray(page)) return page;
  return Array.isArray(page?.items) ? page.items : [];
}

// Întoarce { byId, failed }. Nu aruncă: ecranul decide ce afișează dacă `failed` e true.
export async function fetchByIds(entity, ids) {
  const wanted = uniqueIds(ids);
  const byId = {};
  if (wanted.length === 0) return { byId, failed: false };
  let failed = false;
  const pages = await Promise.all(
    chunk(wanted).map((part) => entity.filter({ id: { $in: part } }, null, part.length).catch(() => {
      failed = true;
      return [];
    })),
  );
  for (const page of pages) for (const row of rowsOf(page)) if (row?.id) byId[row.id] = row;
  return { byId, failed };
}

// Toate înregistrările cu `field` într-o listă de valori (ex. locațiile unor organizații).
export async function fetchWhereIn(entity, field, values, { limit = 5000 } = {}) {
  const wanted = uniqueIds(values);
  const rows = [];
  if (wanted.length === 0) return { rows, failed: false };
  let failed = false;
  const pages = await Promise.all(
    chunk(wanted).map((part) => entity.filter({ [field]: { $in: part } }, null, limit).catch(() => {
      failed = true;
      return [];
    })),
  );
  const seen = new Set();
  for (const page of pages) {
    for (const row of rowsOf(page)) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return { rows, failed };
}
