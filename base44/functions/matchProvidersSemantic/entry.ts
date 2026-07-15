import {
  buildPatientNeedPrompt,
  evaluateServicePrerequisites,
  getCanonicalServiceDefinition,
  getServiceOperationalContext,
  getPatientNeedResponseSchema,
  isServiceMatchingEligible,
  normalizeServiceKey,
  resolveServiceSearchQuery,
  sanitizePatientNeedInterpretation,
} from './sharedDependencies.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

async function interpretPatientNeed(base44, payload, searchText, deterministicServiceKeys) {
  if (!searchText) {
    return {
      mode: 'shadow',
      status: 'skipped',
      reason: 'search_text_required',
    };
  }

  const deterministicIntent = clean(payload.deterministic_intent || payload.intent);
  const prompt = buildPatientNeedPrompt({
    text: searchText,
    deterministicIntent,
    deterministicServiceKeys,
    answers: payload.answers,
  });

  try {
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: getPatientNeedResponseSchema(),
    });
    return {
      mode: 'shadow',
      status: 'completed',
      interpretation: sanitizePatientNeedInterpretation(raw, {
        deterministicIntent,
        deterministicServiceKeys,
      }),
    };
  } catch (_error) {
    // AI is advisory in shadow mode. Its failure must never block deterministic search.
    return {
      mode: 'shadow',
      status: 'unavailable',
      reason: 'ai_interpretation_unavailable',
    };
  }
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

    if (payload.mode === 'interpret_only') {
      return Response.json(await interpretPatientNeed(base44, payload, searchText, requestedKeys));
    }

    if (requestedKeys.length === 0) {
      return Response.json({
        results: [],
        resolved_service_keys: [],
        semantic_resolution: semantic,
        need_level: 'unknown',
        coverage_status: searchText ? 'query_not_mapped' : 'query_required',
      });
    }

    const sirutaCode = clean(payload.locality_siruta_code);
    const limit = Math.max(1, Math.min(Number(payload.limit) || 20, 50));

    if (!sirutaCode) {
      return Response.json({
        results: [],
        resolved_service_keys: requestedKeys,
        semantic_resolution: semantic,
        need_level: requestNeedLevel(requestedKeys),
        routing_mode: 'locality',
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
      });
    }

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
      if (clean(location.locality_siruta_code) !== sirutaCode) continue;

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
        score: Math.round(score * 1000) / 1000,
      });
    }

    results.sort((a, b) => b.score - a.score);

    return Response.json({
      results: results.slice(0, limit).map((entry, index) => ({
        ...entry,
        result_bucket: index < 3 ? 'top3' : 'extended_confirmed',
        bucket_rank: index + 1,
      })),
      resolved_service_keys: requestedKeys,
      semantic_resolution: semantic,
      need_level: needLevel,
      routing_mode: 'locality',
      coverage_status: results.length > 0 ? 'results_found' : 'no_local_results',
      selected_locality_siruta_code: sirutaCode,
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'Eroare neașteptată la căutarea semantică.',
    }, { status: 500 });
  }
});
