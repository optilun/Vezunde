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

    // Grupare pe organizatie (2026-08-18): daca brandul potrivit are mai multe locatii
    // mapate, il aratam ca rezultat propriu, ca sa poti porni direct de la organizatie
    // in loc sa cauti locatie cu locatie. Nu se schimba nicio regula de acces sau
    // aprobare - aria efectiva se confirma tot la pasul "Alege accesul".
    const claimableByOrganization = new Map();
    for (const location of locations) {
      const organizationId = String(location.organization_id || '').trim();
      if (!organizationId || !organizationNames[organizationId]) continue;
      if (location.active_status === 'inactiva') continue;
      if ((location.profile_control_status || 'directory') === 'suspended') continue;
      const profileType = String(location.provider_profile_type || '').trim();
      if (profileType === '' || EXCLUDED_PROFILE_TYPES.includes(profileType)) continue;
      if (!claimableByOrganization.has(organizationId)) claimableByOrganization.set(organizationId, []);
      claimableByOrganization.get(organizationId).push(location);
    }

    const matchedOrganizationIds = new Set();
    for (const organization of organizations) {
      if (norm(organization.name).includes(q) || norm(organization.public_display_name).includes(q)) {
        matchedOrganizationIds.add(organization.id);
      }
    }
    for (const location of publicList) {
      const source = locations.find((row) => row.id === location.id);
      if (source?.organization_id) matchedOrganizationIds.add(source.organization_id);
    }

    const organizationResults = organizations
      .filter((organization) => matchedOrganizationIds.has(organization.id))
      .map((organization) => {
        const organizationLocations = claimableByOrganization.get(organization.id) || [];
        return {
          id: organization.id,
          name: organization.public_display_name || organization.name,
          organization_type: organization.organization_type_code || organization.organization_type || null,
          location_count: organizationLocations.length,
          cities: [...new Set(organizationLocations.map((row) => row.city).filter(Boolean))].slice(0, 6),
          primary_location_id: organizationLocations[0]?.id || null,
          locations: organizationLocations.slice(0, 25).map((row) => ({
            id: row.id,
            name: row.name,
            city: row.city,
            address: row.address || null,
          })),
        };
      })
      .filter((organization) => organization.location_count > 1)
      .slice(0, 5);

    return Response.json({ locations: publicList, organizations: organizationResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});