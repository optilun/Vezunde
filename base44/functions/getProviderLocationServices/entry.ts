import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    return Response.json({
      location_id: locationId,
      service_keys: [...new Set(services.map((service) => cleanString(service.service_key)).filter(Boolean))],
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
