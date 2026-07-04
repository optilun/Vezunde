import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const QUOTA_MSG = 'Momentan nu putem cauta pe Google Maps. Poti adauga locatia manual.';
const BLOCKED_MSG = 'Cautarea pe Google Maps este temporar indisponibila. Poti adauga locatia manual.';
// Defaults — the live values are read from the GooglePlacesConfig entity (admin-editable in the dashboard).
const DEFAULT_DAILY_SESSION_LIMIT = 50;
const DEFAULT_MONTHLY_SESSION_LIMIT = 500;
const ACTOR_DAILY_LIMIT = 25;

async function getConfig(svc) {
  const rows = await svc.entities.GooglePlacesConfig.list(null, 1);
  if (rows.length > 0) return rows[0];
  return await svc.entities.GooglePlacesConfig.create({
    daily_session_limit: DEFAULT_DAILY_SESSION_LIMIT,
    monthly_session_limit: DEFAULT_MONTHLY_SESSION_LIMIT,
    enable_google_places: true,
  });
}

async function getUsage(svc, day, month) {
  const rows = await svc.entities.GooglePlacesUsage.filter({ date: day });
  if (rows.length > 0) return rows[0];
  return await svc.entities.GooglePlacesUsage.create({
    date: day, month, autocomplete_sessions_count: 0, details_requests_count: 0,
  });
}

async function monthlySessions(svc, month) {
  const rows = await svc.entities.GooglePlacesUsage.filter({ month }, null, 40);
  return rows.reduce((s, r) => s + (r.autocomplete_sessions_count || 0), 0);
}

async function checkCircuitBreaker(svc, config, usage, month) {
  const dailyLimit = config.daily_session_limit ?? DEFAULT_DAILY_SESSION_LIMIT;
  const monthlyLimit = config.monthly_session_limit ?? DEFAULT_MONTHLY_SESSION_LIMIT;
  if ((usage.autocomplete_sessions_count || 0) >= dailyLimit) {
    if (usage.blocked_reason !== 'daily_limit') {
      await svc.entities.GooglePlacesUsage.update(usage.id, { blocked_reason: 'daily_limit' });
      await svc.entities.AuditLog.create({ event_type: 'google_blocked_daily_limit', message: `Google Places blocat: limita zilnica de sesiuni (${dailyLimit}) atinsa` });
    }
    return Response.json({ blocked: true, error: BLOCKED_MSG }, { status: 429 });
  }
  const monthly = await monthlySessions(svc, month);
  if (monthly >= monthlyLimit) {
    if (usage.blocked_reason !== 'monthly_limit') {
      await svc.entities.GooglePlacesUsage.update(usage.id, { blocked_reason: 'monthly_limit' });
      await svc.entities.AuditLog.create({ event_type: 'google_blocked_monthly_limit', message: `Google Places blocat: limita lunara de sesiuni (${monthlyLimit}) atinsa` });
    }
    return Response.json({ blocked: true, error: BLOCKED_MSG }, { status: 429 });
  }
  return null;
}

async function consumeActorQuota(svc, actorId, day) {
  const key = `actor:${actorId}:${day}`;
  const rows = await svc.entities.PlacesApiUsage.filter({ bucket_key: key });
  const row = rows[0];
  if (row && row.count >= ACTOR_DAILY_LIMIT) return false;
  if (row) await svc.entities.PlacesApiUsage.update(row.id, { count: row.count + 1 });
  else await svc.entities.PlacesApiUsage.create({ bucket_key: key, count: 1 });
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

    const config = await getConfig(svc);
    if (config.enable_google_places === false) {
      return Response.json({ blocked: true, error: BLOCKED_MSG }, { status: 429 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const usage = await getUsage(svc, day, month);
    const blocked = await checkCircuitBreaker(svc, config, usage, month);
    if (blocked) return blocked;

    const user = await base44.auth.me().catch(() => null);
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const actorId = user ? `user:${user.id}` : `ip:${ip}`;
    const allowed = await consumeActorQuota(svc, actorId, day);
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
      // Google-side failure (permission, key, billing, network, etc.) — sanitized error, not a quota block.
      return Response.json({ error: QUOTA_MSG, google_error: true }, { status: 503 });
    }
    const place = await gRes.json();

    await svc.entities.GooglePlacesUsage.update(usage.id, {
      details_requests_count: (usage.details_requests_count || 0) + 1,
    });
    await svc.entities.AuditLog.create({ event_type: 'google_details_completed', message: `Detalii Google Places preluate pentru "${strip(place.displayName?.text || placeId)}" (${actorId})` });

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