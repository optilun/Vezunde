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

// 2026-09-07. Cel mult trei incercari per locatie, si niciodata aceeasi interogare de doua ori.
//
// De ce: reincercarea la infinit a adreselor care nu se rezolva a fost masurata si nu aduce
// nimic - 30 de incercari pe Nominatim au rezolvat 6 adrese, restul cadeau iar pe centrul
// localitatii si reintrau in coada. O coada care nu se goleste niciodata nu este o coada de
// lucru, este o bucla. Dupa trei incercari locatia iese din coada si primeste un marcaj de
// verificare, ca sa se vada cate cazuri chiar au nevoie de alt geocoder sau de om.
export const MAX_GEOCODE_ATTEMPTS = 3;

export const GEOCODE_REVIEW_STATUS = Object.freeze({
  NONE: 'none',
  NEEDS_FALLBACK: 'needs_geocoding_fallback',
  NEEDS_MANUAL: 'needs_manual_review',
});

// Cuvantul care spune tipul arterei. Il eliminam intr-o varianta pentru ca uneori tocmai el
// impiedica potrivirea: in OpenStreetMap aceeasi artera poate fi "Calea Aradului" sau doar
// "Aradului", iar interogarea structurata nu tolereaza diferenta.
const STREET_TYPE_WORD = /^(Strada|Bulevardul|Calea|Soseaua|Piata|Aleea|Intrarea|Splaiul|Drumul)\s+/i;

/**
 * Variantele controlate ale aceleiasi adrese, in ordinea in care se incearca. Sunt normalizari,
 * nu ghiceli: nu adaugam si nu schimbam nicio informatie despre locatie, doar scriem altfel ce
 * avem deja. Cand nu mai exista o varianta noua, lista se termina - si asta opreste coada.
 */
export function geocodeQueryVariantsForLocation(location = {}) {
  const base = geocodeQueryForLocation(location);
  if (!base) return [];
  if (!base.street) return [base];

  const variants = [base];

  // Varianta 2: fara cuvantul de tip al arterei ("12 Calea Aradului" -> "12 Aradului").
  // Numarul, cand exista, sta primul in interogarea structurata; il pastram pe loc.
  const numberPrefix = base.street.match(/^(\d+[A-Za-z]?)\s+/);
  const namePart = numberPrefix ? base.street.slice(numberPrefix[0].length) : base.street;
  const nameWithoutType = namePart.replace(STREET_TYPE_WORD, '').trim();
  if (nameWithoutType && nameWithoutType !== namePart) {
    variants.push({
      ...base,
      street: numberPrefix ? `${numberPrefix[1]} ${nameWithoutType}` : nameWithoutType,
    });
  }

  // Varianta 3: fara diacritice, in strada si in localitate. Datele importate le au inconsecvent.
  const stripped = {
    ...base,
    street: normalizeDiacritics(base.street),
    city: normalizeDiacritics(base.city),
  };
  if (stripped.street !== base.street || stripped.city !== base.city) variants.push(stripped);

  return variants.slice(0, MAX_GEOCODE_ATTEMPTS);
}

export function normalizeDiacritics(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T');
}

/** Semnatura unei interogari, ca sa nu retrimitem identic ceva ce a esuat deja. */
export function geocodeQuerySignature(query) {
  if (!query) return '';
  return [query.street, query.city, query.county].map((part) => normalizeDiacritics(part).toLowerCase()).join('|');
}

/**
 * Cat de completa este adresa publica a locatiei. Separa cazurile "geocoderul nu a gasit o adresa
 * buna" de "nu avem ce sa caute" - primele merita alt geocoder, celelalte merita un om.
 */
export function addressCompletenessForLocation(location = {}) {
  const query = geocodeQueryForLocation(location);
  if (!query) return 'missing';
  if (!query.street) return 'locality_only';
  return /\d/.test(query.street) ? 'street_and_number' : 'street_without_number';
}

/**
 * Decide daca o locatie are nevoie de geocodare.
 *
 * Regulile, in ordine:
 *   - fara adresa si fara oras nu avem din ce deriva o pozitie;
 *   - o pozitie confirmata de furnizor ('exact') nu se atinge niciodata;
 *   - dupa MAX_GEOCODE_ATTEMPTS incercari locatia iese din coada;
 *   - nu se retrimite o interogare identica cu ultima deja incercata;
 *   - o pozitie aproximativa existenta se recalculeaza doar daca adresa s-a schimbat de atunci.
 */
export function geocodePlanForLocation(location = {}) {
  const attempts = Math.max(0, Math.floor(Number(location.geocode_attempt_count) || 0));
  const variants = geocodeQueryVariantsForLocation(location);
  const query = variants[attempts] || null;

  if (variants.length === 0) return { action: 'skip', reason: 'missing_address' };
  if (attempts >= MAX_GEOCODE_ATTEMPTS) return { action: 'skip', reason: 'attempt_limit_reached' };
  if (!query) return { action: 'skip', reason: 'no_new_query_variant' };
  if (geocodeQuerySignature(query) === clean(location.geocode_attempt_signature)) {
    return { action: 'skip', reason: 'query_already_tried' };
  }

  const hasCoordinates = Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
  const precision = clean(location.map_precision);

  if (hasCoordinates && precision === 'exact') {
    return { action: 'skip', reason: 'owner_confirmed_position' };
  }
  if (hasCoordinates && precision === 'approximate') {
    // 2026-09-06. O pozitie obtinuta prin caderea la nivel de localitate NU este o adresa
    // geocodata: este centrul localitatii, identic pentru toate locatiile din acel oras care au
    // ajuns pe aceeasi cale. Masurat in producţie: 274 din 948 locatii publicate stateau in 79
    // de grupuri cu coordonate identice (43 intr-un singur punct in Bucuresti), iar harta le
    // unea corect intr-un singur pin - datele erau cele suprapuse, nu harta.
    //
    // De aceea o astfel de pozitie nu se considera niciodata "gata": la fiecare rulare se mai
    // incearca o data adresa exacta. Daca strada se rezolva, pozitia devine reala; daca nu,
    // ramane ce era si se reincearca alta data. Nu pierdem nimic, si nu inventam nimic.
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
    // Granularitatea se scrie in sursa, nu se pierde. 'street' este o adresa rezolvata;
    // '_locality' spune raspicat ca este centrul localitatii, deci o pozitie care mai trebuie
    // incercata. Fara aceasta distinctie, o cadere la nivel de oras arata in date exact ca o
    // adresa gasita - si asa au ajuns zeci de locatii sa imparta acelasi punct fara sa se vada.
    geocode_source: granularity === 'locality' ? `${source}${LOCALITY_SOURCE_SUFFIX}` : source,
    geocoded_address: clean(address),
    geocoded_at: at || new Date().toISOString(),
  };
}

/**
 * Campurile scrise dupa o incercare care NU a dat o adresa exacta. Nu ating adresa si nu ating
 * coordonatele: numara incercarea, retin ce s-a interogat si, la ultima incercare, pun marcajul
 * de verificare. `needs_geocoding_fallback` inseamna "adresa e buna, geocoderul nu o gaseste" -
 * exact cazurile pentru un al doilea geocoder. `needs_manual_review` inseamna ca adresa in sine
 * nu are strada sau numar, deci niciun geocoder nu ar avea ce sa caute.
 */
export function geocodeAttemptPayload(location = {}, query = null) {
  const attempts = Math.max(0, Math.floor(Number(location.geocode_attempt_count) || 0)) + 1;
  const completeness = addressCompletenessForLocation(location);
  const exhausted = attempts >= MAX_GEOCODE_ATTEMPTS
    || attempts >= geocodeQueryVariantsForLocation(location).length;

  return {
    geocode_attempt_count: attempts,
    geocode_attempt_signature: geocodeQuerySignature(query),
    geocode_review_status: !exhausted
      ? GEOCODE_REVIEW_STATUS.NONE
      : completeness === 'street_and_number'
        ? GEOCODE_REVIEW_STATUS.NEEDS_FALLBACK
        : GEOCODE_REVIEW_STATUS.NEEDS_MANUAL,
  };
}

export default {
  ADDRESS_GEOCODING_CONTRACT_VERSION,
  ROMANIA_BOUNDS,
  LOCALITY_SOURCE_SUFFIX,
  MAX_GEOCODE_ATTEMPTS,
  GEOCODE_REVIEW_STATUS,
  geocodeQueryVariantsForLocation,
  geocodeQuerySignature,
  addressCompletenessForLocation,
  geocodeAttemptPayload,
  normalizeGeoName,
  geocodeQueryForLocation,
  fallbackQueryForLocation,
  acceptGeocodeResult,
  pickGeocodeResult,
  geocodePlanForLocation,
  geocodeUpdatePayload,
};