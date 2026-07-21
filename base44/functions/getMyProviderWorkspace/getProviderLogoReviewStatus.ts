import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function res(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function clean(value: unknown, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeRole(value: unknown) {
  const role = clean(value, 80);
  if (role === 'owner') return 'organization_owner';
  return role;
}

function parseJson(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = clean(payload.location_id, 120);
    const requestedOrganizationId = clean(payload.organization_id, 120);
    if (!locationId && !requestedOrganizationId) return res({ error: 'location_id sau organization_id este obligatoriu' }, 400);

    const location = locationId
      ? await svc.entities.ProviderLocation.get(locationId).catch(() => null)
      : null;
    const organizationId = location?.organization_id || requestedOrganizationId;
    if (!organizationId) return res({ error: 'Organizatia nu a fost gasita' }, 404);
    if (requestedOrganizationId && requestedOrganizationId !== organizationId) return res({ error: 'Organizatia nu corespunde locatiei' }, 403);

    if (user.role !== 'admin') {
      const memberships = await svc.entities.ProviderMembership.filter({
        user_id: user.id,
        organization_id: organizationId,
        status: 'active',
      }, '-created_date', 500);
      if (!memberships.some((membership: any) => normalizeRole(membership.role) === 'organization_owner')) {
        return res({ error: 'Doar ownerul organizatiei poate vedea starea logo-ului' }, 403);
      }
    }

    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    if (!organization) return res({ error: 'Organizatia nu a fost gasita' }, 404);

    let pendingLogoUrl = '';
    let pendingLocationId = organization.logo_review_location_id || '';
    if (organization.logo_review_status === 'pending_review') {
      const candidates = pendingLocationId
        ? [await svc.entities.ProviderLocation.get(pendingLocationId).catch(() => null)]
        : await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-updated_date', 100);
      for (const candidate of candidates.filter(Boolean)) {
        const pending = parseJson(candidate.pending_changes);
        if (pending.media_review?.target_type !== 'organization_logo') continue;
        const value = clean(pending.fields?.photo_url, 5000);
        if (!value) continue;
        pendingLogoUrl = value;
        pendingLocationId = candidate.id;
        break;
      }
    }

    return res({
      organization_id: organizationId,
      status: organization.logo_review_status || (pendingLogoUrl ? 'pending_review' : 'none'),
      submitted_at: organization.logo_review_submitted_at || null,
      reviewed_at: organization.logo_reviewed_at || null,
      note: organization.logo_review_note || '',
      location_id: pendingLocationId || null,
      has_pending_logo: Boolean(pendingLogoUrl),
      pending_logo_url: pendingLogoUrl,
      published_logo_url: organization.logo_url || '',
      profile_review_is_separate: true,
    });
  } catch (error) {
    return res({ error: error instanceof Error ? error.message : 'Eroare neasteptata' }, 500);
  }
}

