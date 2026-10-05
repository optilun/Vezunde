import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Analytics admin (doar citire): acoperire pe judete si ce cauta pacientii.
// ProviderLocation are reguli de citire pe campuri, deci aggregate nu e permis;
// citim doar campul county_name, pagina cu pagina, si numaram aici, pe server.
// Acoperirea nu depinde de perioada aleasa: o tinem 10 minute in memorie, ca schimbarea
// perioadei 7/30/90 sa nu reciteasca toate locatiile.
const coverageCache = { at: 0, value: null };
const COVERAGE_TTL_MS = 10 * 60 * 1000;

async function countByField(entity, query, field) {
  const counts = {};
  let cursor;
  do {
    const page = await entity.filter(query, { limit: 5000, fields: [field], cursor });
    for (const row of page.items || []) {
      const key = String(row[field] || '').trim() || 'Necunoscut';
      counts[key] = (counts[key] || 0) + 1;
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return counts;
}

const rowsToMap = (rows, field) =>
  Object.fromEntries((rows || []).map((r) => [String(r[field] || '').trim() || 'Necunoscut', r.count]));

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const days = [7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30;
    const inPeriod = { created_date: { $gte: new Date(Date.now() - days * 86400000).toISOString() } };

    const e = base44.asServiceRole.entities;
    const coverage = coverageCache.value && Date.now() - coverageCache.at < COVERAGE_TTL_MS
      ? coverageCache.value
      : Promise.all([
        countByField(e.ProviderLocation, { status: 'publicata' }, 'county_name'),
        countByField(e.PatientSearchContact, {}, 'county'),
      ]).then((value) => { coverageCache.value = value; coverageCache.at = Date.now(); return value; });
    const [[locations, contacts], searchesByCounty, topServices, zeroResults] = await Promise.all([
      coverage,
      e.PatientSearchEvent.aggregate({ query: inPeriod, groupBy: 'county_name', limit: 100 }),
      e.PatientSearchEvent.aggregate({ query: inPeriod, groupBy: 'service_key', sort: '-count', limit: 15 }),
      e.PatientSearchEvent.aggregate({ query: { ...inPeriod, zero_results: true }, groupBy: ['county_name', 'service_key'], sort: '-count', limit: 20 }),
    ]);

    const searches = rowsToMap(searchesByCounty.rows, 'county_name');
    const names = new Set([...Object.keys(locations), ...Object.keys(contacts), ...Object.keys(searches)]);
    const counties = [...names]
      .map((name) => ({ county: name, locations: locations[name] || 0, searches: searches[name] || 0, search_contacts: contacts[name] || 0 }))
      .sort((a, b) => b.locations - a.locations);

    return Response.json({
      counties,
      top_services: (topServices.rows || []).map((r) => ({ service_key: r.service_key || '', count: r.count })),
      zero_results: (zeroResults.rows || []).map((r) => ({ county: r.county_name || '', service_key: r.service_key || '', count: r.count })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}