// Reparatii dupa testele end-to-end ale conturilor (2026-10-02).
//
// Testele din browser (claude/audit-conturi-specialist-2026-10-01.md, sectiunea 15) au gasit:
//   F8 - la cererile marcate duplicat, adminul nu vedea numele si adresa locatiei gasite:
//        snapshot-ul salva varianta ascunsa pentru furnizor;
//   F1 - dialogul de aprobare a unei locatii noi arata "Manager locatie" dar trimitea
//        "Owner organizatie" (valoarea implicita nu era in lista);
//   F3 - comutatorul de organizatie din spatiul furnizorului nu schimba organizatia;
//   F11 - locatia respinsa ramanea cu verification_state 'in_verification'.
// A doua serie (tot 2026-10-02):
//   F4 - la incarcarea contului de furnizor Base44 raspundea uneori "Rate limit exceeded";
//   F2 - pasul 2 al locatiei noi arata "Manager locatie" pentru proprietar;
//   F10 - propria locatie aparea ca "propusa de altcineva".
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { providerSelectionUrl } from '../src/lib/providerWorkspaceLifecycle.js';
import { rejectedNewLocationPatch, providerSafeIdentityCandidate } from '../base44/shared/newLocationClaimPolicy.js';
import { RATE_LIMIT_MESSAGE, readableErrorMessage } from '../src/lib/transientRetry.js';
import { READ_ONLY_RETRY_FUNCTIONS, installBase44FunctionRouting } from '../src/api/base44FunctionRouting.js';

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


// ---------- F4: reincercare doar pentru functiile care citesc ----------
for (const name of ['getMyProviderWorkspace', 'getMyProfessionalWorkspace', 'getMyProviderOnboardingWorkspace', 'getMyProviderMembers', 'getProviderWorkspaceOverview', 'getProviderEntitlement']) {
  assert.ok(READ_ONLY_RETRY_FUNCTIONS.has(name), `${name} citeste date si se reincearca`);
}
for (const name of ['submitProviderClaim', 'getMyAccountDeletionEligibility', 'syncProviderOrganizationOwnerAccess', 'providerBillingOps', 'createProviderCheckoutSession', 'professionalInvitationOps']) {
  assert.equal(READ_ONLY_RETRY_FUNCTIONS.has(name), false, `${name} poate scrie si nu se reincearca automat`);
}
for (const name of READ_ONLY_RETRY_FUNCTIONS) {
  const file = name === 'getMyProviderWorkspace'
    ? 'base44/functions/getMyProviderWorkspace/getMyProviderWorkspace.ts'
    : name === 'getMyProfessionalWorkspace'
      ? 'base44/functions/getMyProfessionalWorkspace/entry.ts'
      : `base44/functions/getMyProviderWorkspace/${name}.ts`;
  assert.doesNotMatch(await read(file), /\.(create|update|delete|bulkCreate)\(/, `${name} trebuie sa ramana doar citire ca sa poata fi reincercata`);
}

const rateLimitError = () => Object.assign(new Error('Request failed'), { response: { status: 500, data: { error: 'Rate limit exceeded' } } });
function fakeClient(plan) {
  const calls = [];
  return {
    calls,
    functions: {
      invoke: async (name, payload) => {
        calls.push(name);
        const next = plan.shift();
        if (next instanceof Error) throw next;
        return { data: next ?? { ok: true, name, payload } };
      },
    },
  };
}
const fast = { readOnlyRetry: { delaysMs: [0, 0], wait: async () => {} } };
const readClient = fakeClient([rateLimitError(), rateLimitError(), { ok: true }]);
const readResult = await installBase44FunctionRouting(readClient, fast).functions.invoke('getMyProfessionalWorkspace', {});
assert.deepEqual(readResult.data, { ok: true }, 'o functie de citire reuseste dupa doua limite de trafic');
assert.equal(readClient.calls.length, 3);
const writeClient = fakeClient([rateLimitError(), { ok: true }]);
await assert.rejects(() => installBase44FunctionRouting(writeClient, fast).functions.invoke('submitProviderClaim', {}), /Request failed/);
assert.equal(writeClient.calls.length, 1, 'o functie care scrie nu se reincearca');

assert.equal(readableErrorMessage('Rate limit exceeded'), RATE_LIMIT_MESSAGE);
assert.equal(readableErrorMessage('Acces interzis'), 'Acces interzis');
assert.equal(readableErrorMessage('', 'fallback'), 'fallback');
const myAccount = await read('src/pages/MyAccount.jsx');
assert.match(myAccount, /readableErrorMessage\(result\.value\?\.data\?\.error, fallback\)/, 'contul arata mesajul in romana');
assert.match(root, /setAccessMetaError\(readableErrorMessage\(/);

// ---------- F2: pasul de relatie la locatia noua arata rolul acordat ----------
const wizRelation = await read('src/components/provider/steps/WizClaimRelation.jsx');
assert.match(wizRelation, /requestedRoleForRelationship\(contact\.claimant_relationship\)/);
assert.doesNotMatch(wizRelation, /acces doar la locatia selectata/);
assert.match(wizRelation, /Dupa verificare devii owner al organizatiei/);
const contactFields = await read('src/components/provider/ContactIdentityFields.jsx');
assert.match(contactFields, /owner: "organization_owner"/, 'aceeasi mapare ca ROLE_BY_RELATIONSHIP din submitProviderClaim');
assert.match(submitClaim, /owner: 'organization_owner'/);

// ---------- F10: propria locatie ----------
const raw = { location_id: 'loc1', name: 'Optica Mea', organization_name: 'Org', address: 'Str. 1', severity: 'strong_duplicate', score: 90, matched_fields: ['nume foarte asemanator'], recommended_action: 'claim_existing' };
const own = providerSafeIdentityCandidate(raw, { status: 'draft' }, { ownLocation: true });
assert.equal(own.is_own, true);
assert.equal(own.name, 'Optica Mea', 'propria locatie se arata cu nume');
assert.equal(own.address, 'Str. 1');
assert.equal(own.recommended_action, 'review_manually', 'propria locatie nu se revendica din nou');
const others = providerSafeIdentityCandidate(raw, { status: 'draft' });
assert.equal(others.is_own, undefined);
assert.equal(others.name, '', 'locatia nepublica a altcuiva ramane ascunsa');
assert.match(identity, /ProviderMembership\.filter\(\{ user_id: user\.id, status: 'active' \}/);
assert.match(identity, /\['in_asteptare', 'needs_more_info', 'aprobata'\]\.includes\(claim\.status\)/);
const panel = await read('src/components/provider/IdentityDuplicatePanel.jsx');
assert.match(panel, /c\.is_own \? c\.name/);
assert.match(panel, /c\.is_public !== false && !c\.is_own/, 'fara buton de revendicare pentru propria locatie');

console.log('verify-account-e2e-fixes: OK');
