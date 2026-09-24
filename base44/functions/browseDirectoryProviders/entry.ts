import {
  evaluateServicePrerequisites,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from './providerPublicTrust.js';
import {
  loadDirectoryDetailOverlay,
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
  paginateRows,
  withDirectoryDetail,
} from '../../shared/locationScopedEntityQuery.js';
import { getNationalMap } from '../../shared/nationalMapCache.js';
import { loadDirectoryDetailOverlayForMap, loadPublishedLocationsForMap } from '../../shared/nationalMapSources.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Read-only locality browse. It does not score or match by service.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
  'independent_ophthalmologist',
  'independent_optometrist',
  'independent_optician',
  'optical_laboratory_b2c',
];

function normalizedName(location) {
  return String(location?.public_display_name || location?.name || '').trim().toLocaleLowerCase('ro-RO');
}

// 2026-09-06, directorul pe harta. O singura ramura care intoarce TOATE locatiile publicate,
// in forma minima necesara desenarii unui punct. Nu este o cautare si nu inlocuieste una:
// nu scoreaza, nu ordoneaza dupa relevanta si nu are Top 3. Este harta directorului, din care
// pacientul intra pe un profil.
//
// Campurile sunt putine intentionat: 900+ locatii inseamna ca fiecare camp in plus se
// inmulteste cu 900. Detaliile se citesc pe profil, nu aici.
//
// 2026-09-24. Datele vin din shared/nationalMapSources.js: aceleasi locatii si aceeasi stare de
// director, citite pe pagini de 500 (~7 citiri) in loc de o interogare pe fiecare judet (~100).
async function computeNationalMap(svc) {
  const { locations: allLocations } = await loadPublishedLocationsForMap(svc);
  const visible = allLocations.filter((loc) => {
    if (loc.public_visibility_status !== 'approved') return false;
    if (loc.active_status === 'inactiva') return false;
    if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) return false;
    return true;
  });
  const { overlay } = await loadDirectoryDetailOverlayForMap(svc, visible.map((loc) => loc.id));

  const points = [];
  let totalPublished = 0;
  for (const loc of visible) {
    const disclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, overlay));
    if (disclosure.profile_control_status === 'suspended') continue;
    totalPublished += 1;
    if (disclosure.lat === null || disclosure.lng === null) continue;
    points.push({
      id: loc.id,
      name: loc.public_display_name || loc.name,
      provider_type: loc.provider_type,
      city: loc.locality_name || loc.city || null,
      county: loc.county_name || loc.county || null,
      address: disclosure.address,
      lat: disclosure.lat,
      lng: disclosure.lng,
      map_precision: disclosure.map_precision,
      profile_control_status: disclosure.profile_control_status,
    });
  }

  return {
    map_scope: 'national',
    results: points,
    total_published: totalPublished,
    without_position: totalPublished - points.length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const rawServices = Array.isArray(payload.filter_service_keys) ? payload.filter_service_keys.map(String) : [];
    if (rawServices.some(key => !normalizeServiceKey(key).definition)) return Response.json({ error: 'Un serviciu selectat nu este disponibil pentru filtrare.' }, { status: 400 });
    const selectedServices = [...new Set(rawServices.map(key => normalizeServiceKey(key).canonicalKey))];
    const casOnly = payload.cas_only === true;
    const advanced = selectedServices.length > 0 || casOnly;
    const pageSize = Math.max(1, Math.min(Number(payload.page_size || payload.limit) || 20, 50));
    const offset = Math.max(0, Math.floor(Number(payload.offset) || 0));
    const includeMapResults = payload.include_map_results === true;

    // Harta nationala (vezi computeNationalMap). 2026-09-23: vine dintr-o copie tinuta cateva
    // minute (shared/nationalMapCache.js). Recalcularea la fiecare vizita facea ~100 de citiri,
    // iar a doua vizita la cateva secunde dupa prima primea „Rate limit exceeded”.
    if (String(payload.map_scope || '').trim() === 'national') {
      try {
        const map = await getNationalMap({ svc, compute: () => computeNationalMap(svc) });
        return Response.json({
          ...map.value,
          generated_at: new Date(map.generatedAt).toISOString(),
          stale: map.stale,
        });
      } catch (_error) {
        // Nicio copie si calcularea a esuat (de regula limita de trafic, trecatoare). Pagina
        // reincearca singura (src/lib/nationalDirectoryMapLoader.js) si arata un mesaj clar.
        return Response.json({
          error: 'Harta directorului nu poate fi incarcata acum. Incearca din nou peste cateva secunde.',
          code: 'map_unavailable',
        }, { status: 503 });
      }
    }

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

    const initialPage = paginateRows(eligibleLocations, { pageSize, offset });
    const locations = advanced ? eligibleLocations : initialPage.page;
    let pagination = initialPage.pagination;
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

    // Nivelul de detaliu public sta pe starea de director, nu pe locatie. Fara el, un profil
    // aprobat editorial aparea aici ca 'summary' si isi ascundea adresa - desi pagina lui de
    // profil o arata. Vezi loadDirectoryDetailOverlay.
    const detailOverlay = await loadDirectoryDetailOverlay(svc, (includeMapResults ? eligibleLocations : locations).map((loc) => loc.id));

    const results = [];
    for (const loc of locations) {
      const publicDisclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, detailOverlay));
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

      const publicServices = publicDisclosure.expose_full_details ? (servicesByLocation[loc.id] || []).filter((service) => (
        !service.migration_review_required
        && isServicePubliclyEligible(service, loc)
        && evaluateServicePrerequisites(service.service_key, prerequisiteContext).eligible
      )) : [];
      const hasPublicService = publicServices.length > 0;
      if (advanced && !publicServices.some(service => (!selectedServices.length || selectedServices.includes(normalizeServiceKey(service.service_key).canonicalKey)) && (!casOnly || service.cas_reimbursed === true))) continue;

      results.push({
        id: loc.id,
        name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        city: loc.city,
        county: loc.county || null,
        address: publicDisclosure.address,
        lat: publicDisclosure.lat,
        lng: publicDisclosure.lng,
        map_precision: publicDisclosure.map_precision,
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

    const finalPage = advanced ? paginateRows(results, { pageSize, offset }) : { page: results, pagination };
    pagination = finalPage.pagination;
    // Map scope is independent of card pagination, but never of public visibility or filters.
    // Keep unpositioned rows here: they remain eligible for the list and advanced matching.
    const mapResults = includeMapResults ? (advanced ? results : eligibleLocations.map(loc => {
      const disclosure = getPublicLocationDisclosure(withDirectoryDetail(loc, detailOverlay));
      return {
        id: loc.id, name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type, city: loc.locality_name || loc.city,
        county: loc.county_name || loc.county || null, address: disclosure.address,
        lat: disclosure.lat, lng: disclosure.lng, map_precision: disclosure.map_precision,
        profile_control_status: disclosure.profile_control_status,
        result_type: 'directory', is_match_eligible: false,
      };
    })).map(({ id, name, provider_type, city, county, address, lat, lng, map_precision, profile_control_status }) => (
      { id, name, provider_type, city, county, address, lat, lng, map_precision, profile_control_status, result_type: 'directory', is_match_eligible: false }
    )) : undefined;
    return Response.json({
      results: finalPage.page,
      ...(includeMapResults ? { map_results: mapResults } : {}),
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
