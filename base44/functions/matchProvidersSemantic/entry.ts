import {
  PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
  assignRecommendationBuckets,
  buildRecommendationExplanations,
  buildRecommendationScore,
  buildPatientNeedPrompt,
  evaluateServicePrerequisites,
  getCanonicalServiceDefinition,
  getFreshAvailability,
  getRecommendationConfidence,
  getServiceOperationalContext,
  getPatientNeedResponseSchema,
  isServiceMatchingEligible,
  normalizeServiceKey,
  recommendationBucketForProfile,
  resolveServiceSearchQuery,
  sanitizePatientNeedInterpretation,
} from './sharedDependencies.js';
import { getRecommendationCoverageStatus } from './coverage.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PATIENT_FACING_PROFILE_TYPES = new Set([
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
]);

const ROLE_CANONICAL = {
  medic_oftalmolog: 'ophthalmologist',
  ophthalmologist: 'ophthalmologist',
  optometrist: 'optometrist',
  optician: 'optician',
};

const OPHTHALMO_TYPES = new Set(['clinica_oftalmologica', 'cabinet_oftalmologic']);
const OPTICAL_TYPES = new Set(['optica_medicala', 'laborator_optic', 'cabinet_optometric']);
const OPHTHALMO_PROFILE_TYPES = new Set(['ophthalmology_clinic', 'ophthalmology_office']);
const OPTICAL_PROFILE_TYPES = new Set(['independent_optical_store', 'optical_chain']);

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

function assignmentRoles(assignments) {
  return new Set((assignments || [])
    .map((assignment) => ROLE_CANONICAL[assignment?.professional_type] || assignment?.professional_type)
    .filter(Boolean));
}

function locationMatchesIntent(location, intent, roles) {
  if (intent === 'simptome_oftalmologice' || intent === 'investigatii') {
    return OPHTHALMO_TYPES.has(location?.provider_type)
      || OPHTHALMO_PROFILE_TYPES.has(location?.provider_profile_type)
      || roles.has('ophthalmologist');
  }
  if (intent === 'reparatii_ochelari') {
    return OPTICAL_TYPES.has(location?.provider_type)
      || OPTICAL_PROFILE_TYPES.has(location?.provider_profile_type);
  }
  return true;
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
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
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
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
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
    const intent = clean(payload.intent);
    const providerTypes = new Set(Array.isArray(payload.provider_types) ? payload.provider_types.filter(Boolean) : []);
    const requiredRoles = new Set((Array.isArray(payload.required_professional_types)
      ? payload.required_professional_types
      : []).map((role) => ROLE_CANONICAL[role] || role));
    const localLocations = locations.filter((location) => (
      active(location)
      && location.profile_control_status !== 'suspended'
      && PATIENT_FACING_PROFILE_TYPES.has(location.provider_profile_type)
      && (providerTypes.size === 0 || providerTypes.has(location.provider_type))
      && clean(location.locality_siruta_code) === sirutaCode
    ));
    let configuredMatchingProviderCount = 0;
    const results = [];

    for (const location of localLocations) {

      const locationRows = servicesByLocation[location.id] || [];
      const candidateRows = locationRows.filter((row) => {
        const canonicalKey = normalizeServiceKey(row.service_key).canonicalKey;
        return Boolean(canonicalKey && requestedSet.has(canonicalKey));
      });
      if (candidateRows.length === 0) continue;
      configuredMatchingProviderCount += 1;

      const locationAssignments = assignmentsByLocation[location.id] || [];
      const roles = assignmentRoles(locationAssignments);
      if (!locationMatchesIntent(location, intent, roles)) continue;
      if (requiredRoles.size > 0 && ![...requiredRoles].some((role) => roles.has(role))) continue;
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
      const safeLocationRows = locationRows.filter((row) => safeServiceRow(row, location, prerequisiteContext));

      const matchedKeys = [...new Set(
        qualifyingRows.map((row) => normalizeServiceKey(row.service_key).canonicalKey).filter(Boolean),
      )];
      const semanticMatchedKeys = matchedKeys.filter((key) => semanticScoreByKey[key] > 0);
      const semanticScore = semanticMatchedKeys.reduce(
        (sum, key) => sum + semanticScoreByKey[key],
        0,
      );
      const profileControlStatus = location.profile_control_status || 'directory';
      const recommendationGroup = recommendationBucketForProfile(profileControlStatus, needLevel);
      if (recommendationGroup === 'excluded') continue;
      const availability = getFreshAvailability(location);
      const score = buildRecommendationScore({
        matchedServiceKeys: matchedKeys,
        semanticScoreByKey,
        profileControlStatus,
        availability,
        timingKey: payload.timing_key,
      });
      const explanations = buildRecommendationExplanations({
        matchedServiceKeys: matchedKeys,
        profileControlStatus,
        availability,
      });

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
        opening_hours: location.opening_hours || null,
        saturday_hours: location.saturday_hours || null,
        profile_control_status: profileControlStatus,
        public_services: safeLocationRows.map(toPublicService).filter(Boolean),
        matched_public_services: qualifyingRows.map(toPublicService).filter(Boolean),
        matched_service_keys: matchedKeys,
        semantic_matched_service_keys: semanticMatchedKeys,
        semantic_match_score: Math.round(semanticScore * 1000) / 1000,
        availability_label: availability?.label || null,
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
        recommendation_group: recommendationGroup,
        recommendation_score: score.total,
        recommendation_score_components: score.components,
        recommendation_confidence: getRecommendationConfidence({
          profileControlStatus,
          matchedServiceKeys: matchedKeys,
          bestSemanticScore: score.best_semantic_score,
        }),
        recommendation_explanations: explanations,
        match_reasons: explanations.map((item) => item.label),
        expansion_tier: 'oras',
        routing_reason: 'Potrivire dupa localitatea selectata.',
        score: score.total,
      });
    }

    const bucketedResults = assignRecommendationBuckets(results, limit);
    const coverageCounts = {
      local_provider_count: localLocations.length,
      configured_matching_provider_count: configuredMatchingProviderCount,
      eligible_provider_count: results.length,
      result_count: bucketedResults.length,
    };
    const coverageStatus = getRecommendationCoverageStatus({
      resultCount: coverageCounts.result_count,
      localProviderCount: coverageCounts.local_provider_count,
      configuredMatchingProviderCount: coverageCounts.configured_matching_provider_count,
    });

    return Response.json({
      recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
      results: bucketedResults,
      resolved_service_keys: requestedKeys,
      semantic_resolution: semantic,
      need_level: needLevel,
      resolved_intent: intent || null,
      routing_mode: 'locality',
      routing_reason: 'Potrivire dupa localitatea selectata.',
      coverage_status: coverageStatus,
      coverage_counts: coverageCounts,
      selected_locality_siruta_code: sirutaCode,
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'Eroare neașteptată la căutarea semantică.',
    }, { status: 500 });
  }
});
