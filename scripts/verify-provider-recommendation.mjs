import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PROVIDER_RECOMMENDATION_CONTRACT_VERSION,
  assignRecommendationBuckets,
  buildRecommendationExplanations,
  buildRecommendationScore,
  compareRecommendationEntries,
  getFreshAvailability,
  recommendationBucketForProfile,
} from '../shared/providerRecommendation.js';

assert.equal(PROVIDER_RECOMMENDATION_CONTRACT_VERSION, 'provider-recommendation-v1');
assert.equal(recommendationBucketForProfile('verified', 'specialized_medical'), 'confirmed');
assert.equal(recommendationBucketForProfile('claimed', 'specialized_medical'), 'confirmed');
assert.equal(recommendationBucketForProfile('directory', 'general'), 'directory');

const availability = getFreshAvailability({
  availability_status: 'astazi',
  availability_updated_at: '2026-07-14T12:00:00.000Z',
}, new Date('2026-07-15T12:00:00.000Z').getTime());
assert.equal(availability?.label, 'Primeste clienti fara programare');
assert.equal(getFreshAvailability({
  availability_status: 'astazi',
  availability_updated_at: '2026-05-01T12:00:00.000Z',
}, new Date('2026-07-15T12:00:00.000Z').getTime()), null);

const strong = buildRecommendationScore({
  matchedServiceKeys: ['optometry_consultation', 'refraction'],
  semanticScoreByKey: { optometry_consultation: 0.92, refraction: 0.8 },
  profileControlStatus: 'verified',
  availability,
  timingKey: 'cat_mai_repede',
});
const weak = buildRecommendationScore({
  matchedServiceKeys: ['optometry_consultation'],
  semanticScoreByKey: { optometry_consultation: 0.5 },
  profileControlStatus: 'directory',
});
assert.ok(strong.total > weak.total);
const notUrgent = buildRecommendationScore({
  matchedServiceKeys: ['optometry_consultation', 'refraction'],
  semanticScoreByKey: { optometry_consultation: 0.92, refraction: 0.8 },
  profileControlStatus: 'verified',
  availability,
  timingKey: 'nu_e_urgent',
});
assert.equal(strong.components.availability, 5);
assert.equal(notUrgent.components.availability, 0);

const explanations = buildRecommendationExplanations({
  matchedServiceKeys: ['optometry_consultation'],
  profileControlStatus: 'verified',
  availability,
});
assert.ok(explanations.some((item) => item.code === 'confirmed_service_match'));
assert.ok(explanations.some((item) => item.code === 'verified_location_profile'));
assert.ok(explanations.some((item) => item.code === 'fresh_availability'));

const semanticFunctionSource = readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url),
  'utf8',
);
for (const field of [
  'recommendation_explanations: explanations',
  "routing_reason: 'Potrivire dupa localitatea selectata.'",
]) {
  assert.ok(
    semanticFunctionSource.includes(field),
    `matchProvidersSemantic trebuie sa returneze ${field}`,
  );
}

const resultCardSource = readFileSync(
  new URL('../src/components/results/ResultCard.jsx', import.meta.url),
  'utf8',
);
assert.ok(resultCardSource.includes('De ce se potriveste'));
assert.ok(resultCardSource.includes('location.routing_reason'));

const entries = [
  { id: 'b', name: 'Beta', recommendation_group: 'directory', recommendation_score: 90, semantic_match_score: 1, matched_service_keys: ['refraction'], profile_control_status: 'directory' },
  { id: 'a', name: 'Alfa', recommendation_group: 'confirmed', recommendation_score: 70, semantic_match_score: 0.8, matched_service_keys: ['refraction'], profile_control_status: 'verified' },
  { id: 'c', name: 'Gamma', recommendation_group: 'confirmed', recommendation_score: 60, semantic_match_score: 0.7, matched_service_keys: ['refraction'], profile_control_status: 'claimed' },
];
assert.ok(compareRecommendationEntries(entries[1], entries[2]) < 0);
const bucketed = assignRecommendationBuckets(entries, 20);
assert.deepEqual(bucketed.map((item) => item.id), ['a', 'c', 'b']);
assert.deepEqual(bucketed.map((item) => item.result_bucket), ['top3', 'top3', 'extended_directory']);
assert.equal(bucketed[2].is_top3_eligible, false);

console.log('Provider recommendation contract verified.');