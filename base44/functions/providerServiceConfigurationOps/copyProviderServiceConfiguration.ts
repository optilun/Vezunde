import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  getServiceGroupLayout,
  normalizeServiceKey,
} from '../../shared/canonicalServiceRegistryExtended.js';
import {
  getFunctionalUnitDefinition,
  getFunctionalUnitLayout,
  isCapabilityParentAllowed,
  profileAllowsCapability,
  profileAllowsFunctionalUnit,
} from '../../shared/locationOperationalRegistry.js';
import { getServiceOperationalContext } from '../../shared/serviceOperationalTaxonomyExtended.js';
import { validateServiceConfigurationPayload } from '../../shared/serviceConfigurationPayloadExtended.js';

const EDITOR_ROLES = ['organization_owner', 'location_manager'];
const ACTIVE_DRAFT_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const MAX_TARGETS = 30;

function clean(value) {
  return String(value || '').trim();
}

function reject(error, status = 400, details = {}) {
  return Response.json({ error, ...details }, { status });
}

function unique(values) {
  return [...new Set((values || []).map(clean).filter(Boolean))];
}

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'manager') return 'location_manager';
  return clean(role);
}

function locationLabel(location) {
  return location?.public_display_name || location?.name || 'Locatie';
}

function locationPlace(location) {
  return location?.locality_name || location?.locality || location?.city || '';
}

function isEligibleLocation(location) {
  return Boolean(
    location
      && location.profile_control_status !== 'suspended'
      && location.status !== 'suspendata'
      && location.claim_verification_status === 'approved',
  );
}

function hasApprovedOperationalContext(payload) {
  return Array.isArray(payload?.functional_units)
    && Array.isArray(payload?.capabilities)
    && isObject(payload?.service_unit_map)
    && isObject(payload?.resource_links);
}

function serviceIdentity(row) {
  const normalized = normalizeServiceKey(row?.service_key);
  if (row?.is_active === false || normalized.status !== 'canonical') return null;
  const definition = getCanonicalServiceDefinition(normalized.canonicalKey);
  if (!definition) return null;
  return {
    key: normalized.canonicalKey,
    group: definition.group,
    label: definition.label || normalized.canonicalKey,
    row,
  };
}

function serviceGroupObject(keys) {
  const grouped = {};
  for (const serviceKey of unique(keys)) {
    const definition = getCanonicalServiceDefinition(serviceKey);
    if (!definition?.group) continue;
    grouped[definition.group] = grouped[definition.group] || [];
    grouped[definition.group].push(serviceKey);
  }
  return Object.fromEntries(
    Object.entries(grouped)
      .map(([group, ids]) => [group, unique(ids).sort()])
      .filter(([, ids]) => ids.length > 0),
  );
}

function removalGroupObject(currentKeys, desiredKeys) {
  const desired = new Set(desiredKeys);
  return serviceGroupObject(currentKeys.filter((serviceKey) => !desired.has(serviceKey)));
}

function allowedServiceGroups(location) {
  const layout = getServiceGroupLayout(location?.provider_profile_type, location?.provider_type);
  return new Set([...(layout?.primary || []), ...(layout?.secondary || [])]);
}

function serviceAllowedForLocation(serviceKey, location) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  return Boolean(definition?.group && allowedServiceGroups(location).has(definition.group));
}

function unitRow(unitKey, careSetting, note = '') {
  const definition = getFunctionalUnitDefinition(unitKey);
  const medical = clean(definition?.kind).startsWith('medical');
  return {
    unit_key: unitKey,
    care_setting: medical ? careSetting : (definition?.defaultCareSetting || 'not_applicable'),
    note: clean(note),
  };
}

function capabilityKey(row) {
  return `${clean(row?.capability_key)}:${clean(row?.parent_unit_key)}`;
}

function copyResourceLinks(value = {}) {
  return {
    professionals: Array.isArray(value.professionals)
      ? value.professionals.map((item) => ({ assignment_id: clean(item.assignment_id), unit_keys: unique(item.unit_keys) })).filter((item) => item.assignment_id && item.unit_keys.length > 0)
      : [],
    equipment: Array.isArray(value.equipment)
      ? value.equipment.map((item) => ({ equipment_id: clean(item.equipment_id), unit_key: clean(item.unit_key) })).filter((item) => item.equipment_id && item.unit_key)
      : [],
    facilities: Array.isArray(value.facilities)
      ? value.facilities.map((item) => ({ facility_id: clean(item.facility_id), unit_key: clean(item.unit_key) })).filter((item) => item.facility_id && item.unit_key)
      : [],
  };
}

async function activeMembershipsForUser(svc, userId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 1000);
  return rows.filter((membership) => EDITOR_ROLES.includes(normalizeRole(membership.role)));
}

function canEditLocation(memberships, locationId) {
  return memberships.some((membership) => membership.location_id === locationId && EDITOR_ROLES.includes(normalizeRole(membership.role)));
}

async function loadApprovedPayload(svc, locationId) {
  const rows = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: locationId,
    section: 'services',
    status: 'approved',
  }, '-reviewed_at', 10).catch(() => []);
  for (const row of rows) {
    const payload = parsePayload(row.payload_json);
    if (hasApprovedOperationalContext(payload)) return { submission: row, payload };
  }
  return { submission: rows[0] || null, payload: parsePayload(rows[0]?.payload_json) };
}

async function loadLocationState(svc, location) {
  const [services, approved, functionalUnits, capabilities, assignments, equipment, facilities, activeDrafts] = await Promise.all([
    svc.entities.LocationService.filter({ location_id: location.id }, 'service_key', 700).catch(() => []),
    loadApprovedPayload(svc, location.id),
    svc.entities.LocationFunctionalUnit?.filter({ location_id: location.id }, null, 100).catch(() => []) || [],
    svc.entities.LocationCapability?.filter({ location_id: location.id }, null, 100).catch(() => []) || [],
    svc.entities.ProfessionalLocationAssignment.filter({ location_id: location.id, active_status: 'activ' }, null, 300).catch(() => []),
    svc.entities.LocationEquipment.filter({ location_id: location.id }, null, 500).catch(() => []),
    svc.entities.LocationFacility.filter({ location_id: location.id }, null, 500).catch(() => []),
    svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: location.id,
      access_origin: 'provider_workspace',
      section: 'services',
      status: { $in: ACTIVE_DRAFT_STATUSES },
    }, '-created_date', 20).catch(() => []),
  ]);

  const approvedPayload = approved.payload || {};
  const approvedContext = hasApprovedOperationalContext(approvedPayload);
  const serviceItems = services.map(serviceIdentity).filter(Boolean);
  const serviceKeys = unique(serviceItems.map((item) => item.key));
  const serviceRowsByKey = Object.fromEntries(serviceItems.map((item) => [item.key, item.row]));
  const units = approvedContext
    ? approvedPayload.functional_units
    : functionalUnits.filter((item) => item.is_active !== false && item.active_status !== 'inactiv');
  const caps = approvedContext
    ? approvedPayload.capabilities
    : capabilities.filter((item) => item.is_active !== false && item.active_status !== 'inactiv');
  const serviceUnitMap = Object.fromEntries(serviceKeys.map((serviceKey) => {
    const row = serviceRowsByKey[serviceKey];
    return [serviceKey, clean(approvedPayload.service_unit_map?.[serviceKey]) || clean(row?.functional_unit_key)];
  }).filter(([, unitKey]) => unitKey));

  const entityResourceLinks = {
    professionals: assignments
      .map((item) => ({ assignment_id: item.id, unit_keys: unique(item.functional_unit_keys) }))
      .filter((item) => item.unit_keys.length > 0),
    equipment: equipment
      .map((item) => ({ equipment_id: item.id, unit_key: clean(item.functional_unit_key) }))
      .filter((item) => item.unit_key),
    facilities: facilities
      .map((item) => ({ facility_id: item.id, unit_key: clean(item.functional_unit_key) }))
      .filter((item) => item.unit_key),
  };

  return {
    location,
    serviceKeys,
    units: (units || []).map((item) => ({
      unit_key: clean(item.unit_key),
      care_setting: clean(item.care_setting || 'not_applicable'),
      note: clean(item.note),
    })).filter((item) => item.unit_key),
    capabilities: (caps || []).map((item) => ({
      capability_key: clean(item.capability_key),
      parent_unit_key: clean(item.parent_unit_key),
      note: clean(item.note),
    })).filter((item) => item.capability_key && item.parent_unit_key),
    serviceUnitMap,
    resourceLinks: copyResourceLinks(approvedContext ? approvedPayload.resource_links : entityResourceLinks),
    careSetting: clean(approvedPayload.care_setting || location.care_setting || 'not_applicable'),
    activeDraft: activeDrafts[0] || null,
  };
}

function resolveCareSetting(targetState) {
  const layout = getFunctionalUnitLayout(targetState.location?.provider_profile_type, targetState.location?.provider_type);
  const allowed = layout?.careSettings || [];
  if (allowed.includes(targetState.careSetting)) return targetState.careSetting;
  return allowed[0] || 'not_applicable';
}

function sourceServiceSummary(sourceState) {
  return sourceState.serviceKeys.map((serviceKey) => ({
    key: serviceKey,
    label: getCanonicalServiceDefinition(serviceKey)?.label || serviceKey,
    group: getCanonicalServiceDefinition(serviceKey)?.group || '',
  }));
}

function buildTargetPayload(sourceState, targetState, mode) {
  const compatibleSourceKeys = sourceState.serviceKeys.filter((serviceKey) => serviceAllowedForLocation(serviceKey, targetState.location));
  const skippedSourceKeys = sourceState.serviceKeys.filter((serviceKey) => !compatibleSourceKeys.includes(serviceKey));
  const desiredKeys = mode === 'replace'
    ? compatibleSourceKeys
    : unique([...targetState.serviceKeys, ...compatibleSourceKeys]);
  const careSetting = resolveCareSetting(targetState);
  const unitMap = new Map(targetState.units.map((item) => [item.unit_key, { ...item }]));
  const serviceUnitMap = {};

  for (const serviceKey of desiredKeys) {
    const context = getServiceOperationalContext(serviceKey);
    if (context?.sectionKey === 'business_attributes') continue;
    const candidates = unique([
      targetState.serviceUnitMap[serviceKey],
      sourceState.serviceUnitMap[serviceKey],
      context?.unitKey,
      ...(context?.fallbackUnitKeys || []),
    ]);
    const unitKey = candidates.find((candidate) => profileAllowsFunctionalUnit(
      targetState.location?.provider_profile_type,
      targetState.location?.provider_type,
      candidate,
    ));
    if (!unitKey) continue;
    serviceUnitMap[serviceKey] = unitKey;
    if (!unitMap.has(unitKey)) unitMap.set(unitKey, unitRow(unitKey, careSetting));
  }

  for (const links of [targetState.resourceLinks.professionals, targetState.resourceLinks.equipment, targetState.resourceLinks.facilities]) {
    for (const link of links) {
      const keys = Array.isArray(link.unit_keys) ? link.unit_keys : [link.unit_key];
      for (const unitKey of keys.filter(Boolean)) {
        if (!unitMap.has(unitKey) && profileAllowsFunctionalUnit(
          targetState.location?.provider_profile_type,
          targetState.location?.provider_type,
          unitKey,
        )) unitMap.set(unitKey, unitRow(unitKey, careSetting));
      }
    }
  }

  const capabilityMap = new Map(targetState.capabilities.map((item) => [capabilityKey(item), { ...item }]));
  for (const serviceKey of desiredKeys) {
    const context = getServiceOperationalContext(serviceKey);
    const cap = clean(context?.capabilityKey);
    const parentUnitKey = clean(serviceUnitMap[serviceKey]);
    if (!cap || !parentUnitKey) continue;
    if (!profileAllowsCapability(targetState.location?.provider_profile_type, targetState.location?.provider_type, cap)) continue;
    if (!isCapabilityParentAllowed(cap, parentUnitKey)) continue;
    const row = { capability_key: cap, parent_unit_key: parentUnitKey, note: '' };
    capabilityMap.set(capabilityKey(row), row);
  }

  const functionalUnits = [...unitMap.values()].filter((item) => profileAllowsFunctionalUnit(
    targetState.location?.provider_profile_type,
    targetState.location?.provider_type,
    item.unit_key,
  ));
  const functionalUnitKeys = new Set(functionalUnits.map((item) => item.unit_key));
  const capabilities = [...capabilityMap.values()].filter((item) => (
    functionalUnitKeys.has(item.parent_unit_key)
      && profileAllowsCapability(targetState.location?.provider_profile_type, targetState.location?.provider_type, item.capability_key)
      && isCapabilityParentAllowed(item.capability_key, item.parent_unit_key)
  ));
  const filteredResourceLinks = {
    professionals: targetState.resourceLinks.professionals
      .map((item) => ({ ...item, unit_keys: item.unit_keys.filter((unitKey) => functionalUnitKeys.has(unitKey)) }))
      .filter((item) => item.unit_keys.length > 0),
    equipment: targetState.resourceLinks.equipment.filter((item) => functionalUnitKeys.has(item.unit_key)),
    facilities: targetState.resourceLinks.facilities.filter((item) => functionalUnitKeys.has(item.unit_key)),
  };

  const rawPayload = {
    selected_ids: serviceGroupObject(desiredKeys),
    removal_ids: mode === 'replace' ? removalGroupObject(targetState.serviceKeys, desiredKeys) : {},
    raw_removal_keys: [],
    suggestions: [],
    functional_units: functionalUnits,
    removal_unit_keys: [],
    capabilities,
    removal_capabilities: [],
    service_unit_map: Object.fromEntries(Object.entries(serviceUnitMap).filter(([serviceKey, unitKey]) => desiredKeys.includes(serviceKey) && functionalUnitKeys.has(unitKey))),
    resource_links: filteredResourceLinks,
    resource_removals: { professionals: [], equipment: [], facilities: [] },
    care_setting: careSetting,
  };
  const validation = validateServiceConfigurationPayload(rawPayload, {
    allowSuggestions: true,
    allowRawRemovals: true,
    allowOperationalContext: true,
  });

  const desiredSet = new Set(desiredKeys);
  const currentSet = new Set(targetState.serviceKeys);
  return {
    compatibleSourceKeys,
    skippedSourceKeys,
    payload: validation.valid ? validation.clean : null,
    validationError: validation.valid ? '' : validation.error,
    addedKeys: desiredKeys.filter((serviceKey) => !currentSet.has(serviceKey)),
    removedKeys: mode === 'replace' ? targetState.serviceKeys.filter((serviceKey) => !desiredSet.has(serviceKey)) : [],
  };
}

function targetPreview(sourceState, targetState, mode, userId) {
  const built = buildTargetPayload(sourceState, targetState, mode);
  const activeDraft = targetState.activeDraft;
  let blockedReason = '';
  if (activeDraft?.status === 'pending_review') blockedReason = 'Exista deja o configuratie trimisa spre aprobare.';
  else if (activeDraft && activeDraft.submitted_by_user_id !== userId) blockedReason = 'Exista deja un draft creat de alt utilizator.';
  else if (!built.payload) blockedReason = built.validationError || 'Configuratia nu este compatibila cu locatia tinta.';
  else if (built.compatibleSourceKeys.length === 0) blockedReason = 'Niciun serviciu al sursei nu este compatibil cu aceasta locatie.';

  return {
    id: targetState.location.id,
    name: locationLabel(targetState.location),
    locality: locationPlace(targetState.location),
    current_service_count: targetState.serviceKeys.length,
    compatible_service_count: built.compatibleSourceKeys.length,
    added_count: built.addedKeys.length,
    removed_count: built.removedKeys.length,
    skipped_services: built.skippedSourceKeys.map((serviceKey) => ({
      key: serviceKey,
      label: getCanonicalServiceDefinition(serviceKey)?.label || serviceKey,
    })),
    has_active_draft: Boolean(activeDraft),
    active_draft_status: activeDraft?.status || '',
    active_draft_owned_by_user: Boolean(activeDraft && activeDraft.submitted_by_user_id === userId),
    blocked: Boolean(blockedReason),
    blocked_reason: blockedReason,
  };
}

function auditNote(operationId, sourceId, mode) {
  return `copy_service_operation:${operationId};source:${sourceId};mode:${mode}`;
}

async function findOperationAudit(svc, locationId, operationId, sourceId, mode) {
  const rows = await svc.entities.DirectoryAuditRecord.filter({
    entity_type: 'ProviderWorkspaceSubmission',
    action_type: 'provider_copy_services_draft',
    note: auditNote(operationId, sourceId, mode),
  }, '-performed_at', 100).catch(() => []);
  return rows.find((row) => parsePayload(row.new_values).location_id === locationId) || null;
}

async function createAudit(svc, user, submission, source, target, mode, previous, built, operationId) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderWorkspaceSubmission',
    entity_id: submission.id,
    action_type: 'provider_copy_services_draft',
    changed_fields: ['payload_json', 'status'],
    previous_values: JSON.stringify(previous || {}),
    new_values: JSON.stringify({
      location_id: target.id,
      source_location_id: source.id,
      mode,
      status: 'draft',
      copied_service_count: built.compatibleSourceKeys.length,
      added_service_count: built.addedKeys.length,
      removed_service_count: built.removedKeys.length,
      skipped_service_count: built.skippedSourceKeys.length,
    }),
    admin_user_id: user.id,
    admin_email: user.email,
    note: auditNote(operationId, source.id, mode),
    performed_at: new Date().toISOString(),
  });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return reject('Autentificare necesara.', 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'preview');
    const mode = clean(input.mode || 'merge');
    const sourceId = clean(input.source_location_id);
    const targetIds = unique(Array.isArray(input.target_location_ids) ? input.target_location_ids : []);

    if (!['preview', 'copy'].includes(action)) return reject('Actiune invalida.');
    if (!['merge', 'replace'].includes(mode)) return reject('Mod de copiere invalid.');
    if (!sourceId) return reject('Selecteaza locatia sursa.');
    if (targetIds.length === 0) return reject('Selecteaza cel putin o locatie tinta.');
    if (targetIds.length > MAX_TARGETS) return reject(`Poti selecta maximum ${MAX_TARGETS} de locatii tinta.`);
    if (targetIds.includes(sourceId)) return reject('Locatia sursa nu poate fi si locatie tinta.');

    const memberships = await activeMembershipsForUser(svc, user.id);
    if (!canEditLocation(memberships, sourceId)) return reject('Nu ai permisiunea necesara pentru locatia sursa.', 403);
    const inaccessibleTargets = targetIds.filter((locationId) => !canEditLocation(memberships, locationId));
    if (inaccessibleTargets.length > 0) return reject('Nu ai permisiunea necesara pentru toate locatiile tinta.', 403, { location_ids: inaccessibleTargets });

    const source = await svc.entities.ProviderLocation.get(sourceId).catch(() => null);
    if (!source || !isEligibleLocation(source)) return reject('Locatia sursa nu este eligibila.', 403);
    const targets = [];
    for (const targetId of targetIds) {
      const target = await svc.entities.ProviderLocation.get(targetId).catch(() => null);
      if (!target) return reject('Una dintre locatiile tinta nu a fost gasita.', 404, { location_id: targetId });
      targets.push(target);
    }
    const wrongOrganization = targets.filter((target) => target.organization_id !== source.organization_id);
    if (wrongOrganization.length > 0) return reject('Serviciile pot fi copiate numai intre locatii din aceeasi organizatie.', 403, { location_ids: wrongOrganization.map((item) => item.id) });
    const ineligibleTargets = targets.filter((target) => !isEligibleLocation(target));
    if (ineligibleTargets.length > 0) return reject('Una dintre locatiile tinta nu este aprobata sau este suspendata.', 403, { location_ids: ineligibleTargets.map((item) => item.id) });

    const sourceState = await loadLocationState(svc, source);
    if (sourceState.serviceKeys.length === 0) return reject('Locatia sursa nu are servicii canonice aprobate care pot fi copiate.');
    const targetStates = [];
    for (const target of targets) targetStates.push(await loadLocationState(svc, target));
    const previewTargets = targetStates.map((targetState) => targetPreview(sourceState, targetState, mode, user.id));
    const preview = {
      mode,
      source: {
        id: source.id,
        name: locationLabel(source),
        locality: locationPlace(source),
        service_count: sourceState.serviceKeys.length,
        services: sourceServiceSummary(sourceState),
        has_unapproved_changes: Boolean(sourceState.activeDraft),
      },
      targets: previewTargets,
      rules: {
        creates_drafts_only: true,
        copies_resources: false,
        copies_legacy_services: false,
      },
    };

    if (action === 'preview') return Response.json({ success: true, preview });

    const targetsWithOwnedDraft = previewTargets.filter((item) => item.has_active_draft && item.active_draft_owned_by_user && !item.blocked);
    if (targetsWithOwnedDraft.length > 0 && input.confirm_replace_existing_drafts !== true) {
      return reject('Confirma inlocuirea drafturilor existente pentru locatiile indicate.', 409, {
        confirmation_required: 'replace_existing_drafts',
        location_ids: targetsWithOwnedDraft.map((item) => item.id),
        preview,
      });
    }
    const targetsWithRemovals = previewTargets.filter((item) => item.removed_count > 0 && !item.blocked);
    if (mode === 'replace' && targetsWithRemovals.length > 0 && input.confirm_replace_services !== true) {
      return reject('Confirma configuratia de inlocuire pentru locatiile indicate.', 409, {
        confirmation_required: 'replace_services',
        location_ids: targetsWithRemovals.map((item) => item.id),
        preview,
      });
    }

    const operationId = clean(input.operation_id);
    if (!/^[a-zA-Z0-9_-]{12,100}$/.test(operationId)) return reject('Identificatorul operatiei este invalid. Reincarca preview-ul si incearca din nou.');

    const results = [];
    for (const targetState of targetStates) {
      const target = targetState.location;
      const previewItem = previewTargets.find((item) => item.id === target.id);
      if (previewItem?.blocked) {
        results.push({ location_id: target.id, name: locationLabel(target), status: 'blocked', error: previewItem.blocked_reason });
        continue;
      }
      const built = buildTargetPayload(sourceState, targetState, mode);
      try {
        const existingAudit = await findOperationAudit(svc, target.id, operationId, source.id, mode);
        if (existingAudit) {
          results.push({ location_id: target.id, name: locationLabel(target), status: 'duplicate_skipped' });
          continue;
        }

        const activeDraft = targetState.activeDraft;
        let submission;
        let previous = {};
        let created = false;
        if (activeDraft) {
          previous = { payload_json: activeDraft.payload_json || '{}', status: activeDraft.status };
          await svc.entities.ProviderWorkspaceSubmission.update(activeDraft.id, {
            payload_json: JSON.stringify(built.payload),
            status: 'draft',
          });
          submission = { ...activeDraft, payload_json: JSON.stringify(built.payload), status: 'draft' };
        } else {
          submission = await svc.entities.ProviderWorkspaceSubmission.create({
            organization_id: target.organization_id || null,
            location_id: target.id,
            claim_request_id: '',
            access_origin: 'provider_workspace',
            section: 'services',
            payload_json: JSON.stringify(built.payload),
            status: 'draft',
            submitted_by_user_id: user.id,
          });
          created = true;
        }

        try {
          await createAudit(svc, user, submission, source, target, mode, previous, built, operationId);
        } catch (auditError) {
          if (created) await svc.entities.ProviderWorkspaceSubmission.delete(submission.id).catch(() => null);
          else await svc.entities.ProviderWorkspaceSubmission.update(submission.id, previous).catch(() => null);
          throw new Error(`Auditul nu a putut fi salvat: ${auditError.message}`);
        }
        results.push({
          location_id: target.id,
          name: locationLabel(target),
          status: created ? 'draft_created' : 'draft_updated',
          submission_id: submission.id,
          added_count: built.addedKeys.length,
          removed_count: built.removedKeys.length,
          skipped_count: built.skippedSourceKeys.length,
        });
      } catch (error) {
        results.push({ location_id: target.id, name: locationLabel(target), status: 'error', error: error.message });
      }
    }

    const successCount = results.filter((item) => ['draft_created', 'draft_updated'].includes(item.status)).length;
    const duplicateCount = results.filter((item) => item.status === 'duplicate_skipped').length;
    const blockedCount = results.filter((item) => item.status === 'blocked').length;
    const errorCount = results.filter((item) => item.status === 'error').length;
    return Response.json({
      success: errorCount === 0 && blockedCount === 0,
      partial_success: successCount + duplicateCount > 0 && errorCount + blockedCount > 0,
      operation_id: operationId,
      summary: {
        success_count: successCount,
        duplicate_count: duplicateCount,
        blocked_count: blockedCount,
        error_count: errorCount,
      },
      results,
    }, { status: successCount + duplicateCount === 0 && errorCount > 0 ? 500 : 200 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata.' }, { status: 500 });
  }
}