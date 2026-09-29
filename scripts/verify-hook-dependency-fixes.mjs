// Reparatiile gasite cu regula `react-hooks/exhaustive-deps` (2026-09-29, dupa auditul /cauta, D4).
//
// - profilul public al organizatiei: fara organizatie, rezerva era un `{}` nou la fiecare randare,
//   iar efectul care reface formularul din el rula in bucla;
// - fotografia locatiei: curatarea elibera previzualizarea de la montare, nu pe cea curenta;
// - spatiul furnizorului: ascultatorul de focus pastra functia de reimprospatare de la abonare;
// - listele de rezerva (`|| []`, `|| {}`) sunt aceleasi intre randari, ca memo-urile sa tina.
// Cazurile intentionate (reincarcare doar la schimbarea locatiei etc.) au comentariu cu motivul.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const P = 'src/components/workspace/provider/';

const profile = read(`${P}ProviderProfilePublic.jsx`);
assert.match(profile, /const NO_ORGANIZATION = \{\};/);
assert.match(profile, /overview\.organization \|\| workspace\?\.organizations\?\.\[0\] \|\| NO_ORGANIZATION;/, 'rezerva stabila, fara bucla de randari');

const photo = read(`${P}ProviderLocationPhotoCompact.jsx`);
assert.match(photo, /stagedPreviewRef\.current = stagedPreview;/);
assert.match(photo, /if \(stagedPreviewRef\.current\.startsWith\("blob:"\)\) URL\.revokeObjectURL\(stagedPreviewRef\.current\);/, 'se elibereaza previzualizarea curenta');

const root = read(`${P}ProviderWorkspaceRoot.jsx`);
assert.match(root, /refreshOverviewLatest\.current = refreshOverviewInPlace;/);
assert.match(root, /const refreshOnFocus = \(\) => \{ void refreshOverviewLatest\.current\(\); \};/, 'focusul cheama ultima versiune');
assert.match(root, /const baseContextLocations = useMemo\(/);
assert.match(root, /const baseContextMemberships = useMemo\(/);

const settings = read(`${P}ProviderSettings.jsx`);
assert.match(settings, /const locations = workspace\?\.locations \|\| NO_LOCATIONS;/);
assert.match(settings, /current_user_role_by_location \|\| NO_ROLES;/);

assert.match(read(`${P}ProviderServicesEditor.jsx`), /useEffect\(\(\) => \{ onDirtyChange\?\.\(m\.dirty\); \}, \[m\.dirty, onDirtyChange\]\);/);
assert.match(read('src/components/admin/directory/DirOpsMapping.jsx'), /\}, \[load, query\]\);/);

// Fluxul de cerere (2026-09-29, cerut explicit de Alex: „Ocupa te de restul”). Nicio schimbare in
// potrivire, Top 3 sau ordine: doar liste stabile intre randari si functii citite la zi.
const I = 'src/components/intake2/';
const matchResults = read(`${I}MatchResults.jsx`);
assert.match(matchResults, /const NO_RESULTS = Object\.freeze\(\[\]\);/);
assert.match(matchResults, /const list = useMemo\(\(\) => \(Array\.isArray\(expandedSnapshot\?\.results\)/, 'lista stabila: harta nu mai e anuntata la fiecare randare');
assert.match(matchResults, /visibleResultsChanged\.current\?\.\(list\);\s*\}, \[list\]\);/);
assert.match(matchResults, /resultModeChanged\.current\?\.\(resultMode\);\s*\}, \[resultMode\]\);/);
assert.match(matchResults, /const serverTop3Count = list\.filter\(\(result\) => result\.result_bucket === "top3"\)\.length;/, 'Top 3 numarat ca inainte');
const card = read(`${I}ConversationalCard.jsx`);
assert.match(card, /const matchingRequest = matchingRequestRef\.current;/);
assert.match(card, /return \(\) => questionSelectionGuard\.invalidate\(\);/);
assert.match(card, /-- propunerea confirmata se citeste la pornirea potrivirii/, 'fara a doua cerere de potrivire');
assert.match(read(`${I}PatientRequestSubmission.jsx`), /const submissionGuard = submissionGuardRef\.current;/);
assert.match(read(`${I}ProfessionalResults.jsx`), /const results = useMemo\(\(\) => \(Array\.isArray\(state\.data\?\.results\)/);
assert.match(read(`${I}RequestWorkspace.jsx`), /const responses = useMemo\(\(\) => status\?\.responses \|\| \[\], \[status\?\.responses\]\);/);

// Fiecare exceptie are motivul scris langa ea.
for (const file of [
  'src/components/admin/directory/DirOpsCorrections.jsx', 'src/components/provider/ClaimForm.jsx',
  `${P}ProviderArticles.jsx`, `${P}ProviderTeam.jsx`, `${P}leads/ProviderBillingPanel.jsx`, 'src/pages/MyAccount.jsx',
  'src/components/intake2/ConversationalCard.jsx', 'src/components/intake2/PatientRequestSubmission.jsx',
]) {
  const source = read(file);
  const bare = source.split('\n').filter((line) => line.includes('eslint-disable-next-line react-hooks/exhaustive-deps') && !line.includes(' -- '));
  assert.deepEqual(bare, [], `${file}: exceptie fara motiv`);
  assert.match(source, /eslint-disable-next-line react-hooks\/exhaustive-deps -- /, `${file}: exceptia documentata`);
}

console.log('Hook dependency fixes checks passed.');
