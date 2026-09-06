// Geocodarea adreselor publice: partea pura, fara retea.
//
// 2026-09-05. Niciuna dintre locatiile publicate nu avea coordonate. Importul national aduce
// adresa, judetul si codul SIRUTA, dar nu si pozitia, iar harta rezultatelor nu avea ce desena.
//
// Ce facem: derivam pozitia din adresa PUBLICA pe care o afisam deja. Nu este o adresa inventata
// si nici o afirmatie noua despre furnizor - este aceeasi informatie, desenata. De aceea
// rezultatul este marcat intotdeauna `map_precision: 'approximate'`: spune "pe aici", nu
// "exact aici". O pozitie 'exact' poate veni numai de la furnizorul care isi administreaza
// profilul.
//
// Ce NU facem, si de ce contine fisierul asta atatea refuzuri:
//
//   - nu acceptam un raspuns doar pentru ca serviciul a raspuns. Un geocoder intoarce mereu
//     ceva; treaba noastra este sa respingem ce nu se potriveste. Un rezultat in afara
//     Romaniei, sau intr-un alt judet decat cel din date, este o eroare, nu o aproximare;
//   - nu cadem inapoi pe centrul tarii sau al judetului cand adresa nu se rezolva. Un pin
//     plasat "undeva" este mai rau decat lipsa unui pin: pacientul l-ar crede real;
//   - nu suprascriem o pozitie confirmata de furnizor.
//
// Logica de aici este pura ca sa poata fi verificata fara retea (scripts/verify-address-geocoding.mjs).
// Partea cu apeluri traieste in scripts/geocode-published-locations.mjs.

export const ADDRESS_GEOCODING_CONTRACT_VERSION = 'address-geocoding-v1';

// Dreptunghiul care cuprinde Romania, cu o marja mica. Orice pozitie in afara lui este sigur
// gresita pentru o locatie din datele noastre, indiferent cat de increzator suna raspunsul.
export const ROMANIA_BOUNDS = Object.freeze({
  south: 43.5,
  north: 48.4,
  west: 20.1,
  east: 29.8,
});

// Judetele, cu numele normalizat, ca sa putem compara raspunsul geocoderului cu judetul din
// datele noastre. Numele din raspuns vine cu diacritice si cu sufixul "County" sau "Județul".
const COUNTY_ALIASES = Object.freeze({
  bucuresti: ['bucuresti', 'municipiul bucuresti', 'bucharest'],
  ilfov: ['ilfov'],
});

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/**
 * Normalizeaza un nume geografic pentru comparatie: fara diacritice, fara cuvinte de umplutura
 * ("judetul", "county", "municipiul"), litere mici.
 */
export function normalizeGeoName(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șț]/g, (character) => (character === 'ș' ? 's' : 't'))
    .toLowerCase()
    .replace(/\b(judetul|judet|county|municipiul|municipiu|orasul|oras|comuna|satul|sat)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Abrevierile romanesti de adresa, in forma pe care o intelege un geocoder. "Bd." si "Str." nu
// sunt recunoscute; "Bulevardul" si "Strada" da. Masurat pe adrese reale din director:
// 4 din 6 nimereau strada inainte, 6 din 6 dupa.
const STREET_ABBREVIATIONS = Object.freeze([
  [/(?<=^|[\s,])b-?dul\.?(?=\s|$)/gi, 'Bulevardul'],
  [/(?<=^|[\s,])bd\.?(?=\s|$)/gi, 'Bulevardul'],
  [/(?<=^|[\s,])str\.?(?=\s|$)/gi, 'Strada'],
  [/(?<=^|[\s,])cal\.?(?=\s|$)/gi, 'Calea'],
  [/(?<=^|[\s,])[sș]os\.?(?=\s|$)/gi, 'Soseaua'],
  [/(?<=^|[\s,])p-?[tț]a\.?(?=\s|$)/gi, 'Piata'],
  [/(?<=^|[\s,])al\.?(?=\s)/gi, 'Aleea'],
  [/(?<=^|[\s,])intr\.?(?=\s|$)/gi, 'Intrarea'],
]);

// Ce urmeaza dupa numarul postal nu ajuta la gasirea strazii si de obicei o strica: blocul,
// scara, etajul, apartamentul, "parter comercial", numele centrului comercial.
const AFTER_NUMBER_NOISE = /\b(bl|bloc|sc|scara|et|etaj|ap|apartament|parter|demisol|mezanin|corp|tronson|spatiul|spa[tț]iul|incinta|complex)\b/i;

/**
 * Interogarea structurata pentru geocoder. Structurata, nu text liber: campurile separate dau
 * rezultate mult mai stabile decat un sir concatenat, iar cand esueaza esueaza curat.
 *
 * Campul `street` se trimite in forma "<numar> <nume strada>", pentru ca asta asteapta
 * interogarea structurata - nu forma in care scriem noi adresa pentru oameni
 * ("Str. Tabacari nr. 6, bl. 4, parter comercial").
 *
 * @returns {{street: string, city: string, county: string, country: string} | null}
 */
export function geocodeQueryForLocation(location = {}) {
  const city = clean(location.city || location.locality_name);
  if (!city) return null;

  const county = clean(location.county || location.county_name);
  let raw = clean(location.address);

  // Adresa noastra repeta de obicei localitatea (si uneori judetul) la final. Repetate si in
  // campurile lor proprii, geocoderul le trateaza ca pe o a doua localitate si nu mai gaseste
  // nimic.
  for (const tail of [city, county]) {
    if (!tail) continue;
    raw = raw.replace(new RegExp(`[,\\s]+${tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '');
  }
  raw = raw.replace(/^\s*[,;]\s*/, '').trim();
  if (!raw) return { street: '', city, county, country: 'Romania' };

  // Numarul postal poate sta oriunde in text; il luam inainte sa taiem segmentele.
  // Intervalele ("nr. 64-68", "182-184") sunt frecvente la cladirile mari: pastram primul numar
  // si aruncam restul intervalului. Lasat intreg, geocoderul nu gaseste nimic si cade pe oras.
  const NUMBER_RANGE = /(\d+[A-Za-z]?)(?:\s*[-–—/]\s*\d+[A-Za-z]?)?/;
  const numberMatch = raw.match(new RegExp(`\\bnr\\.?\\s*${NUMBER_RANGE.source}`, 'i'));

  // Pastram doar segmentele de dinaintea zgomotului de dupa numar.
  const segments = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const kept = [];
  for (const segment of segments) {
    if (AFTER_NUMBER_NOISE.test(segment)) break;
    kept.push(segment);
    // Numele strazii este in primul segment; restul sunt aproape mereu detalii de cladire.
    if (kept.length >= 1 && /\d/.test(segment)) break;
  }

  let name = kept.join(' ');
  for (const [pattern, expansion] of STREET_ABBREVIATIONS) name = name.replace(pattern, expansion);
  name = name
    .replace(new RegExp(`\\bnr\\.?\\s*${NUMBER_RANGE.source}`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s.\-–—]+$/, '')
    .trim();

  let number = numberMatch ? numberMatch[1] : '';
  if (!number) {
    // Fara "nr.", numarul sta de obicei la finalul numelui ("Calea Aradului 12"). Il mutam in
    // fata, dar il si scoatem din nume - altfel ar aparea de doua ori.
    const trailing = name.match(new RegExp(`\\s${NUMBER_RANGE.source}\\s*$`));
    if (trailing) {
      number = trailing[1];
      name = name.slice(0, trailing.index).trim();
    }
  }
  const street = number ? `${number} ${name}`.trim() : name;

  return { street, city, county, country: 'Romania' };
}

/**
 * O interogare de rezerva, cu o treapta mai putina precizie: doar localitatea si judetul.
 * Se foloseste numai dupa ce cea cu strada a esuat, si rezultatul ramane tot aproximativ.
 * Nu coboara mai jos de localitate - un pin la nivel de judet nu ajuta pe nimeni.
 */
export function fallbackQueryForLocation(location = {}) {
  const query = geocodeQueryForLocation(location);
  if (!query) return null;
  if (!query.street) return null;
  return { ...query, street: '' };
}

/**
 * Verifica daca un rezultat de geocodare poate fi acceptat pentru locatia noastra.
 *
 * @returns {{accepted: boolean, reason: string, lat?: number, lng?: number}}
 */
export function acceptGeocodeResult(result, location = {}) {
  if (!result) return { accepted: false, reason: 'no_result' };

  const lat = Number(result.lat);
  const lng = Number(result.lon ?? result.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { accepted: false, reason: 'invalid_coordinates' };
  }
  if (lat === 0 && lng === 0) return { accepted: false, reason: 'null_island' };
  if (
    lat < ROMANIA_BOUNDS.south || lat > ROMANIA_BOUNDS.north
    || lng < ROMANIA_BOUNDS.west || lng > ROMANIA_BOUNDS.east
  ) {
    return { accepted: false, reason: 'outside_romania' };
  }

  const address = result.address || {};
  const country = normalizeGeoName(address.country_code || address.country);
  if (country && !['ro', 'romania'].includes(country)) {
    return { accepted: false, reason: 'wrong_country' };
  }

  // Judetul din raspuns trebuie sa se potriveasca cu cel din datele noastre. Cand raspunsul nu
  // declara judetul, nu blocam: dreptunghiul Romaniei a fost deja verificat, iar SIRUTA ramane
  // sursa canonica pentru apartenenta administrativa.
  const expectedCounty = normalizeGeoName(location.county || location.county_name);
  const resultCounty = normalizeGeoName(address.county || address.state);
  if (expectedCounty && resultCounty) {
    const aliases = COUNTY_ALIASES[expectedCounty] || [expectedCounty];
    const matches = aliases.some((alias) => resultCounty.includes(alias) || alias.includes(resultCounty));
    if (!matches) return { accepted: false, reason: 'county_mismatch' };
  }

  return { accepted: true, reason: 'accepted', lat, lng };
}

/**
 * Alege primul rezultat acceptabil dintr-o lista. Nu "cel mai bun scor": geocoderul isi
 * ordoneaza deja rezultatele, iar noi doar filtram ce nu se potriveste cu datele noastre.
 */
export function pickGeocodeResult(results, location = {}) {
  const list = Array.isArray(results) ? results : [];
  let lastReason = 'no_result';
  for (const candidate of list) {
    const verdict = acceptGeocodeResult(candidate, location);
    if (verdict.accepted) return verdict;
    lastReason = verdict.reason;
  }
  return { accepted: false, reason: lastReason };
}

/**
 * Decide daca o locatie are nevoie de geocodare.
 *
 * Regulile, in ordine:
 *   - fara adresa si fara oras nu avem din ce deriva o pozitie;
 *   - o pozitie confirmata de furnizor ('exact') nu se atinge niciodata;
 *   - o pozitie aproximativa existenta se recalculeaza doar daca adresa s-a schimbat de atunci.
 */
export function geocodePlanForLocation(location = {}) {
  const query = geocodeQueryForLocation(location);
  if (!query) return { action: 'skip', reason: 'missing_address' };

  const hasCoordinates = Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
  const precision = clean(location.map_precision);

  if (hasCoordinates && precision === 'exact') {
    return { action: 'skip', reason: 'owner_confirmed_position' };
  }
  if (hasCoordinates && precision === 'approximate') {
    // Vezi base44/shared/addressGeocoding.js: o pozitie la nivel de localitate este centrul
    // orasului, nu o adresa geocodata, deci se mai incearca de fiecare data adresa exacta.
    if (clean(location.geocode_source).endsWith(LOCALITY_SOURCE_SUFFIX) && query.street) {
      return { action: 'geocode', reason: 'locality_only_position', query };
    }
    const previous = clean(location.geocoded_address);
    if (previous && previous === clean(location.address)) {
      return { action: 'skip', reason: 'already_geocoded' };
    }
    return { action: 'geocode', reason: 'address_changed', query };
  }
  return { action: 'geocode', reason: 'missing_position', query };
}

/**
 * Campurile scrise inapoi pe locatie dupa o geocodare reusita. Sunt putine si explicite:
 * pozitia, faptul ca este aproximativa, sursa (OpenStreetMap cere atributie) si adresa din care
 * a fost derivata, ca sa stim cand devine invalida.
 */
export const LOCALITY_SOURCE_SUFFIX = '_locality';

export function geocodeUpdatePayload({ lat, lng, address, source = 'openstreetmap_nominatim', granularity = 'street', at = null }) {
  return {
    lat,
    lng,
    map_precision: 'approximate',
    geocode_source: granularity === 'locality' ? `${source}${LOCALITY_SOURCE_SUFFIX}` : source,
    geocoded_address: clean(address),
    geocoded_at: at || new Date().toISOString(),
  };
}

export default {
  ADDRESS_GEOCODING_CONTRACT_VERSION,
  ROMANIA_BOUNDS,
  LOCALITY_SOURCE_SUFFIX,
  normalizeGeoName,
  geocodeQueryForLocation,
  fallbackQueryForLocation,
  acceptGeocodeResult,
  pickGeocodeResult,
  geocodePlanForLocation,
  geocodeUpdatePayload,
};