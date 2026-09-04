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
import { readFileSync } from 'node:fs';
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

scenario('robots declara ambele sitemap-uri', () => {
  const robots = source('public/robots.txt');
  assert.match(robots, /^Sitemap: https:\/\/viasee\.ro\/sitemap\.xml$/m);
  assert.match(robots, /^Sitemap: https:\/\/viasee\.ro\/sitemap-locatii\.xml$/m);
});

scenario('IndexNow citeste si sitemap-ul de locatii', () => {
  const indexnow = source('scripts/indexnow-submit.mjs');
  assert.match(indexnow, /public\/sitemap-locatii\.xml/);
  assert.match(indexnow, /new Set\(/);
  const workflow = source('.github/workflows/indexnow.yml');
  assert.match(workflow, /public\/sitemap-locatii\.xml/);
});

scenario('generatorul refuza sa scrie fara chei sau fara rezultate', () => {
  const generator = source('scripts/generate-sitemap-locations.mjs');
  assert.match(generator, /if \(!appId \|\| !apiKey\)/);
  assert.match(generator, /Nu se suprascrie sitemap-ul existent/);
  assert.match(generator, /process\.exit\(1\)/);
  const workflow = source('.github/workflows/sitemap-locations.yml');
  assert.match(workflow, /generate-sitemap-locations\.mjs/);
  assert.match(workflow, /secrets\.BASE44_API_KEY/);
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
}));
