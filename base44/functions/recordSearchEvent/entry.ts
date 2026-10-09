import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { localInterestService, localAreaKey, LOCAL_INTEREST_VERSION } from '../../shared/providerLocalInterestPolicy.js';

// Inregistreaza o cautare anonima. Pastreaza doar campurile permise: fara nume,
// email, telefon, IP, ID de cont sau text liber. Nu influenteaza cautarea.
const MAX_EVENTS_PER_SESSION_PER_HOUR = 30;
const ENTRY_POINTS = ['formular', 'harta', 'ghid'];
const clean = (value, max = 80) => String(value || '').trim().slice(0, max);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get('origin') || '';
    const user = await base44.auth.me().catch(() => null);
    // Only production browser searches. Preview, local harnesses and admin tests
    // are excluded; client-supplied eligibility/version flags are never trusted.
    if (!['https://viasee.ro', 'https://www.viasee.ro', 'https://viasee-core.base44.app'].includes(origin) || user?.role === 'admin') {
      return Response.json({ ok: true, skipped: true });
    }
    const sessionHash = clean(body.session_hash, 64);
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(sessionHash)) {
      return Response.json({ error: 'invalid_session' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PatientSearchEvent;
    const service = localInterestService(body.service_key);
    const siruta = clean(body.locality_siruta_code, 16);
    if (!service || !/^\d{1,10}$/.test(siruta)) return Response.json({ ok: true, skipped: true });
    const places = await base44.asServiceRole.entities.GeographicLocality.filter({ siruta_code: siruta, is_active: true }, 'id', 2);
    const place = places[0];
    if (!place || places.length !== 1) return Response.json({ ok: true, skipped: true });
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await entity.count({ session_hash: sessionHash, created_date: { $gte: since } });
    if (recent >= MAX_EVENTS_PER_SESSION_PER_HOUR) return Response.json({ ok: true, skipped: true });

    const resultCount = Math.max(0, Math.min(1000, Number(body.result_count) || 0));
    await entity.create({
      service_key: service.key,
      need_category: service.group,
      county_name: clean(place.county_name, 60),
      locality_name: clean(place.name, 80),
      locality_siruta_code: siruta,
      county_key: localAreaKey(place.county_name),
      analytics_version: LOCAL_INTEREST_VERSION,
      analytics_eligible: true,
      result_count: resultCount,
      zero_results: resultCount === 0,
      entry_point: ENTRY_POINTS.includes(body.entry_point) ? body.entry_point : 'formular',
      session_hash: sessionHash,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: 'search_event_unavailable' }, { status: 500 });
  }
}
