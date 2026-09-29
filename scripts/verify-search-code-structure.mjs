// Structura codului /cauta dupa auditul din 2026-09-27 (D1, D3, D4; 2026-09-29).
//
// D1 harta 2D si cea vectoriala impart etichetele tipului si lista grupului;
// D3 Search.jsx pastreaza criteriile si afisarea, restul sta in hook-uri; distanta pe glob este
//    scrisa o singura data (shared/geoDistance.js);
// D4 lint pe src/lib, src/hooks si shared, `exhaustive-deps` activ, sintaxa backend verificata.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceKm } from '../shared/geoDistance.js';
import { distanceKm as nearbyDistanceKm } from '../shared/nearbyDirectory.js';
import { MAP_TYPE_LABELS, shortTypeLabel } from '../shared/resultsMapLabels.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
function walk(directory) {
  const out = [];
  for (const name of readdirSync(path.join(root, directory))) {
    const relative = path.join(directory, name);
    if (statSync(path.join(root, relative)).isDirectory()) out.push(...walk(relative));
    else if (/\.(jsx?|mjs|ts)$/.test(name)) out.push(relative);
  }
  return out;
}

// D1
{
  assert.equal(shortTypeLabel('cabinet_oftalmologic'), 'Cabinet oftalmologic');
  assert.equal(shortTypeLabel('necunoscut'), 'Locație');
  assert.equal(Object.keys(MAP_TYPE_LABELS).length, 5);
  assert.match(read('shared/mapMarkerPresentation.js'), /const type = shortTypeLabel\(lead\.provider_type\);/, 'pastila foloseste aceeasi lista');
  assert.doesNotMatch(read('shared/mapMarkerPresentation.js'), /const typeLabels = \{/);
  assert.ok(existsSync(path.join(root, 'src/components/results/MapClusterList.jsx')));
}

// D3
{
  assert.equal(distanceKm({ lat: 44.43, lng: 26.1 }, { lat: 44.43, lng: 26.1 }), 0);
  assert.ok(Math.abs(distanceKm({ lat: 44.4268, lng: 26.1025 }, { lat: 46.7712, lng: 23.6236 }) - 324) < 3, 'Bucuresti - Cluj ~324 km');
  assert.equal(distanceKm({ lat: 'x', lng: 1 }, { lat: 1, lng: 1 }), Infinity);
  assert.equal(nearbyDistanceKm, distanceKm, 'nearbyDirectory reexporta aceeasi functie');
  const haversine = [...walk('src'), ...walk('shared')].filter((file) => /6371/.test(read(file)));
  assert.deepEqual(haversine, ['shared/geoDistance.js'], 'formula distantei este scrisa o singura data');

  const search = read('src/pages/Search.jsx');
  assert.ok(search.split('\n').length < 560, `Search.jsx are ${search.split('\n').length} de linii`);
  for (const hook of ['useSearchResults', 'useSearchUrlSync', 'useStickySearchControls', 'useRememberScroll', 'useDebouncedValue']) {
    assert.ok(existsSync(path.join(root, `src/hooks/${hook}.js`)), `${hook} lipseste`);
    assert.match(search, new RegExp(`import ${hook} from "@/hooks/${hook}";`));
  }
  assert.doesNotMatch(search, /matchProvidersWithSemanticFallback|invokeDirectoryBrowse\(/, 'cererile stau in useSearchResults');
  assert.match(read('src/pages/DirectoryMap.jsx'), /import useRememberScroll from "@\/hooks\/useRememberScroll";/, 'harta Romaniei foloseste acelasi hook de derulare');
  // Potrivirea este chemata cu exact aceleasi campuri ca inainte de mutare.
  const results = read('src/hooks/useSearchResults.js');
  const call = results.slice(results.indexOf('await matchProvidersWithSemanticFallback({'), results.indexOf('});', results.indexOf('await matchProvidersWithSemanticFallback({')));
  for (const field of ['search_text: service ? "" : debouncedQuery', 'directory_filter_location_ids: directoryFilterIds', 'service_keys: service ? [service] : []', 'locality_siruta_code: locality.siruta_code', 'limit: 50']) {
    assert.ok(call.includes(field), `potrivirea: ${field}`);
  }
}

// D4
{
  const config = read('eslint.config.js');
  assert.match(config, /"react-hooks\/exhaustive-deps": "warn"/);
  assert.match(config, /"src\/lib\/\*\*\/\*\.\{js,mjs,jsx\}"/);
  assert.match(config, /"src\/hooks\/\*\*\/\*\.\{js,mjs,jsx\}"/);
  assert.match(config, /"shared\/\*\*\/\*\.\{js,mjs\}"/);
  assert.match(config, /caughtErrorsIgnorePattern: "\^_"/);
  assert.ok(existsSync(path.join(root, 'scripts/verify-backend-syntax.mjs')), 'sintaxa functiilor de backend este verificata');
  const pkg = read('package.json');
  assert.doesNotMatch(pkg, / shared\/locationScopedEntityQuery\.js /, 'lint:services nu mai cere fisierul sters');
}

console.log('Search code structure (D1, D3, D4) checks passed.');
