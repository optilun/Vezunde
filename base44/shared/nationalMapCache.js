// Harta nationala a directorului (pagina /cauta si harta din pagina de rezultate): o copie tinuta
// cateva minute, in loc sa fie recalculata la fiecare vizita.
//
// 2026-09-23. O calculare citeste locatiile publicate pe fiecare cod de judet (~94 de interogari)
// plus starea lor de director (~8 interogari): ~100 de citiri in 4-5 secunde. Base44 limiteaza
// citirile aplicatiei: o a doua vizita la ~15 s dupa prima primea `500 Rate limit exceeded`, iar
// pagina arata „Request failed with status code 500”. Limita e comuna, deci doi vizitatori apropiati
// in timp se incurcau intre ei (si incurcau alte pagini care citeau in acelasi moment).
//
// Ce face modulul:
// - tine rezultatul in memoria instantei NATIONAL_MAP_FRESH_MS; vizitele simultane din aceeasi
//   instanta asteapta aceeasi calculare (una singura);
// - salveaza o copie comprimata in `PublicMapSnapshot`, in bucati de NATIONAL_MAP_CHUNK_CHARS (ca la
//   `DirectoryAutoImportPayloadChunk`), pe doua seturi care se alterneaza: o scriere intrerupta nu
//   strica copia buna, iar inregistrarile se refolosesc (fara stergeri). O instanta noua face 1 citire
//   in loc de ~100. Harta de ~400 KB devine ~85 KB, adica ~8 bucati;
// - daca recalcularea esueaza (limita, timeout), serveste ultima copie buna (marcata `stale`) si nu
//   mai incearca NATIONAL_MAP_FAILURE_BACKOFF_MS, ca sa nu apese si mai tare pe limita.
//
// Nu schimba ce contine harta: aceleasi puncte si campuri, calculate de aceeasi functie. Nu e o
// cautare, nu ordoneaza si nu are Top 3. O schimbare in director (publicare, suspendare) apare pe
// harta in cel mult NATIONAL_MAP_FRESH_MS; profilul public e citit mereu direct.

export const NATIONAL_MAP_SCOPE = 'national';
export const NATIONAL_MAP_FORMAT = 'national-map-v1';
export const NATIONAL_MAP_ENCODING = 'gzip-base64';
export const NATIONAL_MAP_FRESH_MS = 10 * 60 * 1000;
export const NATIONAL_MAP_STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
export const NATIONAL_MAP_FAILURE_BACKOFF_MS = 60 * 1000;
export const NATIONAL_MAP_CHUNK_CHARS = 12_000;
const SNAPSHOT_READ_LIMIT = 100;
const SLOTS = ['a', 'b'];

let memory = null; // { value, generatedAt, version }
let inflight = null;
let lastFailureAt = 0;

/** Doar pentru teste: uita tot ce tine instanta. */
export function resetNationalMapMemory() {
  memory = null;
  inflight = null;
  lastFailureAt = 0;
}

function snapshotEntity(svc) {
  return svc?.entities?.PublicMapSnapshot || null;
}

function newVersion(generatedAt) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${generatedAt}-${random}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzipToBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function gunzipFromBase64(text) {
  const stream = new Blob([base64ToBytes(text)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Comprima rezultatul si il imparte in bucati de cel mult `chunkChars` caractere. */
export async function encodeSnapshotChunks(value, { version, generatedAt, chunkChars = NATIONAL_MAP_CHUNK_CHARS } = {}) {
  const text = await gzipToBase64(JSON.stringify(value));
  const size = Math.max(1000, Number(chunkChars) || NATIONAL_MAP_CHUNK_CHARS);
  const count = Math.max(1, Math.ceil(text.length / size));
  const chunks = [];
  for (let index = 0; index < count; index += 1) {
    chunks.push({
      scope: NATIONAL_MAP_SCOPE,
      format: NATIONAL_MAP_FORMAT,
      encoding: NATIONAL_MAP_ENCODING,
      version,
      chunk_index: index,
      chunk_count: count,
      payload: text.slice(index * size, (index + 1) * size),
      payload_length: text.length,
      generated_at: new Date(generatedAt).toISOString(),
    });
  }
  return chunks;
}

/**
 * Cea mai noua copie completa dintre inregistrari: toate bucatile aceleiasi versiuni, in format
 * cunoscut, cu lungimea totala corecta, care se decomprima intr-o harta valida. Orice altceva e
 * ignorat (o scriere intrerupta lasa o versiune incompleta, care nu trebuie sa ajunga la vizitatori).
 */
export async function decodeSnapshotChunks(rows) {
  const byVersion = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.scope !== NATIONAL_MAP_SCOPE || row.format !== NATIONAL_MAP_FORMAT) continue;
    if (row.encoding !== NATIONAL_MAP_ENCODING || !row.version) continue;
    if (!byVersion.has(row.version)) byVersion.set(row.version, []);
    byVersion.get(row.version).push(row);
  }
  const candidates = [...byVersion.entries()]
    .map(([version, chunks]) => ({ version, chunks, generatedAt: Date.parse(chunks[0]?.generated_at) }))
    .filter((candidate) => Number.isFinite(candidate.generatedAt))
    .sort((a, b) => b.generatedAt - a.generatedAt);
  for (const candidate of candidates) {
    const count = Number(candidate.chunks[0]?.chunk_count);
    if (!Number.isInteger(count) || count < 1) continue;
    const ordered = new Array(count);
    for (const chunk of candidate.chunks) {
      if (Number(chunk.chunk_count) !== count) continue;
      const index = Number(chunk.chunk_index);
      if (Number.isInteger(index) && index >= 0 && index < count && ordered[index] === undefined) ordered[index] = chunk;
    }
    // Bucla explicita: `some()` sare peste golurile unui tablou rar (o bucata lipsa ar trece).
    let complete = true;
    for (let index = 0; index < count; index += 1) {
      if (!ordered[index] || typeof ordered[index].payload !== 'string') { complete = false; break; }
    }
    if (!complete) continue;
    const text = ordered.map((chunk) => chunk.payload).join('');
    const expected = Number(ordered[0].payload_length);
    if (!Number.isFinite(expected) || text.length !== expected) continue;
    try {
      const value = JSON.parse(await gunzipFromBase64(text));
      if (!value || !Array.isArray(value.results)) continue;
      return { value, generatedAt: candidate.generatedAt, version: candidate.version };
    } catch (_error) {
      continue;
    }
  }
  return null;
}

async function readSnapshotRows(svc) {
  const entity = snapshotEntity(svc);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ scope: NATIONAL_MAP_SCOPE }, '-generated_at', SNAPSHOT_READ_LIMIT);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Scrie o versiune noua in setul de inregistrari care NU tine copia buna curenta. Inregistrarile se
 * refolosesc (fara stergeri), deci tabela ramane la cel mult 2 x numarul de bucati.
 */
export async function writeSnapshot(svc, snapshot, existingRows = [], options = {}) {
  const entity = snapshotEntity(svc);
  if (!entity?.create || !entity?.update) return false;
  const rows = Array.isArray(existingRows) ? existingRows : [];
  const current = await decodeSnapshotChunks(rows);
  const currentSlot = current ? rows.find((row) => row.version === current.version)?.slot : null;
  const targetSlot = currentSlot === SLOTS[0] ? SLOTS[1] : SLOTS[0];
  const chunks = await encodeSnapshotChunks(snapshot.value, { ...snapshot, chunkChars: options.chunkChars });
  const reusable = new Map();
  for (const row of rows) {
    const index = Number(row.chunk_index);
    if (row.slot === targetSlot && row.id && !reusable.has(index)) reusable.set(index, row);
  }
  for (const chunk of chunks) {
    const data = { ...chunk, slot: targetSlot };
    const existing = reusable.get(chunk.chunk_index);
    if (existing) await entity.update(existing.id, data);
    else await entity.create(data);
  }
  return true;
}

function newest(...snapshots) {
  return snapshots.filter(Boolean).sort((a, b) => b.generatedAt - a.generatedAt)[0] || null;
}

/**
 * Harta nationala, din memorie, din copia salvata sau recalculata.
 *
 * @param {object} args
 * @param {object} args.svc - clientul cu rol de serviciu
 * @param {() => Promise<object>} args.compute - calcularea existenta ({ map_scope, results, total_published, without_position })
 * @returns {Promise<{ value: object, generatedAt: number, source: string, stale: boolean }>}
 */
export async function getNationalMap({
  svc,
  compute,
  now = () => Date.now(),
  freshMs = NATIONAL_MAP_FRESH_MS,
  staleMaxMs = NATIONAL_MAP_STALE_MAX_MS,
  failureBackoffMs = NATIONAL_MAP_FAILURE_BACKOFF_MS,
  chunkChars = NATIONAL_MAP_CHUNK_CHARS,
} = {}) {
  if (memory && now() - memory.generatedAt < freshMs) return { ...memory, source: 'memory', stale: false };
  if (memory && lastFailureAt && now() - lastFailureAt < failureBackoffMs && now() - memory.generatedAt < staleMaxMs) {
    return { ...memory, source: 'stale', stale: true };
  }
  if (!inflight) {
    inflight = refresh({ svc, compute, now, freshMs, staleMaxMs, chunkChars }).finally(() => { inflight = null; });
  }
  return inflight;
}

async function refresh({ svc, compute, now, freshMs, staleMaxMs, chunkChars }) {
  let rows = [];
  let saved = null;
  try {
    rows = await readSnapshotRows(svc);
    saved = await decodeSnapshotChunks(rows);
  } catch (_error) {
    rows = [];
    saved = null;
  }
  if (saved && now() - saved.generatedAt < freshMs) {
    memory = saved;
    lastFailureAt = 0;
    return { ...saved, source: 'snapshot', stale: false };
  }

  try {
    const value = await compute();
    const generatedAt = now();
    const fresh = { value, generatedAt, version: newVersion(generatedAt) };
    memory = fresh;
    lastFailureAt = 0;
    // O scriere esuata nu strica raspunsul: vizitatorul primeste harta, urmatoarea instanta recalculeaza.
    await writeSnapshot(svc, fresh, rows, { chunkChars }).catch(() => false);
    return { ...fresh, source: 'computed', stale: false };
  } catch (error) {
    lastFailureAt = now();
    const fallback = newest(memory, saved);
    if (fallback && now() - fallback.generatedAt < staleMaxMs) {
      memory = fallback;
      return { ...fallback, source: 'stale', stale: true };
    }
    throw error;
  }
}
