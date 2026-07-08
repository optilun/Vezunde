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
function parseJSON(value) { try { return value ? JSON.parse(value) : {}; } catch (_e) { return {}; } }

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

      // Module 3H.1B.1: deterministic, read-only identity gate (shared function).
      // Never auto-merges and never alters existing locations.
      const idResRaw = await base44.functions.invoke('findProviderIdentityCandidates', {
        context: 'admin_create',
        candidate: {
          organization_name: org.name || '',
          location_name: loc.name,
          provider_profile_type: loc.provider_profile_type,
          locality_siruta_code: geo.siruta_code,
          address: loc.address,
          phone_public: loc.phone_public || '',
          public_email: loc.public_email || '',
          website: loc.website || org.website || '',
        },
        limit: 10,
      });
      const identity = (idResRaw && idResRaw.data) ? idResRaw.data : (idResRaw || {});
      if (identity.error) return bad('Verificarea duplicatelor a esuat: ' + identity.error);
      const overrideReason = String(p.duplicate_override_reason || '').trim();
      // warning: admin may continue only with an override reason (min 15 chars).
      if (identity.blocking_level === 'warning' && overrideReason.length < 15) {
        return Response.json({ identity_check: identity });
      }
      // strong duplicate: normal create is blocked — explicit override + reason required.
      if (identity.blocking_level === 'strong_duplicate_review_required' && (p.force_distinct !== true || overrideReason.length < 15)) {
        return Response.json({ identity_check: identity });
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
      await audit(svc, user, { entity_type: 'ProviderLocation', entity_id: newLoc.id, action_type: 'create_directory_location', changed_fields: ['name', 'provider_type', 'locality_siruta_code', 'city', 'county', 'address', 'source_url'], next: { name: loc.name, locality_siruta_code: geo.siruta_code, city: geo.name, source_url: prov.source_url }, note: p.note || overrideReason || '' });
      // Module 3H.1B.1: strong-duplicate override gets its own explicit audit record.
      if (identity.blocking_level === 'strong_duplicate_review_required') {
        await audit(svc, user, {
          entity_type: 'ProviderLocation', entity_id: newLoc.id,
          action_type: 'duplicate_override_create',
          changed_fields: ['duplicate_override_reason'],
          next: { blocking_level: identity.blocking_level, candidate_location_ids: (identity.candidates || []).map((c) => c.location_id) },
          note: overrideReason,
        });
      }
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
      const alreadyApproved = claim.status === 'aprobata';
      if (!['in_asteptare', 'aprobata'].includes(claim.status)) return bad('Revendicarea nu este in asteptare sau aprobata');
      // Module 3H.1B.2: duplicate-review requests can never be approved into a
      // location — a genuinely distinct location goes through the canonical
      // "Adauga locatie" admin flow only.
      if (claim.mode === 'new_location_duplicate_review') return bad('Cerere de clarificare duplicat — nu poate fi aprobata direct. Creeaza locatia doar prin fluxul canonic "Adauga locatie".');
      if (!claim.location_id) return bad('Revendicarea nu are locatie asociata');
      const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
      if (!loc) return bad('Locatia revendicata nu exista');
      // Module 3H.1A.1: a location cannot be approved/activated without profile classification.
      if (!loc.provider_profile_type) return bad('Locatia nu are provider_profile_type — clasifica profilul inainte de aprobare');
      const note = String(p.note || '').trim();
      const submitted = parseJSON(claim.submitted_payload);
      const isAccessRequest = submitted.request_type === 'access_request_existing_claimed_profile';
      const memberRole = isAccessRequest ? 'location_staff' : 'organization_owner';
      const locUpdates = alreadyApproved ? {} : {
        claim_verification_status: 'approved',
        profile_control_status: loc.profile_control_status === 'verified' ? 'verified' : 'claimed',
        profile_control_status_updated_at: new Date().toISOString(),
        profile_control_status_reason: note || (isAccessRequest ? 'Cerere acces aprobata' : 'Revendicare aprobata'),
      };
      // New locations submitted via the public wizard go live once their claim is approved.
      if (!alreadyApproved && loc.status === 'in_verificare') locUpdates.status = 'publicata';
      if (!alreadyApproved) {
        await svc.entities.ProviderLocation.update(loc.id, locUpdates);
        await svc.entities.ProviderClaimRequest.update(claim.id, { status: 'aprobata', reviewed_at: new Date().toISOString(), review_notes: note });
      }
      // Provider access is granted ONLY through this explicit assignment.
      // Normal first claims become organization_owner. Access requests to an already
      // administered profile become location_staff by default to avoid silent ownership takeover.
      let activeMembership = null;
      if (claim.user_id) {
        const existing = await svc.entities.ProviderMembership.filter({ user_id: claim.user_id, location_id: loc.id, status: 'active' });
        activeMembership = existing[0] || null;
        if (!activeMembership && !alreadyApproved) {
          activeMembership = await svc.entities.ProviderMembership.create({
            user_id: claim.user_id,
            location_id: loc.id,
            organization_id: loc.organization_id || claim.organization_id || null,
            role: memberRole,
            status: 'active',
          });
        }
      }
      // Module 3H.1C.3A: promote only this claimant's unlocked preparation drafts.
      // Idempotent: already-promoted drafts no longer match access_origin=claim_preparation.
      let promotedDraftCount = 0;
      if (activeMembership && claim.user_id) {
        const prepDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({
          claim_request_id: claim.id,
          submitted_by_user_id: claim.user_id,
          access_origin: 'claim_preparation',
          location_id: loc.id,
          status: { $in: ['draft', 'needs_more_info'] },
        }, '-created_date', 100);
        for (const draft of prepDrafts) {
          if (draft.preparation_locked_at) continue;
          await svc.entities.ProviderWorkspaceSubmission.update(draft.id, { access_origin: 'provider_workspace' });
          promotedDraftCount += 1;
        }
      }
      // Services are NOT auto-upgraded to provider_confirmed — individual review required.
      if (!alreadyApproved || promotedDraftCount > 0) {
        await audit(svc, user, { entity_type: 'ProviderClaimRequest', entity_id: claim.id, action_type: isAccessRequest ? 'approve_access_request' : 'approve_claim', changed_fields: alreadyApproved ? ['preparation_draft_promotion'] : ['status', 'claim_verification_status', 'profile_control_status', 'membership_role', 'preparation_draft_promotion'], previous: { status: claim.status, profile_control_status: loc.profile_control_status }, next: { ...locUpdates, membership_role: memberRole, promoted_preparation_drafts: promotedDraftCount }, note });
      }
      return Response.json({ success: true, promoted_preparation_drafts: promotedDraftCount, already_approved: alreadyApproved, membership_role: memberRole });
    }

    // ---------- CLAIM REJECTION (note required) ----------
    if (action === 'reject_claim') {
      const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
      if (!claim) return bad('Revendicarea nu exista');
      if (claim.status !== 'in_asteptare') return bad('Revendicarea nu este in asteptare');
      const note = String(p.note || '').trim();
      if (!note) return bad('Respingerea unei revendicari necesita o nota');
      const rejectedAt = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, { status: 'respinsa', reviewed_at: rejectedAt, review_notes: note });
      if (claim.location_id) {
        const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
        if (loc) await svc.entities.ProviderLocation.update(loc.id, { claim_verification_status: 'rejected' });
      }
      // Module 3H.1C.3A: rejected-claim preparation drafts remain admin-auditable
      // but are explicitly locked and hidden from applicant/provider workspaces.
      const prepDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({
        claim_request_id: claim.id,
        access_origin: 'claim_preparation',
      }, '-created_date', 100);
      let lockedDraftCount = 0;
      for (const draft of prepDrafts) {
        if (draft.preparation_locked_at) continue;
        await svc.entities.ProviderWorkspaceSubmission.update(draft.id, {
          preparation_locked_at: rejectedAt,
          preparation_lock_reason: 'claim_rejected',
        });
        lockedDraftCount += 1;
      }
      await audit(svc, user, { entity_type: 'ProviderClaimRequest', entity_id: claim.id, action_type: 'reject_claim', changed_fields: ['status', 'preparation_draft_lock'], previous: { status: claim.status }, next: { status: 'respinsa', locked_preparation_drafts: lockedDraftCount }, note });
      return Response.json({ success: true, locked_preparation_drafts: lockedDraftCount });
    }

    return bad('Actiune necunoscuta');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});