import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

const STAGED_FIELDS = ['name', 'address', 'phone_public', 'public_email', 'website', 'description', 'provider_type', 'photo_url'];

function cleanServiceKeys(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((key) => String(key || '').trim()).filter(Boolean))];
}

function organizationCompleteness(organization) {
  const items = [
    !!String(organization.public_display_name || organization.name || '').trim(),
    !!String(organization.public_description || '').trim(),
    !!(String(organization.public_phone || '').trim() || String(organization.public_email || '').trim()),
    !!(String(organization.website_url || organization.website || '').trim() || String(organization.facebook_url || '').trim() || String(organization.instagram_url || '').trim() || String(organization.linkedin_url || '').trim()),
    !!String(organization.logo_url || '').trim(),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot analiza modificari' }, { status: 403 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    if (!input.location_id || !['aproba', 'respinge'].includes(input.decision)) {
      return Response.json({ error: 'location_id si decision (aproba/respinge) sunt obligatorii' }, { status: 400 });
    }

    const location = await svc.entities.ProviderLocation.get(input.location_id).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (!location.pending_changes) return Response.json({ error: 'Locatia nu are modificari in asteptare' }, { status: 400 });

    let changes = {};
    try { changes = JSON.parse(location.pending_changes); } catch (_error) { changes = {}; }
    const now = new Date().toISOString();
    const fields = changes.fields || {};
    const organizationLogo = changes.media_review?.target_type === 'organization_logo' && !!fields.photo_url;
    const organizationId = changes.media_review?.organization_id || changes.organization_id || location.organization_id || '';
    const organization = organizationLogo
      ? await svc.entities.ProviderOrganization.get(organizationId).catch(() => null)
      : null;
    if (organizationLogo && !organization) return Response.json({ error: 'Organizatia logo-ului nu a fost gasita' }, { status: 404 });

    if (input.decision === 'aproba') {
      const locationUpdates = { pending_changes: '' };
      for (const key of STAGED_FIELDS) {
        if (fields[key] === undefined) continue;
        if (key === 'photo_url' && organizationLogo) continue;
        locationUpdates[key] = fields[key];
      }

      if (fields.locality_siruta_code !== undefined) {
        const code = String(fields.locality_siruta_code || '').trim();
        const geographyRows = await svc.entities.GeographicLocality.filter({ siruta_code: code, is_active: true });
        const geography = geographyRows[0];
        if (!geography) return Response.json({ error: 'Localitatea din modificarile in asteptare nu exista sau nu este activa' }, { status: 400 });
        locationUpdates.locality_siruta_code = geography.siruta_code;
        locationUpdates.locality_name = geography.name;
        locationUpdates.county_code = geography.county_code || '';
        locationUpdates.county_name = geography.county_name || '';
        locationUpdates.uat_code = geography.uat_code || '';
        locationUpdates.uat_name = geography.uat_name || '';
        locationUpdates.city = geography.name;
        locationUpdates.county = geography.county_name || '';
      }

      let servicePlan = null;
      if (Array.isArray(changes.services)) {
        const existing = await svc.entities.LocationService.filter({ location_id: location.id }, null, 500);
        const byKey = {};
        for (const service of existing) byKey[String(service.service_key || '').trim()] = service;
        const wantedKeys = cleanServiceKeys(changes.services);
        const invalidNewKeys = wantedKeys.filter((key) => !byKey[key] && normalizeServiceKey(key).status !== 'canonical');
        if (invalidNewKeys.length > 0) {
          return Response.json({
            error: 'Modificarile legacy contin servicii noi necanonice. Reclasifica-le manual inainte de aprobare.',
            fields: invalidNewKeys,
          }, { status: 400 });
        }
        servicePlan = { existing, byKey, wantedKeys, wanted: new Set(wantedKeys) };
      }

      if (organizationLogo) {
        const organizationUpdates = {
          logo_url: fields.photo_url,
          logo_review_status: 'approved',
          logo_reviewed_at: now,
          logo_review_note: input.notes || 'Logo organizational aprobat',
          logo_review_location_id: location.id,
          profile_updated_at: now,
        };
        organizationUpdates.profile_completeness = organizationCompleteness({ ...organization, ...organizationUpdates });
        await svc.entities.ProviderOrganization.update(organization.id, organizationUpdates);
        await svc.entities.DirectoryAuditRecord.create({
          entity_type: 'ProviderOrganization',
          entity_id: organization.id,
          action_type: 'approve_organization_logo',
          changed_fields: ['logo_url', 'logo_review_status'],
          previous_values: JSON.stringify({ logo_url: organization.logo_url || '', logo_review_status: organization.logo_review_status || 'pending_review' }),
          new_values: JSON.stringify({ logo_url: fields.photo_url, logo_review_status: 'approved' }),
          admin_user_id: user.id,
          admin_email: user.email,
          note: input.notes || 'Logo organizational aprobat',
          performed_at: now,
        });
      }

      await svc.entities.ProviderLocation.update(location.id, locationUpdates);

      if (servicePlan) {
        for (const serviceKey of servicePlan.wantedKeys) {
          const current = servicePlan.byKey[serviceKey];
          if (current) {
            if (current.is_active === false) {
              await svc.entities.LocationService.update(current.id, {
                is_active: true,
                accepts_requests: current.accepts_requests !== false,
                matching_allowed: isServiceMatchingEligible({ ...current, is_active: true }, location),
              });
            }
            continue;
          }
          const definition = getCanonicalServiceDefinition(serviceKey);
          if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
          await svc.entities.LocationService.create({
            location_id: location.id,
            service_key: serviceKey,
            is_active: true,
            accepts_requests: true,
            service_need_level: definition.service_need_level,
            is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
            confirmation_level: 'not_confirmed',
            matching_allowed: false,
            migration_review_required: false,
          });
        }
        for (const service of servicePlan.existing) {
          if (!servicePlan.wanted.has(service.service_key) && service.is_active !== false) {
            await svc.entities.LocationService.update(service.id, { is_active: false, accepts_requests: false, matching_allowed: false });
          }
        }
      }

      if (Array.isArray(changes.specializations)) {
        await svc.entities.LocationSpecialization.deleteMany({ location_id: location.id });
        if (changes.specializations.length > 0) await svc.entities.LocationSpecialization.bulkCreate(changes.specializations.map((key) => ({ location_id: location.id, specialization_key: key, is_active: true })));
      }
      if (Array.isArray(changes.facilities)) {
        await svc.entities.LocationFacility.deleteMany({ location_id: location.id });
        if (changes.facilities.length > 0) await svc.entities.LocationFacility.bulkCreate(changes.facilities.map((key) => ({ location_id: location.id, facility_key: key, is_active: true })));
      }
    } else {
      if (organizationLogo) {
        await svc.entities.ProviderOrganization.update(organization.id, {
          logo_review_status: 'rejected',
          logo_reviewed_at: now,
          logo_review_note: input.notes || 'Logo-ul nu a fost aprobat',
          logo_review_location_id: location.id,
        });
      }
      await svc.entities.ProviderLocation.update(location.id, { pending_changes: '' });
    }

    await svc.entities.VerificationRecord.create({
      location_id: location.id,
      verification_method: 'manual',
      result: input.decision === 'aproba' ? 'aprobat' : 'respins',
      notes: 'Modificari profil: ' + (input.notes || (input.decision === 'aproba' ? 'aprobate' : 'respinse')),
      verified_by: user.email,
      verified_at: now,
    });
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: organizationLogo ? 'ProviderOrganization' : 'ProviderLocation',
      entity_id: organizationLogo ? organizationId : location.id,
      action_type: input.decision === 'aproba' ? 'approve_profile_changes' : 'reject_profile_changes',
      changed_fields: organizationLogo ? [...Object.keys(fields), 'logo_review_status'] : Object.keys(fields),
      previous_values: '{}',
      new_values: JSON.stringify({ ...fields, ...(organizationLogo ? { logo_review_status: input.decision === 'aproba' ? 'approved' : 'rejected' } : {}) }),
      admin_user_id: user.id,
      admin_email: user.email,
      note: input.notes || '',
      performed_at: now,
    });

    return Response.json({ success: true, ...(organizationLogo ? { logo_review_status: input.decision === 'aproba' ? 'approved' : 'rejected' } : {}) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
