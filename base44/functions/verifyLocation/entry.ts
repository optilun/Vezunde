import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot verifica locatii' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const loc = await svc.entities.ProviderLocation.get(p.location_id);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    const now = new Date().toISOString();
    await svc.entities.ProviderLocation.update(loc.id, {
      status: 'publicata',
      profile_control_status: 'verified',
      profile_control_status_updated_at: now,
      profile_control_status_reason: p.notes || 'Locatie verificata manual de admin',
      // Legacy fields kept in sync temporarily for backward compatibility only.
      verification_state: 'verified',
      is_verified: true,
      last_verified_at: now,
    });
    await svc.entities.VerificationRecord.create({
      location_id: loc.id,
      verification_method: 'manual',
      result: 'aprobat',
      notes: p.notes || 'Locatie marcata ca verificata',
      verified_by: user.email,
      verified_at: now,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});