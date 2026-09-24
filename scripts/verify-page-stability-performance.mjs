// Garduri pentru reparatiile din 2026-09-24 (audit /cauta, profiluri, /cerere):
// 1. subsolul nu mai sare la incarcare (CLS); 2. /cauta fara sacadari la hover, derulare si
// trecerea pe lista; 3. harta Google din profil se incarca doar cand ajungi la ea.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// 1. Continutul paginilor (in afara de home) are cel putin inaltimea ecranului sub antet.
{
  const css = await read('src/index.css');
  assert.match(css, /\.page-main-min \{\s*min-height: calc\(100vh - 4rem\);\s*min-height: calc\(100svh - 4rem\);\s*\}/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.page-main-min \{\s*min-height: calc\(100vh - 5rem\);\s*min-height: calc\(100svh - 5rem\);/);
  const layout = await read('src/components/Layout.jsx');
  assert.match(layout, /: \"page-main-min min-w-0 flex-1 overflow-x-clip outline-none\"/, 'Paginile fara home folosesc page-main-min');
  assert.match(layout, /\? \"min-w-0 flex-1 overflow-visible outline-none\"/, 'Home ramane neschimbat');
  assert.match(layout, /<div aria-hidden=\"true\" className=\"hidden h-20 lg:block\" \/>/, 'Antetul desktop are 5rem (h-20), ca in regula CSS');
}

// 2. /cauta
{
  const canvas = await read('src/components/results/VectorResultsCanvas.jsx');
  // Markerele se reconstruiesc doar cand se schimba grupurile, nu la hover sau selectie.
  assert.match(canvas, /\},\[clusters,ready,pillHtml\]\);/);
  assert.match(canvas, /\},\[selectedId,hoveredId,ready\]\);/);
  const stateEffect = canvas.slice(canvas.indexOf('// Selectia si hover-ul: doar markerele'), canvas.indexOf('},[selectedId,hoveredId,ready]);'));
  assert.ok(stateEffect.length > 100, 'Efectul separat pentru selectie si hover exista');
  assert.doesNotMatch(stateEffect, /innerHTML/, 'Hover-ul nu rescrie HTML-ul markerelor');
  assert.match(stateEffect, /pill\.dataset\.active===String\(active\) && pill\.dataset\.hovered===String\(hovered\)\) return;/, 'Doar markerele a caror stare se schimba');
  assert.match(canvas, /handlers\.current\.onHover\?\.\(cluster\.lead\.id\)/, 'Handler-ele citesc ultimele functii, fara reconstructie');
  // Harta ascunsa (lista pe telefon) nu se redimensioneaza la 0.
  assert.match(canvas, /if \(!element \|\| element\.clientWidth === 0 \|\| element\.clientHeight === 0\) return;\s*map\.resize\(\);/);
  // Aceleasi atribute ca pillHtml.
  const presentation = await read('shared/mapMarkerPresentation.js');
  assert.match(presentation, /data-active="\$\{active\}" data-hovered="\$\{hovered\}"/);

  const directoryMap = await read('src/pages/DirectoryMap.jsx');
  const scrollEffect = directoryMap.slice(directoryMap.indexOf('2026-09-24. Pozitia se salveaza'), directoryMap.indexOf('const orderedPoints'));
  assert.match(scrollEffect, /timer = setTimeout\(save, 200\)/, 'Pozitia se salveaza dupa ce derularea se opreste');
  assert.match(scrollEffect, /window\.addEventListener\("pagehide", save\)/);
  assert.match(scrollEffect, /writeSearchSession\(\{ nationalScroll: lastY \}\)/, 'Se salveaza ultima pozitie a acestei pagini');
  assert.doesNotMatch(scrollEffect, /addEventListener\("scroll", save/, 'Fara salvare la fiecare eveniment');

  const locations = await read('src/components/results/LocationsWithMap.jsx');
  assert.match(locations, /rememberTimer\.current = setTimeout\(\(\) => \{ rememberTimer\.current = 0; rememberLatest\.current\(\); \}, 200\);/);
  assert.match(locations, /top: lastListTop\.current/);
  assert.match(locations, /onScroll=\{rememberList\}/);

  const resultsMap = await read('src/components/results/ResultsMap.jsx');
  assert.match(resultsMap, /const fitSignature = useMemo\(/, 'Semnatura punctelor se calculeaza o data per set');
  assert.match(resultsMap, /signature: fitSignature/);
}

// 3. Harta Google din profil
{
  const profile = await read('src/pages/ProviderProfile.jsx');
  assert.match(profile, /function DeferredMapEmbed\(\{ src, title \}\)/);
  assert.match(profile, /new IntersectionObserver\(/);
  assert.match(profile, /rootMargin: "400px 0px"/);
  assert.match(profile, /<DeferredMapEmbed title=\{`Harta \$\{profile\.name\}`\} src=\{embedUrl\} \/>/);
  assert.equal((profile.match(/<iframe/g) || []).length, 1, 'Un singur iframe, in DeferredMapEmbed');
  assert.match(profile, /\{visible \? \(\s*<iframe/, 'Iframe-ul exista doar dupa ce cardul se apropie de ecran');
  assert.match(profile, /Afișează harta/, 'Harta se poate cere si direct');
}

console.log('Page stability and performance checks passed.');
