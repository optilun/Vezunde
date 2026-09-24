// Harta nationala (/cauta, pagina de rezultate): copia tinuta cateva minute pe server si in pagina.
// 2026-09-23: o a doua vizita la ~15 s dupa prima primea „Rate limit exceeded” (500), pentru ca
// fiecare vizita recalcula harta din ~100 de citiri.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  decodeSnapshotChunks,
  encodeSnapshotChunks,
  getNationalMap,
  resetNationalMapMemory,
  writeSnapshot,
  NATIONAL_MAP_FRESH_MS,
  NATIONAL_MAP_FAILURE_BACKOFF_MS,
} from '../base44/shared/nationalMapCache.js';
import {
  createNationalMapLoader,
  isRetryableMapError,
  NATIONAL_MAP_ERROR_MESSAGE,
} from '../src/lib/nationalDirectoryMapLoader.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function makeMap(size, tag = 'v1') {
  const results = Array.from({ length: size }, (_, index) => ({
    id: `loc-${index}`,
    name: `Optica ${tag} ${index} — „ș, ț” & <test> ${Math.abs(Math.sin(index + 1) * 1e9).toString(36)}`,
    provider_type: 'optica',
    city: 'Cluj-Napoca',
    county: 'Cluj',
    address: `Str. ${Math.abs(Math.cos(index + 7) * 1e9).toString(36)} nr. ${index}`,
    lat: 46.77 + index / 1000,
    lng: 23.6 + index / 1000,
    map_precision: 'exact',
    profile_control_status: 'directory',
  }));
  return { map_scope: 'national', results, total_published: size + 3, without_position: 3 };
}

function makeStore({ failCreateAt = null, failUpdate = false } = {}) {
  const rows = [];
  let seq = 0;
  let creates = 0;
  const calls = { filter: 0, create: 0, update: 0 };
  const entity = {
    async filter(query) {
      calls.filter += 1;
      return rows.filter((row) => row.scope === query.scope).map((row) => ({ ...row }));
    },
    async create(data) {
      calls.create += 1;
      creates += 1;
      if (failCreateAt !== null && creates === failCreateAt) throw new Error('Rate limit exceeded');
      const row = { ...data, id: `snap-${++seq}` };
      rows.push(row);
      return row;
    },
    async update(id, data) {
      calls.update += 1;
      if (failUpdate) throw new Error('Rate limit exceeded');
      const row = rows.find((item) => item.id === id);
      Object.assign(row, data);
      return row;
    },
  };
  return { svc: { entities: { PublicMapSnapshot: entity } }, rows, calls };
}

function clock(start = Date.parse('2026-09-23T20:00:00Z')) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

// 1. Bucatile: dus-intors, versiuni incomplete, JSON stricat.
{
  const value = makeMap(200);
  const chunks = await encodeSnapshotChunks(value, { version: 'v1', generatedAt: Date.parse('2026-09-23T20:00:00Z'), chunkChars: 1000 });
  assert.ok(chunks.length > 3, 'harta se imparte in mai multe bucati');
  assert.ok(chunks[0].payload_length < JSON.stringify(value).length / 2, 'copia e comprimata');
  assert.ok(chunks.every((chunk) => chunk.payload.length <= 1000));
  const decoded = await decodeSnapshotChunks([...chunks].reverse());
  assert.deepEqual(decoded.value, value, 'ordinea in care vin bucatile nu conteaza');
  assert.equal(decoded.version, 'v1');

  const newer = await encodeSnapshotChunks(makeMap(200, 'v2'), { version: 'v2', generatedAt: Date.parse('2026-09-23T20:10:00Z'), chunkChars: 1000 });
  assert.equal((await decodeSnapshotChunks([...chunks, ...newer])).version, 'v2', 'cea mai noua versiune completa castiga');
  assert.equal((await decodeSnapshotChunks([...chunks, ...newer.slice(1)])).version, 'v1', 'o versiune noua incompleta (scriere intrerupta) e ignorata');
  const corrupt = newer.map((chunk, index) => (index === 1 ? { ...chunk, payload: chunk.payload.slice(3) } : chunk));
  assert.equal((await decodeSnapshotChunks([...chunks, ...corrupt])).version, 'v1', 'o versiune cu lungime gresita e ignorata');
  assert.equal(await decodeSnapshotChunks([{ scope: 'national', format: 'altceva', encoding: 'gzip-base64', version: 'x', chunk_index: 0, chunk_count: 1, payload: 'e30=', payload_length: 4, generated_at: '2026-09-23T20:00:00Z' }]), null);
  const garbage = chunks.map((chunk) => ({ ...chunk, version: 'garbage', generated_at: '2026-09-23T21:00:00Z', payload: 'A'.repeat(chunk.payload.length) }));
  assert.equal((await decodeSnapshotChunks([...chunks, ...garbage])).version, 'v1', 'o copie care nu se decomprima e ignorata');
  assert.equal(await decodeSnapshotChunks([]), null);
}

// 2. Prima vizita calculeaza si salveaza; a doua vine din memorie; o instanta noua citeste copia.
{
  resetNationalMapMemory();
  const store = makeStore();
  const time = clock();
  let computes = 0;
  const compute = async () => { computes += 1; return makeMap(300); };
  const first = await getNationalMap({ svc: store.svc, compute, now: time.now, chunkChars: 1000 });
  assert.equal(first.source, 'computed');
  assert.equal(first.stale, false);
  assert.equal(first.value.results.length, 300);
  assert.equal(computes, 1);
  assert.ok(store.rows.length > 1, 'copia e salvata in bucati');

  time.advance(30_000);
  const second = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(second.source, 'memory');
  assert.equal(computes, 1, 'a doua vizita nu mai recalculeaza');

  resetNationalMapMemory(); // alta instanta a functiei
  const filtersBefore = store.calls.filter;
  const third = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(third.source, 'snapshot');
  assert.deepEqual(third.value, first.value, 'copia salvata e identica cu harta calculata');
  assert.equal(computes, 1);
  assert.equal(store.calls.filter - filtersBefore, 1, 'o instanta noua face o singura citire');
}

// 3. Vizite simultane in aceeasi instanta: o singura calculare.
{
  resetNationalMapMemory();
  const store = makeStore();
  const time = clock();
  let computes = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const compute = async () => { computes += 1; await gate; return makeMap(10); };
  const pending = Array.from({ length: 6 }, () => getNationalMap({ svc: store.svc, compute, now: time.now }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  release();
  const results = await Promise.all(pending);
  assert.equal(computes, 1, 'sase vizite simultane = o calculare');
  assert.ok(results.every((result) => result.value.results.length === 10));
}

// 4. Dupa expirare se recalculeaza, in celalalt set de inregistrari; tabela nu creste.
{
  resetNationalMapMemory();
  const store = makeStore();
  const time = clock();
  let version = 0;
  const compute = async () => { version += 1; return makeMap(200, `v${version}`); };
  await getNationalMap({ svc: store.svc, compute, now: time.now, chunkChars: 1000 });
  const afterFirst = store.rows.length;
  const firstSlot = store.rows[0].slot;
  time.advance(NATIONAL_MAP_FRESH_MS + 1000);
  const refreshed = await getNationalMap({ svc: store.svc, compute, now: time.now, chunkChars: 1000 });
  assert.equal(refreshed.source, 'computed');
  assert.equal(version, 2);
  assert.ok(store.rows.some((row) => row.slot !== firstSlot), 'versiunea noua merge in celalalt set');
  time.advance(NATIONAL_MAP_FRESH_MS + 1000);
  await getNationalMap({ svc: store.svc, compute, now: time.now, chunkChars: 1000 });
  time.advance(NATIONAL_MAP_FRESH_MS + 1000);
  await getNationalMap({ svc: store.svc, compute, now: time.now, chunkChars: 1000 });
  assert.equal(version, 4);
  const maxChunks = Math.max(...store.rows.map((row) => Number(row.chunk_count)));
  assert.ok(afterFirst >= 2);
  assert.ok(store.rows.length <= maxChunks * 2, 'inregistrarile se refolosesc: cel mult doua seturi');
  resetNationalMapMemory();
  const fromSnapshot = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(fromSnapshot.source, 'snapshot');
  assert.equal(fromSnapshot.value.results[0].name.includes('v4'), true, 'se citeste ultima versiune');
}

// 5. Limita de trafic la recalculare: se serveste ultima copie buna, fara noi incercari un minut.
{
  resetNationalMapMemory();
  const store = makeStore();
  const time = clock();
  let computes = 0;
  let failing = false;
  const compute = async () => {
    computes += 1;
    if (failing) throw new Error('Rate limit exceeded');
    return makeMap(20);
  };
  await getNationalMap({ svc: store.svc, compute, now: time.now });
  time.advance(NATIONAL_MAP_FRESH_MS + 1000);
  failing = true;
  const stale = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(stale.source, 'stale');
  assert.equal(stale.stale, true);
  assert.equal(stale.value.results.length, 20, 'vizitatorul primeste harta, nu o eroare');
  assert.equal(computes, 2);
  time.advance(10_000);
  const again = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(again.source, 'stale');
  assert.equal(computes, 2, 'in pauza de dupa esec nu se mai apasa pe limita');
  time.advance(NATIONAL_MAP_FAILURE_BACKOFF_MS);
  failing = false;
  const recovered = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(recovered.source, 'computed');
  assert.equal(computes, 3);

  // O instanta noua, cu copia salvata veche si calcularea esuata: tot copia veche.
  resetNationalMapMemory();
  time.advance(NATIONAL_MAP_FRESH_MS + 1000);
  failing = true;
  const coldStale = await getNationalMap({ svc: store.svc, compute, now: time.now });
  assert.equal(coldStale.source, 'stale');
}

// 6. Fara nicio copie si cu calcularea esuata: eroare (functia raspunde 503 cu mesaj clar).
{
  resetNationalMapMemory();
  const store = makeStore();
  const time = clock();
  await assert.rejects(
    getNationalMap({ svc: store.svc, compute: async () => { throw new Error('Rate limit exceeded'); }, now: time.now }),
    /Rate limit exceeded/,
  );
}

// 7. Salvarea copiei esueaza: vizitatorul primeste harta oricum; o scriere intrerupta nu strica copia buna.
{
  resetNationalMapMemory();
  const broken = makeStore({ failCreateAt: 1 });
  const time = clock();
  const result = await getNationalMap({ svc: broken.svc, compute: async () => makeMap(15), now: time.now });
  assert.equal(result.source, 'computed');
  assert.equal(result.value.results.length, 15);

  // Fara entitatea de copie (ex. inainte de creare): harta merge din memorie.
  resetNationalMapMemory();
  const noEntity = await getNationalMap({ svc: { entities: {} }, compute: async () => makeMap(5), now: time.now });
  assert.equal(noEntity.source, 'computed');

  const store = makeStore();
  const good = { value: makeMap(200, 'good'), generatedAt: time.now(), version: 'good' };
  await writeSnapshot(store.svc, good, [], { chunkChars: 1000 });
  const rows = store.rows.map((row) => ({ ...row }));
  const partialStore = makeStore({ failCreateAt: 3 });
  partialStore.rows.push(...rows);
  time.advance(1000);
  await assert.rejects(writeSnapshot(partialStore.svc, { value: makeMap(200, 'next'), generatedAt: time.now(), version: 'next' }, rows, { chunkChars: 1000 }));
  const decoded = await decodeSnapshotChunks(partialStore.rows);
  assert.equal(decoded.version, 'good', 'scrierea intrerupta lasa neatinsa copia buna');
}

// 8. Functia: harta trece prin copie, raspunsul pastreaza campurile, eroarea e clara.
{
  const entry = await read('base44/functions/browseDirectoryProviders/entry.ts');
  assert.match(entry, /import \{ getNationalMap \} from '\.\.\/\.\.\/shared\/nationalMapCache\.js'/);
  assert.match(entry, /getNationalMap\(\{ svc, compute: \(\) => computeNationalMap\(svc\) \}\)/);
  assert.match(entry, /async function computeNationalMap\(svc\)/);
  // 2026-09-24: aceleasi locatii, citite pe pagini (vezi verify-national-map-sources.mjs).
  assert.match(entry, /loadPublishedLocationsForMap\(svc\)/, 'aceleasi locatii, din cateva citiri');
  assert.match(entry, /loadDirectoryDetailOverlayForMap\(svc, /, 'aceeasi stare de director, din cateva citiri');
  for (const field of ['map_scope', 'results', 'total_published', 'without_position']) assert.match(entry, new RegExp(`${field}`));
  assert.match(entry, /status: 503/);
  assert.match(entry, /generated_at/);
}

// 9. In pagina: reincercare doar pentru erori trecatoare, o singura cerere pentru vizite simultane,
//    harta tinuta 5 minute, mesaj clar.
{
  assert.equal(isRetryableMapError({ response: { status: 500 } }), true);
  assert.equal(isRetryableMapError({ response: { status: 503 } }), true);
  assert.equal(isRetryableMapError({ response: { status: 429 } }), true);
  assert.equal(isRetryableMapError(new Error('Network Error')), true);
  assert.equal(isRetryableMapError({ response: { status: 400 } }), false);
  assert.equal(isRetryableMapError({ response: { status: 403 } }), false);

  let calls = 0;
  const waits = [];
  let t = 0;
  const load = createNationalMapLoader({
    invoke: async () => {
      calls += 1;
      if (calls < 3) { const error = new Error('Request failed with status code 500'); error.response = { status: 500 }; throw error; }
      return { data: makeMap(5) };
    },
    wait: async (ms) => { waits.push(ms); },
    now: () => t,
  });
  const [a, b] = await Promise.all([load(), load()]);
  assert.equal(calls, 3, 'doua esecuri, apoi succes; vizitele simultane impart cererea');
  assert.deepEqual(waits, [1500, 4000]);
  assert.equal(a, b);
  t += 60_000;
  await load();
  assert.equal(calls, 3, 'in 5 minute harta vine din pagina');
  t += 5 * 60_000;
  await load();
  assert.equal(calls, 4, 'dupa 5 minute se cere din nou');
  await load({ force: true });
  assert.equal(calls, 5, '„Reincearca” cere din nou');

  let badCalls = 0;
  const loadBad = createNationalMapLoader({
    invoke: async () => { badCalls += 1; const error = new Error('bad'); error.response = { status: 400 }; throw error; },
    wait: async () => {},
  });
  await assert.rejects(loadBad());
  assert.equal(badCalls, 1, 'o eroare care nu trece de la sine nu se reincearca');

  let downCalls = 0;
  const loadDown = createNationalMapLoader({
    invoke: async () => { downCalls += 1; return { data: { error: 'Harta directorului nu poate fi incarcata acum.' } }; },
    wait: async () => {},
  });
  await assert.rejects(loadDown());
  assert.equal(downCalls, 3, 'raspuns cu eroare: se reincearca de doua ori');
  assert.match(NATIONAL_MAP_ERROR_MESSAGE, /Harta directorului nu s-a putut încărca acum/);

  const directoryMap = await read('src/pages/DirectoryMap.jsx');
  assert.match(directoryMap, /loadNationalDirectoryMap\(/);
  assert.match(directoryMap, /NATIONAL_MAP_ERROR_MESSAGE/);
  assert.doesNotMatch(directoryMap, /reason\?\.message/, 'textul tehnic al erorii nu mai ajunge la vizitator');
  const requestMatches = await read('src/pages/RequestMatches.jsx');
  assert.match(requestMatches, /loadNationalDirectoryMap\(/);
  for (const source of [directoryMap, requestMatches]) {
    assert.doesNotMatch(source, /invoke\("browseDirectoryProviders", \{ map_scope: "national" \}\)/, 'harta trece prin incarcatorul comun');
  }
}

console.log('National map cache checks passed.');
