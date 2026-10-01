// Conturi furnizor/specialist - pasul 2 (2026-10-01).
//
// 1. O singura cale de aprobare/respingere a revendicarilor: actiunile vechi approve_claim /
//    reject_claim din directoryOps (doar API admin, alte reguli de rol) sunt retrase.
// 2. Accesul primit dintr-o revendicare poarta originea lui pe ProviderMembership.
// 3. Butonul "Verifica" scrie toate campurile pe care modelul canonic le cere pentru "verificat".
// 4. Nicio aprobare de revendicare, extindere sau rezolutie de identitate nu marcheaza automat
//    o locatie ca verificata.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveCanonicalControlStatus } from '../base44/shared/directoryCanonicalModel.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------- 1. Caile vechi de aprobare sunt retrase ----------
const directoryOps = await read('base44/functions/directoryOps/directoryOps.ts');
assert.match(directoryOps, /action === 'approve_claim' \|\| action === 'reject_claim'/);
assert.match(directoryOps, /code: 'claim_action_retired'/);
assert.match(directoryOps, /status: 410/);
assert.doesNotMatch(directoryOps, /const memberRole = isAccessRequest \? 'location_staff' : 'organization_owner'/, 'regula veche organization_owner pentru orice revendicare nu trebuie sa revina');

// ---------- 2. Originea accesului pe membership ----------
for (const path of [
  'base44/functions/directoryOps/adminProviderClaimReview.ts',
  'base44/functions/directoryOps/adminProviderScopedClaimReview.ts',
]) {
  const source = await read(path);
  const fn = source.slice(source.indexOf('async function ensureMembership('), source.indexOf('return created.id;'));
  assert.match(fn, /access_origin: 'claim'/, `${path}: originea accesului lipseste`);
  assert.match(fn, /claim_request_id/, `${path}: claim_request_id lipseste`);
  assert.match(fn, /if \(!existing\[0\]\.access_origin\) Object\.assign\(updates, origin\)/, `${path}: un membership existent trebuie sa-si pastreze originea`);
  assert.match(fn, /\.\.\.origin,/, `${path}: membership-ul nou trebuie creat cu origine`);
  assert.doesNotMatch(fn, /claim_scope: values\.claim_scope \|\| null/, `${path}: claim_scope este enum, null nu se trimite`);
  assert.match(source, /claim_request_id: claim\.id,/, `${path}: aprobarea trebuie sa transmita cererea`);
}

// ---------- 3. Butonul "Verifica" ----------
const verifyStart = directoryOps.indexOf("if (action === 'verify_profile') {");
const verifyBlock = directoryOps.slice(verifyStart, directoryOps.indexOf("return Response.json({ success: true });", verifyStart));
assert.ok(verifyStart > -1, 'actiunea verify_profile lipseste');
assert.match(verifyBlock, /profile_control_status: 'verified'/);
assert.match(verifyBlock, /verification_state: 'verified'/);
assert.match(verifyBlock, /is_verified: true/);
assert.match(verifyBlock, /last_verified_at: verifiedAt/);
assert.match(verifyBlock, /VerificationRecord\.create\(/);
assert.match(verifyBlock, /verification_method: 'manual'/);

// Exact campurile scrise de "Verifica" fac profilul verificat in modelul canonic; doar primul
// camp (comportamentul vechi) il lasa revendicat.
const claimedLocation = { status: 'publicata', profile_control_status: 'claimed', claim_verification_status: 'approved' };
assert.equal(deriveCanonicalControlStatus({
  ...claimedLocation,
  profile_control_status: 'verified',
  verification_state: 'verified',
  is_verified: true,
  last_verified_at: '2026-10-01T10:00:00.000Z',
}), 'verified');
assert.notEqual(deriveCanonicalControlStatus({ ...claimedLocation, profile_control_status: 'verified' }), 'verified');

// ---------- 4. Nicio aprobare nu verifica automat ----------
const identity = await read('base44/functions/providerLocationIdentityResolutionOps/entry.ts');
const updatesStart = identity.indexOf('const alreadyVerified = target.profile_control_status');
const updatesBlock = identity.slice(updatesStart, identity.indexOf('await svc.entities.ProviderLocation.update(target.id, updates);', updatesStart));
assert.ok(updatesStart > -1, 'rezolutia de identitate trebuie sa tina cont de verificarea existenta');
assert.match(updatesBlock, /profile_control_status: alreadyVerified \? 'verified' : 'claimed'/);
assert.match(updatesBlock, /is_verified: alreadyVerified/);
assert.doesNotMatch(updatesBlock, /last_verified_at/, 'asocierea nu este o verificare');
assert.equal(deriveCanonicalControlStatus({
  status: 'publicata',
  profile_control_status: 'claimed',
  claim_verification_status: 'approved',
  verification_state: 'in_verification',
  is_verified: false,
}), 'claimed', 'profilul asociat ramane revendicat pana la verificare');

console.log('verify-account-safety-step2: ok');
