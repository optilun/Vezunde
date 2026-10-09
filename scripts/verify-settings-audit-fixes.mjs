// Audit Setări (2026-10-09): Setările contului, Setările organizației și „Ajutor și suport”.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const [account, profile, settings, help, sidebar, billing, eligibility, roleFn, deactivateFn] = await Promise.all([
  read('src/components/workspace/account/AccountSettings.jsx'),
  read('src/components/workspace/account/PersonalProfileSettings.jsx'),
  read('src/components/workspace/provider/ProviderSettings.jsx'),
  read('src/pages/HelpSupport.jsx'),
  read('src/components/provider/shell/ProviderSidebarContent.jsx'),
  read('src/components/workspace/provider/leads/ProviderBillingPanel.jsx'),
  read('base44/functions/getMyProviderWorkspace/getMyAccountDeletionEligibility.ts'),
  read('base44/functions/updateProviderMemberRole/entry.ts'),
  read('base44/functions/deactivateProviderMember/entry.ts'),
]);

// S1: diacritice în Setările contului și în profilul personal.
for (const text of ['Setările contului', 'Setări globale', 'Contul tău', 'Spațiile aceluiași cont', 'Preferințe aplicație', 'Sesiunea curentă', 'Confidențialitate și date', 'Termeni și condiții', 'Contul nu poate fi șters momentan']) {
  assert.ok(account.includes(text), `S1: „${text}”`);
}
for (const text of ['Setarile contului', 'Setari globale', 'Contul tau', 'Preferinte aplicatie', 'Retine ultima locatie', 'Termeni si conditii']) {
  assert.ok(!account.includes(text), `S1: rămas fără diacritice: „${text}”`);
}
for (const text of ['Fotografie de profil', 'Adaugă fotografia', 'Descriere scurtă', 'Salvează profilul']) assert.ok(profile.includes(text), `S1: „${text}”`);

// S2: fără termeni interni.
for (const text of ['Base44 gestioneaza', 'Base44 gestionează', 'workspace-ul', 'Workspace furnizor', 'infrastructura actuala', 'infrastructura actuală', 'rolul de owner', 'Rolul de owner', 'ultim owner']) {
  assert.ok(!account.includes(text), `S2: termen intern rămas: „${text}”`);
}
assert.match(eligibility, /Ești ultimul proprietar activ al \$\{organizationName\}/);
assert.doesNotMatch(eligibility, /message: `Esti ultimul owner/);
for (const source of [roleFn, deactivateFn]) assert.match(source, /Nu poți elimina ultimul proprietar activ al organizației/);

// S3: blocajul apare o singură dată.
assert.doesNotMatch(account, /Rolul de owner trebuie transferat/);
assert.match(account, /Poți trimite cererea acum, iar echipa VIASEE te ajută cu transferul\./);

// S4: preferința locației rămâne doar în Setările organizației.
assert.doesNotMatch(account, /rememberLastLocation/);
assert.match(account, /Locația deschisă în organizație/);
assert.match(account, /onSwitchMode\("provider"\)/);
assert.match(settings, /value=\{preferences\.providerLocationMode\}/);

// S6, S8–S11 în Setările organizației.
assert.match(settings, /Profilul organizației <ChevronRight/);
assert.doesNotMatch(settings, /<ExternalLink/, 'S6: navigarea internă nu mai are iconița de link extern');
assert.match(settings, /organizationLocations\.length === 1 \? "locație asociată" : "locații asociate"/, 'S8');
assert.match(settings, /if \(visibility === "archived"\) return \{ label: "Profil arhivat"/, 'S9');
assert.match(settings, /\{locations\.length > 1 && <SettingsSection title="Preferințe pe acest dispozitiv"/, 'S10');
assert.match(settings, /Solicitările din Zona de pericol ajung la echipa VIASEE/, 'S11');
// S12: subtitlul facturării nu mai spune „locația selectată” cât se încarcă abonamentul organizației.
assert.match(billing, /\(data \? organizationScope : Boolean\(organizationId\)\)/);

// S7: „Cere redeschiderea” deschide un tichet completat; nimic nu pleacă automat.
assert.match(settings, /window\.location\.assign\(reopenRequestUrl\(selectedLocation\)\)/);
assert.match(settings, /subiect: `Redeschiderea locației \$\{label\}`/);
assert.match(help, /const subject = \(searchParams\.get\("subiect"\) \|\| ""\)\.trim\(\)\.slice\(0, 140\);/);
assert.match(help, /setNewTicketOpen\(true\);/);
assert.match(help, /\["subiect", "categorie", "detalii"\]\.forEach\(\(key\) => next\.delete\(key\)\);/);
assert.doesNotMatch(help.slice(help.indexOf('const subject ='), help.indexOf('const subject =') + 800), /SupportTicket\.create/, 'S7: tichetul nu se trimite automat');
for (const text of ['Ajutor și suport VIASEE', 'Solicitările mele', 'Nu există tichete în această categorie', 'Creează tichet']) assert.ok(help.includes(text), `Ajutor: „${text}”`);

// S15 și meniul lateral.
assert.match(sidebar, /"Schimbă spațiul contului"/);
assert.match(sidebar, /<span>Ajutor și suport<\/span>/);

// S13, S16 și textul din Setările contului care trimite la preferință.
const completeness = await read('src/components/workspace/provider/ProviderCompletenessPanel.jsx');
assert.match(completeness, /\? "completare generală" : "doar organizația"/, 'S13');
assert.match(settings, /if \(isLocationPubliclyVisible\(location\)\) return \{ label: "Publică"/, 'S16');
assert.match(settings, /const locationClosed = isLocationClosed\(selectedLocation\);/);
assert.match(account, /Dacă organizația are mai multe locații, alegi din Setările organizației → General/);

console.log('Settings audit fixes: OK');
