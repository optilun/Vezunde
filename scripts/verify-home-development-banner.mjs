// 2026-09-25. Bannerul „Versiune în dezvoltare” de pe home a fost scos la cererea lui Alex.
// Verificarea pazeste ca nu reapare si ca primul ecran incepe direct cu hero-ul.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(home, /function DevelopmentBanner\(\)/, 'componenta bannerului nu mai exista');
assert.doesNotMatch(home, /<DevelopmentBanner \/>/, 'bannerul nu mai este afisat');
assert.doesNotMatch(home, /Versiune în dezvoltare|VIASEE este în dezvoltare/, 'textul bannerului nu mai apare pe home');
assert.match(home, /<div className="home-scroll-takeover relative">\s*<div ref=\{stageRef\}/, 'primul ecran incepe direct cu hero-ul');

console.log('Home development banner removal checks passed.');
