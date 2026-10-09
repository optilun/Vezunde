// 2026-10-09 (Alex: macheta, varianta A „Caută-ți locația”). Secțiunea pentru furnizori de pe pagina
// principală pornește revendicarea: câmp de căutare -> /adauga-sau-revendica cu textul completat.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const cta = await read('src/components/home/ProCta.jsx');
const addOrClaim = await read('src/pages/AddOrClaim.jsx');
const providerSearch = await read('src/components/provider/ProviderSearch.jsx');

// Mesajul și ilustrația veche
assert.match(cta, /Locația ta e deja pe VIASEE\./);
assert.match(cta, /Revendic-o gratuit\./);
assert.doesNotMatch(cta, /ProfileBlueprint|PROFIL VIASEE|Arată clar/, 'ilustrația abstractă și titlul vechi au ieșit');
assert.doesNotMatch(cta, /0\{index \+ 1\}|"01"/, 'fără pașii 01/02/03 (secțiunea de deasupra îi are deja)');

// Căutarea: etichetă reală, trimitere către revendicare cu textul căutat
assert.match(cta, /<label htmlFor="home-claim-search"/);
assert.match(cta, /id="home-claim-search"/);
assert.match(cta, /<form onSubmit=\{submit\}/);
assert.match(cta, /navigate\("\/adauga-sau-revendica", searchQuery \? \{ state: \{ searchQuery \} \} : undefined\)/);
assert.match(cta, /type="submit"/);

// Celelalte drumuri
assert.match(cta, /<PanelLink to="\/adauga-sau-revendica" state=\{\{ startFlow: "new_location" \}\}>/);
assert.match(cta, /<PanelLink to="\/profil-profesional\/nou">/);
assert.match(cta, /to="\/pentru-specialisti"/);

// Fără cifre inventate; fără descărcarea hărții naționale pe pagina principală
assert.match(cta, /Peste 1\.000 de locații/);
assert.doesNotMatch(cta, /harta-nationala|loadNationalMapSnapshot/);

// Opacitățile nestandard folosesc forma cu paranteze (altfel Tailwind nu generează clasa)
for (const match of cta.matchAll(/\/(\d+)\b(?=[\s"`])/g)) {
  const value = Number(match[1]);
  assert.ok(value % 5 === 0, `opacitate nestandard fără paranteze: /${value}`);
}

// Pagina de revendicare primește textul și pornește căutarea cu el
assert.match(providerSearch, /export default function ProviderSearch\(\{ onClaim, onNew, initialQuery = "" \}\)/);
assert.match(providerSearch, /useState\(\(\) => String\(initialQuery \|\| ""\)\.slice\(0, 120\)\)/);
assert.match(addOrClaim, /initialQuery=\{typeof navState\?\.searchQuery === "string" \? navState\.searchQuery : ""\}/);

console.log('Home pro CTA claim search: OK');
