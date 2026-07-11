import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

// Legacy profile review endpoint retained for compatibility with pending_changes.
// New service configuration must use ProviderWorkspaceSubmission. This endpoint
// preserves exact existing legacy keys but never creates a new non-canonical key.
// Module 3F.2.2: city/county are compatibility mirrors — never applied from staged
// free text. Geography changes are applied only via a validated locality_siruta_code.
const STAGED_FIELDS = ['name', 'address', 'phone_public', 'public_email', 'website', 'description', 'provider_type', 'photo_url'];

function cleanServiceKeys(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((key) => String(key || '').trim())
    .filter(Boolean))];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot analiza modificari' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id || !['aproba', 'respinge'].includes(p.decision)) {
      return Response.json({ error: 'location_id si decision (aproba/respinge) sunt obligatorii' }, { status: 400 });
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (!loc.pending_changes) return Response.json({ error: 'Locatia nu are modificari in asteptare' }, { status: 400 });

    let changes = {};
    try { changes = JSON.parse(loc.pending_changes); } catch (_e) { changes = {}; }
    const now = new Date().toISOString();

    if (p.decision === 'aproba') {
      const upd = { pending_changes: '' };
      const fields = changes.fields || {};
      for (const k of STAGED_FIELDS) {
        if (fields[k] !== undefined) upd[k] = fields[k];
      }

      // Validate every dependency before the first write, preventing partial approval.
      if (fields.locality_siruta_code !== undefined) {
        const code = String(fields.locality_siruta_code || '').trim();
        const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: code, is_active: true });
        const geo = geoRows[0];
        if (!geo) return Response.json({ error: 'Localitatea din modificarile in asteptare nu exista sau nu este activa' }, { status: 400 });
        upd.locality_siruta_code = geo.siruta_code;
        upd.locality_name = geo.name;
        upd.county_code = geo.county_code || '';
        upd.county_name = geo.county_name || '';
        upd.uat_code = geo.uat_code || '';
        upd.uat_name = geo.uat_name || '';
        upd.city = geo.name;
        upd.county = geo.county_name || '';
      }

      let servicePlan = null;
      if (Array.isArray(changes.services)) {
        const existing = await svc.entities.LocationService.filter({ location_id: loc.id }, null, 500);
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

      await svc.entities.ProviderLocation.update(loc.id, upd);

      if (servicePlan) {
        // NEVER bulk delete/recreate services — that would destroy trust/evidence
        // metadata. Existing legacy/unknown rows may be preserved by exact key, but
        // this legacy path cannot create a new non-canonical row.
        for (const serviceKey of servicePlan.wantedKeys) {
          const current = servicePlan.byKey[serviceKey];
          if (current) {
            if (current.is_active === false) {
              await svc.entities.LocationService.update(current.id, {
                is_active: true,
                accepts_requests: current.accepts_requests !== false,
                matching_allowed: isServiceMatchingEligible({ ...current, is_active: true }, loc),
              });
            }
            continue;
          }

          const definition = getCanonicalServiceDefinition(serviceKey);
          if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
          // New provider-submitted services always start unconfirmed and unmatched.
          await svc.entities.LocationService.create({
            location_id: loc.id,
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

        // Removal requests: soft-deactivate (auditable), never hard-delete rows that
        // may carry verification/evidence history.
        for (const service of servicePlan.existing) {
          if (!servicePlan.wanted.has(service.service_key) && service.is_active !== false) {
            await svc.entities.LocationService.update(service.id, {
              is_active: false,
              accepts_requests: false,
              matching_allowed: false,
            });
          }
        }
      }

      if (Array.isArray(changes.specializations)) {
        await svc.entities.LocationSpecialization.deleteMany({ location_id: loc.id });
        if (changes.specializations.length > 0) {
          await svc.entities.LocationSpecialization.bulkCreate(
            changes.specializations.map((k) => ({ location_id: loc.id, specialization_key: k, is_active: true }))
          );
        }
      }
      if (Array.isArray(changes.facilities)) {
        await svc.entities.LocationFacility.deleteMany({ location_id: loc.id });
        if (changes.facilities.length > 0) {
          await svc.entities.LocationFacility.bulkCreate(
            changes.facilities.map((k) => ({ location_id: loc.id, facility_key: k, is_active: true }))
          );
        }
      }
    } else {
      await svc.entities.ProviderLocation.update(loc.id, { pending_changes: '' });
    }

    await svc.entities.VerificationRecord.create({
      location_id: loc.id,
      verification_method: 'manual',
      result: p.decision === 'aproba' ? 'aprobat' : 'respins',
      notes: 'Modificari profil: ' + (p.notes || (p.decision === 'aproba' ? 'aprobate' : 'respinse')),
      verified_by: user.email,
      verified_at: now,
    });
    // Module 3D: bridge into the central directory audit history.
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderLocation',
      entity_id: loc.id,
      action_type: p.decision === 'aproba' ? 'approve_profile_changes' : 'reject_profile_changes',
      changed_fields: Object.keys(changes.fields || {}),
      previous_values: '{}',
      new_values: JSON.stringify(changes.fields || {}),
      admin_user_id: user.id,
      admin_email: user.email,
      note: p.notes || '',
      performed_at: now,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
