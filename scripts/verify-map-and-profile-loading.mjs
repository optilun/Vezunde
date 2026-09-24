// /cauta si profilul: ce se incarca si in ce ordine (2026-09-24).
// - Harta vectoriala (MapLibre) intr-un fisier separat: pagina si lista nu o mai asteapta.
// - Markerele apar cand exista harta, nu dupa fundal (stil, dale); straturile 3D asteapta fundalul.
// - Profilul: datele si codul paginii pornesc odata cu codul principal; brandul, cand sosesc datele.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import {
  createPublicProfileLoader,
  profileIdFromPath,
  PROFILE_PREFETCH_FRESH_MS,
} from '../src/lib/publicProfilePrefetch.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await listFiles(path));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(path);
  }
  return out;
}

// 1. MapLibre doar in VectorResultsCanvas, iar acesta doar prin import dinamic.
{
  for (const file of await listFiles('src')) {
    const source = await read(file);
    if (file.endsWith('VectorResultsCanvas.jsx')) continue;
    assert.doesNotMatch(source, /from ["']maplibre-gl/, `${file} nu importa MapLibre direct`);
    assert.doesNotMatch(source, /import\s+VectorResultsCanvas\s+from/, `${file} nu importa static harta vectoriala`);
  }
  const loader = await read('src/components/results/vectorCanvasLoader.js');
  assert.match(loader, /return import\("\.\/VectorResultsCanvas"\);/);
  const resultsMap = await read('src/components/results/ResultsMap.jsx');
  assert.match(resultsMap, /lazy\(\(\) => loadVectorCanvas\(\)\.catch\(\(\) => \(\{ default: VectorCanvasUnavailable \}\)\)\)/, 'fisier lipsa -> harta 2D, nu pagina cazuta');
  assert.match(resultsMap, /report\.current\?\.\("unavailable"\)/);
  assert.match(resultsMap, /<Suspense fallback=\{VECTOR_LOADING\}>/);
  for (const page of ['src/pages/Search.jsx', 'src/pages/RequestMatches.jsx']) {
    assert.match(await read(page), /useEffect\(\(\) => \{ preloadVectorCanvas\(\); \}, \[\]\);/, `${page} porneste descarcarea hartii in paralel`);
  }
}

// 2. Markerele nu mai asteapta fundalul hartii.
{
  const canvas = await read('src/components/results/VectorResultsCanvas.jsx');
  const loadHandler = canvas.slice(canvas.indexOf('map.on("load"'), canvas.indexOf('map.on("webglcontextlost"'));
  assert.match(loadHandler, /setStyleReady\(true\)/, 'la load se marcheaza doar fundalul');
  assert.doesNotMatch(loadHandler, /setReady\(true\)/);
  assert.match(canvas, /observer\.observe\(container\.current\);\s*setReady\(true\);/, 'harta exista -> markere si camera');
  assert.match(canvas, /\},\[clusters,ready,pillHtml\]\);/, 'markerele depind de harta, nu de fundal');
  assert.match(canvas, /\},\[threeD,styleReady\]\);/, 'straturile 3D asteapta fundalul');
  assert.match(canvas, /disabled=\{!styleReady\}/);
  assert.match(canvas, /if \(!threeD && map\.getPitch\(\) === 0 && map\.getBearing\(\) === 0\) return;/, 'fara animatie inutila la incarcarea fundalului');
  assert.match(canvas, /pointer-events-none[^"]*"\>Se încarcă fundalul hărții\.\.\./, 'mesajul de fundal nu blocheaza harta');
  // Ramane trecerea pe harta 2D daca fundalul nu vine in 20 s.
  assert.match(canvas, /if \(!map\.isStyleLoaded\(\)\) latest\.current\.onFailure\("timeout"\)/);
}

// 3. Profil: cererea profilului o data, brandul doar pentru profilurile care nu sunt „directory”.
{
  assert.equal(profileIdFromPath('/furnizor/6a7247a1210357fb6570b933'), '6a7247a1210357fb6570b933');
  assert.equal(profileIdFromPath('/furnizor/abc/'), 'abc');
  assert.equal(profileIdFromPath('/furnizor/'), '');
  assert.equal(profileIdFromPath('/furnizor/abc/altceva'), '');
  assert.equal(profileIdFromPath('/cauta'), '');
  assert.equal(profileIdFromPath('/furnizor/%E0%A4%A'), '', 'adresa invalida nu arunca');

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  function makeLoader(profiles, clock = { t: 0 }) {
    const calls = [];
    const invoke = async (name, payload) => {
      calls.push(`${name}:${payload.location_id}`);
      if (name === 'getPublicProviderProfile') {
        const profile = profiles[payload.location_id];
        if (!profile) { const error = new Error('404'); error.status = 404; throw error; }
        return { data: { profile } };
      }
      return { data: { brand: { organization_name: `Brand ${payload.location_id}` } } };
    };
    return { calls, clock, loader: createPublicProfileLoader({ invoke, now: () => clock.t }) };
  }
  const profiles = {
    verified: { id: 'verified', profile_control_status: 'verified' },
    directory: { id: 'directory', profile_control_status: 'directory' },
  };

  // Intrare directa: profilul si brandul pornesc inainte de pagina; pagina le foloseste, fara dubluri.
  {
    const { calls, loader } = makeLoader(profiles);
    loader.prefetchProfileForPath('/furnizor/verified');
    loader.prefetchProfileForPath('/furnizor/verified');
    await flush(); await flush();
    assert.deepEqual(calls, ['getPublicProviderProfile:verified', 'getPublicOrganizationBrand:verified'], 'o cerere de profil; brandul pornit cand sosesc datele');
    const response = await loader.loadPublicProviderProfile('verified');
    assert.equal(response.data.profile.id, 'verified');
    const brand = await loader.loadPublicOrganizationBrand('verified');
    assert.equal(brand.data.brand.organization_name, 'Brand verified');
    assert.equal(calls.length, 2, 'pagina nu mai cere nimic a doua oara');
    // A doua vizita pe acelasi profil: date noi, ca inainte.
    await loader.loadPublicProviderProfile('verified');
    await flush();
    assert.equal(calls.filter((call) => call.startsWith('getPublicProviderProfile')).length, 2);
  }

  // Profil „directory”: nicio cerere de brand (ca pana acum, ProviderLocationHero nu o face).
  {
    const { calls, loader } = makeLoader(profiles);
    loader.prefetchProfileForPath('/furnizor/directory');
    await flush(); await flush();
    await loader.loadPublicProviderProfile('directory');
    await flush();
    assert.deepEqual(calls, ['getPublicProviderProfile:directory']);
  }

  // Fara intrare directa (navigare din aplicatie): o singura cerere, brandul tot devreme.
  {
    const { calls, loader } = makeLoader(profiles);
    await loader.loadPublicProviderProfile('verified');
    await flush();
    await loader.loadPublicOrganizationBrand('verified');
    assert.deepEqual(calls, ['getPublicProviderProfile:verified', 'getPublicOrganizationBrand:verified']);
  }

  // O cerere veche nu se foloseste; o eroare ajunge la pagina, ca inainte, si nu ramane tinuta.
  {
    const { calls, clock, loader } = makeLoader(profiles);
    loader.prefetchPublicProviderProfile('verified');
    await flush();
    clock.t = PROFILE_PREFETCH_FRESH_MS + 1;
    await loader.loadPublicProviderProfile('verified');
    assert.equal(calls.filter((call) => call.startsWith('getPublicProviderProfile')).length, 2, 'dupa 30 s pagina cere din nou');

    loader.prefetchPublicProviderProfile('missing');
    await flush();
    await assert.rejects(loader.loadPublicProviderProfile('missing'), /404/);
    await assert.rejects(loader.loadPublicProviderProfile('missing'), /404/);
    assert.equal(calls.filter((call) => call === 'getPublicProviderProfile:missing').length, 2, 'eroarea se foloseste o data (fara cerere dubla), apoi se cere din nou');
  }

  // Legaturile din pagina si din aplicatie.
  const main = await read('src/main.jsx');
  assert.match(main, /prefetchProfileForCurrentUrl\(\)\n\nReactDOM\.createRoot/, 'porneste inainte de randare');
  const prefetchSource = await read('src/lib/publicProfilePrefetch.js');
  assert.doesNotMatch(prefetchSource, /^import .*base44Client/m, 'clientul Base44 nu intra in codul principal');
  assert.match(prefetchSource, /await import\("@\/api\/base44Client"\)/);
  const profilePage = await read('src/pages/ProviderProfile.jsx');
  assert.match(profilePage, /loadPublicProviderProfile\(id\)\.then\(\(res\) => setProfile\(res\.data\?\.profile \|\| null\)\)/);
  assert.doesNotMatch(profilePage, /functions\.invoke\("getPublicProviderProfile"/);
  const hero = await read('src/components/provider/ProviderLocationHero.jsx');
  assert.match(hero, /if \(!profile\.id \|\| isDirectoryProfile\) \{/, 'aceeasi regula pentru brand');
  assert.match(hero, /loadPublicOrganizationBrand\(profile\.id\)/);
}

// 4. Codul paginii de profil porneste odata cu scriptul principal, doar pe /furnizor/:id.
{
  const vite = await read('vite.config.js');
  assert.match(vite, /preloadProfileRoute\(\),/);
  const guard = vite.match(/preloadRouteChunk\('viasee-preload-profile-route', [^,]+, '([^']+)'\)/)?.[1];
  assert.ok(guard, 'conditia de adresa exista');
  const skip = new Function('location', `return ${guard.replace(/\\\\/g, '\\')};`);
  assert.equal(skip({ pathname: '/furnizor/6a7247a1210357fb6570b933' }), false);
  assert.equal(skip({ pathname: '/furnizor/abc/' }), false);
  for (const pathname of ['/', '/cauta', '/furnizor/', '/furnizor/a/b', '/specialist/abc']) {
    assert.equal(skip({ pathname }), true, `${pathname} nu descarca profilul`);
  }
  assert.match(vite, /preloadRouteChunk\('viasee-preload-home-route', [^,]+, 'location\.pathname!=="\/"'\)/, 'home neschimbat');
}

console.log('Map and profile loading checks passed.');
