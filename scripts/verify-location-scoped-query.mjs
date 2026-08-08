import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadPublicLocationsForLocality,
  loadRowsForLocationIds,
  paginateRows,
} from '../shared/locationScopedEntityQuery.js';

const locationCalls = [];
const svc = {
  entities: {
    ProviderLocation: {
      filter: async (query, sort, limit) => {
        locationCalls.push({ query, sort, limit });
        return [
          { id: 'loc-1', name: 'Locatia 1', locality_siruta_code: query.locality_siruta_code },
          { id: 'loc-2', name: 'Locatia 2', locality_siruta_code: query.locality_siruta_code },
        ];
      },
    },
  },
};

const localLocations = await loadPublicLocationsForLocality(svc, '155243');
assert.equal(localLocations.length, 2);
assert.deepEqual(locationCalls[0].query, {
  status: 'publicata',
  locality_siruta_code: '155243',
});
assert.equal(locationCalls[0].sort, 'name');
assert.equal(locationCalls[0].limit, 1000);

const childCalls = [];
const entity = {
  filter: async (query, sort, limit) => {
    childCalls.push({ query, sort, limit });
    return [{ id: `${query.location_id}-service`, location_id: query.location_id }];
  },
};

const childRows = await loadRowsForLocationIds(entity, ['loc-1', 'loc-2', 'loc-1'], {
  query: { active_status: 'activ' },
  perLocationLimit: 25,
});
assert.equal(childRows.length, 2);
assert.equal(childCalls.length, 2);
assert.deepEqual(childCalls.map((call) => call.query), [
  { active_status: 'activ', location_id: 'loc-1' },
  { active_status: 'activ', location_id: 'loc-2' },
]);
assert.ok(childCalls.every((call) => call.limit === 25));

const pagination = paginateRows(['a', 'b', 'c', 'd'], { pageSize: 2, offset: 1 });
assert.deepEqual(pagination.page, ['b', 'c']);
assert.deepEqual(pagination.pagination, {
  offset: 1,
  page_size: 2,
  returned: 2,
  total: 4,
  has_more: true,
  next_offset: 3,
});

const deterministicSource = await readFile(new URL('../base44/functions/matchProviders/entry.ts', import.meta.url), 'utf8');
const semanticSource = await readFile(new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url), 'utf8');
const browseSource = await readFile(new URL('../base44/functions/browseDirectoryProviders/entry.ts', import.meta.url), 'utf8');
const coverageSource = await readFile(new URL('../base44/functions/getPublicLocationsForSearch/entry.ts', import.meta.url), 'utf8');

for (const source of [deterministicSource, browseSource]) {
  assert.match(source, /loadPublicLocationsForLocality/);
  assert.match(source, /loadRowsForLocationIds/);
  assert.match(source, /query_scope: 'locality'/);
  assert.doesNotMatch(source, /ProviderLocation\.filter\(\{ status: 'publicata' \}, null, (?:500|1000)\)/);
}

assert.match(semanticSource, /loadPublicLocationsForLocality/);
assert.match(semanticSource, /loadRowsForLocationIds/);
assert.match(semanticSource, /function patientSearchScope\(value\)/);
// patientSearchScope trateaza acum si 'national' (2026-08-06), pe langa county/locality.
assert.match(semanticSource, /if \(value === 'county'\) return 'county';/);
assert.match(semanticSource, /if \(value === 'national'\) return 'national';/);
assert.match(semanticSource, /query_scope: queryScope/);
assert.match(semanticSource, /scope !== 'county'/);
assert.match(semanticSource, /county_code: countyCode/);
assert.match(semanticSource, /svc\.entities\.GeographicLocality\.filter/);
assert.doesNotMatch(semanticSource, /ProviderLocation\.filter\(\{ status: 'publicata' \}, null, (?:500|1000|5000)\)/);
assert.doesNotMatch(semanticSource, /query_scope: 'national'/);

assert.doesNotMatch(deterministicSource, /LocationService\.list\(null, 2000\)/);
assert.doesNotMatch(semanticSource, /LocationService\.list\(null, 5000\)/);
assert.doesNotMatch(browseSource, /LocationService\.list\(null, 2000\)/);
assert.match(browseSource, /paginateRows/);
assert.match(browseSource, /pagination/);
assert.match(browseSource, /next_offset/);

assert.match(coverageSource, /loadAllPublicLocationsByCounty/);
assert.match(coverageSource, /query_scope: 'county_partitions'/);
assert.doesNotMatch(coverageSource, /ProviderLocation\.filter\(\{ status: 'publicata' \}, null, 500\)/);

console.log('Locality-scoped provider query checks passed.');
