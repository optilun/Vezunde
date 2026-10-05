// Datele vin o singura data pe 90 de zile, impartite pe zile; perioadele de 7/30/90
// se obtin de aici, fara alt calcul pe server.
export const MAX_DAYS = 90;

export const sinceIso = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

export const inWindow = (rows, days) => {
  if (!rows) return null;
  const since = sinceIso(days);
  return rows.filter((r) => String(r.created_date || "").slice(0, 10) >= since);
};

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