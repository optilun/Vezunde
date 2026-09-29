// Reparatiile A1-A5 din auditul /cauta (2026-09-27, claude/audit-cauta-2026-09-27.md).
//
// A1 pe telefon/tableta rezultatele nu mai sunt impinse sub ecran (distanta de antet doar la lg);
// A2 controalele de cautare sunt fixate sus doar pe desktop; pe telefon apare o bara compacta;
// A3 harta nu mai trece pe 2D cand fila sta in fundal; fara exceptie la demontare;
// A4 tastarea nu mai goleste lista si harta la fiecare litera;
// A5 cererile catre director au limita de timp si ajung pe calea de eroare cu „Reîncearcă”.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// 2026-09-29 (audit /cauta, D3): pagina /cauta citita impreuna cu hook-urile ei (scripts/searchPageSource.mjs).
import { readSearchPage } from './searchPageSource.mjs';
import { layoutMapMarkers } from '../shared/mapMarkerPresentation.js';
import { withPatientOperationTimeout, isPatientOperationTimeout } from '../src/lib/patientOperationControl.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// A1
{
  const layout = read('src/components/results/LocationsWithMap.jsx');
  assert.doesNotMatch(layout, /style=\{fixedDesktop \? \{ top:/, 'fara `top` inline pe zona lista + harta');
  assert.doesNotMatch(layout, /\{ top: "calc\(var\(--search-nav-height/, 'fara `top` inline pe harta laterala');
  assert.equal((layout.match(/lg:top-\[var\(--workspace-top\)\]/g) || []).length, 2, 'distanta se aplica doar la lg (cu si fara pozitii)');
  assert.match(layout, /"--workspace-top": "calc\(var\(--search-nav-height, 80px\) \+ var\(--search-controls-height, 0px\) \+ 12px\)"/);
  assert.match(layout, /lg:sticky lg:top-\[var\(--aside-top\)\]/);
}

// A2
{
  const search = readSearchPage();
  const controls = search.match(/<div ref=\{controlsRef\} data-search-controls className="([^"]+)"/)?.[1] || '';
  assert.ok(controls.split(' ').includes('lg:sticky'), 'controalele sunt fixate doar pe desktop');
  assert.ok(!controls.split(' ').includes('sticky'), 'nu sunt fixate pe telefon');
  assert.ok(controls.split(' ').includes('lg:top-[var(--search-nav-height)]'));
  assert.doesNotMatch(search, /data-search-controls[^>]*style=\{\{ top:/, 'fara `top` inline (ar muta controalele pe telefon)');
  assert.match(search, /\{controlsOut && <CompactSearchBar query=\{query\.trim\(\)\} locality=\{locality\} \/>\}/);
  assert.match(search, /function CompactSearchBar\(\{ query, locality \}\)/);
  assert.match(search, /data-compact-search className="fixed inset-x-0 z-30[^"]*lg:hidden"/, 'bara compacta doar sub lg');
  assert.match(search, /new IntersectionObserver\(/);
}

// A3
{
  const canvas = read('src/components/results/VectorResultsCanvas.jsx');
  assert.match(canvas, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(canvas, /document\.removeEventListener\("visibilitychange", onVisibility\)/);
  assert.match(canvas, /if \(document\.visibilityState === "hidden"\) clearTimeout\(timer\);/, 'fila ascunsa: timpul nu curge');
  assert.match(canvas, /if \(document\.visibilityState !== "hidden"\) startTimer\(\);/);
  assert.doesNotMatch(canvas, /requestAnimationFrame\(\(\) => layoutMapMarkers\(container\.current\)\)/, 'fiecare cadru verifica containerul');
  assert.doesNotThrow(() => layoutMapMarkers(null), 'layoutMapMarkers(null) nu arunca');
}

// A4
{
  const search = readSearchPage();
  assert.match(search, /const typing = hasCanonicalLocality && debouncedQuery !== query\.trim\(\);/);
  const reset = search.slice(search.indexOf('const previousCriteria = useRef(null);'), search.indexOf('}, [typing, service, debouncedQuery, locality?.siruta_code, providerType, filterServiceKeys, casOnly]);'));
  assert.ok(reset.length > 50, 'resetarea urmeaza textul asezat');
  assert.match(reset, /if \(typing\) return;/, 'nimic nu se reseteaza cat timp se tasteaza');
  assert.match(reset, /if \(previousCriteria\.current === criteria\) return;/, 'aceleasi criterii: fara resetare');
  assert.doesNotMatch(search, /\}, \[service, query, locality\?\.siruta_code/);
  assert.match(search, /useEffect\(\(\) => \{ if \(!typing\) setSettledMapKey\(liveMapKey\); \}, \[typing, liveMapKey\]\);\s*const searchMapKey = settledMapKey;/, 'lista si harta nu se remonteaza la prima litera');
  const run = search.slice(search.indexOf('const run = async () => {'), search.indexOf('try {', search.indexOf('const run = async () => {')));
  assert.ok(run.indexOf('if (hasCanonicalLocality && debouncedQuery !== query.trim()) return;') >= 0, 'asteapta pauza');
  assert.ok(run.indexOf('if (hasCanonicalLocality && debouncedQuery !== query.trim()) return;') < run.indexOf('setResults(null);'), 'nu goleste lista inainte de pauza');
  assert.match(search, /const isDirectoryBrowseView = isDirectoryBrowse;/);
  assert.match(search, /!service && !debouncedQuery\s*\? <DirectoryMap/, 'harta Romaniei nu dispare la prima litera');
}

// A5
{
  for (const file of ['src/hooks/useSearchResults.js', 'src/components/results/SearchFilters.jsx']) {
    assert.doesNotMatch(read(file), /functions\.invoke\(\s*"browseDirectoryProviders"/, `${file}: toate cererile de director au limita de timp`);
    assert.match(read(file), /invokeDirectoryBrowse\(/);
  }
  assert.equal((readSearchPage().match(/invokeDirectoryBrowse\(/g) || []).length, 4, 'lista, restaurare, filtre, paginare');
  const helper = read('src/lib/directoryBrowse.js');
  assert.match(helper, /DIRECTORY_BROWSE_TIMEOUT_MS = 20_000/);
  assert.match(helper, /withPatientOperationTimeout\(/);
  assert.match(read('src/lib/nationalDirectoryMap.js'), /withPatientOperationTimeout\(\s*\(\) => base44\.functions\.invoke\("browseDirectoryProviders", payload\)/);
  let caught = null;
  await withPatientOperationTimeout(() => new Promise(() => {}), { timeoutMs: 20, operation: 'test' }).catch((error) => { caught = error; });
  assert.ok(isPatientOperationTimeout(caught), 'o cerere blocata se opreste cu eroare de timp');
}

console.log('Search audit fixes A1-A5 checks passed.');
