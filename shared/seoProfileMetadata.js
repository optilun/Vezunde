// Metadatele si datele structurate pentru paginile publice de profil.
//
// 2026-09-03. Auditul SEO a gasit ca toate cele 500+ profiluri publice primeau acelasi
// title si aceeasi description - literal "Profil locație | VIASEE" - pentru ca RouteSeo
// era o harta statica de la pathname la meta, incompatibila prin design cu continut per
// entitate. Pentru Google asta e semnal de continut duplicat la scara de sute de pagini,
// exact scenariul in care indexul pastreaza cateva si arunca restul in "Crawled - currently
// not indexed".
//
// Al doilea gol: `buildStructuredData` returna null pentru orice ruta care nu era home,
// despre sau un ghid. Deci zero JSON-LD pe profiluri, desi backendul intoarce deja adresa,
// coordonate, telefon, program si servicii. Pentru un director local asta e cea mai
// valoroasa piesa lipsa.
//
// Fisierul asta contine doar transformari pure, ca sa poata fi testate direct. Efectele
// (scrierea in document.head) raman in src/components/seo/RouteSeo.jsx.
//
// Nimic nu se inventeaza: fiecare camp emis vine din raspunsul public al backendului. Ce
// lipseste din date lipseste si din JSON-LD.

export const SEO_PROFILE_CONTRACT_VERSION = 'seo-profile-metadata-v1';

export const SITE_URL = 'https://viasee.ro';

// Etichetele tipurilor de furnizor, asa cum le vede pacientul in title.
const PROVIDER_TYPE_LABELS = Object.freeze({
  optica_medicala: 'Optică medicală',
  clinica_oftalmologica: 'Clinică oftalmologică',
  cabinet_oftalmologic: 'Cabinet oftalmologic',
  cabinet_optometric: 'Cabinet optometric',
  laborator_optic: 'Laborator optic',
  optometrist_independent: 'Optometrist',
  medic_oftalmolog_independent: 'Medic oftalmolog',
});

// Tipul schema.org cel mai apropiat de realitate. Nu fortam "MedicalClinic" peste o optica
// si nu fortam "Optician" peste un cabinet medical: un tip gresit e mai rau decat unul
// generic, pentru ca declara lui Google ceva ce nu se sustine pe pagina.
const SCHEMA_TYPE_BY_PROVIDER_TYPE = Object.freeze({
  optica_medicala: 'Optician',
  clinica_oftalmologica: 'MedicalClinic',
  cabinet_oftalmologic: 'MedicalClinic',
  cabinet_optometric: 'MedicalBusiness',
  laborator_optic: 'LocalBusiness',
  optometrist_independent: 'MedicalBusiness',
  medic_oftalmolog_independent: 'Physician',
});

const SCHEMA_DAY_BY_KEY = Object.freeze({
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
});

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

function clean(value, maxLength = 300) {
  return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

export function providerTypeLabel(providerType) {
  return PROVIDER_TYPE_LABELS[clean(providerType, 60)] || 'Furnizor de servicii pentru vedere';
}

export function providerSchemaType(providerType) {
  return SCHEMA_TYPE_BY_PROVIDER_TYPE[clean(providerType, 60)] || 'LocalBusiness';
}

// Titlul trebuie sa fie unic si sa contina ce cauta oamenii: numele si orasul.
// "Lensa Sibiu - Optică medicală în Sibiu | VIASEE" rankuieste pe "optica Sibiu";
// "Profil locație | VIASEE" nu rankuieste pe nimic.
export function buildProviderProfileTitle(profile) {
  const name = clean(profile?.name, 90);
  if (!name) return 'Profil locație | VIASEE';
  const label = providerTypeLabel(profile?.provider_type);
  const city = clean(profile?.city, 60);
  const middle = city ? `${label} în ${city}` : label;
  return `${name} — ${middle} | VIASEE`;
}

export function buildProviderProfileDescription(profile) {
  const name = clean(profile?.name, 90);
  if (!name) return '';
  const label = providerTypeLabel(profile?.provider_type).toLocaleLowerCase('ro-RO');
  const place = [clean(profile?.city, 60), clean(profile?.county, 60)].filter(Boolean).join(', ');
  const parts = [place ? `${name} — ${label} în ${place}.` : `${name} — ${label}.`];

  const address = clean(profile?.address, 160);
  if (address) parts.push(`Adresă: ${address}.`);

  const services = (Array.isArray(profile?.services) ? profile.services : [])
    .map((service) => clean(service?.label || service?.name || service?.service_key, 60))
    .filter(Boolean);
  if (services.length > 0) {
    const shown = services.slice(0, 3).join(', ');
    parts.push(services.length > 3 ? `Servicii: ${shown} și altele.` : `Servicii: ${shown}.`);
  }

  parts.push('Informații publice pe VIASEE.');
  return clean(parts.join(' '), 300);
}

export function buildProfessionalProfileTitle(professional) {
  const name = clean(professional?.full_name || professional?.name, 90);
  if (!name) return 'Profil specialist | VIASEE';
  const role = clean(professional?.professional_type_label || professional?.professional_type, 60);
  return role ? `${name} — ${role} | VIASEE` : `${name} | VIASEE`;
}

export function buildOrganizationProfileTitle(organization) {
  const name = clean(organization?.name, 90);
  if (!name) return 'Profil organizație | VIASEE';
  return `${name} — locații în România | VIASEE`;
}

// Programul: doar intervalele explicite si valide. Un "09:00 - " incomplet nu devine
// openingHoursSpecification, pentru ca ar declara lui Google un program pe care nu il avem.
export function buildOpeningHoursSpecification(openingHoursJson) {
  if (!openingHoursJson) return [];
  let parsed = openingHoursJson;
  if (typeof openingHoursJson === 'string') {
    try {
      parsed = JSON.parse(openingHoursJson);
    } catch (_error) {
      return [];
    }
  }
  const weekly = parsed?.weekly;
  if (!weekly || typeof weekly !== 'object') return [];

  const specification = [];
  for (const [key, schemaDay] of Object.entries(SCHEMA_DAY_BY_KEY)) {
    const value = weekly[key];
    if (!value || value.open !== true) continue;
    const opens = clean(value.from, 10);
    const closes = clean(value.to, 10);
    if (!TIME_PATTERN.test(opens) || !TIME_PATTERN.test(closes)) continue;
    specification.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${schemaDay}`,
      opens,
      closes,
    });
  }
  return specification;
}

function buildPostalAddress(profile) {
  const address = compact({
    '@type': 'PostalAddress',
    streetAddress: clean(profile?.address, 160) || undefined,
    addressLocality: clean(profile?.city, 60) || undefined,
    addressRegion: clean(profile?.county, 60) || undefined,
    addressCountry: 'RO',
  });
  // Fara nicio componenta reala de adresa, ramane doar tara - inutil si inselator.
  return Object.keys(address).length > 2 ? address : null;
}

function buildGeo(profile) {
  const lat = Number(profile?.lat);
  const lng = Number(profile?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Cand pozitia e doar aproximata din adresa, nu o declaram ca si coordonate exacte.
  if (clean(profile?.map_precision, 20) === 'approximate') return null;
  return { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
}

function buildOfferCatalog(profile) {
  const services = (Array.isArray(profile?.services) ? profile.services : [])
    .map((service) => clean(service?.label || service?.name || service?.service_key, 80))
    .filter(Boolean);
  if (services.length === 0) return null;
  return {
    '@type': 'OfferCatalog',
    name: 'Servicii disponibile',
    itemListElement: services.slice(0, 30).map((name) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name },
    })),
  };
}

export function profileImageUrl(profile) {
  const candidate = clean(profile?.photo_url || profile?.organization_logo_url, 500);
  return /^https?:\/\//i.test(candidate) ? candidate : '';
}

/**
 * Datele structurate pentru o pagina de locatie publica.
 * @param {{ profile: any, canonical: string, organizationId?: string, websiteId?: string }} input
 */
export function buildProviderProfileStructuredData(input = {}) {
  const profile = input.profile;
  const canonical = clean(input.canonical, 500);
  if (!profile || !clean(profile.name, 90) || !canonical) return null;

  const address = buildPostalAddress(profile);
  const geo = buildGeo(profile);
  const hours = buildOpeningHoursSpecification(profile.opening_hours_json);
  const image = profileImageUrl(profile);
  const catalog = buildOfferCatalog(profile);

  const business = compact({
    '@type': providerSchemaType(profile.provider_type),
    '@id': `${canonical}#business`,
    name: clean(profile.name, 120),
    url: canonical,
    description: clean(profile.description, 300) || undefined,
    telephone: clean(profile.phone_public, 40) || undefined,
    email: clean(profile.public_email, 120) || undefined,
    image: image || undefined,
    address: address || undefined,
    geo: geo || undefined,
    openingHoursSpecification: hours,
    hasOfferCatalog: catalog || undefined,
    sameAs: [profile.website, profile.facebook, profile.instagram, profile.linkedin]
      .map((value) => clean(value, 300))
      .filter((value) => /^https?:\/\//i.test(value)),
    areaServed: clean(profile.city, 60) || undefined,
    parentOrganization: profile.organization_id && clean(profile.organization_name, 120)
      ? { '@type': 'Organization', name: clean(profile.organization_name, 120) }
      : undefined,
  });

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VIASEE', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Caută furnizori', item: `${SITE_URL}/cauta` },
      { '@type': 'ListItem', position: 3, name: clean(profile.name, 120), item: canonical },
    ],
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [business, breadcrumb],
  };
}

/**
 * Datele structurate pentru o pagina de specialist public.
 */
export function buildProfessionalProfileStructuredData(input = {}) {
  const professional = input.professional;
  const canonical = clean(input.canonical, 500);
  const name = clean(professional?.full_name || professional?.name, 120);
  if (!name || !canonical) return null;

  const person = compact({
    '@type': 'Person',
    '@id': `${canonical}#person`,
    name,
    url: canonical,
    jobTitle: clean(professional?.professional_type_label || professional?.professional_type, 80) || undefined,
    description: clean(professional?.bio, 300) || undefined,
    image: /^https?:\/\//i.test(clean(professional?.profile_photo_url, 500))
      ? clean(professional.profile_photo_url, 500)
      : undefined,
    knowsAbout: (Array.isArray(professional?.specialization_labels) ? professional.specialization_labels : [])
      .map((value) => clean(value, 80))
      .filter(Boolean)
      .slice(0, 12),
  });

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VIASEE', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Specialiști', item: `${SITE_URL}/pentru-specialisti` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [person, breadcrumb],
  };
}
