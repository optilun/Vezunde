
import assert from 'node:assert/strict';
import { recommendationMapContext } from '../shared/recommendationMapContext.js';
const national = [
  { id: 'tm', name: 'Timisoara', city: 'Timișoara', county: 'Timiș', lat: 45.75, lng: 21.22, map_precision: 'approximate' },
  { id: 'sb', name: 'Sibiu', city: 'Sibiu', county: 'Sibiu', lat: 45.8, lng: 24.15 },
];
const results = [{ id: 'tm', name: 'Recommended', lat: null, lng: null, result_bucket: 'top3', bucket_rank: 2 }];
const result = recommendationMapContext(results, national, { selected_locality_name: 'Timisoara', selected_county_name: 'Timis' });
assert.equal(result.mapResults.length, 2, 'National points remain outside request city');
assert.equal(result.mapResults.find(row => row.id === 'tm').bucket_rank, 2);
assert.equal(result.mapResults.find(row => row.id === 'tm').is_request_result, true);
assert.equal(result.mapResults.find(row => row.id === 'sb').result_bucket, '');
assert.equal(result.mapResults.find(row => row.id === 'sb').is_request_result, false);
assert.deepEqual(result.focusResults.map(row => row.id), ['tm'], 'Camera fits request, not nation');
assert.equal(results[0].lat, null, 'Original request snapshot is not mutated');
assert.equal(result.focusResults[0].lat, 45.75, 'Public coordinates join by exact location identity');
assert.equal(recommendationMapContext(results, national, { query_scope: 'national' }).focusResults.length, 0);
assert.deepEqual(recommendationMapContext([], national, { selected_locality_name: 'Timisoara', selected_county_name: 'Timis' }).focusResults.map(row => row.id), ['tm']);
const unknown = recommendationMapContext([{id: 'no-position', city:'Timisoara'}], national, {});
assert.equal(unknown.mapResults.find(row => row.id === 'no-position').lat, undefined, 'Never invent a pin from city coordinates');
assert.equal(recommendationMapContext([], [...national, national[0]], {}).mapResults.length, 2, 'No duplicate pins');
console.log('National recommendation map: PASS');
