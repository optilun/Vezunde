import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from '../../shared/canonicalServiceRegistryExtended.js';
import {
  evaluateServicePrerequisites,
  servicePrerequisiteStatusLabel,
} from '../../shared/servicePrerequisiteEngine.js';
import { validateServiceConfigurationPayload } from '../../shared/serviceConfigurationPayloadExtended.js';
import { getServiceOperationalContext } from '../../shared/serviceOperationalTaxonomyExtended.js';
import { invokeDirectoryFunction } from '../../shared/directoryFunctionRouting.js';

function clean(value) {
  return String(value || '').trim();
}

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasApprovedOperationalContext(payload) {
  return Array.isArray(payload?.functional_units)
    && Array.isArray(payload?.capabilities)
    && isObject(payload?.service_unit_map)
    && isObject(payload?.resource_links);
}

async function loadApprovedOperationalSnapshot(svc, locationId) {
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: locationId,
    section: 'services',
    status: 'approved',
  }, '-reviewed_at', 10).catch(() => []);
  for (const submission of submissions) {
    const rawPayload = parsePayload(submission.payload_json);
    if (!hasApprovedOperationalContext(rawPayload)) continue;
    const validation = validateServiceConfigurationPayload(rawPayload, {
      allowSuggestions: true,
      allowRawRemovals: true,
      allowOperationalContext: true,
    });
    if (!validation.valid) continue;
    return {
      ...validation.clean,
      removal_ids: {},
      raw_removal_keys: [],
      removal_unit_keys: [],
      removal_capabilities: [],
      resource_removals: { professionals: [], equipment: [], facilities: [] },
    };
  }
  return null;
}

function restoredMatchingAllowed(row) {
  const definition = getCanonicalServiceDefinition(row.service_key);
  if (!definition || row.is_active === false) return false;
  return definition.patient_facing !== false
    && definition.b2b_only !== true
    && definition.matching_allowed_when_provider_confirmed === true;
}

// Geamanul lui carryWorkingDraftForward din providerServiceConfigurationOps.ts. Cele doua
// fisiere sunt functii Base44 separate, fara import comun intre ele, deci logica e scrisa de
// doua ori intentionat - orice schimbare aici trebuie facuta si acolo.
async function carryWorkingDraftForward(svc, submission) {
  const submitted = submission.submitted_payload_json || '';
  const working = submission.payload_json || '';
  if (!submitted || !working || submitted === working) return null;
  return await svc.entities.ProviderWorkspaceSubmission.create({
    organization_id: submission.organization_id || null,
    location_id: submission.location_id,
    claim_request_id: submission.claim_request_id || '',
    access_origin: submission.access_origin || 'provider_workspace',
    section: 'services',
    payload_json: working,
    status: 'draft',
    submitted_by_user_id: submission.submitted_by_user_id,
  }).catch(() => null);
}

async function restoreRemovalVisibility(svc, submission) {
  const rows = await svc.entities.LocationService.filter({
    location_id: submission.location_id,
    removal_submission_id: submission.id,
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

async function withLegacyRemovalDiffs(svc, locationId, payload) {
  const next = { ...payload };
  if (payload.removal_unit_keys === undefined) {
    const existing = await svc.entities.LocationFunctionalUnit?.filter({ location_id: locationId }, null, 100).catch(() => []) || [];
    const desired = new Set((payload.functional_units || []).map((item) => item.unit_key));
    next.removal_unit_keys = existing.filter((item) => item.is_active !== false && !desired.has(item.unit_key)).map((item) => item.unit_key);
  }
  if (payload.removal_capabilities === undefined) {
    const existing = await svc.entities.LocationCapability?.filter({ location_id: locationId }, null, 100).catch(() => []) || [];
    const desired = new Set((payload.capabilities || []).map((item) => `${item.capability_key}:${item.parent_unit_key}`));
    next.removal_capabilities = existing
      .filter((item) => item.is_active !== false && !desired.has(`${item.capability_key}:${item.parent_unit_key}`))
      .map((item) => ({ capability_key: item.capability_key, parent_unit_key: item.parent_unit_key }));
  }
  if (payload.resource_removals === undefined) next.resource_removals = { professionals: [], equipment: [], facilities: [] };
  return next;
}

function selectedServiceKeys(payload) {
  return [...new Set(Object.values(payload?.selected_ids || {}).flat().map(clean).filter(Boolean))];
}

function overlayResources(rows, links, type) {
  const byId = new Map((links || []).map((link) => [
    type === 'professionals' ? link.assignment_id : type === 'equipment' ? link.equipment_id : link.facility_id,
    link,
  ]));
  return (rows || []).map((row) => {
    const link = byId.get(row.id);
    if (!link) return row;
    if (type === 'professionals') return { ...row, functional_unit_keys: link.unit_keys || [] };
    return { ...row, functional_unit_key: link.unit_key || '' };
  });
}

function overlayResourceRemovals(rows, removals, type) {
  const byId = new Map((removals || []).map((removal) => [
    type === 'professionals' ? removal.assignment_id : type === 'equipment' ? removal.equipment_id : removal.facility_id,
    removal,
  ]));
  return (rows || []).map((row) => {
    const removal = byId.get(row.id);
    if (!removal) return row;
    if (type === 'professionals') {
      const removedUnits = new Set(removal.unit_keys || []);
      return {
        ...row,
        functional_unit_keys: removedUnits.size > 0
          ? (row.functional_unit_keys || []).filter((unitKey) => !removedUnits.has(unitKey))
          : [],
      };
    }
    return { ...row, functional_unit_key: '' };
  });
}

async function loadApprovedPayload(svc, locationId) {
  const snapshot = await loadApprovedOperationalSnapshot(svc, locationId);
  if (snapshot) return snapshot;

  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) throw new Error('Locația nu a fost găsită');
  const [services, units, capabilities, assignments, equipment, facilities] = await Promise.all([
    svc.entities.LocationService.filter({ location_id: locationId }, null, 700),
    svc.entities.LocationFunctionalUnit?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
    svc.entities.LocationCapability?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
    svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ' }, null, 300),
    svc.entities.LocationEquipment.filter({ location_id: locationId }, null, 500).catch(() => []),
    svc.entities.LocationFacility.filter({ location_id: locationId }, null, 500).catch(() => []),
  ]);

  const selectedIds = {};
  const serviceUnitMap = {};
  for (const service of services.filter((row) => row.is_active !== false)) {
    const definition = getCanonicalServiceDefinition(service.service_key);
    if (!definition) continue;
    selectedIds[definition.group] = selectedIds[definition.group] || [];
    if (!selectedIds[definition.group].includes(definition.key)) selectedIds[definition.group].push(definition.key);
    if (service.functional_unit_key) serviceUnitMap[definition.key] = service.functional_unit_key;
  }

  return {
    selected_ids: selectedIds,
    removal_ids: {},
    raw_removal_keys: [],
    suggestions: [],
    functional_units: units.filter((row) => row.is_active !== false).map((row) => ({
      unit_key: row.unit_key,
      care_setting: row.care_setting || location.care_setting || 'not_applicable',
      note: row.note || '',
    })),
    removal_unit_keys: [],
    capabilities: capabilities.filter((row) => row.is_active !== false).map((row) => ({
      capability_key: row.capability_key,
      parent_unit_key: row.parent_unit_key,
      note: row.note || '',
    })),
    removal_capabilities: [],
    service_unit_map: serviceUnitMap,
    resource_links: {
      professionals: assignments.filter((row) => (row.functional_unit_keys || []).length > 0).map((row) => ({ assignment_id: row.id, unit_keys: row.functional_unit_keys || [] })),
      equipment: equipment.filter((row) => row.is_active !== false && row.functional_unit_key).map((row) => ({ equipment_id: row.id, unit_key: row.functional_unit_key })),
      facilities: facilities.filter((row) => row.is_active !== false && row.functional_unit_key).map((row) => ({ facility_id: row.id, unit_key: row.functional_unit_key })),
    },
    resource_removals: { professionals: [], equipment: [], facilities: [] },
    care_setting: location.care_setting || 'not_applicable',
  };
}

function blockerSignature(serviceKey, blocker) {
  return JSON.stringify({
    service_key: serviceKey,
    code: blocker.code || '',
    required: blocker.required || [],
    actual: blocker.actual || [],
  });
}

function allowPreExistingBlockers(evaluation, baselineEvaluation) {
  const baselineSignatures = new Set(baselineEvaluation.evaluations.flatMap((item) => item.blockers.map((blocker) => blockerSignature(item.service_key, blocker))));
  const newlyBlocked = evaluation.evaluations.filter((item) => item.blockers.some((blocker) => !baselineSignatures.has(blockerSignature(item.service_key, blocker))));
  return {
    ...evaluation,
    approval_allowed: newlyBlocked.length === 0,
    newly_blocked: newlyBlocked,
    summary: {
      ...evaluation.summary,
      pre_existing_blocked_count: evaluation.blocked.length - newlyBlocked.length,
      newly_blocked_count: newlyBlocked.length,
    },
  };
}

async function loadContext(svc, locationId, payload = null, persisted = false) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) throw new Error('Locația nu a fost găsită');
  const [assignmentsRaw, equipmentRaw, facilitiesRaw, persistedUnits, persistedCapabilities] = await Promise.all([
    svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ' }, null, 300),
    svc.entities.LocationEquipment.filter({ location_id: locationId }, null, 500).catch(() => []),
    svc.entities.LocationFacility.filter({ location_id: locationId }, null, 500).catch(() => []),
    svc.entities.LocationFunctionalUnit?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
    svc.entities.LocationCapability?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
  ]);

  const assignments = payload
    ? overlayResources(overlayResourceRemovals(assignmentsRaw, payload.resource_removals?.professionals, 'professionals'), payload.resource_links?.professionals, 'professionals')
    : assignmentsRaw;
  const equipment = payload
    ? overlayResources(overlayResourceRemovals(equipmentRaw, payload.resource_removals?.equipment, 'equipment'), payload.resource_links?.equipment, 'equipment')
    : equipmentRaw;
  const facilities = payload
    ? overlayResources(overlayResourceRemovals(facilitiesRaw, payload.resource_removals?.facilities, 'facilities'), payload.resource_links?.facilities, 'facilities')
    : facilitiesRaw;

  const professionalIds = [...new Set(assignments.map((item) => item.professional_id).filter(Boolean))];
  const professionals = (await Promise.all(
    professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
  )).filter(Boolean);

  const functionalUnits = payload && !persisted
    ? (payload.functional_units || []).map((item) => ({ ...item, is_active: true, confirmation_level: 'provider_confirmed' }))
    : (persistedUnits || []).filter((item) => item.is_active !== false);
  const capabilities = payload && !persisted
    ? (payload.capabilities || []).map((item) => ({ ...item, is_active: true, confirmation_level: 'provider_confirmed' }))
    : (persistedCapabilities || []).filter((item) => item.is_active !== false);

  return {
    location,
    assignments,
    professionals,
    equipment,
    facilities,
    functionalUnits,
    capabilities,
    enforceUnitScope: functionalUnits.length > 0,
    service_unit_map: payload?.service_unit_map || {},
  };
}

function evaluatePayload(payload, context) {
  const keys = selectedServiceKeys(payload);
  const evaluations = keys.map((key) => {
    const result = evaluateServicePrerequisites(key, {
      ...context,
      serviceUnitKey: payload.service_unit_map?.[key] || getServiceOperationalContext(key)?.unitKey || '',
      capabilityKey: getServiceOperationalContext(key)?.capabilityKey || '',
    });
    const definition = result.definition || getCanonicalServiceDefinition(key);
    const blockers = [...result.blockers];
    const eligible = result.eligible;
    const status = result.status;
    return {
      service_key: key,
      label: definition?.label || key,
      group: definition?.group || null,
      kind: definition?.kind || null,
      functional_unit_key: payload.service_unit_map?.[key] || result.evidence?.service_unit_key || '',
      capability_key: result.evidence?.capability_key || '',
      requires_review: definition?.requires_review === true,
      eligible,
      status,
      status_label: servicePrerequisiteStatusLabel(status),
      blockers,
      evidence: result.evidence,
      required_professional_types: result.definition?.required_professional_types || [],
      required_equipment_types: result.definition?.required_equipment_types || [],
      equipment_requirement_mode: result.definition?.equipment_requirement_mode || 'all',
      required_infrastructure_types: result.definition?.required_infrastructure_types || [],
    };
  });
  const blocked = evaluations.filter((item) => !item.eligible);
  return {
    evaluations,
    blocked,
    approval_allowed: blocked.length === 0,
    summary: {
      selected_count: evaluations.length,
      eligible_count: evaluations.length - blocked.length,
      blocked_count: blocked.length,
      medical_review_count: evaluations.filter((item) => item.requires_review).length,
      functional_unit_count: payload.functional_units?.length || 0,
      capability_count: payload.capabilities?.length || 0,
      linked_resource_count: Object.values(payload.resource_links || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0),
    },
  };
}

function reviewPayload(payload, evaluation) {
  return {
    approval_allowed: evaluation.approval_allowed,
    summary: evaluation.summary,
    services: evaluation.evaluations,
    operational_context: {
      functional_units: payload.functional_units || [],
      capabilities: payload.capabilities || [],
      care_setting: payload.care_setting || 'not_applicable',
      service_unit_map: payload.service_unit_map || {},
      resource_links: payload.resource_links || { professionals: [], equipment: [], facilities: [] },
      removal_unit_keys: payload.removal_unit_keys || [],
      removal_capabilities: payload.removal_capabilities || [],
      resource_removals: payload.resource_removals || { professionals: [], equipment: [], facilities: [] },
    },
  };
}

async function writeAudit(svc, user, submission, actionType, changedFields, next, note) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: actionType,
    changed_fields: changedFields,
    previous_values: '{}',
    new_values: JSON.stringify(next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: note || '',
    performed_at: new Date().toISOString(),
  });
}

function serviceApplyData(serviceKey, existing, casServiceKeys = []) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
  const previousConfirmation = clean(existing?.confirmation_level);
  const confirmationLevel = previousConfirmation === 'vezunde_verified' ? 'vezunde_verified' : 'provider_confirmed';
  return {
    is_active: true,
    accepts_requests: definition.patient_facing !== false,
    service_need_level: definition.service_need_level,
    is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
    confirmation_level: confirmationLevel,
    matching_allowed: definition.patient_facing !== false
      && definition.b2b_only !== true
      && definition.matching_allowed_when_provider_confirmed === true,
    // Decontare CAS, declarata de furnizor per serviciu (2026-08-06). Informatie
    // declarativa, nu verificata cu documente - la fel ca restul serviciilor.
    cas_reimbursed: casServiceKeys.includes(serviceKey),
    migration_review_required: false,
    provider_visibility_status: 'active',
    removal_submission_id: '',
  };
}

async function applyServices(svc, submission, payload) {
  const mirrorSpecialization = async (serviceKey, active) => {
    const existing = await svc.entities.LocationSpecialization.filter({ location_id: submission.location_id, specialization_key: serviceKey });
    if (existing[0]) await svc.entities.LocationSpecialization.update(existing[0].id, { is_active: active });
    else if (active) await svc.entities.LocationSpecialization.create({ location_id: submission.location_id, specialization_key: serviceKey, is_active: true });
  };

  for (const [group, ids] of Object.entries(payload.selected_ids || {})) {
    for (const serviceKey of ids) {
      const definition = getCanonicalServiceDefinition(serviceKey);
      if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
      const rows = await svc.entities.LocationService.filter({ location_id: submission.location_id, service_key: serviceKey });
      const data = serviceApplyData(serviceKey, rows[0], Array.isArray(payload.cas_service_keys) ? payload.cas_service_keys : []);
      if (rows[0]) await svc.entities.LocationService.update(rows[0].id, data);
      else await svc.entities.LocationService.create({ location_id: submission.location_id, service_key: serviceKey, ...data });
      if (group === 'specialties' || definition.group === 'specialties') await mirrorSpecialization(serviceKey, true);
    }
  }

  for (const [group, ids] of Object.entries(payload.removal_ids || {})) {
    for (const serviceKey of ids) {
      const rows = await svc.entities.LocationService.filter({ location_id: submission.location_id, service_key: serviceKey });
      for (const row of rows) await svc.entities.LocationService.update(row.id, { is_active: false, accepts_requests: false, matching_allowed: false, provider_visibility_status: 'active', removal_submission_id: '' });
      const definition = getCanonicalServiceDefinition(serviceKey);
      if (group === 'specialties' || definition?.group === 'specialties') await mirrorSpecialization(serviceKey, false);
    }
  }

  for (const rawKey of payload.raw_removal_keys || []) {
    const normalized = normalizeServiceKey(rawKey);
    if (normalized.status === 'canonical') throw new Error('Cheia canonică trebuie eliminată prin removal_ids');
    const rows = await svc.entities.LocationService.filter({ location_id: submission.location_id, service_key: rawKey });
    if (rows.length === 0) throw new Error(`Serviciul legacy sau necunoscut nu există: ${rawKey}`);
    for (const row of rows) await svc.entities.LocationService.update(row.id, { is_active: false, accepts_requests: false, matching_allowed: false, provider_visibility_status: 'active', removal_submission_id: '' });
  }
}

async function persistSuggestions(svc, user, submission, payload) {
  if (!svc.entities.ServiceCatalogSuggestion?.create) return [];
  const created = [];
  for (const suggestion of payload.suggestions || []) {
    const row = await svc.entities.ServiceCatalogSuggestion.create({
      location_id: submission.location_id,
      submission_id: submission.id,
      proposed_label: suggestion.label,
      proposed_group: suggestion.group,
      proposed_unit_key: suggestion.functional_unit_key || '',
      proposed_capability_key: suggestion.capability_key || '',
      provider_note: suggestion.note || '',
      status: 'pending_catalog_review',
      submitted_by_user_id: submission.submitted_by_user_id,
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
    }).catch(() => null);
    if (row) created.push(row.id);
  }
  return created;
}

async function delegate(base44, action, payload) {
  const result = await invokeDirectoryFunction(base44, 'adminWorkspaceReview', {
    action,
    submission_id: payload.submission_id,
    status: payload.status,
    section: payload.section,
    location_id: payload.location_id,
    organization_id: payload.organization_id,
    note: payload.note || '',
  });
  return result?.data || result || {};
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesară' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces permis doar administratorilor Vezunde' }, { status: 403 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list');

    if (action === 'list') return Response.json(await delegate(base44, 'list', input));

    const submissionId = clean(input.submission_id);
    if (!submissionId) return Response.json({ error: 'submission_id este obligatoriu' }, { status: 400 });
    const submission = await svc.entities.ProviderWorkspaceSubmission.get(submissionId).catch(() => null);
    if (!submission) return Response.json({ error: 'Submissionul nu a fost găsit' }, { status: 404 });
    if (submission.section !== 'services') return Response.json(await delegate(base44, action, input));

    // Copia inghetata la trimitere, nu payload-ul de lucru (2026-08-23). De cand furnizorul
    // poate edita in paralel cu verificarea, payload_json se poate schimba sub adminul care
    // tocmai citeste ecranul - iar aceasta linie ruleaza identic si la `get`, si la `approve`,
    // deci fara inghetare s-ar fi aprobat altceva decat s-a vazut. Fallback pe payload_json
    // pentru randurile trimise inainte de existenta campului.
    const reviewSource = submission.submitted_payload_json || submission.payload_json;
    const rawPayload = await withLegacyRemovalDiffs(svc, submission.location_id, parsePayload(reviewSource));
    const validation = validateServiceConfigurationPayload(rawPayload, {
      allowSuggestions: true,
      allowRawRemovals: true,
      allowOperationalContext: true,
    });
    if (!validation.valid) return Response.json({ error: validation.error, fields: validation.fields || [] }, { status: 400 });
    const payload = validation.clean;

    const [draftContext, approvedPayload] = await Promise.all([
      loadContext(svc, submission.location_id, payload, false),
      loadApprovedPayload(svc, submission.location_id),
    ]);
    const approvedContext = await loadContext(svc, submission.location_id, approvedPayload, false);
    const baselineEvaluation = evaluatePayload(approvedPayload, approvedContext);
    const evaluation = allowPreExistingBlockers(evaluatePayload(payload, draftContext), baselineEvaluation);

    if (action === 'get') {
      return Response.json({ submission, prerequisite_review: reviewPayload(payload, evaluation) });
    }

    if (action === 'approve') {
      if (submission.status !== 'pending_review') return Response.json({ error: 'Submissionul nu este în așteptare' }, { status: 400 });
      if (!evaluation.approval_allowed) {
        return Response.json({
          error: 'Configurația nu poate fi aprobată deoarece există cerințe neîndeplinite.',
          code: 'SERVICE_CONFIGURATION_REQUIREMENTS_NOT_MET',
          prerequisite_review: reviewPayload(payload, evaluation),
          newly_blocked_services: evaluation.newly_blocked || [],
        }, { status: 409 });
      }

      // The complete operational context remains in the approved submission.
      // The live schema does not expose separate unit/capability entities or
      // unit-link fields on resources, so approval applies only supported
      // LocationService fields.

      // Services are provider-declared at launch. Approval keeps the generic
      // administrative workflow, but does not promote declarations to verified.
      // Aplicarea nu e tranzactionala: scrie serviciu cu serviciu. Daca esueaza la
      // jumatate (retea, limita, serviciu necunoscut), o parte raman scrise iar cererea
      // ar ramane blocata in "pending_review", fara ca cineva sa stie ce s-a aplicat.
      // Marcam progresul in nota de audit si, la esec, lasam cererea intr-o stare
      // recuperabila cu mesaj explicit pentru admin (2026-08-06).
      try {
        await applyServices(svc, submission, payload);
      } catch (applyError) {
        const failureNote = `Aplicare intrerupta: ${applyError.message}. O parte din servicii pot fi deja scrise. Reincearca aprobarea - operatia e idempotenta si reia de la starea curenta.`;
        // Cererea RAMANE in pending_review, ca aprobarea sa poata fi reluata (linia de
        // mai sus accepta doar acest status). Scriem doar nota, ca adminul sa stie ce
        // s-a intamplat, plus o inregistrare de audit.
        await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
          admin_note: failureNote,
        }).catch(() => {});
        await writeAudit(
          svc,
          user,
          submission,
          'approve_service_configuration_failed',
          ['status'],
          { error: applyError.message },
        ).catch(() => {});
        return Response.json({ error: failureNote }, { status: 500 });
      }
      const postApplyContext = await loadContext(svc, submission.location_id, payload, false);
      const postEvaluation = evaluatePayload(payload, {
        ...postApplyContext,
        service_unit_map: payload.service_unit_map || {},
      });
      const providerDeclaredKeys = postEvaluation.evaluations.map((item) => item.service_key);
      const suggestionIds = await persistSuggestions(svc, user, submission, payload);

      const now = new Date().toISOString();
      // Randul aprobat devine sursa de adevar pentru starea aprobata (zone, capabilitati,
      // maparea serviciu-zona traiesc doar aici), deci payload_json trebuie sa fie exact ce
      // s-a aprobat - adica payload-ul inghetat, nu ce a mai lucrat furnizorul intre timp.
      // Munca aceea nu se pierde: trece inaintea suprascrierii intr-un draft nou, care devine
      // randul lui activ si care isi va recalcula eliminarile fata de noua baza aprobata la
      // prima salvare.
      await carryWorkingDraftForward(svc, submission);
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'approved',
        payload_json: submission.submitted_payload_json || submission.payload_json || '',
        submitted_payload_json: '',
        reviewed_by_user_id: user.id,
        reviewed_at: now,
        admin_note: clean(input.note),
      });
      await writeAudit(
        svc,
        user,
        submission,
        'approve_service_configuration',
        ['status', 'functional_units', 'capabilities', 'resource_links', 'services', 'care_setting'],
        {
          prerequisite_summary: postEvaluation.summary,
          provider_declared_services: providerDeclaredKeys,
          promoted_services: [],
          suggestion_ids: suggestionIds,
          functional_units: payload.functional_units,
          removal_unit_keys: payload.removal_unit_keys,
          capabilities: payload.capabilities,
          removal_capabilities: payload.removal_capabilities,
          resource_removals: payload.resource_removals,
        },
        clean(input.note) || 'Configurația completă a serviciilor a fost aprobată și aplicată.',
      );

      return Response.json({
        success: true,
        provider_declared_services: providerDeclaredKeys,
        promoted_services: [],
        suggestion_ids: suggestionIds,
        warning: '',
        prerequisite_review: reviewPayload(payload, postEvaluation),
      });
    }

    if (action === 'reject' || action === 'request_more_info') {
      const result = await delegate(base44, action, input);
      // Si la request_more_info, nu doar la reject (2026-08-23, decizie Alex). Regula pe
      // care o aplicam de acum: un serviciu propus spre eliminare e ascuns din cautare si
      // din matching DOAR cat timp cererea e efectiv in verificare. Cand adminul cere
      // informatii, mingea trece inapoi la furnizor si decizia nu mai e in curs - putea sta
      // zile intregi asa, cu serviciile lui invizibile pentru pacienti pentru o eliminare
      // care s-ar putea sa nu se intample niciodata. Reject facea deja lucrul corect;
      // request_more_info era exceptia, nu regula.
      if (!result?.error) {
        await restoreRemovalVisibility(svc, submission);
        // La respingere randul moare, deci munca de dupa trimitere trece intr-un draft nou.
        // La "Cere informatii" randul RAMANE al furnizorului (needs_more_info e status activ)
        // si payload_json e deja munca lui in lucru - nu are ce sa fie mutat nicaieri.
        if (action === 'reject') await carryWorkingDraftForward(svc, submission);
        // In ambele cazuri copia inghetata nu mai are rost: nu mai exista o cerere in
        // verificare pe care sa o protejeze.
        await svc.entities.ProviderWorkspaceSubmission.update(submission.id, { submitted_payload_json: '' }).catch(() => {});
      }
      return Response.json(result);
    }

    return Response.json({ error: 'Acțiune necunoscută' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neașteptată' }, { status: 500 });
  }
}