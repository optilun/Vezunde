// Harta rezultatelor, refacuta vizual (2026-09-27).
//
// Garzile care conteaza:
// - fundalul VIASEE (Positron recolorat, nume romanesti, strat 3D ascuns) nu modifica stilul primit;
// - gruparea pe ecran nu pierde si nu dubleaza locatii; grupurile vecine nu se suprapun;
// - apasarea pe un grup apropie harta centrata pe grup (zoom de desfacere), nu pe dreptunghiul lui;
// - pinii: cerc cu numar pentru grup, fara contur punctat, pinul ales negru, vizitat gri, numar din lista;
// - o singura harta pe pagina, refolosita intre cautari;
// - lista nationala urmeaza centrul hartii doar de la zoom 9 si nu sare la alegerea unei locatii;
// - numerotarea pinilor doar afiseaza ordinea primita; nu o schimba.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformMapStyle, ROMANIAN_NAME, MAP_STYLE_URL } from '../src/lib/viaseeMapStyle.js';
import { clusterPoints, clusterExpansionZoom, CLUSTER_RADIUS_PX } from '../shared/resultsMapPoints.js';
import { pillHtml, clusterSizeClass } from '../shared/mapMarkerPresentation.js';
import { mapCenterForOrdering, orderByDistanceFrom, MAP_CENTER_ORDER_ZOOM } from '../shared/nearbyDirectory.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 1. Fundalul hartii.
{
  assert.match(MAP_STYLE_URL, /openfreemap\.org\/styles\/positron$/);
  const source = {
    version: 8,
    sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#fafaf8' } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#c2c8ca' } },
      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', paint: { 'fill-color': '#eee' } },
      { id: 'highway_major_inner', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: { 'line-color': '#fff', 'line-width': 2 } },
      { id: 'label_city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] }, paint: { 'text-color': '#000' } },
      { id: 'housenumber', type: 'symbol', source: 'openmaptiles', 'source-layer': 'housenumber', layout: { 'text-field': '{housenumber}' } },
    ],
  };
  const snapshot = JSON.stringify(source);
  const style = transformMapStyle(source);
  assert.equal(JSON.stringify(source), snapshot, 'stilul primit nu se modifica');
  const byId = new Map(style.layers.map((layer) => [layer.id, layer]));
  assert.equal(byId.get('background').paint['background-color'], '#F2EFE8', 'uscat crem');
  assert.equal(byId.get('water').paint['fill-color'], '#CCDAEA', 'apa albastru-pal');
  assert.deepEqual(byId.get('label_city').layout['text-field'], ROMANIAN_NAME, 'numele localitatilor in romana');
  assert.equal(byId.get('housenumber').layout['text-field'], '{housenumber}', 'textele care nu sunt nume raman');
  assert.equal(byId.get('highway_major_inner').paint['line-width'], 2, 'grosimile raman ale stilului');
  const extrusion = byId.get('building-3d');
  assert.ok(extrusion, 'stratul 3D exista pentru butonul 3D');
  assert.equal(extrusion.layout.visibility, 'none');
  assert.equal(style.layers.indexOf(extrusion), style.layers.findIndex((layer) => layer.id === 'building') + 1);
  assert.equal(transformMapStyle(style).layers.filter((layer) => layer.id === 'building-3d').length, 1, 'fara strat dublat');
  assert.equal(transformMapStyle(null), null);
}

// 2. Gruparea pe ecran.
{
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cities = [[44.43, 26.1], [46.77, 23.6], [47.16, 27.59], [45.75, 21.23], [44.18, 28.63]];
  const points = [];
  for (let index = 0; index < 900; index += 1) {
    const [lat, lng] = cities[index % cities.length];
    points.push({ id: `p${index}`, lat: lat + (random() - 0.5) * 0.3, lng: lng + (random() - 0.5) * 0.4, tier: 'directory' });
  }
  points.push({ id: 'twin-a', lat: 45.1, lng: 24.1 }, { id: 'twin-b', lat: 45.1, lng: 24.1 });
  for (const zoom of [5, 6, 8, 10, 12, 14, 15, 17]) {
    const clusters = clusterPoints(points, zoom);
    const ids = clusters.flatMap((cluster) => cluster.points.map((point) => point.id));
    assert.equal(ids.length, points.length, `zoom ${zoom}: nicio locatie pierduta sau dublata`);
    assert.equal(new Set(ids).size, points.length);
    for (const cluster of clusters) {
      assert.equal(cluster.count, cluster.points.length);
      assert.equal(cluster.lead, cluster.points[0], 'primul punct al grupului este cel mai bine clasat');
    }
  }
  assert.ok(clusterPoints(points, 6).length < 80, 'la nivel de tara, grupurile sunt putine');
  assert.ok(clusterPoints(points, 14).length > clusterPoints(points, 8).length, 'grupurile se desfac la zoom');
  const twins = clusterPoints(points, 17).find((cluster) => cluster.points.some((point) => point.id === 'twin-a'));
  assert.equal(twins.count, 2, 'pozitiile identice raman grupate si la zoom maxim');
  // Punctele de pornire ale grupurilor sunt la cel putin o raza distanta unele de altele.
  const scale = (zoom) => 512 * 2 ** zoom;
  const project = ({ lat, lng }, zoom) => {
    const sin = Math.sin(lat * Math.PI / 180);
    return [((lng + 180) / 360) * scale(zoom), (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale(zoom)];
  };
  const leads = clusterPoints(points, 10).map((cluster) => project(cluster.lead, 10));
  for (let a = 0; a < leads.length; a += 1) {
    for (let b = a + 1; b < leads.length; b += 1) {
      assert.ok(Math.hypot(leads[a][0] - leads[b][0], leads[a][1] - leads[b][1]) > CLUSTER_RADIUS_PX - 1e-6, 'grupurile nu se suprapun');
    }
  }
  assert.ok(clusterPoints(points, 8, { tileSize: 256 }).length <= clusterPoints(points, 8).length, 'Leaflet (256 px) grupeaza la fel de mult sau mai mult');
  const bucharest = clusterPoints(points, 6).sort((a, b) => b.count - a.count)[0];
  const expansion = clusterExpansionZoom(bucharest.points, 6);
  assert.ok(expansion > 6 && expansion <= 15, 'zoomul de desfacere este mai mare decat cel curent');
  assert.ok(clusterPoints(bucharest.points, expansion).length > 1, 'la zoomul de desfacere grupul se imparte');
}

// 3. Pinii.
{
  const lead = { id: 'a', name: 'Optica <b>', provider_type: 'optica_medicala', map_precision: 'approximate' };
  const single = pillHtml({ key: 'point:a', count: 1, lead, points: [lead] });
  assert.match(single, /data-approximate="true"/, 'atributul ramane');
  assert.match(single, /viasee-marker-icon/);
  assert.ok(!single.includes('<b>'), 'numele sunt escapate');
  const group = pillHtml({ key: 'group:a', count: 212, lead, points: [lead] });
  assert.match(group, /<span class="viasee-marker-name">212<\/span>/, 'grupul arata doar numarul');
  assert.match(group, /data-size="xl"/);
  assert.match(group, /data-label="Explorează grupul de 212 locații"/);
  assert.ok(!group.includes('viasee-marker-chevron') && !group.includes('viasee-marker-icon'));
  assert.deepEqual([1, 9, 10, 49, 50, 199, 200].map(clusterSizeClass), ['s', 's', 'm', 'm', 'l', 'l', 'xl']);
  const ranked = pillHtml({ key: 'point:a', count: 1, lead: { ...lead, map_rank: 3, visited: true }, points: [lead] });
  assert.match(ranked, /<span class="viasee-marker-rank">3<\/span>/, 'numarul din lista inlocuieste pictograma');
  assert.match(ranked, /data-visited="true"/);
  assert.match(ranked, /data-label="3\. Optica &lt;b&gt;, Optică"/);
  assert.match(pillHtml({ key: 'point:a', count: 1, lead: { ...lead, map_rank: 0 }, points: [lead] }), /viasee-marker-icon/, 'fara numar invalid');

  const css = read('src/components/results/mapMarkers.css');
  assert.doesNotMatch(css, /dashed/, 'fara contur punctat pe harta');
  assert.match(css, /\.viasee-marker\[data-active="true"\] \{ background: #171717; color: #ffffff; \}/, 'pinul ales este negru');
  assert.match(css, /\.viasee-marker\[data-visited="true"\] \{ background: #ecebe7;/, 'pinul vizitat este gri');
  assert.match(css, /scale\(1\.08\)/, 'pinul de sub mouse se mareste');
  assert.match(css, /\[data-size="xl"\] \{ width: 54px; height: 54px;/);
  assert.match(css, /prefers-reduced-motion/);
}

// 4. Harta vectoriala.
{
  const canvas = read('src/components/results/VectorResultsCanvas.jsx');
  assert.match(canvas, /let sharedMap = null;/, 'o singura harta pe pagina');
  assert.match(canvas, /if \(sharedMap && !sharedMap\.inUse && !sharedMap\.broken\) \{\s*host\.appendChild\(sharedMap\.element\);/, 'harta libera se refoloseste');
  assert.match(canvas, /if \(entry === sharedMap && !entry\.broken\) \{\s*entry\.element\.remove\(\);\s*return;\s*\}/, 'la plecare harta ramane in memorie');
  assert.match(canvas, /map\.on\("webglcontextlost",\(\) => \{ entry\.broken = true;/, 'o harta fara WebGL nu se refoloseste');
  assert.match(canvas, /map\.setStyle\(MAP_STYLE_URL, \{ transformStyle: \(_previous, next\) => transformMapStyle\(next\) \}\);/);
  assert.match(canvas, /map\.setStyle\(MAP_STYLE_FALLBACK_URL\)/, 'stilul standard ramane rezerva');
  assert.doesNotMatch(canvas, /styles\/liberty/, 'URL-urile stilului vin dintr-un singur loc');
  const click = canvas.slice(canvas.indexOf('el.onclick=()=>{'), canvas.indexOf('el.onmouseenter='));
  assert.match(click, /clusterExpansionZoom\(cluster\.points,current\)/, 'apropiere pana la desfacerea grupului');
  assert.match(click, /map\.easeTo\(\{center:\[cluster\.lng,cluster\.lat\],zoom:target/, 'centrat pe grup');
  assert.doesNotMatch(click, /fitBounds/, 'nu pe dreptunghiul tuturor punctelor grupului');
  assert.match(canvas, /\{viaseeSelection:true\}/, 'mutarea facuta de selectie este marcata');
  assert.match(canvas, /reason:event\?\.viaseeSelection \? "selection" : "move"/);
  assert.match(canvas, /const below=y-cardHeight-30 < 8/, 'cardul trece sub pin cand nu are loc deasupra');
  assert.match(canvas, /closest\?\.\("\.viasee-vector-marker"\)/, 'clicul pe pin nu inchide cardul');
  const legacy = read('src/components/results/LegacyResultsMap.jsx');
  assert.match(legacy, /clusterPoints\(mapPoints, viewport\.zoom, LEAFLET_TILE\)/, 'harta 2D grupeaza cu dale de 256 px');
  assert.match(legacy, /const LEAFLET_TILE = \{ tileSize: 256 \};/);
}

// 5. Fereastra pinului.
{
  const card = read('src/components/results/MapLocationCard.jsx');
  assert.match(card, /variant = "sheet"/);
  assert.match(card, /if \(floating\) \{/);
  assert.match(card, /Poziție aproximativă/, 'pozitia aproximativa se spune in card');
  assert.match(card, /max-h-\[55%\] overflow-y-auto/, 'pe telefon cardul nu acopera toata harta');
  assert.match(card, /onError=\{\(\) => setPhotoFailed\(true\)\}/, 'fotografia lipsa -> coperta generata');
  const map = read('src/components/results/ResultsMap.jsx');
  assert.match(map, /selectedCard=\{floatingCard\}/);
  assert.match(map, /\{selectedPoint && !floatingCard && \(/, 'un singur card deodata');
}

// 6. Ordinea listei nationale dupa centrul hartii.
{
  assert.equal(MAP_CENTER_ORDER_ZOOM, 9);
  const bounds = [[44, 26], [45, 27]];
  assert.equal(mapCenterForOrdering(8.9, bounds), null, 'sub zoom 9 lista ramane in ordinea ei');
  assert.deepEqual(mapCenterForOrdering(9, bounds), { lat: 44.5, lng: 26.5 });
  assert.equal(mapCenterForOrdering(12, null), null);
  const list = [
    { id: 'far', lat: 46, lng: 23 },
    { id: 'near-1', lat: 44.5, lng: 26.52 },
    { id: 'none', lat: null, lng: null },
    { id: 'near-2', lat: 44.5, lng: 26.52 },
  ];
  const ordered = orderByDistanceFrom(list, { lat: 44.5, lng: 26.5 });
  assert.deepEqual(ordered.map((point) => point.id), ['near-1', 'near-2', 'far', 'none'], 'distanta, apoi ordinea primita');
  assert.equal(orderByDistanceFrom(list, null), list);
  const page = read('src/pages/DirectoryMap.jsx');
  const handler = page.slice(page.indexOf('const handleViewport'), page.indexOf('const [selectedId'));
  assert.match(handler, /if \(reason === "selection"\) return;/, 'alegerea unei locatii nu reordoneaza lista');
  assert.match(page, /const centerOrder = !origin && Boolean\(mapCenter\);/, 'pozitia dispozitivului are prioritate');
  assert.match(page, /Ordine: apropiere de centrul hărții/);
}

// 7. Pini numerotati si profiluri vazute.
{
  const layout = read('src/components/results/LocationsWithMap.jsx');
  assert.match(layout, /numbered = false,/);
  assert.match(layout, /rankSignature\.split\("\|"\)\.filter\(Boolean\)\.map\(\(id, index\) => \[id, index \+ 1\]\)/, 'numarul este pozitia din lista primita');
  assert.match(read('src/pages/Search.jsx'), /numbered=\{!isDirectoryBrowseView\}/, 'doar rezultatele cu ordine a potrivirii');
  assert.match(read('src/pages/ProviderProfile.jsx'), /useEffect\(\(\) => \{ markProfileVisited\(id\); \}, \[id\]\);/);

  const storage = new Map();
  globalThis.window = { sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) } };
  const { markProfileVisited, readVisitedProfiles } = await import('../src/lib/visitedProfiles.js');
  markProfileVisited('a');
  markProfileVisited('b');
  markProfileVisited('a');
  assert.deepEqual([...readVisitedProfiles()], ['b', 'a']);
  for (let index = 0; index < 250; index += 1) markProfileVisited(`x${index}`);
  assert.equal(readVisitedProfiles().size, 200, 'lista ramane mica');
  globalThis.window = { sessionStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } };
  assert.equal(readVisitedProfiles().size, 0, 'fara stocare: nimic vazut, fara eroare');
  markProfileVisited('a');
  delete globalThis.window;
}

console.log('Map visual refresh checks passed.');
