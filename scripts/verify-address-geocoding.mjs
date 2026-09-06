// Garda pentru geocodarea adreselor publice.
//
// 2026-09-05. Pozitiile locatiilor sunt derivate din adresa publica. Doua feluri de greseala
// sunt posibile aici, si a doua este mult mai periculoasa decat prima:
//
//   1. nu gasim pozitia — harta are un pin in minus, iar sub ea scrie cate lipsesc;
//   2. punem un pin gresit — pacientul se duce unde nu trebuie.
//
// Scriptul apara impotriva celei de-a doua. Verifica, fara retea, ca acceptarea unui rezultat
// respinge tot ce nu se potriveste cu datele noastre, ca nu exista nicio cadere pe "centrul
// judetului", si ca o pozitie confirmata de furnizor nu este niciodata suprascrisa.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ADDRESS_GEOCODING_CONTRACT_VERSION,
  ROMANIA_BOUNDS,
  acceptGeocodeResult,
  fallbackQueryForLocation,
  geocodePlanForLocation,
  geocodeQueryForLocation,
  geocodeUpdatePayload,
  normalizeGeoName,
  pickGeocodeResult,
} from "../shared/addressGeocoding.js";

assert.equal(ADDRESS_GEOCODING_CONTRACT_VERSION, "address-geocoding-v1");

// --- normalizare -----------------------------------------------------------------------

assert.equal(normalizeGeoName("Județul Timiș"), "timis");
assert.equal(normalizeGeoName("Municipiul București"), "bucuresti");
assert.equal(normalizeGeoName("Cluj County"), "cluj");
assert.equal(normalizeGeoName(""), "");

// --- interogarea -----------------------------------------------------------------------

const focsani = {
  id: "loc-1",
  name: "Optimoda Focșani",
  address: "Str. Unirea Principatelor nr. 2, Focșani",
  city: "Focșani",
  county: "Vrancea",
};

const query = geocodeQueryForLocation(focsani);
assert.equal(query.city, "Focșani");
assert.equal(query.county, "Vrancea");
assert.equal(query.country, "Romania");
assert.equal(
  query.street,
  "2 Strada Unirea Principatelor",
  "campul `street` se trimite ca '<numar> <nume strada>', cu abrevierile desfacute",
);

// Fiecare caz de mai jos a fost masurat pe adrese reale din director: forma din stanga cadea pe
// centrul localitatii, cea din dreapta nimereste strada.
const streetCases = [
  [{ address: "Bd. Revoluției nr. 78, Arad", city: "Arad", county: "Arad" }, "78 Bulevardul Revoluției"],
  [{ address: "B-dul Eroilor nr. 3", city: "Brașov", county: "Brasov" }, "3 Bulevardul Eroilor"],
  [{ address: "Șos. Nicolae Titulescu 4A", city: "București", county: "Bucuresti" }, "4A Soseaua Nicolae Titulescu"],
  [{ address: "P-ța Victoriei 1", city: "Timișoara", county: "Timis" }, "1 Piata Victoriei"],
  // Blocul, scara si "parter comercial" nu ajuta la gasirea strazii si de obicei o strica.
  [{ address: "Str. Tăbăcari nr. 6, bl. 4, parter comercial, Făgăraș", city: "Făgăraș", county: "Brasov" }, "6 Strada Tăbăcari"],
  // Fara "nr.", numarul sta la final si se muta in fata - o singura data, nu de doua ori.
  [{ address: "Calea Aradului 12, Timișoara", city: "Timișoara", county: "Timis" }, "12 Calea Aradului"],
  // Judetul repetat la final se taie, ca si localitatea.
  [{ address: "Aleea Spitalului nr. 36, Pitești, Argeș", city: "Pitești", county: "Argeș" }, "36 Aleea Spitalului"],
  // Intervalele de numere sunt frecvente la cladirile mari. Lasate intregi, geocoderul nu
  // gaseste nimic si cade pe centrul orasului.
  [{ address: "Str. Gheorghe Doja nr. 64-68, Târgu Mureș", city: "Târgu Mureș", county: "Mures" }, "64 Strada Gheorghe Doja"],
  [{ address: "Bd. 1 Decembrie 1918 nr. 182-184, Târgu Mureș", city: "Târgu Mureș", county: "Mures" }, "182 Bulevardul 1 Decembrie 1918"],
  // Fara numar deloc, ramane doar numele - o piata se gaseste si asa.
  [{ address: "Piata Victoriei, bl. 11, parter, Deva", city: "Deva", county: "Hunedoara" }, "Piata Victoriei"],
];
for (const [location, expected] of streetCases) {
  assert.equal(geocodeQueryForLocation(location).street, expected, location.address);
}

assert.equal(geocodeQueryForLocation({ address: "Str. X nr. 1" }), null, "fara localitate nu exista interogare");

const fallback = fallbackQueryForLocation(focsani);
assert.equal(fallback.street, "", "rezerva coboara la nivel de localitate");
assert.equal(fallback.city, "Focșani", "rezerva NU coboara mai jos de localitate");
assert.equal(
  fallbackQueryForLocation({ city: "Arad", county: "Arad" }),
  null,
  "fara strada nu exista o treapta de rezerva de coborat",
);

// --- acceptarea rezultatelor ------------------------------------------------------------

const good = {
  lat: "45.6966",
  lon: "27.1856",
  address: { country_code: "ro", county: "Vrancea", city: "Focșani" },
};
const accepted = acceptGeocodeResult(good, focsani);
assert.equal(accepted.accepted, true);
assert.equal(accepted.lat, 45.6966);
assert.equal(accepted.lng, 27.1856);

// Fiecare refuz de mai jos corespunde unui pin gresit care ar fi ajuns pe harta.
const refusals = [
  [null, "no_result"],
  [{ lat: "x", lon: "27.1" }, "invalid_coordinates"],
  [{ lat: 0, lon: 0 }, "null_island"],
  [{ lat: 48.85, lon: 2.35, address: { country_code: "fr" } }, "outside_romania"],
  [{ lat: 45.6, lon: 27.1, address: { country_code: "md" } }, "wrong_country"],
  [{ lat: 46.77, lon: 23.59, address: { country_code: "ro", county: "Cluj" } }, "county_mismatch"],
];
for (const [candidate, expectedReason] of refusals) {
  const verdict = acceptGeocodeResult(candidate, focsani);
  assert.equal(verdict.accepted, false, `trebuia respins: ${expectedReason}`);
  assert.equal(verdict.reason, expectedReason);
}

// Marginile dreptunghiului Romaniei sunt reale, nu decorative.
assert.equal(
  acceptGeocodeResult({ lat: ROMANIA_BOUNDS.north + 0.5, lon: 25 }, {}).reason,
  "outside_romania",
);
assert.equal(acceptGeocodeResult({ lat: 45.9, lon: 24.9 }, {}).accepted, true);

// Cand raspunsul nu declara judetul, nu blocam: dreptunghiul a fost deja verificat.
assert.equal(
  acceptGeocodeResult({ lat: 45.69, lon: 27.18, address: { country_code: "ro" } }, focsani).accepted,
  true,
);

// Alegerea sare peste candidatii nepotriviti si il ia pe primul acceptabil.
const picked = pickGeocodeResult(
  [
    { lat: 48.85, lon: 2.35, address: { country_code: "fr" } },
    good,
  ],
  focsani,
);
assert.equal(picked.accepted, true);
assert.equal(picked.lat, 45.6966);
assert.equal(pickGeocodeResult([], focsani).accepted, false);

// --- planul per locatie -----------------------------------------------------------------

assert.equal(geocodePlanForLocation(focsani).action, "geocode");
assert.equal(geocodePlanForLocation(focsani).reason, "missing_position");

assert.deepEqual(
  geocodePlanForLocation({ ...focsani, lat: 45.6, lng: 27.1, map_precision: "exact" }),
  { action: "skip", reason: "owner_confirmed_position" },
  "o pozitie confirmata de furnizor nu se suprascrie niciodata",
);

assert.deepEqual(
  geocodePlanForLocation({
    ...focsani,
    lat: 45.6,
    lng: 27.1,
    map_precision: "approximate",
    geocoded_address: focsani.address,
  }),
  { action: "skip", reason: "already_geocoded" },
  "reluarea nu reface munca deja facuta",
);

assert.equal(
  geocodePlanForLocation({
    ...focsani,
    lat: 45.6,
    lng: 27.1,
    map_precision: "approximate",
    geocoded_address: "Alta adresa veche",
  }).reason,
  "address_changed",
  "cand adresa se schimba, pozitia derivata din ea devine invalida",
);

assert.deepEqual(
  geocodePlanForLocation({ id: "x", name: "Fara adresa" }),
  { action: "skip", reason: "missing_address" },
);

// --- ce se scrie inapoi ------------------------------------------------------------------

const payload = geocodeUpdatePayload({ lat: 45.69, lng: 27.18, address: focsani.address, at: "2026-09-05T00:00:00.000Z" });
assert.equal(payload.map_precision, "approximate", "o pozitie derivata din adresa NU este niciodata 'exact'");
assert.equal(payload.geocode_source, "openstreetmap_nominatim");
assert.equal(payload.geocoded_address, focsani.address);
assert.equal(payload.geocoded_at, "2026-09-05T00:00:00.000Z");

// --- scriptul de rulare ------------------------------------------------------------------

const runner = await readFile(new URL("./geocode-published-locations.mjs", import.meta.url), "utf8");
assert.ok(
  runner.includes("REQUEST_INTERVAL_MS = 1100"),
  "politica Nominatim cere cel mult o cerere pe secunda",
);
assert.ok(/User-Agent/.test(runner) && /VIASEE/.test(runner), "politica Nominatim cere un User-Agent care identifica aplicatia");
assert.ok(
  runner.includes("const apply = process.argv.includes('--apply')"),
  "scriptul nu are voie sa scrie in productie fara un semnal explicit",
);
assert.ok(
  !/lat:\s*45\.9432|county_center|judet_center/i.test(runner),
  "scriptul nu are voie sa cada inapoi pe centrul tarii sau al judetului",
);

// Politica de vizibilitate trebuie sa expuna pozitia aproximativa, altfel geocodarea nu ajunge
// niciodata la pacient.
const trust = await readFile(new URL("../shared/providerPublicTrust.js", import.meta.url), "utf8");
assert.ok(
  trust.includes("lat: exposeBasicDetails && hasCoordinates ? latitude : null"),
  "coordonatele trebuie expuse si pentru profilurile din director",
);
assert.ok(trust.includes("map_precision: mapPrecision"), "precizia trebuie sa insoteasca pozitia");
assert.ok(
  trust.includes("place_id: exposeFullDetails ? (location.place_id || null) : null"),
  "place_id ramane rezervat profilurilor cu detaliu complet",
);

// Drumul principal de rulare este o functie backend, apelabila din panoul de admin: nu are nevoie
// de nicio cheie adaugata manual undeva, pentru ca ruleaza in aplicatie, cu rolul ei de serviciu.
const backend = await readFile(new URL("../base44/functions/directoryOps/directoryGeocodeOps.ts", import.meta.url), "utf8");
assert.ok(backend.includes("REQUEST_INTERVAL_MS = 1100"), "si backendul respecta o cerere pe secunda");
assert.ok(backend.includes("user.role !== 'admin'"), "geocodarea este o operatie de admin");
assert.ok(
  backend.includes("geocodePlanForLocation") && backend.includes("pickGeocodeResult"),
  "backendul foloseste aceleasi reguli de acceptare ca restul, nu propriile lui",
);
assert.ok(
  backend.includes("DirectoryAuditRecord"),
  "fiecare pozitie scrisa trebuie sa lase o urma in audit",
);
assert.ok(
  !/45\.9432|county_center|fallbackCenter/i.test(backend),
  "backendul nu are voie sa cada pe centrul tarii sau al judetului",
);

// Copia din base44/shared trebuie sa fie identica: backendul importa de acolo.
const sharedCopy = await readFile(new URL("../base44/shared/addressGeocoding.js", import.meta.url), "utf8");
const sharedOriginal = await readFile(new URL("../shared/addressGeocoding.js", import.meta.url), "utf8");
assert.equal(sharedCopy, sharedOriginal, "shared/addressGeocoding.js si copia din base44 trebuie sa fie identice");

// Rularea din CI ramane ca alternativa, pentru cine prefera sa o programeze. Acolo cheia de API
// vine din secretele repo-ului si nu trece prin nicio alta mana.
const workflow = await readFile(new URL("../.github/workflows/geocode-locations.yml", import.meta.url), "utf8");
assert.ok(workflow.includes("secrets.BASE44_API_KEY"), "cheia vine din secretele repo-ului");
assert.ok(workflow.includes("workflow_dispatch"), "rularea trebuie sa poata fi pornita la cerere");
assert.ok(
  workflow.includes("default: false"),
  "rularea implicita este o simulare: scrierea in productie se cere explicit",
);

console.log("verify-address-geocoding: ok");
