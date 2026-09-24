// Fonturi servite de pe viasee.ro; pe telefon, harta ascunsa (nu scoasa) cand treci pe lista;
// locul hartii rezervat cat se incarca /cauta. 2026-09-24.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const bytes = (path) => readFile(new URL(`../${path}`, import.meta.url));

// 1. Fonturi: fara Google Fonts, aceleasi familii, fisierele exista, romana acoperita.
{
  const html = await read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'fara cereri catre Google Fonts');
  for (const file of ['manrope-latin-wght-normal.woff2', 'manrope-latin-ext-wght-normal.woff2']) {
    assert.match(html, new RegExp(`<link rel="preload" href="/fonts/${file.replace('.', '\\.')}" as="font" type="font/woff2" crossorigin />`), `${file} preincarcat`);
  }
  const css = await read('src/styles/fonts.css');
  const faces = [...css.matchAll(/@font-face \{([\s\S]*?)\}/g)].map((match) => match[1]);
  assert.equal(faces.length, 6);
  const ranges = { latin: [], ext: [] };
  for (const face of faces) {
    assert.match(face, /font-display: optional;/, 'fara saritura de text, ca inainte');
    const url = face.match(/url\("\/fonts\/([^"]+)"\)/)[1];
    const file = await bytes(`public/fonts/${url}`);
    assert.equal(file.subarray(0, 4).toString('latin1'), 'wOF2', `${url} este woff2`);
    (url.includes('latin-ext') ? ranges.ext : ranges.latin).push(face.match(/unicode-range: ([^;]+);/)[1]);
  }
  assert.equal(faces.filter((face) => /font-family: "Manrope"/.test(face)).length, 2);
  assert.equal(faces.filter((face) => /font-family: "Fraunces"/.test(face) && /font-style: italic/.test(face)).length, 2, 'Fraunces italic, folosit pe home');
  const covers = (rangeList, codePoint) => rangeList.split(',').some((part) => {
    const [from, to] = part.trim().replace('U+', '').split('-').map((hex) => parseInt(hex, 16));
    return codePoint >= from && codePoint <= (to ?? from);
  });
  for (const char of 'ăâîșțĂÂÎȘȚ') {
    const codePoint = char.codePointAt(0);
    assert.ok([...ranges.latin, ...ranges.ext].some((range) => covers(range, codePoint)), `${char} acoperit`);
  }
  for (const license of ['OFL-Manrope.txt', 'OFL-Fraunces.txt']) {
    assert.match(await read(`public/fonts/${license}`), /SIL Open Font License, Version 1\.1/);
  }
  const main = await read('src/main.jsx');
  assert.ok(main.indexOf("import '@/styles/fonts.css'") < main.indexOf("import '@/index.css'"), 'fonturile inaintea stilurilor');
  const indexCss = await read('src/index.css');
  assert.match(indexCss, /--font-body: "Manrope"/);
  assert.match(indexCss, /--font-display: "Fraunces"/);
  assert.ok((await stat(new URL('../public/fonts/manrope-latin-wght-normal.woff2', import.meta.url))).size < 40_000, 'fisierul principal ramane mic');
}

// 2. Telefon: dupa prima afisare, harta se ascunde pastrandu-si marimea; pe desktop nimic nu se schimba.
{
  const layout = await read('src/components/results/LocationsWithMap.jsx');
  assert.match(layout, /const \[mapShownOnce, setMapShownOnce\] = useState\(mobileView === "map"\);/);
  assert.match(layout, /useEffect\(\(\) => \{ if \(mobileView === "map"\) setMapShownOnce\(true\); \}, \[mobileView\]\);/);
  const hiddenKept = layout.match(/\? "(relative max-lg:absolute[^"]+)"/)?.[1] || '';
  for (const token of ['max-lg:absolute', 'max-lg:inset-x-0', 'max-lg:top-0', 'max-lg:invisible', 'max-lg:pointer-events-none', 'max-lg:[&_.maplibregl-ctrl-attrib]:!invisible']) {
    assert.ok(hiddenKept.split(' ').includes(token), `harta ascunsa: ${token}`);
  }
  assert.ok(!/(^| )(lg:|hidden)/.test(hiddenKept.replace(/max-lg:/g, '')), 'fara reguli noi pentru desktop si fara display:none dupa prima afisare');
  assert.match(layout, /: "relative hidden lg:block";/, 'inainte de prima afisare harta ramane scoasa din pagina');
  assert.match(layout, /className=\{hasPositions \? \(fixedDesktop \? "relative mt-3 grid gap-5 lg:fixed/, 'containerul tine harta ascunsa');
}

// 3. /cauta telefon: locul hartii rezervat cat se incarca directorul.
{
  const directory = await read('src/pages/DirectoryMap.jsx');
  assert.match(directory, /className="min-h-\[max\(24rem,calc\(70vh\+0\.75rem\)\)\] lg:min-h-\[24rem\]"/);
  // Aceeasi inaltime ca harta de pe telefon (clasa data de LocationsWithMap lui ResultsMap).
  const layout = await read('src/components/results/LocationsWithMap.jsx');
  assert.match(layout, /h-\[70vh\] overflow-hidden rounded-3xl/);
}

console.log('Self-hosted fonts and mobile map checks passed.');
