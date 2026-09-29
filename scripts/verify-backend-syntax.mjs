// Sintaxa functiilor de backend (base44/functions/**/*.ts si .js) si a codului lor comun
// (base44/shared/**/*.js).
//
// 2026-09-29 (audit /cauta, D4). Functiile de backend nu treceau prin nicio verificare inainte de
// Publish: o paranteza lipsa se vedea abia cand functia cadea pe server. Aici fiecare fisier este
// transformat cu esbuild (fara rulare, fara retea). Nu verifica tipuri; doar ca fisierul se poate
// incarca.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(directory, extensions) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(full);
  }
  return found;
}

const files = [
  ...listFiles(path.join(root, 'base44/functions'), ['.ts', '.js']),
  ...listFiles(path.join(root, 'base44/shared'), ['.js', '.ts']),
];
assert.ok(files.length > 50, `prea putine fisiere de backend gasite (${files.length})`);

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  try {
    await transform(source, { loader: file.endsWith('.ts') ? 'ts' : 'js', format: 'esm', target: 'es2022', sourcefile: path.relative(root, file) });
  } catch (error) {
    const first = error?.errors?.[0];
    failures.push(`${path.relative(root, file)}${first?.location ? `:${first.location.line}:${first.location.column}` : ''} ${first?.text || error.message}`);
  }
}

assert.deepEqual(failures, [], `Fisiere de backend cu erori de sintaxa:\n${failures.join('\n')}`);

// Esbuild chiar respinge o eroare de sintaxa (garda ca verificarea nu trece orice).
let rejected = false;
try { await transform('export const a = (;', { loader: 'ts' }); } catch { rejected = true; }
assert.ok(rejected, 'verificarea trebuie sa respinga sintaxa gresita');

console.log(`Backend syntax: ${files.length} fisiere OK`);
