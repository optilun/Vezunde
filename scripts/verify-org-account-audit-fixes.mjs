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
import { isLocationClosed, isLocationPubliclyVisible } from '../src/lib/providerLocationVisibility.js';
import { formatLocationAddress, formatStreetAddress } from '../src/lib/addressDisplay.js';
import { countApprovedServiceKeys, splitApprovedServiceCounts } from '../base44/shared/providerServiceCounts.js';

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
const [inbox, legacy, access] = await Promise.all([
  read('src/components/workspace/provider/ProviderLeadInbox.jsx'),
  read('src/components/workspace/provider/ProviderLeadInboxLegacy.jsx'),
  read('src/components/workspace/provider/ProviderRequestAccessSettings.jsx'),
]);
assert.doesNotMatch(inbox, /ProviderAccessBand|ProviderStatusCenter/, 'panourile administrative sunt in Setari');
assert.match(access, /const \[data, setData\] = useState\(null\);/, 'planul necunoscut nu devine Free');
assert.match(access, /data \? <ProviderStatusCenter/, 'statusul apare doar dupa verificarea planului');
assert.match(access, /INBOX_PLAN_UNKNOWN_MESSAGE/);
assert.match(access, /Reîncearcă/);
assert.match(access, /withTransientRetry/);
assert.match(legacy, /const entitlement = current\?\.entitlement;/, 'planul vine numai din raspunsul curent');
assert.match(legacy, /entitlement\?\.plan_code !== "pro" && current/, 'nota Free apare doar dupa raspuns');
assert.match(legacy, /setError\(inboxErrorMessage\(cause\)\)/);
assert.match(legacy, /Reîncearcă/);
assert.doesNotMatch(legacy, /FREE_ENTITLEMENT|setError\(cause\?\.message/);

// ---------- 3. statusul locației, în română ----------
const status = buildProviderStatusCenter({ location: { status: 'in_verificare' }, entitlement: { plan_code: 'pro', status: 'active', feature_keys: [] } });
assert.equal(status.overall_label, 'Configurare necesară');
assert.equal(status.capabilities.find((item) => item.key === 'lead_preview').label, 'Rezumatul cererilor');
assert.doesNotMatch(JSON.stringify(status.capabilities), /leaduri|Leadurile|necesita|cat timp|Locatia/);

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
  // 2026-10-08: pasul de verificare al programului (din 2026-10-05) se numeste acum „Verifică informațiile afișate clienților”.
  hours: ['Program săptămânal', 'Sâmbătă', 'Închis', 'Salvează programul', 'Verifică informațiile afișate clienților'],
  // 2026-10-08: butonul se numeste „Schimbă fotografia” (fara „locatiei”, din 2026-10-05).
  photo: ['Fotografia locației', 'Schimbă fotografia'],
  completeness: ['Media locațiilor active', 'Nicio locație activă', 'Compară locațiile (', 'Inactivă'],
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
for (const coupled of [...src.withPhoto.matchAll(/\.includes\("([^"]+)"\)/g)].map((match) => match[1]).filter((text) => /\s/.test(text))) {
  assert.ok(src.locations.includes(coupled), `textul cuplat „${coupled}” lipsește din ProviderLocations`);
}
for (const label of [...src.withPhoto.matchAll(/aside\[aria-label="([^"]+)"\]/g)].map((match) => match[1])) {
  assert.ok(src.locations.includes(`aria-label="${label}"`), `aria-label „${label}” lipsește din ProviderLocations`);
}

// ---------- 6. etapa 2: cifre coerente ----------
const [overviewBackend, completenessBackend, rootSrc, shellSrc, hoursSrc, teamLinks] = await Promise.all([
  read('base44/functions/getMyProviderWorkspace/getProviderWorkspaceOverview.ts'),
  read('base44/functions/getMyProviderWorkspace/getProviderProfileCompleteness.ts'),
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('src/components/provider/shell/ProviderAppShell.jsx'),
  read('src/components/workspace/provider/ProviderHours.jsx'),
  read('src/components/workspace/provider/ProviderTeamSpecialistsLinks.jsx'),
]);
assert.match(overviewBackend, /computeLocationCompleteness as computeSharedLocationCompleteness/, 'Prezentarea folosește aceeași regulă de completare');
assert.doesNotMatch(overviewBackend, /^function computeLocationCompleteness\(/m, 'regula veche, cu 5 puncte, a ieșit');
assert.match(overviewBackend, /content: getLocationContentSummary\(contentIndex, location, userId\)/);
assert.match(completenessBackend, /locationCompletions: locationRows\.filter\(\(item\) => item\.active\)/, 'media pe locațiile active, ca în Prezentare');
assert.match(src.overview, /activeLocationCount === 0\s*\?\s*"Nicio locație activă"/, 'fără locații active nu spunem „neverificate”');
assert.match(src.overview, /: "Nicio locație activă"\}/);
assert.match(src.overview, /flex flex-wrap items-baseline justify-between/, 'procentul nu mai e tăiat');

// ---------- 7. etapa 2: locația închisă sau nepublică ----------
assert.equal(isLocationPubliclyVisible({ id: 'L1', status: 'publicata', public_visibility_status: 'approved', active_status: 'activa' }), true);
assert.equal(isLocationPubliclyVisible({ id: 'L1', status: 'in_verificare', public_visibility_status: 'archived', active_status: 'inactiva' }), false);
assert.equal(isLocationPubliclyVisible({ id: 'L1', status: 'publicata', public_visibility_status: 'approved', profile_control_status: 'suspended' }), false);
assert.equal(isLocationClosed({ active_status: 'inactiva' }), true);
assert.match(shellSrc, /publicProfileUrl && publicProfileAvailable && \(/, 'linkul public doar pentru profil public');
assert.match(shellSrc, /Profil nepublicat/);
assert.match(rootSrc, /publicProfileAvailable=\{selectedLocationPublic\}/);
assert.match(rootSrc, /publicProfileUrl=\{selectedLocationId && selectedLocationPublic \?/);
assert.match(src.settings, /\{locationClosed && \(\s*<SettingsRow\s*title="Locația este închisă în VIASEE"/, 'zona de pericol nu mai e goală');
assert.match(src.settings, /Cere redeschiderea/);
// 2026-10-08: eticheta „Locație închisă: nu apare public” era în antetul vechi al modulului Program (audit 2026-10-04, #15).
// Redesign-ul editorului din 2026-10-05 a înlocuit antetul; același mesaj e acum la pasul „Verifică informațiile afișate clienților”,
// iar pentru o locație deschisă textul spune „Dacă profilul locației este public, noul program apare imediat.”
assert.match(hoursSrc, /location\.active_status === "inactiva" \? "Locația este inactivă și nu apare public\."/);
// 2026-10-08: eticheta „Fotografie aprobată” e acum in legenda imaginii (nu intr-un <span> propriu), din 2026-10-05.
assert.match(src.photo, /Fotografie aprobată/);
assert.match(src.profile, /location\?\.active_status === "inactiva" && \(/);
assert.match(teamLinks, /Specialiștii apar public doar la locațiile active/);

// ---------- 8. etapa 3: „Plan și acces”, adresa, numărul de servicii ----------
assert.doesNotMatch(inbox, /<ProviderBillingPanel/, 'facturarea nu se dubleaza in Cereri');
assert.match(src.settings, /\["requests", "Plan și acces"\]/, 'Plan si acces este in Setari');
assert.match(src.settings, /<ProviderRequestAccessSettings/);
assert.match(access, /<ProviderStatusCenter/);
assert.match(access, /Deschide facturarea/);
assert.match(rootSrc, /onOpenRequestSettings=\{canManageSettings \? openRequestSettings : undefined\}/);
assert.match(rootSrc, /onOpenBilling=\{canManageSettings \? openBillingSettings : undefined\}/);
assert.match(rootSrc, /next\.set\("tab", "billing"\);\s*routerNavigate\(providerSectionUrl\(next, "settings"\)\);/);

assert.equal(formatStreetAddress('Strada Republicii 10'), 'Strada Republicii 10', '#16: „Strada” nu mai devine „Str. ada”');
assert.equal(formatStreetAddress('STR. MIHAI VITEAZU NR. 5, ET.'), 'Str. Mihai Viteazu nr. 5', '#16: fără majuscule și fără „ET.” rămas gol');
assert.equal(formatStreetAddress('Piata Bufet'), 'Piata Bufet', '#16: nu taie sfârșitul cuvintelor');
assert.equal(formatStreetAddress('Bd. Unirii nr. 3, bl. A2, ap.'), 'Bd. Unirii nr. 3, bl. A2');
assert.equal(formatStreetAddress('Cluj-Napoca, Strada Horea 4', 'Cluj-Napoca'), 'Strada Horea 4');
assert.equal(formatLocationAddress({ address: 'STR. LUNGA NR. 7, ET.', city: 'BRAȘOV', county: 'Brașov' }), 'Str. Lunga nr. 7, Brașov');
assert.equal(formatLocationAddress({}, 'Adresa nu este completată'), 'Adresa nu este completată');
assert.equal(formatStreetAddress('SAT GIROC, STR. CUPIDON, NR.40, ET.', 'Giroc'), 'Str. Cupidon, nr. 40', '#16: adresa din contul de test');
assert.equal(formatStreetAddress('Str. Sucedava nr. 21, Roman', 'Roman'), 'Str. Sucedava nr. 21', '#16: localitatea nu se repetă');
assert.equal(formatStreetAddress('Str. Semaforului, Nr. 4, Sibiu, 557260, România', 'Sibiu'), 'Str. Semaforului, nr. 4');
assert.equal(formatStreetAddress('Strada Romană 3, Roman', 'Roman'), 'Strada Romană 3', 'numele străzii rămâne întreg');
for (const file of ['src/pages/ProviderProfile.jsx', 'src/components/workspace/provider/ProviderLocationsWithPhoto.jsx', 'src/components/workspace/provider/ProviderProfilePublic.jsx', 'src/components/workspace/provider/ProviderLocations.jsx']) {
  assert.match(await read(file), /from "@\/lib\/addressDisplay"/, `${file}: aceeași regulă de afișare a adresei`);
}

const services = [{ id: 's1', service_key: 'consult' }, { id: 's2', service_key: 'oct' }];
const mirrored = [{ id: 'p1', specialization_key: 'oct' }, { id: 'p2', specialization_key: 'legacy_only' }];
assert.equal(countApprovedServiceKeys(services, mirrored), 3, '#18: specializarea-oglindă nu se numără de două ori');
assert.equal(countApprovedServiceKeys([], []), 0);
// Cazul real din contul de test: 21 de servicii + 5 opțiuni ale locației = 26 de rânduri.
const withOptions = [
  ...['refraction', 'frames', 'eyeglasses'].map((key, index) => ({ id: `o${index}`, service_key: key })),
  ...['home_visit_eye_care', 'workplace_vision_screening'].map((key, index) => ({ id: `g${index}`, service_key: key })),
];
assert.deepEqual(splitApprovedServiceCounts(withOptions, []), { services: 3, location_options: 2 }, '#18: opțiunile locației se numără separat, ca în modulul Servicii');
const overviewSource = await read('base44/functions/getMyProviderWorkspace/getProviderWorkspaceOverview.ts');
assert.match(overviewSource, /approved_offer_service_count: serviceSplit\.services,/);
assert.match(overviewSource, /approved_location_option_count: total\.approved_location_option_count \+ summary\.approved_location_option_count,/);
assert.match(src.overview, /value: contentSummary\.approved_offer_service_count \?\? contentSummary\.approved_service_count \?\? 0/);
assert.match(src.overview, /`\+ \$\{value\} opțiuni ale locației`/);
for (const file of ['getProviderWorkspaceOverview.ts', 'getMyProviderWorkspace.ts', 'getProviderProfileCompleteness.ts']) {
  const source = await read(`base44/functions/getMyProviderWorkspace/${file}`);
  assert.match(source, /approved_service_count: countApprovedServiceKeys\(services, specialties\)/, `${file}: același număr de servicii`);
  assert.doesNotMatch(source, /services\.length \+ specialties\.length/);
}
const servicesEditor = await read('src/components/workspace/provider/ProviderServicesEditor.jsx');
assert.match(servicesEditor, /Fără servicii selectate: \{emptyUnits\.map\(unitLabel\)\.join\(" · "\)\}/, '#18: spațiile fără servicii se văd în rezumat');

console.log('Org account audit fixes: OK');
