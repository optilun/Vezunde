import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public, read-only discovery lookup used before provider authentication.
// Output is deliberately whitelisted and capped; no membership, claim, audit,
// provenance, service or private contact data is returned.
const STATUS_LABELS = {
  directory: 'Profil din director',
  claimed: 'Profil administrat',
  verified: 'Locatie verificata',
};
const MAX_RESULTS = 10;
const EXCLUDED_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const CONTROLLED_STATUSES = new Set(['claimed', 'verified']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    const q = norm(String(p.q || '').trim().slice(0, 80));
    if (q.length < 2) return Response.json({ locations: [] });

    const [locations, orgs] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, 'name', 500),
      svc.entities.ProviderOrganization.list(null, 200),
    ]);
    const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.public_display_name || o.name]));

    const publicList = locations
      .filter((l) => l.active_status !== 'inactiva' && (l.profile_control_status || 'directory') !== 'suspended')
      .filter((l) => {
        const t = String(l.provider_profile_type || '').trim();
        return t !== '' && !EXCLUDED_PROFILE_TYPES.includes(t);
      })
      .filter((l) => {
        const orgName = (l.organization_id && orgNames[l.organization_id]) || '';
        return [l.name, l.public_display_name, l.city, l.locality_name, l.address, orgName].some((f) => norm(f).includes(q));
      })
      .slice(0, MAX_RESULTS)
      .map((l) => {
        const controlStatus = l.profile_control_status || 'directory';
        const controlled = CONTROLLED_STATUSES.has(controlStatus) || l.claim_verification_status === 'approved';
        return {
          id: l.id,
          name: l.public_display_name || l.name,
          organization_name: (l.organization_id && orgNames[l.organization_id]) || null,
          provider_type: l.provider_type,
          provider_profile_type: l.provider_profile_type,
          city: l.locality_name || l.city,
          county: l.county_name || l.county || null,
          address: l.address || null,
          website: l.website_url || l.website || null,
          profile_control_status: controlStatus,
          status_label: STATUS_LABELS[controlStatus] || STATUS_LABELS.directory,
          claim_action: controlled ? 'request_access' : 'claim',
          action_label: controlled ? 'Solicita acces' : 'Revendica profilul',
        };
      });

    return Response.json({ locations: publicList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
