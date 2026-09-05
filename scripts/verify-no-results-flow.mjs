import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRecommendationCoverageStatus } from '../base44/functions/matchProvidersSemantic/coverage.js';

assert.equal(getRecommendationCoverageStatus({ resultCount: 0, localProviderCount: 0, configuredMatchingProviderCount: 0 }), 'no_local_providers');
assert.equal(getRecommendationCoverageStatus({ resultCount: 0, localProviderCount: 4, configuredMatchingProviderCount: 0 }), 'local_service_data_missing');
assert.equal(getRecommendationCoverageStatus({ resultCount: 0, localProviderCount: 4, configuredMatchingProviderCount: 2 }), 'no_eligible_local_results');
assert.equal(getRecommendationCoverageStatus({ resultCount: 1, localProviderCount: 4, configuredMatchingProviderCount: 2 }), 'results_found');

const noResults = await readFile(new URL('../src/components/intake2/NoResultsFlow.jsx', import.meta.url), 'utf8');
const matchResults = await readFile(new URL('../src/components/intake2/MatchResults.jsx', import.meta.url), 'utf8');

for (const status of [
  'no_local_providers',
  'local_service_data_missing',
  'no_eligible_local_results',
  'query_not_mapped',
  'query_required',
  'canonical_locality_required',
  'no_local_results',
]) {
  assert.match(noResults, new RegExp(status));
}

assert.match(noResults, /Schimbă localitatea/);
assert.match(noResults, /Revizuiește criteriile/);
assert.match(noResults, /Explorează directorul complet/);
assert.match(noResults, /nu completează lista cu profiluri slab potrivite/);
assert.doesNotMatch(noResults.toLowerCase(), /asistență umană|concierge|extindere națională|garantăm/);

assert.match(matchResults, /import NoResultsFlow/);
assert.match(matchResults, /recommendationState/);
// 2026-09-05: conditia se uita la cate optiuni a gasit SERVERUL, nu la cate se vad pe ecran.
// Ecranul de rezultate poate filtra vizual lista la ce se vede pe harta, iar o simpla deplasare
// a hartii nu are voie sa declanseze fluxul de recuperare.
assert.match(matchResults, /serverTop3Count < 3/);
assert.match(matchResults, /const serverTop3Count = list\.filter/);
assert.match(matchResults, /mode="empty"/);
assert.match(matchResults, /mode="insufficient"/);
assert.match(matchResults, /patient_search_recovery_action_clicked/);
assert.match(matchResults, /change_location/);
assert.match(matchResults, /review_criteria/);
assert.match(matchResults, /window\.location\.assign/);
assert.match(matchResults, /params\.delete\("ref"\)/);
assert.match(matchResults, /result_bucket === "top3"/);
assert.match(matchResults, /result_bucket === "extended_directory"/);
// Avertismentul despre profilurile neconfirmate a fost consolidat (2026-08-06): nu mai
// e repetat ca paragraf la fiecare sectiune, ci apare pe fiecare card (TrustBadge) plus
// o singura mentiune la finalul paginii. Verificam ca avertizarea exista in forma noua.
assert.match(matchResults, /servicii neconfirmate|nu ofer\u0103 diagnostic medical/);
assert.doesNotMatch(matchResults.toLowerCase(), /cel mai bun furnizor|rezultat garantat/);

console.log('No-results and insufficient-results recovery checks passed.');
