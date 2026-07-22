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
import {
  buildPatientGuidancePlannerProfile,
  runPatientGuidanceRuntimeShadow,
} from '../../shared/patientGuidancePlanner.js';
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  PATIENT_GUIDANCE_QUESTION_KEYS,
  isApprovedPatientGuidanceQuestionKey,
} from '../../shared/patientGuidanceQuestionCatalog.js';
import { buildPatientSafetyAssessment } from '../../shared/patientSafety.js';
import { detectPatientGuidanceSignals } from '../../shared/patientGuidanceRouting.js';
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
  return observation.live_result;
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

const QUESTION_ONLY_CONTRACT_VERSION = 'patient-guidance-question-selection-v1';

const QUESTION_ONLY_INTENT_KEYS = new Set([
  'control_vedere',
  'control_copil',
  'simptome_oftalmologice',
  'investigatii',
  'ochelari_lentile',
  'lentile_contact',
  'reparatii_ochelari',
  'unknown',
]);

function cleanQuestionOnlyText(value: unknown, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function canonicalGuidanceQuestionKey(rawKey: unknown) {
  const key = cleanQuestionOnlyText(rawKey, 80);
  if (!key) return null;
  if (isApprovedPatientGuidanceQuestionKey(key)) return key;
  for (const canonicalKey of PATIENT_GUIDANCE_QUESTION_KEYS) {
    const question = (PATIENT_GUIDANCE_QUESTION_CATALOG as any)[canonicalKey];
    if ((question.legacy_question_keys || []).includes(key)) return canonicalKey;
  }
  return null;
}

// This endpoint is stateless (no server-side session). It cannot verify that a
// question was actually shown to this browser before this answer arrived — the
// only check possible here is schema/type validation against the approved
// question catalog. This is not an authorization or trust check.
function sanitizeControlledGuidanceAnswer(rawAnswer: any) {
  if (!rawAnswer || typeof rawAnswer !== 'object') return null;
  const canonicalKey = canonicalGuidanceQuestionKey(rawAnswer.question_key);
  if (!canonicalKey) return null;
  const question = (PATIENT_GUIDANCE_QUESTION_CATALOG as any)[canonicalKey];
  const rawValue = rawAnswer.answer_value;

  if (question.type === 'choice') {
    const value = cleanQuestionOnlyText(rawValue, 160);
    const validOption = (question.options || []).some((option: any) => option.key === value);
    return validOption ? { question_key: canonicalKey, answer_value: value } : null;
  }
  if (question.type === 'text') {
    const value = cleanQuestionOnlyText(rawValue, 800);
    return value ? { question_key: canonicalKey, answer_value: value } : null;
  }
  if (question.type === 'location') {
    if (!rawValue || typeof rawValue !== 'object') return null;
    const value = {
      siruta_code: cleanQuestionOnlyText(rawValue.siruta_code, 40),
      city: cleanQuestionOnlyText(rawValue.city || rawValue.name, 120),
      county_code: cleanQuestionOnlyText(rawValue.county_code, 40),
      county: cleanQuestionOnlyText(rawValue.county || rawValue.county_name, 120),
    };
    return (value.siruta_code || value.city) ? { question_key: canonicalKey, answer_value: value } : null;
  }
  return null;
}

function explicitGuidanceServiceKeysFromAnswers(validatedAnswers: any[]) {
  const keys: string[] = [];
  for (const answer of validatedAnswers) {
    const question = (PATIENT_GUIDANCE_QUESTION_CATALOG as any)[answer.question_key];
    if (question?.type !== 'choice') continue;
    const option = (question.options || []).find((item: any) => item.key === answer.answer_value);
    if (option?.service_keys) keys.push(...option.service_keys);
  }
  return [...new Set(keys)];
}

function guidanceSafetyStateFromAssessment(assessment: any, hasExplicitSafetyNone: boolean) {
  if (assessment.blocking) return 'blocking';
  if ((assessment.advisory_flags || []).length > 0) return 'advisory';
  // "none" (no signal detected in text) is not the same as an explicit, controlled
  // safety clearance. Only a schema-valid safety_targeted_check="niciuna" answer
  // counts as clear — computed from text plus that answer, server-side.
  if (hasExplicitSafetyNone) return 'clear';
  return 'unchecked';
}

function deriveControlledIntentFromAnswers(validatedAnswers: any[]) {
  for (const answer of validatedAnswers) {
    if (answer.question_key === 'routine_vs_symptom' && answer.answer_value === 'symptom') return 'simptome_oftalmologice';
    if (answer.question_key === 'investigation_type') return 'investigatii';
    if (answer.question_key === 'optical_product_type') {
      return answer.answer_value === 'contact_lenses' ? 'lentile_contact' : 'ochelari_lentile';
    }
    if (answer.question_key === 'contact_lens_experience') return 'lentile_contact';
    if (answer.question_key === 'repair_type') return 'reparatii_ochelari';
    if (answer.question_key === 'for_whom' && answer.answer_value === 'child') return 'control_copil';
    if (answer.question_key === 'child_age_group') return 'control_copil';
  }
  return '';
}

// Controlled, deterministic-only question selection. Never calls Core.InvokeLLM.
// Can only influence next_question_key — matching, ranking, Top3 and results are untouched.
//
// Limitation: question_history is sent by the browser as client-side bookkeeping only
// (so the wizard does not re-ask a question it already showed locally). It is NOT
// server-confirmed and is never treated as proof that the server actually offered a
// question — this function is stateless and holds no server-side session for this
// request. It is not read or used to gate answer acceptance below; only used, if
// present, as an informational hint. Answers are accepted purely on schema/type
// validation against the approved question catalog (see sanitizeControlledGuidanceAnswer),
// and only ever affect which question is shown next — never matching, ranking, Top3,
// or live service data.
function handleQuestionOnlyMode(payload: any) {
  const searchText = cleanQuestionOnlyText(
    payload.search_text || payload.query || payload.free_text || payload.search_query,
  );

  const rawAnswers = Array.isArray(payload.answers) ? payload.answers.slice(0, 30) : [];
  const validatedAnswers = rawAnswers
    .map((answer: any) => sanitizeControlledGuidanceAnswer(answer))
    .filter(Boolean)
    .slice(0, 30);

  const guidedAnswersForPlanner = validatedAnswers.map((answer: any) => ({
    question_key: answer.question_key,
    answer_value: answer.answer_value,
  }));
  const explicitConfirmedServiceKeys = explicitGuidanceServiceKeysFromAnswers(validatedAnswers);

  const safetyAnswerEntry = validatedAnswers.find((answer: any) => answer.question_key === 'safety_targeted_check');
  const adaptedSafetyAnswers = safetyAnswerEntry
    ? [{ question_key: 'safety_screening', answer_value: (safetyAnswerEntry as any).answer_value }]
    : [];
  const safetyAssessment = buildPatientSafetyAssessment({
    text: searchText,
    answers: adaptedSafetyAnswers,
  });
  const hasExplicitSafetyNone = validatedAnswers.some(
    (answer: any) => answer.question_key === 'safety_targeted_check' && answer.answer_value === 'niciuna',
  );
  const deterministicSafetyState = guidanceSafetyStateFromAssessment(safetyAssessment, hasExplicitSafetyNone);

  // The browser's claimed explicit_primary_intent is never trusted as authority and is
  // not read at all. Intent is derived only from deterministic server-side text
  // detection and from schema-validated wizard answers.
  const textDetectedIntentRaw = detectPatientGuidanceSignals(searchText)?.proposed_intent || '';
  const textDetectedIntent = QUESTION_ONLY_INTENT_KEYS.has(textDetectedIntentRaw) ? textDetectedIntentRaw : '';
  const controlledIntent = deriveControlledIntentFromAnswers(validatedAnswers);
  const serverConfirmedIntent = controlledIntent || textDetectedIntent || '';

  let profile: any = null;
  try {
    profile = buildPatientGuidancePlannerProfile({
      text: searchText,
      explicitPrimaryIntent: serverConfirmedIntent,
      explicitConfirmedServiceKeys,
      guidedAnswers: guidedAnswersForPlanner,
      deterministicSafetyState,
    }, { status: 'not_requested' });
  } catch (_error) {
    profile = null;
  }

  const safetyInterruption = safetyAssessment.blocking === true || profile?.safety_state === 'blocking';
  const nextQuestionKey = !safetyInterruption && isApprovedPatientGuidanceQuestionKey(profile?.next_question_key)
    ? profile.next_question_key
    : null;

  return {
    envelope: 'patient_guidance_question_selection',
    contract_version: QUESTION_ONLY_CONTRACT_VERSION,
    status: profile ? 'ok' : 'fallback',
    next_question_key: nextQuestionKey,
    safety_interruption: safetyInterruption,
    fallback_reason: profile ? null : 'planner_unavailable',
  };
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const svc = base44.asServiceRole;
    const payload = await request.json().catch(() => ({}));

    if (payload.mode === 'question_only') {
      return Response.json(handleQuestionOnlyMode(payload));
    }

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