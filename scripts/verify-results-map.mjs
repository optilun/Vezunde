// Garda pentru harta rezultatelor si pentru varianta compacta a cardurilor.
//
// 2026-09-04. Ecranul de recomandari a primit o harta in coloana din dreapta si carduri
// compacte. Doua lucruri trebuie sa ramana adevarate dupa orice refactorizare viitoare:
//
//   1. Harta nu inventeaza pozitii. Deseneaza doar ce a expus serverul: nu geocodeaza, nu
//      ghiceste dintr-un nume de oras si nu cade pe centrul judetului. Din 2026-09-05
//      locatiile publicate au coordonate derivate din adresa lor publica, marcate
//      `approximate` - deci pinii exista, dar diferenta fata de o pozitie confirmata de
//      furnizor trebuie sa ramana vizibila, nu stearsa.
//   2. Ce lipseste de pe harta se declara. Daca notita ar disparea, harta ar parea completa
//      cand nu este, iar pacientul ar crede ca a vazut toate optiunile.
//
// In plus, varianta compacta trebuie sa PLIEZE informatia, nu sa o stearga: panoul de
// incredere si notita de profil nerevendicat raman in card, la un click distanta.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RESULTS_MAP_CONTRACT_VERSION,
  boundsForPoints,
  buildResultsMapModel,
  mapPointFromResult,
  unmappedNotice,
} from "../shared/resultsMapPoints.js";

assert.equal(RESULTS_MAP_CONTRACT_VERSION, "results-map-points-v1");

// --- modelul pur -----------------------------------------------------------------------

const claimed = {
  id: "loc-1",
  name: "Optica Test",
  city: "Timișoara",
  lat: 45.7489,
  lng: 21.2087,
  provider_type: "optica_medicala",
  profile_control_status: "claimed",
  result_bucket: "top3",
  bucket_rank: 1,
};
const point = mapPointFromResult(claimed);
assert.ok(point, "un profil cu coordonate expuse trebuie sa ajunga pe harta");
assert.equal(point.tier, "top3");
assert.equal(point.bucket_rank, 1);

// Profil din director: coordonatele vin null din politica de vizibilitate publica.
assert.equal(
  mapPointFromResult({ ...claimed, id: "loc-2", profile_control_status: "directory", lat: null, lng: null }),
  null,
  "un rezultat fara coordonate expuse nu are voie sa primeasca un pin",
);

// Valori care ar produce pini falsi.
assert.equal(mapPointFromResult({ ...claimed, id: "x1", lat: 0, lng: 0 }), null, "Null Island nu este o locatie");
assert.equal(mapPointFromResult({ ...claimed, id: "x2", lat: 200, lng: 21 }), null, "latitudine invalida");
assert.equal(mapPointFromResult({ ...claimed, id: "x3", lat: "necunoscut", lng: 21 }), null, "text in loc de numar");
// 2026-09-05. Pozitia aproximata NU se mai refuza - locatiile publicate au primit coordonate
// derivate din adresa lor publica, iar politica de vizibilitate le expune marcate ca atare.
// Ce trebuie sa ramana adevarat este ca precizia calatoreste cu punctul si ca necunoscutul se
// trateaza ca aproximativ, niciodata ca exact.
const approximate = mapPointFromResult({ ...claimed, id: "x4", map_precision: "approximate" });
assert.ok(approximate, "o pozitie aproximativa se afiseaza, marcata ca atare");
assert.equal(approximate.map_precision, "approximate");
assert.equal(
  mapPointFromResult({ ...claimed, id: "x5" }).map_precision,
  "approximate",
  "fara o declaratie explicita de precizie, punctul nu are voie sa pretinda ca este exact",
);
assert.equal(
  mapPointFromResult({ ...claimed, id: "x6", map_precision: "exact" }).map_precision,
  "exact",
);

const model = buildResultsMapModel([
  { ...claimed, id: "a", result_bucket: "extended_directory", bucket_rank: 2 },
  { ...claimed, id: "b", lat: 46.77, lng: 23.6, result_bucket: "top3", bucket_rank: 1 },
  { ...claimed, id: "c", lat: null, lng: null, profile_control_status: "directory" },
  { ...claimed, id: "c" }, // acelasi id: nu se dubleaza pinul
]);
assert.equal(model.mappedCount, 2);
assert.equal(model.unmappedCount, 1);
assert.equal(model.points[0].tier, "top3", "Top 3 se deseneaza primul, ca sa ramana deasupra");
assert.equal(model.points.length + model.unmapped.length, 3, "fiecare rezultat unic ajunge intr-o parte sau in cealalta");

const bounds = boundsForPoints(model.points);
assert.deepEqual(bounds, [[45.7489, 21.2087], [46.77, 23.6]]);
assert.equal(boundsForPoints([]), null);

// Notita despre ce lipseste: obligatorie cand lipseste ceva, absenta cand nu lipseste nimic.
assert.equal(unmappedNotice(0), "");
assert.ok(unmappedNotice(1).includes("O opțiune"));
assert.ok(unmappedNotice(4).startsWith("4 opțiuni"));

// --- cablajul din interfata -------------------------------------------------------------

const mapSource = await readFile(new URL("../src/components/results/ResultsMap.jsx", import.meta.url), "utf8");
assert.ok(
  mapSource.includes("buildResultsMapModel"),
  "harta trebuie sa foloseasca modelul comun, nu propria filtrare de coordonate",
);
assert.ok(mapSource.includes("unmappedNotice"), "harta trebuie sa afiseze cate optiuni nu au pozitie");
assert.ok(
  mapSource.includes("map_precision"),
  "harta trebuie sa distinga vizual o pozitie aproximativa de una confirmata",
);
assert.ok(
  /openstreetmap\.org\/copyright/i.test(mapSource),
  "atributia OpenStreetMap este obligatorie pentru tile-urile folosite",
);
for (const forbidden of ["geocode", "geocoding", "nominatim", "maps.googleapis.com/maps/api/geocode"]) {
  assert.ok(
    !mapSource.toLowerCase().includes(forbidden),
    `harta nu are voie sa geocodeze adrese (${forbidden})`,
  );
}

const cardSource = await readFile(new URL("../src/components/results/ResultCard.jsx", import.meta.url), "utf8");
assert.ok(/compact = false/.test(cardSource), "cardul de rezultat trebuie sa aiba varianta compacta");
assert.ok(
  cardSource.includes("DecisionConfidencePanel") && cardSource.includes("compact={compact}"),
  "panoul de incredere ramane in card si in varianta compacta",
);
assert.ok(
  cardSource.includes("DirectoryProfileNotice"),
  "notita de profil nerevendicat ramane in card, pliata, nu stearsa",
);

const panelSource = await readFile(new URL("../src/components/results/DecisionConfidencePanel.jsx", import.meta.url), "utf8");
assert.ok(/compact = false/.test(panelSource), "panoul de incredere trebuie sa aiba varianta compacta");
assert.ok(
  panelSource.includes("Ce nu este confirmat"),
  "limitarile raman disponibile si in varianta compacta",
);

const pageSource = await readFile(new URL("../src/pages/RequestMatches.jsx", import.meta.url), "utf8");
assert.ok(pageSource.includes("ResultsMap"), "ecranul de recomandari trebuie sa afiseze harta");
assert.ok(
  pageSource.includes("onVisibleResultsChange"),
  "harta trebuie sa urmareasca lista curenta, inclusiv dupa o extindere de arie",
);
assert.ok(
  pageSource.includes("selectedLocationId") && pageSource.includes("onSelect={setSelectedId}"),
  "selectia trebuie sa fie sincronizata in ambele sensuri intre lista si harta",
);
assert.ok(
  pageSource.includes("hoveredLocationId") && pageSource.includes("onHover={setHoveredId}"),
  "evidentierea la trecerea cu mouse-ul trebuie sa functioneze in ambele sensuri",
);

// Filtrarea dupa harta este vizuala. Nu are voie sa cheme serverul din nou, pentru ca ar
// insemna alt criteriu de potrivire decat cel ales de pacient.
for (const forbidden of ["matchProviders", "browseDirectory", "bbox", "fetch("]) {
  assert.ok(
    !pageSource.includes(forbidden),
    `ecranul de rezultate nu are voie sa reinterogheze serverul dupa dreptunghiul hartii (${forbidden})`,
  );
}

const listSource = await readFile(new URL("../src/components/intake2/MatchResults.jsx", import.meta.url), "utf8");
assert.ok(
  listSource.includes("const shownList = visibleSet"),
  "filtrarea dupa harta trebuie sa fie o simpla ascundere de carduri",
);
assert.ok(
  listSource.includes("<PatientRequestSubmission results={list}"),
  "cererea se trimite pe baza listei complete, nu a celei filtrate de harta",
);
assert.ok(
  listSource.includes("const serverTop3Count = list.filter"),
  "starea recomandarii descrie ce a gasit serverul, nu cat se vede pe ecran",
);

// Leaflet este importat direct in cod, deci trebuie declarat ca dependinta, nu mostenit
// ca peer al lui react-leaflet: un `npm ci` intr-un mediu curat ar ramane fara el.
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.ok(packageJson.dependencies.leaflet, "leaflet trebuie declarat in dependencies");
assert.ok(packageJson.dependencies["react-leaflet"], "react-leaflet trebuie declarat in dependencies");

console.log("verify-results-map: ok");
