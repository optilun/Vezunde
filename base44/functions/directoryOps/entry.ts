import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3C - Directory Data Operations (admin-only writes).
// Every write happens ONLY through an explicit admin action + audit record.
// Legacy is_verified / is_claimed / verification_state are never used as source of truth.

// Approved canonical service catalog. No free-text keys allowed.
const CATALOG = {
  eyeglasses: 'general',
  frames: 'general',
  prescription_lenses: 'general',
  contact_lenses: 'general',
  optometry_consultation: 'general',
  ophthalmology_consultation: 'general',
  eyeglasses_adjustment: 'technical',
  eyeglasses_repair: 'technical',
  lens_fitting: 'technical',
  oct: 'specialized_medical',
  retina_consultation: 'specialized_medical',
  glaucoma_consultation: 'specialized_medical',
  cataract_surgery: 'specialized_medical',
  refractive_surgery: 'specialized_medical',
  pediatric_ophthalmology: 'specialized_medical',
  myopia_management: 'specialized_medical',
  emergency_ophthalmology: 'specialized_medical',
};

// Module 3E.1: legacy keys already stored in the directory, recognized for
// classification only (never addable as new services). Any other key is 'unknown'
// and requires explicit manual catalog classification before public use.
const LEGACY_LEVELS = {
  control_vedere_adulti: 'general', control_vedere_copii: 'general', consult_oftalmologic: 'general',
  lentile_contact: 'general', lentile_progresive: 'general',
  reparatii_ochelari: 'technical', reglaj_rame: 'technical', montaj_lentile: 'technical',
  retina: 'specialized_medical', glaucom: 'specialized_medical', cataracta: 'specialized_medical',
  chirurgie_refractiva: 'specialized_medical', managementul_miopiei: 'specialized_medical',
};
function classifyKey(key) { return CATALOG[key] || LEGACY_LEVELS[key] || 'unknown'; }

const PROVIDER_TYPES = ['optica_medicala', 'clinica_oftalmologica', 'cabinet_oftalmologic', 'cabinet_optometric', 'laborator_optic', 'optometrist_independent', 'medic_oftalmolog_independent'];

// Module 3H.1A.1: mandatory provider profile classification — approved enum only,
// never derived from free text.
const PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office', 'independent_ophthalmologist', 'independent_optometrist', 'independent_optician', 'optical_laboratory_b2c', 'optical_laboratory_b2b', 'future_b2b_distributor'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2);

function bad(msg) { return Response.json({ error: msg }, { status: 400 }); }

// matching_allowed is NEVER automatic beyond these strict rules.
function computeMatchingAllowed(level, needLevel, loc) {
  if (!loc || loc.active_status === 'inactiva' || loc.profile_control_status === 'suspended') return false;
  if (needLevel === 'unknown') return false; // unclassified keys are never matchable
  if (needLevel === 'specialized_medical') {
    return level === 'vezunde_verified' && loc.profile_control_status === 'verified';
  }
  return ['publicly_listed', 'provider_confirmed', 'vezunde_verified'].includes(level);
}

async function audit(svc, user, rec) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: rec.entity_type,
    entity_id: rec.entity_id || '',
    action_type: rec.action_type,
    changed_fields: rec.changed_fields || [],
    previous_values: JSON.stringify(rec.previous || {}),
    new_values: JSON.stringify(rec.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: rec.note || '',
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori Vezunde' }, { status: 403 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;

    // ---------- CREATE ORGANIZATION + LOCATION ----------
    if (action === 'create_location') {
      const org = p.organization || {};
      const loc = p.location || {};
      const prov = p.provenance || {};
      if (!loc.name || !norm(loc.name)) return bad('Numele locatiei este obligatoriu');
      if (!PROVIDER_TYPES.includes(loc.provider_type)) return bad('Tip de furnizor invalid');
      // Module 3H.1A.1: provider_profile_type is mandatory (enum-only).
      if (!PROFILE_TYPES.includes(loc.provider_profile_type)) return bad('provider_profile_type lipseste sau este invalid');
      const orgType = org.organization_type || loc.provider_profile_type;
      if (!p.organization_id && !PROFILE_TYPES.includes(orgType)) return bad('organization_type lipseste sau este invalid');
      // Module 3F.2.2: canonical locality (SIRUTA) is MANDATORY. Free-text city/county
      // are never accepted as geographic truth — mirrors are derived server-side below.
      const sirutaCode = String(loc.locality_siruta_code || '').trim();
      if (!sirutaCode) return bad('Selectarea localitatii canonice (SIRUTA) este obligatorie');
      if (!loc.address) return bad('Adresa este obligatorie');
      if (!prov.source_url) return bad('source_url este obligatoriu pentru profiluri directory');
      if (!prov.source_checked_at) return bad('source_checked_at este obligatoriu');
      if (!prov.source_type) return bad('source_type este obligatoriu');
      if (!['low', 'medium', 'high'].includes(prov.data_confidence)) return bad('data_confidence invalid');
      if (!p.organization_id && (!org.name || !norm(org.name))) return bad('Numele organizatiei este obligatoriu');

      // Module 3F.2.2: load + validate the canonical locality server-side.
      const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: sirutaCode, is_active: true });
      const geo = geoRows[0];
      if (!geo) return bad('Localitatea selectata nu exista sau nu este activa');
      // Reject manually submitted city/county that conflict with canonical geography.
      if (loc.city && norm(loc.city) !== norm(geo.name)) return bad('Orasul trimis nu corespunde localitatii canonice selectate');
      if (loc.county && norm(loc.county) !== norm(geo.county_name || '')) return bad('Judetul trimis nu corespunde localitatii canonice selectate');
      if (loc.county_name && norm(loc.county_name) !== norm(geo.county_name || '')) return bad('Judetul trimis nu corespunde localitatii canonice selectate');

      // Module 3F duplicate detection: normalized org/location name, city, address,
      // website domain and public phone. Never auto-merges and never blocks —
      // the admin must explicitly confirm via force_create.
      if (!p.force_create) {
        const [allLocs, allOrgs] = await Promise.all([
          svc.entities.ProviderLocation.list(null, 500),
          svc.entities.ProviderOrganization.list(null, 500),
        ]);
        const orgNames = {};
        for (const o of allOrgs) orgNames[o.id] = o.name || '';
        const domainOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return ''; } };
        const digits = (s) => String(s || '').replace(/\D/g, '');
        const nameToks = tokens(loc.name);
        const orgToks = tokens(org.name || '');
        const newDomain = domainOf(loc.website || org.website || '');
        const newPhone = digits(loc.phone_public);
        const duplicates = [];
        for (const l of allLocs) {
          const reasons = [];
          const sameCity = norm(l.city) === norm(geo.name);
          if (sameCity && tokens(l.name).some((t) => nameToks.includes(t))) reasons.push('nume asemanator in acelasi oras');
          if (sameCity && l.address && norm(l.address) === norm(loc.address)) reasons.push('aceeasi adresa');
          if (newDomain && domainOf(l.website) === newDomain) reasons.push('acelasi domeniu website');
          if (newPhone.length >= 6 && digits(l.phone_public) === newPhone) reasons.push('acelasi telefon public');
          if (sameCity && orgToks.length > 0 && tokens(orgNames[l.organization_id] || '').some((t) => orgToks.includes(t))) reasons.push('organizatie asemanatoare in acelasi oras');
          if (reasons.length > 0) duplicates.push({ id: l.id, name: l.name, city: l.city, address: l.address || '', provider_type: l.provider_type, profile_control_status: l.profile_control_status || 'directory', match_reasons: reasons });
        }
        if (duplicates.length > 0) return Response.json({ duplicates: duplicates.slice(0, 10) });
      }

      let organizationId = p.organization_id || null;
      if (!organizationId) {
        const newOrg = await svc.entities.ProviderOrganization.create({
          name: org.name, legal_name: org.legal_name || '', website: org.website || '', status: 'activa',
          organization_type: orgType,
        });
        organizationId = newOrg.id;
        await audit(svc, user, { entity_type: 'ProviderOrganization', entity_id: newOrg.id, action_type: 'create_organization', changed_fields: ['name', 'legal_name', 'website'], next: { name: org.name }, note: p.note || '' });
      }

      const newLoc = await svc.entities.ProviderLocation.create({
        organization_id: organizationId,
        name: loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        // Canonical geography — derived ONLY from GeographicLocality:
        locality_siruta_code: geo.siruta_code,
        locality_name: geo.name,
        county_code: geo.county_code || '',
        county_name: geo.county_name || '',
        uat_code: geo.uat_code || '',
        uat_name: geo.uat_name || '',
        // Compatibility mirrors ONLY — never geographic truth:
        city: geo.name,
        county: geo.county_name || '',
        address: loc.address,
        phone_public: loc.phone_public || '',
        public_email: loc.public_email || '',
        website: loc.website || '',
        description: loc.description || '',
        opening_hours: loc.opening_hours || '',
        lat: typeof loc.lat === 'number' ? loc.lat : null,
        lng: typeof loc.lng === 'number' ? loc.lng : null,
        status: 'publicata',
        profile_control_status: 'directory',
        claim_verification_status: 'none',
        migration_review_required: false,
        active_status: p.mark_active === true ? 'activa' : 'inactiva',
        data_source: 'manual',
        source_url: prov.source_url,
        source_type: prov.source_type,
        source_name: prov.source_name || '',
        source_checked_at: prov.source_checked_at,
        data_confidence: prov.data_confidence,
        source_notes: prov.source_notes || '',
        collected_at: new Date().toISOString(),
        collected_by: user.email,
      });
      // No automatic services, availability or verification are created.
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: newLoc.id, action_type: 'create_directory_location', changed_fields: ['name', 'provider_type', 'locality_siruta_code', 'city', 'county', 'address', 'source_url'], next: { name: loc.name, locality_siruta_code: geo.siruta_code, city: geo.name, source_url: prov.source_url }, note: p.note || '' });
      return Response.json({ location: newLoc, organization_id: organizationId });
    }

    // ---------- ADD SERVICE (catalog only) ----------
    if (action === 'add_service') {
      const needLevel = CATALOG[p.service_key];
      if (!needLevel) return bad('Serviciu in afara catalogului aprobat');
      if (!p.location_id) return bad('location_id lipseste');
      if (!p.service_source_url) return bad('service_source_url este obligatoriu');
      if (!p.service_confirmed_at) return bad('service_confirmed_at este obligatoriu');
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const existing = await svc.entities.LocationService.filter({ location_id: p.location_id, service_key: p.service_key });
      if (existing.length > 0) return bad('Serviciul exista deja pentru aceasta locatie');

      // publicly_listed is allowed only with explicit source; specialized services
      // may record public listing but are NEVER matching_allowed without verification.
      const level = p.set_publicly_listed === true ? 'publicly_listed' : 'not_confirmed';
      const matchingAllowed = level === 'publicly_listed' ? computeMatchingAllowed(level, needLevel, loc) : false;
      const row = await svc.entities.LocationService.create({
        location_id: p.location_id,
        service_key: p.service_key,
        service_need_level: needLevel,
        confirmation_level: level,
        matching_allowed: matchingAllowed,
        is_advanced_service: needLevel === 'specialized_medical',
        service_source_url: p.service_source_url,
        service_confirmed_at: p.service_confirmed_at,
        notes: p.notes || '',
        migration_review_required: false,
        is_active: true,
      });
      await audit(svc, user, { entity_type: 'LocationService', entity_id: row.id, action_type: 'add_service', changed_fields: ['service_key', 'confirmation_level', 'matching_allowed'], next: { service_key: p.service_key, confirmation_level: level, matching_allowed: matchingAllowed }, note: p.notes || '' });
      return Response.json({ service: row });
    }

    // ---------- SET SERVICE CONFIRMATION LEVEL (per record, never bulk) ----------
    if (action === 'set_service_confirmation') {
      const s = await svc.entities.LocationService.get(p.service_id).catch(() => null);
      if (!s) return bad('Serviciul nu exista');
      const loc = await svc.entities.ProviderLocation.get(s.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const level = p.level;
      // Module 3E.1: unknown keys are never defaulted to general — they require
      // explicit catalog classification before any public listing or matching.
      const needLevel = classifyKey(s.service_key);
      const note = String(p.note || '').trim();

      if (!['not_confirmed', 'publicly_listed', 'provider_confirmed', 'vezunde_verified'].includes(level)) return bad('Nivel invalid');
      if (needLevel === 'unknown' && level !== 'not_confirmed') {
        return bad('Serviciu neclasificat in catalog — necesita clasificare manuala inainte de publicare');
      }
      const updates = { confirmation_level: level };
      if (level === 'publicly_listed') {
        const srcUrl = p.service_source_url || s.service_source_url;
        const confAt = p.service_confirmed_at || s.service_confirmed_at;
        if (!srcUrl) return bad('publicly_listed necesita service_source_url');
        if (!confAt) return bad('publicly_listed necesita service_confirmed_at');
        updates.service_source_url = srcUrl;
        updates.service_confirmed_at = confAt;
      }
      if (level === 'provider_confirmed') {
        if (!note) return bad('provider_confirmed necesita o nota de audit');
        const claims = await svc.entities.ProviderClaimRequest.filter({ location_id: s.location_id, status: 'aprobata' });
        if (claims.length === 0) return bad('provider_confirmed necesita o revendicare aprobata pentru locatie');
        updates.service_confirmed_at = p.service_confirmed_at || new Date().toISOString();
      }
      if (level === 'vezunde_verified') {
        if ((loc.profile_control_status || 'directory') !== 'verified') return bad('vezunde_verified necesita profil cu status verified');
        if (!note) return bad('vezunde_verified necesita o nota de verificare');
        updates.service_verified_at = new Date().toISOString();
        updates.service_verified_by = user.email;
      }
      updates.matching_allowed = level === 'not_confirmed' ? false : computeMatchingAllowed(level, needLevel, loc);
      if (level === 'not_confirmed') updates.matching_allowed = false;
      await svc.entities.LocationService.update(s.id, updates);
      await audit(svc, user, { entity_type: 'LocationService', entity_id: s.id, action_type: 'set_service_confirmation', changed_fields: Object.keys(updates), previous: { confirmation_level: s.confirmation_level, matching_allowed: s.matching_allowed }, next: updates, note });
      return Response.json({ success: true, updates });
    }

    // ---------- MIGRATION REVIEW: LOCATION ----------
    if (action === 'resolve_location_review') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const decision = p.decision;
      const note = String(p.note || '').trim();
      if (!note) return bad('Rezolvarea unui flag de review necesita o nota');
      const updates = {};
      if (decision === 'keep_directory') {
        updates.migration_review_required = false;
        updates.profile_control_status = 'directory';
      } else if (decision === 'suspend') {
        updates.migration_review_required = false;
        updates.profile_control_status = 'suspended';
        updates.profile_control_status_updated_at = new Date().toISOString();
        updates.profile_control_status_reason = note;
      } else if (decision === 'resolve_flag') {
        updates.migration_review_required = false;
      } else return bad('Decizie invalida');
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: `migration_review_${decision}`, changed_fields: Object.keys(updates), previous: { migration_review_required: loc.migration_review_required, profile_control_status: loc.profile_control_status }, next: updates, note });
      return Response.json({ success: true });
    }

    // ---------- MIGRATION REVIEW: SERVICE ----------
    if (action === 'resolve_service_review') {
      const s = await svc.entities.LocationService.get(p.service_id).catch(() => null);
      if (!s) return bad('Serviciul nu exista');
      const note = String(p.note || '').trim();
      if (!note) return bad('Rezolvarea unui flag de review necesita o nota');
      const decision = p.decision;
      const updates = { migration_review_required: false };
      if (decision === 'keep_not_confirmed') {
        updates.confirmation_level = 'not_confirmed';
        updates.matching_allowed = false;
      } else if (decision !== 'resolve_flag') return bad('Decizie invalida');
      await svc.entities.LocationService.update(s.id, updates);
      await audit(svc, user, { entity_type: 'LocationService', entity_id: s.id, action_type: `migration_review_${decision}`, changed_fields: Object.keys(updates), previous: { migration_review_required: s.migration_review_required, confirmation_level: s.confirmation_level }, next: updates, note });
      return Response.json({ success: true });
    }

    // ---------- PROFILE VERIFICATION (explicit, per record) ----------
    if (action === 'verify_profile') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const note = String(p.note || '').trim();
      if (!note) return bad('Verificarea profilului necesita o nota');
      const updates = {
        profile_control_status: 'verified',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: note,
        last_verified_at: new Date().toISOString(),
      };
      // Services are NOT auto-verified — each must be reviewed individually.
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'verify_profile', changed_fields: Object.keys(updates), previous: { profile_control_status: loc.profile_control_status }, next: { profile_control_status: 'verified' }, note });
      return Response.json({ success: true });
    }

    // ---------- SUSPEND PROFILE ----------
    if (action === 'suspend_profile') {
      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const note = String(p.note || '').trim();
      if (!note) return bad('Suspendarea necesita o nota');
      const updates = {
        profile_control_status: 'suspended',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: note,
      };
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: loc.id, action_type: 'suspend_profile', changed_fields: Object.keys(updates), previous: { profile_control_status: loc.profile_control_status }, next: { profile_control_status: 'suspended' }, note });
      return Response.json({ success: true });
    }

    // ---------- CLAIM APPROVAL (3C: no auto service upgrade) ----------
    if (action === 'approve_claim') {
      const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
      if (!claim) return bad('Revendicarea nu exista');
      if (claim.status !== 'in_asteptare') return bad('Revendicarea nu este in asteptare');
      if (!claim.location_id) return bad('Revendicarea nu are locatie asociata');
      const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
      if (!loc) return bad('Locatia revendicata nu exista');
      // Module 3H.1A.1: a location cannot be approved/activated without profile classification.
      if (!loc.provider_profile_type) return bad('Locatia nu are provider_profile_type — clasifica profilul inainte de aprobare');
      const note = String(p.note || '').trim();
      const locUpdates = {
        claim_verification_status: 'approved',
        profile_control_status: loc.profile_control_status === 'verified' ? 'verified' : 'claimed',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: note || 'Revendicare aprobata',
      };
      // New locations submitted via the public wizard go live once their claim is approved.
      if (loc.status === 'in_verificare') locUpdates.status = 'publicata';
      await svc.entities.ProviderLocation.update(loc.id, locUpdates);
      await svc.entities.ProviderClaimRequest.update(claim.id, { status: 'aprobata', reviewed_at: new Date().toISOString(), review_notes: note });
      // Provider access is granted ONLY through this explicit ownership assignment.
      if (claim.user_id) {
        const existing = await svc.entities.ProviderMembership.filter({ user_id: claim.user_id, location_id: loc.id, status: 'active' });
        if (existing.length === 0) {
          await svc.entities.ProviderMembership.create({
            user_id: claim.user_id,
            location_id: loc.id,
            organization_id: loc.organization_id || claim.organization_id || '',
            role: 'owner',
            status: 'active',
          });
        }
      }
      // Services are NOT auto-upgraded to provider_confirmed — individual review required.
      await audit(svc, user, { entity_type: 'ProviderClaimRequest', entity_id: claim.id, action_type: 'approve_claim', changed_fields: ['status', 'claim_verification_status', 'profile_control_status'], previous: { status: claim.status, profile_control_status: loc.profile_control_status }, next: locUpdates, note });
      return Response.json({ success: true });
    }

    // ---------- CLAIM REJECTION (note required) ----------
    if (action === 'reject_claim') {
      const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
      if (!claim) return bad('Revendicarea nu exista');
      if (claim.status !== 'in_asteptare') return bad('Revendicarea nu este in asteptare');
      const note = String(p.note || '').trim();
      if (!note) return bad('Respingerea unei revendicari necesita o nota');
      await svc.entities.ProviderClaimRequest.update(claim.id, { status: 'respinsa', reviewed_at: new Date().toISOString(), review_notes: note });
      if (claim.location_id) {
        const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
        if (loc) await svc.entities.ProviderLocation.update(loc.id, { claim_verification_status: 'rejected' });
      }
      await audit(svc, user, { entity_type: 'ProviderClaimRequest', entity_id: claim.id, action_type: 'reject_claim', changed_fields: ['status'], previous: { status: claim.status }, next: { status: 'respinsa' }, note });
      return Response.json({ success: true });
    }

    return bad('Actiune necunoscuta');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});