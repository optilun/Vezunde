// Alegerea rapida a localitatii pe /cauta: orasele mari, localitatile folosite recent si numele
// scrise corect, cu diacritice.
//
// Registrul geografic pastreaza numele fara diacritice („Iasi”, „Bacau”). Aici le afisam corect
// doar pentru judete si resedintele de judet; codul SIRUTA ramane cel oficial, deci cautarea
// primeste exact aceeasi localitate.

const COUNTY_NAMES = {
  Arges: "Argeș", Bacau: "Bacău", "Bistrita-Nasaud": "Bistrița-Năsăud", Botosani: "Botoșani",
  Brasov: "Brașov", Braila: "Brăila", Bucuresti: "București", Buzau: "Buzău",
  "Caras-Severin": "Caraș-Severin", Calarasi: "Călărași", Constanta: "Constanța",
  Dambovita: "Dâmbovița", Galati: "Galați", Ialomita: "Ialomița", Iasi: "Iași",
  Maramures: "Maramureș", Mehedinti: "Mehedinți", Mures: "Mureș", Neamt: "Neamț",
  Salaj: "Sălaj", Timis: "Timiș", Valcea: "Vâlcea",
};

const COUNTY_SEAT_NAMES = {
  Bucuresti: "București", Constanta: "Constanța", Calarasi: "Călărași", Timisoara: "Timișoara",
  Resita: "Reșița", "Piatra-Neamt": "Piatra Neamț", "Targu Jiu": "Târgu Jiu", Bacau: "Bacău",
  Focsani: "Focșani", "Targu Mures": "Târgu Mureș", Pitesti: "Pitești", Galati: "Galați",
  Zalau: "Zalău", Buzau: "Buzău", Braila: "Brăila", Brasov: "Brașov",
  "Ramnicu Valcea": "Râmnicu Vâlcea", Targoviste: "Târgoviște", "Sfantu Gheorghe": "Sfântu Gheorghe",
  Botosani: "Botoșani", Bistrita: "Bistrița", Ploiesti: "Ploiești", Iasi: "Iași",
};

const SEAT_TYPES = new Set(["municipality_county_seat", "bucharest_municipality"]);

export function prettyCountyName(name) {
  return COUNTY_NAMES[name] || name || "";
}

// Aceeasi localitate, cu numele afisat corect. Restul campurilor raman neschimbate.
export function prettyLocality(locality) {
  if (!locality) return locality;
  const name = SEAT_TYPES.has(locality.locality_type) ? COUNTY_SEAT_NAMES[locality.name] || locality.name : locality.name;
  const county = prettyCountyName(locality.county_name);
  let displayLabel = locality.display_label || locality.name;
  if (name !== locality.name && displayLabel.startsWith(locality.name)) displayLabel = name + displayLabel.slice(locality.name.length);
  if (locality.county_name && county !== locality.county_name && displayLabel.endsWith(locality.county_name)) {
    displayLabel = displayLabel.slice(0, -locality.county_name.length) + county;
  }
  return { ...locality, name, display_label: displayLabel, county_name: county };
}

// Rand de lista: numele (cu UAT-ul, cand acelasi nume exista de doua ori in judet) si judetul.
export function localityRowParts(locality) {
  const pretty = prettyLocality(locality);
  let main = pretty.display_label || pretty.name;
  if (pretty.county_name && main.endsWith(", " + pretty.county_name)) main = main.slice(0, -(pretty.county_name.length + 2));
  const bucharest = pretty.locality_type === "bucharest_municipality" || pretty.locality_type === "bucharest_sector";
  const secondary = bucharest ? (pretty.locality_type === "bucharest_sector" ? "București" : "municipiu") : pretty.county_name ? `jud. ${pretty.county_name}` : "";
  return { main, secondary };
}

// Cele mai mari orase, in ordinea populatiei. Coduri SIRUTA oficiale, verificate in registrul
// GeographicLocality (2026-09-26).
export const MAJOR_CITIES = [
  { siruta_code: "179132", name: "Bucuresti", county_name: "Bucuresti", county_code: "40", locality_type: "bucharest_municipality" },
  { siruta_code: "54975", name: "Cluj-Napoca", county_name: "Cluj", county_code: "12", locality_type: "municipality_county_seat" },
  { siruta_code: "95060", name: "Iasi", county_name: "Iasi", county_code: "22", locality_type: "municipality_county_seat" },
  { siruta_code: "155243", name: "Timisoara", county_name: "Timis", county_code: "35", locality_type: "municipality_county_seat" },
  { siruta_code: "60419", name: "Constanta", county_name: "Constanta", county_code: "13", locality_type: "municipality_county_seat" },
  { siruta_code: "40198", name: "Brasov", county_name: "Brasov", county_code: "8", locality_type: "municipality_county_seat" },
  { siruta_code: "69900", name: "Craiova", county_name: "Dolj", county_code: "16", locality_type: "municipality_county_seat" },
  { siruta_code: "26564", name: "Oradea", county_name: "Bihor", county_code: "5", locality_type: "municipality_county_seat" },
].map((city) => prettyLocality({ ...city, uat_code: city.siruta_code, display_label: city.name }));

// ---------------------------------------------------------------------------------------------
// „Lângă mine” si numarul de locatii pe oras, calculate in browser din harta nationala (aceleasi
// puncte ca pe harta de pe /cauta). Pozitia pacientului nu pleaca din browser: serverul primeste
// doar numele localitatii alese, ca la orice cautare scrisa.

function normalizePlace(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Sectoarele Bucurestiului („Bucuresti Sectorul 1”) se numara si se afiseaza la Bucuresti, ca in
// cautare (resolveEquivalentLocalityCodes) si in numerele de pe server (locality_counts).
function canonicalPlace(name) {
  return normalizePlace(name).replace(/^bucuresti sector(ul)? \d+$/, "bucuresti");
}

export function placeKey(name, county) {
  return `${canonicalPlace(name)}|${normalizePlace(county)}`;
}

function distanceKm(a, b) {
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Cate locatii are fiecare localitate (cheie: nume + judet). Serverul trimite numarul complet
// (`locality_counts`, inclusiv locatiile fara pozitie); din puncte ies doar cele de pe harta.
export function localityCountsFromMap(data) {
  if (data?.locality_counts && typeof data.locality_counts === "object") {
    return new Map(Object.entries(data.locality_counts).map(([key, count]) => [key, Number(count) || 0]));
  }
  return localityCountsFromPoints(data?.results);
}

export function localityCountsFromPoints(points) {
  const counts = new Map();
  for (const point of points || []) {
    if (!point?.city) continue;
    const key = placeKey(point.city, point.county);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

// Cele mai apropiate localitati care au locatii in director, dupa cea mai apropiata locatie din
// fiecare. Pacientul alege; nu schimbam singuri localitatea.
export function nearbyLocalitiesFromPoints(points, origin, limit = 3) {
  const groups = new Map();
  for (const point of points || []) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!point?.city || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = placeKey(point.city, point.county);
    const distance = distanceKm(origin, { lat, lng });
    const city = canonicalPlace(point.city) === "bucuresti" ? "Bucuresti" : point.city;
    const group = groups.get(key) || { key, city, county: point.county || "", distanceKm: Infinity, count: 0 };
    group.count += 1;
    group.distanceKm = Math.min(group.distanceKm, distance);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return "sub 1 km";
  return `${km < 10 ? km.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(km)} km`;
}

export function formatLocationCount(count) {
  if (!count) return "";
  return count === 1 ? "1 locație" : count < 20 ? `${count} locații` : `${count} de locații`;
}

// Numele unei localitati din harta, scris corect (harta pastreaza numele din registru).
export function prettyPlaceName(name) {
  return COUNTY_SEAT_NAMES[name] || name || "";
}

// Din rezultatele cautarii de localitati, cea care corespunde numelui si judetului din harta.
export function pickLocalityForPlace(results, city, county) {
  const name = normalizePlace(city);
  const countyName = normalizePlace(county);
  const sameName = (results || []).filter((item) => normalizePlace(item.name) === name);
  return sameName.find((item) => normalizePlace(item.county_name) === countyName) || sameName[0] || null;
}

const RECENT_KEY = "viasee.recent.localities.v1";
const RECENT_LIMIT = 3;

// Doar pe dispozitivul pacientului: codul si numele localitatii, nimic despre ce a cautat.
export function readRecentLocalities() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && item.siruta_code && item.name).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberLocality(locality) {
  if (!locality?.siruta_code) return;
  try {
    const item = {
      siruta_code: locality.siruta_code,
      name: locality.name,
      display_label: locality.display_label || locality.name,
      county_name: locality.county_name || "",
      county_code: locality.county_code || "",
      uat_code: locality.uat_code,
      locality_type: locality.locality_type,
    };
    const next = [item, ...readRecentLocalities().filter((saved) => saved.siruta_code !== item.siruta_code)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Memorarea e optionala.
  }
}
