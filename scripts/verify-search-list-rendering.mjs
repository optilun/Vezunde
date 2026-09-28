// Lista de rezultate de pe /cauta: randari la hover si selectia unui pin indepartat
// (audit /cauta, B7 si B8, 2026-09-28).
//
// B7 un hover redeseneaza doar randurile care isi schimba starea: randul e memoizat, primeste
//    callback-uri stabile, iar paginile dau renderCard stabil (useCallback);
// B8 un pin ales pe harta Romaniei dincolo de pagina curenta apare primul in lista, fara ca lista sa
//    se extinda pana la el.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// B7
{
  const layout = read('src/components/results/LocationsWithMap.jsx');
  assert.match(layout, /const ResultRow = memo\(function ResultRow\(/, 'randul e memoizat');
  assert.match(layout, /const hasPoint = useMemo\(\(\) => mapPointFromResult\(location\) !== null, \[location\]\);/, 'punctul de harta o data pe rand');
  assert.match(layout, /const card = useMemo\(\(\) => renderCard\(location, showThis, shownRank\), \[renderCard, location, showThis, shownRank\]\);/, 'cardul nu se reconstruieste la hover');
  assert.match(layout, /const registerCard = useCallback\(/);
  assert.match(layout, /const showOnMap = useCallback\(\(id\) => \{/);
  assert.match(layout, /\}, \[\]\);\n/, 'callback-uri fara dependente (citesc starea curenta din ref)');
  assert.match(layout, /<ResultRow\s+key=\{location\.id\}/);
  assert.match(layout, /selected=\{selectedId === location\.id\}\s+hovered=\{hoveredId === location\.id\}/, 'randul primeste doar starea lui, nu id-urile');
  const map = (layout.match(/mapPointFromResult\(/g) || []).length;
  assert.ok(map <= 2, `mapPointFromResult apare de ${map} ori (hasPositions + rand)`);

  const search = read('src/pages/Search.jsx');
  assert.match(search, /const renderLocationCard = useCallback\(\(location, onShowMap, rank\) => isDirectoryBrowseView/);
  assert.match(search, /\[isDirectoryBrowseView\]\);/);
  assert.match(search, /renderCard=\{renderLocationCard\}/);
  assert.match(search, /onHover=\{setHoveredId\}/, 'setter stabil');
  assert.match(search, /onSelect=\{setSelectedId\}/, 'setter stabil');
  const directory = read('src/pages/DirectoryMap.jsx');
  assert.match(directory, /const renderPointCard = useCallback\(/);
  assert.match(directory, /renderCard=\{renderPointCard\}/);
  assert.match(directory, /onHover=\{setHoveredId\}/);
}

// B8
{
  const directory = read('src/pages/DirectoryMap.jsx');
  assert.doesNotMatch(directory, /Math\.max\(pageSize, selectedIndex \+ 1\)/, 'lista nu se mai extinde pana la pinul ales');
  assert.match(directory, /return selectedIndex >= pageSize \? \[inView\[selectedIndex\], \.\.\.page\] : page;/);
  assert.match(directory, /Locația aleasă pe hartă este afișată prima\./);

  // Aceeasi regula, pe date: cel mult o pagina plus locatia aleasa.
  const inView = Array.from({ length: 900 }, (_, index) => ({ id: `p${index}` }));
  const listed = (selectedIndex, pageSize = 24) => {
    const page = inView.slice(0, pageSize);
    return selectedIndex >= pageSize ? [inView[selectedIndex], ...page] : page;
  };
  assert.equal(listed(800).length, 25);
  assert.equal(listed(800)[0].id, 'p800');
  assert.equal(listed(3).length, 24);
  assert.equal(listed(-1).length, 24);
}

console.log('Search list rendering (B7, B8) checks passed.');
