import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CANONICAL_SERVICE_KEYS,
  normalizeServiceKey,
} from '../../shared/canonicalServiceRegistryExtended.js';
import {
  evaluateServicePrerequisites,
  servicePrerequisiteStatusLabel,
} from '../../shared/servicePrerequisiteEngine.js';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const locationId = cleanString(payload.location_id);
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const svc = base44.asServiceRole;
    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id,
      location_id: locationId,
      status: 'active',
    });
    if (!memberships.some((membership) => normalizeMemberRole(membership.role))) {
      return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
    }

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (location.profile_control_status === 'suspended') {
      return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });
    }

    const [services, assignments, equipment, facilities] = await Promise.all([
      svc.entities.LocationService.filter(
        { location_id: locationId, is_active: true },
        'service_key',
        500,
      ),
      svc.entities.ProfessionalLocationAssignment.filter({
        location_id: locationId,
        active_status: 'activ',
      }, null, 200),
      svc.entities.LocationEquipment.filter({ location_id: locationId }, null, 300).catch(() => []),
      svc.entities.LocationFacility.filter({ location_id: locationId }, null, 300).catch(() => []),
    ]);

    const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id).filter(Boolean))];
    const professionals = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter(Boolean);

    const prerequisiteContext = {
      location,
      assignments,
      professionals,
      equipment,
      facilities,
    };

    const prerequisitesByKey = Object.fromEntries(CANONICAL_SERVICE_KEYS.map((key) => {
      const evaluation = evaluateServicePrerequisites(key, prerequisiteContext);
      return [key, {
        eligible: evaluation.eligible,
        status: evaluation.status,
        status_label: servicePrerequisiteStatusLabel(evaluation.status),
        blockers: evaluation.blockers,
        required_professional_types: evaluation.definition?.required_professional_types || [],
        required_equipment_types: evaluation.definition?.required_equipment_types || [],
        equipment_requirement_mode: evaluation.definition?.equipment_requirement_mode || 'all',
        required_infrastructure_types: evaluation.definition?.required_infrastructure_types || [],
      }];
    }));

    const existingServices = services.map((service) => {
      const rawKey = cleanString(service.service_key);
      const normalized = normalizeServiceKey(rawKey);
      const evaluation = evaluateServicePrerequisites(rawKey, prerequisiteContext);
      return {
        id: service.id,
        raw_key: rawKey,
        canonical_key: normalized.canonicalKey,
        catalog_status: normalized.status,
        label: normalized.definition?.label || cleanString(service.label) || rawKey,
        group: normalized.definition?.group || null,
        confirmation_level: service.confirmation_level || 'not_confirmed',
        service_need_level: normalized.definition?.service_need_level || service.service_need_level || 'unknown',
        matching_allowed: service.matching_allowed === true,
        migration_review_required: service.migration_review_required === true,
        prerequisite_eligible: evaluation.eligible,
        prerequisite_status: evaluation.status,
        prerequisite_status_label: servicePrerequisiteStatusLabel(evaluation.status),
        prerequisite_blockers: evaluation.blockers,
        prerequisite_evidence: evaluation.evidence,
      };
    });

    // Only rows already stored with canonical keys populate the canonical selector.
    // Legacy mappings stay visible separately and are never converted implicitly.
    const serviceKeys = [...new Set(existingServices
      .filter((service) => service.catalog_status === 'canonical')
      .map((service) => service.canonical_key)
      .filter(Boolean))];
    const legacyOrUnknown = existingServices.filter((service) => service.catalog_status !== 'canonical');

    return Response.json({
      location_id: locationId,
      service_keys: serviceKeys,
      existing_services: existingServices,
      legacy_or_unknown_services: legacyOrUnknown,
      prerequisites_by_key: prerequisitesByKey,
      prerequisite_evidence_summary: {
        active_assignment_count: assignments.length,
        professional_profile_count: professionals.length,
        equipment_count: equipment.filter((item) => item.is_active !== false).length,
        facility_count: facilities.filter((item) => item.is_active !== false).length,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
