import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeServiceKey } from '../../../shared/canonicalServiceRegistry.js';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const locationId = cleanString(payload.location_id);
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const svc = base44.asServiceRole;
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: locationId,
      status: 'active',
    });
    if (!memberships.some((membership) => normalizeMemberRole(membership.role))) {
      return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
    }

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (location.profile_control_status === 'suspended') {
      return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });
    }

    const services = await svc.entities.LocationService.filter(
      { location_id: locationId, is_active: true },
      'service_key',
      500,
    );

    const existingServices = services.map((service) => {
      const rawKey = cleanString(service.service_key);
      const normalized = normalizeServiceKey(rawKey);
      return {
        id: service.id,
        raw_key: rawKey,
        canonical_key: normalized.canonicalKey,
        catalog_status: normalized.status,
        label: normalized.definition?.label || cleanString(service.label) || rawKey,
        group: normalized.definition?.group || null,
        confirmation_level: service.confirmation_level || 'not_confirmed',
        service_need_level: normalized.definition?.service_need_level || service.service_need_level || 'unknown',
        matching_allowed: service.matching_allowed === true,
        migration_review_required: service.migration_review_required === true,
      };
    });

    // Only rows already stored with canonical keys populate the canonical selector.
    // Legacy mappings stay visible separately and are never converted implicitly.
    const serviceKeys = [...new Set(existingServices
      .filter((service) => service.catalog_status === 'canonical')
      .map((service) => service.canonical_key)
      .filter(Boolean))];
    const legacyOrUnknown = existingServices.filter((service) => service.catalog_status !== 'canonical');

    return Response.json({
      location_id: locationId,
      service_keys: serviceKeys,
      existing_services: existingServices,
      legacy_or_unknown_services: legacyOrUnknown,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
