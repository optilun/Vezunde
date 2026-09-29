// Detaliile de design din auditul /cauta (E2, E3; 2026-09-29).
//
// E2 alegerea explicita lista/harta pe telefon se tine minte si e comuna pentru harta Romaniei si
//    pentru o localitate; fara alegere, harta Romaniei porneste pe harta, localitatea pe lista;
// E3 o singura atribuire a hartii, „poziție publicată” (nu „exactă”), diacritice pentru orice
//    localitate din numele oficial, termeni unificati, panoul de incredere compact fara 3 randuri.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nameFromOfficial, prettyLocality } from '../src/lib/localityQuickPicks.js';
import { unmappedNotice } from '../shared/resultsMapPoints.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// E2
{
  const session = read('src/lib/searchSession.js');
  assert.match(session, /export function readMobileViewChoice\(fallback\) \{\s*const choice = readSearchSession\(\)\.mobileViewChoice;\s*return choice === "map" \|\| choice === "list" \? choice : fallback;\s*\}/);
  assert.match(session, /export function rememberMobileViewChoice\(view\) \{\s*if \(view === "map" \|\| view === "list"\) writeSearchSession\(\{ mobileViewChoice: view \}\);\s*\}/);
  const search = read('src/pages/Search.jsx');
  const national = read('src/pages/DirectoryMap.jsx');
  assert.match(search, /useState\(\(\) => readMobileViewChoice\(saved\.mobileView \|\| "list"\)\)/, 'localitatea porneste pe lista');
  assert.match(national, /useState\(\(\) => readMobileViewChoice\(saved\.mobileView \|\| "map"\)\)/, 'harta Romaniei porneste pe harta');
  for (const [name, source] of [['Search', search], ['DirectoryMap', national]]) {
    assert.match(source, /rememberMobileViewChoice\(next\);/, `${name}: alegerea explicita se tine minte`);
    assert.match(source, /onToggleMobileView=\{toggleMobileView\}/, `${name}: comutatorul foloseste alegerea comuna`);
  }
}

// E3
{
  // O singura atribuire.
  const canvas = read('src/components/results/VectorResultsCanvas.jsx');
  assert.doesNotMatch(canvas, /customAttribution/, 'fara atribuirea adaugata peste cea a stilului');
  assert.match(canvas, /attributionControl:\{compact:true\}/);
  // Pozitie lipsa, nu aproximativa.
  assert.equal(unmappedNotice(1), 'O opțiune din listă nu are poziție publicată și nu apare pe hartă.');
  assert.equal(unmappedNotice(3), '3 opțiuni din listă nu au poziție publicată și nu apar pe hartă.');
  assert.equal(unmappedNotice(0), '');
  assert.doesNotMatch(read('shared/resultsMapPoints.js'), /poziție exactă/);
  // Diacritice din numele oficial, doar daca literele coincid.
  assert.equal(nameFromOfficial('MUNICIPIUL PAŞCANI', 'Pascani'), 'Pașcani', 'sedila devine virgula');
  assert.equal(nameFromOfficial('ORAŞ BAIA DE ARAMĂ', 'Baia de Arama'), 'Baia de Aramă', '„de” ramane mic');
  assert.equal(nameFromOfficial('MUNICIPIUL CURTEA DE ARGEŞ', 'Curtea de Arges'), 'Curtea de Argeș');
  assert.equal(nameFromOfficial('ORAŞ NEGREŞTI-OAŞ', 'Negresti-Oas'), 'Negrești-Oaș');
  assert.equal(nameFromOfficial('MUNICIPIUL SIGHETU MARMAŢIEI', 'Sighetu Marmatiei'), 'Sighetu Marmației');
  assert.equal(nameFromOfficial('COMUNA ALTCEVA', 'Pascani'), '', 'alt nume: nu se foloseste');
  assert.equal(nameFromOfficial('', 'Pascani'), '');
  const pascani = prettyLocality({ siruta_code: '1', name: 'Pascani', official_name: 'MUNICIPIUL PAŞCANI', county_name: 'Iasi', locality_type: 'municipality', display_label: 'Pascani, Iasi' });
  assert.equal(pascani.name, 'Pașcani');
  assert.equal(pascani.siruta_code, '1', 'codul SIRUTA ramane cel oficial');
  assert.match(read('base44/functions/searchGeographicLocalities/entry.ts'), /official_name: r\.official_name \|\| undefined/, 'serverul trimite numele oficial');
  // Termeni unificati.
  const search = read('src/pages/Search.jsx');
  assert.match(search, /Caută clinici, optici și specialiști/);
  // Textele afisate (intre ghilimele sau intre taguri), nu comentariile.
  assert.doesNotMatch(search, /"[^"\n]*furnizori[^"\n]*"|>[^<{\n]*furnizori/i, 'fara „furnizori” in pagina de cautare');
  assert.match(read('src/components/seo/RouteSeo.jsx'), /Caută clinici, optici și specialiști \| VIASEE/);
  // Panoul de incredere compact: segmentele si „Vezi de ce” pe acelasi rand.
  const panel = read('src/components/results/DecisionConfidencePanel.jsx');
  assert.match(panel, /className="flex min-h-11 w-full items-center gap-2 text-left"/);
  assert.doesNotMatch(panel, /flex min-h-11 w-full flex-wrap/, 'randul compact nu se mai rupe');
}

console.log('Search design details (E2, E3) checks passed.');
