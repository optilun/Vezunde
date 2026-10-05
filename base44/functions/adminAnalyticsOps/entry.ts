import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Acoperire pe judete pentru ecranul Analytics (doar admin, doar citire).
// ProviderLocation are reguli de citire pe campuri, deci aggregate nu e permis;
// citim doar campul county_name, pagina cu pagina, si numaram aici, pe server.
async function countByField(entity, query, field) {
  const counts = {};
  let cursor;
  do {
    const page = await entity.filter(query, { limit: 1000, fields: [field], cursor });
    for (const row of page.items || []) {
      const key = String(row[field] || '').trim() || 'Necunoscut';
      counts[key] = (counts[key] || 0) + 1;
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return counts;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const e = base44.asServiceRole.entities;
    const [locations, contacts] = await Promise.all([
      countByField(e.ProviderLocation, { status: 'publicata' }, 'county_name'),
      countByField(e.PatientSearchContact, {}, 'county'),
    ]);

    const names = new Set([...Object.keys(locations), ...Object.keys(contacts)]);
    const counties = [...names]
      .map((name) => ({ county: name, locations: locations[name] || 0, search_contacts: contacts[name] || 0 }))
      .sort((a, b) => b.locations - a.locations);

    return Response.json({ counties });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}