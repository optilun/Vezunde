import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const QUOTA_MSG = 'Momentan nu putem cauta pe Google Maps. Poti adauga locatia manual.';
const GLOBAL_DAILY_LIMIT = 100;
const ACTOR_DAILY_LIMIT = 25;

async function consumeQuota(svc, actorId) {
  const day = new Date().toISOString().slice(0, 10);
  const buckets = [
    { key: `global:${day}`, limit: GLOBAL_DAILY_LIMIT },
    { key: `actor:${actorId}:${day}`, limit: ACTOR_DAILY_LIMIT },
  ];
  for (const b of buckets) {
    const rows = await svc.entities.PlacesApiUsage.filter({ bucket_key: b.key });
    const row = rows[0];
    if (row && row.count >= b.limit) return false;
    if (row) await svc.entities.PlacesApiUsage.update(row.id, { count: row.count + 1 });
    else await svc.entities.PlacesApiUsage.create({ bucket_key: b.key, count: 1 });
  }
  return true;
}

// App content is stored without diacritics — normalize Google text the same way.
const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const GENERIC = new Set(['optica', 'medicala', 'clinica', 'cabinet', 'oftalmologic', 'oftalmologica', 'oftalmologie', 'optometric', 'optometrie', 'laborator', 'optic', 'centru', 'srl']);
const STREET_WORDS = new Set(['strada', 'str', 'bulevardul', 'calea', 'soseaua', 'sos', 'aleea', 'piata', 'numarul']);
const tokens = (s) => strip(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
const sigNameTokens = (s) => tokens(s).filter((t) => !GENERIC.has(t));
const streetTokens = (s) => tokens(s).filter((t) => !STREET_WORDS.has(t) && !/^\d+$/.test(t));

// Public whitelist only — never internal/verification data.
const publicLocation = (l) => ({
  id: l.id,
  name: l.name,
  provider_type: l.provider_type,
  city: l.city,
  county: l.county || '',
  address: l.address || '',
  is_verified: !!l.is_verified,
  verification_state: l.verification_state || 'unclaimed',
  organization_id: l.organization_id || null,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const placeId = String(p.place_id || '').trim().slice(0, 300);
    if (!placeId) return Response.json({ error: 'place_id lipseste' }, { status: 400 });

    const user = await base44.auth.me().catch(() => null);
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const actorId = user ? `user:${user.id}` : `ip:${ip}`;
    const allowed = await consumeQuota(svc, actorId);
    if (!allowed) return Response.json({ error: QUOTA_MSG, quota: true }, { status: 429 });

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const params = new URLSearchParams({ languageCode: 'ro' });
    if (p.session_token) params.set('sessionToken', String(p.session_token).slice(0, 64));
    const gRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,nationalPhoneNumber,websiteUri',
      },
    });
    if (!gRes.ok) {
      console.error('Places details failed', gRes.status, await gRes.text());
      return Response.json({ error: QUOTA_MSG, quota: true }, { status: 503 });
    }
    const place = await gRes.json();

    const name = strip(place.displayName?.text || '');
    const address = strip(place.formattedAddress || '');
    let city = '';
    let county = '';
    for (const c of place.addressComponents || []) {
      const types = c.types || [];
      if (types.includes('locality')) city = strip(c.longText || '');
      if (types.includes('administrative_area_level_1')) county = strip(c.longText || '').replace(/^Judetul\s+/i, '');
    }
    if (/^Sector/i.test(city) || /^Bucuresti/i.test(county)) {
      if (/^Sector/i.test(city) || !city) city = 'Bucuresti';
      county = 'Bucuresti';
    }

    // 1) Exact dedup by place_id.
    const byPlace = await svc.entities.ProviderLocation.filter({ place_id: place.id });
    const existing = byPlace.find((l) => l.status === 'publicata');
    if (existing) return Response.json({ existing_location: publicLocation(existing) });
    if (byPlace.length > 0) {
      return Response.json({ error: 'O cerere pentru aceasta locatie este deja in verificare in Vezunde.' }, { status: 409 });
    }

    const draft = {
      name,
      address,
      city,
      county,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      place_id: place.id,
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
    };

    // 2) Fuzzy dedup: same city + significant name-token overlap, or street match with any name overlap.
    if (city) {
      const cityLocs = await svc.entities.ProviderLocation.filter({ city, status: 'publicata' }, null, 200);
      const nameSig = sigNameTokens(name);
      const street = streetTokens(address);
      const similar = cityLocs.find((l) => {
        const lSig = sigNameTokens(l.name);
        const nameHit = nameSig.some((t) => lSig.includes(t));
        const streetHit = street.some((t) => streetTokens(l.address || '').includes(t));
        const anyNameHit = tokens(name).some((t) => tokens(l.name).includes(t));
        return nameHit || (streetHit && anyNameHit);
      });
      if (similar) return Response.json({ similar_location: publicLocation(similar), draft });
    }

    return Response.json({ draft });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});