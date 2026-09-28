// 2026-09-28 (audit /cauta, B6). Harta Romaniei dintr-un fisier static.
//
// Lista pentru harta nationala (~1.300 de puncte) vine din functia publica browseDirectoryProviders
// (`map_scope: 'national'`): ~0,6 s cand functia e deja pornita, ~3,5 s cand porneste la rece si isi
// reface copia. La fiecare Publish, build-ul scrie acelasi raspuns intr-un fisier static
// (NATIONAL_MAP_SNAPSHOT_PATH), servit direct de pe viasee.ro. Pagina:
// - arata imediat punctele din fisier;
// - cere in paralel lista actuala si o pune in locul fisierului cand soseste (harta nu se muta);
// - daca lista actuala nu vine, ramane cu fisierul si spune de cand este.
//
// Datele sunt exact cele publice pe care functia le da oricui; fisierul nu adauga nimic. Un fisier
// mai vechi de NATIONAL_MAP_SNAPSHOT_MAX_AGE_MS nu se mai foloseste (pagina asteapta lista actuala).

export const NATIONAL_MAP_SNAPSHOT_PATH = "/data/harta-nationala.json";
export const NATIONAL_MAP_SNAPSHOT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function validPoint(point) {
  return point && typeof point === "object" && point.id != null
    && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
}

/** Continutul fisierului, din raspunsul functiei; null daca raspunsul nu e o harta nationala valida. */
export function nationalMapSnapshotFromResponse(body, now = new Date()) {
  if (!body || typeof body !== "object" || body.error) return null;
  if (body.map_scope !== undefined && body.map_scope !== "national") return null;
  if (!Array.isArray(body.results) || body.results.length === 0) return null;
  if (!body.results.every(validPoint)) return null;
  const { stale: _stale, ...rest } = body;
  return { ...rest, map_scope: "national", snapshot_built_at: now.toISOString() };
}

/** Datele din fisier (text), sau null daca fisierul lipseste, nu e JSON (ex. pagina HTML) sau e prea vechi. */
export function parseNationalMapSnapshot(text, now = Date.now(), maxAgeMs = NATIONAL_MAP_SNAPSHOT_MAX_AGE_MS) {
  if (typeof text !== "string" || !text.trim().startsWith("{")) return null;
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || data.map_scope !== "national" || !Array.isArray(data.results) || data.results.length === 0) return null;
  const builtAt = Date.parse(data.snapshot_built_at);
  if (!Number.isFinite(builtAt) || now - builtAt > maxAgeMs || builtAt - now > 60 * 60 * 1000) return null;
  return { ...data, from_snapshot: true };
}
