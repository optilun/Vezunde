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
assert.ok(autocomplete.popularServiceSuggestions().length >= 6, "caseta goala arata nevoile cautate des");
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

const search = read("src/pages/Search.jsx");
assert.match(search, /<ServiceSearchField/);
assert.match(search, /<LocalityAutocomplete\s+ref=\{localityFieldRef\}\s+guided/);
assert.match(search, /grid-cols-1 gap-0 md:grid-cols-\[/, "pe telefon campurile stau unul sub altul");
assert.match(search, /localityFieldRef\.current\?\.focus\(\)/, "dupa serviciu, cursorul trece la localitate");

const locality = read("src/components/geo/LocalityAutocomplete.jsx");
assert.match(locality, /role="combobox"/);
assert.match(locality, /ArrowDown/);
assert.match(locality, /resultCache/);

const filters = read("src/components/results/SearchFilters.jsx");
assert.match(filters, /patientServicesByGroup/);
assert.ok(!filters.includes("max-h-56"), "fara derulare in derulare in panoul de filtre");

console.log("Search guided fields: service suggestions, quick localities, diacritics, keyboard and grouped filters — OK");
