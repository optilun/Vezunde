import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');

assert.match(home, /function DevelopmentBanner\(\)/);
assert.match(home, /Versiune în dezvoltare/);
assert.match(home, /VIASEE este în dezvoltare/);
assert.match(home, /Unele funcții și informații pot fi incomplete sau se pot modifica/);
assert.match(home, /aria-label="Informație despre stadiul platformei"/);
assert.match(home, /<DevelopmentBanner \/>/);

const bannerPosition = home.indexOf('<DevelopmentBanner />');
const takeoverPosition = home.indexOf('{prefersReducedMotion || !supportsPinnedTakeover');
assert.ok(bannerPosition >= 0 && takeoverPosition >= 0 && bannerPosition < takeoverPosition, 'Bannerul trebuie afișat înaintea hero-ului');

console.log('Homepage development banner checks passed.');
