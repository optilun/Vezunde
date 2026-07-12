import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';
import {
  evaluateServicePrerequisites,
  servicePrerequisiteStatusLabel,
} from '../../../shared/servicePrerequisiteEngine.js';
import { validateServiceConfigurationPayload } from '../../../shared/serviceConfigurationPayloadExtended.js';
import { getServiceOperationalContext } from '../../../shared/serviceOperationalTaxonomyExtended.js';

function clean(value) {
  return String(value || '').trim();
}

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function restoredMatchingAllowed(row) {
  const definition = getCanonicalServiceDefinition(row.service_key);
  if (!definition || row.is_active === false) return false;
  if (definition.requires_review || definition.service_need_level === 'specialized_medical') {
    return row.confirmation_level === 'vezunde_verified';
  }
  return definition.matching_allowed_when_provider_confirmed === true;
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
    if (definition?.requires_review && context.location.profile_control_status !== 'verified') {
      blockers.unshift({
        code: 'location_not_verified',
        message: 'Locația trebuie verificată de Vezunde înaintea aprobării unui serviciu medical.',
        required: ['verified'],
        actual: context.location.profile_control_status || 'directory',
      });
    }
    const eligible = blockers.length === 0;
    const status = blockers.some((blocker) => blocker.code === 'location_not_verified')
      ? 'requires_verified_location'
      : result.status;
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

async function upsertFunctionalUnits(svc, user, submission, payload) {
  const existing = await svc.entities.LocationFunctionalUnit.filter({ location_id: submission.location_id }, null, 100).catch(() => []);
  const desired = new Map((payload.functional_units || []).map((item) => [item.unit_key, item]));
  const removals = new Set(payload.removal_unit_keys || []);
  const now = new Date().toISOString();
  for (const row of existing) {
    if (removals.has(row.unit_key)) {
      if (row.is_active !== false) await svc.entities.LocationFunctionalUnit.update(row.id, { is_active: false, status: 'inactive', reviewed_by: user.id, reviewed_at: now });
      desired.delete(row.unit_key);
      continue;
    }
    const target = desired.get(row.unit_key);
    if (!target) continue;
    await svc.entities.LocationFunctionalUnit.update(row.id, {
      care_setting: target.care_setting,
      note: target.note || '',
      is_active: true,
      status: 'verified',
      confirmation_level: 'vezunde_verified',
      reviewed_by: user.id,
      reviewed_at: now,
    });
    desired.delete(row.unit_key);
  }
  for (const target of desired.values()) {
    if (removals.has(target.unit_key)) continue;
    await svc.entities.LocationFunctionalUnit.create({
      location_id: submission.location_id,
      unit_key: target.unit_key,
      care_setting: target.care_setting,
      note: target.note || '',
      is_active: true,
      status: 'verified',
      confirmation_level: 'vezunde_verified',
      source: 'provider_submission',
      reviewed_by: user.id,
      reviewed_at: now,
    });
  }
}

async function upsertCapabilities(svc, user, submission, payload) {
  const existing = await svc.entities.LocationCapability.filter({ location_id: submission.location_id }, null, 100).catch(() => []);
  const desired = new Map((payload.capabilities || []).map((item) => [`${item.capability_key}:${item.parent_unit_key}`, item]));
  const removals = new Set((payload.removal_capabilities || []).map((item) => `${item.capability_key}:${item.parent_unit_key}`));
  const now = new Date().toISOString();
  for (const row of existing) {
    const key = `${row.capability_key}:${row.parent_unit_key}`;
    if (removals.has(key)) {
      if (row.is_active !== false) await svc.entities.LocationCapability.update(row.id, { is_active: false, status: 'inactive', reviewed_by: user.id, reviewed_at: now });
      desired.delete(key);
      continue;
    }
    const target = desired.get(key);
    if (!target) continue;
    await svc.entities.LocationCapability.update(row.id, {
      note: target.note || '',
      is_active: true,
      status: 'verified',
      confirmation_level: 'vezunde_verified',
      reviewed_by: user.id,
      reviewed_at: now,
    });
    desired.delete(key);
  }
  for (const target of desired.values()) {
    const key = `${target.capability_key}:${target.parent_unit_key}`;
    if (removals.has(key)) continue;
    await svc.entities.LocationCapability.create({
      location_id: submission.location_id,
      capability_key: target.capability_key,
      parent_unit_key: target.parent_unit_key,
      note: target.note || '',
      is_active: true,
      status: 'verified',
      confirmation_level: 'vezunde_verified',
      source: 'provider_submission',
      reviewed_by: user.id,
      reviewed_at: now,
    });
  }
}

async function applyResourceLinks(svc, submission, payload) {
  for (const removal of payload.resource_removals?.professionals || []) {
    const row = await svc.entities.ProfessionalLocationAssignment.get(removal.assignment_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Specialist invalid în eliminările de resurse.');
    const removedUnits = new Set(removal.unit_keys || []);
    const nextUnits = removedUnits.size > 0
      ? (row.functional_unit_keys || []).filter((unitKey) => !removedUnits.has(unitKey))
      : [];
    await svc.entities.ProfessionalLocationAssignment.update(row.id, { functional_unit_keys: nextUnits });
  }
  for (const removal of payload.resource_removals?.equipment || []) {
    const row = await svc.entities.LocationEquipment.get(removal.equipment_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Echipament invalid în eliminările de resurse.');
    await svc.entities.LocationEquipment.update(row.id, { functional_unit_key: '' });
  }
  for (const removal of payload.resource_removals?.facilities || []) {
    const row = await svc.entities.LocationFacility.get(removal.facility_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Facilitate invalidă în eliminările de resurse.');
    await svc.entities.LocationFacility.update(row.id, { functional_unit_key: '' });
  }

  for (const link of payload.resource_links?.professionals || []) {
    const row = await svc.entities.ProfessionalLocationAssignment.get(link.assignment_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Specialist invalid în legăturile de resurse.');
    await svc.entities.ProfessionalLocationAssignment.update(row.id, { functional_unit_keys: link.unit_keys || [] });
  }
  for (const link of payload.resource_links?.equipment || []) {
    const row = await svc.entities.LocationEquipment.get(link.equipment_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Echipament invalid în legăturile de resurse.');
    await svc.entities.LocationEquipment.update(row.id, { functional_unit_key: link.unit_key || '' });
  }
  for (const link of payload.resource_links?.facilities || []) {
    const row = await svc.entities.LocationFacility.get(link.facility_id).catch(() => null);
    if (!row || row.location_id !== submission.location_id) throw new Error('Facilitate invalidă în legăturile de resurse.');
    await svc.entities.LocationFacility.update(row.id, { functional_unit_key: link.unit_key || '' });
  }
}

function serviceApplyData(serviceKey, existing, payload, verified) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  if (!definition) throw new Error(`Serviciu canonic necunoscut: ${serviceKey}`);
  const previousConfirmation = clean(existing?.confirmation_level);
  const confirmationLevel = definition.requires_review
    ? (verified ? 'vezunde_verified' : (previousConfirmation === 'vezunde_verified' ? 'vezunde_verified' : 'provider_confirmed'))
    : (previousConfirmation === 'vezunde_verified' ? 'vezunde_verified' : 'provider_confirmed');
  const context = getServiceOperationalContext(serviceKey);
  return {
    is_active: true,
    accepts_requests: definition.patient_facing !== false,
    service_need_level: definition.service_need_level,
    is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
    confirmation_level: confirmationLevel,
    matching_allowed: definition.patient_facing !== false && (definition.requires_review ? confirmationLevel === 'vezunde_verified' : definition.matching_allowed_when_provider_confirmed),
    functional_unit_key: payload.service_unit_map?.[serviceKey] || context?.unitKey || '',
    capability_key: context?.capabilityKey || '',
    migration_review_required: false,
    provider_visibility_status: 'active',
    removal_submission_id: '',
  };
}

async function applyServices(svc, submission, payload, verifiedKeys = new Set()) {
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
      const data = serviceApplyData(serviceKey, rows[0], payload, verifiedKeys.has(serviceKey));
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
  const result = await base44.functions.invoke('adminWorkspaceReview', {
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

Deno.serve(async (req) => {
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

    const rawPayload = await withLegacyRemovalDiffs(svc, submission.location_id, parsePayload(submission.payload_json));
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

      await upsertFunctionalUnits(svc, user, submission, payload);
      await upsertCapabilities(svc, user, submission, payload);
      await applyResourceLinks(svc, submission, payload);
      await svc.entities.ProviderLocation.update(submission.location_id, { care_setting: payload.care_setting || 'not_applicable' });

      // Apply first as provider-confirmed. Medical promotion happens only after a fresh read of all dependencies.
      await applyServices(svc, submission, payload, new Set());
      const persistedContext = await loadContext(svc, submission.location_id, null, true);
      const postEvaluation = evaluatePayload(payload, {
        ...persistedContext,
        service_unit_map: payload.service_unit_map || {},
      });
      const verifiedKeys = new Set(postEvaluation.evaluations
        .filter((item) => item.eligible && item.requires_review)
        .map((item) => item.service_key));
      await applyServices(svc, submission, payload, verifiedKeys);
      const suggestionIds = await persistSuggestions(svc, user, submission, payload);

      const now = new Date().toISOString();
      await svc.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status: 'approved',
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
          promoted_services: [...verifiedKeys],
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
        promoted_services: [...verifiedKeys],
        suggestion_ids: suggestionIds,
        warning: postEvaluation.approval_allowed ? '' : 'Configurația a fost aplicată, dar unele servicii medicale au rămas nepublice după revalidare.',
        prerequisite_review: reviewPayload(payload, postEvaluation),
      });
    }

    if (action === 'reject' || action === 'request_more_info') {
      const result = await delegate(base44, action, input);
      if (action === 'reject' && !result?.error) await restoreRemovalVisibility(svc, submission);
      return Response.json(result);
    }

    return Response.json({ error: 'Acțiune necunoscută' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neașteptată' }, { status: 500 });
  }
});
