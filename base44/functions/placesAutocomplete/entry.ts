import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const QUOTA_MSG = 'Momentan nu putem cauta pe Google Maps. Poti adauga locatia manual.';
const BLOCKED_MSG = 'Cautarea pe Google Maps este temporar indisponibila. Poti adauga locatia manual.';
// Defaults — the live values are read from the GooglePlacesConfig entity (admin-editable in the dashboard).
const DEFAULT_DAILY_SESSION_LIMIT = 50;
const DEFAULT_MONTHLY_SESSION_LIMIT = 500;
const ACTOR_DAILY_LIMIT = 25; // per user/IP requests per day

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

// Returns a blocked Response if a circuit-breaker limit is hit, otherwise null.
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const input = String(p.input || '').trim().slice(0, 100);
    if (input.length < 3) return Response.json({ predictions: [] });

    const config = await getConfig(svc);
    if (config.enable_google_places === false) {
      return Response.json({ blocked: true, error: BLOCKED_MSG }, { status: 429 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const usage = await getUsage(svc, day, month);
    const blocked = await checkCircuitBreaker(svc, config, usage, month);
    if (blocked) return blocked;

    // Per-actor rate limit (user id when logged in, otherwise IP).
    const user = await base44.auth.me().catch(() => null);
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const actorId = user ? `user:${user.id}` : `ip:${ip}`;
    const allowed = await consumeActorQuota(svc, actorId, day);
    if (!allowed) return Response.json({ error: QUOTA_MSG, quota: true }, { status: 429 });

    // Count one session per unique session token (only actual Google-mode sessions reach this function).
    const token = String(p.session_token || '').slice(0, 64);
    if (token) {
      const sessionKey = `gsession:${token}`;
      const seen = await svc.entities.PlacesApiUsage.filter({ bucket_key: sessionKey });
      if (seen.length === 0) {
        await svc.entities.PlacesApiUsage.create({ bucket_key: sessionKey, count: 1 });
        await svc.entities.GooglePlacesUsage.update(usage.id, {
          autocomplete_sessions_count: (usage.autocomplete_sessions_count || 0) + 1,
        });
        await svc.entities.AuditLog.create({ event_type: 'google_search_activated', message: `Sesiune de cautare Google Places pornita (${actorId})` });
      }
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const body = { input, includedRegionCodes: ['RO'], languageCode: 'ro' };
    if (token) body.sessionToken = token;

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