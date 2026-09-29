// Reparatiile B3, B5, restul C2, C3 si C4 din auditul /cauta (2026-09-28, claude/audit-cauta-2026-09-27.md).
//
// B3 pe harta Romaniei, serviciile si CAS nu mai apar ca filtre active: sunt „in asteptare” pana
//    la alegerea localitatii (nu se pierd, nu se numara);
// B5 pozitia paginii se salveaza dupa oprirea derularii, nu la fiecare eveniment;
// C2 fereastra locatiei ceruta explicit primeste focusul; la inchidere focusul revine de unde a pornit;
// C3 zone de apasare de 44 px pentru butoanele mici de pe harta si din filtre;
// C4 numarul din zona vizibila se anunta o data, dupa oprirea hartii; fara <aside> in <main>;
//    pictograme decorative ascunse; grupuri etichetate cu rol.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// 2026-09-29 (audit /cauta, D3): pagina /cauta citita impreuna cu hook-urile ei (scripts/searchPageSource.mjs).
import { readSearchPage } from './searchPageSource.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// B3
{
  const filters = read('src/components/results/SearchFilters.jsx');
  assert.match(filters, /\+ \(hasLocality \? serviceKeys\.length \+ Number\(casOnly\) : 0\)/, 'fara localitate, serviciile si CAS nu se numara ca active');
  assert.match(filters, /serviceKeys:draft\.services\|\|\[\],casOnly:Boolean\(draft\.cas\)/, 'aplicarea pe harta Romaniei nu sterge in tacere filtrele alese');
  assert.doesNotMatch(filters, /serviceKeys:hasLocality\?draft\.services:\[\]/);
  const search = readSearchPage();
  assert.match(search, /pending: !hasCanonicalLocality, label: CANONICAL_SERVICE_REGISTRY/);
  assert.match(search, /pending: !hasCanonicalLocality, label: "Decontare CAS"/);
  assert.match(search, /Se aplică după ce alegi localitatea:/);
  assert.match(search, /role="group" aria-label="Filtre active"/);
  // Dintr-un link se pastreaza doar valorile cunoscute (fara chei tehnice afisate drept filtre).
  assert.match(search, /filterServiceKeys: state\.filterServiceKeys\.filter\(\(key\) => CANONICAL_SERVICE_REGISTRY\[key\]\)/);
  assert.match(search, /providerType: state\.providerType\.split\(","\)\.filter\(\(key\) => DIRECTORY_PROVIDER_FILTER_LABELS\[key\]\)/);
  assert.equal((search.match(/knownLinkedState\(searchStateFromUrl\(/g) || []).length, 2, 'la deschidere si pentru un link deschis peste pagina');
  // Harta Romaniei primeste in continuare doar tipul.
  assert.match(search, /<DirectoryMap providerType=\{providerType\} filterSummary=\{filterSummary\} \/>/);
}

// B5
{
  // 2026-09-29 (audit /cauta, D3): salvarea derularii este un hook comun cu harta Romaniei.
  const hook = read('src/hooks/useRememberScroll.js');
  assert.match(hook, /timer = setTimeout\(flush, delay\);/, 'salvare dupa oprire');
  assert.match(hook, /window\.addEventListener\("pagehide", flush\);/, 'si la plecare');
  assert.match(hook, /export default function useRememberScroll\(save, delay = 200\)/);
  const search = read('src/pages/Search.jsx');
  assert.match(search, /useRememberScroll\(\(y\) => \{ if \(restoredScroll\.current\) writeSearchSession\(\{ scrollY: y \}\); \}\);/);
  assert.doesNotMatch(readSearchPage(), /writeSearchSession\(\{ scrollY: window\.scrollY \}\)/, 'nu la fiecare eveniment');
  assert.doesNotMatch(search, /addEventListener\("scroll"/, 'un singur loc pentru ascultarea derularii');
}

// C2
{
  const focus = read('src/lib/mapCardFocus.js');
  assert.match(focus, /export function requestMapCardFocus\(\)/);
  assert.match(focus, /document\.querySelector\("\[data-map-toggle\]"\)/, 'daca butonul de pornire nu se mai vede, focusul merge pe comutatorul lista\/harta');
  const card = read('src/components/results/MapLocationCard.jsx');
  assert.equal((card.match(/<section ref=\{cardRef\} tabIndex=\{-1\}/g) || []).length, 2, 'ambele variante ale ferestrei pot primi focus');
  assert.match(card, /if \(!wantsMapCardFocus\(\)\) return undefined;/, 'o selectie restaurata din sesiune nu muta focusul');
  assert.match(card, /card\.focus\(\{ preventScroll: true \}\);/);
  assert.match(card, /const close = \(\) => \{ onClose\(\); restoreMapCardOpener\(\); \};/);
  const layout = read('src/components/results/LocationsWithMap.jsx');
  // 2026-09-28 (B7): ambele butoane „Arată pe hartă” din rand trec prin showOnMap (un singur loc).
  assert.match(layout, /requestMapCardFocus\(\);\s*select\(id\);/, 'butoanele „Arată pe hartă”');
  assert.match(layout, /const showThis = useMemo\(\(\) => \(hasPoint \? \(\) => onShowMap\(location\.id\) : undefined\)/);
  assert.match(layout, /onClick=\{showThis\}/);
  assert.match(layout, /data-map-toggle/);
  assert.match(read('src/components/results/VectorResultsCanvas.jsx'), /openCluster\(null\);requestMapCardFocus\(\);select\?\.\(cluster\.lead\.id\);/, 'pinul apasat');
  // 2026-09-29 (audit /cauta, D1): lista grupului este acum un singur component, folosit de ambele harti.
  assert.match(read('src/components/results/MapClusterList.jsx'), /onClose\(\);\s*requestMapCardFocus\(\);\s*if \(onSelect\) onSelect\(id\);/, 'locatia aleasa din grup');
  assert.match(read('src/components/results/LegacyResultsMap.jsx'), /requestMapCardFocus\(\);\s*if \(onSelect\) onSelect\(cluster\.lead\.id\);/, 'harta 2D');
}

// C3
{
  const hitArea = /before:absolute before:-inset-1/;
  assert.match(read('src/components/results/MapLocationCard.jsx'), hitArea, 'X-ul ferestrei plutitoare');
  assert.match(read('src/components/results/ResultsMap.jsx'), hitArea, '„Arat-o”');
  assert.match(read('src/components/results/VectorResultsCanvas.jsx'), /viasee-map-control relative h-9 w-9[^"]*before:absolute before:-inset-1/, 'butonul 3D');
  assert.match(read('src/components/results/SearchFilters.jsx'), /aria-label=\{`Scoate \$\{getServiceLabel\(key\)\}`\} className="relative[^"]*before:absolute before:-inset-1/, 'serviciile bifate din filtre');
  assert.match(read('src/pages/DirectoryMap.jsx'), /<summary className="flex min-h-11/, '„Despre rezultate”');
}

// C4
{
  const map = read('src/pages/DirectoryMap.jsx');
  assert.doesNotMatch(map, /<span aria-live="polite">\{inView\.length\}/, 'nu se anunta la fiecare mutare');
  assert.match(map, /setTimeout\(\(\) => setAnnouncedCount\(inView\.length\), 1200\)/);
  assert.match(map, /<p aria-live="polite" className="sr-only">/);
  const layout = read('src/components/results/LocationsWithMap.jsx');
  assert.doesNotMatch(layout, /<aside/, 'harta nu mai e reper complementar in <main>');
  assert.match(read('src/components/intake2/ResultModeTabs.jsx'), /<Icon aria-hidden="true"/);
  assert.match(read('src/components/results/SearchFilters.jsx'), /<SlidersHorizontal className="h-4 w-4" aria-hidden="true" \/>/);
  assert.match(read('src/components/results/SearchFilters.jsx'), /<div role="group" className="mt-3 flex flex-wrap gap-2" aria-label="Servicii bifate">/);
}

// Serverul de dezvoltare nu serveste base44/ (fs.deny in @base44/vite-plugin): codul din src/ importa
// din shared/. Copia de frontend a numelor de judete trebuie sa dea exact acelasi rezultat.
{
  for (const file of ['src/lib/localityQuickPicks.js']) {
    assert.doesNotMatch(read(file), /^\s*(import|export)[^;\n]*base44\/shared/m, `${file} nu importa din base44/ (previzualizarea nu s-ar mai incarca)`);
  }
  const front = await import('../shared/romanianCountyNames.js');
  const back = await import('../base44/shared/romanianCountyNames.js');
  for (const name of ['Arges', 'Bacau', 'Bistrita-Nasaud', 'Iași', 'Cluj', 'Valcea', '', null, 'Caras-Severin']) {
    assert.equal(front.prettyCountyName(name), back.prettyCountyName(name), `aceleasi nume de judet: ${name}`);
  }
}

console.log('Search audit fixes B3, B5, C2, C3, C4 checks passed.');
