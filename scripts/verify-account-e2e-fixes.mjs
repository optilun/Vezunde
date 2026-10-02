// Reparatii dupa testele end-to-end ale conturilor (2026-10-02).
//
// Testele din browser (claude/audit-conturi-specialist-2026-10-01.md, sectiunea 15) au gasit:
//   F8 - la cererile marcate duplicat, adminul nu vedea numele si adresa locatiei gasite:
//        snapshot-ul salva varianta ascunsa pentru furnizor;
//   F1 - dialogul de aprobare a unei locatii noi arata "Manager locatie" dar trimitea
//        "Owner organizatie" (valoarea implicita nu era in lista);
//   F3 - comutatorul de organizatie din spatiul furnizorului nu schimba organizatia;
//   F11 - locatia respinsa ramanea cu verification_state 'in_verification'.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { providerSelectionUrl } from '../src/lib/providerWorkspaceLifecycle.js';
import { rejectedNewLocationPatch } from '../base44/shared/newLocationClaimPolicy.js';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

// ---------- F8: snapshot complet pentru admin ----------
const submitClaim = await read('base44/functions/submitProviderClaim/entry.ts');
assert.match(submitClaim, /svc\.entities\.ProviderLocation\.filter\(\{ id: \{ \$in: candidateIds \} \}/, 'numele/adresa candidatilor se citesc cu service role');
assert.match(submitClaim, /name: candidate\.name \|\| location\.public_display_name \|\| location\.name \|\| ''/, 'snapshot-ul completeaza numele ascuns pentru furnizor');
assert.match(submitClaim, /address: candidate\.address \|\| location\.address \|\| ''/, 'snapshot-ul completeaza adresa ascunsa pentru furnizor');
const claimSchema = await read('base44/entities/ProviderClaimRequest.jsonc');
const snapshotField = claimSchema.slice(claimSchema.indexOf('"identity_check_snapshot"'), claimSchema.indexOf('"status"'));
assert.match(snapshotField, /"read":\s*\{\s*"user_condition":\s*\{\s*"role":\s*"admin"/, 'snapshot-ul ramane citibil doar de admin');
const identity = await read('base44/functions/findProviderIdentityCandidates/entry.ts');
assert.match(identity, /providerSafeIdentityCandidate\(candidate, locationById\.get\(candidate\.location_id\), \{ ownLocation: ownLocationIds\.has\(candidate\.location_id\) \}\)/, 'furnizorul primeste in continuare varianta ascunsa');

// ---------- F1: dialogul de aprobare arata rolul trimis ----------
const dirOpsClaims = await read('src/components/admin/directory/DirOpsClaims.jsx');
assert.match(dirOpsClaims, /function ownerRoleAllowed\(claim, scope, payload/);
assert.match(dirOpsClaims, /if \(scope\) return scope\.claim_scope === "organization";/, 'cererile cu scope: owner doar pentru organizatie');
assert.match(dirOpsClaims, /return !\(claim\.mode === "claim" \|\| payload\.claim_scope === "location"\);/, 'aceeasi regula ca adminProviderClaimReview (isLocationScopedClaim)');
assert.match(dirOpsClaims, /roleInOptions\(approvalDefaultForClaim\(claim, scope, requestedRole\), roleOptions\)/, 'valoarea implicita e mereu una din optiunile afisate');
assert.match(dirOpsClaims, /\(action\.roleOptions \|\| LOCATION_ROLE_OPTIONS\)\.map/, 'lista din dialog vine din aceeasi decizie');
assert.match(dirOpsClaims, /locationScoped: !canGrantOwner/, 'avertismentul "nu poate acorda owner" apare doar cand chiar nu poate');
const claimReview = await read('base44/functions/directoryOps/adminProviderClaimReview.ts');
assert.match(claimReview, /const isLocationScopedClaim = claim\.mode === 'claim' \|\| submitted\.claim_scope === 'location';/, 'regula din backend pe care o oglindeste interfata');

// ---------- F3: comutatorul de organizatie ----------
assert.equal(providerSelectionUrl('mode=provider&s=overview'), '', 'fara organization/location in URL nu e nimic de sincronizat');
assert.equal(
  providerSelectionUrl('mode=provider&organization=orgA&location=locA&s=locations', { organizationId: 'orgB', locationId: 'locB' }),
  '/contul-meu?mode=provider&organization=orgB&location=locB&s=locations',
);
assert.equal(
  providerSelectionUrl('location=locA', { organizationId: 'orgB', locationId: 'locB' }),
  '/contul-meu?location=locB&organization=orgB',
);
assert.equal(providerSelectionUrl('organization=orgA&location=locA', { locationId: 'locB' }), '/contul-meu?location=locB', 'organizatie necunoscuta: parametrul vechi dispare');

const root = await read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx');
assert.match(root, /const appliedSelectionRequestRef = useRef\(""\);/);
assert.match(root, /if \(appliedSelectionRequestRef\.current === requestKey\) return;/, 'parametrii din URL se aplica o singura data pe valoare');
const selectOrganizationBlock = root.slice(root.indexOf('const selectOrganization = '), root.indexOf('const openLocationModule = '));
assert.match(selectOrganizationBlock, /applyLocationSelection\(locationId\)/, 'schimbarea organizatiei nu mai trece prin filtrul locatiilor organizatiei curente');
assert.doesNotMatch(selectOrganizationBlock, /selectLocation\(locationId\)/);
const selectLocationBlock = root.slice(root.indexOf('const selectLocation = '), root.indexOf('const selectOrganization = '));
assert.match(selectLocationBlock, /scopedLocationIds\.has\(locationId\)/, 'in aceeasi organizatie se pastreaza filtrul de acces');
assert.match(root, /providerSelectionUrl\(params, \{ organizationId: organizationIdForLocation\(locationId\), locationId \}\)/, 'URL-ul urmeaza alegerea');

// ---------- F11: locatia respinsa nu mai e "in verificare" ----------
assert.equal(rejectedNewLocationPatch({ status: 'draft', profile_control_status: 'directory', verification_state: 'in_verification' }).verification_state, 'unclaimed');
assert.equal(rejectedNewLocationPatch({ status: 'draft', profile_control_status: 'directory' }).verification_state, 'unclaimed');
assert.equal('verification_state' in rejectedNewLocationPatch({ status: 'draft', profile_control_status: 'directory', verification_state: 'suspended' }), false, 'o suspendare pusa de admin nu se suprascrie');
assert.equal('verification_state' in rejectedNewLocationPatch({ status: 'draft', profile_control_status: 'directory', verification_state: 'verified' }), false);
const locationSchema = await read('base44/entities/ProviderLocation.jsonc');
const verificationField = locationSchema.slice(locationSchema.indexOf('"verification_state"'), locationSchema.indexOf('"pending_changes"'));
assert.match(verificationField, /"unclaimed"/, 'valoarea folosita exista in schema');

console.log('verify-account-e2e-fixes: OK');
