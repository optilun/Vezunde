// Butonul principal din bara de sus (2026-09-29).
//
// Butonul ducea la /cauta, dar se numea „Găsește opțiuni”: numele nu spunea pacientului ce
// găsește și se repeta cu „Găsește opțiuni” din subsol, care duce la /cerere (fluxul ghidat).
// Acum butonul din antet și cel din meniul mobil se numesc „Găsește specialist” și rămân pe /cauta.
// „Găsește opțiuni” rămâne doar acolo unde ducem la /cerere, unde rezultatul se numește chiar
// „Cele mai potrivite opțiuni”.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const layout = read('src/components/Layout.jsx');
const mobile = read('src/components/navigation/MobileNavigationSheet.jsx');

// Fiecare buton către /cauta din antet si din meniul mobil poarta noul nume.
const ctaPattern = /<Link\s+to="\/cauta"[^>]*>\s*Găsește specialist\s*<\/Link>/;
assert.match(layout, ctaPattern, 'antetul desktop: buton „Găsește specialist” către /cauta');
assert.match(mobile, ctaPattern, 'meniul mobil: buton „Găsește specialist” către /cauta');

// Numele vechi nu mai apare pe butoanele care duc la /cauta.
assert.doesNotMatch(layout, /<Link\s+to="\/cauta"[^>]*>\s*Găsește opțiuni/, 'antetul nu mai spune „Găsește opțiuni” pe /cauta');
assert.doesNotMatch(mobile, /Găsește opțiuni/, 'meniul mobil nu mai spune „Găsește opțiuni”');

// Destinatia nu s-a schimbat: fluxul ghidat ramane pe /cerere in subsol.
assert.match(layout, /<Link to="\/cerere"[^>]*>\s*Găsește opțiuni\s*<\/Link>/, 'subsolul duce în continuare la /cerere');

console.log('verify-nav-search-cta-label: ok');
