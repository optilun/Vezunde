// Conturi furnizor/specialist - pasul 3 (2026-10-01).
//
// 1. O revendicare nu mai poate da acces la o locatie fara organizatie (membership cu
//    organization_id null = cont fara spatiu de organizatie / locatie invizibila in workspace).
// 2. Locatia noua se propune doar in numele unei organizatii (ramura independent_professional,
//    inaccesibila din interfata, a fost scoasa).
// 3. applyTeam (cod mort, crea ProfessionalProfile fara cont) a fost scos.
// 4. "Verifica" nu mai scoate un profil din suspendare; exista "Ridica suspendarea", care nu
//    verifica niciodata direct.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------- 1. Fara acces la locatii fara organizatie ----------
const scopedReview = await read('base44/functions/directoryOps/adminProviderScopedClaimReview.ts');
const orglessGuard = scopedReview.indexOf("code: 'location_without_organization'");
assert.ok(orglessGuard > -1, 'aprobarea cu scope trebuie sa refuze locatiile fara organizatie');
assert.ok(orglessGuard < scopedReview.indexOf('membershipIds.push(await ensureMembership('), 'refuzul trebuie sa vina inainte de orice membership');
assert.ok(orglessGuard < scopedReview.indexOf("claim_verification_status: 'approved',"), 'refuzul trebuie sa vina inainte de orice schimbare pe locatie');

const legacyReview = await read('base44/functions/directoryOps/adminProviderClaimReview.ts');
const legacyGuard = legacyReview.indexOf("code: 'location_without_organization'");
assert.ok(legacyGuard > -1, 'aprobarea fara scope trebuie sa refuze locatiile fara organizatie');
assert.ok(legacyGuard < legacyReview.indexOf('await svc.entities.ProviderLocation.update(location.id, locationUpdates);'));

const scopedSubmit = await read('base44/functions/submitProviderScopedClaim/entry.ts');
assert.doesNotMatch(scopedSubmit, /se creeaza una comuna/, 'comentariul care promitea crearea automata a organizatiei nu mai e adevarat');
assert.match(scopedSubmit, /requires_organization_creation` este doar informativ/);

// ---------- 2. Locatie noua doar in numele unei organizatii ----------
const submitClaim = await read('base44/functions/submitProviderClaim/entry.ts');
assert.match(submitClaim, /const SUBJECT_TYPES = \['organization'\];/);
assert.doesNotMatch(submitClaim, /PROFESSIONAL_TYPES/);
assert.doesNotMatch(submitClaim, /professional_identity/);
const wizard = await read('src/components/provider/NewLocationWizard.jsx');
assert.match(wizard, /claim_subject_type: "organization"/, 'interfata trimite in continuare organizatia');

// ---------- 3. applyTeam scos ----------
const workspaceReview = await read('base44/functions/directoryOps/adminWorkspaceReview.ts');
assert.doesNotMatch(workspaceReview, /async function applyTeam\(/);
assert.doesNotMatch(workspaceReview, /ProfessionalProfile\.(create|update)\(/);
assert.match(workspaceReview, /Sectiunea legacy pentru echipa nu mai poate modifica identitatea profesionala/, 'garda 409 ramane');

// ---------- 4. Suspendare / verificare ----------
const directoryOps = await read('base44/functions/directoryOps/directoryOps.ts');
const verifyStart = directoryOps.indexOf("if (action === 'verify_profile') {");
const verifyBlock = directoryOps.slice(verifyStart, directoryOps.indexOf("if (action === 'suspend_profile') {"));
const suspendedGuard = verifyBlock.indexOf("loc.profile_control_status === 'suspended'");
assert.ok(suspendedGuard > -1, '"Verifica" trebuie sa refuze profilurile suspendate');
assert.ok(suspendedGuard < verifyBlock.indexOf('ProviderLocation.update('), 'refuzul vine inainte de scriere');

const unsuspendStart = directoryOps.indexOf("if (action === 'unsuspend_profile') {");
assert.ok(unsuspendStart > -1, 'actiunea "Ridica suspendarea" lipseste');
const unsuspendBlock = directoryOps.slice(unsuspendStart, directoryOps.indexOf('// ---------- CLAIM APPROVAL / REJECTION', unsuspendStart));
assert.match(unsuspendBlock, /profile_control_status: claimed \? 'claimed' : 'directory'/);
assert.match(unsuspendBlock, /is_verified: false/);
assert.doesNotMatch(unsuspendBlock, /profile_control_status: 'verified'/, 'ridicarea suspendarii nu verifica');
assert.match(unsuspendBlock, /action_type: 'unsuspend_profile'/);

const profiles = await read('src/components/admin/directory/DirOpsProfiles.jsx');
assert.match(profiles, /unsuspend: "unsuspend_profile"/);
assert.match(profiles, /pcs === "suspended" && \(/);
assert.match(profiles, /pcs !== "verified" && pcs !== "suspended" && \(/, '"Verifica" nu apare pe un profil suspendat');

console.log('verify-account-safety-step3: ok');
