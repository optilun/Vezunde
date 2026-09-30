// Cardul recomandarilor clientului (2026-09-30).
//
// Recomandarile de dupa cerere (/rezultate) foloseau un card propriu (ResultCard: miniatura, insigna,
// butoane), iar /cauta avea cardul nou al directorului (coperta, nume, adresa, sageata). Acum
// recomandarile folosesc acelasi card, in aceeasi grila. Doar aspectul: potrivirea, ordinea, Top 3
// si distribuirea cererilor nu se ating - bucketul si numarul din Top 3 vin de la server.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readMatchResultsSource } from './recommendation-source.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// 1. Cardul vechi nu mai exista si nimeni nu il mai importa.
assert.equal(existsSync(new URL('../src/components/results/ResultCard.jsx', import.meta.url)), false, 'ResultCard.jsx a fost eliminat');

const card = read('src/components/intake2/MatchResultCard.jsx');
assert.doesNotMatch(card, /from "@\/components\/results\/ResultCard"/);
assert.match(card, /import DirectoryResultCard from "@\/components\/results\/DirectoryResultCard";/);
assert.match(card, /import ServiceMatchDetails from "@\/components\/results\/ServiceMatchDetails";/);

// 2. Numarul din Top 3 si bucketul vin de la server, redate ca atare.
assert.match(card, /const rank = variant === "top3" \? Number\(location\.bucket_rank\) \|\| null : null;/, 'numarul din Top 3 este bucket_rank');
assert.match(card, /rankKind="recommendation"/, 'numarul spune „Poziția”, nu „Pinul”');
assert.match(card, /BUCKET_VARIANT\[location\.result_bucket\] \|\| "neutral"/);
assert.doesNotMatch(card, /\.sort\(|\.filter\(|recommendation_score|subscription|payment/, 'cardul nu reordoneaza, nu filtreaza, nu cumpara');

// 3. Ce facea cardul vechi ramane: analitica, distanta, harta, starea de intoarcere, notita din director.
assert.match(card, /profile_opened/);
assert.match(card, /phone_clicked/);
assert.match(card, /patient-search-v1/);
assert.match(card, /const hasDistance = !isDirectoryProfile && /, 'distanta doar pentru profilurile nedirectory, ca inainte');
assert.match(card, /requestMapCardFocus\(\); onSelect\(location\);/, '„Arată pe hartă” selecteaza locatia si muta focusul');
assert.match(card, /resultsReturn: route\.state/, 'intoarcerea spre /rezultate');
assert.match(card, /data-result-location-id=\{location\.id\}/, 'lista /rezultate deruleaza dupa acest atribut');
assert.match(card, /onMouseEnter=\{onHover \? \(\) => onHover\(location\.id\) : undefined\}/);
assert.match(card, /DirectoryProfileNotice/);
assert.match(card, /De unde vin datele acestui profil/);

// 4. Cardul de director primeste doar proprietati optionale; fara ele ramane cum era pe /cauta.
const directory = read('src/components/results/DirectoryResultCard.jsx');
assert.match(directory, /rank = null, details = null, rankKind = "pin", linkState = undefined, onProfileClick = undefined, onPhoneClick = undefined/);
assert.match(directory, /<span className="sr-only">Pinul <\/span>\{rank\}/, 'pe /cauta numarul ramane numarul pinului');
assert.match(directory, /<span className="sr-only">Poziția <\/span>\{rank\}/, 'la recomandari numarul este pozitia');

// 5. Aceeasi grila si aceleasi celule ca pe /cauta, definite o singura data.
const grid = read('src/components/results/resultGridClasses.js');
assert.match(grid, /"group\/grid is-beside-map grid border-t border-border sm:grid-cols-2 lg:grid-cols-1"/, 'langa harta lista are o singura coloana de la lg, iar grila poarta marca variantei compacte');
assert.match(grid, /: "grid border-t border-border sm:grid-cols-2"/, 'fara harta, doua coloane de la sm');
assert.doesNotMatch(grid, /xl:grid-cols-2|xl:odd:border-r/, 'randurile compacte nu se mai impart pe doua coloane la xl');
assert.match(grid, /group\/cell h-full border-b border-border transition-colors/);
const layout = read('src/components/results/LocationsWithMap.jsx');
assert.match(layout, /resultGridClassName\(hasPositions\)/);
assert.match(layout, /resultCellClassName\(\{ hasPositions, selected, hovered \}\)/);
const results = readMatchResultsSource();
assert.match(results, /<div className=\{resultGridClassName\(hasPositions\)\}>/, 'recomandarile stau in grila');
assert.doesNotMatch(results, /space-y-3/, 'fara lista veche de carduri rotunjite');
assert.match(results, /queryScope !== "county"/, 'grupurile pe localitate si judet raman');
assert.match(results, /result_bucket === "top3"/, 'Top 3 ramane strict dupa result_bucket');

console.log('verify-recommendation-card-design: ok');
