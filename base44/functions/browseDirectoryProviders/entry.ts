import {
  evaluateServicePrerequisites,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from '../../../shared/providerPublicTrust.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Read-only locality browse. It does not score or match by service.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const limit = Math.min(payload.limit || 20, 50);

    if (!sirutaCode) {
      return Response.json({
        results: [],
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
      });
    }

    const [locations, services, assignments, equipment, facilities] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 2000),
      svc.entities.LocationEquipment.list(null, 2000).catch(() => []),
      svc.entities.LocationFacility.list(null, 2000).catch(() => []),
    ]);

    const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id).filter(Boolean))];
    const professionals = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter(Boolean);
    const professionalsById = Object.fromEntries(professionals.map((profile) => [profile.id, profile]));

    const servicesByLocation = {};
    for (const service of services) {
      if (service.is_active === false) continue;
      if (!normalizeServiceKey(service.service_key).definition) continue;
      if (!servicesByLocation[service.location_id]) servicesByLocation[service.location_id] = [];
      servicesByLocation[service.location_id].push(service);
    }

    const assignmentsByLocation = {};
    for (const assignment of assignments) {
      if (!assignmentsByLocation[assignment.location_id]) assignmentsByLocation[assignment.location_id] = [];
      assignmentsByLocation[assignment.location_id].push(assignment);
    }

    const equipmentByLocation = {};
    for (const item of equipment) {
      if (item.is_active === false) continue;
      if (!equipmentByLocation[item.location_id]) equipmentByLocation[item.location_id] = [];
      equipmentByLocation[item.location_id].push(item);
    }

    const facilitiesByLocation = {};
    for (const facility of facilities) {
      if (facility.is_active === false) continue;
      if (!facilitiesByLocation[facility.location_id]) facilitiesByLocation[facility.location_id] = [];
      facilitiesByLocation[facility.location_id].push(facility);
    }

    const results = [];
    for (const loc of locations) {
      const publicDisclosure = getPublicLocationDisclosure(loc);
      if (loc.public_visibility_status !== 'approved') continue;
      if (publicDisclosure.profile_control_status === 'suspended') continue;
      if (loc.active_status === 'inactiva') continue;
      if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      if (String(loc.locality_siruta_code || '').trim() !== sirutaCode) continue;

      const locAssignments = assignmentsByLocation[loc.id] || [];
      const locProfessionals = [...new Set(locAssignments.map((assignment) => assignment.professional_id).filter(Boolean))]
        .map((id) => professionalsById[id])
        .filter(Boolean);
      const prerequisiteContext = {
        location: loc,
        assignments: locAssignments,
        professionals: locProfessionals,
        equipment: equipmentByLocation[loc.id] || [],
        facilities: facilitiesByLocation[loc.id] || [],
      };

      const hasPublicService = (servicesByLocation[loc.id] || []).some((service) => (
        !service.migration_review_required
        && isServicePubliclyEligible(service, loc)
        && evaluateServicePrerequisites(service.service_key, prerequisiteContext).eligible
      ));

      results.push({
        id: loc.id,
        name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        city: loc.city,
        county: loc.county || null,
        address: publicDisclosure.address,
        phone: publicDisclosure.phone,
        website: publicDisclosure.website,
        opening_hours: publicDisclosure.opening_hours,
        saturday_hours: publicDisclosure.saturday_hours,
        profile_control_status: publicDisclosure.profile_control_status,
        public_detail_level: publicDisclosure.public_detail_level,
        exact_location_visible: publicDisclosure.exact_location_visible,
        contact_details_visible: publicDisclosure.contact_details_visible,
        result_type: 'directory',
        is_match_eligible: false,
        service_coverage_status: publicDisclosure.expose_full_details
          ? (hasPublicService ? 'listed' : 'not_listed')
          : 'not_disclosed',
      });
      if (results.length >= limit) break;
    }

    return Response.json({
      results,
      coverage_status: results.length > 0 ? 'results_found' : 'no_local_results',
      selected_locality_siruta_code: sirutaCode,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
