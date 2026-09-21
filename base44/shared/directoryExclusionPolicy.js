// Firme pe care administratorul VIASEE a decis sa nu le listeze in director.
//
// De ce exista: registrul national din care importam le contine in continuare. Daca datele lor
// sunt sterse din aplicatie, urmatorul import (automat sau campania nationala) le-ar crea din nou.
// Selectia de import le sare si noteaza motivul `excluded_by_admin`, vizibil in rezumatul rularii.
//
// Potrivirea e intentionat stricta, ca sa nu prinda alte firme din greseala:
// - domeniul site-ului sau al emailului (ex. 9optik.ro, inclusiv subdomenii), sau
// - numele organizatiei, normalizat, egal cu cel din lista, sau numele locatiei care incepe cu el
//   ("9Optik Promenada Sibiu").
//
// Pentru a scoate o firma de pe lista: se sterge intrarea de aici si se publica aplicatia.

export const EXCLUDED_DIRECTORY_ORGANIZATIONS = [
  {
    key: '9optik',
    names: ['9optik'],
    domains: ['9optik.ro'],
    reason: 'Exclus din director la cererea administratorului (2026-09-21).',
  },
];

const NAME_FIELDS_ORGANIZATION = ['organization_display_name', 'organization_name', 'organization_legal_name'];
const NAME_FIELDS_LOCATION = ['location_display_name', 'location_name', 'name', 'public_display_name'];
const URL_FIELDS = ['official_source_url', 'website', 'official_website', 'organization_website', 'source_url'];
const EMAIL_FIELDS = ['confirmed_location_email', 'public_email', 'email', 'location_email', 'organization_email'];

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// Aceeasi normalizare ca normalizeIdentityText, fara spatii: "9 Optik" si "9Optik" se potrivesc.
export function normalizeExclusionName(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hostnameOf(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return '';
  try {
    const url = new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function emailDomainsOf(value) {
  return text(value)
    .toLowerCase()
    .split(/[\s/,;|]+/)
    .map((part) => part.split('@')[1] || '')
    .filter(Boolean);
}

function domainMatches(domain, excluded) {
  return domain === excluded || domain.endsWith(`.${excluded}`);
}

// Intoarce intrarea din lista care se potriveste randului, sau null.
export function matchDirectoryExclusion(row = {}) {
  const organizationNames = NAME_FIELDS_ORGANIZATION.map((field) => normalizeExclusionName(row[field])).filter(Boolean);
  const locationNames = NAME_FIELDS_LOCATION.map((field) => normalizeExclusionName(row[field])).filter(Boolean);
  const domains = [
    ...URL_FIELDS.map((field) => hostnameOf(row[field])),
    ...EMAIL_FIELDS.flatMap((field) => emailDomainsOf(row[field])),
  ].filter(Boolean);

  for (const entry of EXCLUDED_DIRECTORY_ORGANIZATIONS) {
    const names = entry.names.map(normalizeExclusionName);
    if (organizationNames.some((name) => names.includes(name))) return entry;
    if (locationNames.some((name) => names.some((excluded) => name.startsWith(excluded)))) return entry;
    if (domains.some((domain) => entry.domains.some((excluded) => domainMatches(domain, excluded)))) return entry;
  }
  return null;
}

export function directoryExclusionReason(row = {}) {
  return matchDirectoryExclusion(row) ? 'excluded_by_admin' : '';
}
