import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeServiceKey } from '../../../shared/canonicalServiceRegistryExtended.js';

function cleanString(value) {
  return String(value || '').trim();
}

function sanitizeLocation(location) {
  return {
    id: location.id,
    name: location.name || '',
    public_display_name: location.public_display_name || '',
    city: location.city || location.locality_name || '',
    county: location.county || location.county_name || '',
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    profile_control_status: location.profile_control_status || 'directory',
    status: location.status || 'draft',
  };
}

function sanitizeService(service) {
  const normalized = normalizeServiceKey(service.service_key);
  const definition = normalized.definition;
  return {
    id: service.id,
    location_id: service.location_id,
    service_key: service.service_key || '',
    canonical_key: normalized.canonicalKey,
    catalog_status: normalized.status,
    canonical_label: definition?.label || null,
    canonical_group: definition?.group || null,
    kind: definition?.kind || null,
    requires_review: definition?.requires_review ?? true,
    requires_verified_specialist: definition?.requires_verified_specialist ?? true,
    requires_equipment: definition?.requires_equipment ?? true,
    requires_infrastructure: definition?.requires_infrastructure ?? true,
    accepts_requests: service.accepts_requests !== false,
    is_active: service.is_active !== false,
    notes: service.notes || '',
    confirmation_level: service.confirmation_level || 'not_confirmed',
    service_need_level: definition?.service_need_level || service.service_need_level || 'unknown',
    is_advanced_service: service.is_advanced_service === true,
    matching_allowed: service.matching_allowed === true,
    migration_review_required: service.migration_review_required === true,
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces permis doar administratorilor Vezunde' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const locationId = cleanString(payload.location_id);
    const svc = base44.asServiceRole;

    const rawLocations = await svc.entities.ProviderLocation.list('name', 500);
    const locations = rawLocations.map(sanitizeLocation);

    if (!locationId) {
      return Response.json({ locations, services: [] });
    }

    const location = rawLocations.find((item) => item.id === locationId)
      || await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    const services = await svc.entities.LocationService.filter({ location_id: locationId }, 'service_key', 500);
    return Response.json({
      locations,
      selected_location: sanitizeLocation(location),
      services: services.map(sanitizeService),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
