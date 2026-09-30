// Bara compacta a recomandarilor: pastila „Zona” + meniul „Filtre” (2026-09-30).
//
// Pe /rezultate, „Extinde zona” aparea in trei locuri (notita de rutare, un rand de linkuri si
// starea „prea putine rezultate”), iar filtrele lipseau. Acum exista o bara lipicioasa cu filele,
// pastila „Zona” (extindere in judet / tara) si meniul „Filtre” (tip locatie, doar verificate).
// Filtrele sunt PUR VIZUALE: nu cheama serverul, nu schimba bucketul, rangul sau Top 3 si nu
// schimba cine primeste cererea. Ascund carduri din lista si pini recomandati de pe harta (un
// rezultat ascuns ramane doar punct din directorul national); camera hartii ramane pe rezultatele
// intregi ale cererii. Nu exista filtru pentru CAS / „deschis acum”, pentru ca
// rezultatele recomandarii nu poarta aceste date.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const {
  NO_FILTERS,
  TRUSTED_PROFILE_STATUSES,
  TYPE_ORDER,
  applyRecommendationFilters,
  countActiveFilters,
  isTrustedProfile,
  normalizeFilters,
  trustedCountFor,
  typeCountsFor,
} = await import(new URL('../src/lib/recommendationFilters.js', import.meta.url));

// 1. Logica filtrelor: subset, aceeasi ordine, fara efecte asupra listei primite.
const list = [
  { id: 'a', provider_type: 'optica_medicala', profile_control_status: 'verified', result_bucket: 'top3', bucket_rank: 1 },
  { id: 'b', provider_type: 'cabinet_oftalmologic', profile_control_status: 'directory', result_bucket: 'top3', bucket_rank: 2 },
  { id: 'c', provider_type: 'optica_medicala', profile_control_status: 'claimed', result_bucket: 'top3', bucket_rank: 3 },
  { id: 'd', provider_type: 'clinica_oftalmologica', profile_control_status: 'directory', result_bucket: 'extended_directory' },
  { id: 'e', provider_type: 'optica_medicala', profile_control_status: 'suspended', result_bucket: 'extended_confirmed' },
];
const snapshot = JSON.stringify(list);

assert.equal(applyRecommendationFilters(list, NO_FILTERS), list, 'fara filtre se intoarce chiar lista primita');
assert.equal(applyRecommendationFilters(list, normalizeFilters(null)), list);
assert.equal(applyRecommendationFilters(null, { types: ['optica_medicala'], trustedOnly: false }), null, 'lista invalida trece neschimbata');

assert.deepEqual(
  applyRecommendationFilters(list, { types: ['optica_medicala'], trustedOnly: false }).map((row) => row.id),
  ['a', 'c', 'e'],
  'filtrul de tip pastreaza ordinea primita',
);
assert.deepEqual(
  applyRecommendationFilters(list, { types: ['optica_medicala', 'clinica_oftalmologica'], trustedOnly: false }).map((row) => row.id),
  ['a', 'c', 'd', 'e'],
  'mai multe tipuri = reuniune',
);
assert.deepEqual(
  applyRecommendationFilters(list, { types: [], trustedOnly: true }).map((row) => row.id),
  ['a', 'c'],
  'doar verificate sau revendicate; suspendat / director nu intra',
);
assert.deepEqual(
  applyRecommendationFilters(list, { types: ['optica_medicala'], trustedOnly: true }).map((row) => row.id),
  ['a', 'c'],
  'tip + profil = intersectie',
);
assert.deepEqual(applyRecommendationFilters(list, { types: ['laborator_optic'], trustedOnly: false }), [], 'niciun rezultat: lista goala, nu eroare');
assert.equal(JSON.stringify(list), snapshot, 'lista primita nu este modificata');

// Bucketul si rangul raman cele de la server, pe fiecare rezultat pastrat.
for (const row of applyRecommendationFilters(list, { types: ['optica_medicala'], trustedOnly: true })) {
  assert.equal(row, list.find((source) => source.id === row.id), 'aceleasi obiecte, fara copii recalculate');
}

assert.deepEqual(TRUSTED_PROFILE_STATUSES, ['verified', 'claimed']);
assert.equal(isTrustedProfile({ profile_control_status: 'verified' }), true);
assert.equal(isTrustedProfile({ profile_control_status: 'claimed' }), true);
assert.equal(isTrustedProfile({ profile_control_status: 'directory' }), false);
assert.equal(isTrustedProfile(null), false);
assert.equal(trustedCountFor(list), 2);
assert.equal(trustedCountFor(undefined), 0);

// 2. Normalizare si numarare.
assert.deepEqual(normalizeFilters(undefined), { types: [], trustedOnly: false });
assert.deepEqual(normalizeFilters({ types: ['x', 'x', '', 7, 'y'], trustedOnly: 'da' }), { types: ['x', 'y'], trustedOnly: false }, 'doar valori valide; trustedOnly strict boolean');
assert.equal(countActiveFilters({ types: ['x', 'y'], trustedOnly: true }), 3);
assert.equal(countActiveFilters(NO_FILTERS), 0);
assert.equal(countActiveFilters(undefined), 0);

// 3. Optiunile de tip: doar ce exista in lista, cu numar, in ordinea din /cauta; un tip ales
// care a disparut (dupa o extindere) ramane cu 0 ca sa poata fi debifat.
assert.deepEqual(typeCountsFor(list, NO_FILTERS), [
  { key: 'optica_medicala', count: 3 },
  { key: 'clinica_oftalmologica', count: 1 },
  { key: 'cabinet_oftalmologic', count: 1 },
].sort((a, b) => TYPE_ORDER.indexOf(a.key) - TYPE_ORDER.indexOf(b.key)));
assert.deepEqual(
  typeCountsFor(list, { types: ['laborator_optic'], trustedOnly: false }).find((row) => row.key === 'laborator_optic'),
  { key: 'laborator_optic', count: 0 },
);
assert.deepEqual(typeCountsFor(null, NO_FILTERS), []);

// 4. Sursele: filtrele nu ating cererea, Top 3 sau ordinea.
const results = read('src/components/intake2/MatchResults.jsx');
assert.match(results, /const shownList = visibleSet \?/, 'filtrul de harta ramane separat');
assert.match(results, /const filteredList = applyRecommendationFilters\(shownList, filters\);/, 'filtrele lucreaza peste lista deja primita');
assert.match(results, /const serverTop3Count = list\.filter\(\(result\) => result\.result_bucket === "top3"\)\.length;/, 'starea recomandarii vine de la server, nu din lista filtrata');
assert.match(results, /visibleResultsChanged\.current\?\.\(list\);/, 'pagina primeste mereu lista completa a cererii');

// Pinii de pe harta urmeaza filtrele, dar doar pinii: lista filtrata pentru harta este un canal
// separat, iar cererea, antetul si camera hartii raman pe lista completa.
assert.match(results, /const filteredForMap = useMemo\(/);
assert.match(results, /resultMode === RESULT_MODES\.locations\.key && countActiveFilters\(filters\) > 0\s*\?\s*applyRecommendationFilters\(list, filters\)\s*:\s*null/, 'null cand nu sunt filtre active sau in modul Specialisti');
assert.match(results, /filteredForMapChanged\.current\?\.\(filteredForMap\);/);
assert.doesNotMatch(results, /onFilteredResultsChange\?\.\(filteredList\)/, 'nu se trimite lista filtrata de harta (viewport)');
const pageForMap = read('src/pages/RequestMatches.jsx');
assert.match(pageForMap, /onFilteredResultsChange=\{setMapFilteredResults\}/);
assert.match(pageForMap, /focusResults: full\.focusResults,/, 'camera hartii nu sare la fiecare filtru');
assert.match(pageForMap, /mapResults: recommendationMapContext\(mapFilteredResults, nationalDirectory, activeMeta\)\.mapResults,/);
assert.match(pageForMap, /<PatientRequestSubmission defaultOpen results=\{visibleResults\}/, 'cererea se trimite pe lista completa, nu pe cea a hartii');
assert.doesNotMatch(pageForMap, /PatientRequestSubmission[^>]*results=\{(mapFilteredResults|mapResults)\}/);
assert.match(results, /aria-busy=\{isExpandingCounty \|\| isExpandingNational\}/, 'lista este marcata ocupata cat dureaza o extindere');
assert.match(results, /<PatientRequestSubmission results=\{list\}/, 'cererea se trimite pe lista completa');
assert.doesNotMatch(results, /PatientRequestSubmission results=\{filteredList\}/);
assert.match(results, /result\.result_bucket === "top3"/, 'Top 3 ramane strict dupa result_bucket');
// Extinderea in judet / tara cheama serverul in MatchResults (asa a fost si inainte); schimbarea
// unui filtru nu: functia lui doar actualizeaza starea locala si anunta pagina.
const changeFiltersBlock = results.slice(results.indexOf('const changeFilters = '), results.indexOf('const clearFilters = '));
assert.ok(changeFiltersBlock.length > 0, 'changeFilters exista');
assert.doesNotMatch(changeFiltersBlock, /matchProviders|invokeFunction|fetch\(|await /, 'schimbarea unui filtru nu cheama serverul');
assert.match(changeFiltersBlock, /onFiltersChange\?\.\(normalized\)/);
const lib = read('src/lib/recommendationFilters.js');
assert.doesNotMatch(lib, /\.sort\(\)|bucket_rank|result_bucket|Math\.random|fetch\(|import /, 'biblioteca de filtre nu reordoneaza, nu atinge bucketul si nu importa nimic');
assert.doesNotMatch(lib, /cas_|open_now|is_open/, 'fara filtre pe date pe care rezultatele nu le au');

// 5. Bara: toate trei locurile vechi de „Extinde zona” trec prin aceeasi pastila.
assert.match(results, /import RecommendationToolbar from "\.\/RecommendationToolbar";/);
assert.match(results, /onExpandCounty: expansionProps\.onExpandCounty,/, 'pastila Zona foloseste aceleasi extinderi');
assert.match(results, /onExpandNational: expansionProps\.onExpandNational,/);
assert.match(results, /onOpenZone=\{\(\) => setZoneOpen\(true\)\}/, 'starea „prea putine rezultate” deschide pastila');
assert.doesNotMatch(results, /RoutingNotice|Vezi toate opțiunile din zonă/, 'notita de rutare si randul de linkuri au fost inlocuite');
assert.match(results, /Cum sunt alese recomandările\?/, 'explicatia despre ordine ramane, intr-un indiciu');
assert.match(results, /Plata nu influențează ordinea/, 'ordinea nu depinde de plata');

const toolbar = read('src/components/intake2/RecommendationToolbar.jsx');
assert.match(toolbar, /sm:sticky sm:top-0 sm:z-20/, 'bara ramane la vedere cand lista se deruleaza, de la latimea sm');
assert.doesNotMatch(toolbar, /(?<![:\w-])sticky top-0/, 'pe telefon nu se lipeste (243 px din 844 cu doua filtre active)');
assert.match(toolbar, /RecommendationZoneMenu/);
assert.match(toolbar, /RecommendationFilterMenu/);
assert.match(toolbar, /Șterge filtrele/);

const zone = read('src/components/intake2/RecommendationZoneMenu.jsx');
assert.match(zone, /Aria căutării/);
assert.match(zone, /Extinde →|Extinde/);
assert.match(zone, /Include și celelalte localități din județ/);
assert.match(zone, /Doar profiluri revendicate sau verificate/, 'la nivel national apar doar profiluri controlate');
assert.match(zone, /role="alert"/, 'eroarea de extindere este anuntata');
assert.match(zone, /aria-current/);

const filterMenu = read('src/components/intake2/RecommendationFilterMenu.jsx');
assert.doesNotMatch(filterMenu + toolbar, /matchProviders|invokeFunction|fetch\(/, 'meniul de filtre si bara nu cheama serverul');
assert.match(filterMenu, /Tipul locației/);
assert.match(filterMenu, /Doar verificate sau revendicate/);
assert.match(filterMenu, /Filtrele ascund opțiuni din listă și de pe hartă\. Ordinea calculată de VIASEE și cererea trimisă rămân neschimbate\./, 'textul spune limpede ce fac filtrele');
assert.doesNotMatch(filterMenu, /CAS|Deschis acum/);

// 6. Pagina pastreaza filtrele la intoarcerea dintr-un profil; nu apeleaza serverul.
const page = read('src/pages/RequestMatches.jsx');
assert.match(page, /const \[listFilters, setListFilters\] = useState\(savedView\.filters \|\| null\);/);
assert.match(page, /filters: listFilters,/);
assert.match(page, /initialFilters=\{savedView\.filters\}/);
assert.match(page, /onFiltersChange=\{setListFilters\}/);
assert.doesNotMatch(page, /matchProviders|fetch\(/);

// 7. Starea „prea putine rezultate” foloseste un singur buton cand bara e deasupra.
const noResults = read('src/components/intake2/NoResultsFlow.jsx');
assert.match(noResults, /onOpenZone,/);
assert.match(noResults, /compactRecovery && onOpenZone \?/);
assert.match(noResults, /Extinde zona căutării/);
assert.match(noResults, /Extinde în județul/, 'fluxul complet fara bara ramane neschimbat');

console.log('verify-recommendation-toolbar: ok');
