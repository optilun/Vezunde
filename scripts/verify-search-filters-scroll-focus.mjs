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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// B3
{
  const filters = read('src/components/results/SearchFilters.jsx');
  assert.match(filters, /\+ \(hasLocality \? serviceKeys\.length \+ Number\(casOnly\) : 0\)/, 'fara localitate, serviciile si CAS nu se numara ca active');
  assert.match(filters, /serviceKeys:draft\.services\|\|\[\],casOnly:Boolean\(draft\.cas\)/, 'aplicarea pe harta Romaniei nu sterge in tacere filtrele alese');
  assert.doesNotMatch(filters, /serviceKeys:hasLocality\?draft\.services:\[\]/);
  const search = read('src/pages/Search.jsx');
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
  const search = read('src/pages/Search.jsx');
  const block = search.slice(search.indexOf('audit /cauta, B5'), search.indexOf('B1: in fila Specialisti'));
  assert.match(block, /timer = setTimeout\(save, 200\);/, 'salvare dupa oprire');
  assert.match(block, /window\.addEventListener\("pagehide", save\);/, 'si la plecare');
  assert.doesNotMatch(block, /writeSearchSession\(\{ scrollY: window\.scrollY \}\)/, 'nu la fiecare eveniment');
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
  assert.equal((layout.match(/requestMapCardFocus\(\); onSelect\(location\.id\);/g) || []).length, 2, 'butoanele „Arată pe hartă”');
  assert.match(layout, /data-map-toggle/);
  assert.match(read('src/components/results/VectorResultsCanvas.jsx'), /openCluster\(null\);requestMapCardFocus\(\);select\?\.\(cluster\.lead\.id\);/, 'pinul apasat');
  assert.match(read('src/components/results/ResultsMap.jsx'), /setOpenClusterKey\(null\); requestMapCardFocus\(\);/, 'locatia aleasa din grup');
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

console.log('Search audit fixes B3, B5, C2, C3, C4 checks passed.');
