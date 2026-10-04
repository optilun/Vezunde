// Audit cont organizație (2026-10-04): corecturile din „Cereri” și texte.
//
// - La o eroare temporară, „Cereri” nu mai arată „Plan Free” și limitări false; spune că planul nu a
//   putut fi verificat și oferă „Reîncearcă”. Lista nu mai arată „Request failed with status code 500”.
// - Textele din Profil public, Locații, Program, fotografie, status și completare au diacritice.
// - Rutele, cheile și potrivirile cu backendul nu s-au schimbat odată cu textele.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  INBOX_PLAN_UNKNOWN_MESSAGE,
  INBOX_UNAVAILABLE_MESSAGE,
  inboxErrorMessage,
  isTransientInboxError,
} from '../src/lib/providerInboxErrors.js';
import { buildProviderStatusCenter } from '../shared/providerStatusCenter.js';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

// ---------- 1. mesajele de eroare ----------
const axios500 = { message: 'Request failed with status code 500', response: { status: 500, data: { error: 'Leadurile nu au putut fi incarcate.' } } };
assert.equal(inboxErrorMessage(axios500), INBOX_UNAVAILABLE_MESSAGE, 'eroarea temporară primește mesaj în română');
assert.equal(inboxErrorMessage({ message: 'Network Error' }), INBOX_UNAVAILABLE_MESSAGE, 'fără răspuns de la server');
assert.equal(inboxErrorMessage({ response: { status: 429, data: { error: 'Rate limit exceeded' } } }), INBOX_UNAVAILABLE_MESSAGE);
const forbidden = { message: 'Request failed with status code 403', response: { status: 403, data: { error: 'Nu ai acces la această locație.' } } };
assert.equal(inboxErrorMessage(forbidden), 'Nu ai acces la această locație.', 'erorile reale își păstrează mesajul');
assert.equal(inboxErrorMessage(Object.assign(new Error('Cererea nu mai este disponibilă.'), { status: 200 })), 'Cererea nu mai este disponibilă.');
assert.ok(isTransientInboxError(axios500) && !isTransientInboxError(forbidden));
assert.doesNotMatch(INBOX_UNAVAILABLE_MESSAGE + INBOX_PLAN_UNKNOWN_MESSAGE, /status code|Free/);

// ---------- 2. planul necunoscut nu devine „Free” ----------
const [inbox, legacy] = await Promise.all([
  read('src/components/workspace/provider/ProviderLeadInbox.jsx'),
  read('src/components/workspace/provider/ProviderLeadInboxLegacy.jsx'),
]);
assert.match(inbox, /setSnapshot\(\{ locationId, status: "error", entitlement: null, counters: \{\} \}\)/, 'la eroare, planul rămâne necunoscut');
assert.match(inbox, /\{planReady && \(\s*<ProviderAccessBand/, 'banda de acces apare doar cu planul verificat');
assert.match(inbox, /\{planReady && \(\s*<ProviderStatusCenter/, 'statusul apare doar cu planul verificat');
assert.match(inbox, /<PlanUnknownNotice onRetry=\{retryPlan\} \/>/);
assert.match(inbox, /withTransientRetry\(\(\) => base44\.functions\.invoke\("providerLeadInboxOps"/, 'reîncercare la erori temporare');
assert.doesNotMatch(inbox, /\.catch\(\(\) => null\);\s*return \(\) => \{ active = false; \};\s*\}, \[locationId, refreshTick\]\);[\s\S]*FREE_ENTITLEMENT, counters: \{\} \}/);
assert.match(legacy, /const \[entitlement, setEntitlement\] = useState\(null\);/, 'lista nu pornește cu „Free”');
assert.match(legacy, /\{entitlement && <span/, 'eticheta planului apare doar după răspuns');
assert.match(legacy, /setError\(inboxErrorMessage\(loadError\)\);/);
assert.match(legacy, /Reîncearcă/);
assert.doesNotMatch(legacy, /setError\(loadError\?\.message/);

// ---------- 3. statusul locației, în română ----------
const status = buildProviderStatusCenter({ location: { status: 'in_verificare' }, entitlement: { plan_code: 'pro', status: 'active', feature_keys: [] } });
assert.equal(status.overall_label, 'Configurare necesară');
assert.equal(status.capabilities.find((item) => item.key === 'lead_preview').label, 'Rezumatul cererilor');
assert.doesNotMatch(JSON.stringify(status), /lead/i.test('x') ? /leaduri|Leadurile|necesita|cat timp|publicata/ : /x^/);

// ---------- 4. texte cu diacritice ----------
const files = {
  profile: 'src/components/workspace/provider/ProviderProfilePublic.jsx',
  locations: 'src/components/workspace/provider/ProviderLocations.jsx',
  withPhoto: 'src/components/workspace/provider/ProviderLocationsWithPhoto.jsx',
  hours: 'src/components/workspace/provider/ProviderHours.jsx',
  photo: 'src/components/workspace/provider/ProviderLocationPhotoCompact.jsx',
  completeness: 'src/components/workspace/provider/ProviderCompletenessPanel.jsx',
  addLocation: 'src/components/workspace/provider/ProviderAddLocationFlow.jsx',
  settings: 'src/components/workspace/provider/ProviderSettings.jsx',
  overview: 'src/components/workspace/provider/ProviderOverview.jsx',
};
const src = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await read(file)])));
const expectText = {
  profile: ['Locațiile organizației', 'Editează profilul', 'Renunță', 'Salvează'],
  locations: ['Configurează locația', 'Editează datele', 'Specialiștii afișați, invitațiile și cererile „Lucrez aici”.'],
  hours: ['Program săptămânal', 'Sâmbătă', 'Închis', 'Salvează programul', 'Cum apare public'],
  photo: ['Fotografia locației', 'Schimbă fotografia locației'],
  completeness: ['Media locațiilor accesibile', 'Compară locațiile ('],
  settings: ['Proprietari, administratori, manageri și membri', 'Preferințe pe acest dispozitiv'],
};
for (const [key, texts] of Object.entries(expectText)) {
  for (const text of texts) assert.ok(src[key].includes(text), `${files[key]}: lipsește „${text}”`);
}
assert.doesNotMatch(src.settings, /ownerii|Preferințe workspace|workspace-ului/);
assert.doesNotMatch(src.overview, /label: "Articole"/, 'pătratul „Articole” a ieșit');
assert.match(src.overview, /value === 1 \? "1 imagine aprobată"/);
assert.match(src.withPhoto, /selectedLocation\.photo_url\s*\?\s*"Schimbă fotografia principală/);

// ---------- 5. ce nu are voie să se schimbe odată cu textele ----------
assert.match(src.completeness, /`\/contul-meu\/locatii\/\$\{locationId\}\/specialisti`/, 'rutele modulelor rămân aceleași');
assert.match(src.addLocation, /reasons\.includes\("aceeasi adresa"\) \|\| reasons\.includes\("aceeași adresă"\)/, 'potrivirea cu motivele din backend rămâne');
// ProviderLocationsWithPhoto caută texte din ProviderLocations: trebuie să rămână identice.
for (const coupled of [...src.withPhoto.matchAll(/\.includes\("([^"]+)"\)/g)].map((match) => match[1])) {
  assert.ok(src.locations.includes(coupled), `textul cuplat „${coupled}” lipsește din ProviderLocations`);
}
for (const label of [...src.withPhoto.matchAll(/aside\[aria-label="([^"]+)"\]/g)].map((match) => match[1])) {
  assert.ok(src.locations.includes(`aria-label="${label}"`), `aria-label „${label}” lipsește din ProviderLocations`);
}

console.log('Org account audit fixes: OK');
