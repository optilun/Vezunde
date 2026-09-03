// Construirea sitemap-urilor, ca transformare pura.
//
// 2026-09-03, audit SEO. `public/sitemap.xml` are 29 de URL-uri, toate rute statice si
// ghiduri editoriale. Cele 500+ locatii publicate nu apar nicaieri, si nu exista niciun
// generator care sa le adauge. Nu e doar o omisiune de completat manual: singura cale prin
// care Google le-ar putea descoperi sunt linkurile din /cauta, care e `noindex,follow` si
// isi randeaza rezultatele abia dupa JS, fara paginare linkuita in HTML. Practic nu exista
// drum de crawl catre majoritatea profilurilor.
//
// Fisierul asta contine doar constructia XML si regula de eligibilitate, ca sa poata fi
// testate fara sa atinga reteaua. Preluarea datelor sta in scripts/generate-sitemap-locations.mjs.

export const SITEMAP_CONTRACT_VERSION = 'sitemap-locations-v1';

export const SITEMAP_SITE_URL = 'https://viasee.ro';

// Limita din protocolul sitemap: 50.000 URL-uri sau 50MB necomprimat per fisier. Directorul
// e departe de asta, dar daca ajunge acolo trebuie sa se sparga in mai multe fisiere, nu sa
// produca tacut un sitemap invalid.
export const SITEMAP_MAX_URLS = 45000;

function escapeXml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

// Aceleasi conditii ca gating-ul din getPublicProviderProfile: daca profilul ar da 404 la
// deschidere, nu are ce cauta in sitemap. Un sitemap plin de 404-uri (sau, mai rau aici, de
// soft 404-uri, pentru ca hostingul static raspunde 200) strica increderea in tot fisierul.
export function isLocationSitemapEligible(location) {
  if (!location || !location.id) return false;
  if (location.status !== 'publicata') return false;
  if (location.public_visibility_status !== 'approved') return false;
  if (location.profile_control_status === 'suspended') return false;
  if (location.active_status === 'inactiva') return false;
  return true;
}

export function locationSitemapUrl(locationId, siteUrl = SITEMAP_SITE_URL) {
  return `${siteUrl}/furnizor/${String(locationId || '').trim()}`;
}

/**
 * @param {Array<{ loc: string, lastmod?: string, changefreq?: string, priority?: string }>} entries
 */
export function buildUrlsetXml(entries) {
  const rows = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.loc);
  if (rows.length > SITEMAP_MAX_URLS) {
    throw new Error(`Sitemap prea mare: ${rows.length} URL-uri, maximul pe fisier este ${SITEMAP_MAX_URLS}`);
  }
  const body = rows.map((entry) => {
    const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
    const lastmod = isoDate(entry.lastmod);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority) lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + `${body}\n`
    + `</urlset>\n`;
}

export function buildLocationSitemapEntries(locations, options = {}) {
  const siteUrl = options.siteUrl || SITEMAP_SITE_URL;
  const seen = new Set();
  const entries = [];
  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isLocationSitemapEligible(location)) continue;
    const loc = locationSitemapUrl(location.id, siteUrl);
    if (seen.has(loc)) continue;
    seen.add(loc);
    entries.push({
      loc,
      lastmod: location.profile_updated_at || location.updated_date || location.created_date || '',
      changefreq: 'weekly',
      priority: '0.7',
    });
  }
  // Ordine stabila: acelasi set de locatii produce acelasi fisier, deci commit-ul zilnic
  // nu are diff cand nu s-a schimbat nimic real.
  return entries.sort((a, b) => a.loc.localeCompare(b.loc));
}

export function extractSitemapLocations(xml) {
  return [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()).filter(Boolean);
}
