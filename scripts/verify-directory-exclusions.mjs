// Verifica lista de firme excluse din director (base44/shared/directoryExclusionPolicy.js):
// 1. randurile reale din registrul national pentru 9Optik sunt excluse, pe oricare cale;
// 2. firmele cu nume asemanatoare NU sunt prinse din greseala;
// 3. ambele selectii de import (automata si campania nationala) aplica excluderea.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCLUDED_DIRECTORY_ORGANIZATIONS,
  directoryExclusionReason,
  matchDirectoryExclusion,
} from '../base44/shared/directoryExclusionPolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

assert.ok(EXCLUDED_DIRECTORY_ORGANIZATIONS.some((entry) => entry.key === '9optik'));

// Randuri reale din viasee_directory_registry_v8 (campurile relevante).
const nineOptikRows = [
  { location_display_name: '9Optik Promenada Sibiu', organization_display_name: '9Optik', official_source_url: 'https://9optik.ro/sibiu/', confirmed_location_email: 'office@9optik.ro' },
  { location_display_name: '9Optik Kaufland Calea Cisnădiei', organization_display_name: '9Optik', official_source_url: 'https://9optik.ro/sibiu/', confirmed_location_email: 'office@9optik.ro' },
  { location_display_name: '9Optik Shopping City Sibiu', organization_display_name: '9Optik', official_source_url: 'https://9optik.ro/9optik-optica-medicala-sibiu-selimbar/' },
];
for (const row of nineOptikRows) {
  assert.equal(directoryExclusionReason(row), 'excluded_by_admin', `${row.location_display_name} trebuie exclus`);
}
// Oricare dintre semnale e suficient singur: domeniul site-ului, al emailului, numele firmei.
assert.equal(directoryExclusionReason({ location_display_name: 'Showroom nou', official_source_url: 'https://www.9optik.ro/brasov' }), 'excluded_by_admin');
assert.equal(directoryExclusionReason({ location_display_name: 'Showroom nou', confirmed_location_email: 'brasov@9optik.ro' }), 'excluded_by_admin');
assert.equal(directoryExclusionReason({ location_display_name: 'Magazin', organization_display_name: '9 Optik' }), 'excluded_by_admin');
assert.equal(directoryExclusionReason({ location_name: '9 OPTIK Brasov' }), 'excluded_by_admin');

// Firme reale din director care NU trebuie prinse.
const unrelated = [
  { location_display_name: 'Optiplaza Shopping City Sibiu', organization_display_name: 'Optiplaza', official_source_url: 'https://www.optiplaza.ro/magazine/sibiu-shopping-city.html', confirmed_location_email: 'sibiu.shoppingcity@optiplaza.ro' },
  { location_display_name: 'Clarity Vision Piața 9 Mai', organization_display_name: 'Clarity Vision' },
  { location_display_name: 'Optik Tataru', organization_display_name: 'Optik Tataru', confirmed_location_email: 'optiktataruoffice@gmail.com' },
  { location_display_name: 'Zeno Optik', organization_display_name: 'Zeno Optik', public_email: 'office@zeno-optik.ro' },
  { location_display_name: 'iOptik', organization_display_name: 'iOptik', public_email: 'shops@ioptik.ro' },
  { location_display_name: 'Optica 99Optik fictiva', organization_display_name: 'Alt brand', official_source_url: 'https://99optik.ro' },
  { location_display_name: 'Magazin', official_source_url: 'https://not9optik.ro' },
];
for (const row of unrelated) {
  assert.equal(matchDirectoryExclusion(row), null, `${row.location_display_name} NU trebuie exclus`);
}

// Ambele selectii de import aplica excluderea, inaintea oricarei alte reguli.
const autoOps = source('base44/functions/directoryOps/directoryAutoImportOps.ts');
assert.match(autoOps, /import \{ directoryExclusionReason \} from '\.\.\/\.\.\/shared\/directoryExclusionPolicy\.js';/);
for (const fn of ['nationalSelectionReasons', 'automaticSelectionReasons']) {
  const start = autoOps.indexOf(`function ${fn}(`);
  assert.ok(start !== -1, `${fn} lipseste`);
  const head = autoOps.slice(start, start + 400);
  assert.match(head, /directoryExclusionReason\(row\)/, `${fn} trebuie sa aplice lista de excluderi`);
}

console.log(JSON.stringify({ excluded_organizations: EXCLUDED_DIRECTORY_ORGANIZATIONS.map((entry) => entry.key) }));
