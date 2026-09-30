// Carduri compacte langa harta + cardul de specialist pe aceeasi grila (2026-09-30).
//
// 1. DirectoryResultCard: varianta compacta e doar CSS, legata de marca `is-beside-map` a grilei
//    (resultGridClasses.js) si de `lg`; continutul, legaturile si ordinea in DOM raman aceleasi.
// 2. Specialistii: un cadru comun (ProfessionalCardFrame) pentru rasfoire si recomandari, in celula
//    de grila; rasfoirea nu primeste nimic de recomandare, recomandarea vine prin `details`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { monogram } = await import(pathToFileURL(path.join(root, 'src/lib/professionalMonogram.js')).href);
const read = (file) => readFileSync(path.join(root, file), 'utf8');

// --- 1. Cardul compact ----------------------------------------------------------------------
{
  const card = read('src/components/results/DirectoryResultCard.jsx');
  const grid = read('src/components/results/resultGridClasses.js');
  assert.match(grid, /group\/grid is-beside-map/, 'grila langa harta poarta marca');
  assert.match(card, /const BESIDE = \{/);

  // Fiecare clasa compacta este scrisa intreaga (Tailwind nu vede clase compuse prin concatenare),
  // incepe cu `lg:` si depinde de marca grilei.
  const beside = card.slice(card.indexOf('const BESIDE = {'), card.indexOf('function distanceLabel'));
  const classes = [...beside.matchAll(/"([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/));
  assert.ok(classes.length >= 25, `clase compacte gasite: ${classes.length}`);
  for (const name of classes) {
    if (name === 'hidden') continue;
    assert.match(name, /^lg:group-\[\.is-beside-map\]\/grid:[\w.\-/\[\]]+$/, `clasa compacta invalida: ${name}`);
  }
  assert.doesNotMatch(beside, /\$\{|\+ ?"/, 'fara clase compuse prin concatenare');

  // Fiecare element care se schimba foloseste o cheie din BESIDE.
  for (const key of ['article', 'coverWrap', 'coverBox', 'city', 'icon', 'badges', 'typePill', 'logo', 'typeLine', 'titleRow', 'title', 'action', 'address', 'footer']) {
    assert.match(card, new RegExp(`\\$\\{BESIDE\\.${key}\\}`), `BESIDE.${key} nu este folosit`);
  }
  // Randul compact: coperta patrata in stanga, textul in dreapta, pe acelasi continut.
  assert.match(beside, /flex-row/);
  assert.match(beside, /aspect-square/);
  assert.match(beside, /typeLine: "hidden lg:group-\[\.is-beside-map\]\/grid:block"/, 'eticheta tipului trece din coperta in text');
  // Continutul si legaturile raman: nimic nu se elimina pentru varianta compacta.
  assert.match(card, /aria-label=\{`Vezi profilul: \$\{location\.name\}`\}/);
  assert.match(card, /aria-label=\{`Arată pe hartă: \$\{location\.name\}`\}/);
  assert.match(card, /aria-label=\{`Sună la \$\{location\.name\}`\}/);
  assert.match(card, /\{details\}/);
  // Fara hook de media si fara prop nou: cardul nu stie de harta, doar grila o stie.
  assert.doesNotMatch(card, /matchMedia|useMediaQuery|besideMap/);
  // Semnatura cardului ramane.
  assert.match(card, /rank = null, details = null, rankKind = "pin", linkState = undefined, onProfileClick = undefined, onPhoneClick = undefined/);
}

// --- 2. Specialistii pe aceeasi grila --------------------------------------------------------
{
  const frame = read('src/components/results/ProfessionalCardFrame.jsx');
  const browse = read('src/components/results/ProfessionalDirectoryCard.jsx');
  const result = read('src/components/results/ProfessionalResultCard.jsx');
  const matchCard = read('src/components/intake2/ProfessionalMatchResultCard.jsx');
  const panel = read('src/components/intake2/ProfessionalResults.jsx');
  const search = read('src/pages/Search.jsx');

  assert.match(frame, /resultCellClassName\(\{ hasPositions: false \}\)/, 'cadrul este o celula de grila');
  assert.match(frame, /bg-gradient-to-br \$\{tone\}/, 'coperta generata fara fotografie');
  assert.match(frame, /onError=\{\(\) => setPhotoFailed\(true\)\}/, 'o fotografie stricata nu lasa coperta goala');
  assert.match(frame, /to=\{`\/specialist\/\$\{professional\.id\}`\}|const profileHref = `\/specialist\/\$\{professional\.id\}`/);
  assert.match(frame, /Specialist verificat/);
  assert.match(frame, /Unde poate fi găsit/);
  assert.match(frame, /to=\{`\/furnizor\/\$\{location\.id\}`\}/);
  // Cadrul nu stie de bucketuri, scoruri sau Top 3 si nu ordoneaza nimic.
  assert.doesNotMatch(frame, /result_bucket|recommendation_score|DecisionConfidencePanel|top3|\.sort\(|rank/);

  // Rasfoirea: fara nimic de recomandare.
  assert.match(browse, /<ProfessionalCardFrame professional=\{professional\} specializations=\{specializations\} \/>/);
  assert.doesNotMatch(browse, /result_bucket|recommendation_score|DecisionConfidencePanel|top3|details=/);

  // Recomandarea: panoul „De ce se potriveste” prin `details`, varianta doar ca atribut.
  assert.match(result, /<ProfessionalCardFrame/);
  assert.match(result, /variant=\{variant\}/);
  assert.match(result, /<DecisionConfidencePanel confidence=\{confidence\} compact \/>/);
  assert.doesNotMatch(result, /VARIANT_STYLES|border-dashed|ring-2/, 'fara chenare de varianta');
  assert.match(matchCard, /BUCKET_VARIANT\[professional\.result_bucket\]/, 'varianta vine strict din result_bucket');

  // Grila: si in recomandari, si pe /cauta; starile de incarcare/gol raman in afara grilei.
  assert.equal((panel.match(/resultGridClassName\(false\)/g) || []).length, 3, 'cele trei sectiuni de specialisti');
  assert.doesNotMatch(panel, /space-y-3/);
  assert.match(search, /professionals\?\.length > 0 \? \(\s*<div className=\{`mt-4 \$\{resultGridClassName\(false\)\}`\}>/);
  assert.match(search, /<ProfessionalDirectoryCard key=\{professional\.id\} professional=\{professional\} \/>/);
}

// --- 3. Initialele de pe coperta --------------------------------------------------------------
assert.equal(monogram('Dr. Andreea Popescu'), 'AP', 'titulatura nu intra in initiale');
assert.equal(monogram('Prof. Dr. Ion Popescu'), 'IP');
assert.equal(monogram('Mihai Ionescu'), 'MI');
assert.equal(monogram('Ana-Maria Constantinescu-Vasilescu Popa'), 'AP', 'prima si ultima parte');
assert.equal(monogram('Șerban'), 'ȘE', 'un singur cuvant: primele doua litere, cu diacritice');
assert.equal(monogram('Dr.'), 'D.', 'doar titulatura: ramane ce exista');
assert.equal(monogram(''), '?');
assert.equal(monogram(null), '?');
assert.match(read('src/components/results/ProfessionalCardFrame.jsx'), /monogram\(name\)/, 'cadrul citeste display_name, nu public_display_name');

console.log('verify-compact-result-cards: ok');
