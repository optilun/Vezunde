// Datele vin o singura data pe 90 de zile, impartite pe zile; perioadele de 7/30/90
// se obtin de aici, fara alt calcul pe server.
// 2026-10-07: perioada = ultimele `days` zile calendaristice, azi inclusiv (7 zile = azi + 6 zile dinainte;
// inainte includea si a opta zi), ca perioada de dinainte sa aiba exact aceeasi lungime la comparatie.
export const MAX_DAYS = 90;

const DAY_MS = 86400000;
const dayOf = (value) => String(value || "").slice(0, 10);

// Data (UTC, AAAA-LL-ZZ) cu `daysBack` zile inaintea lui `now`.
export const sinceIso = (daysBack, now = Date.now()) => new Date(now - daysBack * DAY_MS).toISOString().slice(0, 10);

export const inWindow = (rows, days, now = Date.now()) => {
  if (!rows) return null;
  const since = sinceIso(days - 1, now);
  return rows.filter((r) => dayOf(r.created_date) >= since);
};

// Perioada de dinainte, de aceeasi lungime, imediat inaintea celei curente; null daca datele nu ajung
// (peste 90 de zile nu avem istoric) sau lipsesc.
export const inPreviousWindow = (rows, days, now = Date.now()) => {
  if (!rows || days * 2 > MAX_DAYS) return null;
  const from = sinceIso(days * 2 - 1, now);
  const to = sinceIso(days - 1, now);
  return rows.filter((r) => dayOf(r.created_date) >= from && dayOf(r.created_date) < to);
};

// Diferenta dintre doua numere: { diff, pct }. null cand nu e nimic de comparat (indisponibil sau 0 si 0).
export function changeBetween(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (current === 0 && previous === 0) return null;
  const diff = current - previous;
  return { diff, pct: previous > 0 ? Math.round((diff / previous) * 100) : null };
}

// Insumeaza randurile pe campurile date, ignorand ziua.
export function sumBy(rows, fields) {
  if (!rows) return null;
  const map = new Map();
  for (const r of rows) {
    const key = fields.map((f) => r[f] ?? "").join("\u0001");
    const cur = map.get(key) || { ...Object.fromEntries(fields.map((f) => [f, r[f]])), count: 0 };
    cur.count += r.count || 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const weekStart = (iso) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Graficul: pe zile pana la 30, pe saptamani peste.
export function buckets(rows, days) {
  if (!rows) return null;
  const map = new Map();
  for (const r of rows) {
    const key = days > 30 ? weekStart(r.created_date) : String(r.created_date).slice(0, 10);
    map.set(key, (map.get(key) || 0) + (r.count || 0));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([created_date, count]) => ({ created_date, count }));
}
