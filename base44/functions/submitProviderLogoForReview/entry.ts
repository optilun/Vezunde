import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MAX_DATA_URL_LENGTH = 850000;
const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return ['organization_owner', 'location_manager', 'location_staff'].includes(value) ? value : '';
}

function reject(error, status = 400) {
  return Response.json({ error }, { status });
}

function cleanImageValue(value) {
  const image = String(value || '').trim();
  if (!image) return { error: 'Imaginea lipseste' };
  if (image.startsWith('data:')) {
    if (image.length > MAX_DATA_URL_LENGTH) return { error: 'Logo-ul este prea mare. Incarca o imagine mai mica.' };
    if (!DATA_URL_RE.test(image)) return { error: 'Format logo invalid. Sunt acceptate PNG, JPG sau WEBP.' };
    return { value: image };
  }
  if (image.length > 1200) return { error: 'URL-ul imaginii este prea lung' };
  let parsed;
  try { parsed = new URL(image); } catch (_error) { return { error: 'Imagine invalida' }; }
  if (!['https:', 'http:'].includes(parsed.protocol) || /\b(?:javascript|vbscript|file):/i.test(image)) return { error: 'Imaginea trebuie sa foloseasca un URL web sigur' };
  return { value: parsed.toString() };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return reject('Autentificare necesara', 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const locationId = String(input.location_id || '').trim();
    const requestedOrganizationId = String(input.organization_id || '').trim();
    if (!locationId) return reject('location_id este obligatoriu');

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return reject('Locatia nu a fost gasita', 404);
    const organizationId = location.organization_id || requestedOrganizationId;
    if (!organizationId || (requestedOrganizationId && requestedOrganizationId !== organizationId)) return reject('Organizatia nu corespunde locatiei', 403);
    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    if (!organization) return reject('Organizatia nu a fost gasita', 404);

    const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, organization_id: organizationId, status: 'active' }, '-created_date', 500);
    if (user.role !== 'admin' && !memberships.some((membership) => normalizeRole(membership.role) === 'organization_owner')) {
      return reject('Doar ownerul organizatiei poate schimba logo-ul', 403);
    }
    if ((location.profile_control_status || '') === 'suspended' || location.status === 'suspendata') return reject('Profilul este suspendat', 403);
    if (location.claim_verification_status !== 'approved') return reject('Logo-ul poate fi trimis dupa aprobarea revendicarii', 403);
    if (organization.logo_review_status === 'pending_review') return reject('Exista deja un logo in verificare', 409);

    const cleaned = cleanImageValue(input.photo_url);
    if (cleaned.error) return reject(cleaned.error);

    let pending = {};
    try { pending = location.pending_changes ? JSON.parse(location.pending_changes) : {}; } catch (_error) { pending = {}; }
    const now = new Date().toISOString();
    const fields = { ...(pending.fields || {}), photo_url: cleaned.value };
    const nextPending = {
      ...pending,
      organization_id: organizationId,
      fields,
      media_review: {
        ...(pending.media_review || {}),
        target_type: 'organization_logo',
        organization_id: organizationId,
        logo_submitted_by_user_id: user.id,
        logo_submitted_at: now,
        logo_status: 'pending_review',
      },
    };

    await Promise.all([
      svc.entities.ProviderLocation.update(location.id, { pending_changes: JSON.stringify(nextPending) }),
      svc.entities.ProviderOrganization.update(organizationId, {
        logo_review_status: 'pending_review',
        logo_review_submitted_at: now,
        logo_reviewed_at: null,
        logo_review_note: '',
        logo_review_location_id: location.id,
      }),
    ]);
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderOrganization',
      entity_id: organizationId,
      action_type: 'provider_organization_logo_submitted_for_review',
      changed_fields: ['logo_url', 'logo_review_status'],
      previous_values: JSON.stringify({ logo_url: organization.logo_url || '', logo_review_status: organization.logo_review_status || 'none' }),
      new_values: JSON.stringify({ staged_on_location_id: location.id, logo_url: cleaned.value, logo_review_status: 'pending_review' }),
      admin_user_id: user.id,
      admin_email: user.email,
      note: 'Logo organizational trimis separat spre review admin',
      performed_at: now,
    });

    return Response.json({ success: true, pending_logo_review: true, organization_id: organizationId, logo_review_status: 'pending_review' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
