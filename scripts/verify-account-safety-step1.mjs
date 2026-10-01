// Conturi furnizor/specialist - pasul 1 de siguranta (2026-10-01).
//
// Auditul claude/audit-conturi-specialist-2026-10-01.md a gasit:
//   1. echipa intoarsa de getPublicProviderContent (functie publica) includea specialisti
//      neverificati sau fara consimtamant pentru locatie;
//   2. locatiile noi propuse de furnizori: fara limita, orfani la respingere, verificarea de
//      duplicate citea doar 500 de locatii si arata altor utilizatori locatii nepublicate;
//   3. extinderea unei organizatii cu o locatie noua o publica direct ca "verificata".
// Testul tine regulile pure si legaturile lor din functiile backend.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_PENDING_NEW_LOCATION_CLAIMS,
  pendingNewLocationClaimCount,
  newLocationClaimLimitReached,
  isRetiredLocationProposal,
  rejectedNewLocationPatch,
  canArchiveClaimCreatedOrganization,
  providerSafeIdentityCandidate,
} from '../base44/shared/newLocationClaimPolicy.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------- 1. Politica pentru locatii noi (functii pure) ----------
const pending = (mode, status) => ({ mode, status });
assert.equal(pendingNewLocationClaimCount([
  pending('new_location', 'in_asteptare'),
  pending('new_location_duplicate_review', 'needs_more_info'),
  pending('new_location', 'respinsa'),
  pending('claim', 'in_asteptare'),
]), 2, 'doar cererile de locatie noua active se numara');
assert.equal(newLocationClaimLimitReached(Array.from({ length: MAX_PENDING_NEW_LOCATION_CLAIMS - 1 }, () => pending('new_location', 'in_asteptare'))), false);
assert.equal(newLocationClaimLimitReached(Array.from({ length: MAX_PENDING_NEW_LOCATION_CLAIMS }, () => pending('new_location', 'in_asteptare'))), true);
assert.equal(newLocationClaimLimitReached(null), false);

assert.equal(isRetiredLocationProposal({ status: 'draft', claim_verification_status: 'rejected' }), true);
assert.equal(isRetiredLocationProposal({ status: 'draft', public_visibility_status: 'archived' }), true);
assert.equal(isRetiredLocationProposal({ status: 'publicata', claim_verification_status: 'rejected' }), false, 'o locatie publica (revendicare respinsa) ramane in verificarea de duplicate');
assert.equal(isRetiredLocationProposal({ status: 'in_verificare', claim_verification_status: 'pending' }), false);

assert.deepEqual(rejectedNewLocationPatch({ status: 'in_verificare', profile_control_status: 'directory' }), {
  claim_verification_status: 'rejected',
  status: 'draft',
  public_visibility_status: 'archived',
  active_status: 'inactiva',
});
assert.equal(rejectedNewLocationPatch({ status: 'publicata' }), null, 'o locatie publicata nu se arhiveaza din respingere');
assert.equal(rejectedNewLocationPatch({ status: 'draft', profile_control_status: 'claimed' }), null, 'o locatie controlata nu se arhiveaza din respingere');
assert.equal(rejectedNewLocationPatch(null), null);

const claim = { mode: 'new_location', organization_id: 'org1', location_id: 'loc1' };
const organization = { id: 'org1', status: 'activa', control_status: 'directory' };
assert.equal(canArchiveClaimCreatedOrganization({ claim, organization, organizationLocations: [{ id: 'loc1' }], activeMemberships: [] }), true);
assert.equal(canArchiveClaimCreatedOrganization({ claim, organization, organizationLocations: [{ id: 'loc1' }, { id: 'loc2' }], activeMemberships: [] }), false, 'organizatia cu alte locatii ramane');
assert.equal(canArchiveClaimCreatedOrganization({ claim, organization, organizationLocations: [{ id: 'loc1' }], activeMemberships: [{ id: 'm' }] }), false, 'organizatia cu membri ramane');
assert.equal(canArchiveClaimCreatedOrganization({ claim: { ...claim, mode: 'claim' }, organization, organizationLocations: [], activeMemberships: [] }), false, 'revendicarea unei locatii din director nu atinge organizatia');
assert.equal(canArchiveClaimCreatedOrganization({ claim, organization: { ...organization, directory_external_key: 'org:abc' }, organizationLocations: [{ id: 'loc1' }], activeMemberships: [] }), false, 'organizatiile din director nu se arhiveaza');
assert.equal(canArchiveClaimCreatedOrganization({ claim, organization: { ...organization, control_status: 'claimed' }, organizationLocations: [{ id: 'loc1' }], activeMemberships: [] }), false);
assert.equal(canArchiveClaimCreatedOrganization({ claim: { ...claim, organization_id: 'other' }, organization, organizationLocations: [{ id: 'loc1' }], activeMemberships: [] }), false);

const rawCandidate = {
  location_id: 'loc9', name: 'Optica X', organization_name: 'X SRL', address: 'Str. Lunga 1',
  locality_name: 'Cluj-Napoca', county_name: 'Cluj', severity: 'strong_duplicate', score: 90,
  matched_fields: ['aceeasi adresa'], recommended_action: 'claim_existing', profile_control_status: 'directory',
};
const publicSafe = providerSafeIdentityCandidate(rawCandidate, { status: 'publicata', active_status: 'activa' });
assert.equal(publicSafe.name, 'Optica X');
assert.equal(publicSafe.is_public, true);
const hidden = providerSafeIdentityCandidate(rawCandidate, { status: 'in_verificare' });
assert.equal(hidden.is_public, false);
assert.equal(hidden.name, '');
assert.equal(hidden.address, '');
assert.equal(hidden.organization_name, '');
assert.equal(hidden.recommended_action, 'review_manually');
assert.equal(hidden.severity, 'strong_duplicate', 'severitatea ramane, ca propunerea sa ajunga la admin');

// ---------- 2. Echipa publica: aceeasi poarta ca pagina publica ----------
const publicContent = await read('base44/functions/getPublicProviderContent/entry.ts');
assert.match(publicContent, /import \{ isPublicProfessionalProfile \} from '\.\.\/\.\.\/shared\/professionalProfileStatus\.js'/);
assert.match(publicContent, /canonicalTeamIds/);
assert.match(publicContent, /visibility_consent_status !== 'accepted'/);
assert.match(publicContent, /!isPublicProfessionalProfile\(prof\)/);
assert.doesNotMatch(publicContent, /prof\.is_public === false \|\|/, 'filtrul vechi (doar respins/arhivat) nu trebuie sa revina');

// ---------- 3. Trimiterea unei locatii noi ----------
const submitClaim = await read('base44/functions/submitProviderClaim/entry.ts');
const limitCheck = submitClaim.indexOf('newLocationClaimLimitReached(ownNewLocationClaims)');
const orgCreate = submitClaim.indexOf('ProviderOrganization.create(');
const locCreate = submitClaim.indexOf('ProviderLocation.create(');
assert.ok(limitCheck > -1, 'limita de locatii noi lipseste');
assert.ok(limitCheck < orgCreate && limitCheck < locCreate, 'limita trebuie verificata inainte de orice creare');
assert.match(submitClaim, /new_location_pending_limit/);

// ---------- 4. Respingerea unei locatii noi ----------
const claimReview = await read('base44/functions/directoryOps/adminProviderClaimReview.ts');
assert.match(claimReview, /archiveRejectedNewLocation\(svc, user, claim, note\)/);
assert.match(claimReview, /rejectedNewLocationPatch\(location\)/);
assert.match(claimReview, /canArchiveClaimCreatedOrganization\(/);
assert.match(claimReview, /action_type: 'archive_rejected_new_location'/);
assert.match(claimReview, /action_type: 'archive_rejected_new_location_organization'/);
assert.doesNotMatch(claimReview, /\.delete\(/, 'respingerea arhiveaza, nu sterge');

// ---------- 5. Verificarea de duplicate ----------
const identity = await read('base44/functions/findProviderIdentityCandidates/entry.ts');
assert.doesNotMatch(identity, /ProviderLocation\.list\(null, 500\)/, 'verificarea nu mai citeste doar primele 500 de locatii');
assert.match(identity, /ProviderLocation\.filter\(\{ locality_siruta_code: siruta \}/);
assert.match(identity, /isProviderContext && isRetiredLocationProposal\(l\)/);
assert.match(identity, /providerSafeIdentityCandidate\(candidate, locationById\.get\(candidate\.location_id\)\)/);

const panel = await read('src/components/provider/IdentityDuplicatePanel.jsx');
assert.match(panel, /c\.severity === "strong_duplicate" && c\.is_public !== false/, 'o propunere nepublica nu poate fi revendicata');

// ---------- 6. Extinderea organizatiei cu o locatie noua ----------
const expansion = await read('base44/functions/providerLocationExpansionOps/entry.ts');
const createStart = expansion.indexOf('const location = await svc.entities.ProviderLocation.create({');
const createEnd = expansion.indexOf('});', createStart);
const createBlock = expansion.slice(createStart, createEnd);
assert.ok(createStart > -1, 'crearea locatiei din extindere lipseste');
assert.match(createBlock, /profile_control_status: 'claimed'/);
assert.match(createBlock, /is_verified: false/);
assert.doesNotMatch(createBlock, /profile_control_status: 'verified'/, 'extinderea nu mai verifica automat');
assert.doesNotMatch(createBlock, /verification_state: 'verified'/);

console.log('verify-account-safety-step1: ok');
