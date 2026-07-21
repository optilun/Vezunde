import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value ?? '').trim(); }

function computeCompleteness(organization, locations) {
  const items = [
    !!clean(organization.public_display_name),
    !!clean(organization.public_description),
    !!(clean(organization.public_phone) || clean(organization.public_email)),
    !!(
      clean(organization.website_url || organization.website)
      || clean(organization.facebook_url)
      || clean(organization.instagram_url)
      || clean(organization.linkedin_url)
    ),
    !!clean(organization.logo_url),
    locations.some((location) => location.active_status !== 'inactiva' && location.status !== 'suspendata'),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    if (user.role !== 'admin') return res({ error: 'Doar administratorii pot rula backfill-ul' }, 403);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const organizationId = clean(input.organization_id);
    const sourceLocationId = clean(input.source_location_id);
    const dryRun = input.dry_run !== false;
    if (!organizationId) return res({ error: 'organization_id este obligatoriu' }, 400);

    const organization = await svc.entities.ProviderOrganization.get(organizationId).catch(() => null);
    if (!organization) return res({ error: 'Organizatia nu a fost gasita' }, 404);
    const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    let sourceLocation = sourceLocationId ? locations.find((location) => location.id === sourceLocationId) || null : null;
    if (!sourceLocation) sourceLocation = locations.find((location) => location.profile_control_status === 'verified') || locations[0] || null;
    if (!sourceLocation || sourceLocation.organization_id !== organizationId) return res({ error: 'Locatia sursa nu apartine organizatiei' }, 400);

    const candidates = {
      public_display_name: sourceLocation.public_display_name || sourceLocation.name || '',
      public_description: sourceLocation.public_description || sourceLocation.description || '',
      public_phone: sourceLocation.public_phone || sourceLocation.phone_public || '',
      public_email: sourceLocation.public_email || '',
      website_url: sourceLocation.website_url || sourceLocation.website || '',
      facebook_url: sourceLocation.facebook_url || '',
      instagram_url: sourceLocation.instagram_url || '',
      linkedin_url: sourceLocation.linkedin_url || '',
    };
    const updates = {};
    for (const [key, value] of Object.entries(candidates)) {
      if (!clean(organization[key]) && clean(value)) updates[key] = clean(value);
    }
    const preview = { ...organization, ...updates };
    updates.profile_completeness = computeCompleteness(preview, locations);
    if (Object.keys(updates).length > 1) {
      updates.profile_updated_at = new Date().toISOString();
      if (organization.public_visibility_status === 'draft' && sourceLocation.status === 'publicata') updates.public_visibility_status = 'approved';
    }

    const warnings = [];
    if (!clean(organization.logo_url)) warnings.push('Logo-ul nu este migrat din fotografia locatiei. Se gestioneaza separat din Profil public.');

    if (dryRun) return res({ dry_run: true, organization_id: organizationId, source_location_id: sourceLocation.id, updates, warnings });
    if (Object.keys(updates).length === 1 && Object.prototype.hasOwnProperty.call(updates, 'profile_completeness') && organization.profile_completeness === updates.profile_completeness) {
      return res({ success: true, changed: false, updates: {}, warnings });
    }

    await svc.entities.ProviderOrganization.update(organizationId, updates);
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderOrganization',
      entity_id: organizationId,
      action_type: 'backfill_organization_profile_from_location',
      changed_fields: Object.keys(updates),
      previous_values: JSON.stringify(Object.fromEntries(Object.keys(updates).map((key) => [key, organization[key] ?? null]))),
      new_values: JSON.stringify(updates),
      admin_user_id: user.id,
      admin_email: user.email,
      note: `Backfill controlat din locatia ${sourceLocation.id}. Fotografia locatiei nu a fost folosita ca logo.`,
      performed_at: new Date().toISOString(),
    });
    return res({ success: true, changed: true, organization_id: organizationId, source_location_id: sourceLocation.id, updates, warnings });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
}
