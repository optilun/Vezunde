// 2026-09-26. Acelasi oras are in SIRUTA doua coduri (UAT-ul si resedinta cu acelasi nume).
// Cautarea trebuie sa gaseasca locatiile salvate cu oricare dintre ele, fara sa se extinda la
// alte localitati. Registru si date de test in memorie; codurile sunt cele reale din
// GeographicLocality (verificate 2026-09-26).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loadPublicLocationsForLocality,
  resolveEquivalentLocalityCodes,
} from '../base44/shared/locationScopedEntityQuery.js';

const registry = [
  { siruta_code: '54975', normalized_name: 'cluj napoca', locality_type: 'municipality_county_seat', uat_code: '54975' },
  { siruta_code: '54984', normalized_name: 'cluj napoca', locality_type: 'municipality_component_seat', uat_code: '54975' },
  { siruta_code: '95391', normalized_name: 'pascani', locality_type: 'municipality', uat_code: '95391' },
  { siruta_code: '95408', normalized_name: 'pascani', locality_type: 'municipality_component_seat', uat_code: '95391' },
  { siruta_code: '95417', normalized_name: 'blagesti', locality_type: 'municipality_component', uat_code: '95391' },
  { siruta_code: '179132', normalized_name: 'bucuresti', locality_type: 'bucharest_municipality', uat_code: '179132' },
  ...['179141', '179150', '179169', '179178', '179187', '179196'].map((code, index) => (
    { siruta_code: code, normalized_name: `sector ${index + 1}`, locality_type: 'bucharest_sector', uat_code: '179132' }
  )),
  { siruta_code: '179249', normalized_name: 'chiajna', locality_type: 'commune', uat_code: '179249' },
  { siruta_code: '179258', normalized_name: 'chiajna', locality_type: 'commune_village_seat', uat_code: '179249' },
  { siruta_code: '179267', normalized_name: 'dudu', locality_type: 'commune_village', uat_code: '179249' },
].map((row) => ({ ...row, is_active: true }));

let geoCalls = 0;
const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
const svc = {
  entities: {
    GeographicLocality: {
      filter: async (query, _sort, limit) => {
        geoCalls += 1;
        return registry.filter((row) => matches(row, query)).slice(0, limit);
      },
    },
    ProviderLocation: {
      filter: async (query) => {
        svc.lastLocationQuery = query;
        return [];
      },
    },
  },
};

const sorted = async (code) => [...await resolveEquivalentLocalityCodes(svc, code)].sort();

assert.deepEqual(await sorted('54975'), ['54975', '54984'], 'Cluj-Napoca: UAT-ul gaseste si resedinta cu acelasi nume');
assert.deepEqual(await sorted('95391'), ['95391', '95408'], 'Pascani: doar resedinta, nu si satele municipiului (Blagesti)');
assert.deepEqual(await sorted('179249'), ['179249', '179258'], 'comuna: doar satul-resedinta cu acelasi nume, nu Dudu');
assert.deepEqual(await sorted('179132'), ['179132', '179141', '179150', '179169', '179178', '179187', '179196'], 'Bucuresti include cele 6 sectoare');
assert.deepEqual(await sorted('179141'), ['179141'], 'un sector ramane doar sectorul ales');
assert.deepEqual(await sorted('54984'), ['54975', '54984'], 'si invers: resedinta gaseste UAT-ul cu acelasi nume');
assert.deepEqual(await sorted('179267'), ['179267'], 'un sat fara alt cod echivalent ramane singur');
assert.deepEqual(await sorted('999999'), ['999999'], 'cod necunoscut: doar codul ales, ca inainte');

const before = geoCalls;
await resolveEquivalentLocalityCodes(svc, '54975');
assert.equal(geoCalls, before, 'raspunsul se tine minte, fara citiri noi');

await loadPublicLocationsForLocality(svc, '95391');
assert.deepEqual(svc.lastLocationQuery, { status: 'publicata', locality_siruta_code: { $in: ['95391', '95408'] } });
await loadPublicLocationsForLocality(svc, '179267');
assert.deepEqual(svc.lastLocationQuery, { status: 'publicata', locality_siruta_code: '179267' }, 'un singur cod: interogarea ramane cea veche');
await loadPublicLocationsForLocality(svc, '54975', { equivalentCodes: ['54975', '54984'] });
assert.deepEqual(svc.lastLocationQuery.locality_siruta_code, { $in: ['54975', '54984'] });

// Fara registru (eroare de citire), cautarea ramane ca inainte, pe codul ales, si nu tine minte.
const failing = { entities: { GeographicLocality: { filter: async () => { throw new Error('rate limit'); } } } };
assert.deepEqual(await resolveEquivalentLocalityCodes(failing, '11111'), ['11111']);

// Aceeasi regula peste tot unde se cauta pe localitate si unde se eticheteaza „în localitatea aleasă”.
for (const file of ['matchProvidersSemantic', 'matchProfessionals']) {
  const source = fs.readFileSync(`base44/functions/${file}/entry.ts`, 'utf8');
  assert.match(source, /resolveEquivalentLocalityCodes/);
  assert.match(source, /localityCodes\.has\(locationSirutaCode\(location\)\)\) return 'oras'/);
  assert.ok(!/locationSirutaCode\(location\) === (sirutaCode|selectedSirutaCode)/.test(source), `${file}: nicio comparatie pe un singur cod`);
}
for (const file of ['matchProviders', 'browseDirectoryProviders']) {
  assert.match(fs.readFileSync(`base44/functions/${file}/entry.ts`, 'utf8'), /loadPublicLocationsForLocality\(svc, sirutaCode\)/);
}

console.log('Locality equivalent codes: UAT + same-name seat, Bucharest sectors, no expansion to other villages, cache, fallback — OK');
