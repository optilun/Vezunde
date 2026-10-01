// Conturi furnizor/specialist - pasul 4: invitatiile (2026-10-01).
//
// Invitatiile de specialist (ProfessionalInvitation) se comportau altfel decat cele de membru
// (ProviderMemberInvitation): doar din linkul din email, fara detalii inainte de acceptare, iar
// /dupa-login nu le gasea. Acum urmeaza acelasi contract: list_mine, inspect, accept cu token sau
// cu invitation_id - fara token, numai pentru emailul verificat al contului.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------- Backend ----------
const ops = await read('base44/functions/professionalInvitationOps/entry.ts');
assert.match(ops, /if \(action === 'list_mine'\) return await listMyInvitations\(svc, user\);/);
assert.match(ops, /if \(action === 'inspect'\) return await inspectInvitation\(svc, user, payload, req\);/);

const list = ops.slice(ops.indexOf('async function listMyInvitations('), ops.indexOf('async function inspectInvitation('));
assert.match(list, /emailUnverified\(user\)/, 'lista cere email verificat');
assert.match(list, /invited_email_normalized: email/, 'lista e doar pentru emailul contului');
assert.match(list, /status: 'pending'/);
assert.match(list, /loadAcceptableInvitationLocation/, 'lista ascunde invitatiile cu locatii care nu mai sunt eligibile');
assert.doesNotMatch(list, /invited_email_normalized,|secure_token_hash/, 'lista nu intoarce emailul sau hash-ul');

const accept = ops.slice(ops.indexOf('async function acceptInvitation('), ops.indexOf('const lifecycleLock = await acquireProfessionalLifecycleLock'));
assert.match(accept, /if \(emailUnverified\(user\)\)/, 'acceptarea cere email verificat');
assert.match(accept, /findInvitationForRequest\(svc, payload, req\)/);
assert.match(accept, /if \(!viaToken && normalizeEmail\(user\.email\) !== invitation\.invited_email_normalized\) \{\n\s+return response\(\{ error: 'Invitatie invalida' \}, 404\);/, 'fara token, o invitatie a altui email nu exista pentru cont');
assert.ok(accept.indexOf('!viaToken && normalizeEmail') < accept.indexOf("invitation.status === 'accepted'"), 'potrivirea emailului (fara token) vine inaintea oricarui alt raspuns');

const inspect = ops.slice(ops.indexOf('async function inspectInvitation('), ops.indexOf('async function acceptInvitation('));
assert.match(inspect, /if \(!viaToken\) return response\(\{ error: 'Invitatie invalida' \}, 404\);/);
assert.match(inspect, /invited_email_masked: maskEmail/, 'cu linkul, adresa invitata se arata mascata');

// ---------- /dupa-login ----------
const postLogin = await read('src/pages/PostLogin.jsx');
assert.match(postLogin, /countInvitations\("acceptProviderMemberInvitation"\)/);
assert.match(postLogin, /countInvitations\("professionalInvitationOps"\)/);
assert.match(postLogin, /setDestination\("\/accept-professional-invitation"\)/);
assert.ok(
  postLogin.indexOf('setDestination("/accept-provider-invitation")') < postLogin.indexOf('setDestination("/accept-professional-invitation")'),
  'accesul in organizatie are prioritate',
);

// ---------- Ecranele de acceptare ----------
const professionalPage = await read('src/pages/AcceptProfessionalInvitation.jsx');
assert.match(professionalPage, /action: "inspect", token/, 'cu link, detaliile se vad inainte de acceptare');
assert.match(professionalPage, /action: "list_mine"/, 'fara link, se vad invitatiile contului');
assert.match(professionalPage, /\{ invitation_id: invitation\.id \}/);
assert.match(professionalPage, /invitedEmailMasked/);
assert.match(professionalPage, /ViaseeBrand/);

const memberPage = await read('src/pages/AcceptProviderInvitation.jsx');
assert.match(memberPage, /professionalInvitationOps", \{ action: "list_mine" \}/, 'dupa acces, invitatia de specialist nu se pierde');
assert.match(memberPage, /to="\/accept-professional-invitation"/);

console.log('verify-account-safety-step4: ok');
