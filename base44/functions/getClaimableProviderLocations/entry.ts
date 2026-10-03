import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { deriveCanonicalDirectoryState } from '../../shared/directoryCanonicalModel.js';

const STATUS_LABELS = {
  directory: 'Profil din director',
  claimed: 'Profil administrat',
  verified: 'Profil verificat de VIASEE',
};
const MAX_RESULTS = 10;
const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const CACHE_MS = 60_000;
let cachedIndex = null;
let indexPromise = null;

async function allPages(entity, query = null) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = query
      ? await entity.filter(query, 'name', PAGE_SIZE, page * PAGE_SIZE)
      : await entity.list('name', PAGE_SIZE, page * PAGE_SIZE);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error('Directorul este prea mare pentru cautarea curenta.');
}

async function searchIndex(svc) {
  if (cachedIndex && Date.now() - cachedIndex.at < CACHE_MS) return cachedIndex;
  if (!indexPromise) {
    indexPromise = Promise.all([
      allPages(svc.entities.ProviderLocation, { status: 'publicata' }),
      allPages(svc.entities.ProviderOrganization),
    ]).then(([locations, organizations]) => {
      cachedIndex = { at: Date.now(), locations, organizations };
      return cachedIndex;
    }).finally(() => { indexPromise = null; });
  }
  return indexPromise;
}

const EXCLUDED_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const norm = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const q = norm(String(p.q || '').trim().slice(0, 80));
    if (q.length < 2) return Response.json({ locations: [], organizations: [] });

    const { locations, organizations } = await searchIndex(svc);
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
    const organizationName = (location) => {
      const organization = organizationById.get(location.organization_id);
      return organization?.public_display_name || organization?.name || null;
    };
    const projectLocation = (location) => {
      const controlStatus = location.profile_control_status || 'directory';
      const controlled = ['claimed', 'verified'].includes(controlStatus) || location.claim_verification_status === 'approved';
      return {
        id: location.id,
        name: location.name,
        organization_id: location.organization_id || null,
        organization_name: organizationName(location),
        provider_type: location.provider_type,
        city: location.city,
        county: location.county || null,
        address: location.address || null,
        website: location.website || null,
        profile_control_status: controlStatus,
        status_label: STATUS_LABELS[controlStatus] || STATUS_LABELS.directory,
        claim_action: controlled ? 'request_access' : 'claim_profile',
      };
    };

    // Aceeași poartă de publicare pentru rezultate individuale și locațiile organizației.
    // Numărul organizației folosește directorul complet, fără limita sugestiilor individuale.
    const eligibleLocations = locations
      .filter((location) => deriveCanonicalDirectoryState(location).is_publicly_available === true)
      .filter((location) => location.active_status !== 'inactiva' && (location.profile_control_status || 'directory') !== 'suspended')
      .filter((location) => {
        const profileType = String(location.provider_profile_type || '').trim();
        return profileType !== '' && !EXCLUDED_PROFILE_TYPES.includes(profileType);
      });
    const matchingLocations = eligibleLocations.filter((location) => {
      const organization = organizationById.get(location.organization_id);
      return [location.name, location.city, location.address, organization?.name, organization?.public_display_name]
        .some((field) => norm(field).includes(q));
    });
    const publicList = matchingLocations.slice(0, MAX_RESULTS).map(projectLocation);

    const claimableByOrganization = new Map();
    for (const location of eligibleLocations) {
      const organizationId = String(location.organization_id || '').trim();
      if (!organizationId || !organizationById.has(organizationId)) continue;
      if (!claimableByOrganization.has(organizationId)) claimableByOrganization.set(organizationId, []);
      claimableByOrganization.get(organizationId).push(location);
    }

    const matchedOrganizationIds = new Set(matchingLocations.map((location) => location.organization_id).filter(Boolean));
    for (const organization of organizations) {
      if (norm(organization.name).includes(q) || norm(organization.public_display_name).includes(q)) {
        matchedOrganizationIds.add(organization.id);
      }
    }
    const matchingLocationIds = new Set(matchingLocations.map((location) => location.id));
    const organizationRank = (organization) => {
      const names = [norm(organization.name), norm(organization.public_display_name)].filter(Boolean);
      if (names.some((name) => name === q)) return 0;
      if (names.some((name) => name.startsWith(q))) return 1;
      if (names.some((name) => name.includes(q))) return 2;
      return 3;
    };

    // Organizațiile apar înaintea locațiilor în ambele căutări de revendicare.
    // Solicitarea nu acordă automat acces; aria se confirmă și se verifică în pașii următori.
    const organizationResults = organizations
      .filter((organization) => organization.status !== 'inactiva' && matchedOrganizationIds.has(organization.id))
      .filter((organization) => (claimableByOrganization.get(organization.id)?.length || 0) > 1)
      .sort((a, b) => organizationRank(a) - organizationRank(b) || norm(a.public_display_name || a.name).localeCompare(norm(b.public_display_name || b.name)))
      .slice(0, 5)
      .map((organization) => {
        const organizationLocations = claimableByOrganization.get(organization.id);
        const primary = organizationLocations.find((location) => matchingLocationIds.has(location.id)) || organizationLocations[0];
        return {
          id: organization.id,
          name: organization.public_display_name || organization.name,
          organization_type: organization.organization_type_code || organization.organization_type || null,
          location_count: organizationLocations.length,
          cities: [...new Set(organizationLocations.map((row) => row.city).filter(Boolean))].slice(0, 6),
          primary_location_id: primary.id,
          locations: organizationLocations.map(projectLocation),
        };
      });

    return Response.json({ locations: publicList, organizations: organizationResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});