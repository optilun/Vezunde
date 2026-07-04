import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3F.2.2: city/county are compatibility mirrors — never applied from staged
// free text. Geography changes are applied only via a validated locality_siruta_code.
const STAGED_FIELDS = ['name', 'address', 'phone_public', 'public_email', 'website', 'description', 'provider_type'];

// Module 3E.2: known service keys (same catalog as matchProviders — backend
// functions cannot share local imports). Any other key is 'unknown'.
const KNOWN_LEVELS = {
  eyeglasses: 'general', frames: 'general', prescription_lenses: 'general', contact_lenses: 'general',
  optometry_consultation: 'general', ophthalmology_consultation: 'general',
  control_vedere_adulti: 'general', control_vedere_copii: 'general', consult_oftalmologic: 'general',
  lentile_contact: 'general', lentile_progresive: 'general',
  eyeglasses_adjustment: 'technical', eyeglasses_repair: 'technical', lens_fitting: 'technical',
  reparatii_ochelari: 'technical', reglaj_rame: 'technical', montaj_lentile: 'technical',
  oct: 'specialized_medical', retina_consultation: 'specialized_medical', glaucoma_consultation: 'specialized_medical',
  cataract_surgery: 'specialized_medical', refractive_surgery: 'specialized_medical',
  pediatric_ophthalmology: 'specialized_medical', myopia_management: 'specialized_medical', emergency_ophthalmology: 'specialized_medical',
  retina: 'specialized_medical', glaucom: 'specialized_medical', cataracta: 'specialized_medical',
  chirurgie_refractiva: 'specialized_medical', managementul_miopiei: 'specialized_medical',
};

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
      // Module 3F.2.2: staged locality change — all geographic mirror fields are
      // derived ONLY from GeographicLocality. Legacy staged free-text city/county
      // (if present in old pending payloads) are never applied.
      if (fields.locality_siruta_code !== undefined) {
        const code = String(fields.locality_siruta_code || '').trim();
        const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: code, is_active: true });
        const geo = geoRows[0];
        if (!geo) return Response.json({ error: 'Localitatea din modificarile in asteptare nu exista sau nu este activa' }, { status: 400 });
        upd.locality_siruta_code = geo.siruta_code;
        upd.locality_name = geo.name;
        upd.county_code = geo.county_code || '';
        upd.uat_code = geo.uat_code || '';
        upd.uat_name = geo.uat_name || '';
        upd.city = geo.name;
        upd.county = geo.county_name || '';
      }
      await svc.entities.ProviderLocation.update(loc.id, upd);

      if (Array.isArray(changes.services)) {
        // Module 3E.2: NEVER bulk delete/recreate services — that would destroy
        // trust/evidence metadata. Diff instead: reactivate/create requested keys,
        // soft-deactivate removed ones. Existing rows keep confirmation_level,
        // matching_allowed, need level, sources, verification and review flags.
        const existing = await svc.entities.LocationService.filter({ location_id: loc.id }, null, 500);
        const byKey = {};
        for (const s of existing) byKey[s.service_key] = s;
        const wanted = new Set(changes.services);
        for (const k of changes.services) {
          const cur = byKey[k];
          if (cur) {
            if (cur.is_active === false) await svc.entities.LocationService.update(cur.id, { is_active: true });
          } else {
            const known = Object.prototype.hasOwnProperty.call(KNOWN_LEVELS, k);
            // New provider-submitted services always start unconfirmed and unmatched;
            // unknown keys stay 'unknown' and are flagged for manual classification.
            await svc.entities.LocationService.create({
              location_id: loc.id, service_key: k, is_active: true, accepts_requests: true,
              service_need_level: known ? KNOWN_LEVELS[k] : 'unknown',
              is_advanced_service: known && KNOWN_LEVELS[k] === 'specialized_medical',
              confirmation_level: 'not_confirmed',
              matching_allowed: false,
              migration_review_required: !known,
            });
          }
        }
        // Removal requests: soft-deactivate (auditable), never hard-delete
        // rows that may carry verification/evidence history.
        for (const s of existing) {
          if (!wanted.has(s.service_key) && s.is_active !== false) {
            await svc.entities.LocationService.update(s.id, { is_active: false });
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