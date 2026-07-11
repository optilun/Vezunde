import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';
import { getServiceOperationalContext } from '../../../shared/serviceOperationalTaxonomyExtended.js';
import { resolveServiceSearchQuery } from '../../../shared/serviceSemanticSearch.js';
import { evaluateServicePrerequisites } from '../../../shared/servicePrerequisiteEngine.js';

const PATIENT_FACING_PROFILE_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
]);

const NEED_ORDER = {
  general: 0,
  technical: 1,
  specialized_medical: 2,
  unknown: 3,
};

function clean(value) {
  return String(value || '').trim();
}

function active(row) {
  const status = clean(row?.active_status).toLowerCase();
  return Boolean(row)
    && row.is_active !== false
    && !['inactiv', 'inactiva', 'inactive'].includes(status);
}

function hasCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2) ** 2;
  const sinLng = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(sinLat + sinLng), Math.sqrt(1 - sinLat - sinLng));
}

function defaultRadiusKm(location) {
  const configured = Number(location?.service_radius_km);
  if (Number.isFinite(configured) && configured > 0) return configured;
  if (location?.provider_profile_type === 'ophthalmology_clinic') return 50;
  if (location?.provider_profile_type === 'ophthalmology_office') return 35;
  if (['independent_optical_store', 'optical_chain'].includes(location?.provider_profile_type)) return 15;
  return 20;
}

function indexRowsByLocation(rows) {
  const result = {};
  for (const row of rows || []) {
    if (!row?.location_id || !active(row)) continue;
    result[row.location_id] = result[row.location_id] || [];
    result[row.location_id].push(row);
  }
  return result;
}

function groupProfessionalsById(profiles) {
  return Object.fromEntries((profiles || []).filter(Boolean).map((profile) => [profile.id, profile]));
}

function requestNeedLevel(serviceKeys) {
  let result = 'general';
  for (const serviceKey of serviceKeys) {
    const level = getCanonicalServiceDefinition(serviceKey)?.service_need_level || 'unknown';
    if (NEED_ORDER[level] > NEED_ORDER[result]) result = level;
  }
  return result;
}

function safeServiceRow(row, location, context) {
  if (!row || row.migration_review_required || row.matching_allowed !== true) return false;
  if (!isServiceMatchingEligible(row, location)) return false;
  const serviceContext = getServiceOperationalContext(row.service_key);
  const prerequisite = evaluateServicePrerequisites(row.service_key, {
    ...context,
    serviceUnitKey: clean(row.functional_unit_key) || serviceContext?.unitKey || '',
    capabilityKey: clean(row.capability_key) || serviceContext?.capabilityKey || '',
  });
  return prerequisite.eligible;
}

function toPublicService(row) {
  const normalized = normalizeServiceKey(row?.service_key);
  if (!normalized.canonicalKey || !normalized.definition) return null;
  return {
    key: normalized.canonicalKey,
    label: normalized.definition.label,
  };
}

function semanticReason(serviceKeys) {
  const labels = serviceKeys
    .slice(0, 3)
    .map((key) => getCanonicalServiceDefinition(key)?.label || key);
  return labels.length > 0 ? `Potrivire după limbajul căutat: ${labels.join(', ')}` : '';
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const svc = base44.asServiceRole;
    const payload = await request.json().catch(() => ({}));

    const searchText = clean(
      payload.search_text
      || payload.query
      || payload.free_text
      || payload.search_query,
    );
    const semantic = resolveServiceSearchQuery(searchText, {
      limit: payload.semantic_limit || 15,
      minScore: payload.semantic_min_score || 0.34,
    });
    const explicitKeys = Array.isArray(payload.service_keys)
      ? payload.service_keys.map((value) => normalizeServiceKey(value).canonicalKey).filter(Boolean)
      : [];
    const requestedKeys = [...new Set([...explicitKeys, ...semantic.service_keys])];
    const semanticScoreByKey = Object.fromEntries(
      semantic.matches.map((match) => [match.service_key, Number(match.score) || 0]),
    );

    if (requestedKeys.length === 0) {
      return Response.json({
        results: [],
        resolved_service_keys: [],
        semantic_resolution: semantic,
        need_level: 'unknown',
        coverage_status: searchText ? 'query_not_mapped' : 'query_required',
      });
    }

    const city = clean(payload.city);
    const county = clean(payload.county);
    const sirutaCode = clean(payload.locality_siruta_code);
    const clientCoordinates = {
      lat: Number(payload.client_lat),
      lng: Number(payload.client_lng),
    };
    const hasClientCoordinates = hasCoordinates(clientCoordinates);
    const scope = payload.scope || (hasClientCoordinates ? 'nearby' : ((city || sirutaCode) ? 'city' : 'national'));
    const limit = Math.max(1, Math.min(Number(payload.limit) || 20, 50));

    const [
      locations,
      services,
      assignments,
      equipment,
      facilities,
      functionalUnits,
      capabilities,
    ] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 1000),
      svc.entities.LocationService.list(null, 5000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 3000).catch(() => []),
      svc.entities.LocationEquipment.list(null, 3000).catch(() => []),
      svc.entities.LocationFacility.list(null, 3000).catch(() => []),
      svc.entities.LocationFunctionalUnit?.list(null, 1000).catch(() => []) || [],
      svc.entities.LocationCapability?.list(null, 1000).catch(() => []) || [],
    ]);

    const professionalIds = [...new Set(
      assignments.map((assignment) => assignment.professional_id).filter(Boolean),
    )];
    const professionalProfiles = (await Promise.all(
      professionalIds.map((id) => svc.entities.ProfessionalProfile.get(id).catch(() => null)),
    )).filter(Boolean);
    const professionalsById = groupProfessionalsById(professionalProfiles);

    const servicesByLocation = indexRowsByLocation(services);
    const assignmentsByLocation = indexRowsByLocation(assignments);
    const equipmentByLocation = indexRowsByLocation(equipment);
    const facilitiesByLocation = indexRowsByLocation(facilities);
    const unitsByLocation = indexRowsByLocation(functionalUnits);
    const capabilitiesByLocation = indexRowsByLocation(capabilities);

    const requestedSet = new Set(requestedKeys);
    const needLevel = requestNeedLevel(requestedKeys);
    const results = [];

    for (const location of locations) {
      if (!active(location) || location.profile_control_status === 'suspended') continue;
      if (!PATIENT_FACING_PROFILE_TYPES.has(location.provider_profile_type)) continue;
      if (city && clean(location.city).toLowerCase() !== city.toLowerCase()) continue;
      if (county && clean(location.county).toLowerCase() !== county.toLowerCase()) continue;
      if (sirutaCode && clean(location.locality_siruta_code) !== sirutaCode) continue;

      let distance = null;
      const radius = defaultRadiusKm(location);
      if (hasClientCoordinates) {
        if (!hasCoordinates(location)) continue;
        distance = distanceKm(clientCoordinates, location);
        if (!Number.isFinite(distance) || distance > radius) continue;
      }

      const locationRows = servicesByLocation[location.id] || [];
      const candidateRows = locationRows.filter((row) => {
        const canonicalKey = normalizeServiceKey(row.service_key).canonicalKey;
        return Boolean(canonicalKey && requestedSet.has(canonicalKey));
      });
      if (candidateRows.length === 0) continue;

      const locationAssignments = assignmentsByLocation[location.id] || [];
      const locationProfessionals = locationAssignments
        .map((assignment) => professionalsById[assignment.professional_id])
        .filter(Boolean);
      const locationUnits = unitsByLocation[location.id] || [];
      const prerequisiteContext = {
        location,
        assignments: locationAssignments,
        professionals: locationProfessionals,
        equipment: equipmentByLocation[location.id] || [],
        facilities: facilitiesByLocation[location.id] || [],
        functionalUnits: locationUnits,
        capabilities: capabilitiesByLocation[location.id] || [],
        enforceUnitScope: locationUnits.length > 0,
      };

      const qualifyingRows = candidateRows.filter((row) => safeServiceRow(row, location, prerequisiteContext));
      if (qualifyingRows.length === 0) continue;

      const matchedKeys = [...new Set(
        qualifyingRows.map((row) => normalizeServiceKey(row.service_key).canonicalKey).filter(Boolean),
      )];
      const semanticMatchedKeys = matchedKeys.filter((key) => semanticScoreByKey[key] > 0);
      const semanticScore = semanticMatchedKeys.reduce(
        (sum, key) => sum + semanticScoreByKey[key],
        0,
      );
      let score = (matchedKeys.length * 3) + Math.min(semanticScore * 5, 10);
      if (location.profile_control_status === 'verified') score += 2;
      else if (location.profile_control_status === 'claimed') score += 1;
      if (Number.isFinite(distance)) score += Math.max(0, 3 - Math.min(distance / 10, 3));

      results.push({
        id: location.id,
        name: location.public_display_name || location.name,
        provider_type: location.provider_type,
        provider_profile_type: location.provider_profile_type,
        city: location.city || null,
        county: location.county || null,
        address: location.address || null,
        phone: location.phone_public || location.public_phone || null,
        website: location.website || location.website_url || null,
        profile_control_status: location.profile_control_status || 'directory',
        matched_public_services: qualifyingRows.map(toPublicService).filter(Boolean),
        matched_service_keys: matchedKeys,
        semantic_matched_service_keys: semanticMatchedKeys,
        semantic_match_score: Math.round(semanticScore * 1000) / 1000,
        match_reasons: [semanticReason(semanticMatchedKeys)].filter(Boolean),
        distance_km: Number.isFinite(distance) ? Math.round(distance * 10) / 10 : null,
        service_radius_km: Math.round(radius),
        score: Math.round(score * 1000) / 1000,
      });
    }

    results.sort((a, b) => {
      if (Number.isFinite(a.distance_km) && Number.isFinite(b.distance_km)) {
        return a.distance_km - b.distance_km || b.score - a.score;
      }
      return b.score - a.score;
    });

    return Response.json({
      results: results.slice(0, limit).map((entry, index) => ({
        ...entry,
        result_bucket: index < 3 ? 'top3' : 'extended_confirmed',
        bucket_rank: index + 1,
      })),
      resolved_service_keys: requestedKeys,
      semantic_resolution: semantic,
      need_level: needLevel,
      routing_mode: hasClientCoordinates ? 'perimeter' : scope,
      coverage_status: results.length > 0 ? 'results_found' : 'no_results',
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'Eroare neașteptată la căutarea semantică.',
    }, { status: 500 });
  }
});
