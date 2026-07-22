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
import { getPublicLocationDisclosure } from './providerPublicTrust.js';
import { getGenericRepairEligibility } from './genericRepairPolicy.js';
import { runPatientGuidanceRuntimeShadow } from '../../shared/patientGuidancePlanner.js';
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  isApprovedPatientGuidanceQuestionKey,
} from '../../shared/patientGuidanceQuestionCatalog.js';
import { buildPatientSafetyAssessment } from '../../shared/patientSafety.js';
import {
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
} from '../../shared/locationScopedEntityQuery.js';
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

function genericRepairEligibility(row, location) {
  return getGenericRepairEligibility({
    canonicalKey: normalizeServiceKey(row?.service_key).canonicalKey,
    confirmationLevel: row?.confirmation_level,
    exposeFullDetails: getPublicLocationDisclosure(location).expose_full_details,
  });
}

function safeServiceRow(row, location, context) {
  if (!row || row.migration_review_required) return false;
  if (!isServiceMatchingEligible(row, location)) return false;
  const genericRepairResult = genericRepairEligibility(row, location);
  if (genericRepairResult !== null) return genericRepairResult;
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

function patientSearchScope(value) {
  return value === 'county' ? 'county' : 'locality';
}

function locationSirutaCode(location) {
  return clean(location?.locality_siruta_code);
}

function expansionTier(location, selectedSirutaCode) {
  return locationSirutaCode(location) === selectedSirutaCode ? 'oras' : 'judet';
}

function resultRoutingReason(tier, countyName) {
  if (tier === 'oras') return 'Potrivire din localitatea selectata.';
  return countyName
    ? `Potrivire din alta localitate din judetul ${countyName}.`
    : 'Potrivire din alta localitate din acelasi judet.';
}

async function resolveSelectedLocality(svc, sirutaCode) {
  const rows = await svc.entities.GeographicLocality.filter({
    siruta_code: sirutaCode,
    is_active: true,
  }, null, 2);
  return rows[0] || null;
}

async function loadPublicLocationsForScope(svc, scope, selectedLocality, sirutaCode) {
  if (scope !== 'county') return loadPublicLocationsForLocality(svc, sirutaCode);
  const countyCode = clean(selectedLocality?.county_code);
  if (!countyCode) return [];
  return svc.entities.ProviderLocation.filter({
    status: 'publicata',
    county_code: countyCode,
  }, 'name', 5000);
}

const PATIENT_GUIDANCE_SHADOW_EVENT = "patient_guidance_shadow_summary";
const PATIENT_GUIDANCE_INTENTS = new Set([
  'control_vedere',
  'control_copil',
  'simptome_oftalmologice',
  'investigatii',
  'ochelari_lentile',
  'lentile_contact',
  'reparatii_ochelari',
  'unknown',
]);
const LEGACY_ANSWER_VALUE_ALIASES = Object.freeze({
  for_whom: Object.freeze({ copil: 'child' }),
  child_age_group: Object.freeze({
    sub_3_ani: 'under_3',
    '3_6_ani': '3_6',
    '7_12_ani': '7_12',
    '13_18_ani': '13_18',
  }),
  investigation_type: Object.freeze({
    camp_vizual: 'visual_field_analyzer',
    tonometrie: 'tonometry',
    fund_de_ochi: 'fundus_exam',
    topografie_corneana: 'corneal_topography',
    nu_sunt_sigur: 'not_sure',
  }),
  optical_product_type: Object.freeze({
    ochelari_noi: 'new_eyeglasses',
    lentile_progresive: 'progressive_lenses',
    schimbare_lentile: 'lens_replacement',
    lentile_contact: 'contact_lenses',
    nu_sunt_sigur: 'not_sure',
  }),
  contact_lens_experience: Object.freeze({
    da: 'first_time',
    nu: 'experienced',
  }),
  repair_type: Object.freeze({
    rama_rupta: 'broken_frame',
    balama_surub: 'hinge_or_screw',
    lentila_zgariata: 'damaged_lens',
    reglaj_rama: 'frame_adjustment',
    nu_stiu: 'not_sure',
  }),
});
const QUESTION_KEY_ALIASES = new Map(
  Object.values(PATIENT_GUIDANCE_QUESTION_CATALOG).flatMap((question) => [
    [question.key, question.key],
    ...(question.legacy_question_keys || []).map((key) => [key, question.key]),
  ]),
);

function canonicalQuestionKey(value) {
  return QUESTION_KEY_ALIASES.get(clean(value)) || null;
}

function canonicalAnswerValue(questionKey, value) {
  const rawValue = clean(value);
  const aliasedValue = LEGACY_ANSWER_VALUE_ALIASES[questionKey]?.[rawValue] || rawValue;
  const question = PATIENT_GUIDANCE_QUESTION_CATALOG[questionKey];
  if (!question) return null;
  if (question.type === 'choice') {
    return question.options?.some((option) => option.key === aliasedValue) ? aliasedValue : null;
  }
  return aliasedValue || null;
}

function controlledQuestionHistory(payload) {
  return [...new Set((Array.isArray(payload.question_history) ? payload.question_history : [])
    .map(canonicalQuestionKey)
    .filter((key) => key && isApprovedPatientGuidanceQuestionKey(key)))]
    .slice(0, 30);
}

function controlledGuidedAnswers(payload, questionHistory) {
  const history = new Set(questionHistory);
  return (Array.isArray(payload.answers) ? payload.answers : [])
    .slice(0, 30)
    .map((answer) => {
      const questionKey = canonicalQuestionKey(answer?.question_key);
      if (!questionKey || !history.has(questionKey)) return null;
      const answerValue = canonicalAnswerValue(questionKey, answer?.answer_value);
      return answerValue ? { question_key: questionKey, answer_value: answerValue } : null;
    })
    .filter(Boolean);
}

function explicitIntentFromPayload(payload) {
  const intent = clean(payload.explicit_primary_intent);
  return PATIENT_GUIDANCE_INTENTS.has(intent) ? intent : 'unknown';
}

function confirmedServiceKeysFromAnswers(answers) {
  return [...new Set((answers || []).flatMap((answer) => {
    const question = PATIENT_GUIDANCE_QUESTION_CATALOG[answer.question_key];
    const option = question?.options?.find((item) => item.key === answer.answer_value);
    return (option?.service_keys || [])
      .map((value) => normalizeServiceKey(value).canonicalKey)
      .filter(Boolean);
  }))];
}

function serverQuestionSafetyState(searchText, answers) {
  const assessment = buildPatientSafetyAssessment({ text: searchText, answers });
  if (assessment.blocking) return 'blocking';
  const completedSafetyCheck = answers.some((answer) => (
    answer.question_key === 'safety_targeted_check'
    && answer.answer_value === 'niciuna'
  ));
  return completedSafetyCheck ? 'clear' : 'unchecked';
}

function explicitLocalityFromPayload(payload) {
  const locality = {
    siruta_code: clean(payload.locality_siruta_code),
    city: clean(payload.locality_name || payload.locality_city),
    county_code: clean(payload.county_code),
    county: clean(payload.county_name),
  };
  const controlled = Object.fromEntries(
    Object.entries(locality).filter(([, value]) => Boolean(value)),
  );
  return Object.keys(controlled).length > 0 ? controlled : null;
}

function observePatientGuidanceShadow(context) {
  const observation = runPatientGuidanceRuntimeShadow(context);
  console.info(
    PATIENT_GUIDANCE_SHADOW_EVENT,
    JSON.stringify({ ...observation.summary, ...observation.comparison }),
  );
  return {
    ...observation.live_result,
    patient_guidance_question_selection: observation.question_selection,
  };
}

function activatedQuestionSelection(observation) {
  const selection = observation.question_selection;
  if (selection?.status === 'safety_blocked') return selection;
  const clinicalBlocks = observation.patient_guidance_shadow_profile
    ?.routing_profile?.blocking_validation_rule_keys;
  if (!Array.isArray(clinicalBlocks) || clinicalBlocks.length === 0) return selection;
  return {
    ...selection,
    status: 'fallback',
    next_question_key: null,
    fallback_reason: 'clinical_validation_required',
  };
}

function selectPatientGuidanceQuestion(payload, searchText, deterministicServiceKeys) {
  const questionHistory = controlledQuestionHistory(payload);
  const guidedAnswers = controlledGuidedAnswers(payload, questionHistory);
  const liveResult = { mode: 'question_only', status: 'completed' };
  const observation = runPatientGuidanceRuntimeShadow({
    liveResult,
    text: searchText,
    legacyStatus: 'not_requested',
    legacyInterpretation: null,
    explicitLocality: explicitLocalityFromPayload(payload),
    explicitPrimaryIntent: explicitIntentFromPayload(payload),
    explicitConfirmedServiceKeys: confirmedServiceKeysFromAnswers(guidedAnswers),
    guidedAnswers,
    questionHistory,
    deterministicIntent: 'unknown',
    deterministicServiceKeys,
    deterministicFacts: {},
    deterministicSafetyState: serverQuestionSafetyState(searchText, guidedAnswers),
  });

  const selection = activatedQuestionSelection(observation);
  const completed = ['selected', 'complete', 'safety_blocked'].includes(selection?.status);
  return {
    mode: 'question_only',
    status: completed ? 'completed' : 'unavailable',
    reason: completed ? null : (selection?.fallback_reason || 'planner_unavailable'),
    patient_guidance_question_selection: selection,
  };
}

async function interpretPatientNeed(
  base44,
  payload,
  searchText,
  deterministicServiceKeys,
  shadowContext = {},
) {
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
    const interpretation = sanitizePatientNeedInterpretation(raw, {
      deterministicIntent,
      deterministicServiceKeys,
    });
    const liveResult = {
      mode: 'shadow',
      status: 'completed',
      interpretation,
    };
    return observePatientGuidanceShadow({
      liveResult,
      text: searchText,
      legacyStatus: 'completed',
      legacyInterpretation: interpretation,
      ...shadowContext,
    });
  } catch (_error) {
    // AI is advisory in shadow mode. Its failure must never block deterministic search.
    const liveResult = {
      mode: 'shadow',
      status: 'unavailable',
      reason: 'ai_interpretation_unavailable',
    };
    return observePatientGuidanceShadow({
      liveResult,
      text: searchText,
      legacyStatus: 'unavailable',
      legacyInterpretation: null,
      ...shadowContext,
    });
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

    if (payload.mode === 'question_only') {
      return Response.json(selectPatientGuidanceQuestion(
        payload,
        searchText,
        semantic.service_keys,
      ));
    }

    if (payload.mode === 'interpret_only') {
      return Response.json(await interpretPatientNeed(
        base44,
        payload,
        searchText,
        requestedKeys,
        {
          explicitLocality: explicitLocalityFromPayload(payload),
          explicitPrimaryIntent: clean(payload.explicit_primary_intent),
          explicitConfirmedServiceKeys: Array.isArray(payload.explicit_confirmed_service_keys)
            ? payload.explicit_confirmed_service_keys
            : [],
          guidedAnswers: Array.isArray(payload.answers) ? payload.answers : [],
          questionHistory: Array.isArray(payload.question_history) ? payload.question_history : [],
          deterministicIntent: clean(payload.deterministic_intent || payload.intent),
          deterministicServiceKeys: Array.isArray(payload.deterministic_service_keys)
            ? payload.deterministic_service_keys
            : semantic.service_keys,
          deterministicFacts: payload.deterministic_facts,
          deterministicSafetyState: clean(payload.deterministic_safety_state),
        },
      ));
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
    const queryScope = patientSearchScope(payload.query_scope);

    if (!sirutaCode) {
      return Response.json({
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
        results: [],
        resolved_service_keys: requestedKeys,
        semantic_resolution: semantic,
        need_level: requestNeedLevel(requestedKeys),
        routing_mode: queryScope,
        query_scope: queryScope,
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: null,
      });
    }

    const selectedLocality = await resolveSelectedLocality(svc, sirutaCode);
    if (!selectedLocality) {
      return Response.json({
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
        results: [],
        resolved_service_keys: requestedKeys,
        semantic_resolution: semantic,
        need_level: requestNeedLevel(requestedKeys),
        routing_mode: queryScope,
        query_scope: queryScope,
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: sirutaCode,
      });
    }

    const countyCode = clean(selectedLocality.county_code);
    const countyName = clean(selectedLocality.county_name);
    if (queryScope === 'county' && !countyCode) {
      return Response.json({
        recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
        results: [],
        resolved_service_keys: requestedKeys,
        semantic_resolution: semantic,
        need_level: requestNeedLevel(requestedKeys),
        routing_mode: 'county',
        query_scope: 'county',
        coverage_status: 'canonical_locality_required',
        selected_locality_siruta_code: sirutaCode,
      });
    }

    const providerTypes = new Set(Array.isArray(payload.provider_types) ? payload.provider_types.filter(Boolean) : []);
    const scopeLocationRows = await loadPublicLocationsForScope(svc, queryScope, selectedLocality, sirutaCode);
    const scopedLocations = scopeLocationRows.filter((location) => (
      active(location)
      && location.profile_control_status !== 'suspended'
      && PATIENT_FACING_PROFILE_TYPES.has(location.provider_profile_type)
      && (providerTypes.size === 0 || providerTypes.has(location.provider_type))
    ));
    const localLocations = scopedLocations.filter((location) => locationSirutaCode(location) === sirutaCode);
    const locationIds = scopedLocations.map((location) => location.id).filter(Boolean);

    const [
      services,
      assignments,
      equipment,
      facilities,
      functionalUnits,
      capabilities,
    ] = await Promise.all([
      loadRowsForLocationIds(svc.entities.LocationService, locationIds, { perLocationLimit: 500 }),
      loadRowsForLocationIds(svc.entities.ProfessionalLocationAssignment, locationIds, { query: { active_status: 'activ' }, perLocationLimit: 200 }),
      loadRowsForLocationIds(svc.entities.LocationEquipment, locationIds, { perLocationLimit: 300 }),
      loadRowsForLocationIds(svc.entities.LocationFacility, locationIds, { perLocationLimit: 300 }),
      loadRowsForLocationIds(svc.entities.LocationFunctionalUnit, locationIds, { perLocationLimit: 200 }),
      loadRowsForLocationIds(svc.entities.LocationCapability, locationIds, { perLocationLimit: 300 }),
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
    let configuredMatchingProviderCount = 0;
    let localConfiguredMatchingProviderCount = 0;
    const results = [];

    for (const location of scopedLocations) {
      const locationRows = servicesByLocation[location.id] || [];
      const candidateRows = locationRows.filter((row) => {
        const canonicalKey = normalizeServiceKey(row.service_key).canonicalKey;
        return Boolean(canonicalKey && requestedSet.has(canonicalKey));
      });
      if (candidateRows.length === 0) continue;
      configuredMatchingProviderCount += 1;
      if (locationSirutaCode(location) === sirutaCode) localConfiguredMatchingProviderCount += 1;

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
      const safeLocationRows = locationRows.filter((row) => safeServiceRow(row, location, prerequisiteContext));

      const matchedKeys = [...new Set(
        qualifyingRows.map((row) => normalizeServiceKey(row.service_key).canonicalKey).filter(Boolean),
      )];
      const semanticMatchedKeys = matchedKeys.filter((key) => semanticScoreByKey[key] > 0);
      const semanticScore = semanticMatchedKeys.reduce(
        (sum, key) => sum + semanticScoreByKey[key],
        0,
      );
      const publicDisclosure = getPublicLocationDisclosure(location);
      const profileControlStatus = publicDisclosure.profile_control_status;
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
        matchedServiceKeys: publicDisclosure.expose_full_details ? matchedKeys : [],
        profileControlStatus,
        availability: publicDisclosure.expose_full_details ? availability : null,
      });
      const tier = expansionTier(location, sirutaCode);

      results.push({
        id: location.id,
        name: location.public_display_name || location.name,
        provider_type: location.provider_type,
        provider_profile_type: location.provider_profile_type,
        city: location.locality_name || location.city || null,
        county: location.county_name || location.county || null,
        address: publicDisclosure.address,
        phone: publicDisclosure.phone,
        website: publicDisclosure.website,
        opening_hours: publicDisclosure.opening_hours,
        saturday_hours: publicDisclosure.saturday_hours,
        profile_control_status: profileControlStatus,
        public_detail_level: publicDisclosure.public_detail_level,
        exact_location_visible: publicDisclosure.exact_location_visible,
        contact_details_visible: publicDisclosure.contact_details_visible,
        public_services: publicDisclosure.expose_full_details
          ? safeLocationRows.map(toPublicService).filter(Boolean)
          : [],
        matched_public_services: publicDisclosure.expose_full_details
          ? qualifyingRows.map(toPublicService).filter(Boolean)
          : [],
        matched_service_keys: matchedKeys,
        semantic_matched_service_keys: semanticMatchedKeys,
        semantic_match_score: Math.round(semanticScore * 1000) / 1000,
        availability_label: publicDisclosure.expose_full_details ? (availability?.label || null) : null,
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
        expansion_tier: tier,
        routing_reason: resultRoutingReason(tier, countyName),
        score: score.total,
      });
    }

    const bucketedResults = assignRecommendationBuckets(results, limit);
    const localEligibleProviderCount = results.filter((result) => result.expansion_tier === 'oras').length;
    const countyEligibleProviderCount = results.filter((result) => result.expansion_tier === 'judet').length;
    const coverageCounts = {
      local_provider_count: localLocations.length,
      scope_provider_count: scopedLocations.length,
      county_provider_count: queryScope === 'county' ? scopedLocations.length : 0,
      configured_matching_provider_count: configuredMatchingProviderCount,
      local_configured_matching_provider_count: localConfiguredMatchingProviderCount,
      eligible_provider_count: results.length,
      local_eligible_provider_count: localEligibleProviderCount,
      county_eligible_provider_count: countyEligibleProviderCount,
      result_count: bucketedResults.length,
    };
    const coverageStatus = getRecommendationCoverageStatus({
      resultCount: coverageCounts.result_count,
      localProviderCount: coverageCounts.scope_provider_count,
      configuredMatchingProviderCount: coverageCounts.configured_matching_provider_count,
    });
    const routingReason = queryScope === 'county'
      ? `Cautare extinsa explicit in judetul ${countyName || 'selectat'}.`
      : 'Potrivire dupa localitatea selectata.';

    return Response.json({
      recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
      results: bucketedResults,
      resolved_service_keys: requestedKeys,
      semantic_resolution: semantic,
      need_level: needLevel,
      resolved_intent: intent || null,
      routing_mode: queryScope,
      query_scope: queryScope,
      routing_reason: routingReason,
      coverage_status: coverageStatus,
      coverage_counts: coverageCounts,
      selected_locality_siruta_code: sirutaCode,
      selected_locality_name: clean(selectedLocality.name),
      selected_county_code: countyCode || null,
      selected_county_name: countyName || null,
      client_address_text: clean(payload.client_address_text),
    });
  } catch (error) {
    return Response.json({
      error: error?.message || 'Eroare neașteptată la căutarea semantică.',
    }, { status: 500 });
  }
});
