// Harta Romaniei dintr-un fisier static (audit /cauta, B6, 2026-09-28).
//
// - fisierul se scrie la build doar dintr-un raspuns valid al functiei publice (aceleasi date);
// - un fisier lipsa, HTML (pagina aplicatiei), stricat sau prea vechi nu se foloseste;
// - pagina il arata imediat, iar lista actuala il inlocuieste fara sa mute harta;
// - daca lista actuala nu vine, harta spune de cand sunt datele si ofera „Reîncearcă”.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NATIONAL_MAP_SNAPSHOT_MAX_AGE_MS,
  NATIONAL_MAP_SNAPSHOT_PATH,
  nationalMapSnapshotFromResponse,
  parseNationalMapSnapshot,
} from '../shared/nationalMapSnapshot.js';
import { opensOnNationalMap } from '../src/lib/nationalMapEarly.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const point = { id: 'a', name: 'Optica A', provider_type: 'optica_medicala', city: 'Cluj-Napoca', lat: 46.77, lng: 23.59 };
const response = { map_scope: 'national', results: [point], total_published: 2, without_position: 1, locality_counts: {}, generated_at: '2026-09-28T10:00:00.000Z', stale: false };
const builtAt = new Date('2026-09-28T12:00:00.000Z');

// Scrierea
{
  const snapshot = nationalMapSnapshotFromResponse(response, builtAt);
  assert.equal(snapshot.snapshot_built_at, builtAt.toISOString());
  assert.equal(snapshot.results.length, 1);
  assert.equal(snapshot.total_published, 2);
  assert.ok(!('stale' in snapshot), 'starea copiei de pe server nu intra in fisier');
  assert.equal(nationalMapSnapshotFromResponse({ error: 'x' }), null);
  assert.equal(nationalMapSnapshotFromResponse({ map_scope: 'sitemap', locations: [] }), null);
  assert.equal(nationalMapSnapshotFromResponse({ map_scope: 'national', results: [] }), null, 'un fisier gol nu se scrie');
  assert.equal(nationalMapSnapshotFromResponse({ map_scope: 'national', results: [{ id: 'x', lat: 'n/a', lng: 1 }] }), null);
  assert.equal(NATIONAL_MAP_SNAPSHOT_PATH, '/data/harta-nationala.json');
}

// Citirea
{
  const text = JSON.stringify(nationalMapSnapshotFromResponse(response, builtAt));
  const now = builtAt.getTime() + 60_000;
  const parsed = parseNationalMapSnapshot(text, now);
  assert.equal(parsed.from_snapshot, true);
  assert.equal(parsed.results[0].id, 'a');
  assert.equal(parseNationalMapSnapshot('<!doctype html><html></html>', now), null, 'pagina aplicatiei (fisier lipsa) nu e harta');
  assert.equal(parseNationalMapSnapshot('{stricat', now), null);
  assert.equal(parseNationalMapSnapshot(null, now), null);
  assert.equal(parseNationalMapSnapshot(text, builtAt.getTime() + NATIONAL_MAP_SNAPSHOT_MAX_AGE_MS + 1), null, 'un fisier prea vechi nu se foloseste');
  assert.equal(parseNationalMapSnapshot(JSON.stringify({ map_scope: 'national', results: [point] }), now), null, 'fara data scrierii nu se foloseste');
}

// Cand porneste devreme
{
  const now = Date.now();
  assert.equal(opensOnNationalMap('/cauta', '', null, now), true);
  assert.equal(opensOnNationalMap('/cauta', '?tip=optica_medicala', null, now), true);
  assert.equal(opensOnNationalMap('/cauta', '?oras=Cluj-Napoca&siruta=54975', null, now), false);
  assert.equal(opensOnNationalMap('/cauta', '?serviciu=consult_oftalmologic', null, now), false);
  assert.equal(opensOnNationalMap('/', '', null, now), false);
  assert.equal(opensOnNationalMap('/cauta', '', { locality: { siruta_code: '54975' }, savedAt: now }, now), false, 'sesiunea redeschide localitatea');
  assert.equal(opensOnNationalMap('/cauta', '', { locality: { siruta_code: '54975' }, savedAt: now - 31 * 60_000 }, now), true, 'sesiune expirata');
}

// Legaturile din aplicatie
{
  const config = read('vite.config.js');
  assert.match(config, /apply: 'build'/);
  assert.match(config, /nationalMapSnapshot\(\),/);
  assert.match(config, /signal: AbortSignal\.timeout\(20_000\)/, 'build-ul nu asteapta la nesfarsit');
  assert.match(config, /this\.warn\(`Harta Romaniei: fisierul static nu s-a scris/, 'o eroare nu opreste build-ul');
  assert.match(read('src/main.jsx'), /startNationalMapEarly\(\)/);
  const page = read('src/pages/DirectoryMap.jsx');
  assert.match(page, /loadNationalMapSnapshot\(\)\.then\(\(snapshot\) => \{\s*if \(!active \|\| !snapshot \|\| live === "ok"\) return;/, 'lista actuala sosita inainte castiga');
  assert.match(page, /if \(snapshotBuiltAt\) \{\s*setState\(\(current\) => \(\{ \.\.\.current, snapshotAt: snapshotBuiltAt \}\)\);/, 'fara lista actuala, ramane fisierul');
  assert.match(page, /Harta arată locațiile din \{formatSnapshotDate\(state\.snapshotAt\)\}/);
  assert.match(page, /fitKey=\{`national:\$\{type\}`\}/);
  const canvas = read('src/components/results/VectorResultsCanvas.jsx');
  assert.match(canvas, /const fitToken=fitKey===null \? signature : `key:\$\{fitKey\}`;/);
  assert.match(canvas, /if \(saved\?\.bounds && \(saved\.signature===signature \|\| fitKey!==null\)\)/);
  assert.match(read('src/components/results/ResultsMap.jsx'), /fitKey=\{fitKey\} \/>/);
  assert.match(read('src/components/results/LocationsWithMap.jsx'), /fitKey=\{fitKey\}/);
  // Celelalte harti (localitate, rezultate) se reincadreaza ca inainte.
  assert.match(read('src/components/results/LocationsWithMap.jsx'), /fitKey = null,/);
}

console.log('National map snapshot checks passed.');
