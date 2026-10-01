// Verifica locatia vizitatorului (src/lib/preciseLocation.js) si ca cele doua locuri care o cer o
// folosesc.
//
// 2026-10-01. Inainte, `DirectoryMap` si `LocalityAutocomplete` cereau `getCurrentPosition` cu
// `enableHighAccuracy: false` si `maximumAge: 300000`: pozitie veche de 5 minute, adesea estimata
// din antene, nu din GPS. Verificarile de mai jos pastreaza comportamentul nou: pozitie de inalta
// precizie, rafinata, fara cache, cu pozitia obisnuita ca rezerva.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  accuracyNote,
  formatAccuracy,
  LOCATION_DENIED_MESSAGE,
  locatePrecisely,
  locationQuality,
  MAX_USABLE_ACCURACY_M,
  TARGET_ACCURACY_M,
} from "../src/lib/preciseLocation.js";

// `locatePrecisely` foloseste `window.setTimeout` si `navigator.geolocation`.
globalThis.window = globalThis;
function setGeolocation(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { geolocation: value } });
}
const fix = (accuracy, lat = 44.4268, lng = 26.1025) => ({ coords: { latitude: lat, longitude: lng, accuracy } });
const later = (ms, fn) => setTimeout(fn, ms);

// --- calitate si text ---
assert.equal(locationQuality(30), "gps");
assert.equal(locationQuality(100), "gps");
assert.equal(locationQuality(101), "wifi");
assert.equal(locationQuality(1000), "wifi");
assert.equal(locationQuality(1001), "coarse");
assert.equal(locationQuality(NaN), "coarse");
assert.equal(formatAccuracy(32), "~30 m");
assert.equal(formatAccuracy(2), "~5 m");
assert.equal(formatAccuracy(640), "~640 m");
assert.equal(formatAccuracy(1200), "~1,2 km");
assert.equal(formatAccuracy(NaN), "");
assert.match(accuracyNote(40), /precis/);
assert.match(accuracyNote(500), /aproximativ/);
assert.match(accuracyNote(2500), /vag/);
assert.equal(accuracyNote(NaN), "");
assert.match(LOCATION_DENIED_MESSAGE, /setările browserului/);
assert.ok(TARGET_ACCURACY_M < MAX_USABLE_ACCURACY_M);

// --- cere inalta precizie si fara cache ---
{
  let options;
  setGeolocation({
    watchPosition(ok, _err, opts) { options = opts; later(5, () => ok(fix(20))); return 1; },
    clearWatch() {},
    getCurrentPosition() { assert.fail("rezerva nu trebuie folosita cand watchPosition raspunde"); },
  });
  await locatePrecisely().promise;
  assert.equal(options.enableHighAccuracy, true);
  assert.equal(options.maximumAge, 0);
}

// --- rafinare: se opreste la prima pozitie suficient de buna, cu cea mai buna primita ---
{
  const progress = [];
  let cleared = 0;
  setGeolocation({
    watchPosition(ok) {
      later(5, () => ok(fix(900)));
      later(20, () => ok(fix(1500, 1, 1)));   // mai slaba: se ignora
      later(40, () => ok(fix(200)));
      later(60, () => ok(fix(40, 44.41, 26.11)));
      later(80, () => ok(fix(10, 9, 9)));     // dupa oprire: se ignora
      return 7;
    },
    clearWatch(id) { assert.equal(id, 7); cleared += 1; },
    getCurrentPosition() { assert.fail("fara rezerva"); },
  });
  const result = await locatePrecisely({ onProgress: (p) => progress.push(p.accuracy) }).promise;
  assert.deepEqual(result, { lat: 44.41, lng: 26.11, accuracy: 40, quality: "gps" });
  assert.deepEqual(progress, [900, 200, 40]);
  assert.equal(cleared, 1);
  await new Promise((resolve) => later(100, resolve));
  assert.equal(cleared, 1, "urmarirea se opreste o singura data");
}

// --- la expirare ramane cea mai buna pozitie, chiar daca nu atinge tinta ---
{
  setGeolocation({
    watchPosition(ok) { later(5, () => ok(fix(800))); later(15, () => ok(fix(350, 44.5, 26.2))); return 1; },
    clearWatch() {},
    getCurrentPosition() {},
  });
  const result = await locatePrecisely({ targetAccuracy: 50, maxWaitMs: 120 }).promise;
  assert.equal(result.accuracy, 350);
  assert.equal(result.lat, 44.5);
  assert.equal(result.quality, "wifi");
}

// --- acces refuzat: eroare imediata, cu codul 1 ---
{
  let cleared = 0;
  setGeolocation({
    watchPosition(_ok, err) { later(5, () => err({ code: 1 })); return 3; },
    clearWatch() { cleared += 1; },
    getCurrentPosition() { assert.fail("la refuz nu se mai incearca nimic"); },
  });
  await assert.rejects(locatePrecisely().promise, (error) => error.code === 1);
  assert.equal(cleared, 1);
}

// --- inalta precizie indisponibila (laptop fara GPS): o singura cerere obisnuita ---
{
  let fallbackCalls = 0;
  let fallbackOptions;
  setGeolocation({
    watchPosition(_ok, err) { later(5, () => err({ code: 2 })); later(15, () => err({ code: 3 })); return 4; },
    clearWatch() {},
    getCurrentPosition(ok, _err, opts) { fallbackCalls += 1; fallbackOptions = opts; later(5, () => ok(fix(300))); },
  });
  const result = await locatePrecisely({ targetAccuracy: 50, maxWaitMs: 150 }).promise;
  assert.equal(result.accuracy, 300);
  assert.equal(fallbackCalls, 1);
  assert.equal(fallbackOptions.enableHighAccuracy, false);
  assert.equal(fallbackOptions.maximumAge, 0, "nici rezerva nu primeste pozitie din cache");
}

// --- nicio pozitie pana la expirare: respins, nu agatat ---
{
  setGeolocation({ watchPosition() { return 5; }, clearWatch() {}, getCurrentPosition() {} });
  await assert.rejects(locatePrecisely({ maxWaitMs: 40 }).promise, (error) => error.code === 2);
}

// --- coordonate invalide se ignora ---
{
  setGeolocation({
    watchPosition(ok) { later(5, () => ok({ coords: { latitude: NaN, longitude: 26, accuracy: 5 } })); later(15, () => ok(fix(60))); return 6; },
    clearWatch() {},
    getCurrentPosition() {},
  });
  const result = await locatePrecisely().promise;
  assert.equal(result.accuracy, 60);
}

// --- fara geolocalizare in browser ---
{
  setGeolocation(undefined);
  await assert.rejects(locatePrecisely().promise, (error) => error.code === 0);
}

// --- anulare: se opreste urmarirea si nu mai ajunge nimic la apelant ---
{
  let cleared = 0;
  setGeolocation({ watchPosition() { return 8; }, clearWatch() { cleared += 1; }, getCurrentPosition() {} });
  const search = locatePrecisely({ maxWaitMs: 5000 });
  search.cancel();
  await assert.rejects(search.promise, (error) => error.cancelled === true);
  assert.equal(cleared, 1);
  search.cancel();
  assert.equal(cleared, 1, "a doua anulare nu face nimic");
}

// --- cele doua locuri folosesc helperul, nu cererea veche din cache ---
for (const file of ["../src/pages/DirectoryMap.jsx", "../src/components/geo/LocalityAutocomplete.jsx"]) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  assert.match(source, /locatePrecisely/, `${file} trebuie sa foloseasca locatePrecisely`);
  assert.doesNotMatch(source, /getCurrentPosition/, `${file} nu mai cere direct getCurrentPosition`);
  assert.doesNotMatch(source, /maximumAge:\s*300000/, `${file} nu mai accepta pozitie veche de 5 minute`);
  assert.match(source, /LOCATION_DENIED_MESSAGE/, `${file} trebuie sa explice cum se reactiveaza accesul`);
}

console.log("precise location checks passed");
