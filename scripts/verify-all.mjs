// Ruleaza toate verificarile din scripts/verify-*.mjs si spune clar ce a esuat.
//
// 2026-09-03. Proiectul are peste 120 de scripturi de verificare, dar niciun mod de a le
// rula pe toate. In practica fiecare sesiune isi scria propria bucla de shell, iar cateva
// scripturi ramaneau rosii cu luni in urma pentru ca nimeni nu se uita la toate deodata -
// exact asa au supravietuit `_noop_invalid.jsonc` (o schema goala publicata din greseala)
// si o garda de onboarding care verifica un invariant eliminat pe 2026-08-18.
//
// Un singur `npm run test:all` face afirmatia "suita e verde" verificabila.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDir = path.join(root, 'scripts');

// Scripturi care NU se pot rula fara argumente. Nu sunt verificari de sine statatoare, ci
// ajutoare de CI. Fiecare exceptie are un motiv scris; lista trebuie sa ramana scurta.
const CI_ONLY = new Map([
  [
    'verify-typecheck-baseline-delta.mjs',
    'ajutor de CI: compara doua rulari tsc si cere patru argumente '
      + '(vezi .github/workflows/patient-conversation-self-hosted-validation-ci.yml)',
  ],
]);

// Se exclude pe sine: altfel `verify-all.mjs` se potriveste cu propriul sablon si se
// invoca recursiv pana la timeout.
const SELF = path.basename(fileURLToPath(import.meta.url));

const files = fs.readdirSync(scriptsDir)
  .filter((name) => name.startsWith('verify-') && name.endsWith('.mjs') && name !== SELF)
  .sort();

const skipped = [];
const failed = [];
let passed = 0;

for (const name of files) {
  if (CI_ONLY.has(name)) {
    skipped.push({ name, reason: CI_ONLY.get(name) });
    continue;
  }
  const result = spawnSync(process.execPath, [path.join('scripts', name)], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status === 0) {
    passed += 1;
    continue;
  }
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n');
  const reason = output.find((line) => /AssertionError|Error:|^FAIL /.test(line)) || output[0] || 'esec necunoscut';
  failed.push({ name, reason: reason.trim().slice(0, 200) });
}

for (const item of skipped) console.log(`SKIP ${item.name} — ${item.reason}`);
for (const item of failed) console.log(`FAIL ${item.name} — ${item.reason}`);

console.log(`\n${passed} verificari au trecut, ${failed.length} au esuat, ${skipped.length} sarite (${files.length} scripturi).`);

if (failed.length > 0) process.exit(1);
