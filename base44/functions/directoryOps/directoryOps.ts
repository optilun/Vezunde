import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CANONICAL_SERVICE_KEY_SET,
  PROFILE_TYPES,
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

// Directory Data Operations (admin-only writes).
// Every write happens only through an explicit admin action and an audit record.
// Legacy verification fields are never used as source of truth.

const PROVIDER_TYPES = [
  'optica_medicala',
  'clinica_oftalmologica',
  'cabinet_oftalmologic',
  'cabinet_optometric',
  'laborator_optic',
  'optometrist_independent',
  'medic_oftalmolog_independent',
];

const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 });
}

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

function classifyKey(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  return normalized.definition?.service_need_level || 'unknown';
}

function computeMatchingAllowed(level, rawKey, loc) {
  if (!loc || loc.active_status === 'inactiva' || loc.profile_control_status === 'suspended') return false;
  const normalized = normalizeServiceKey(rawKey);
  const definition = normalized.definition;
  if (!definition) return false;
  return definition.patient_facing !== false
    && definition.b2b_only !== true
    && definition.matching_allowed_when_provider_confirmed
    && ['publicly_listed', 'provider_confirmed', 'vezunde_verified'].includes(level);
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

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Acces interzis: doar administratori Vezunde' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;

    if (action === 'catalog') {
      return Response.json({
        services: [...CANONICAL_SERVICE_KEY_SET].map((key) => getCanonicalServiceDefinition(key)),
        count: CANONICAL_SERVICE_KEY_SET.size,
      });
    }

    // ---------- CREATE ORGANIZATION + LOCATION ----------
    if (action === 'create_location') {
      const org = p.organization || {};
      const loc = p.location || {};
      const prov = p.provenance || {};

      if (!loc.name || !norm(loc.name)) return bad('Numele locatiei este obligatoriu');
      if (!PROVIDER_TYPES.includes(loc.provider_type)) return bad('Tip de furnizor invalid');
      if (!PROFILE_TYPES.includes(loc.provider_profile_type)) {
        return bad('provider_profile_type lipseste sau este invalid');
      }

      const orgType = org.organization_type || loc.provider_profile_type;
      if (!p.organization_id && !PROFILE_TYPES.includes(orgType)) {
        return bad('organization_type lipseste sau este invalid');
      }

      const sirutaCode = String(loc.locality_siruta_code || '').trim();
      if (!sirutaCode) return bad('Selectarea localitatii canonice (SIRUTA) este obligatorie');
      if (!loc.address) return bad('Adresa este obligatorie');
      if (!prov.source_url) return bad('source_url este obligatoriu pentru profiluri directory');
      if (!prov.source_checked_at) return bad('source_checked_at este obligatoriu');
      if (!prov.source_type) return bad('source_type este obligatoriu');
      if (!['low', 'medium', 'high'].includes(prov.data_confidence)) return bad('data_confidence invalid');
      if (!p.organization_id && (!org.name || !norm(org.name))) return bad('Numele organizatiei este obligatoriu');

      const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: sirutaCode, is_active: true });
      const geo = geoRows[0];
      if (!geo) return bad('Localitatea selectata nu exista sau nu este activa');
      if (loc.city && norm(loc.city) !== norm(geo.name)) {
        return bad('Orasul trimis nu corespunde localitatii canonice selectate');
      }
      if (loc.county && norm(loc.county) !== norm(geo.county_name || '')) {
        return bad('Judetul trimis nu corespunde localitatii canonice selectate');
      }
      if (loc.county_name && norm(loc.county_name) !== norm(geo.county_name || '')) {
        return bad('Judetul trimis nu corespunde localitatii canonice selectate');
      }

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
      const identity = idResRaw?.data || idResRaw || {};
      if (identity.error) return bad(`Verificarea duplicatelor a esuat: ${identity.error}`);

      const overrideReason = String(p.duplicate_override_reason || '').trim();
      if (identity.blocking_level === 'warning' && overrideReason.length < 15) {
        return Response.json({ identity_check: identity });
      }
      if (
        identity.blocking_level === 'strong_duplicate_review_required'
        && (p.force_distinct !== true || overrideReason.length < 15)
      ) {
        return Response.json({ identity_check: identity });
      }

      let organizationId = p.organization_id || null;
      if (!organizationId) {
        const newOrg = await svc.entities.ProviderOrganization.create({
          name: org.name,
          legal_name: org.legal_name || '',
          website: org.website || '',
          status: 'activa',
          organization_type: orgType,
        });
        organizationId = newOrg.id;
        await audit(svc, user, {
          entity_type: 'ProviderOrganization',
          entity_id: newOrg.id,
          action_type: 'create_organization',
          changed_fields: ['name', 'legal_name', 'website'],
          next: { name: org.name },
          note: p.note || '',
        });
      }

      const newLoc = await svc.entities.ProviderLocation.create({
        organization_id: organizationId,
        name: loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        locality_siruta_code: geo.siruta_code,
        locality_name: geo.name,
        county_code: geo.county_code || '',
        county_name: geo.county_name || '',
        uat_code: geo.uat_code || '',
        uat_name: geo.uat_name || '',
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

      await audit(svc, user, {
        entity_type: 'ProviderLocation',
        entity_id: newLoc.id,
        action_type: 'create_directory_location',
        changed_fields: ['name', 'provider_type', 'locality_siruta_code', 'city', 'county', 'address', 'source_url'],
        next: { name: loc.name, locality_siruta_code: geo.siruta_code, city: geo.name, source_url: prov.source_url },
        note: p.note || overrideReason || '',
      });

      if (identity.blocking_level === 'strong_duplicate_review_required') {
        await audit(svc, user, {
          entity_type: 'ProviderLocation',
          entity_id: newLoc.id,
          action_type: 'duplicate_override_create',
          changed_fields: ['duplicate_override_reason'],
          next: {
            blocking_level: identity.blocking_level,
            candidate_location_ids: (identity.candidates || []).map((c) => c.location_id),
          },
          note: overrideReason,
        });
      }

      return Response.json({ location: newLoc, organization_id: organizationId });
    }

    // ---------- ADD SERVICE (canonical catalog only) ----------
    if (action === 'add_service') {
      const normalized = normalizeServiceKey(p.service_key);
      if (normalized.status !== 'canonical' || !normalized.definition) {
        return bad('Serviciu in afara catalogului canonic aprobat');
      }
      if (!p.location_id) return bad('location_id lipseste');
      if (!p.service_source_url) return bad('service_source_url este obligatoriu');
      if (!p.service_confirmed_at) return bad('service_confirmed_at este obligatoriu');

      const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');
      const existing = await svc.entities.LocationService.filter({
        location_id: p.location_id,
        service_key: normalized.canonicalKey,
      });
      if (existing.length > 0) return bad('Serviciul exista deja pentru aceasta locatie');

      const level = p.set_publicly_listed === true ? 'publicly_listed' : 'not_confirmed';
      const matchingAllowed = level === 'publicly_listed'
        ? computeMatchingAllowed(level, normalized.canonicalKey, loc)
        : false;
      const definition = normalized.definition;

      const row = await svc.entities.LocationService.create({
        location_id: p.location_id,
        service_key: normalized.canonicalKey,
        service_need_level: definition.service_need_level,
        confirmation_level: level,
        matching_allowed: matchingAllowed,
        is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
        service_source_url: p.service_source_url,
        service_confirmed_at: p.service_confirmed_at,
        notes: p.notes || '',
        migration_review_required: false,
        is_active: true,
      });

      await audit(svc, user, {
        entity_type: 'LocationService',
        entity_id: row.id,
        action_type: 'add_service',
        changed_fields: ['service_key', 'confirmation_level', 'matching_allowed'],
        next: {
          service_key: normalized.canonicalKey,
          confirmation_level: level,
          matching_allowed: matchingAllowed,
        },
        note: p.notes || '',
      });
      return Response.json({ service: row, definition });
    }

    // ---------- SET SERVICE CONFIRMATION LEVEL ----------
    if (action === 'set_service_confirmation') {
      const service = await svc.entities.LocationService.get(p.service_id).catch(() => null);
      if (!service) return bad('Serviciul nu exista');
      const loc = await svc.entities.ProviderLocation.get(service.location_id).catch(() => null);
      if (!loc) return bad('Locatia nu exista');

      const level = p.level;
      const normalized = normalizeServiceKey(service.service_key);
      const definition = normalized.definition;
      const note = String(p.note || '').trim();

      if (!['not_confirmed', 'publicly_listed', 'provider_confirmed', 'vezunde_verified'].includes(level)) {
        return bad('Nivel invalid');
      }
      if (!definition && level !== 'not_confirmed') {
        return bad('Serviciu neclasificat in catalog — necesita clasificare manuala inainte de publicare');
      }

      const updates = {
        confirmation_level: level,
        service_need_level: definition?.service_need_level || 'unknown',
      };

      if (level === 'publicly_listed') {
        const srcUrl = p.service_source_url || service.service_source_url;
        const confirmedAt = p.service_confirmed_at || service.service_confirmed_at;
        if (!srcUrl) return bad('publicly_listed necesita service_source_url');
        if (!confirmedAt) return bad('publicly_listed necesita service_confirmed_at');
        updates.service_source_url = srcUrl;
        updates.service_confirmed_at = confirmedAt;
      }

      if (level === 'provider_confirmed') {
        if (!note) return bad('provider_confirmed necesita o nota de audit');
        const claims = await svc.entities.ProviderClaimRequest.filter({
          location_id: service.location_id,
          status: 'aprobata',
        });
        if (claims.length === 0) return bad('provider_confirmed necesita o revendicare aprobata pentru locatie');
        updates.service_confirmed_at = p.service_confirmed_at || new Date().toISOString();
      }

      if (level === 'vezunde_verified') {
        if ((loc.profile_control_status || 'directory') !== 'verified') {
          return bad('vezunde_verified necesita profil cu status verified');
        }
        if (!note) return bad('vezunde_verified necesita o nota de verificare');
        updates.service_verified_at = new Date().toISOString();
        updates.service_verified_by = user.email;
      }

      updates.matching_allowed = definition
        ? computeMatchingAllowed(level, normalized.canonicalKey || service.service_key, loc)
        : false;
      if (level === 'not_confirmed') updates.matching_allowed = false;

      await svc.entities.LocationService.update(service.id, updates);
      await audit(svc, user, {
        entity_type: 'LocationService',
        entity_id: service.id,
        action_type: 'set_service_confirmation',
        changed_fields: Object.keys(updates),
        previous: {
          confirmation_level: service.confirmation_level,
          matching_allowed: service.matching_allowed,
          service_need_level: service.service_need_level,
        },
        next: updates,
        note,
      });
      return Response.json({ success: true, updates, catalog_status: normalized.status, definition });
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
      } else {
        return bad('Decizie invalida');
      }

      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, {
        entity_type: 'ProviderLocation',
        entity_id: loc.id,
        action_type: `migration_review_${decision}`,
        changed_fields: Object.keys(updates),
        previous: {
          migration_review_required: loc.migration_review_required,
          profile_control_status: loc.profile_control_status,
        },
        next: updates,
        note,
      });
      return Response.json({ success: true });
    }

    // ---------- MIGRATION REVIEW: SERVICE ----------
    if (action === 'resolve_service_review') {
      const service = await svc.entities.LocationService.get(p.service_id).catch(() => null);
      if (!service) return bad('Serviciul nu exista');
      const note = String(p.note || '').trim();
      if (!note) return bad('Rezolvarea unui flag de review necesita o nota');

      const decision = p.decision;
      const updates = { migration_review_required: false };
      if (decision === 'keep_not_confirmed') {
        updates.confirmation_level = 'not_confirmed';
        updates.matching_allowed = false;
      } else if (decision !== 'resolve_flag') {
        return bad('Decizie invalida');
      }

      await svc.entities.LocationService.update(service.id, updates);
      await audit(svc, user, {
        entity_type: 'LocationService',
        entity_id: service.id,
        action_type: `migration_review_${decision}`,
        changed_fields: Object.keys(updates),
        previous: {
          migration_review_required: service.migration_review_required,
          confirmation_level: service.confirmation_level,
        },
        next: updates,
        note,
      });
      return Response.json({ success: true });
    }

    // ---------- PROFILE VERIFICATION ----------
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
      await svc.entities.ProviderLocation.update(loc.id, updates);
      await audit(svc, user, {
        entity_type: 'ProviderLocation',
        entity_id: loc.id,
        action_type: 'verify_profile',
        changed_fields: Object.keys(updates),
        previous: { profile_control_status: loc.profile_control_status },
        next: { profile_control_status: 'verified' },
        note,
      });
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
      await audit(svc, user, {
        entity_type: 'ProviderLocation',
        entity_id: loc.id,
        action_type: 'suspend_profile',
        changed_fields: Object.keys(updates),
        previous: { profile_control_status: loc.profile_control_status },
        next: { profile_control_status: 'suspended' },
        note,
      });
      return Response.json({ success: true });
    }

    // ---------- CLAIM APPROVAL ----------
    if (action === 'approve_claim') {
      const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
      if (!claim) return bad('Revendicarea nu exista');
      const alreadyApproved = claim.status === 'aprobata';
      if (!['in_asteptare', 'aprobata'].includes(claim.status)) {
        return bad('Revendicarea nu este in asteptare sau aprobata');
      }
      if (claim.mode === 'new_location_duplicate_review') {
        return bad('Cerere de clarificare duplicat — nu poate fi aprobata direct. Creeaza locatia doar prin fluxul canonic "Adauga locatie".');
      }
      if (!claim.location_id) return bad('Revendicarea nu are locatie asociata');

      const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
      if (!loc) return bad('Locatia revendicata nu exista');
      if (!loc.provider_profile_type) {
        return bad('Locatia nu are provider_profile_type — clasifica profilul inainte de aprobare');
      }

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
      if (!alreadyApproved && loc.status === 'in_verificare') locUpdates.status = 'publicata';

      if (!alreadyApproved) {
        await svc.entities.ProviderLocation.update(loc.id, locUpdates);
        await svc.entities.ProviderClaimRequest.update(claim.id, {
          status: 'aprobata',
          reviewed_at: new Date().toISOString(),
          review_notes: note,
        });
      }

      let activeMembership = null;
      if (claim.user_id) {
        const existing = await svc.entities.ProviderMembership.filter({
          user_id: claim.user_id,
          location_id: loc.id,
          status: 'active',
        });
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
          await svc.entities.ProviderWorkspaceSubmission.update(draft.id, {
            access_origin: 'provider_workspace',
          });
          promotedDraftCount += 1;
        }
      }

      if (!alreadyApproved || promotedDraftCount > 0) {
        await audit(svc, user, {
          entity_type: 'ProviderClaimRequest',
          entity_id: claim.id,
          action_type: isAccessRequest ? 'approve_access_request' : 'approve_claim',
          changed_fields: alreadyApproved
            ? ['preparation_draft_promotion']
            : ['status', 'claim_verification_status', 'profile_control_status', 'membership_role', 'preparation_draft_promotion'],
          previous: { status: claim.status, profile_control_status: loc.profile_control_status },
          next: {
            ...locUpdates,
            membership_role: memberRole,
            promoted_preparation_drafts: promotedDraftCount,
          },
          note,
        });
      }

      return Response.json({
        success: true,
        promoted_preparation_drafts: promotedDraftCount,
        already_approved: alreadyApproved,
        membership_role: memberRole,
      });
    }

    // ---------- CLAIM REJECTION ----------
    if (action === 'reject_claim') {
      const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
      if (!claim) return bad('Revendicarea nu exista');
      if (claim.status !== 'in_asteptare') return bad('Revendicarea nu este in asteptare');
      const note = String(p.note || '').trim();
      if (!note) return bad('Respingerea unei revendicari necesita o nota');

      const rejectedAt = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'respinsa',
        reviewed_at: rejectedAt,
        review_notes: note,
      });
      if (claim.location_id) {
        const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
        if (loc) {
          await svc.entities.ProviderLocation.update(loc.id, { claim_verification_status: 'rejected' });
        }
      }

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

      await audit(svc, user, {
        entity_type: 'ProviderClaimRequest',
        entity_id: claim.id,
        action_type: 'reject_claim',
        changed_fields: ['status', 'preparation_draft_lock'],
        previous: { status: claim.status },
        next: { status: 'respinsa', locked_preparation_drafts: lockedDraftCount },
        note,
      });
      return Response.json({ success: true, locked_preparation_drafts: lockedDraftCount });
    }

    return bad('Actiune necunoscuta');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
