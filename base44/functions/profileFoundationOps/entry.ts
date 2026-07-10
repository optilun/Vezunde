import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isServicePubliclyEligible } from '../../../shared/canonicalServiceRegistry.js';

// MODULE 3H.1A — Provider Profile Foundation operations.
// Cross-role contract:
//  - PROVIDER: reads own workspace data (whitelisted), proposes draft equipment/brand
//    records for OWN locations only. Can never set confirmation_level, visibility,
//    verification or review fields.
//  - ADMIN: reviews proposals (approve/reject/needs_more_info/archive), controls
//    visibility and confirmation, validates public URL fields.
//  - PATIENT: never served here. Public payloads live only in getPublicProviderProfile /
//    matchProviders (backend whitelists, B2B excluded).
// Equipment/brands NEVER create services, specializations or matching effects.

const B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];
const FIELD_STATES = ['draft', 'pending_review', 'approved', 'rejected', 'needs_more_info', 'archived'];
const EQUIPMENT_KEYS = [
  'autorefractometer', 'keratometer', 'lensmeter', 'phoropter', 'visual_acuity_chart',
  'pupillometer', 'digital_centering_system',
  'slit_lamp', 'tonometer', 'corneal_topographer', 'contact_lens_trial_set',
  'gonioscope', 'specular_microscope', 'retinal_angiography_system',
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound',
  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',
  'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',
  'excimer_laser', 'femtosecond_laser', 'corneal_crosslinking_system',
  'tracer', 'blocker', 'edger', 'groover', 'drill', 'generator', 'polisher', 'coater', 'ultrasonic_cleaner',
];
// Specialized medical/surgical equipment may be public ONLY on a verified profile.
const SPECIALIZED_EQUIPMENT = [
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'ophthalmic_ultrasound',
  'gonioscope', 'specular_microscope', 'retinal_angiography_system',
  'operating_microscope', 'phacoemulsification_system', 'vitrectomy_system', 'yag_laser',
  'retinal_laser', 'intravitreal_injection_setup', 'minor_procedure_set',
  'excimer_laser', 'femtosecond_laser', 'corneal_crosslinking_system',
];
const OFFERING_TYPES = ['frames', 'ophthalmic_lenses', 'contact_lenses', 'sunglasses', 'care_products', 'medical_devices'];
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function normalizeMemberRole(role) { if (role === 'owner') return 'organization_owner'; if (role === 'staff') return 'location_staff'; return MEMBER_ROLES.includes(role) ? role : ''; }

function isPublicSafeService(service, location) {
  if (service?.migration_review_required) return false;
  return isServicePubliclyEligible(service, location);
}

// Provider-visible field whitelists — internal review/provenance data never leaves.
const PROVIDER_LOCATION_FIELDS = [
  'id', 'organization_id', 'name', 'public_display_name', 'provider_type', 'provider_profile_type',
  'city', 'county', 'locality_siruta_code', 'address', 'phone_public', 'public_phone', 'public_email',
  'website', 'website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'profile_photo_url',
  'gallery_urls', 'description', 'public_description', 'opening_hours', 'opening_hours_json',
  'saturday_hours', 'request_intake_status', 'public_visibility_status', 'accepts_patients_directly',
  'profile_completeness', 'profile_updated_at', 'status', 'active_status', 'profile_control_status',
  'availability_status', 'availability_updated_at', 'verification_state',
];
const PROVIDER_EQUIPMENT_FIELDS = [
  'id', 'location_id', 'equipment_category_key', 'equipment_label', 'manufacturer', 'model',
  'declared_use', 'visibility_status', 'confirmation_level', 'evidence_status', 'is_active', 'added_at',
];
const PROVIDER_BRAND_FIELDS = [
  'id', 'location_id', 'offering_type', 'brand_name', 'brand_type', 'description',
  'public_visibility_status', 'confirmation_level', 'evidence_status', 'is_active', 'added_at',
];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) out[f] = obj?.[f] ?? null;
  return out;
}
function str(v, max) { return String(v ?? '').trim().slice(0, max); }
// Module 3H.1A.1: normalization for duplicate detection (never used for classification).
function normVal(v) { return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' '); }
function isValidUrl(v) {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

// ===== PART 6: deterministic profile completeness (no AI, never a ranking factor) =====
function summarize(items) {
  const missing = items.filter((i) => !i.ok);
  const total = items.length;
  return {
    percentage: total === 0 ? 0 : Math.round(((total - missing.length) / total) * 100),
    missing_required: missing.map((i) => i.key),
    next_recommended_action: missing.length > 0 ? missing[0].action : null,
  };
}

function locationCompleteness(loc, publicSafeServiceCount) {
  const l = loc || {};
  const hasContact = !!(l.public_phone || l.phone_public || l.public_email || l.website_url || l.website);
  return summarize([
    { key: 'public_name', ok: !!(l.public_display_name || l.name), action: 'Adauga numele public al locatiei' },
    { key: 'canonical_locality', ok: !!l.locality_siruta_code, action: 'Selecteaza localitatea canonica' },
    { key: 'address', ok: !!l.address, action: 'Adauga adresa locatiei' },
    { key: 'contact_method', ok: hasContact, action: 'Adauga un telefon, email sau website public' },
    { key: 'provider_type', ok: !!(l.provider_profile_type || l.provider_type), action: 'Seteaza tipul de furnizor' },
    { key: 'public_safe_service', ok: publicSafeServiceCount > 0, action: 'Adauga cel putin un serviciu public confirmat' },
    { key: 'opening_hours_or_availability', ok: !!(l.opening_hours_json || l.opening_hours || (l.availability_status && l.availability_status !== 'necunoscuta')), action: 'Adauga programul sau disponibilitatea declarata' },
    { key: 'public_description', ok: !!(l.public_description || l.description), action: 'Adauga o descriere publica' },
  ]);
}

function organizationCompleteness(org, linkedLocationCount) {
  const o = org || {};
  return summarize([
    { key: 'name', ok: !!(o.public_display_name || o.name), action: 'Adauga numele organizatiei' },
    { key: 'organization_type', ok: !!o.organization_type, action: 'Seteaza tipul organizatiei' },
    { key: 'contact_method', ok: !!(o.public_phone || o.public_email || o.website_url || o.website), action: 'Adauga un contact sau website' },
    { key: 'linked_location', ok: linkedLocationCount > 0, action: 'Adauga cel putin o locatie' },
  ]);
}

function professionalCompleteness(pro, hasApprovedLink) {
  const p = pro || {};
  return summarize([
    { key: 'display_name', ok: !!(p.public_display_name || p.full_name), action: 'Adauga numele public' },
    { key: 'professional_type', ok: !!(p.professional_type || p.role), action: 'Seteaza tipul profesional' },
    { key: 'approved_link', ok: hasApprovedLink, action: 'Necesita o asociere aprobata cu o locatie sau profil independent aprobat' },
    { key: 'public_bio', ok: !!(p.professional_bio || p.bio), action: 'Adauga o descriere publica' },
  ]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = payload.action;

    const myLocationIds = async () => {
      const ms = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, null, 100);
      return ms.filter((m) => m.location_id && normalizeMemberRole(m.role)).map((m) => m.location_id);
    };
    const canAccessLocation = async (locationId) => {
      if (isAdmin) return true;
      const ids = await myLocationIds();
      return ids.includes(locationId);
    };

    // ---- PART 6: completeness (admin, or provider for own location/org) ----
    if (action === 'get_completeness') {
      const entityType = payload.entity_type;
      const entityId = String(payload.entity_id || '').trim();
      if (!['location', 'organization', 'professional'].includes(entityType)) {
        return Response.json({ error: 'entity_type invalid' }, { status: 400 });
      }
      if (entityType === 'location') {
        if (entityId && !(await canAccessLocation(entityId))) return Response.json({ error: 'Acces interzis' }, { status: 403 });
        const loc = entityId ? await svc.entities.ProviderLocation.get(entityId).catch(() => null) : null;
        let safeCount = 0;
        if (loc) {
          const services = await svc.entities.LocationService.filter({ location_id: loc.id }, null, 200);
          safeCount = services.filter((service) => isPublicSafeService(service, loc)).length;
        }
        return Response.json({ exists: !!loc, ...locationCompleteness(loc, safeCount) });
      }
      if (entityType === 'organization') {
        if (!isAdmin) {
          const ms = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, null, 100);
          if (!ms.some((m) => normalizeMemberRole(m.role) && m.organization_id === entityId)) return Response.json({ error: 'Acces interzis' }, { status: 403 });
        }
        const org = entityId ? await svc.entities.ProviderOrganization.get(entityId).catch(() => null) : null;
        const linked = org ? await svc.entities.ProviderLocation.filter({ organization_id: org.id }, null, 1) : [];
        return Response.json({ exists: !!org, ...organizationCompleteness(org, linked.length) });
      }
      // professional: admin-only (no professional self-service accounts yet)
      if (!isAdmin) return Response.json({ error: 'Acces interzis' }, { status: 403 });
      const pro = entityId ? await svc.entities.ProfessionalProfile.get(entityId).catch(() => null) : null;
      let hasLink = false;
      if (pro) {
        const assigns = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: pro.id, active_status: 'activ' }, null, 1);
        hasLink = assigns.length > 0 || (pro.accepts_independent_requests === true && pro.public_visibility_status === 'approved');
      }
      return Response.json({ exists: !!pro, ...professionalCompleteness(pro, hasLink) });
    }

    // ---- PART 7: provider-scoped workspace read (own data only, whitelisted) ----
    if (action === 'get_my_workspace') {
      const locIds = await myLocationIds();
      const locations = (await Promise.all(locIds.map((id) => svc.entities.ProviderLocation.get(id).catch(() => null))))
        .filter(Boolean)
        .map((l) => ({ ...pick(l, PROVIDER_LOCATION_FIELDS), has_pending_changes: !!l.pending_changes }));
      const equipmentLists = await Promise.all(locIds.map((id) => svc.entities.LocationEquipment.filter({ location_id: id }, null, 100)));
      const brandLists = await Promise.all(locIds.map((id) => svc.entities.ProductBrandOffering.filter({ location_id: id }, null, 100)));
      return Response.json({
        locations,
        equipment: equipmentLists.flat().map((e) => pick(e, PROVIDER_EQUIPMENT_FIELDS)),
        offerings: brandLists.flat().map((b) => pick(b, PROVIDER_BRAND_FIELDS)),
      });
    }

    // ---- PART 3/5: provider proposes draft equipment (never self-verified/public) ----
    if (action === 'propose_equipment') {
      const locationId = String(payload.location_id || '').trim();
      if (!locationId || !(await canAccessLocation(locationId))) return Response.json({ error: 'Acces interzis' }, { status: 403 });
      const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!loc) return Response.json({ error: 'Locatia nu exista' }, { status: 404 });
      const key = String(payload.equipment_category_key || '').trim();
      if (!EQUIPMENT_KEYS.includes(key)) return Response.json({ error: 'Categorie de echipament invalida' }, { status: 400 });
      // PART 7 (3H.1A.1): duplicate protection — same category (+ manufacturer/model
      // where supplied) on an active or pending item never creates a second proposal.
      const existingEq = await svc.entities.LocationEquipment.filter({ location_id: locationId, equipment_category_key: key }, null, 100);
      const newMan = normVal(payload.manufacturer);
      const newModel = normVal(payload.model);
      const dupEq = existingEq.find((e) => {
        if (e.is_active === false || ['rejected', 'archived'].includes(e.evidence_status)) return false;
        if (newMan && normVal(e.manufacturer) !== newMan) return false;
        if (newModel && normVal(e.model) !== newModel) return false;
        return true;
      });
      if (dupEq) {
        return Response.json({ duplicate: true, error: 'Exista deja o propunere activa sau in verificare pentru acest echipament la aceasta locatie' }, { status: 409 });
      }
      const record = await svc.entities.LocationEquipment.create({
        location_id: locationId,
        equipment_category_key: key,
        equipment_label: str(payload.equipment_label, 200),
        manufacturer: str(payload.manufacturer, 200),
        model: str(payload.model, 200),
        declared_use: str(payload.declared_use, 500),
        // Forced safe defaults — providers can never set trust/visibility fields.
        visibility_status: 'internal',
        confirmation_level: 'declared',
        evidence_status: 'pending_review',
        is_active: true,
        added_by: user.email || user.id,
        added_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, record: pick(record, PROVIDER_EQUIPMENT_FIELDS) });
    }

    // ---- PART 4/5: provider proposes draft brand offering ----
    if (action === 'propose_brand') {
      const locationId = String(payload.location_id || '').trim();
      if (!locationId || !(await canAccessLocation(locationId))) return Response.json({ error: 'Acces interzis' }, { status: 403 });
      const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
      if (!loc) return Response.json({ error: 'Locatia nu exista' }, { status: 404 });
      const offeringType = String(payload.offering_type || '').trim();
      if (!OFFERING_TYPES.includes(offeringType)) return Response.json({ error: 'Tip de oferta invalid' }, { status: 400 });
      const brandName = str(payload.brand_name, 200);
      if (!brandName) return Response.json({ error: 'brand_name este obligatoriu' }, { status: 400 });
      // PART 7 (3H.1A.1): duplicate protection — same offering_type + normalized
      // brand_name on an active or pending item never creates a second proposal.
      const existingBr = await svc.entities.ProductBrandOffering.filter({ location_id: locationId, offering_type: offeringType }, null, 100);
      const dupBr = existingBr.find((b) =>
        b.is_active !== false
        && !['rejected', 'archived'].includes(b.evidence_status)
        && normVal(b.brand_name) === normVal(brandName)
      );
      if (dupBr) {
        return Response.json({ duplicate: true, error: 'Exista deja o propunere activa sau in verificare pentru acest brand la aceasta locatie' }, { status: 409 });
      }
      const record = await svc.entities.ProductBrandOffering.create({
        location_id: locationId,
        offering_type: offeringType,
        brand_name: brandName,
        brand_type: str(payload.brand_type, 200),
        description: str(payload.description, 1000),
        public_visibility_status: 'draft',
        confirmation_level: 'declared',
        evidence_status: 'pending_review',
        is_active: true,
        added_by: user.email || user.id,
        added_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, record: pick(record, PROVIDER_BRAND_FIELDS) });
    }

    // ================= ADMIN-ONLY ACTIONS =================
    if (!isAdmin) return Response.json({ error: 'Acces permis doar administratorilor' }, { status: 403 });

    // ---- PART 5: admin review of equipment/brand proposals ----
    if (action === 'admin_review_item') {
      const recordType = payload.record_type;
      const recordId = String(payload.record_id || '').trim();
      const decision = payload.decision;
      const reason = str(payload.reason ?? payload.note, 1000);
      if (!['equipment', 'brand'].includes(recordType)) return Response.json({ error: 'record_type invalid' }, { status: 400 });
      if (!['approved', 'rejected', 'needs_more_info', 'archived'].includes(decision)) {
        return Response.json({ error: 'decision invalida' }, { status: 400 });
      }
      // PART 5 (3H.1A.1): decision reason is recorded consistently; non-approval always requires one.
      if (decision !== 'approved' && !reason) {
        return Response.json({ error: 'Decizia necesita un motiv (reason)' }, { status: 400 });
      }
      // PART 5 (3H.1A.1): confirmation_level may change ONLY on approval — rejected,
      // needs_more_info or archived items can never receive elevated confirmation.
      if (payload.confirmation_level && decision !== 'approved') {
        return Response.json({ error: 'confirmation_level poate fi setat doar cand decizia este approved' }, { status: 400 });
      }
      const entity = recordType === 'equipment' ? svc.entities.LocationEquipment : svc.entities.ProductBrandOffering;
      const record = await entity.get(recordId).catch(() => null);
      if (!record) return Response.json({ error: 'Inregistrarea nu exista' }, { status: 404 });
      const loc = await svc.entities.ProviderLocation.get(record.location_id).catch(() => null);

      const update = {
        evidence_status: decision,
        reviewed_by: user.email || user.id,
        reviewed_at: new Date().toISOString(),
      };
      if (payload.confirmation_level) {
        if (!['declared', 'provider_confirmed', 'vezunde_verified'].includes(payload.confirmation_level)) {
          return Response.json({ error: 'confirmation_level invalid' }, { status: 400 });
        }
        update.confirmation_level = payload.confirmation_level;
      }
      if (recordType === 'equipment' && reason) update.evidence_note = reason;
      // PART 5 (3H.1A.1): non-approved items are forced non-public and never keep
      // elevated confirmation after rejection.
      if (decision !== 'approved') {
        if (recordType === 'equipment') update.visibility_status = 'internal';
        else update.public_visibility_status = decision;
        if (decision === 'rejected' && ['provider_confirmed', 'vezunde_verified'].includes(record.confirmation_level)) {
          update.confirmation_level = 'declared';
        }
      }

      if (payload.make_public === true) {
        if (decision !== 'approved') return Response.json({ error: 'Doar inregistrarile aprobate pot deveni publice' }, { status: 400 });
        if (recordType === 'equipment') {
          if (SPECIALIZED_EQUIPMENT.includes(record.equipment_category_key) && (loc?.profile_control_status || 'directory') !== 'verified') {
            return Response.json({ error: 'Echipamentele specializate pot fi publice doar pe un profil verificat' }, { status: 400 });
          }
          update.visibility_status = 'public';
        } else {
          // PART 7 (3H.1A.1): medical_devices stays internal in v1 — never a
          // patient-facing brand offering and never a B2B visibility path.
          if (record.offering_type === 'medical_devices') {
            return Response.json({ error: 'Ofertele de tip medical_devices raman interne si nu pot deveni publice' }, { status: 400 });
          }
          if (B2B_PROFILE_TYPES.includes(loc?.provider_profile_type)) {
            return Response.json({ error: 'Locatiile B2B nu pot avea oferte publice pentru pacienti' }, { status: 400 });
          }
          update.public_visibility_status = 'approved';
        }
      }

      await entity.update(recordId, update);
      await svc.entities.AuditLog.create({
        event_type: 'profile_foundation_review',
        message: `${recordType} ${recordId} (locatie ${record.location_id}): ${decision}${payload.make_public === true ? ' + public' : ''} de ${user.email}${reason ? ` — motiv: ${reason}` : ''}`,
      });
      return Response.json({ ok: true });
    }

    // ---- PART 2 rule: URL fields must validate format (admin write path) ----
    if (action === 'set_public_links') {
      const entityType = payload.entity_type;
      const entityId = String(payload.entity_id || '').trim();
      const entityMap = {
        location: svc.entities.ProviderLocation,
        organization: svc.entities.ProviderOrganization,
        professional: svc.entities.ProfessionalProfile,
      };
      const allowedFields = {
        location: ['website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'profile_photo_url'],
        organization: ['website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'logo_url', 'cover_image_url'],
        professional: ['public_website_url', 'facebook_url', 'instagram_url', 'linkedin_url', 'profile_photo_url'],
      };
      if (!entityMap[entityType]) return Response.json({ error: 'entity_type invalid' }, { status: 400 });
      const record = await entityMap[entityType].get(entityId).catch(() => null);
      if (!record) return Response.json({ error: 'Inregistrarea nu exista' }, { status: 404 });
      const links = payload.links || {};
      const reason = str(payload.reason, 500);
      const update = {};
      const previous = {};
      for (const field of allowedFields[entityType]) {
        if (links[field] === undefined) continue;
        const value = String(links[field] || '').trim();
        if (value && !isValidUrl(value)) return Response.json({ error: `URL invalid pentru ${field}` }, { status: 400 });
        if ((record[field] || '') === value) continue; // unchanged — no write, no audit noise
        update[field] = value;
        previous[field] = record[field] || '';
      }
      const changedFields = Object.keys(update);
      if (changedFields.length === 0) return Response.json({ error: 'Niciun camp modificat' }, { status: 400 });
      update.profile_updated_at = new Date().toISOString();
      await entityMap[entityType].update(entityId, update);
      // PART 4 (3H.1A.1): every public-link change is audited via the existing
      // DirectoryAuditRecord conventions — actor, timestamp, object, before/after, reason.
      const auditEntityType = { location: 'ProviderLocation', organization: 'ProviderOrganization', professional: 'ProfessionalProfile' }[entityType];
      await svc.entities.DirectoryAuditRecord.create({
        entity_type: auditEntityType,
        entity_id: entityId,
        action_type: 'set_public_links',
        changed_fields: changedFields,
        previous_values: JSON.stringify(previous),
        new_values: JSON.stringify(Object.fromEntries(changedFields.map((f) => [f, update[f]]))),
        admin_user_id: user.id,
        admin_email: user.email,
        note: reason,
        performed_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, updated_fields: changedFields });
    }

    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
