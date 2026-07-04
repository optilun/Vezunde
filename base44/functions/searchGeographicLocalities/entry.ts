import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3F.2 - Public, read-only locality search over canonical GeographicLocality.
// Returns ONLY whitelisted, safe fields. No import metadata, no unbounded lists.
// Matches the CSV normalization: diacritics stripped, hyphens treated as spaces.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TYPE_PRIORITY = { municipality_county_seat: 0, municipality: 1, town: 2, sector: 2, commune: 3 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const geo = base44.asServiceRole.entities.GeographicLocality;
    const { query } = await req.json();
    const q = norm(query);
    if (q.length < 2) return Response.json({ results: [] });

    const sectorMatch = q.match(/^sector(ul)?\s*([1-6])$/);
    const promises = [
      geo.filter({ normalized_name: q, is_active: true }, 'locality_sort_key', 30),
      geo.filter({ normalized_name: { $regex: '^' + esc(q) }, is_active: true }, 'locality_sort_key', 40),
      geo.filter({ normalized_name: { $regex: esc(q) }, is_active: true }, 'locality_sort_key', 40),
      geo.filter({ aliases: { $regex: esc(q), $options: 'i' }, is_active: true }, 'locality_sort_key', 20),
    ];
    if (sectorMatch) {
      promises.push(geo.filter({ normalized_name: { $regex: 'sector' }, is_active: true }, 'locality_sort_key', 30));
    }
    const settled = await Promise.all(promises.map((p) => p.catch(() => [])));
    const rankOf = new Map();
    const pool = new Map();
    settled.forEach((list, idx) => {
      const rank = idx <= 3 ? idx : 3;
      for (const rec of list) {
        if (!pool.has(rec.id)) { pool.set(rec.id, rec); rankOf.set(rec.id, rank); }
      }
    });

    let candidates = [...pool.values()];
    // Counties are not selectable localities — except the general Bucuresti option.
    candidates = candidates.filter((r) => r.locality_type !== 'county' && r.locality_type !== 'bucharest_county');
    // "Sector N" query returns exactly that sector.
    if (sectorMatch) {
      const n = sectorMatch[2];
      const re = new RegExp('sector(ul)?\\s*' + n + '$');
      candidates = candidates.filter((r) => re.test(r.normalized_name));
    }

    // Dedupe same name within the same county — keep the lower SIRUTA level (UAT over component).
    const byKey = new Map();
    for (const r of candidates) {
      const key = r.normalized_name + '|' + r.county_code;
      const cur = byKey.get(key);
      if (!cur || (r.siruta_level || '9') < (cur.siruta_level || '9')) byKey.set(key, r);
    }
    candidates = [...byKey.values()];

    candidates.sort((a, b) => {
      const ra = rankOf.get(a.id) ?? 3;
      const rb = rankOf.get(b.id) ?? 3;
      if (ra !== rb) return ra - rb;
      const ta = TYPE_PRIORITY[a.locality_type] ?? 4;
      const tb = TYPE_PRIORITY[b.locality_type] ?? 4;
      if (ta !== tb) return ta - tb;
      return (a.locality_sort_key || '').localeCompare(b.locality_sort_key || '');
    });

    const top = candidates.slice(0, 10);
    const nameCounts = {};
    for (const r of candidates) nameCounts[r.normalized_name] = (nameCounts[r.normalized_name] || 0) + 1;

    const results = top.map((r) => {
      let aliases = [];
      try { const a = JSON.parse(r.aliases || '[]'); if (Array.isArray(a)) aliases = a.filter((x) => typeof x === 'string'); } catch (_e) { aliases = []; }
      const showCounty = (nameCounts[r.normalized_name] || 0) > 1;
      return {
        siruta_code: r.siruta_code,
        name: r.name,
        locality_type: r.locality_type,
        county_code: r.county_code,
        county_name: r.county_name,
        uat_name: r.uat_name && r.uat_name !== r.name ? r.uat_name : undefined,
        display_label: showCounty ? r.name + ', ' + r.county_name : r.name,
        aliases,
      };
    });
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});