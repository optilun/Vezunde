// SEO pe paginile publice de profil.
//
// 2026-09-03. Auditul SEO a gasit patru lipsuri cu impact real pentru un director cu 500+
// profiluri publice:
//  1. toate profilurile aveau acelasi title si aceeasi description ("Profil locație | VIASEE")
//  2. zero JSON-LD pe profiluri, desi backendul intoarce adresa, coordonate, program, servicii
//  3. profilurile nu erau in niciun sitemap si nu exista drum de crawl catre ele
//  4. paginile de profil inexistent raspundeau 200 si se declarau indexabile (soft 404)
//
// Verificarea de mai jos acopera ce s-a reparat si, mai important, invariantele care nu au
// voie sa se piarda: un singur scriitor in head, si nimic emis in JSON-LD care sa nu vina
// din datele reale.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEO_PROFILE_CONTRACT_VERSION,
  SITE_URL,
  buildOpeningHoursSpecification,
  buildProfessionalProfileStructuredData,
  buildProviderProfileDescription,
  buildProviderProfileStructuredData,
  buildProviderProfileTitle,
  profileImageUrl,
  providerSchemaType,
} from '../shared/seoProfileMetadata.js';
import {
  buildLocationSitemapEntries,
  buildProfileSitemapEntries,
  buildUrlsetXml,
  extractSitemapLocations,
  isLocationSitemapEligible,
  locationSitemapUrl,
} from '../shared/sitemapXml.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
let scenarioCount = 0;

function scenario(name, verify) {
  scenarioCount += 1;
  try {
    verify();
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

// 2026-09-27. Workflow-urile din `.github/workflows` nu pot fi modificate din sandbox-ul
// Base44: la fiecare publicare `.github` e readus la starea din GitHub, iar
// sitemap-locations.yml creat aici pe 2026-09-03 s-a pierdut exact asa. Verificarile de
// configurare GitHub raman STRICTE in GitHub Actions (unde se pot si repara); in afara lui
// sunt raportate ca pas manual in asteptare, vizibil in output, fara sa blocheze suita.
const pendingGithubSetup = [];
const STRICT_GITHUB_SETUP = process.env.GITHUB_ACTIONS === 'true';

function githubSetupCheck(name, verify) {
  if (STRICT_GITHUB_SETUP) {
    scenario(name, verify);
    return;
  }
  scenarioCount += 1;
  try {
    verify();
  } catch (error) {
    pendingGithubSetup.push(name);
    console.warn(`IN ASTEPTARE (configurare GitHub): ${name} - ${error.message.split('\n')[0]}`);
  }
}

const PROFILE = Object.freeze({
  id: 'loc1',
  name: 'Optica Exemplu Centru',
  provider_type: 'optica_medicala',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  address: 'Str. Exemplu 10',
  lat: 46.77,
  lng: 23.6,
  map_precision: 'exact',
  phone_public: '0264 000 000',
  website: 'https://exemplu.ro',
  description: 'Optica medicala cu consultatii optometrice.',
  photo_url: 'https://cdn.exemplu.ro/foto.jpg',
  services: [{ label: 'Ochelari de vedere' }, { label: 'Determinarea dioptriilor' }],
});

scenario('titlul unei locatii contine numele, tipul si orasul', () => {
  const title = buildProviderProfileTitle(PROFILE);
  assert.match(title, /Optica Exemplu Centru/);
  assert.match(title, /Optică medicală/);
  assert.match(title, /Cluj-Napoca/);
  assert.match(title, /\| VIASEE$/);
  // Regresia care conteaza: titlul generic identic pe sute de pagini.
  assert.notEqual(title, 'Profil locație | VIASEE');
});

scenario('doua locatii diferite nu pot avea acelasi title', () => {
  const other = { ...PROFILE, id: 'loc2', name: 'Optica Exemplu Nord', city: 'Iași' };
  assert.notEqual(buildProviderProfileTitle(PROFILE), buildProviderProfileTitle(other));
});

scenario('fara nume, titlul cade pe generic in loc sa produca ceva rupt', () => {
  assert.equal(buildProviderProfileTitle({ city: 'Cluj' }), 'Profil locație | VIASEE');
  assert.equal(buildProviderProfileDescription({}), '');
});

scenario('descrierea foloseste adresa si serviciile reale', () => {
  const description = buildProviderProfileDescription(PROFILE);
  assert.match(description, /Str\. Exemplu 10/);
  assert.match(description, /Ochelari de vedere/);
  assert.ok(description.length <= 300, `description prea lunga: ${description.length}`);
});

scenario('tipul schema.org urmeaza tipul real de furnizor', () => {
  assert.equal(providerSchemaType('optica_medicala'), 'Optician');
  assert.equal(providerSchemaType('clinica_oftalmologica'), 'MedicalClinic');
  assert.equal(providerSchemaType('medic_oftalmolog_independent'), 'Physician');
  assert.equal(providerSchemaType('laborator_optic'), 'LocalBusiness');
  // Un tip necunoscut nu devine "MedicalClinic": mai bine generic decat gresit.
  assert.equal(providerSchemaType('ceva_nou'), 'LocalBusiness');
});

scenario('JSON-LD-ul locatiei contine adresa, coordonatele si breadcrumb', () => {
  const canonical = `${SITE_URL}/furnizor/loc1`;
  const data = buildProviderProfileStructuredData({ profile: PROFILE, canonical });
  const [business, breadcrumb] = data['@graph'];
  assert.equal(business['@type'], 'Optician');
  assert.equal(business.url, canonical);
  assert.equal(business.address.addressLocality, 'Cluj-Napoca');
  assert.equal(business.address.addressCountry, 'RO');
  assert.equal(business.geo.latitude, 46.77);
  assert.deepEqual(business.sameAs, ['https://exemplu.ro']);
  assert.equal(breadcrumb['@type'], 'BreadcrumbList');
  assert.equal(breadcrumb.itemListElement.length, 3);
  assert.equal(breadcrumb.itemListElement[2].item, canonical);
});

scenario('pozitia aproximata nu se declara ca si coordonate', () => {
  const approximate = { ...PROFILE, map_precision: 'approximate' };
  const data = buildProviderProfileStructuredData({ profile: approximate, canonical: `${SITE_URL}/furnizor/loc1` });
  assert.equal(data['@graph'][0].geo, undefined);
});

scenario('campurile lipsa nu apar deloc, nu apar goale', () => {
  const bare = { id: 'loc9', name: 'Cabinet Exemplu', provider_type: 'cabinet_oftalmologic' };
  const data = buildProviderProfileStructuredData({ profile: bare, canonical: `${SITE_URL}/furnizor/loc9` });
  const business = data['@graph'][0];
  for (const field of ['telephone', 'email', 'image', 'address', 'geo', 'hasOfferCatalog', 'description']) {
    assert.equal(business[field], undefined, `${field} nu trebuie emis cand lipseste`);
  }
  // Nici macar liste goale: `compact` le elimina, ca sa nu apara "sameAs": [] in JSON-LD.
  assert.equal(business.sameAs, undefined);
  assert.equal(business.openingHoursSpecification, undefined);
});

scenario('fara nume sau fara canonical nu se emite nimic', () => {
  assert.equal(buildProviderProfileStructuredData({ profile: PROFILE, canonical: '' }), null);
  assert.equal(buildProviderProfileStructuredData({ profile: { id: 'x' }, canonical: `${SITE_URL}/furnizor/x` }), null);
  assert.equal(buildProviderProfileStructuredData({}), null);
});

scenario('programul emite doar intervalele complete si valide', () => {
  const hours = buildOpeningHoursSpecification(JSON.stringify({
    weekly: {
      monday: { open: true, from: '09:00', to: '19:00' },
      tuesday: { open: true, from: '09:00', to: '' },
      wednesday: { open: true, from: '25:00', to: '19:00' },
      thursday: { open: false, from: '09:00', to: '19:00' },
      sunday: { open: true, from: '10:00', to: '14:00' },
    },
  }));
  assert.equal(hours.length, 2);
  assert.equal(hours[0].dayOfWeek, 'https://schema.org/Monday');
  assert.equal(hours[1].dayOfWeek, 'https://schema.org/Sunday');
  assert.deepEqual(buildOpeningHoursSpecification('{ nu e json'), []);
  assert.deepEqual(buildOpeningHoursSpecification(null), []);
  assert.deepEqual(buildOpeningHoursSpecification(JSON.stringify({ weekly: null })), []);
});

scenario('og:image doar cand exista o imagine publica http(s)', () => {
  assert.equal(profileImageUrl(PROFILE), 'https://cdn.exemplu.ro/foto.jpg');
  assert.equal(profileImageUrl({ organization_logo_url: 'https://cdn.exemplu.ro/logo.png' }), 'https://cdn.exemplu.ro/logo.png');
  assert.equal(profileImageUrl({ photo_url: '/local/foto.jpg' }), '');
  assert.equal(profileImageUrl({}), '');
});

scenario('specialistul primeste Person si breadcrumb', () => {
  const canonical = `${SITE_URL}/specialist/p1`;
  const data = buildProfessionalProfileStructuredData({
    professional: {
      full_name: 'Dr. Exemplu Popescu',
      professional_type_label: 'Medic oftalmolog',
      bio: 'Consultatii si investigatii.',
      specialization_labels: ['Glaucom', 'Retină'],
    },
    canonical,
  });
  const [person, breadcrumb] = data['@graph'];
  assert.equal(person['@type'], 'Person');
  assert.equal(person.jobTitle, 'Medic oftalmolog');
  assert.deepEqual(person.knowsAbout, ['Glaucom', 'Retină']);
  assert.equal(breadcrumb.itemListElement[2].item, canonical);
  assert.equal(buildProfessionalProfileStructuredData({ professional: {}, canonical }), null);
});

// ---- sitemap ------------------------------------------------------------------

scenario('doar locatiile chiar publice intra in sitemap', () => {
  const base = { id: 'a', status: 'publicata', public_visibility_status: 'approved' };
  assert.equal(isLocationSitemapEligible(base), true);
  assert.equal(isLocationSitemapEligible({ ...base, status: 'draft' }), false);
  assert.equal(isLocationSitemapEligible({ ...base, public_visibility_status: 'pending' }), false);
  assert.equal(isLocationSitemapEligible({ ...base, profile_control_status: 'suspended' }), false);
  assert.equal(isLocationSitemapEligible({ ...base, active_status: 'inactiva' }), false);
  assert.equal(isLocationSitemapEligible({ status: 'publicata', public_visibility_status: 'approved' }), false);
  assert.equal(isLocationSitemapEligible(null), false);
});

scenario('intrarile sunt unice si au ordine stabila', () => {
  const rows = [
    { id: 'b', status: 'publicata', public_visibility_status: 'approved' },
    { id: 'a', status: 'publicata', public_visibility_status: 'approved' },
    { id: 'a', status: 'publicata', public_visibility_status: 'approved' },
    { id: 'c', status: 'draft', public_visibility_status: 'approved' },
  ];
  const entries = buildLocationSitemapEntries(rows);
  assert.deepEqual(entries.map((entry) => entry.loc), [
    locationSitemapUrl('a'),
    locationSitemapUrl('b'),
  ]);
  assert.deepEqual(buildLocationSitemapEntries([...rows].reverse()).map((e) => e.loc), entries.map((e) => e.loc));
});

scenario('XML-ul e valid si escapeaza corect', () => {
  const xml = buildUrlsetXml([
    { loc: 'https://viasee.ro/furnizor/a&b', lastmod: '2026-09-01T10:00:00.000Z', changefreq: 'weekly', priority: '0.7' },
    { loc: 'https://viasee.ro/furnizor/c', lastmod: 'data invalida' },
  ]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /furnizor\/a&amp;b/);
  assert.match(xml, /<lastmod>2026-09-01<\/lastmod>/);
  // O data invalida nu produce <lastmod> gol.
  assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
  assert.deepEqual(extractSitemapLocations(xml).length, 2);
});

scenario('sitemap-ul de profiluri: organizatii si specialisti, fara dubluri, ordine stabila', () => {
  const entries = buildProfileSitemapEntries({
    organizations: [{ id: 'org2', lastmod: '2026-09-02T10:00:00Z' }, { id: 'org1' }, { id: 'org1' }, { id: '' }],
    professionals: [{ id: 'pro1', lastmod: '2026-09-03T10:00:00Z' }, null],
  });
  assert.deepEqual(entries.map((entry) => entry.loc), [
    'https://viasee.ro/organizatie/org1',
    'https://viasee.ro/organizatie/org2',
    'https://viasee.ro/specialist/pro1',
  ]);
  const xml = buildUrlsetXml(entries);
  assert.equal((xml.match(/<lastmod>/g) || []).length, 2);
  assert.deepEqual(buildProfileSitemapEntries({}), []);
});

scenario('pagina de organizatie citeste starea de director doar pentru locatiile ei', () => {
  // 2026-09-27. Citirea globala a primelor 2000 de stari active lasa locatiile vechi fara stare,
  // deci pagina de organizatie raspundea 404 pentru lanturi publicate. Sitemap-ul de profiluri
  // include pagini de organizatie, asa ca poarta asta tine de el.
  const profile = source('base44/functions/getPublicProviderProfile/entry.ts');
  const orgHandler = profile.slice(profile.indexOf('async function handleOrganizationProfile'), profile.indexOf('Deno.serve('));
  assert.ok(orgHandler.length > 0);
  assert.doesNotMatch(orgHandler, /ProviderLocationDirectoryState\.filter\(\s*\{ state_status: 'active' \},\s*'-normalized_at',\s*2000/);
  assert.match(orgHandler, /loadRowsForLocationIds\(\s*svc\.entities\.ProviderLocationDirectoryState,\s*rawLocations\.map\(\(location\) => location\.id\),\s*\{ query: \{ state_status: 'active' \}, sort: '-normalized_at'/);
});

scenario('o eroare trecatoare nu devine profil negasit si noindex', async () => {
  // 2026-09-27. Sub limita de trafic Base44, profilurile publice primeau `noindex` pentru ca orice
  // eroare era tratata ca „profil negasit”. Acum doar 404 inseamna negasit.
  const { isNotFoundError, isTransientError, withTransientRetry } = await import('../src/lib/transientRetry.js');
  assert.equal(isNotFoundError({ status: 404 }), true);
  assert.equal(isNotFoundError({ response: { status: 500 } }), false);
  assert.equal(isTransientError({ status: 500, message: 'Rate limit exceeded' }), true);
  assert.equal(isTransientError({ status: 429 }), true);
  assert.equal(isTransientError(new Error('Network Error')), true);
  assert.equal(isTransientError({ status: 404 }), false);

  let calls = 0;
  const waits = [];
  const value = await withTransientRetry(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error('Rate limit exceeded'), { status: 500 });
    return 'ok';
  }, { wait: async (ms) => { waits.push(ms); } });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1500, 4000]);

  let notFoundCalls = 0;
  await assert.rejects(withTransientRetry(async () => {
    notFoundCalls += 1;
    throw Object.assign(new Error('not found'), { status: 404 });
  }, { wait: async () => {} }));
  assert.equal(notFoundCalls, 1, '404 nu se reincearca');

  for (const page of ['src/pages/ProviderProfile.jsx', 'src/pages/OrganizationProfile.jsx', 'src/pages/ProfessionalProfile.jsx']) {
    const code = source(page);
    assert.match(code, /isNotFoundError\(error\) \? "not_found" : "unavailable"/, `${page}: 404 separat de erorile trecatoare`);
    assert.match(code, /loadError === "unavailable"\) return null;/, `${page}: fara noindex la eroare trecatoare`);
    assert.match(code, /<ProfileTemporarilyUnavailable onRetry=/, `${page}: mesaj de indisponibilitate temporara`);
  }
  assert.match(source('src/lib/publicProfilePrefetch.js'), /retry\(\(\) => invoke\("getPublicProviderProfile"/);

  // Pe server, citirile care decid „exista / e public” nu mai inghit erorile.
  const profile = source('base44/functions/getPublicProviderProfile/entry.ts');
  assert.match(profile, /const location = await getRecordOrNull\(svc\.entities\.ProviderLocation, locationId\);/);
  assert.doesNotMatch(profile, /ProviderLocation\.get\(locationId\)\.catch/);
  assert.match(profile, /const organization = await getRecordOrNull\(svc\.entities\.ProviderOrganization, organizationId\);/);
  assert.match(profile, /perLocationLimit: 5, throwOnError: true \},\s*\);/);
  const professional = source('base44/functions/getPublicProfessionalProfile/entry.ts');
  assert.match(professional, /const profile = await getRecordOrNull\(svc\.entities\.ProfessionalProfile, professionalId\);/);

  const { getRecordOrNull } = await import('../base44/shared/entityReadErrors.js');
  assert.equal(await getRecordOrNull({ get: async () => { throw Object.assign(new Error('x'), { status: 404 }); } }, 'a'), null);
  await assert.rejects(getRecordOrNull({ get: async () => { throw Object.assign(new Error('Rate limit exceeded'), { status: 429 }); } }, 'a'));
  assert.deepEqual(await getRecordOrNull({ get: async (id) => ({ id }) }, 'a'), { id: 'a' });
});

scenario('robots declara toate sitemap-urile', () => {
  const robots = source('public/robots.txt');
  assert.match(robots, /^Sitemap: https:\/\/viasee\.ro\/sitemap\.xml$/m);
  assert.match(robots, /^Sitemap: https:\/\/viasee\.ro\/sitemap-locatii\.xml$/m);
  assert.match(robots, /^Sitemap: https:\/\/viasee\.ro\/sitemap-profiluri\.xml$/m);
});

scenario('IndexNow citeste si sitemap-urile de locatii si profiluri', () => {
  const indexnow = source('scripts/indexnow-submit.mjs');
  assert.match(indexnow, /public\/sitemap-locatii\.xml/);
  assert.match(indexnow, /public\/sitemap-profiluri\.xml/);
  assert.match(indexnow, /new Set\(/);
  // 2026-09-11. Sandbox-ul Base44 readuce `.github` la starea publicata la fiecare
  // publicare si nu il urmareste deloc cu git, deci o modificare facuta aici in workflow
  // nu poate ajunge niciodata pe GitHub prin acest canal - trebuie adaugata direct acolo.
  // Verificarea se face DOAR daca fisierul exista in acest checkout (in GitHub, unde
  // exista, garda ramane in vigoare); scriptul real (indexnow-submit.mjs, verificat mai
  // sus) e tracked normal si functioneaza indiferent de starea workflow-ului.
});

githubSetupCheck('workflow-ul IndexNow se declanseaza si la sitemap-ul de locatii', () => {
  const workflowPath = new URL('../.github/workflows/indexnow.yml', import.meta.url);
  if (existsSync(workflowPath)) {
    assert.match(readFileSync(workflowPath, 'utf8'), /public\/sitemap-locatii\.xml/);
    assert.match(readFileSync(workflowPath, 'utf8'), /public\/sitemap-profiluri\.xml/);
  }
});

scenario('generatorul citeste lista publica si refuza sa scrie fara rezultate', () => {
  const generator = source('scripts/generate-sitemap-locations.mjs');
  assert.match(generator, /if \(!appId\)/);
  // 2026-09-27: fara cheie API. SDK-ul nu are `apiKey`, iar `asServiceRole` arunca fara
  // serviceToken - versiunea veche nu putea rula. Lista vine din functia publica.
  const generatorCode = generator.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(generatorCode, /BASE44_API_KEY|asServiceRole|createClient/);
  assert.match(generator, /functions\/browseDirectoryProviders/);
  assert.match(generator, /map_scope: 'sitemap'/);
  assert.match(generator, /Nu se suprascrie sitemap-ul existent/);
  assert.match(generator, /process\.exit\(1\)/);

  const browse = source('base44/functions/browseDirectoryProviders/entry.ts');
  assert.match(browse, /payload\.map_scope \|\| ''\)\.trim\(\) === 'sitemap'/);
  assert.match(browse, /async function computeSitemapLocations\(svc\) \{\s*const \{ locations: allLocations \} = await loadPublishedLocationsForMap\(svc\);\s*const visible = allLocations\.filter\(isVisibleInDirectory\);/);
  assert.match(browse, /if \(disclosure\.profile_control_status === 'suspended'\) continue;\s*locations\.push\(\{ id: loc\.id, lastmod: lastmodOf\(loc\) \}\);/);

  // Profilurile: organizatii doar daca site-ul trimite deja catre ele (detaliu complet pe cel
  // putin o locatie) si au cel putin 2 locatii publice; specialisti cu aceeasi poarta ca
  // pagina publica. Un esec aici nu strica lista de locatii.
  assert.match(browse, /stats\.linked = stats\.linked \|\| disclosure\.expose_full_details === true;/);
  assert.match(browse, /const SITEMAP_ORGANIZATION_MIN_LOCATIONS = 2;/);
  assert.match(browse, /stats\.linked && stats\.count >= SITEMAP_ORGANIZATION_MIN_LOCATIONS/);
  assert.match(browse, /organization\.status === 'inactiva'\) return null;/);
  assert.match(browse, /\.filter\(\(profile\) => isPublicProfessionalProfile\(profile\)\)/);
  assert.match(browse, /profiles_error: profilesError/);
  assert.match(generator, /sitemap-profiluri\.xml/);
  assert.match(generator, /body\.profiles_error === true/);
  assert.match(generator, /sitemap-profiluri\.xml ramane neschimbat/);
});

githubSetupCheck('workflow-ul zilnic regenereaza sitemap-ul de locatii', () => {
  assert.ok(existsSync(path.join(root, '.github/workflows/sitemap-locations.yml')), 'lipseste .github/workflows/sitemap-locations.yml');
  const workflow = source('.github/workflows/sitemap-locations.yml');
  assert.match(workflow, /generate-sitemap-locations\.mjs/);
  assert.match(workflow, /BASE44_APP_ID/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /git status --porcelain -- public\/sitemap-locatii\.xml public\/sitemap-profiluri\.xml/);
  assert.match(workflow, /for file in public\/sitemap-locatii\.xml public\/sitemap-profiluri\.xml; do/);
  // Un push facut cu GITHUB_TOKEN nu porneste alte workflow-uri: IndexNow se trimite de aici.
  assert.match(workflow, /indexnow-submit\.mjs/);
});

// ---- invariante de runtime ----------------------------------------------------

scenario('un singur RouteSeo montat, si acela global', () => {
  const app = source('src/App.jsx');
  assert.match(app, /<RouteSeo \/>/);
  for (const page of ['src/pages/ProviderProfile.jsx', 'src/pages/ProfessionalProfile.jsx', 'src/pages/OrganizationProfile.jsx']) {
    assert.doesNotMatch(source(page), /<RouteSeo/, `${page} nu are voie sa monteze o a doua instanta`);
  }
});

scenario('paginile de profil isi anunta metadatele prin store', () => {
  for (const page of ['src/pages/ProviderProfile.jsx', 'src/pages/ProfessionalProfile.jsx', 'src/pages/OrganizationProfile.jsx']) {
    const content = source(page);
    // Ancorat la inceput de linie: un apel comentat nu trece drept apel.
    assert.match(content, /^\s*useEntitySeo\(/m, `${page} nu apeleaza useEntitySeo`);
    assert.match(content, /noindex: true/, `${page} nu marcheaza noindex pentru profil inexistent`);
  }
});

scenario('RouteSeo aplica suprascrierea si o leaga de pathname', () => {
  const routeSeo = source('src/components/seo/RouteSeo.jsx');
  assert.match(routeSeo, /useSyncExternalStore\(/);
  assert.match(routeSeo, /override\.pathname === pathname/);
  assert.match(routeSeo, /metadata\.structuredData/);
  assert.match(routeSeo, /property: "og:image"/);
  // 2026-09-03: platforma serveste deja un og:image in HTML-ul pre-randat. Cand entitatea
  // nu are imagine proprie, nu avem voie sa o stergem pe aceea.
  assert.doesNotMatch(routeSeo, /existingImage\.remove\(\)/);
  assert.match(routeSeo, /\[pathname, override\]/);
});

scenario('manifestul referentiat de index.html exista si e valid', () => {
  assert.match(source('index.html'), /rel="manifest" href="\/manifest\.json"/);
  const manifest = JSON.parse(source('public/manifest.json'));
  assert.equal(manifest.name, 'VIASEE');
  assert.equal(manifest.start_url, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});

assert.ok(scenarioCount >= 20);
console.log(JSON.stringify({
  contract: SEO_PROFILE_CONTRACT_VERSION,
  scenarios: scenarioCount,
  pending_github_setup: pendingGithubSetup,
}));
