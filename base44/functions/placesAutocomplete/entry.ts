import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const QUOTA_MSG = 'Momentan nu putem cauta pe Google Maps. Poti adauga locatia manual.';
const GLOBAL_DAILY_LIMIT = 100; // total Google Places calls per day (autocomplete + details)
const ACTOR_DAILY_LIMIT = 25;   // per user/IP per day

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const input = String(p.input || '').trim().slice(0, 100);
    if (input.length < 3) return Response.json({ predictions: [] });

    // Rate limit by user id when logged in, otherwise by IP.
    const user = await base44.auth.me().catch(() => null);
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const actorId = user ? `user:${user.id}` : `ip:${ip}`;
    const allowed = await consumeQuota(svc, actorId);
    if (!allowed) return Response.json({ error: QUOTA_MSG, quota: true }, { status: 429 });

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const body = { input, includedRegionCodes: ['RO'], languageCode: 'ro' };
    if (p.session_token) body.sessionToken = String(p.session_token).slice(0, 64);

    const gRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (!gRes.ok) {
      console.error('Places autocomplete failed', gRes.status, await gRes.text());
      return Response.json({ error: QUOTA_MSG, quota: true }, { status: 503 });
    }
    const data = await gRes.json();
    const predictions = (data.suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .slice(0, 5)
      .map((pp) => ({
        place_id: pp.placeId,
        main_text: pp.structuredFormat?.mainText?.text || pp.text?.text || '',
        secondary_text: pp.structuredFormat?.secondaryText?.text || '',
      }));
    return Response.json({ predictions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});