// Garduri pentru viteza home-ului (masurate pe 2026-09-23: derulare la ~12 cadre/s pe desktop,
// primul ecran asteptand framer-motion pe mobil, procesor ocupat de animatia de scris).
// Verifica static ca reparatiile raman pe loc.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
// Comentariile pot explica de ce un efect a fost scos; verificarile se fac doar pe cod.
const stripComments = (source) => source
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const homeFiles = ['src/pages/Home.jsx', ...(await readdir(new URL('../src/components/home/', import.meta.url)))
  .filter((name) => name.endsWith('.jsx'))
  .map((name) => `src/components/home/${name}`)];
const homeSources = Object.fromEntries(await Promise.all(homeFiles.map(async (file) => [file, await read(file)])));
const home = homeSources['src/pages/Home.jsx'];

// Componentele folosite efectiv de home (cele nefolosite, ex. ProvidersShowcase, nu intra in pagina).
const used = ['src/pages/Home.jsx', 'src/components/home/Hero.jsx', 'src/components/home/CategoryShowcase.jsx',
  'src/components/home/CategoryStrip.jsx', 'src/components/home/SituationExplainer.jsx',
  'src/components/home/HowItWorks.jsx', 'src/components/home/ProCta.jsx'];
for (const file of used) {
  assert.ok(homeSources[file], `${file} lipseste`);
  const source = stripComments(homeSources[file]);
  assert.doesNotMatch(source, /from ["']framer-motion["']/, `${file}: primul ecran nu trebuie sa astepte framer-motion`);
  assert.doesNotMatch(source, /backdrop-blur/, `${file}: backdrop-blur redeseneaza fundalul la fiecare cadru de derulare`);
  assert.doesNotMatch(source, /drop-shadow-\[/, `${file}: filtrul drop-shadow pe blocuri mari se redeseneaza; foloseste box-shadow`);
  assert.doesNotMatch(source, /\bblur-(?:sm|md|lg|xl|2xl|3xl|\[)/, `${file}: halourile se deseneaza cu gradient (softGlow.js), nu cu filtru blur`);
  assert.doesNotMatch(source, /mix-blend-/, `${file}: textura se suprapune normal (diferenta sub un nivel de culoare), fara strat de amestec`);
}

// Halourile colorate raman, desenate ca gradient (aproape gratuit la derulare), nu ca filtru blur.
// (Categoriile nu mai au halouri din 2026-09-26: banda cu placute din CategoryStrip.jsx.)
for (const file of ['src/components/home/HowItWorks.jsx']) {
  const source = stripComments(homeSources[file]);
  assert.match(source, /import \{ softGlowBackground \} from "@\/lib\/softGlow"/, `${file}: halourile folosesc softGlowBackground`);
  assert.match(source, /style=\{\{ backgroundImage: step\.glow \}\}/, `${file}: haloul e un gradient`);
}
const softGlow = await read('src/lib/softGlow.js');
assert.match(softGlow, /SOFT_GLOW_BLEED_PX = 128/);
assert.match(softGlow, /radial-gradient\(closest-side/);

// Antetul fix nu mai estompeaza continutul de dedesubt la derulare, pe nicio pagina.
const layout = stripComments(await read('src/components/Layout.jsx'));
const headers = layout.match(/function (?:Desktop|Mobile)Header[\s\S]*?\n}\n/g) || [];
assert.equal(headers.length, 2, 'Antetele desktop si mobil trebuie gasite in Layout.jsx');
for (const header of headers) assert.doesNotMatch(header, /backdrop-blur|backdrop-filter\]/, 'Antetul nu foloseste backdrop-blur');
for (const [file, source] of Object.entries(homeSources)) {
  if (!used.includes(file)) continue;
  assert.doesNotMatch(source, /\bwill-change-transform\b/, `${file}: will-change permanent pe blocuri mari tine memorie video ocupata`);
}

// Sectiunile se randeaza o singura data (inainte existau doua copii pe desktop).
assert.equal((home.match(/<HomeCanvas\b/g) || []).length, 1, 'HomeCanvas trebuie randat o singura data');
assert.doesNotMatch(home, /useScroll|useTransform/, 'Efectul de pe desktop foloseste derularea nativa (sticky), nu transformari pe fiecare cadru');
// Antetul e transparent peste primul ecran (nu mai rezerva 80px), deci ancora e la varful ferestrei.
assert.match(home, /sticky top-0/, 'Primul ecran ramane fixat prin CSS sticky');
assert.match(home, /PIN_DISTANCE = "45svh"/, 'Primul ecran sta fixat cam jumatate din cat statea inainte (70svh)');
assert.match(home, /pinActive && <div aria-hidden="true" data-home-pin-track="" style=\{\{ height: PIN_DISTANCE \}\} \/>/,
  'Drumul pentru sticky e un element in parinte (padding-ul nu conteaza pentru sticky)');
assert.doesNotMatch(home, /paddingBottom: PIN_DISTANCE/, 'Padding-ul parintelui nu lasa loc pentru sticky');

// Animatia de scris: fara re-randare la fiecare litera, oprita cand nu se vede.
const hero = homeSources['src/components/home/Hero.jsx'];
assert.doesNotMatch(hero, /setDisplay\(/, 'Textul care se scrie nu mai trece prin starea React la fiecare litera');
assert.match(hero, /textContent/);
assert.match(hero, /IntersectionObserver/);
assert.match(hero, /visibilitychange/);
assert.match(hero, /preloadConversationalCard/, 'Formularul conversational se descarca la intrarea in caseta');

// Aparitia la derulare respecta „reducere miscare” si nu ascunde continutul fara JavaScript.
const reveal = await read('src/components/common/Reveal.jsx');
assert.match(reveal, /prefersReducedMotion\(\)/);
assert.doesNotMatch(reveal, /useState\(/, 'Aparitia schimba doar atributul elementului, fara re-randare React la derulare');
assert.match(reveal, /node\.dataset\.reveal = "pending"/, 'Continutul e ascuns doar dupa ce efectul a pornit (vizibil fara JavaScript)');
assert.match(reveal, /node\.dataset\.reveal = "shown"/);
assert.match(reveal, /if \(node\.dataset\.reveal === "pending"\) node\.dataset\.reveal = "shown"/, 'La demontare nimic nu ramane ascuns');
const css = await read('src/index.css');
assert.match(css, /\[data-reveal="pending"\] \{\s*opacity: 0;/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\[data-reveal="pending"\] \{\s*opacity: 1;/);

// Descarcarea in avans a paginilor: doar rute care exista in App.jsx.
const app = await read('src/App.jsx');
const prefetch = await read('src/lib/routePrefetch.js');
for (const [, route, page] of prefetch.matchAll(/"(\/[^"]*)": \(\) => import\("@\/pages\/([A-Za-z]+)"\)/g)) {
  assert.match(app, new RegExp(`path="${route.replace(/[/]/g, '\\/')}" element=\\{<${page} />\\}`), `${route} trebuie sa fie ruta paginii ${page}`);
}
assert.match(prefetch, /saveData/, 'Fara descarcare in avans pe conexiuni cu economisire de date');

// Codul home-ului porneste odata cu scriptul principal, doar pe /.
const vite = await read('vite.config.js');
assert.match(vite, /function preloadHomeRoute\(\)/);
assert.match(vite, /location\.pathname!=="\/"/);
assert.match(vite, /preloadHomeRoute\(\),/);

console.log('Home performance checks passed.');
