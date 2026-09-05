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

/**
 * Interogarea structurata pentru geocoder. Structurata, nu text liber: campurile separate dau
 * rezultate mult mai stabile decat un sir concatenat, iar cand esueaza esueaza curat.
 *
 * @returns {{street: string, city: string, county: string, country: string} | null}
 */
export function geocodeQueryForLocation(location = {}) {
  const city = clean(location.city || location.locality_name);
  if (!city) return null;
  const street = clean(location.address)
    // Adresa noastra repeta de obicei orasul la final ("Str. X nr. 2, Focsani"). Repetat si in
    // campul `city`, geocoderul il trateaza ca pe o a doua localitate si nu mai gaseste nimic.
    .replace(new RegExp(`[,\\s]+${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
    .replace(/^\s*[,;]\s*/, '')
    .trim();
  return {
    street,
    city,
    county: clean(location.county || location.county_name),
    country: 'Romania',
  };
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
export function geocodeUpdatePayload({ lat, lng, address, source = 'openstreetmap_nominatim', at = null }) {
  return {
    lat,
    lng,
    map_precision: 'approximate',
    geocode_source: source,
    geocoded_address: clean(address),
    geocoded_at: at || new Date().toISOString(),
  };
}

export default {
  ADDRESS_GEOCODING_CONTRACT_VERSION,
  ROMANIA_BOUNDS,
  normalizeGeoName,
  geocodeQueryForLocation,
  fallbackQueryForLocation,
  acceptGeocodeResult,
  pickGeocodeResult,
  geocodePlanForLocation,
  geocodeUpdatePayload,
};
