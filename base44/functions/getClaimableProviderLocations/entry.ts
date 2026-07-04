import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E.2: onboarding-only whitelist search source. Authenticated users get
// ONLY the minimum public-safe fields needed to find and claim a location —
// never provenance, trust, migration, claim, membership or capability data.
const STATUS_LABELS = {
  directory: 'Profil din director',
  claimed: 'Profil revendicat',
  verified: 'Verificat de Vezunde',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;

    const [locations, orgs] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, 'name', 500),
      svc.entities.ProviderOrganization.list(null, 200),
    ]);
    const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    const publicList = locations
      .filter((l) => l.active_status !== 'inactiva' && (l.profile_control_status || 'directory') !== 'suspended')
      .map((l) => ({
        id: l.id,
        name: l.name,
        organization_name: (l.organization_id && orgNames[l.organization_id]) || null,
        provider_type: l.provider_type,
        city: l.city,
        county: l.county || null,
        address: l.address || null,
        website: l.website || null,
        status_label: STATUS_LABELS[l.profile_control_status || 'directory'] || STATUS_LABELS.directory,
      }));

    return Response.json({ locations: publicList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});