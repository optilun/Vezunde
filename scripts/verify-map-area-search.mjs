// Harta de pe /cauta „ca pe Airbnb” (2026-09-30).
//
// Inainte: dupa ce alegeai o localitate, harta avea doar punctele ei; mutata in alta zona ramanea
// goala, iar lista nu se schimba. Acum:
// - harta primeste restul directorului national ca puncte de context (fara numar, fara loc in lista,
//   fara efect asupra potrivirii, ordinii sau rezultatelor);
// - camera tine de localitate: se incadreaza pe ea o singura data si nu mai sare la schimbarea
//   filtrelor, a serviciului sau a tipului (nici pe harta Romaniei);
// - cand harta a plecat din localitate apare „Caută în această zonă”, care trece lista pe zona de pe
//   harta (harta Romaniei, cu aceeasi camera); doar la rasfoire, nu la cautarea dupa serviciu.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const {
  AREA_ZOOM_OUT_RATIO,
  searchAreaBounds,
  viewportLeftSearchArea,
  withDirectoryContext,
} = await import(new URL('../shared/searchMapArea.js', import.meta.url));

// --- 1. Punctele de context -----------------------------------------------------------------
const row = (id, lat, lng, extra = {}) => ({ id, name: `Loc ${id}`, city: 'Cluj-Napoca', lat, lng, provider_type: 'optica_medicala', ...extra });
const results = [row('a', 46.77, 23.59, { map_precision: 'exact' }), row('b', 46.78, 23.6)];
const directory = [
  row('a', 46.77, 23.59), // deja intre rezultate
  row('c', 44.43, 26.1, { city: 'Bucuresti' }),
  row('d', 45.75, 21.23, { city: 'Timisoara' }),
  { id: 'e', name: 'Fara pozitie', city: 'Iasi' }, // fara coordonate: nu se pune pe harta
  { id: 'f', lat: 0, lng: 0 }, // „Null Island”: camp necompletat
  null,
];
const merged = withDirectoryContext(results, directory);
assert.deepEqual(merged.map((r) => r.id), ['a', 'b', 'c', 'd'], 'rezultatele raman primele, apoi restul directorului, fara duplicate si fara puncte invalide');
assert.equal(merged[0], results[0], 'un rezultat al cautarii nu se inlocuieste cu randul din director');
assert.equal(withDirectoryContext(results, []), results, 'fara context, aceeasi referinta (harta se incadreaza ca inainte)');
assert.equal(withDirectoryContext(results, null), results);
assert.equal(withDirectoryContext(results, [row('a', 46.77, 23.59)]), results, 'context fara nimic nou: aceeasi referinta');
assert.deepEqual(withDirectoryContext(null, directory).map((r) => r.id), ['a', 'c', 'd']);
assert.equal(results.length, 2, 'lista primita nu se modifica');
for (const extra of merged.slice(results.length)) {
  assert.ok(!('map_rank' in extra) && !('bucket_rank' in extra), 'punctele de context nu au numar');
}

// --- 2. Zona cautata -------------------------------------------------------------------------
const cluj = [
  row('1', 46.75, 23.55), row('2', 46.77, 23.6), row('3', 46.79, 23.64), row('4', 46.76, 23.57), row('5', 46.78, 23.62),
  row('x', 44.43, 26.1), // coordonate gresite (langa Bucuresti): nu lungeste zona
];
const area = searchAreaBounds(cluj);
assert.ok(area[0][0] >= 46.75 && area[1][0] <= 46.79, 'zona nu include punctul aberant');
assert.equal(searchAreaBounds([]), null);
assert.equal(searchAreaBounds(null), null);
assert.equal(searchAreaBounds([{ id: 'z' }]), null, 'fara pozitii valide nu exista zona');

// --- 3. „Am plecat din zona?” ---------------------------------------------------------------
const box = (latCenter, lngCenter, latSpan, lngSpan) => [
  [latCenter - latSpan / 2, lngCenter - lngSpan / 2],
  [latCenter + latSpan / 2, lngCenter + lngSpan / 2],
];
const areaBox = box(46.77, 23.6, 0.12, 0.15);
// Incadrarea de la deschidere (zona + putin spatiu), pe un ecran lat: nu se considera plecare.
assert.equal(viewportLeftSearchArea(box(46.77, 23.6, 0.16, 0.3), areaBox), false, 'incadrarea initiala');
assert.equal(viewportLeftSearchArea(box(46.77, 23.6, 0.12, 0.15), areaBox), false);
// Mutari mici nu conteaza.
assert.equal(viewportLeftSearchArea(box(46.79, 23.63, 0.16, 0.3), areaBox), false, 'o mutare mica');
// Alta zona: Turda, la ~30 km.
assert.equal(viewportLeftSearchArea(box(46.57, 23.78, 0.16, 0.3), areaBox), true, 'alt oras');
assert.equal(viewportLeftSearchArea(box(47.5, 23.6, 0.16, 0.3), areaBox), true, 'mult spre nord');
// Micsorata pana la regiune.
assert.equal(viewportLeftSearchArea(box(46.77, 23.6, 0.6, 1.2), areaBox), true, 'harta micsorata pe regiune');
assert.ok(AREA_ZOOM_OUT_RATIO >= 2, 'pragul de micsorare nu e atat de mic incat incadrarea initiala sa-l atinga');
// O zona inalta si ingusta, pe un ecran lat: incadrarea initiala nu e „plecare”.
const tall = box(46.77, 23.6, 0.3, 0.05);
assert.equal(viewportLeftSearchArea(box(46.77, 23.6, 0.34, 0.5), tall), false, 'zona inalta, ecran lat');
// O localitate cu o singura locatie (zona cat un punct): mutarea minima nu e plecare.
const single = box(45.0, 25.0, 0, 0);
assert.equal(viewportLeftSearchArea(box(45.0, 25.0, 0.06, 0.1), single), false);
assert.equal(viewportLeftSearchArea(box(45.01, 25.01, 0.06, 0.1), single), false, 'mutare de ~1 km');
assert.equal(viewportLeftSearchArea(box(45.3, 25.3, 0.06, 0.1), single), true, 'la ~35 km');
// Date lipsa sau invalide: niciodata „plecat”.
assert.equal(viewportLeftSearchArea(null, areaBox), false);
assert.equal(viewportLeftSearchArea(areaBox, null), false);
assert.equal(viewportLeftSearchArea([[NaN, 1], [2, 3]], areaBox), false);
assert.equal(viewportLeftSearchArea(undefined, undefined), false);

// --- 4. Sursa: cablarea ---------------------------------------------------------------------
const search = read('src/pages/Search.jsx');
const withMap = read('src/components/results/LocationsWithMap.jsx');
const directoryMap = read('src/pages/DirectoryMap.jsx');
const session = read('src/lib/searchSession.js');
const hook = read('src/hooks/useDirectoryContextPoints.js');
const pill = read('src/components/results/MapAreaSearchPill.jsx');

// 4a. Punctele de context: doar pe harta, nu in lista si nu in potrivire.
assert.match(search, /const contextPoints = useDirectoryContextPoints\(browsingMap\);/);
assert.match(search, /contextResults=\{contextPoints\}/);
assert.match(search, /const browsingMap = hasCanonicalLocality && searchMode === RESULT_MODES\.locations\.key && results !== null && !loadError;/,
  'contextul se cere dupa ce lista localitatii e pe ecran si doar in fila Locatii');
assert.match(search, /listResults=\{locationList\}/, 'lista ramane cea a cautarii');
assert.doesNotMatch(search.slice(search.indexOf('const locationList'), search.indexOf('const activeFilters')), /contextPoints/, 'contextul nu intra in lista');
assert.match(withMap, /const mapRows = useMemo\(\(\) => withDirectoryContext\(searchRows, contextResults\), \[searchRows, contextResults\]\);/);
assert.match(withMap, /const fitRows = mapRows === searchRows \? null : searchRows;/, 'camera se incadreaza doar pe rezultatele cautarii');
assert.match(withMap, /results=\{mapRows\}\s+fitResults=\{fitRows\}/);
assert.match(withMap, /const hasPositions = \(results \|\| \[\]\)\.some\(/, 'existenta hartii depinde de rezultatele cautarii, nu de context');
assert.match(withMap, /const rankSignature = numbered \? \(listResults \|\| \[\]\)/, 'numerele pinilor vin din lista, nu din context');
assert.match(hook, /loadNationalMapSnapshot\(\)/);
assert.match(hook, /loadNationalDirectoryMap\(\)/);
assert.match(hook, /\.catch\(\(\) => \{\}\)/, 'contextul e un plus: daca nu se incarca, harta ramane cu punctele localitatii');
assert.match(hook, /if \(!enabled\) return undefined;/);

// 4b. Camera: tine de localitate, nu de filtre.
assert.match(search, /const cameraKey = hasCanonicalLocality \? localityCameraKey\(locality\.siruta_code\) : null;/);
assert.match(search, /mapStorageKey=\{cameraKey\}\s+fitKey=\{cameraKey\}/);
assert.match(search, /key=\{searchMapKey\}[\s\S]*?storageKey=\{searchMapKey\}/, 'lista isi pastreaza cheia si resetarea de la schimbarea criteriilor');
assert.match(withMap, /mapStorageKey = storageKey,/);
assert.match(withMap, /storageKey=\{mapStorageKey\}/);
assert.match(session, /export function localityCameraKey\(sirutaCode\) \{\s+return `local:\$\{sirutaCode\}`;/);
assert.match(search, /const chooseLocality = \(value\) => \{\s+if \(value\?\.siruta_code\) forgetLocalityCamera\(value\.siruta_code\);/, 'alegerea unei localitati incadreaza harta pe ea');
assert.match(search, /if \(next\.locality\?\.siruta_code\) forgetLocalityCamera\(next\.locality\.siruta_code\);/);
assert.match(directoryMap, /fitKey="national"/, 'filtrul de tip nu mai muta harta Romaniei');
assert.doesNotMatch(directoryMap, /fitKey=\{`national:/);

// 4c. „Caută în această zonă”.
assert.match(search, /const canSearchArea = browsingMap && isDirectoryBrowse && filterServiceKeys\.length === 0 && !casOnly;/,
  'doar la rasfoire, fara serviciu si fara filtre de servicii / CAS');
assert.match(search, /mapOverlay=\{canSearchArea \? <MapAreaSearchPill visible=\{leftArea\} onSearch=\{searchThisArea\} \/> : null\}/);
assert.match(search, /onViewportChange=\{handleMapViewport\}/);
assert.match(search, /setLeftArea\(viewportLeftSearchArea\(view\?\.bounds, searchAreaRef\.current\)\);/);
assert.match(search, /const searchThisArea = useCallback\(\(\) => \{\s+if \(!handOverCameraToNationalMap\(mapView\.current\)\) return;\s+setLocality\(null\);/,
  'lista trece pe harta Romaniei, cu camera de acum');
assert.match(search, /useEffect\(\(\) => \{ setLeftArea\(false\); mapView\.current = null; \}, \[cameraKey\]\);/);
assert.match(session, /maps: \{ \.\.\.maps, national: \{ signature: "", bounds: view\.bounds, camera: view\.camera \} \}/);
assert.match(session, /national: \{\},\s+nationalScroll: 0,/, 'selectia si ordinea vechi ai hartii Romaniei se uita');
assert.match(pill, /Caută în această zonă/);
assert.match(pill, /const SHOW_DELAY_MS = 350;/);
assert.match(pill, /aria-hidden="true"/);
// Nimic din aceasta schimbare nu ataca potrivirea, rezultatele sau cererile.
for (const [name, source] of [['Search', search], ['LocationsWithMap', withMap], ['hook', hook], ['pill', pill]]) {
  assert.doesNotMatch(source, /matchProviders|invokeDirectoryBrowse\(/.test(source) && name !== 'Search' ? /$^/ : /$^/);
}
assert.doesNotMatch(hook, /matchProviders|browseDirectoryProviders|invoke\(/, 'hook-ul citeste doar harta nationala, prin incarcatorii existenti');

// 4d. Copierea pentru cititor.
assert.match(search, /Pinurile numerotate sunt rezultatele potrivite; celelalte locații din director apar pe hartă fără număr\./);
assert.match(search, /Mută harta ca să vezi și alte zone\./);

console.log('verify-map-area-search: ok');
