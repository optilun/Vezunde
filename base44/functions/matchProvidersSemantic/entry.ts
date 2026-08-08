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
import { runPatientConversationAgentShadow } from './patientConversationAgentShadow.ts';
import { runPatientGuidanceRuntimeShadow } from '../../shared/patientGuidancePlanner.js';
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  isApprovedPatientGuidanceQuestionKey,
} from '../../shared/patientGuidanceQuestionCatalog.js';
import { buildPatientSafetyAssessment } from '../../shared/patientSafety.js';
import { classifyPatientConversationModelFailure } from './patientConversationModelFailureDiagnostics.js';
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

const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';

// --- Structural directory fallback -------------------------------------------------
// Identic ca mecanism cu cel din matchProviders/entry.ts. A se modifica in ambele locuri.
// Profilurile importate nu au LocationService, deci ar fi complet invizibile la orice
// cautare pe nevoie. Nu se inventeaza servicii: se foloseste doar capacitatea structurala
// a tipului de locatie, ca ultim nivel de rezultate, clar etichetat.
const STRUCTURAL_CAPABILITY_BY_PROVIDER_TYPE = {
  optica_medicala: 'optical',
  cabinet_optometric: 'optical',
  cabinet_oftalmologic: 'medical',
  clinica_oftalmologica: 'medical',
};

// Faza de pornire a directorului (2026-08): doar 4 profiluri sunt revendicate national,
// deci aproape orice cautare returneaza zero rezultate confirmate. Pana cand furnizorii
// isi revendica profilurile si isi declara serviciile, fallback-ul structural e principala
// sursa de rezultate, nu o completare marginala - de aceea pragul si plafonul sunt generoase.
// De revizuit in jos pe masura ce creste numarul de profiluri cu servicii confirmate.
const STRUCTURAL_FALLBACK_MIN_CONFIRMED = 8;
const STRUCTURAL_FALLBACK_MAX_RESULTS = 12;

const STRUCTURAL_FALLBACK_NOTICES = {
  optical: 'Profil din director \u2014 servicii neconfirmate inca. Sunteti reprezentantul acestei locatii? Revendicati profilul gratuit.',
  medical: 'Profil din director, preluat din surse oficiale. Serviciile nu sunt confirmate de furnizor. Sunati inainte pentru a verifica disponibilitatea si tipul consultatiei.',
};

const STRUCTURAL_FALLBACK_GROUP_LABELS = {
  optical: 'Alte optici din zona',
  medical: 'Alte cabinete si clinici oftalmologice din zona',
};

// Profilurile revendicate/verificate nu intra pe acest traseu: ele isi pot declara serviciile,
// iar absenta lor este o informatie reala despre furnizor.
function collectStructuralCandidate(location, sirutaCode, countyName, bucket, scope) {
  const disclosure = getPublicLocationDisclosure(location);
  // Accepta si profilurile revendicate/verificate care nu si-au declarat inca serviciile.
  // Altfel, exact profilurile cu cea mai mare incredere devin invizibile la cautari pe
  // nevoie doar pentru ca lista lor de servicii e inca goala - inversul a ce vrem.
  if (!['directory', 'claimed', 'verified'].includes(disclosure.profile_control_status)) return;
  if (location?.migration_review_required) return;
  const capability = STRUCTURAL_CAPABILITY_BY_PROVIDER_TYPE[location?.provider_type];
  if (!capability) return;

  const tier = expansionTier(location, sirutaCode, scope);
  bucket.push({
    id: location.id,
    name: location.public_display_name || location.name,
    provider_type: location.provider_type,
    provider_profile_type: location.provider_profile_type,
    photo_url: disclosure.expose_full_details ? (location.photo_url || null) : null,
    city: location.locality_name || location.city || null,
    county: location.county_name || location.county || null,
    address: disclosure.address,
    phone: disclosure.phone,
    website: disclosure.website,
    opening_hours: disclosure.opening_hours,
    saturday_hours: disclosure.saturday_hours,
    profile_control_status: disclosure.profile_control_status,
    public_detail_level: disclosure.public_detail_level,
    exact_location_visible: disclosure.exact_location_visible,
    contact_details_visible: disclosure.contact_details_visible,
    public_services: [],
    matched_public_services: [],
    matched_service_keys: [],
    semantic_matched_service_keys: [],
    semantic_match_score: 0,
    availability_label: null,
    recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
    recommendation_group: 'structural_directory',
    recommendation_score: 0,
    recommendation_score_components: {},
    recommendation_confidence: 'unconfirmed',
    recommendation_explanations: [],
    match_reasons: [
      disclosure.profile_control_status === 'directory'
        ? STRUCTURAL_FALLBACK_NOTICES[capability]
        : 'Profil revendicat, dar serviciile nu sunt inca declarate. Sunati inainte pentru a confirma disponibilitatea.',
    ],
    structural_fallback: true,
    structural_capability: capability,
    structural_group_label: STRUCTURAL_FALLBACK_GROUP_LABELS[capability],
    has_service_records: false,
    is_top3_eligible: false,
    result_bucket: 'structural_directory',
    expansion_tier: tier,
    routing_reason: resultRoutingReason(tier, countyName),
    score: 0,
  });
}

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
  if (value === 'county') return 'county';
  if (value === 'national') return 'national';
  return 'locality';
}

function locationSirutaCode(location) {
  return clean(location?.locality_siruta_code);
}

function expansionTier(location, selectedSirutaCode, scope) {
  if (locationSirutaCode(location) === selectedSirutaCode) return 'oras';
  if (scope === 'national') return 'tara';
  return 'judet';
}

function resultRoutingReason(tier, countyName) {
  if (tier === 'oras') return 'Potrivire din localitatea selectata.';
  if (tier === 'tara') return 'Potrivire la nivel national - singura optiune confirmata gasita.';
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
  if (scope === 'national') {
    // Extindere nationala: doar profiluri revendicate/verificate, filtrate direct in
    // interogare (nu incarcate integral si filtrate dupa). Locatiile din director nu
    // apar niciodata aici - riscul de a trimite un pacient sute de km pe baza unui
    // profil neconfirmat nu e acceptabil la aceasta scara.
    return svc.entities.ProviderLocation.filter({
      status: 'publicata',
      profile_control_status: { $in: ['claimed', 'verified'] },
    }, 'name', 2000);
  }
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
const PATIENT_GUIDANCE_QUESTION_SELECTION_BLOCKING_RULES = new Set([
  'pediatric_age_to_care_path',
  'symptom_safety_completion',
  'contact_lens_first_time_path',
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

function controlledCategoryIntent(payload) {
  const history = new Set(Array.isArray(payload.question_history) ? payload.question_history : []);
  if (!history.has('categorie')) return 'unknown';
  const answer = (Array.isArray(payload.answers) ? payload.answers : [])
    .find((item) => clean(item?.question_key) === 'categorie');
  const intent = clean(answer?.answer_value);
  return PATIENT_GUIDANCE_INTENTS.has(intent) ? intent : 'unknown';
}

function controlledIntentFromAnswers(payload, answers) {
  let intent = controlledCategoryIntent(payload);
  const answerByKey = Object.fromEntries((answers || [])
    .map((answer) => [answer.question_key, answer.answer_value]));

  if (answerByKey.routine_vs_symptom === 'symptom') intent = 'simptome_oftalmologice';
  if (answerByKey.routine_vs_symptom === 'routine') intent = 'control_vedere';
  if (answerByKey.for_whom === 'child' && intent === 'control_vedere') intent = 'control_copil';
  if (answerByKey.optical_product_type === 'contact_lenses') intent = 'lentile_contact';

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
  const clinicalBlocks = (
    observation.patient_guidance_shadow_profile
      ?.routing_profile?.blocking_validation_rule_keys || []
  ).filter((ruleKey) => PATIENT_GUIDANCE_QUESTION_SELECTION_BLOCKING_RULES.has(ruleKey));
  if (clinicalBlocks.length === 0) return selection;
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
    explicitPrimaryIntent: controlledIntentFromAnswers(payload, guidedAnswers),
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
    // Diagnostic temporar: clasificam eroarea reala, ca sa stim de ce esueaza, fara sa
    // afectam deloc cautarea reala (ramane strict pe ramura shadow/interpret_only).
    const diagnosis = classifyPatientConversationModelFailure(_error);
    const liveResult = {
      mode: 'shadow',
      status: 'unavailable',
      reason: 'ai_interpretation_unavailable',
      diagnosis,
      raw_error_message: String(_error?.message || '').slice(0, 300),
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

async function handlePatientConversationShadowMode(base44, payload) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return Response.json({ error: 'Neautentificat' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (user.role !== 'admin') {
    return Response.json({ error: 'Acces interzis' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const envelope = await runPatientConversationAgentShadow(base44, payload);
  return Response.json(envelope, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const payload = await request.json().catch(() => ({}));

    if (payload.mode === PATIENT_CONVERSATION_SHADOW_MODE) {
      return await handlePatientConversationShadowMode(base44, payload);
    }

    const svc = base44.asServiceRole;
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
    const structuralCandidates = [];

    for (const location of scopedLocations) {
      const locationRows = servicesByLocation[location.id] || [];
      const candidateRows = locationRows.filter((row) => {
        const canonicalKey = normalizeServiceKey(row.service_key).canonicalKey;
        return Boolean(canonicalKey && requestedSet.has(canonicalKey));
      });
      if (candidateRows.length === 0) {
        collectStructuralCandidate(location, sirutaCode, countyName, structuralCandidates, queryScope);
        continue;
      }
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
      const tier = expansionTier(location, sirutaCode, queryScope);

      results.push({
        id: location.id,
        name: location.public_display_name || location.name,
        provider_type: location.provider_type,
        provider_profile_type: location.provider_profile_type,
        // Fotografia urmeaza aceeasi regula ca restul detaliilor complete: profilurile
        // nerevendicate nu expun media, chiar daca ar avea-o setata.
        photo_url: publicDisclosure.expose_full_details ? (location.photo_url || null) : null,
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

    // Fallback structural: doar cand rezultatele cu servicii reale sunt insuficiente.
    // Capacitatea ceruta urmeaza nivelul nevoii, ca sa nu propunem optici pentru o problema
    // medicala sau cabinete pentru o pereche de ochelari.
    const requiredCapability = needLevel === 'specialized_medical' ? 'medical' : 'optical';
    let structuralResults = [];
    if (bucketedResults.length < STRUCTURAL_FALLBACK_MIN_CONFIRMED) {
      structuralResults = structuralCandidates
        .filter((entry) => entry.structural_capability === requiredCapability)
        .sort((a, b) => {
          const hasContact = (entry) => (entry.phone || entry.website) ? 1 : 0;
          const contactDelta = hasContact(b) - hasContact(a);
          if (contactDelta !== 0) return contactDelta;
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .slice(0, STRUCTURAL_FALLBACK_MAX_RESULTS)
        .map((entry, index) => ({ ...entry, bucket_rank: index + 1 }));
    }

    const visibleResults = [...bucketedResults, ...structuralResults];
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
      result_count: visibleResults.length,
      structural_fallback_count: structuralResults.length,
    };
    const coverageStatus = getRecommendationCoverageStatus({
      resultCount: bucketedResults.length,
      localProviderCount: coverageCounts.scope_provider_count,
      configuredMatchingProviderCount: coverageCounts.configured_matching_provider_count,
    });
    const routingReason = queryScope === 'county'
      ? `Cautare extinsa explicit in judetul ${countyName || 'selectat'}.`
      : (queryScope === 'national'
        ? 'Cautare extinsa explicit la nivel national.'
        : 'Potrivire dupa localitatea selectata.');

    return Response.json({
      recommendation_contract_version: PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
      results: visibleResults,
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
  } catch (_error) {
    return Response.json({
      error: 'Cererea nu a putut fi procesata.',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
});
