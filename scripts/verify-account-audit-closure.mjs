// Inchiderea auditului conturilor (2026-10-03).
//
// Ultima trecere prin fisierele neinspectate (claude/audit-conturi-specialist-2026-10-01.md) a gasit:
//   1. un owner limitat la anumite locatii putea deveni owner pe toata organizatia, prin randurile
//      fara organization_wide_access create la asocierea sau extinderea cu o locatie;
//   2. redirect deschis dupa login (`/.//evil.com` trecea de verificarea de origine);
//   3. asocierea unei locatii existente o publica automat;
//   4. la transferul intre organizatii verificarea se pastra;
//   5. o locatie fara organizatie isi pastra accesele vechi la asociere;
//   6. un furnizor putea vedea datele unei locatii nepublice a altei organizatii (request_existing);
//   7. cautarea de revendicare arata si locatii ascunse;
//   + sugestiile de retea promiteau "include-le si creeaza organizatia", dar adminul nu le vedea;
//   + diacriticele din formularul de revendicare si de locatie noua.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeDestination } from '../src/lib/postLoginRedirect.js';
import {
  planNewLocationAccess,
  plannedAccessNeedsUpdate,
} from '../base44/shared/providerOrganizationOwnerScope.js';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

// ---------- 2. Redirect dupa login ----------
const origin = 'https://viasee.ro';
assert.equal(safeDestination('/.//evil.com/x', origin), '', 'cale care devine //evil.com');
assert.equal(safeDestination('//evil.com', origin), '');
assert.equal(safeDestination('/\\evil.com', origin), '');
assert.equal(safeDestination('https://evil.com/x', origin), '');
assert.equal(safeDestination('/login', origin), '', 'nu se intoarce pe pagina de login');
assert.equal(safeDestination('/contul-meu?mode=provider', origin), '/contul-meu?mode=provider');
assert.equal(safeDestination('/accept-professional-invitation?token=abc', origin), '/accept-professional-invitation?token=abc', 'linkul de invitatie isi pastreaza tokenul');
assert.equal(safeDestination('/contul-meu?access_token=x&app_base_url=https://evil.com&s=leads', origin), '/contul-meu?s=leads', 'parametrii de pornire se elimina');

// ---------- 1. Acces la o locatie noua sau asociata ----------
const row = (user_id, location_id, extra = {}) => ({ user_id, location_id, organization_id: 'org', role: 'organization_owner', status: 'active', ...extra });
const memberships = [
  row('wide', 'L1', { organization_wide_access: true }),
  row('legacy', 'L1'), // fara flag si fara restrictie de scope: ramane acces la toata organizatia (ca inainte)
  row('limited', 'L1', { organization_wide_access: false, claim_scope: 'location' }),
  row('manager', 'L1', { role: 'location_manager' }),
];
const plan = planNewLocationAccess({ memberships, resolution: {}, organizationId: 'org', locationId: 'NEW' });
assert.deepEqual(plan.map((item) => item.user_id).sort(), ['legacy', 'wide'], 'doar ownerii cu acces la toata organizatia primesc locatia');
for (const item of plan) {
  assert.equal(item.desired.organization_wide_access, true, 'flag scris explicit');
  assert.equal(item.desired.claim_scope, 'organization');
}
const withLimitedRequester = planNewLocationAccess({ memberships, resolution: {}, organizationId: 'org', locationId: 'NEW', requesterUserId: 'limited' });
const limited = withLimitedRequester.find((item) => item.user_id === 'limited');
assert.ok(limited, 'solicitantul limitat primeste locatia ceruta');
assert.equal(limited.desired.organization_wide_access, false, 'dar nu acces la toata organizatia');
assert.equal(limited.desired.claim_scope, 'location');
assert.equal(planNewLocationAccess({ memberships, resolution: {}, organizationId: 'org', locationId: 'NEW', requesterUserId: 'manager' }).some((item) => item.user_id === 'manager'), false, 'un manager nu devine owner');
const restrictedByScope = planNewLocationAccess({ memberships, resolution: { restrictedUserIds: new Set(['legacy']) }, organizationId: 'org', locationId: 'NEW' });
assert.deepEqual(restrictedByScope.map((item) => item.user_id), ['wide'], 'restrictia din scope-ul aprobat se respecta');
assert.equal(plannedAccessNeedsUpdate(row('wide', 'NEW', { organization_wide_access: true }), plan.find((item) => item.user_id === 'wide').desired), false);
assert.equal(plannedAccessNeedsUpdate(row('wide', 'NEW', { status: 'inactive' }), plan.find((item) => item.user_id === 'wide').desired), true);
const [sharedScope, frontendScope] = await Promise.all([
  read('base44/shared/providerOrganizationOwnerScope.js'),
  read('shared/providerOrganizationOwnerScope.js'),
]);
assert.equal(sharedScope, frontendScope, 'cele doua copii raman identice');

const expansion = await read('base44/functions/providerLocationExpansionOps/entry.ts');
assert.match(expansion, /planNewLocationAccess\(\{ memberships, resolution, organizationId, locationId, requesterUserId \}\)/);
assert.doesNotMatch(expansion, /rolesByUser\.set\(requesterUserId, \[ORGANIZATION_OWNER_ROLE\]\)/, 'solicitantul nu mai primeste automat acces la toata organizatia');

const identity = await read('base44/functions/providerLocationIdentityResolutionOps/entry.ts');
const propagate = identity.slice(identity.indexOf('async function propagateOwners('), identity.indexOf('async function deactivatePreviousMemberships('));
assert.match(propagate, /planNewLocationAccess\(/);
assert.doesNotMatch(propagate, /role: 'organization_owner',\s*status: 'active',\s*\}\)/, 'nu mai creeaza randuri de owner fara flag');
assert.doesNotMatch(identity, /async function destinationOwners\(/);
assert.match(identity, /propagateOwners\(svc, destinationOrganizationId, target\.id, user\.id, clean\(submission\.submitted_by_user_id, 120\)\)/);

// ---------- 3 + 4 + 5. Asocierea: fara publicare, fara verificare mostenita la transfer ----------
const updatesBlock = identity.slice(identity.indexOf('const alreadyVerified = '), identity.indexOf('await svc.entities.ProviderLocation.update(target.id, updates);'));
assert.match(updatesBlock, /const alreadyVerified = relation !== 'other_organization'/);
assert.doesNotMatch(updatesBlock, /status: 'publicata'|public_visibility_status: 'approved'|active_status: 'activa'/, 'asocierea nu schimba starea de publicare');
assert.match(identity, /const deactivatedMembershipIds = relation !== 'same_organization'/);

// ---------- 6. request_existing: doar locatii publice ----------
const requestExisting = identity.slice(identity.indexOf('async function providerRequestExisting('), identity.indexOf('const currentOrganization = target.organization_id', identity.indexOf('async function providerRequestExisting(')));
assert.match(requestExisting, /deriveCanonicalDirectoryState\(target\)\.is_publicly_available !== true/);

// ---------- 7. Cautarea de revendicare ----------
const claimable = await read('base44/functions/getClaimableProviderLocations/entry.ts');
assert.match(claimable, /deriveCanonicalDirectoryState\(location\)\.is_publicly_available === true/);

// ---------- Sugestiile de retea ----------
const scopeStep = await read('src/components/provider/ClaimScopeStep.jsx');
assert.doesNotMatch(scopeStep, /include-le în revendicare și creează organizația/, 'nu se mai promite ce aprobarea nu face');
assert.match(scopeStep, /semnalează-le echipei VIASEE/);
const claimsUi = await read('src/components/admin/directory/DirOpsClaims.jsx');
assert.match(claimsUi, /payload\.network_suggestion_accepted === true/);
assert.match(claimsUi, /Furnizorul a semnalat ca aceste locatii fac parte din aceeasi retea/);

// ---------- Diacritice in formularul de revendicare ----------
const addOrClaim = await read('src/pages/AddOrClaim.jsx');
// 2026-10-03: titlul a devenit „Găsește organizația sau locația” (revendicare pornită de la organizație,
// altă sesiune). Verificăm doar că are diacritice.
assert.match(addOrClaim, /title="Găsește (profilul locației tale|organizația sau locația)"/);
assert.match(addOrClaim, /"Găsește profilul", "Confirmă relația"/);
const search = await read('src/components/provider/ProviderSearch.jsx');
assert.match(search, /Nu găsesc locația/);
const wizard = await read('src/components/provider/NewLocationWizard.jsx');
assert.match(wizard, /title: "Organizația și prima locație"/);
const panel = await read('src/components/provider/IdentityDuplicatePanel.jsx');
assert.match(panel, /Am găsit un profil foarte asemănător/);

console.log('verify-account-audit-closure: OK');
