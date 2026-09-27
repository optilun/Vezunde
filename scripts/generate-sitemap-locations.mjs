// Genereaza public/sitemap-locatii.xml din locatiile publicate.
//
// 2026-09-03, audit SEO. Sitemap-ul commis are 29 de URL-uri statice; cele 500+ locatii
// publicate nu apar nicaieri si nu exista drum de crawl catre ele (vezi comentariul din
// shared/sitemapXml.js). Importul national publica loturi la fiecare 5 minute, deci un
// fisier scris o data de mana ar fi vechi imediat - de aceea generator, nu snapshot.
//
// 2026-09-27. Versiunea initiala citea ProviderLocation cu o cheie API (BASE44_API_KEY) prin
// `createClient({ appId, apiKey })`. Nu putea functiona: SDK-ul nu are optiunea `apiKey`, iar
// `asServiceRole` arunca fara serviceToken. Acum citeste lista publica din
// browseDirectoryProviders (`map_scope: 'sitemap'`): aceleasi profiluri pe care site-ul le arata
// oricui, fara nicio cheie in GitHub.
//
// Rulare:
//   BASE44_APP_ID=... node scripts/generate-sitemap-locations.mjs
//
// Daca lista nu poate fi citita sau e goala, nu scrie nimic si iese cu 1: un sitemap gol ar
// sterge din index ce e deja acolo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITEMAP_SITE_URL,
  buildLocationSitemapEntries,
  buildProfileSitemapEntries,
  buildUrlsetXml,
} from '../shared/sitemapXml.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(root, 'public', 'sitemap-locatii.xml');
// 2026-09-27: organizatii (lanturi catre care site-ul trimite deja) si specialisti publici.
const PROFILES_OUTPUT = path.join(root, 'public', 'sitemap-profiluri.xml');
const REQUEST_TIMEOUT_MS = 60_000;
const ATTEMPTS = 3;

const appId = process.env.BASE44_APP_ID;
const serverUrl = (process.env.BASE44_SERVER_URL || 'https://base44.app').replace(/\/+$/, '');
const siteUrl = process.env.VIASEE_SITE_URL || SITEMAP_SITE_URL;

if (!appId) {
  console.error('Lipseste BASE44_APP_ID. Nu se scrie nimic.');
  process.exit(1);
}

async function requestSitemapLocations() {
  const response = await fetch(`${serverUrl}/api/apps/${appId}/functions/browseDirectoryProviders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Id': String(appId) },
    body: JSON.stringify({ map_scope: 'sitemap' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body?.error || 'raspuns invalid'}`);
  if (body?.map_scope !== 'sitemap' || !Array.isArray(body.locations)) {
    throw new Error('Raspunsul nu contine lista pentru sitemap (functia publicata e inca versiunea veche?)');
  }
  return body;
}

async function loadPublishedLocations() {
  let lastError = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      return await requestSitemapLocations();
    } catch (error) {
      lastError = error;
      console.error(`Incercarea ${attempt}/${ATTEMPTS} a esuat: ${error.message}`);
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
    }
  }
  throw lastError;
}

let body;
let rows;
try {
  body = await loadPublishedLocations();
  rows = body.locations;
} catch (error) {
  console.error(`Lista de locatii nu a putut fi citita (${error.message}). Nu se suprascrie sitemap-ul existent.`);
  process.exit(1);
}

// Lista vine deja filtrata pe server (publicata, aprobata, nesuspendata, activa); campurile de
// stare sunt completate ca sa treaca prin aceeasi regula de eligibilitate ca orice alta sursa.
const locations = rows.map((row) => ({
  id: row?.id,
  status: 'publicata',
  public_visibility_status: 'approved',
  updated_date: row?.lastmod || '',
}));
const entries = buildLocationSitemapEntries(locations, { siteUrl });

if (entries.length === 0) {
  console.error(`Zero locatii eligibile din ${rows.length} primite. Nu se suprascrie sitemap-ul existent.`);
  process.exit(1);
}

function writeIfChanged(output, xml, count, label) {
  const previous = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  if (previous === xml) {
    console.log(`Neschimbat: ${count} ${label} in ${path.relative(root, output)}.`);
    return;
  }
  fs.writeFileSync(output, xml, 'utf8');
  console.log(`Scris ${count} ${label} in ${path.relative(root, output)} (inainte: ${previous ? 'existent' : 'inexistent'}).`);
}

writeIfChanged(OUTPUT, buildUrlsetXml(entries), entries.length, 'locatii');

// Profilurile nu blocheaza sitemap-ul de locatii. Daca lista lipseste (functie veche) sau serverul
// raporteaza o eroare, fisierul existent ramane neatins; un fisier gol nu se scrie niciodata.
if (body.profiles_error === true || !Array.isArray(body.organizations) || !Array.isArray(body.professionals)) {
  console.error('Lista de organizatii si specialisti lipseste sau e incompleta. sitemap-profiluri.xml ramane neschimbat.');
} else {
  const profileEntries = buildProfileSitemapEntries(body, { siteUrl });
  if (profileEntries.length === 0) {
    console.error('Zero organizatii si specialisti eligibili. sitemap-profiluri.xml ramane neschimbat.');
  } else {
    writeIfChanged(
      PROFILES_OUTPUT,
      buildUrlsetXml(profileEntries),
      profileEntries.length,
      `profiluri (${body.organizations.length} organizatii, ${body.professionals.length} specialisti)`,
    );
  }
}
