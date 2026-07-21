import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function text(value: unknown) {
  return String(value || '').trim();
}

function normalizeRole(value: unknown) {
  if (value === 'owner') return 'organization_owner';
  return text(value);
}

function safeImageUrl(value: unknown) {
  const raw = text(value);
  if (!raw || raw.length > 4000 || /\s/.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (!parsed.hostname || parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

function looksLikeLogo(value: unknown) {
  const imageUrl = safeImageUrl(value);
  if (!imageUrl) return false;
  try {
    return /logo|sigla|brandmark/i.test(decodeURIComponent(new URL(imageUrl).pathname));
  } catch (_error) {
    return /logo|sigla|brandmark/i.test(imageUrl);
  }
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return response({ error: 'Autentificare necesara' }, 401);

    const input = await req.json().catch(() => ({}));
    const locationId = text(input.location_id);
    if (!locationId) return response({ error: 'location_id este obligatoriu' }, 400);

    const svc = base44.asServiceRole;
    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return response({ error: 'Locatia nu a fost gasita' }, 404);

    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: locationId,
      status: 'active',
    }, '-created_date', 20);
    const isOwner = memberships.some((membership: any) => normalizeRole(membership.role) === 'organization_owner');
    if (user.role !== 'admin' && !isOwner) return response({ error: 'Doar ownerul organizatiei poate pastra logo-ul' }, 403);

    const organizationId = text(location.organization_id);
    if (!organizationId) return response({ error: 'Locatia nu este asociata unei organizatii' }, 409);

    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    if (!organization) return response({ error: 'Organizatia nu a fost gasita' }, 404);

    const existingLogo = safeImageUrl(organization.logo_url);
    if (existingLogo) {
      return response({ success: true, preserved: false, reason: 'organization_logo_already_exists', logo_url: existingLogo });
    }

    const legacyImage = safeImageUrl(location.photo_url);
    if (!legacyImage || !looksLikeLogo(legacyImage)) {
      return response({ success: true, preserved: false, reason: 'no_legacy_logo_detected' });
    }

    const now = new Date().toISOString();
    await svc.entities.ProviderOrganization.update(organization.id, {
      logo_url: legacyImage,
      profile_updated_at: now,
    });

    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderOrganization',
      entity_id: organization.id,
      action_type: 'preserve_legacy_location_logo',
      changed_fields: ['logo_url'],
      previous_values: JSON.stringify({ logo_present: false }),
      new_values: JSON.stringify({ logo_present: true, source_location_id: location.id }),
      admin_user_id: user.id,
      admin_email: user.email || '',
      note: 'Logo-ul vechi a fost copiat automat din fotografia locatiei in profilul organizatiei. Fotografia locatiei nu a fost modificata.',
      performed_at: now,
    });

    return response({ success: true, preserved: true, logo_url: legacyImage });
  } catch (error) {
    return response({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
}
