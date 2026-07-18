import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getRecommendationCoverageStatus } from '../base44/functions/matchProvidersSemantic/coverage.js';
import { normalizeServiceKey } from '../shared/canonicalServiceRegistryExtended.js';
import {
  sanitizePatientNeedInterpretation,
} from '../shared/patientNeedInterpretation.js';
import {
  assignRecommendationBuckets,
  buildRecommendationScore,
  compareRecommendationEntries,
  recommendationBucketForProfile,
} from '../shared/providerRecommendation.js';
import { resolveServiceSearchQuery } from '../shared/serviceSemanticSearch.js';
import {
  INTENTS,
  detectIntentFromText,
  detectSubIntentPrefill,
} from '../src/lib/intentRegistry.js';

function resolve(query) {
  return resolveServiceSearchQuery(query, { limit: 15, minScore: 0.34 });
}

const coverageScenarios = [
  {
    label: 'rezultate locale eligibile',
    counts: { resultCount: 1, localProviderCount: 1, configuredMatchingProviderCount: 1 },
    expected: 'results_found',
  },
  {
    label: 'localitate fara furnizori publicati',
    counts: { localProviderCount: 0, configuredMatchingProviderCount: 0 },
    expected: 'no_local_providers',
  },
  {
    label: 'furnizori locali fara servicii configurate',
    counts: { localProviderCount: 2, configuredMatchingProviderCount: 0 },
    expected: 'local_service_data_missing',
  },
  {
    label: 'servicii locale fara rezultat eligibil',
    counts: { localProviderCount: 2, configuredMatchingProviderCount: 1 },
    expected: 'no_eligible_local_results',
  },
];

for (const scenario of coverageScenarios) {
  assert.equal(
    getRecommendationCoverageStatus(scenario.counts),
    scenario.expected,
    `Coverage incorect pentru ${scenario.label}`,
  );
}

function candidate({
  id,
  name,
  status,
  matchedServiceKeys,
  semanticScoreByKey,
  needLevel = 'general',
  timingKey = '',
  availability = null,
}) {
  const recommendationGroup = recommendationBucketForProfile(status, needLevel);
  if (recommendationGroup === 'excluded') return null;
  const score = buildRecommendationScore({
    matchedServiceKeys,
    semanticScoreByKey,
    profileControlStatus: status,
    timingKey,
    availability,
  });
  return {
    id,
    name,
    profile_control_status: status,
    matched_service_keys: matchedServiceKeys,
    semantic_match_score: score.best_semantic_score,
    recommendation_group: recommendationGroup,
    recommendation_score: score.total,
  };
}

const patientQueries = [
  {
    query: 'am nevoie de un control de vedere',
    expected: ['optometry_consultation'],
  },
  {
    query: 'vad in ceata si cred ca mi-au crescut dioptriile',
    expected: ['optometry_consultation', 'refraction'],
  },
  {
    query: 'caut o investigatie OCT',
    expected: ['oct'],
  },
  {
    query: 'mi s-au rupt ochelarii si trebuie reparati',
    expected: ['eyeglasses_repair'],
  },
  {
    query: 'vreau lentile progresive',
    expected: ['progressive_lenses'],
  },
  {
    query: 'am nevoie de lentile de contact',
    expected: ['contact_lenses'],
  },
  {
    query: 'caut tonometrie',
    expected: ['tonometry'],
  },
  {
    query: 'am nevoie de fund de ochi',
    expected: ['fundus_exam'],
  },
];

for (const scenario of patientQueries) {
  const resolution = resolve(scenario.query);
  for (const serviceKey of scenario.expected) {
    assert.ok(
      resolution.service_keys.includes(serviceKey),
      `${JSON.stringify(scenario.query)} nu a rezolvat ${serviceKey}`,
    );
  }
}

const intentScenarios = [
  { text: 'copilul nu vede tabla', expected: 'control_copil' },
  { text: 'nu vad bine si vreau un control', expected: 'control_vedere' },
  { text: 'am o rama rupta', expected: 'reparatii_ochelari' },
  { text: 'vreau lentile de contact', expected: 'lentile_contact' },
  { text: 'caut o investigatie OCT', expected: 'investigatii' },
  { text: 'ma doare ochiul', expected: 'simptome_oftalmologice' },
];

for (const scenario of intentScenarios) {
  assert.equal(
    detectIntentFromText(scenario.text),
    scenario.expected,
    `Intentie incorecta pentru ${JSON.stringify(scenario.text)}`,
  );
}

assert.deepEqual(
  detectSubIntentPrefill('investigatii', 'am nevoie de un OCT'),
  { question_key: 'investigatie', option_key: 'oct' },
);
assert.deepEqual(
  detectSubIntentPrefill('ochelari_lentile', 'vreau lentile progresive'),
  { question_key: 'ce_cauti', option_key: 'lentile_progresive' },
);

for (const [intentKey, intent] of Object.entries(INTENTS)) {
  const configuredKeys = [
    ...(intent.service_keys || []),
    ...(intent.questions || []).flatMap((question) => (
      (question.options || []).flatMap((option) => option.service_keys || [])
    )),
  ];
  for (const serviceKey of configuredKeys) {
    assert.ok(
      normalizeServiceKey(serviceKey).canonicalKey,
      `Intentia ${intentKey} foloseste un serviciu necunoscut: ${serviceKey}`,
    );
  }
}

const unknown = resolve('serviciu inventat complet zzzzz');
assert.equal(unknown.service_keys.length, 0);
assert.equal(unknown.matches.length, 0);

const blurry = resolve('vad in ceata si cred ca mi-au crescut dioptriile');
const semanticScoreByKey = Object.fromEntries(
  blurry.matches.map((match) => [match.service_key, Number(match.score) || 0]),
);
const matchedKeys = blurry.service_keys.filter((key) => (
  ['optometry_consultation', 'refraction'].includes(key)
));
assert.ok(matchedKeys.length >= 2);

const providers = [
  candidate({
    id: 'verified-strong',
    name: 'Alfa Optic',
    status: 'verified',
    matchedServiceKeys: matchedKeys,
    semanticScoreByKey,
  }),
  candidate({
    id: 'claimed',
    name: 'Beta Optic',
    status: 'claimed',
    matchedServiceKeys: [matchedKeys[0]],
    semanticScoreByKey,
  }),
  candidate({
    id: 'directory',
    name: 'Gamma Optic',
    status: 'directory',
    matchedServiceKeys: matchedKeys,
    semanticScoreByKey,
  }),
  candidate({
    id: 'verified-weak',
    name: 'Delta Optic',
    status: 'verified',
    matchedServiceKeys: [matchedKeys[0]],
    semanticScoreByKey,
  }),
].filter(Boolean);

const ranked = assignRecommendationBuckets(providers, 20);
assert.equal(ranked[0].id, 'verified-strong');
assert.ok(ranked.filter((item) => item.result_bucket === 'top3').length <= 3);
assert.ok(
  ranked
    .filter((item) => item.profile_control_status === 'directory')
    .every((item) => item.result_bucket === 'extended_directory' && item.is_top3_eligible === false),
  'Profilurile neconfirmate din director nu pot intra in Top 3',
);

const reversed = assignRecommendationBuckets([...providers].reverse(), 20);
assert.deepEqual(
  reversed.map((item) => item.id),
  ranked.map((item) => item.id),
  'Clasamentul trebuie sa fie stabil indiferent de ordinea datelor primite',
);
assert.ok(compareRecommendationEntries(ranked[0], ranked[1]) <= 0);

const bucketMatrix = [
  { id: 'confirmed-4', name: 'Delta', recommendation_group: 'confirmed', recommendation_score: 70, semantic_match_score: 0.7, matched_service_keys: ['refraction'], profile_control_status: 'claimed' },
  { id: 'directory-high', name: 'Director', recommendation_group: 'directory', recommendation_score: 99, semantic_match_score: 1, matched_service_keys: ['refraction'], profile_control_status: 'directory' },
  { id: 'confirmed-2', name: 'Beta', recommendation_group: 'confirmed', recommendation_score: 90, semantic_match_score: 0.9, matched_service_keys: ['refraction'], profile_control_status: 'verified' },
  { id: 'confirmed-1', name: 'Alfa', recommendation_group: 'confirmed', recommendation_score: 95, semantic_match_score: 0.95, matched_service_keys: ['refraction'], profile_control_status: 'verified' },
  { id: 'confirmed-3', name: 'Gamma', recommendation_group: 'confirmed', recommendation_score: 80, semantic_match_score: 0.8, matched_service_keys: ['refraction'], profile_control_status: 'verified' },
];
const bucketMatrixRanked = assignRecommendationBuckets(bucketMatrix, 20);
assert.deepEqual(
  bucketMatrixRanked.map((item) => item.id),
  ['confirmed-1', 'confirmed-2', 'confirmed-3', 'confirmed-4', 'directory-high'],
  'Profilurile din director trebuie afisate dupa toate rezultatele confirmate',
);
assert.deepEqual(
  bucketMatrixRanked.map((item) => item.result_bucket),
  ['top3', 'top3', 'top3', 'extended_confirmed', 'extended_directory'],
);
assert.deepEqual(
  assignRecommendationBuckets([...bucketMatrix].reverse(), 20).map((item) => item.id),
  bucketMatrixRanked.map((item) => item.id),
  'Bucket-urile trebuie sa ramana stabile indiferent de ordinea initiala',
);

assert.equal(
  recommendationBucketForProfile('directory', 'specialized_medical'),
  'directory',
  'Un serviciu declarat poate apărea în director fără a fi prezentat ca verificat',
);
assert.equal(recommendationBucketForProfile('verified', 'specialized_medical'), 'confirmed');

const availability = {
  status: 'astazi',
  label: 'Primeste clienti fara programare',
  age_days: 1,
};
const urgent = buildRecommendationScore({
  matchedServiceKeys: matchedKeys,
  semanticScoreByKey,
  profileControlStatus: 'verified',
  availability,
  timingKey: 'cat_mai_repede',
});
const notUrgent = buildRecommendationScore({
  matchedServiceKeys: matchedKeys,
  semanticScoreByKey,
  profileControlStatus: 'verified',
  availability,
  timingKey: 'nu_e_urgent',
});
assert.equal(urgent.components.availability, 5);
assert.equal(notUrgent.components.availability, 0);

const aiShadow = sanitizePatientNeedInterpretation({
  intent: 'control_vedere',
  service_keys: ['refraction', 'invented_service'],
  confidence_band: 'high',
  possible_safety_flags: ['invented_flag'],
}, {
  deterministicIntent: 'control_vedere',
  deterministicServiceKeys: matchedKeys,
});
assert.deepEqual(aiShadow.service_keys, ['refraction']);
assert.deepEqual(aiShadow.possible_safety_flags, []);
assert.equal(aiShadow.agreement_status, 'agree');
assert.deepEqual(
  assignRecommendationBuckets(providers, 20).map((item) => item.id),
  ranked.map((item) => item.id),
  'Interpretarea AI shadow nu trebuie sa modifice eligibilitatea sau ordinea',
);

const analyticsSources = {
  conversational: readFileSync(
    new URL('../src/components/intake2/ConversationalCard.jsx', import.meta.url),
    'utf8',
  ),
  results: readFileSync(
    new URL('../src/components/intake2/MatchResults.jsx', import.meta.url),
    'utf8',
  ),
  resultCard: readFileSync(
    new URL('../src/components/intake2/MatchResultCard.jsx', import.meta.url),
    'utf8',
  ),
  semanticSearch: readFileSync(
    new URL('../src/lib/providerSemanticSearch.js', import.meta.url),
    'utf8',
  ),
};

for (const eventName of [
  'patient_search_started',
  'patient_search_free_text_submitted',
  'patient_search_reformulation_started',
  'patient_search_abandoned',
  'patient_search_completed',
  'patient_search_failed',
]) {
  assert.ok(
    analyticsSources.conversational.includes(eventName),
    `Lipseste evenimentul de cautare ${eventName}`,
  );
}
assert.ok(analyticsSources.results.includes('provider_recommendation_results_viewed'));
assert.ok(analyticsSources.results.includes('provider_recommendation_feedback_submitted'));
assert.ok(analyticsSources.results.includes('configured_matching_provider_count'));
assert.ok(analyticsSources.resultCard.includes('profile_opened'));
assert.ok(analyticsSources.resultCard.includes('phone_clicked'));
assert.ok(analyticsSources.semanticSearch.includes('patient_need_interpretation_shadow'));
assert.ok(analyticsSources.semanticSearch.includes('status: "request_failed"'));
assert.ok(
  Object.values(analyticsSources).every((source) => source.includes('patient-search-v1')),
  'Toata instrumentarea cautarii trebuie sa foloseasca aceeasi versiune analytics',
);

console.log(`Patient query scenarios: ${patientQueries.length}`);
console.log(`Deterministic intent scenarios: ${intentScenarios.length}`);
console.log(`Coverage scenarios: ${coverageScenarios.length}`);
console.log('Patient search and recommendation flow: PASS');
