import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { findProviderLeadLocationMembership } from '../../shared/providerLeadLocationAccess.js';
import {
  computeLocationCompleteness,
  computeOrganizationCompleteness,
  summarizeProviderCompleteness,
} from '../../shared/providerProfileCompleteness.js';
import { loadLocationContentIndex, rowsFor } from '../../shared/providerWorkspaceBatchQueries.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function normalizeRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return ['organization_owner', 'location_manager', 'location_staff'].includes(role) ? role : '';
}

async function authorize(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  if (user.role === 'admin') return { location, memberships: [] };
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
  if (!memberships.some((membership) => membership.location_id === locationId && normalizeRole(membership.role))
    && !await findProviderLeadLocationMembership(svc, user, location)) {
    return { error: 'Nu ai acces la aceasta locatie.', status: 403 };
  }
  return { location, memberships };
}

// 2026-10-03. Continutul se citeste o singura data pentru toate locatiile (inainte, 4 interogari
// pornite deodata pentru FIECARE locatie - sute de apeluri simultane la o retea mare).
const COMPLETENESS_CONTENT_PARTS = ['services', 'specialties', 'team', 'media'];

function contentSummary(contentIndex, location) {
  const services = rowsFor(contentIndex.services, location.id);
  const specialties = rowsFor(contentIndex.specialties, location.id);
  const team = rowsFor(contentIndex.team, location.id);
  const media = rowsFor(contentIndex.media, location.id);
  return {
    approved_service_count: services.length + specialties.length,
    approved_public_team_count: team.length,
    approved_media_count: media.length,
    has_primary_photo: Boolean(location.photo_url),
    has_opening_hours: Boolean(location.opening_hours || location.opening_hours_json),
  };
}

function locationLabel(location) {
  return location.public_display_name || location.name || 'Locatie';
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const input = await req.json().catch(() => ({}));
    const locationId = String(input.location_id || '').trim();
    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);
    const svc = base44.asServiceRole;
    const authorized = await authorize(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);
    const location = authorized.location;
    const organization = location.organization_id
      ? await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null)
      : null;

    const organizationLocations = location.organization_id
      ? await svc.entities.ProviderLocation.filter({ organization_id: location.organization_id }, 'public_display_name', 200)
      : [location];
    const accessibleLocationIds = user.role === 'admin'
      ? new Set(organizationLocations.map((item) => item.id))
      : new Set((authorized.memberships || [])
        .filter((membership) => normalizeRole(membership.role))
        .map((membership) => membership.location_id));
    const accessibleLocations = organizationLocations.filter((item) => accessibleLocationIds.has(item.id));
    if (!accessibleLocations.some((item) => item.id === location.id)) accessibleLocations.unshift(location);

    const contentIndex = await loadLocationContentIndex(svc, accessibleLocations.map((item) => item.id), { parts: COMPLETENESS_CONTENT_PARTS });
    const locationRows = accessibleLocations.map((item) => {
      const content = contentSummary(contentIndex, item);
      const completion = computeLocationCompleteness({ location: item, content });
      return {
        id: item.id,
        name: locationLabel(item),
        locality: item.locality_name || item.city || '',
        profile_control_status: item.profile_control_status || item.verification_state || '',
        completion,
      };
    });

    const selectedRow = locationRows.find((item) => item.id === location.id) || locationRows[0];
    const organizationCompletion = computeOrganizationCompleteness(organization || {});
    const summary = summarizeProviderCompleteness({
      organizationCompletion,
      locationCompletions: locationRows.map((item) => item.completion),
    });
    return res({
      selected_location_id: location.id,
      summary,
      organization: organizationCompletion,
      location: selectedRow?.completion || computeLocationCompleteness({ location, content: {} }),
      locations: locationRows,
    });
  } catch (_error) {
    return res({ error: 'Completarea profilului nu a putut fi calculata.' }, 500);
  }
}