import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canAccessProviderLeadInbox } from '../../shared/providerLeadInboxPolicy.js';
import { resolveProviderEntitlement } from '../../shared/providerEntitlementPolicy.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

async function authorizeLocation(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  if (user.role === 'admin') return { location };

  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  if (!memberships.some((membership) => canAccessProviderLeadInbox(membership?.role))) {
    return { error: 'Nu ai acces la planul acestei locatii.', status: 403 };
  }
  return { location };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const locationId = clean(input.location_id, 120);
    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);

    const authorized = await authorizeLocation(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    const subscriptions = await svc.entities.ProviderSubscription.filter({
      location_id: locationId,
    }, '-created_date', 100);
    const entitlement = resolveProviderEntitlement(subscriptions);

    return res({
      location: {
        id: authorized.location.id,
        name: authorized.location.public_display_name || authorized.location.name || 'Locatie',
      },
      entitlement,
    });
  } catch (_error) {
    return res({ error: 'Planul locatiei nu a putut fi verificat.' }, 500);
  }
}
