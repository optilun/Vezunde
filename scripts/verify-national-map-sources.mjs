// Harta nationala: aceleasi date, din cateva citiri in loc de ~100.
// 2026-09-24: recalcularea citea locatiile pe fiecare cod de judet (94) plus starea de director in
// loturi de 200; imediat dupa o recalculare, o alta instanta a primit 503 (limita Base44).
// Verificam ca varianta pe pagini produce exact aceleasi locatii si aceeasi stare de director ca
// varianta veche, pe aceleasi date, si ca o eroare de citire nu este inghitita.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readAllPages,
  loadPublishedLocationsForMap,
  loadDirectoryDetailOverlayForMap,
  NATIONAL_MAP_PAGE_SIZE,
} from '../base44/shared/nationalMapSources.js';
import {
  loadAllPublicLocationsByCounty,
  loadDirectoryDetailOverlay,
  withDirectoryDetail,
} from '../base44/shared/locationScopedEntityQuery.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function matches(row, query) {
  for (const [key, expected] of Object.entries(query || {})) {
    if (expected && typeof expected === 'object' && Array.isArray(expected.$in)) {
      if (!expected.$in.includes(row[key])) return false;
    } else if (row[key] !== expected) return false;
  }
  return true;
}

function compare(sort) {
  if (!sort) return () => 0;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return (a, b) => {
    const left = a[field] ?? null;
    const right = b[field] ?? null;
    if (left === right) return 0;
    if (left === null) return 1; // lipsa la final, ca in Mongo pe sortare descrescatoare
    if (right === null) return -1;
    return (left < right ? -1 : 1) * (desc ? -1 : 1);
  };
}

function makeEntity(rows, { failAtRead = null } = {}) {
  const entity = {
    reads: 0,
    async filter(query, sort, limit = 50, skip = 0) {
      entity.reads += 1;
      if (failAtRead !== null && entity.reads === failAtRead) {
        const error = new Error('Rate limit exceeded');
        error.status = 429;
        throw error;
      }
      return rows.filter((row) => matches(row, query)).sort(compare(sort)).slice(skip, skip + limit);
    },
  };
  return entity;
}

const COUNTY_CODES = [...Array.from({ length: 52 }, (_, index) => String(index + 1)), 'CJ', 'B'];

function makeData(total = 1437) {
  const locations = [];
  const states = [];
  for (let index = 0; index < total; index += 1) {
    const id = `loc-${String(index).padStart(5, '0')}`;
    locations.push({
      id,
      name: `Optica ${index % 97}`, // nume repetate: sortarea dupa nume nu e unica
      status: index % 11 === 0 ? 'draft' : 'publicata',
      county_code: index % 53 === 0 ? 'XX' : COUNTY_CODES[index % COUNTY_CODES.length], // XX: in afara listei
      public_visibility_status: 'approved',
      lat: 45 + index / 10000,
      lng: 25 + index / 10000,
    });
    // O stare veche si una noua pentru unele locatii, o stare inactiva, si locatii fara stare.
    if (index % 7 !== 0) {
      states.push({ id: `st-${index}-a`, location_id: id, state_status: 'active', normalized_at: '2026-08-01T10:00:00Z', directory_detail_level: 'basic', data_quality_status: 'medium' });
    }
    if (index % 5 === 0) {
      states.push({ id: `st-${index}-b`, location_id: id, state_status: 'active', normalized_at: '2026-09-01T10:00:00Z', directory_detail_level: 'summary', directory_basic_details_approved: true, data_quality_status: 'high' });
      states.push({ id: `st-${index}-c`, location_id: id, state_status: 'superseded', normalized_at: '2026-09-10T10:00:00Z', directory_detail_level: 'full' });
    }
  }
  // Stari pentru locatii care nu sunt pe harta: ignorate.
  states.push({ id: 'st-orphan', location_id: 'loc-missing', state_status: 'active', normalized_at: '2026-09-02T10:00:00Z', directory_detail_level: 'full' });
  return { locations, states };
}

// 1. Aceleasi locatii ca varianta pe judete, din ceil(n/500) citiri.
{
  const { locations, states } = makeData();
  const oldSvc = { entities: { ProviderLocation: makeEntity(locations), ProviderLocationDirectoryState: makeEntity(states) } };
  const newSvc = { entities: { ProviderLocation: makeEntity(locations), ProviderLocationDirectoryState: makeEntity(states) } };

  const before = await loadAllPublicLocationsByCounty(oldSvc, { failOnError: true });
  const { locations: after, reads } = await loadPublishedLocationsForMap(newSvc);
  const ids = (rows) => rows.map((row) => row.id).sort();
  assert.deepEqual(ids(after), ids(before), 'exact aceleasi locatii publicate');
  assert.ok(!after.some((row) => row.county_code === 'XX'), 'codurile de judet din afara listei raman excluse, ca inainte');
  assert.ok(!after.some((row) => row.status !== 'publicata'), 'doar locatii publicate');
  const published = locations.filter((row) => row.status === 'publicata').length;
  assert.equal(reads, Math.floor(published / NATIONAL_MAP_PAGE_SIZE) + 1, 'o citire pe pagina de 500');
  assert.ok(oldSvc.entities.ProviderLocation.reads >= 54, 'varianta veche: o citire pe fiecare cod de judet');
  assert.ok(newSvc.entities.ProviderLocation.reads <= 4, `varianta noua: cateva citiri (${newSvc.entities.ProviderLocation.reads})`);

  // 2. Aceeasi stare de director pe fiecare locatie.
  const visibleIds = before.map((row) => row.id);
  const oldOverlay = await loadDirectoryDetailOverlay(oldSvc, visibleIds);
  const { overlay: newOverlay } = await loadDirectoryDetailOverlayForMap(newSvc, visibleIds);
  assert.equal(newOverlay.size, oldOverlay.size, 'aceleasi locatii au stare');
  for (const [locationId, fields] of oldOverlay) {
    assert.deepEqual(newOverlay.get(locationId), fields, `aceeasi stare pentru ${locationId}`);
  }
  assert.ok(!newOverlay.has('loc-missing'), 'starile altor locatii nu intra');
  for (const loc of before.slice(0, 50)) {
    assert.deepEqual(withDirectoryDetail(loc, newOverlay), withDirectoryDetail(loc, oldOverlay));
  }
  assert.ok(newSvc.entities.ProviderLocationDirectoryState.reads <= 4, 'starea din cateva citiri');
}

// 3. Paginarea: pagina exacta de 500 se continua; repetarile se pastreaza o data; limita de pagini.
{
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: `r-${String(index).padStart(4, '0')}` }));
  const entity = makeEntity(rows);
  const { rows: all, reads } = await readAllPages(entity, {});
  assert.equal(all.length, 1000);
  assert.equal(reads, 3, 'doua pagini pline si una goala');

  const dupEntity = {
    reads: 0,
    async filter(_query, _sort, limit, skip) {
      dupEntity.reads += 1;
      // Un rand se muta intre pagini in timpul citirii: apare de doua ori.
      if (skip === 0) return [{ id: 'a' }, { id: 'b' }];
      if (skip === 2) return [{ id: 'b' }];
      return [];
    },
  };
  const deduped = await readAllPages(dupEntity, {}, { pageSize: 2 });
  assert.deepEqual(deduped.rows.map((row) => row.id), ['a', 'b']);

  const endless = { async filter(_q, _s, limit) { return Array.from({ length: limit }, (_, i) => ({ id: `${Math.random()}-${i}` })); } };
  await assert.rejects(readAllPages(endless, {}, { pageSize: 10, maxPages: 3 }), /exceeded 3 pages/);
}

// 4. O eroare de citire (limita de trafic) nu e inghitita: calcularea esueaza, iar copia buna
//    din nationalMapCache.js ramane servita, in loc sa se salveze o harta incompleta.
{
  const { locations, states } = makeData(1200);
  const svc = { entities: { ProviderLocation: makeEntity(locations, { failAtRead: 2 }), ProviderLocationDirectoryState: makeEntity(states) } };
  await assert.rejects(loadPublishedLocationsForMap(svc), /Rate limit/);
  const svc2 = { entities: { ProviderLocation: makeEntity(locations), ProviderLocationDirectoryState: makeEntity(states, { failAtRead: 1 }) } };
  await assert.rejects(loadDirectoryDetailOverlayForMap(svc2, ['loc-00001']), /Rate limit/);
  const empty = await loadDirectoryDetailOverlayForMap(svc2, []);
  assert.equal(empty.overlay.size, 0);
  assert.equal(empty.reads, 0, 'fara locatii, nicio citire');
}

// 5. Folosit doar de harta nationala; cautarea ramane pe interogarile ei.
{
  const entry = await read('base44/functions/browseDirectoryProviders/entry.ts');
  assert.match(entry, /from '\.\.\/\.\.\/shared\/nationalMapSources\.js'/);
  const compute = entry.slice(entry.indexOf('async function computeNationalMap'), entry.indexOf('Deno.serve'));
  assert.match(compute, /loadPublishedLocationsForMap\(svc\)/);
  assert.match(compute, /loadDirectoryDetailOverlayForMap\(svc, visible\.map/);
  assert.doesNotMatch(compute, /loadAllPublicLocationsByCounty/);
  const rest = entry.slice(entry.indexOf('Deno.serve'));
  assert.doesNotMatch(rest, /nationalMapSources|loadPublishedLocationsForMap|loadDirectoryDetailOverlayForMap/, 'ramura de localitate neschimbata');
  const search = await read('base44/functions/getPublicLocationsForSearch/entry.ts');
  assert.doesNotMatch(search, /nationalMapSources/, 'cautarea nu foloseste sursa hartii');
}

console.log('National map source checks passed.');
