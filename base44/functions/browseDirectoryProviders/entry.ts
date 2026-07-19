import {
  evaluateServicePrerequisites,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from './providerPublicTrust.js';
import {
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
  paginateRows,
} from '../../../shared/locationScopedEntityQuery.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Read-only locality browse. It does not score or match by service.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

function normalizedName(location) {
  return String(location?.public_display_name || location?.name || '').trim().toLocaleLowerCase('ro-RO');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const pageSize = Math.max(1, Math.min(Number(payload.page_size || payload.limit) || 20, 50));
    const offset = Math.max(0, Math.floor(Number(payload.offset) || 0));

    if (!sirutaCode) {
      return Response.json({
        results: [],
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
        pagination: {
          offset,
          page_size: pageSize,
          returned: 0,
          total: 0,
          has_more: false,
          next_offset: null,
        },
      });
    }

    const localityLocations = await loadPublicLocationsForLocality(svc, sirutaCode);
    const eligibleLocations = localityLocations
      .filter((loc) => {
        const publicDisclosure = getPublicLocationDisclosure(loc);
        if (loc.public_visibility_status !== 'approved') return false;
        if (publicDisclosure.profile_control_status === 'suspended') return false;
        if (loc.active_status === 'inactiva') return false;
        if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) return false;
        if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) return false;
        return true;
      })
      .sort((a, b) => normalizedName(a).localeCompare(normalizedName(b), 'ro') || String(a.id || '').localeCompare(String(b.id || '')));

    const { page: locations, pagination } = paginateRows(eligibleLocations, { pageSize, offset });
    const locationIds = locations.map((location) => location.id).filter(Boolean);

    const [services, assignments, equipment, facilities] = await Promise.all([
      loadRowsForLocationIds(svc.entities.LocationService, locationIds, { perLocationLimit: 500 }),
      loadRowsForLocationIds(svc.entities.ProfessionalLocationAssignment, locationIds, { query: { active_status: 'activ' }, perLocationLimit: 200 }),
      loadRowsForLocationIds(svc.entities.LocationEquipment, locationIds, { perLocationLimit: 300 }),
      loadRowsForLocationIds(svc.entities.LocationFacility, locationIds, { perLocationLimit: 300 }),
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
    }

    return Response.json({
      results,
      coverage_status: results.length > 0 ? 'results_found' : 'no_local_results',
      routing_mode: 'locality',
      query_scope: 'locality',
      selected_locality_siruta_code: sirutaCode,
      pagination,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
