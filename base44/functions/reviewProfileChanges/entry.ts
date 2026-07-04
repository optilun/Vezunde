import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STAGED_FIELDS = ['name', 'address', 'city', 'county', 'phone_public', 'public_email', 'website', 'description', 'provider_type'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot analiza modificari' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id || !['aproba', 'respinge'].includes(p.decision)) {
      return Response.json({ error: 'location_id si decision (aproba/respinge) sunt obligatorii' }, { status: 400 });
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (!loc.pending_changes) return Response.json({ error: 'Locatia nu are modificari in asteptare' }, { status: 400 });

    let changes = {};
    try { changes = JSON.parse(loc.pending_changes); } catch (_e) { changes = {}; }
    const now = new Date().toISOString();

    if (p.decision === 'aproba') {
      const upd = { pending_changes: '' };
      const fields = changes.fields || {};
      for (const k of STAGED_FIELDS) {
        if (fields[k] !== undefined) upd[k] = fields[k];
      }
      await svc.entities.ProviderLocation.update(loc.id, upd);

      if (Array.isArray(changes.services)) {
        await svc.entities.LocationService.deleteMany({ location_id: loc.id });
        if (changes.services.length > 0) {
          await svc.entities.LocationService.bulkCreate(
            changes.services.map((k) => ({ location_id: loc.id, service_key: k, is_active: true, accepts_requests: true }))
          );
        }
      }
      if (Array.isArray(changes.specializations)) {
        await svc.entities.LocationSpecialization.deleteMany({ location_id: loc.id });
        if (changes.specializations.length > 0) {
          await svc.entities.LocationSpecialization.bulkCreate(
            changes.specializations.map((k) => ({ location_id: loc.id, specialization_key: k, is_active: true }))
          );
        }
      }
      if (Array.isArray(changes.facilities)) {
        await svc.entities.LocationFacility.deleteMany({ location_id: loc.id });
        if (changes.facilities.length > 0) {
          await svc.entities.LocationFacility.bulkCreate(
            changes.facilities.map((k) => ({ location_id: loc.id, facility_key: k, is_active: true }))
          );
        }
      }
    } else {
      await svc.entities.ProviderLocation.update(loc.id, { pending_changes: '' });
    }

    await svc.entities.VerificationRecord.create({
      location_id: loc.id,
      verification_method: 'manual',
      result: p.decision === 'aproba' ? 'aprobat' : 'respins',
      notes: 'Modificari profil: ' + (p.notes || (p.decision === 'aproba' ? 'aprobate' : 'respinse')),
      verified_by: user.email,
      verified_at: now,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});