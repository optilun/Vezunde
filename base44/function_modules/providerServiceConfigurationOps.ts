import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getCanonicalServiceDefinition } from '../../shared/canonicalServiceRegistryExtended.js';
import {
  getFunctionalUnitLayout,
  profileAllowsCapability,
  profileAllowsFunctionalUnit,
} from '../../shared/locationOperationalRegistry.js';
import { validateServiceConfigurationPayload } from '../../shared/serviceConfigurationPayloadExtended.js';

const ACTIVE_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const EDITOR_ROLES = ['organization_owner', 'location_manager'];

function clean(value) {
  return String(value || '').trim();
}

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function hasApprovedOperationalContext(payload) {
  return Array.isArray(payload?.functional_units)
    && Array.isArray(payload?.capabilities)
    && payload?.service_unit_map
    && typeof payload.service_unit_map === 'object'
    && !Array.isArray(payload.service_unit_map)
    && payload?.resource_links
    && typeof payload.resource_links === 'object'
    && !Array.isArray(payload.resource_links);
}

async function loadApprovedOperationalPayload(svc, locationId) {
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: locationId,
    section: 'services',
    status: 'approved',
  }, '-reviewed_at', 10).catch(() => []);
  for (const submission of submissions) {
    const payload = parsePayload(submission.payload_json);
    if (hasApprovedOperationalContext(payload)) return payload;
  }
  return null;
}

function removalServiceKeys(payload = {}) {
  return [...new Set([
    ...Object.values(payload.removal_ids || {}).flat(),
    ...(payload.raw_removal_keys || []),
  ].map(clean).filter(Boolean))];
}

function restoredMatchingAllowed(row) {
  const definition = getCanonicalServiceDefinition(row.service_key);
  if (!definition || row.is_active === false) return false;
  return definition.patient_facing !== false
    && definition.b2b_only !== true
    && definition.matching_allowed_when_provider_confirmed === true;
}

async function restoreRemovalVisibility(svc, locationId, submissionId) {
  const rows = await svc.entities.LocationService.filter({
    location_id: locationId,
    removal_submission_id: submissionId,
  }, null, 700).catch(() => []);
  for (const row of rows) {
    const definition = getCanonicalServiceDefinition(row.service_key);
    await svc.entities.LocationService.update(row.id, {
      provider_visibility_status: 'active',
      removal_submission_id: '',
      accepts_requests: row.is_active !== false && definition?.patient_facing !== false,
      matching_allowed: restoredMatchingAllowed(row),
    });
  }
}

async function syncRemovalVisibility(svc, user, submission, payload) {
  await restoreRemovalVisibility(svc, submission.location_id, submission.id);
  const keys = removalServiceKeys(payload);
  const now = new Date().toISOString();
  for (const serviceKey of keys) {
    const rows = await svc.entities.LocationService.filter({
      location_id: submission.location_id,
      service_key: serviceKey,
    }, null, 20).catch(() => []);
    for (const row of rows) {
      if (row.is_active === false) continue;
      await svc.entities.LocationService.update(row.id, {
        provider_visibility_status: 'removal_pending',
        removal_submission_id: submission.id,
        provider_suspended_at: now,
        provider_suspended_by: user.id,
        accepts_requests: false,
        matching_allowed: false,
      });
    }
  }
}

function normalizeRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'manager') return 'location_manager';
  if (role === 'staff') return 'location_staff';
  return clean(role);
}

function safeSubmission(submission) {
  const showNote = ['needs_more_info', 'rejected'].includes(submission.status);
  return {
    id: submission.id,
    organization_id: submission.organization_id || null,
    location_id: submission.location_id,
    claim_request_id: submission.claim_request_id || '',
    access_origin: submission.access_origin || 'provider_workspace',
    section: submission.section,
    status: submission.status,
    payload_json: submission.payload_json || '{}',
    submitted_at: submission.submitted_at || null,
    admin_note: showNote ? (submission.admin_note || '') : '',
    created_date: submission.created_date,
    updated_date: submission.updated_date,
  };
}

function isLockedPreparation(submission) {
  return Boolean(submission.preparation_locked_at) || submission.preparation_lock_reason === 'claim_rejected';
}

function isPromotedPrivateDraft(submission) {
  return (submission.access_origin || 'provider_workspace') === 'provider_workspace' && Boolean(submission.claim_request_id);
}

function conflict(submission) {
  return {
    conflict: true,
    section: 'services',
    status: submission.status,
    message: 'Există deja o modificare în lucru pentru serviciile acestei locații.',
  };
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
    action_type: record.action_type,
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function resolveAccess(svc, user, payload) {
  const requestedLocationId = clean(payload.location_id);
  if (requestedLocationId) {
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: requestedLocationId,
      status: 'active',
    });
    const membership = memberships.find((item) => EDITOR_ROLES.includes(normalizeRole(item.role)));
    if (membership) {
      const loc = await svc.entities.ProviderLocation.get(requestedLocationId).catch(() => null);
      if (!loc) return { valid: false, status: 404, body: { error: 'Locația nu a fost găsită' } };
      if (loc.profile_control_status === 'suspended') return { valid: false, status: 403, body: { error: 'Profilul este suspendat' } };
      return {
        valid: true,
        mode: 'provider_workspace',
        loc,
        location_id: requestedLocationId,
        claim: null,
      };
    }
    const staffMembership = memberships.find((item) => normalizeRole(item.role) === 'location_staff');
    if (staffMembership) {
      const loc = await svc.entities.ProviderLocation.get(requestedLocationId).catch(() => null);
      if (!loc) return { valid: false, status: 404, body: { error: 'Locația nu a fost găsită' } };
      if (loc.profile_control_status === 'suspended') return { valid: false, status: 403, body: { error: 'Profilul este suspendat' } };
      return {
        valid: true,
        readOnly: true,
        mode: 'provider_workspace',
        loc,
        location_id: requestedLocationId,
        claim: null,
      };
    }
  }

  const claimId = clean(payload.claim_request_id);
  let claim = null;
  if (claimId) claim = await svc.entities.ProviderClaimRequest.get(claimId).catch(() => null);
  else if (requestedLocationId) {
    const claims = await svc.entities.ProviderClaimRequest.filter({
      user_id: user.id,
      location_id: requestedLocationId,
      status: { $in: ACTIVE_CLAIM_STATUSES },
    }, '-created_date', 5);
    claim = claims[0] || null;
  }

  if (!claim || claim.user_id !== user.id) return { valid: false, status: 403, body: { error: 'Nu ai acces la această locație sau revendicare' } };
  if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) return { valid: false, status: 403, body: { error: 'Revendicarea nu permite pregătire în acest status' } };
  if (!claim.location_id) return { valid: false, status: 400, body: { error: 'Revendicarea nu are locație asociată' } };
  if (requestedLocationId && requestedLocationId !== claim.location_id) return { valid: false, status: 403, body: { error: 'Revendicarea nu aparține acestei locații' } };

  const loc = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
  if (!loc) return { valid: false, status: 404, body: { error: 'Locația revendicată nu a fost găsită' } };
  return { valid: true, mode: 'applicant_preparation', loc, location_id: claim.location_id, claim };
}

function validateProfileCompatibility(loc, cleanPayload) {
  const invalidUnits = (cleanPayload.functional_units || [])
    .map((item) => item.unit_key)
    .filter((key) => !profileAllowsFunctionalUnit(loc.provider_profile_type, loc.provider_type, key));
  if (invalidUnits.length > 0) return { error: 'Unele spații nu sunt compatibile cu profilul locației.', fields: invalidUnits };

  const invalidCapabilities = (cleanPayload.capabilities || [])
    .map((item) => item.capability_key)
    .filter((key) => !profileAllowsCapability(loc.provider_profile_type, loc.provider_type, key));
  if (invalidCapabilities.length > 0) return { error: 'Unele capabilități nu sunt compatibile cu profilul locației.', fields: invalidCapabilities };

  const layout = getFunctionalUnitLayout(loc.provider_profile_type, loc.provider_type);
  if (cleanPayload.care_setting && !(layout.careSettings || []).includes(cleanPayload.care_setting)) {
    return { error: 'Cadrul de îngrijire nu este compatibil cu profilul locației.', fields: [cleanPayload.care_setting] };
  }
  return null;
}

function validateSubmissionReadiness() {
  // The payload validator already protects schema integrity. At launch, services
  // are provider-declared, so units, capabilities and resources are optional and
  // cannot prevent a draft from being submitted.
  return null;
}

async function assertReferences(svc, locationId, payload) {
  for (const ids of Object.values(payload.removal_ids || {})) {
    for (const serviceKey of ids) {
      const rows = await svc.entities.LocationService.filter({ location_id: locationId, service_key: serviceKey });
      if (!rows.some((row) => row.is_active !== false)) throw new Error(`Serviciul aprobat nu există activ: ${serviceKey}`);
    }
  }

  const removalUnitKeys = payload.removal_unit_keys || [];
  const removalCapabilities = payload.removal_capabilities || [];
  if (removalUnitKeys.length > 0 || removalCapabilities.length > 0) {
    const approvedPayload = await loadApprovedOperationalPayload(svc, locationId);
    const approvedUnitKeys = new Set((approvedPayload?.functional_units || []).map((item) => item.unit_key));
    const approvedCapabilities = new Set((approvedPayload?.capabilities || []).map(
      (item) => `${item.capability_key}:${item.parent_unit_key}`,
    ));
    for (const unitKey of removalUnitKeys) {
      if (!approvedUnitKeys.has(unitKey)) throw new Error(`Spațiul aprobat nu există activ: ${unitKey}`);
    }
    for (const removal of removalCapabilities) {
      const key = `${removal.capability_key}:${removal.parent_unit_key}`;
      if (!approvedCapabilities.has(key)) throw new Error(`Activitatea aprobată nu există activ: ${removal.capability_key}`);
    }
  }

  for (const rawKey of payload.raw_removal_keys || []) {
    const rows = await svc.entities.LocationService.filter({ location_id: locationId, service_key: rawKey });
    if (!rows.some((row) => row.is_active !== false)) throw new Error(`Serviciul legacy sau necunoscut nu există activ: ${rawKey}`);
  }

  for (const removal of payload.resource_removals?.professionals || []) {
    const assignment = await svc.entities.ProfessionalLocationAssignment.get(removal.assignment_id).catch(() => null);
    if (!assignment || assignment.location_id !== locationId) throw new Error('Specialistul eliminat nu aparține locației.');
  }
  for (const removal of payload.resource_removals?.equipment || []) {
    const equipment = await svc.entities.LocationEquipment.get(removal.equipment_id).catch(() => null);
    if (!equipment || equipment.location_id !== locationId) throw new Error('Echipamentul eliminat nu aparține locației.');
  }
  for (const removal of payload.resource_removals?.facilities || []) {
    const facility = await svc.entities.LocationFacility.get(removal.facility_id).catch(() => null);
    if (!facility || facility.location_id !== locationId) throw new Error('Facilitatea eliminată nu aparține locației.');
  }

  for (const link of payload.resource_links?.professionals || []) {
    const assignment = await svc.entities.ProfessionalLocationAssignment.get(link.assignment_id).catch(() => null);
    if (!assignment || assignment.location_id !== locationId) throw new Error('Specialistul selectat nu aparține locației.');
  }
  for (const link of payload.resource_links?.equipment || []) {
    const equipment = await svc.entities.LocationEquipment.get(link.equipment_id).catch(() => null);
    if (!equipment || equipment.location_id !== locationId) throw new Error('Echipamentul selectat nu aparține locației.');
  }
  for (const link of payload.resource_links?.facilities || []) {
    const facility = await svc.entities.LocationFacility.get(link.facility_id).catch(() => null);
    if (!facility || facility.location_id !== locationId) throw new Error('Facilitatea selectată nu aparține locației.');
  }
}

function activeSubmissionQuery(access) {
  if (access.mode === 'applicant_preparation') {
    return {
      location_id: access.location_id,
      claim_request_id: access.claim.id,
      access_origin: 'claim_preparation',
      submitted_by_user_id: access.claim.user_id,
      section: 'services',
      status: { $in: ACTIVE_STATUSES },
    };
  }
  return {
    location_id: access.location_id,
    access_origin: 'provider_workspace',
    section: 'services',
    status: { $in: ACTIVE_STATUSES },
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesară' }, { status: 401 });
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = clean(payload.action || 'list_mine');
    if (!['list_mine', 'create_draft', 'update_draft', 'submit', 'withdraw'].includes(action)) {
      return Response.json({ error: 'Acțiune invalidă' }, { status: 400 });
    }

    const access = await resolveAccess(svc, user, payload);
    if (!access.valid) return Response.json(access.body, { status: access.status });
    if (access.readOnly && action !== 'list_mine') {
      return Response.json({ error: 'Serviciile publice pot fi modificate numai de owner sau managerul locației.' }, { status: 403 });
    }

    if (action === 'list_mine') {
      if (access.readOnly) {
        return Response.json({ mode: access.mode, read_only: true, submissions: [], conflicts: [] });
      }
      if (access.mode === 'applicant_preparation') {
        const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
          location_id: access.location_id,
          claim_request_id: access.claim.id,
          access_origin: 'claim_preparation',
          submitted_by_user_id: user.id,
          section: 'services',
        }, '-created_date', 50);
        return Response.json({ mode: access.mode, submissions: rows.filter((item) => !isLockedPreparation(item)).map(safeSubmission), conflicts: [] });
      }
      const own = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: access.location_id,
        submitted_by_user_id: user.id,
        access_origin: 'provider_workspace',
        section: 'services',
      }, '-created_date', 50);
      const active = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: access.location_id,
        access_origin: 'provider_workspace',
        section: 'services',
        status: { $in: ACTIVE_STATUSES },
      }, '-created_date', 50);
      return Response.json({
        mode: access.mode,
        submissions: own.map(safeSubmission),
        conflicts: active
          .filter((item) => item.submitted_by_user_id !== user.id && !isPromotedPrivateDraft(item))
          .map(conflict),
      });
    }

    if (action === 'create_draft' || action === 'update_draft') {
      if (!payload.payload) return Response.json({ error: 'payload este obligatoriu' }, { status: 400 });
      const validation = validateServiceConfigurationPayload(payload.payload, {
        allowSuggestions: access.mode === 'provider_workspace',
        allowRawRemovals: access.mode === 'provider_workspace',
        allowOperationalContext: true,
      });
      if (!validation.valid) return Response.json({ error: validation.error, fields: validation.fields || [] }, { status: 400 });
      const profileError = validateProfileCompatibility(access.loc, validation.clean);
      if (profileError) return Response.json(profileError, { status: 400 });
      await assertReferences(svc, access.location_id, validation.clean);

      if (action === 'create_draft') {
        const existing = await svc.entities.ProviderWorkspaceSubmission.filter(activeSubmissionQuery(access), '-created_date', 10);
        if (existing.length > 0) {
          const own = existing.find((item) => item.submitted_by_user_id === user.id && !isLockedPreparation(item));
          if (own) return Response.json({ submission: safeSubmission(own), resumed: true });
          const blocking = existing.find((item) => (item.access_origin || 'provider_workspace') === 'provider_workspace' && !isPromotedPrivateDraft(item));
          if (blocking) return Response.json(conflict(blocking), { status: 409 });
        }
        const submission = await svc.entities.ProviderWorkspaceSubmission.create({
          organization_id: access.loc.organization_id || null,
          location_id: access.location_id,
          claim_request_id: access.mode === 'applicant_preparation' ? access.claim.id : '',
          access_origin: access.mode === 'applicant_preparation' ? 'claim_preparation' : 'provider_workspace',
          section: 'services',
          payload_json: JSON.stringify(validation.clean),
          status: 'draft',
          submitted_by_user_id: user.id,
        });
        await audit(svc, user, {
          entity_type: 'ProviderWorkspaceSubmission', entity_id: submission.id,
          action_type: access.mode === 'applicant_preparation' ? 'create_claim_service_configuration_draft' : 'create_service_configuration_draft',
          changed_fields: ['section', 'status', 'payload_json'],
          next: { section: 'services', status: 'draft' },
          note: 'Draft creat pentru configurația completă a serviciilor și unităților locației.',
        });
        return Response.json({ submission: safeSubmission(submission) });
      }

      const submissionId = clean(payload.submission_id);
      if (!submissionId) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
      const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
      if (!submission) return Response.json({ error: 'Draftul nu a fost găsit' }, { status: 404 });
      if (isLockedPreparation(submission)) return Response.json({ error: 'Draftul de pregătire este blocat' }, { status: 403 });
      if (submission.location_id !== access.location_id || submission.section !== 'services') return Response.json({ error: 'Draftul nu aparține acestei locații' }, { status: 403 });
      if (submission.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poți modifica acest draft' }, { status: 403 });
      if (!['draft', 'needs_more_info'].includes(submission.status)) return Response.json({ error: 'Doar drafturile pot fi modificate' }, { status: 400 });
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { payload_json: JSON.stringify(validation.clean), status: 'draft' });
      if (submission.submitted_at) await syncRemovalVisibility(svc, user, submission, validation.clean);
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: submission.id,
        action_type: 'update_service_configuration_draft',
        changed_fields: ['payload_json', 'status'], previous: { status: submission.status }, next: { status: 'draft' },
        note: 'Configurația serviciilor și unităților a fost actualizată.',
      });
      return Response.json({ success: true });
    }

    const submissionId = clean(payload.submission_id);
    if (!submissionId) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
    const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
    if (!submission) return Response.json({ error: 'Submissionul nu a fost găsit' }, { status: 404 });
    if (submission.location_id !== access.location_id || submission.section !== 'services') return Response.json({ error: 'Submissionul nu aparține locației' }, { status: 403 });
    if (submission.submitted_by_user_id !== user.id) return Response.json({ error: 'Nu poți modifica acest submission' }, { status: 403 });

    if (action === 'submit') {
      if (access.mode !== 'provider_workspace') return Response.json({ error: 'Draftul de revendicare nu poate fi trimis înainte de aprobarea revendicării' }, { status: 403 });
      if (!['draft', 'needs_more_info'].includes(submission.status)) return Response.json({ error: 'Draftul nu poate fi trimis' }, { status: 400 });
      const storedPayload = parsePayload(submission.payload_json);
      const validation = validateServiceConfigurationPayload(storedPayload, {
        allowSuggestions: true,
        allowRawRemovals: true,
        allowOperationalContext: true,
      });
      if (!validation.valid) return Response.json({ error: validation.error, fields: validation.fields || [] }, { status: 400 });
      const profileError = validateProfileCompatibility(access.loc, validation.clean);
      if (profileError) return Response.json(profileError, { status: 400 });
      const readinessError = validateSubmissionReadiness(validation.clean);
      if (readinessError) return Response.json(readinessError, { status: 400 });
      const now = new Date().toISOString();
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'pending_review', submitted_at: now });
      await syncRemovalVisibility(svc, user, submission, parsePayload(submission.payload_json));
      await audit(svc, user, {
        entity_type: 'ProviderWorkspaceSubmission', entity_id: submission.id,
        action_type: 'submit_service_configuration_for_review',
        changed_fields: ['status', 'submitted_at'], previous: { status: submission.status }, next: { status: 'pending_review' },
        note: 'Configurația completă a serviciilor a fost trimisă spre verificare.',
      });
      return Response.json({ success: true });
    }

    if (!ACTIVE_STATUSES.includes(submission.status)) return Response.json({ error: 'Submissionul nu poate fi retras' }, { status: 400 });
    await restoreRemovalVisibility(svc, submission.location_id, submission.id);
    await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { status: 'withdrawn' });
    await audit(svc, user, {
      entity_type: 'ProviderWorkspaceSubmission', entity_id: submission.id,
      action_type: 'withdraw_service_configuration', changed_fields: ['status'],
      previous: { status: submission.status }, next: { status: 'withdrawn' },
      note: 'Configurația serviciilor a fost retrasă.',
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neașteptată' }, { status: 500 });
  }
}
