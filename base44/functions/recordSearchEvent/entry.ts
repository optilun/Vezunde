import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Inregistreaza o cautare anonima. Pastreaza doar campurile permise: fara nume,
// email, telefon, IP, ID de cont sau text liber. Nu influenteaza cautarea.
const MAX_EVENTS_PER_SESSION_PER_HOUR = 30;
const ENTRY_POINTS = ['formular', 'harta', 'ghid'];
const clean = (value, max = 80) => String(value || '').trim().slice(0, max);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sessionHash = clean(body.session_hash, 64);
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(sessionHash)) {
      return Response.json({ error: 'invalid_session' }, { status: 400 });
    }

    const entity = base44.asServiceRole.entities.PatientSearchEvent;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await entity.count({ session_hash: sessionHash, created_date: { $gte: since } });
    if (recent >= MAX_EVENTS_PER_SESSION_PER_HOUR) return Response.json({ ok: true, skipped: true });

    const resultCount = Math.max(0, Math.min(1000, Number(body.result_count) || 0));
    await entity.create({
      service_key: clean(body.service_key),
      need_category: clean(body.need_category, 40),
      county_name: clean(body.county_name, 60),
      locality_name: clean(body.locality_name, 80),
      result_count: resultCount,
      zero_results: resultCount === 0,
      entry_point: ENTRY_POINTS.includes(body.entry_point) ? body.entry_point : 'formular',
      session_hash: sessionHash,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}