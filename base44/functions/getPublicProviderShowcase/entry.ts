import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E.1: public whitelist endpoint for the homepage showcase.
// Only verified, published, active locations; only public-safe fields.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const locations = await svc.entities.ProviderLocation.filter(
      { status: 'publicata', profile_control_status: 'verified' }, '-updated_date', 20
    );
    const publicList = locations
      .filter((l) => l.active_status !== 'inactiva')
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        name: l.name,
        provider_type: l.provider_type,
        city: l.city,
        county: l.county || null,
        photo_url: l.photo_url || null,
        profile_control_status: 'verified',
        status_label: 'Profil verificat de Vezunde',
      }));
    return Response.json({ locations: publicList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});