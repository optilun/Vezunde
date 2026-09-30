// MatchResults.jsx taiat in bucati (2026-09-30). Refactorizare fara schimbari de comportament:
//   - src/hooks/useRecommendationExpansion.js   extinderea zonei (judet / tara), lista si meta-ul dupa extindere
//   - src/lib/recommendationSections.js         impartirea pe bucketuri (pura, doar dupa result_bucket)
//   - src/components/intake2/ResultScopeGroups.jsx, RecommendationExtendedSections.jsx   doar asezarea
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const { splitByBucket, groupStructural } = await import(pathToFileURL(path.join(root, 'src/lib/recommendationSections.js')).href);

// --- 1. Impartirea pe bucketuri: doar dupa result_bucket, in ordinea primita --------------------
{
  const rows = [
    { id: 'a', result_bucket: 'top3' },
    { id: 'b', result_bucket: 'extended_confirmed' },
    { id: 'c', result_bucket: 'top3' },
    { id: 'd', result_bucket: 'structural_directory', structural_capability: 'optical' },
    { id: 'e', result_bucket: 'extended_directory' },
    { id: 'f', result_bucket: 'top3' },
    { id: 'g', result_bucket: 'top3' },
    { id: 'h', result_bucket: 'nimic' },
  ];
  const { top3, confirmed, directory, structural } = splitByBucket(rows);
  assert.deepEqual(top3.map((row) => row.id), ['a', 'c', 'f', 'g'], 'Top 3 = result_bucket, nu primele trei: nu se taie pozitional');
  assert.deepEqual(confirmed.map((row) => row.id), ['b']);
  assert.deepEqual(directory.map((row) => row.id), ['e']);
  assert.deepEqual(structural.map((row) => row.id), ['d']);
  const all = [...top3, ...confirmed, ...directory, ...structural];
  assert.ok(!all.some((row) => row.id === 'h'), 'un bucket necunoscut nu intra in nicio sectiune');
  assert.deepEqual(splitByBucket(null), { top3: [], confirmed: [], directory: [], structural: [] });
  assert.equal(rows[0].id, 'a', 'lista primita nu se modifica');
}

// --- 2. Grupurile structurale: fiecare tip cu titlul lui, in ordinea primita ---------------------
{
  const groups = groupStructural([
    { id: '1', structural_capability: 'optical', structural_group_note: 'Nota optica' },
    { id: '2', structural_capability: 'medical' },
    { id: '3', structural_capability: 'optical', structural_group_label: 'Titlu de la server' },
    { id: '4' },
  ]);
  assert.deepEqual(groups.map((group) => group.capability), ['optical', 'medical'], 'ordinea primului aparut');
  assert.deepEqual(groups[0].items.map((row) => row.id), ['1', '3', '4'], 'un rand fara tip intra in optice');
  assert.equal(groups[0].label, 'Alte optici din zonă', 'eticheta implicita');
  assert.equal(groups[0].note, 'Nota optica', 'nota vine de la server, de la primul rand');
  assert.equal(groups[1].label, 'Alte cabinete și clinici oftalmologice din zonă');
  assert.deepEqual(groupStructural(undefined), []);
}

// --- 3. Hook-ul de extindere: aceleasi apeluri si aceleasi evenimente ------------------------------
{
  const hook = read('src/hooks/useRecommendationExpansion.js');
  assert.match(hook, /export default function useRecommendationExpansion\(/);
  assert.match(hook, /matchProvidersInSelectedCounty\(draft\)/);
  assert.match(hook, /matchProvidersNationally\(draft\)/);
  for (const event of ['county', 'national']) {
    for (const step of ['started', 'completed', 'failed']) {
      assert.match(hook, new RegExp(`patient_search_${event}_expansion_${step}`), `${event} ${step}`);
    }
  }
  assert.equal((hook.match(/expansionBusy\.current = true;/g) || []).length, 2, 'o extindere la un moment dat');
  assert.equal((hook.match(/expansionBusy\.current = false;/g) || []).length, 2);
  assert.equal((hook.match(/expandedCallback\.current\?\.\(\);/g) || []).length, 2, 'dupa fiecare extindere reusita ecranul isi inchide sectiunile');
  assert.match(hook, /storePatientRequestDraft\(nextDraft\)/);
  assert.match(hook, /onExpandedSnapshot\?\.\(snapshot\)/);
  assert.match(hook, /const list = useMemo\(/, 'lista stabila intre randari');
  assert.doesNotMatch(hook, /\.sort\(|\.slice\(0,\s*3\)|recommendation_score/, 'fara reordonare si fara Top 3 taiat');
  assert.doesNotMatch(hook, /setShowMore|setZoneOpen/, 'hook-ul nu stie de starea ecranului');
}

// --- 4. Ecranul: foloseste hook-ul, nu mai are extinderea in el ------------------------------------
{
  const screen = read('src/components/intake2/MatchResults.jsx');
  assert.match(screen, /= useRecommendationExpansion\(\{/);
  assert.match(screen, /onExpanded: \(\) => \{ setShowMore\(false\); setZoneOpen\(false\); \}/);
  assert.doesNotMatch(screen, /const expandCounty|const expandNational|matchProvidersInSelectedCounty|matchProvidersNationally/);
  assert.match(screen, /const \{ top3, confirmed, directory, structural \} = splitByBucket\(filteredList\);/);
  assert.match(screen, /const serverTop3Count = list\.filter\(\(result\) => result\.result_bucket === "top3"\)\.length;/, 'starea recomandarii ramane pe lista completa a serverului');
  assert.match(screen, /<RecommendationExtendedSections/);
  assert.ok(screen.split('\n').length < 520, `MatchResults.jsx are ${screen.split('\n').length} linii (tinta < 520)`);
}

console.log('verify-recommendation-refactor: ok');
