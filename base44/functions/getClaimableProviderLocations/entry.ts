import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E.2.1: PUBLIC read-only claim-discovery lookup for specialist onboarding.
// Specialists may search before login; login is required only when they choose to claim a location.
// Strict whitelist output - never provenance, trust, migration, legacy verification,
// claims, memberships, audit, services, specializations, facilities or notes.
// Abuse protection: a search term is REQUIRED (min 2 chars, capped at 80),
// results are capped - the endpoint can never export the whole directory.
const STATUS_LABELS = {
  directory: 'Profil din director',
  claimed: 'Profil revendicat',
  verified: 'Verificat de Vezunde',
};
const MAX_RESULTS = 10;
// Module 3H.1B.2: B2B-only profiles and unclassified locations are never claim-discoverable.
const EXCLUDED_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isClaimablePublicLocation = (l) => {
  if (!l) return false;
  if (l.status !== 'publicata') return false;
  if (l.active_status === 'inactiva') return false;
  if ((l.profile_control_status || 'directory') === 'suspended') return false;
  const t = String(l.provider_profile_type || '').trim();
  return t !== '' && !EXCLUDED_PROFILE_TYPES.includes(t);
};

const toPublicLocation = (l, orgNames) => ({
  id: l.id,
  name: l.name,
  organization_name: (l.organization_id && orgNames[l.organization_id]) || null,
  provider_type: l.provider_type,
  city: l.locality_name || l.city,
  county: l.county_name || l.county || null,
  locality_name: l.locality_name || l.city || null,
  address: l.address || null,
  website: l.website || null,
  status_label: STATUS_LABELS[l.profile_control_status || 'directory'] || STATUS_LABELS.directory,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const locationId = String(p.location_id || p.selectedLocationId || '').trim();

    if (locationId) {
      const [loc, orgs] = await Promise.all([
        svc.entities.ProviderLocation.get(locationId).catch(() => null),
        svc.entities.ProviderOrganization.list(null, 200),
      ]);
      if (!isClaimablePublicLocation(loc)) return Response.json({ locations: [] });
      const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      return Response.json({ locations: [toPublicLocation(loc, orgNames)] });
    }

    const q = norm(String(p.q || '').trim().slice(0, 80));
    if (q.length < 2) return Response.json({ locations: [] });

    const [locations, orgs] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, 'name', 500),
      svc.entities.ProviderOrganization.list(null, 200),
    ]);
    const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    const publicList = locations
      .filter(isClaimablePublicLocation)
      .filter((l) => {
        const orgName = (l.organization_id && orgNames[l.organization_id]) || '';
        return [l.name, l.city, l.locality_name, l.address, orgName].some((f) => norm(f).includes(q));
      })
      .slice(0, MAX_RESULTS)
      .map((l) => toPublicLocation(l, orgNames));

    return Response.json({ locations: publicList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
