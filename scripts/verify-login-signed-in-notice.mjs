// Login cu o sesiune deja activa (2026-10-02).
//
// In acelasi browser, Alex era conectat cu contul de test; cand incerca sa intre cu contul de admin,
// /login nu spunea ca exista deja o sesiune si ramanea pe contul de test - parea ca adminul si-a
// pierdut rolul. /login si /register arata acum contul conectat si ofera iesirea.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const notice = await read('src/components/SignedInNotice.jsx');
assert.match(notice, /const \{ user, isAuthenticated, isLoadingAuth, logout \} = useAuth\(\);/);
assert.match(notice, /if \(isLoadingAuth \|\| !isAuthenticated \|\| !user\) return null;/, 'fara sesiune nu apare nimic');
assert.match(notice, /user\.email/, 'arata adresa contului conectat');
assert.match(notice, /isAdmin\(user\) \? " · administrator" : ""/, 'spune cand contul este de administrator');
assert.match(notice, /await logout\(true\);/, 'iesirea reincarca pagina fara sesiune');
assert.match(notice, /Ieși și intră cu alt cont/);
assert.match(notice, /Continuă cu acest cont/);

for (const page of ['src/pages/Login.jsx', 'src/pages/Register.jsx']) {
  const source = await read(page);
  assert.match(source, /import SignedInNotice from "@\/components\/SignedInNotice";/, `${page}: importa avertizarea`);
  assert.ok(
    source.indexOf('<SignedInNotice />') > -1 && source.indexOf('<SignedInNotice />') < source.indexOf('onClick={handleGoogle}'),
    `${page}: avertizarea apare inaintea butoanelor de autentificare`,
  );
}

const login = await read('src/pages/Login.jsx');
assert.match(login, /Dacă nu ai setat încă o parolă pentru acest site, o poți seta din „Ai uitat parola\?”/);

const header = await read('src/components/HeaderAccountLink.jsx');
assert.match(header, /title=\{accountLabel\}/, 'antetul arata contul conectat la trecerea cu mouse-ul');

console.log('verify-login-signed-in-notice: ok');
