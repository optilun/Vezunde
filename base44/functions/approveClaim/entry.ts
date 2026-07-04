import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot aproba cereri' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.claim_request_id) return Response.json({ error: 'claim_request_id este obligatoriu' }, { status: 400 });

    const claim = await svc.entities.ProviderClaimRequest.get(p.claim_request_id);
    if (!claim) return Response.json({ error: 'Cererea nu a fost gasita' }, { status: 404 });
    if (claim.status !== 'in_asteptare') return Response.json({ error: 'Cererea a fost deja analizata' }, { status: 400 });

    const now = new Date().toISOString();

    if (claim.location_id) {
      await svc.entities.ProviderLocation.update(claim.location_id, {
        status: 'publicata',
        profile_control_status: 'verified',
        claim_verification_status: 'approved',
        profile_control_status_updated_at: now,
        profile_control_status_reason: 'Cerere de revendicare aprobata manual',
        // Legacy fields kept in sync temporarily for backward compatibility only.
        verification_state: 'verified',
        is_verified: true,
        last_verified_at: now,
      });
      // Provider-declared services become provider_confirmed on claim approval.
      // Specialized medical services remain gated by vezunde_verified in matching.
      const locServices = await svc.entities.LocationService.filter({ location_id: claim.location_id });
      for (const s of locServices) {
        if (s.is_active === false) continue;
        await svc.entities.LocationService.update(s.id, {
          confirmation_level: s.confirmation_level === 'vezunde_verified' ? 'vezunde_verified' : 'provider_confirmed',
          service_confirmed_at: now,
          matching_allowed: true,
        });
      }
      // First approved claimant becomes owner
      const existingMembers = await svc.entities.ProviderMembership.filter({
        location_id: claim.location_id, status: 'active',
      });
      const membership = {
        user_id: claim.user_id,
        location_id: claim.location_id,
        role: existingMembers.length === 0 ? 'owner' : 'staff',
        status: 'active',
      };
      if (claim.organization_id) membership.organization_id = claim.organization_id;
      await svc.entities.ProviderMembership.create(membership);

      await svc.entities.VerificationRecord.create({
        location_id: claim.location_id,
        claim_request_id: claim.id,
        verification_method: 'manual',
        result: 'aprobat',
        notes: p.notes || '',
        verified_by: user.email,
        verified_at: now,
      });
    }

    await svc.entities.ProviderClaimRequest.update(claim.id, {
      status: 'aprobata',
      reviewed_at: now,
      review_notes: p.notes || '',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});