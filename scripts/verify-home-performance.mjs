// Garduri pentru viteza home-ului (masurate pe 2026-09-23: derulare la ~12 cadre/s pe desktop,
// primul ecran asteptand framer-motion pe mobil, procesor ocupat de animatia de scris).
// Verifica static ca reparatiile raman pe loc.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const homeFiles = ['src/pages/Home.jsx', ...(await readdir(new URL('../src/components/home/', import.meta.url)))
  .filter((name) => name.endsWith('.jsx'))
  .map((name) => `src/components/home/${name}`)];
const homeSources = Object.fromEntries(await Promise.all(homeFiles.map(async (file) => [file, await read(file)])));
const home = homeSources['src/pages/Home.jsx'];

// Componentele folosite efectiv de home (cele nefolosite, ex. ProvidersShowcase, nu intra in pagina).
const used = ['src/pages/Home.jsx', 'src/components/home/Hero.jsx', 'src/components/home/CategoryShowcase.jsx',
  'src/components/home/MobileCategoryShowcase.jsx', 'src/components/home/SituationExplainer.jsx',
  'src/components/home/HowItWorks.jsx', 'src/components/home/ProCta.jsx'];
for (const file of used) {
  const source = homeSources[file];
  assert.ok(source, `${file} lipseste`);
  assert.doesNotMatch(source, /from ["']framer-motion["']/, `${file}: primul ecran nu trebuie sa astepte framer-motion`);
  assert.doesNotMatch(source, /backdrop-blur/, `${file}: backdrop-blur redeseneaza fundalul la fiecare cadru de derulare`);
  assert.doesNotMatch(source, /drop-shadow-\[/, `${file}: filtrul drop-shadow pe blocuri mari se redeseneaza; foloseste box-shadow`);
}
for (const [file, source] of Object.entries(homeSources)) {
  if (!used.includes(file)) continue;
  assert.doesNotMatch(source, /\bwill-change-transform\b/, `${file}: will-change permanent pe blocuri mari tine memorie video ocupata`);
}

// Sectiunile se randeaza o singura data (inainte existau doua copii pe desktop).
assert.equal((home.match(/<HomeCanvas\b/g) || []).length, 1, 'HomeCanvas trebuie randat o singura data');
assert.doesNotMatch(home, /useScroll|useTransform/, 'Efectul de pe desktop foloseste derularea nativa (sticky), nu transformari pe fiecare cadru');
assert.match(home, /sticky top-20/, 'Primul ecran ramane fixat prin CSS sticky');
assert.match(home, /PIN_DISTANCE = "45svh"/, 'Primul ecran sta fixat cam jumatate din cat statea inainte (70svh)');

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
assert.match(reveal, /useState\("static"\)/, 'Continutul e vizibil pana cand efectul confirma ca poate anima');
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
