// Variabile nedefinite in `src` (2026-09-30).
//
// Tăierea lui MatchResults.jsx a lăsat `moreCount` nedefinit: ecranul de recomandări se prăbușea la
// randare, iar nicio verificare nu se uita la asta (regula `no-undef` nu e în configurarea obișnuită
// de lint, și testele citesc doar sursa ca text). Tot atunci s-a găsit `TeamCard` din ProviderProfile,
// care folosea `resultsReturn` definit doar în pagina părinte. Aici `no-undef` rulează pe tot `src`:
// orice nume folosit fără să fie definit sau importat pică verificarea, înainte de publicare.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules/eslint/bin/eslint.js'), '--quiet', '--rule', '{"no-undef":"error"}', 'src'],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);

assert.equal(
  run.status,
  0,
  `variabile nedefinite in src:\n${run.stdout || ''}${run.stderr || ''}`,
);

console.log('verify-no-undefined-variables: ok');
