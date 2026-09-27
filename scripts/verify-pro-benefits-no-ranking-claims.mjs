// Beneficiile Pro nu promit vizibilitate sau recomandare cumparata (2026-09-27).
//
// Pro deblocheaza cererile complete ale locatiilor deja recomandate (date, raspuns, chat, telefon
// dupa acord). Nu schimba cine apare, ordinea rezultatelor sau Top 3 - iar pacientii citesc pe
// ecranul de recomandari "Plata nu influenteaza ordinea". Garda de mai jos tine cele doua texte
// in acord: daca cineva adauga in lista Pro "vizibilitate mai mare" sau "recomandare", testul pica.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const card = read('src/components/workspace/provider/leads/ProviderUpgradeCard.jsx');
const list = card.slice(card.indexOf('const BENEFITS = ['), card.indexOf('];', card.indexOf('const BENEFITS = [')));
assert.ok(list.length > 20, 'lista de beneficii exista');
assert.match(list, /Cererile complete ale pacienților din zona ta, când locația ta e recomandată/);
for (const forbidden of [/vizibilitate/i, /mai sus/i, /prioritar/i, /primul loc|primele locuri/i, /promovat|promovare/i, /ranking|clasament/i, /recomandare (mai|garantat)/i, /apari (mai|primul)/i]) {
  assert.doesNotMatch(list, forbidden, `beneficiile Pro nu promit ${forbidden}`);
}

// Promisiunea facuta pacientilor ramane.
assert.match(read('src/components/intake2/MatchResults.jsx'), /Plata nu influențează ordinea/);
assert.match(read('src/components/intake2/ProfessionalResults.jsx'), /Plata nu influențează ordinea/);

console.log('Pro benefits make no ranking claims.');
