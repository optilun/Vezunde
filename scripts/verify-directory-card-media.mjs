// Cardurile directorului: coperta (fotografia locatiei), poza de profil (logo) si distanta.
//
// 2026-09-27. Garzile care conteaza:
// - fotografiile si logo-ul pleaca din backend DOAR pentru profilurile cu detaliu complet
//   (revendicate/verificate), ca pe pagina de profil; niciodata pentru profilurile din director;
// - doar adrese https, niciodata data URL (ar umfla harta nationala cu sute de KB pe punct);
// - logo-ul copiat in `photo_url` de profilurile vechi nu devine fotografie;
// - cardul are coperta generata cand nu exista fotografie sau cand imaginea nu se incarca;
// - distanta apare doar cand exista pozitia vizitatorului.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const browse = read('base44/functions/browseDirectoryProviders/entry.ts');
assert.match(browse, /function cardImages\(loc, disclosure, logos\) \{\s*if \(disclosure\.expose_full_details !== true\) return \{\};/);
assert.match(browse, /if \(!raw \|\| raw\.length > 1000 \|\| !\/\^https:\\\/\\\/\/i\.test\(raw\)\) return null;/);
assert.match(browse, /if \(photo && photo !== logo\) images\.photo_url = photo;/);
assert.match(browse, /\.\.\.cardImages\(loc, disclosure, logos\),/, 'harta nationala');
assert.match(browse, /\.\.\.cardImages\(loc, publicDisclosure, localityLogos\),/, 'lista pe localitate');
assert.match(browse, /ProviderOrganization\.get\(id\)\.catch\(\(\) => null\)/, 'un logo necitit nu strica harta');

const card = read('src/components/results/DirectoryResultCard.jsx');
assert.match(card, /const photo = !photoFailed && location\.photo_url \? location\.photo_url : "";/);
assert.match(card, /const logo = !logoFailed && location\.logo_url \? location\.logo_url : "";/);
assert.match(card, /onError=\{\(\) => setPhotoFailed\(true\)\}/);
assert.match(card, /onError=\{\(\) => setLogoFailed\(true\)\}/);
assert.match(card, /loading="lazy"/);
assert.match(card, /bg-gradient-to-br \$\{tone\}/, 'coperta generata fara fotografie');
assert.match(card, /Public directory information only\. No paid rank or recommendation claims\./);

const map = read('src/pages/DirectoryMap.jsx');
assert.match(map, /distanceKm=\{origin \? distanceKm\(origin, point\) : null\}/);
assert.match(map, /listLayout="grid"/);
assert.match(read('src/pages/Search.jsx'), /listLayout=\{isDirectoryBrowseView \? "grid" : "cards"\}/);

const layout = read('src/components/results/LocationsWithMap.jsx');
assert.match(layout, /listLayout = "cards"/, 'celelalte rezultate raman carduri');

console.log('Directory card media checks passed.');
