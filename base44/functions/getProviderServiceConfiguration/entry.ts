import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CANONICAL_SERVICE_KEYS,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';
import {
  evaluateServicePrerequisites,
  servicePrerequisiteStatusLabel,
} from '../../../shared/servicePrerequisiteEngine.js';
import {
  getFunctionalUnitLayout,
} from '../../../shared/locationOperationalRegistry.js';
import {
  getServiceOperationalContext,
} from '../../../shared/serviceOperationalTaxonomyExtended.js';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function clean(value) {
  return String(value || '').trim();
}

function normalizeRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'manager') return 'location_manager';
  if (role === 'staff') return 'location_staff';
  return clean(role);
}

function active(row) {
  return Boolean(row) && row.is_active !== false && row.active_status !== 'inactiv';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function inferInitialUnits(location, serviceKeys) {
  const layout = getFunctionalUnitLayout(location?.provider_profile_type, location?.provider_type);
  const keys = new Set(layout.primaryUnits || layout.primary || []);
  for (const serviceKey of serviceKeys) {
    const context = getServiceOperationalContext(serviceKey);
    if (context?.unitKey) keys.add(context.unitKey);
  }
  return [...keys];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesară' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const locationId = clean(payload.location_id);
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const svc = base44.asServiceRole;
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: locationId,
      status: 'active',
    });
    const membership = memberships.find((item) => MEMBER_ROLES.includes(normalizeRole(item.role)));
    if (!membership) return Response.json({ error: 'Nu ai acces la această locație' }, { status: 403 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locația nu a fost găsită' }, { status: 404 });
    if (location.profile_control_status === 'suspended') return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });

    const [services, assignments, equipment, facilities, functionalUnits, capabilities] = await Promise.all([
      svc.entities.LocationService.filter({ location_id: locationId }, 'service_key', 700),
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ' }, null, 300),
      svc.entities.LocationEquipment.filter({ location_id: locationId }, null, 500).catch(() => []),
      svc.entities.LocationFacility.filter({ location_id: locationId }, null, 500).catch(() => []),
      svc.entities.LocationFunctionalUnit?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
      svc.entities.LocationCapability?.filter({ location_id: locationId }, null, 100).catch(() => []) || [],
    ]);

    const professionalIds = [...new Set(assignments.map((item) => item.professional_id).filter(Boolean))];
    const professionals = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter(Boolean);
    const professionalById = Object.fromEntries(professionals.map((profile) => [profile.id, profile]));

    const canonicalActiveServices = services.filter((service) => service.is_active !== false)
      .map((service) => ({ service, normalized: normalizeServiceKey(service.service_key) }))
      .filter((item) => item.normalized.status === 'canonical');
    const serviceKeys = [...new Set(canonicalActiveServices.map((item) => item.normalized.canonicalKey).filter(Boolean))];
    const activeFunctionalUnits = safeArray(functionalUnits).filter(active);
    const activeCapabilities = safeArray(capabilities).filter(active);
    const hasPersistedUnits = activeFunctionalUnits.length > 0;
    const inferredUnitKeys = inferInitialUnits(location, serviceKeys);
    const serviceUnitMap = Object.fromEntries(canonicalActiveServices.map(({ service, normalized }) => [
      normalized.canonicalKey,
      clean(service.functional_unit_key) || getServiceOperationalContext(normalized.canonicalKey)?.unitKey || '',
    ]));
    const serviceCapabilityMap = Object.fromEntries(canonicalActiveServices.map(({ service, normalized }) => [
      normalized.canonicalKey,
      clean(service.capability_key) || getServiceOperationalContext(normalized.canonicalKey)?.capabilityKey || '',
    ]));

    const baseContext = {
      location,
      assignments,
      professionals,
      equipment,
      facilities,
      functionalUnits: activeFunctionalUnits,
      capabilities: activeCapabilities,
      service_unit_map: serviceUnitMap,
      service_capability_map: serviceCapabilityMap,
      enforceUnitScope: hasPersistedUnits,
    };

    const prerequisitesByKey = Object.fromEntries(CANONICAL_SERVICE_KEYS.map((key) => {
      const evaluation = evaluateServicePrerequisites(key, baseContext);
      return [key, {
        eligible: evaluation.eligible,
        status: evaluation.status,
        status_label: servicePrerequisiteStatusLabel(evaluation.status),
        blockers: evaluation.blockers,
        required_professional_types: evaluation.definition?.required_professional_types || [],
        required_equipment_types: evaluation.definition?.required_equipment_types || [],
        equipment_requirement_mode: evaluation.definition?.equipment_requirement_mode || 'all',
        required_infrastructure_types: evaluation.definition?.required_infrastructure_types || [],
        evidence: evaluation.evidence,
      }];
    }));

    const existingServices = services.map((service) => {
      const rawKey = clean(service.service_key);
      const normalized = normalizeServiceKey(rawKey);
      const evaluation = evaluateServicePrerequisites(rawKey, {
        ...baseContext,
        serviceUnitKey: clean(service.functional_unit_key) || serviceUnitMap[normalized.canonicalKey] || '',
        capabilityKey: clean(service.capability_key) || serviceCapabilityMap[normalized.canonicalKey] || '',
      });
      return {
        id: service.id,
        raw_key: rawKey,
        canonical_key: normalized.canonicalKey,
        catalog_status: normalized.status,
        label: normalized.definition?.label || clean(service.label) || rawKey,
        group: normalized.definition?.group || null,
        confirmation_level: service.confirmation_level || 'not_confirmed',
        service_need_level: normalized.definition?.service_need_level || service.service_need_level || 'unknown',
        matching_allowed: service.matching_allowed === true,
        migration_review_required: service.migration_review_required === true,
        is_active: service.is_active !== false,
        functional_unit_key: clean(service.functional_unit_key) || serviceUnitMap[normalized.canonicalKey] || '',
        capability_key: clean(service.capability_key) || serviceCapabilityMap[normalized.canonicalKey] || '',
        prerequisite_eligible: evaluation.eligible,
        prerequisite_status: evaluation.status,
        prerequisite_status_label: servicePrerequisiteStatusLabel(evaluation.status),
        prerequisite_blockers: evaluation.blockers,
        prerequisite_evidence: evaluation.evidence,
      };
    });

    return Response.json({
      location_id: locationId,
      role: normalizeRole(membership.role),
      can_edit_services: ['organization_owner', 'location_manager'].includes(normalizeRole(membership.role)),
      care_setting: clean(location.care_setting) || 'not_applicable',
      service_keys: serviceKeys,
      service_unit_map: serviceUnitMap,
      service_capability_map: serviceCapabilityMap,
      existing_services: existingServices,
      legacy_or_unknown_services: existingServices.filter((service) => service.catalog_status !== 'canonical' && service.is_active),
      functional_units: activeFunctionalUnits,
      capabilities: activeCapabilities,
      inferred_functional_unit_keys: inferredUnitKeys,
      operational_context_persisted: hasPersistedUnits,
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        professional_id: assignment.professional_id,
        professional_type: assignment.professional_type,
        functional_unit_keys: safeArray(assignment.functional_unit_keys),
        full_name: professionalById[assignment.professional_id]?.full_name || professionalById[assignment.professional_id]?.public_display_name || 'Specialist',
        verification_status: professionalById[assignment.professional_id]?.verification_status || 'unverified',
      })),
      equipment: equipment.map((item) => ({
        id: item.id,
        equipment_category_key: item.equipment_category_key,
        equipment_label: item.equipment_label || item.equipment_category_key,
        functional_unit_key: clean(item.functional_unit_key),
        confirmation_level: item.confirmation_level,
        evidence_status: item.evidence_status,
        is_active: item.is_active !== false,
      })),
      facilities: facilities.map((item) => ({
        id: item.id,
        facility_key: item.facility_key,
        functional_unit_key: clean(item.functional_unit_key),
        is_active: item.is_active !== false,
      })),
      prerequisites_by_key: prerequisitesByKey,
      prerequisite_evidence_summary: {
        active_assignment_count: assignments.length,
        professional_profile_count: professionals.length,
        equipment_count: equipment.filter(active).length,
        facility_count: facilities.filter(active).length,
        functional_unit_count: activeFunctionalUnits.length,
        capability_count: activeCapabilities.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neașteptată' }, { status: 500 });
  }
});
