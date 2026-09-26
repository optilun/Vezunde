// /cauta: caseta de serviciu, alegerea localitatii si filtrele (2026-09-26).
// Verifica sugestiile (ordine, prima litera, fraze), orasele rapide si legaturile din pagina.
// Potrivirea si ordinea rezultatelor nu sunt atinse de aceste fisiere.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Fisierele din src folosesc aliasul @/ al Vite; pentru test il inlocuim cu caile reale.
function importWithAliases(file) {
  const source = read(file)
    .replaceAll('"@/lib/', `"${pathToFileURL(path.join(root, "src/lib")).href}/`)
    .replace(/from "(file:[^"]+?)(?<!\.js)"/g, 'from "$1.js"')
    .replaceAll('"../../shared/', `"${pathToFileURL(path.join(root, "shared")).href}/`);
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "viasee-")), path.basename(file).replace(/\.js$/, ".mjs"));
  fs.writeFileSync(target, source);
  return import(pathToFileURL(target).href);
}

const autocomplete = await importWithAliases("src/lib/serviceAutocomplete.js");
const first = (query) => autocomplete.rankServiceSuggestions(query)[0]?.service_key;

assert.equal(first("ochel"), "eyeglasses", "„ochel” aduce intai ochelarii de vedere, nu ordinea alfabetica");
assert.ok(autocomplete.rankServiceSuggestions("o").length > 0, "sugestiile apar de la prima litera");
assert.equal(first("lent"), "contact_lenses");
assert.equal(first("oct"), "oct");
assert.equal(first("vad in ceata"), "optometry_consultation", "frazele pacientului raman legate de serviciul potrivit");
assert.ok(autocomplete.rankServiceSuggestions("urcior").length > 0, "cuvintele din regulile de intentie sunt propuse");
assert.ok(autocomplete.rankServiceSuggestions("control").some((item) => item.service_key === "optometry_consultation"));
assert.deepEqual(autocomplete.rankServiceSuggestions("xyzq"), []);
assert.ok(autocomplete.popularServiceSuggestions().length >= 6, "caseta goala arata nevoile frecvente");
const serviceField = read("src/components/results/ServiceSearchField.jsx");
assert.ok(!serviceField.includes("Căutate des"), "lista e aleasa de noi, nu masurata: nu o numim „Căutate des”");
assert.match(serviceField, /Nevoi frecvente/);
assert.deepEqual(
  autocomplete.highlightParts("Reparații ochelari", "ochel").filter((part) => part.match).map((part) => part.text),
  ["ochel"],
);
assert.ok(!autocomplete.serviceMatchesNeedle("prescription_sunglasses", "lentile de c"), "filtrul nu aduce potriviri slabe");
const grouped = autocomplete.patientServicesByGroup();
assert.equal(grouped.reduce((sum, [, items]) => sum + items.length, 0), 136, "toate serviciile pentru pacient sunt in grupuri");

const quickPicks = await import(pathToFileURL(path.join(root, "src/lib/localityQuickPicks.js")).href);
assert.deepEqual(
  quickPicks.MAJOR_CITIES.map((city) => [city.siruta_code, city.name]).slice(0, 3),
  [["179132", "București"], ["54975", "Cluj-Napoca"], ["95060", "Iași"]],
  "orasele rapide folosesc codurile SIRUTA oficiale",
);
const bacau = quickPicks.prettyLocality({ name: "Bacau", display_label: "Bacau", county_name: "Bacau", locality_type: "municipality_county_seat", siruta_code: "20297" });
assert.equal(bacau.name, "Bacău");
assert.equal(bacau.siruta_code, "20297", "numele se afiseaza corect, codul ramane acelasi");
const commune = quickPicks.prettyLocality({ name: "Cleja", display_label: "Cleja", county_name: "Bacau", locality_type: "commune" });
assert.equal(commune.name, "Cleja");
assert.equal(commune.county_name, "Bacău");

// „Lângă mine”: localitatile apropiate, calculate in browser din harta nationala.
const points = [
  { city: "Cluj-Napoca", county: "Cluj", lat: 46.77, lng: 23.59 },
  { city: "Cluj-Napoca", county: "Cluj", lat: 46.76, lng: 23.6 },
  { city: "Floresti", county: "Cluj", lat: 46.745, lng: 23.49 },
  { city: "Turda", county: "Cluj", lat: 46.57, lng: 23.78 },
  { city: "Fara pozitie", county: "Cluj", lat: null, lng: null },
];
const nearby = quickPicks.nearbyLocalitiesFromPoints(points, { lat: 46.75, lng: 23.5 }, 3);
assert.deepEqual(nearby.map((place) => place.city), ["Floresti", "Cluj-Napoca", "Turda"], "cea mai apropiata localitate cu locatii e prima");
assert.equal(nearby[1].count, 2);
assert.equal(quickPicks.localityCountsFromPoints(points).get(quickPicks.placeKey("Cluj-Napoca", "Cluj")), 2);
assert.equal(quickPicks.formatDistance(0.4), "sub 1 km");
assert.equal(quickPicks.formatDistance(7.46), "7,5 km");
assert.equal(quickPicks.formatLocationCount(1), "1 locație");
assert.equal(quickPicks.formatLocationCount(42), "42 de locații");
assert.deepEqual(
  quickPicks.pickLocalityForPlace([{ name: "Floresti", county_name: "Prahova" }, { name: "Floresti", county_name: "Cluj" }], "Floresti", "Cluj"),
  { name: "Floresti", county_name: "Cluj" },
  "localitatea din harta devine cea oficiala din acelasi judet",
);

// Numerele pe oras vin de pe server (toate locatiile, si cele fara pozitie); sectoarele se
// numara la Bucuresti, ca in cautare.
assert.equal(quickPicks.placeKey("Bucuresti Sectorul 1", "Bucuresti"), quickPicks.placeKey("București", "București"));
const serverCounts = quickPicks.localityCountsFromMap({ results: points, locality_counts: { "cluj napoca|cluj": 46 } });
assert.equal(serverCounts.get(quickPicks.placeKey("Cluj-Napoca", "Cluj")), 46, "numarul de pe server are prioritate");
assert.equal(quickPicks.localityCountsFromMap({ results: points }).get(quickPicks.placeKey("Cluj-Napoca", "Cluj")), 2, "fara el, din puncte");
const bucharestNearby = quickPicks.nearbyLocalitiesFromPoints([
  { city: "Bucuresti Sectorul 1", county: "Bucuresti", lat: 44.45, lng: 26.08 },
  { city: "Bucuresti", county: "Bucuresti", lat: 44.43, lng: 26.1 },
], { lat: 44.44, lng: 26.09 }, 3);
assert.deepEqual(bucharestNearby.map((place) => [place.city, place.count]), [["Bucuresti", 2]], "un sector nu apare ca localitate separata");
const browse = read("base44/functions/browseDirectoryProviders/entry.ts");
assert.match(browse, /locality_counts: localityCounts/);
assert.match(browse, /replace\(\/\^bucuresti sector\(ul\)\? \\d\+\$\/, 'bucuresti'\)/, "aceeasi regula pentru sectoare pe server");

const search = read("src/pages/Search.jsx");
assert.match(search, /<ServiceSearchField/);
assert.match(search, /<LocalityAutocomplete\s+ref=\{localityFieldRef\}\s+guided/);
assert.match(search, /grid-cols-1 gap-0 md:grid-cols-\[/, "pe telefon campurile stau unul sub altul");
assert.match(search, /localityFieldRef\.current\?\.focus\(\)/, "dupa serviciu, cursorul trece la localitate");

const locality = read("src/components/geo/LocalityAutocomplete.jsx");
assert.match(locality, /role="combobox"/);
assert.match(locality, /ArrowDown/);
assert.match(locality, /resultCache/);
assert.match(locality, /Folosește locația mea/);
assert.ok(!/invoke\([^)]*(latitude|longitude|coords)/.test(locality), "pozitia pacientului nu se trimite serverului");
assert.match(search, /showCounts=\{!service && !query\.trim\(\)\}/, "numarul de locatii apare doar fara serviciu ales");

const filters = read("src/components/results/SearchFilters.jsx");
assert.match(filters, /patientServicesByGroup/);
assert.ok(!filters.includes("max-h-56"), "fara derulare in derulare in panoul de filtre");
assert.match(filters, /Cauți deja/, "filtrele spun ca doar restrang cautarea de sus");
assert.match(filters, /browseDirectoryProviders", \{ locality_siruta_code: siruta, provider_types: types, filter_service_keys: services, cas_only: cas, limit: 1 \}/, "numarul din buton vine din aceeasi cerere ca lista");
assert.match(search, /browseLocality=\{isDirectoryBrowseView \? locality : null\}/, "numarul se arata doar la rasfoire, nu la potrivire");

console.log("Search guided fields: service suggestions, quick localities, diacritics, keyboard and grouped filters — OK");
