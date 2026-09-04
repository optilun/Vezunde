// Genereaza public/sitemap-locatii.xml din locatiile publicate.
//
// 2026-09-03, audit SEO. Sitemap-ul commis are 29 de URL-uri statice; cele 500+ locatii
// publicate nu apar nicaieri si nu exista drum de crawl catre ele (vezi comentariul din
// shared/sitemapXml.js). Importul national publica loturi la fiecare 5 minute, deci un
// fisier scris o data de mana ar fi vechi imediat - de aceea generator, nu snapshot.
//
// Rulare:
//   BASE44_APP_ID=... BASE44_API_KEY=... node scripts/generate-sitemap-locations.mjs
//
// Fara chei nu ruleaza si nu scrie nimic: nu are de unde sti ce e publicat, iar un sitemap
// gol ar sterge din index ce e deja acolo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@base44/sdk';
import {
  SITEMAP_SITE_URL,
  buildLocationSitemapEntries,
  buildUrlsetXml,
} from '../shared/sitemapXml.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(root, 'public', 'sitemap-locatii.xml');
const PAGE_SIZE = 500;
const MAX_PAGES = 200;

const appId = process.env.BASE44_APP_ID;
const apiKey = process.env.BASE44_API_KEY;
const siteUrl = process.env.VIASEE_SITE_URL || SITEMAP_SITE_URL;

if (!appId || !apiKey) {
  console.error('Lipsesc BASE44_APP_ID si/sau BASE44_API_KEY. Nu se scrie nimic.');
  process.exit(1);
}

const client = createClient({ appId, apiKey });
const entities = client.asServiceRole?.entities || client.entities;

async function loadPublishedLocations() {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await entities.ProviderLocation.filter(
      { status: 'publicata', public_visibility_status: 'approved' },
      'id',
      PAGE_SIZE,
      page * PAGE_SIZE,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

const locations = await loadPublishedLocations();
const entries = buildLocationSitemapEntries(locations, { siteUrl });

if (entries.length === 0) {
  console.error(`Zero locatii eligibile din ${locations.length} incarcate. Nu se suprascrie sitemap-ul existent.`);
  process.exit(1);
}

const xml = buildUrlsetXml(entries);
const previous = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';

if (previous === xml) {
  console.log(`Neschimbat: ${entries.length} locatii in ${path.relative(root, OUTPUT)}.`);
  process.exit(0);
}

fs.writeFileSync(OUTPUT, xml, 'utf8');
console.log(`Scris ${entries.length} locatii in ${path.relative(root, OUTPUT)} (inainte: ${previous ? 'existent' : 'inexistent'}).`);
