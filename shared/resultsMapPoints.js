// Punctele de pe harta rezultatelor, ca transformare pura.
//
// 2026-09-04. Ecranul de recomandari avea o coloana dreapta aproape goala ("Apasă pe o locație
// din listă ca să vezi detaliile aici"), iar pacientul nu putea vedea dintr-o privire unde sunt
// optiunile fata de el. Harta umple acel spatiu cu informatie reala.
//
// 2026-09-05, revizuit. Prima versiune refuza orice pozitie marcata `approximate`, pentru ca
// politica de vizibilitate taia atunci `lat`/`lng` pentru profilurile din director si singurele
// coordonate publice erau cele confirmate. Intre timp doua lucruri s-au schimbat:
//
//   - locatiile publicate au primit coordonate derivate din adresa lor publica, prin geocodare
//     OpenStreetMap (vezi scripts/geocode-published-locations.mjs). Adresa era deja publica,
//     deci coordonata nu adauga informatie noua - doar o deseneaza;
//   - politica de vizibilitate expune acum aceste coordonate, marcate `map_precision:
//     'approximate'`.
//
// Deci o pozitie aproximativa NU se mai refuza: se afiseaza si se declara ca atare. Regula care
// ramane neschimbata este ca nu inventam nimic aici - modelul asta nu geocodeaza, nu ghiceste si
// nu deduce o pozitie din numele orasului. Primeste ce a expus serverul si atat. Ce vine fara
// coordonate ramane numarat sub harta, nu ascuns: o harta care pare completa cand nu este face
// mai mult rau decat una care isi declara limitele.

export const RESULTS_MAP_CONTRACT_VERSION = 'results-map-points-v1';

// Centrul geografic aproximativ al Romaniei, folosit doar cand nu exista niciun punct real.
export const FALLBACK_CENTER = Object.freeze({ lat: 45.9432, lng: 24.9668 });
export const FALLBACK_ZOOM = 6;

const BUCKET_TIER = Object.freeze({
  top3: 'top3',
  extended_confirmed: 'confirmed',
  extended_directory: 'directory',
  structural_directory: 'directory',
});

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function coordinate(value, limit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < -limit || numeric > limit) return null;
  // Exact 0,0 este "Null Island": in practica inseamna camp necompletat, nu o locatie din
  // Golful Guineei. Un pin acolo ar strica si harta, si increderea.
  return numeric;
}

export function mapPointFromResult(result) {
  if (!result || !clean(result.id)) return null;
  const lat = coordinate(result.lat, 90);
  const lng = coordinate(result.lng, 180);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;

  // Precizia calatoreste cu punctul, ca interfata sa poata desena diferenta. Necunoscuta se
  // trateaza ca aproximativa: mai bine promitem mai putin decat sa afirmam o exactitate
  // pe care nu o avem.
  const precision = clean(result.map_precision) === 'exact' ? 'exact' : 'approximate';

  return {
    id: clean(result.id),
    name: clean(result.name) || 'Locație',
    city: clean(result.city),
    lat,
    lng,
    provider_type: clean(result.provider_type),
    profile_control_status: clean(result.profile_control_status) || 'directory',
    address: clean(result.address),
    map_precision: precision,
    result_bucket: clean(result.result_bucket),
    tier: BUCKET_TIER[clean(result.result_bucket)] || 'directory',
    bucket_rank: Number(result.bucket_rank) || null,
    phone: clean(result.phone) || null,
  };
}

/**
 * Imparte rezultatele in ce se poate pune pe harta si ce nu.
 *
 * @param {Array<object>} results rezultatele deja bucketizate de server
 * @returns {{points: Array<object>, unmapped: Array<object>, mappedCount: number, unmappedCount: number}}
 */
export function buildResultsMapModel(results) {
  const list = Array.isArray(results) ? results : [];
  const points = [];
  const unmapped = [];
  const seen = new Set();

  for (const result of list) {
    const id = clean(result?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const point = mapPointFromResult(result);
    if (point) {
      points.push(point);
    } else {
      unmapped.push({
        id,
        name: clean(result?.name) || 'Locație',
        city: clean(result?.city),
        profile_control_status: clean(result?.profile_control_status) || 'directory',
      });
    }
  }

  // Top 3 primele, ca pinii lor sa fie desenati deasupra celorlalti cand se suprapun.
  points.sort((a, b) => {
    const order = { top3: 0, confirmed: 1, directory: 2 };
    const tierDifference = (order[a.tier] ?? 3) - (order[b.tier] ?? 3);
    if (tierDifference !== 0) return tierDifference;
    return (a.bucket_rank || 99) - (b.bucket_rank || 99);
  });

  return {
    points,
    unmapped,
    mappedCount: points.length,
    unmappedCount: unmapped.length,
  };
}

/**
 * Dreptunghiul care cuprinde toate punctele, in formatul asteptat de Leaflet
 * ([[latSud, lngVest], [latNord, lngEst]]). Intoarce null cand nu exista puncte.
 */
export function boundsForPoints(points) {
  const list = (Array.isArray(points) ? points : []).filter(Boolean);
  if (list.length === 0) return null;
  let south = list[0].lat;
  let north = list[0].lat;
  let west = list[0].lng;
  let east = list[0].lng;
  for (const point of list) {
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
    if (point.lng < west) west = point.lng;
    if (point.lng > east) east = point.lng;
  }
  return [[south, west], [north, east]];
}

/**
 * Textul care explica ce lipseste de pe harta. Intoarce sir gol cand nu lipseste nimic, ca
 * apelantul sa nu afiseze o nota inutila.
 */
export function unmappedNotice(unmappedCount) {
  const count = Math.max(0, Number(unmappedCount) || 0);
  if (count === 0) return '';
  if (count === 1) {
    return 'O opțiune din listă nu are poziție exactă publicată și nu apare pe hartă.';
  }
  return `${count} opțiuni din listă nu au poziție exactă publicată și nu apar pe hartă.`;
}

/**
 * Grupeaza punctele care s-ar suprapune pe ecran la nivelul de zoom dat.
 *
 * De ce e nevoie: coordonatele sunt derivate din adresa, deci mai multe locatii de pe aceeasi
 * strada - sau din acelasi oras mic - cad practic in acelasi punct. Fara grupare, harta ar arata
 * un singur pin acolo unde sunt cinci, iar patru locatii ar deveni invizibile fara ca cineva sa
 * observe. Gruparea le face vizibile ca numar si le desface la zoom, ca in orice harta de cautare.
 *
 * Metoda este o grila simpla, nu o clusterizare geografica: la fiecare nivel de zoom celula se
 * injumatateste, deci grupurile se desfac progresiv. Fara dependinte noi si usor de verificat.
 *
 * @param {Array<object>} points punctele deja validate
 * @param {number} zoom nivelul curent de zoom Leaflet
 * @returns {Array<{key: string, lat: number, lng: number, points: Array<object>, lead: object, count: number}>}
 */
export function clusterPoints(points, zoom) {
  const list = (Array.isArray(points) ? points : []).filter(Boolean);
  if (list.length === 0) return [];

  // La zoom mare nu mai grupam: pacientul vrea sa vada fiecare locatie separat.
  if (Number(zoom) >= 15) {
    return list.map((point) => ({
      key: point.id,
      lat: point.lat,
      lng: point.lng,
      points: [point],
      lead: point,
      count: 1,
    }));
  }

  // Celula pleaca de la ~1.2 grade la zoom 6 (nivelul intregii tari) si se injumatateste
  // la fiecare treapta de zoom.
  const level = Math.max(3, Math.min(Number(zoom) || FALLBACK_ZOOM, 14));
  const cell = 1.2 / (2 ** (level - 6));

  const buckets = new Map();
  for (const point of list) {
    const key = `${Math.floor(point.lat / cell)}:${Math.floor(point.lng / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(point);
  }

  const clusters = [];
  for (const [key, members] of buckets) {
    // Punctul afisat este cel mai bine clasat din grup - deci un grup care contine o optiune
    // din Top 3 arata ca atare, nu ca o bula anonima.
    const lead = members[0];
    const latitude = members.reduce((total, point) => total + point.lat, 0) / members.length;
    const longitude = members.reduce((total, point) => total + point.lng, 0) / members.length;
    clusters.push({
      key,
      lat: members.length === 1 ? lead.lat : latitude,
      lng: members.length === 1 ? lead.lng : longitude,
      points: members,
      lead,
      count: members.length,
    });
  }

  // Grupurile care contin Top 3 se deseneaza ultimele, ca sa ramana deasupra celorlalte.
  clusters.sort((a, b) => {
    const order = { top3: 2, confirmed: 1, directory: 0 };
    return (order[a.lead.tier] ?? 0) - (order[b.lead.tier] ?? 0);
  });
  return clusters;
}

/**
 * Punctele din interiorul unui dreptunghi Leaflet ([[latSud, lngVest], [latNord, lngEst]]).
 * Se foloseste pentru a filtra lista la ce se vede pe harta - o filtrare pur vizuala, care NU
 * atinge potrivirea, ordonarea sau bucketele venite de la server.
 */
export function pointIdsWithinBounds(points, bounds) {
  const list = (Array.isArray(points) ? points : []).filter(Boolean);
  if (!Array.isArray(bounds) || bounds.length !== 2) return list.map((point) => point.id);
  const [[south, west], [north, east]] = bounds;
  return list
    .filter((point) => point.lat >= south && point.lat <= north && point.lng >= west && point.lng <= east)
    .map((point) => point.id);
}

export default {
  RESULTS_MAP_CONTRACT_VERSION,
  clusterPoints,
  pointIdsWithinBounds,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  mapPointFromResult,
  buildResultsMapModel,
  boundsForPoints,
  unmappedNotice,
};
