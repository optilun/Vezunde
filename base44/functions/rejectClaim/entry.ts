import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot respinge cereri' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.claim_request_id) return Response.json({ error: 'claim_request_id este obligatoriu' }, { status: 400 });

    const claim = await svc.entities.ProviderClaimRequest.get(p.claim_request_id);
    if (!claim) return Response.json({ error: 'Cererea nu a fost gasita' }, { status: 404 });
    if (claim.status !== 'in_asteptare') return Response.json({ error: 'Cererea a fost deja analizata' }, { status: 400 });

    const now = new Date().toISOString();

    if (claim.location_id) {
      await svc.entities.VerificationRecord.create({
        location_id: claim.location_id,
        claim_request_id: claim.id,
        verification_method: 'manual',
        result: 'respins',
        notes: p.notes || '',
        verified_by: user.email,
        verified_at: now,
      });
      // New locations that were rejected stay hidden as drafts.
      if (claim.mode === 'new_location') {
        await svc.entities.ProviderLocation.update(claim.location_id, { status: 'draft' });
      }
    }

    await svc.entities.ProviderClaimRequest.update(claim.id, {
      status: 'respinsa',
      reviewed_at: now,
      review_notes: p.notes || '',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});