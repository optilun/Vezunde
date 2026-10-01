// Reparatiile B1, B4, C1, C2 si E1 din auditul /cauta (2026-09-28, claude/audit-cauta-2026-09-27.md).
//
// B1 schimbarea filei „Clinici și optici / Specialiști” nu mai reincarca locatiile si nu pierde paginile;
// B4 criteriile cautarii stau in adresa; un link primit castiga in fata sesiunii;
// C1 fara aria-label pe elemente fara rol; fara zeci de regiuni identice; diacritice;
// C2 dupa alegerea localitatii, focusul trece pe butonul de stergere (nu pe <body>);
// E1 un singur stil de card pe /cauta. (2026-09-30: si recomandarile /rezultate folosesc acelasi card;
//    vezi scripts/verify-recommendation-card-design.mjs.)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// 2026-09-29 (audit /cauta, D3): pagina /cauta citita impreuna cu hook-urile ei (scripts/searchPageSource.mjs).
import { readSearchPage } from './searchPageSource.mjs';
import { criteriaQuery, searchCriteriaFor, searchStateFromUrl, searchUrlFor, SEARCH_URL_KEYS } from '../src/lib/searchUrl.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const LABELS = { consult_oftalmologic: 'Consult oftalmologic' };
const labelFor = (key) => LABELS[key] || '';

// B4: functiile pure
{
  assert.equal(criteriaQuery('?preview_token=x&siruta=54975&oras=Cluj-Napoca'), 'oras=Cluj-Napoca&siruta=54975', 'ordine fixa, fara parametri straini');
  assert.equal(criteriaQuery(''), '');
  assert.equal(criteriaQuery('?utm_source=x'), '', 'parametrii straini nu sunt criterii');

  const state = {
    service: 'consult_oftalmologic', query: 'Consult oftalmologic',
    locality: { name: 'Cluj-Napoca', siruta_code: '54975', county_name: 'Cluj' },
    providerType: 'clinica,optica', filterServiceKeys: ['a', 'b'], casOnly: true,
    searchMode: 'professionals', professionalType: 'medic_oftalmolog',
  };
  const criteria = searchCriteriaFor(state);
  assert.ok(!criteria.includes('q='), 'textul nu intra in adresa');
  const back = searchStateFromUrl(`?${criteria}`, labelFor);
  assert.equal(back.service, state.service);
  assert.equal(back.query, 'Consult oftalmologic', 'eticheta revine din serviciu');
  assert.deepEqual({ name: back.locality.name, siruta: back.locality.siruta_code }, { name: 'Cluj-Napoca', siruta: '54975' });
  assert.equal(back.providerType, 'clinica,optica');
  assert.deepEqual(back.filterServiceKeys, ['a', 'b']);
  assert.equal(back.casOnly, true);
  assert.equal(back.searchMode, 'professionals');
  assert.equal(back.professionalType, 'medic_oftalmolog');
  assert.equal(searchCriteriaFor(back), criteria, 'dus-intors fara pierderi');

  // Textul liber poate descrie simptome: nu ajunge in adresa, in istoric sau in linkurile trimise.
  assert.equal(searchCriteriaFor({ query: 'vad in ceata' }), '');
  assert.equal(searchStateFromUrl('?q=oftalmolog', labelFor).query, 'oftalmolog', 'linkurile vechi cu text se citesc in continuare');
  assert.equal(searchStateFromUrl('?q=oftalmolog&serviciu=consult_oftalmologic', labelFor).query, 'oftalmolog');
  assert.equal(searchCriteriaFor({ searchMode: 'locations', professionalType: 'x' }), '', 'specialistul conteaza doar in fila Specialisti');
  assert.equal(searchStateFromUrl('?oras=Cluj-Napoca').locality, null, 'fara cod SIRUTA nu exista localitate');
  assert.equal(searchStateFromUrl('').searchMode, 'locations');

  assert.equal(searchUrlFor('?preview_token=x&q=vechi', 'q=nou'), '?preview_token=x&q=nou', 'parametrii straini raman');
  assert.equal(searchUrlFor('?q=vechi', ''), '');
  assert.deepEqual(SEARCH_URL_KEYS, ['serviciu', 'q', 'oras', 'siruta', 'tip', 'filtre', 'cas', 'mod', 'specialist']);
}

const search = readSearchPage();

// B4: pagina
{
  assert.match(search, /if \(!incoming \|\| previous\.sourceSearch === incoming\) return \{ saved: previous/, 'aceeasi adresa ca la plecare: sesiunea intreaga');
  assert.match(search, /return \{ saved: \{\}, fromUrl: \{ \.\.\.linked, locality: linked\.locality \|\| previous\.locality \|\| null \} \};/, 'linkul castiga; localitatea ramane daca linkul nu o are');
  assert.match(search, /\{ replace: true, state: routerLocation\.state \}/, 'fara intrari noi in istoric');
  assert.match(search, /writeSearchSession\(\{ sourceSearch: criteriaSearch,/);
  assert.match(search, /if \(settling\) return;/, 'adresa se scrie dupa pauza de tastare');
  assert.doesNotMatch(search, /urlParams/, 'criteriile nu se mai citesc direct din adresa la initializare');
  assert.match(search, /const criteriaSearch = searchCriteriaFor\(\{ service, locality, providerType, filterServiceKeys, casOnly, searchMode, professionalType \}\);/, 'fara textul liber');
  const scrollToTop = read('src/components/ScrollToTop.jsx');
  assert.match(scrollToTop, /\}, \[pathname, hash, navigationType\]\);/, 'schimbarea parametrilor nu deruleaza pagina');
  assert.doesNotMatch(scrollToTop, /\bsearch\b/);
  assert.match(scrollToTop, /if \(samePage\) return undefined;/, 'actualizarea adresei cu replace nu muta pagina sau focusul');
}

// B1
{
  const run = search.slice(search.indexOf('const run = async () => {'), search.indexOf('try {', search.indexOf('const run = async () => {')));
  assert.match(run, /if \(hasCanonicalLocality && isDirectoryBrowse && !locationMode\) \{ setLoadError\(false\); return; \}/, 'la rasfoire, fila Specialisti nu cere locatii');
  assert.match(run, /if \(requestKey && requestKey === loadedKey\.current\) return;/, 'aceeasi cerere: nimic de reincarcat');
  assert.ok(run.indexOf('requestKey === loadedKey.current') < run.indexOf('setResults(null);'), 'lista nu se goleste inainte');
  assert.equal((search.match(/loadedKey\.current = requestKey;/g) || []).length, 2, 'cheia se retine doar dupa succes');
  const reset = search.slice(search.indexOf('const previousCriteria = useRef(null);'), search.indexOf('}, [typing, service, debouncedQuery'));
  assert.match(reset, /loadedKey\.current = null;/, 'criterii noi: se cere din nou');
  assert.match(search, /const waiting = searchMode === RESULT_MODES\.professionals\.key \? professionals === null : results === null;/);
  // Potrivirea primeste aceleasi date ca inainte.
  assert.match(search, /provider_types: locationMode \? providerType\.split\(","\)\.filter\(Boolean\) : \[\],\s*locality_siruta_code: locality\.siruta_code,/);
}

// C1
{
  const panel = read('src/components/results/DecisionConfidencePanel.jsx');
  assert.doesNotMatch(panel, /<section/, 'fara regiuni repetate in fiecare card');
  assert.doesNotMatch(panel, /Increderea in potrivire/);
  assert.equal((panel.match(/role="group" aria-label="Încrederea în potrivire"/g) || []).length, 2);
  assert.equal((panel.match(/role="img" aria-label=\{`\$\{filled\} din 3 niveluri de dovezi confirmate`\}/g) || []).length, 2, 'eticheta are rol');
  assert.match(read('src/components/results/VectorResultsCanvas.jsx'), /role="region" aria-label="Harta detaliată a locațiilor"/);
}

// C2
{
  const field = read('src/components/geo/LocalityAutocomplete.jsx');
  assert.match(field, /focusChosen\.current = true;\s*onSelect\(chosen\);/);
  assert.match(field, /if \(!value \|\| !focusChosen\.current\) return;\s*focusChosen\.current = false;\s*clearRef\.current\?\.focus\(\);/);
  assert.match(field, /ref=\{clearRef\}/);
  assert.match(field, /aria-label=\{`Șterge localitatea \$\{shown\.name/);
}

// E1
{
  assert.doesNotMatch(search, /ProviderCard/, '/cauta nu mai foloseste cardul vechi');
  assert.match(search, /listLayout="grid"/);
  assert.match(search, /<DirectoryResultCard compactMobile location=\{location\} onShowMap=\{onShowMap\} rank=\{rank\} details=\{<ServiceMatchDetails location=\{location\} \/>\} \/>/);
  const details = read('src/components/results/ServiceMatchDetails.jsx');
  assert.match(details, /buildProviderDecisionConfidence\(/, 'acelasi panou de incredere, din aceleasi date');
  assert.match(details, /<DecisionConfidencePanel confidence=\{confidenceForLocation\(location\)\}/);
  assert.doesNotMatch(details, /sort\(|recommendation_score|subscription|plan/, 'nimic nu se reordoneaza sau cumpara');
  const card = read('src/components/results/DirectoryResultCard.jsx');
  assert.match(card, /rank = null, details = null/);
  assert.match(card, /<span className="sr-only">Pinul <\/span>\{rank\}/);
  const layout = read('src/components/results/LocationsWithMap.jsx');
  // 2026-09-28 (B7): randurile sunt in ResultRow (memoizat); aceleasi reguli, alte nume.
  assert.match(layout, /\{!gridLayout && shownRank !== null && \(/, 'in grila numarul sta pe coperta, nu deasupra');
  assert.match(layout, /const shownRank = hasPoint \? rank : null;/, 'numar doar pentru locatiile cu pin');
  assert.match(layout, /renderCard\(location, showThis, shownRank\)/);
  assert.match(read('src/components/intake2/MatchResultCard.jsx'), /<DirectoryResultCard/, 'recomandarile folosesc acelasi card ca /cauta');
}

console.log('Search audit fixes B1, B4, C1, C2, E1 checks passed.');
