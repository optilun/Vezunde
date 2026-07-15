import assert from 'node:assert/strict';
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

function resolve(query) {
  return resolveServiceSearchQuery(query, { limit: 15, minScore: 0.34 });
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

assert.equal(
  recommendationBucketForProfile('directory', 'specialized_medical'),
  'excluded',
  'O nevoie medicala specializata nu poate recomanda un profil neverificat',
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

console.log(`Patient query scenarios: ${patientQueries.length}`);
console.log('Patient search and recommendation flow: PASS');
