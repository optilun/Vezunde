import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STATUS_LABELS = {
  directory: 'Profil din director',
  claimed: 'Profil administrat',
  verified: 'Profil verificat de VIASEE',
};
const MAX_RESULTS = 10;
const EXCLUDED_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const norm = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const q = norm(String(p.q || '').trim().slice(0, 80));
    if (q.length < 2) return Response.json({ locations: [] });

    const [locations, organizations] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, 'name', 500),
      svc.entities.ProviderOrganization.list(null, 200),
    ]);
    const organizationNames = Object.fromEntries(organizations.map((organization) => [organization.id, organization.name]));

    const publicList = locations
      .filter((location) => location.active_status !== 'inactiva' && (location.profile_control_status || 'directory') !== 'suspended')
      .filter((location) => {
        const profileType = String(location.provider_profile_type || '').trim();
        return profileType !== '' && !EXCLUDED_PROFILE_TYPES.includes(profileType);
      })
      .filter((location) => {
        const organizationName = (location.organization_id && organizationNames[location.organization_id]) || '';
        return [location.name, location.city, location.address, organizationName].some((field) => norm(field).includes(q));
      })
      .slice(0, MAX_RESULTS)
      .map((location) => {
        const controlStatus = location.profile_control_status || 'directory';
        const controlled = ['claimed', 'verified'].includes(controlStatus) || location.claim_verification_status === 'approved';
        return {
          id: location.id,
          name: location.name,
          organization_name: (location.organization_id && organizationNames[location.organization_id]) || null,
          provider_type: location.provider_type,
          city: location.city,
          county: location.county || null,
          address: location.address || null,
          website: location.website || null,
          profile_control_status: controlStatus,
          status_label: STATUS_LABELS[controlStatus] || STATUS_LABELS.directory,
          claim_action: controlled ? 'request_access' : 'claim_profile',
        };
      });

    return Response.json({ locations: publicList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
