import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_ACCOUNT_FLOW_CONTRACTS,
  nextProviderReviewStatus,
  reviewNoteRequirement,
  simulateProviderReviewFlow,
} from '../shared/providerAccountWorkflowContract.js';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function hasAll(text, patterns, label) {
  for (const pattern of patterns) {
    assert.match(text, pattern, `${label}: lipseste contractul ${pattern}`);
  }
}

const workflowFiles = {
  manageProviderOrganizationProfile: 'base44/functions/manageProviderOrganizationProfile/entry.ts',
  adminOrganizationProfileReview: 'base44/functions/adminOrganizationProfileReview/entry.ts',
  submitProviderWorkspaceChange: 'base44/functions/submitProviderWorkspaceChange/entry.ts',
  adminWorkspaceReview: 'base44/functions/adminWorkspaceReview/entry.ts',
  providerServiceConfigurationOps: 'base44/functions/providerServiceConfigurationOps/entry.ts',
  adminServiceConfigurationReview: 'base44/functions/adminServiceConfigurationReview/entry.ts',
  locationPhotoOps: 'base44/functions/locationPhotoOps/entry.ts',
  providerLocationLifecycleOps: 'base44/functions/providerLocationLifecycleOps/entry.ts',
  providerLocationExpansionOps: 'base44/functions/providerLocationExpansionOps/entry.ts',
  providerLocationIdentityResolutionOps: 'base44/functions/providerLocationIdentityResolutionOps/entry.ts',
};

const loaded = {};
for (const [name, path] of Object.entries(workflowFiles)) loaded[name] = await source(path);

for (const [flowName, contract] of Object.entries(PROVIDER_ACCOUNT_FLOW_CONTRACTS)) {
  const providerSource = loaded[contract.providerFunction];
  const adminSource = loaded[contract.adminFunction];
  assert.ok(providerSource, `${flowName}: functia provider lipseste`);
  assert.ok(adminSource, `${flowName}: functia admin lipseste`);
  hasAll(providerSource, [/ProviderWorkspaceSubmission/, /pending_review/], `${flowName} provider`);
  hasAll(adminSource, [/approve|aproba/, /reject|respinge/, /pending_review/], `${flowName} admin`);
  if (contract.supportsMoreInfo) assert.match(adminSource, /request_more_info|needs_more_info|cere_informatii/, `${flowName}: lipseste fluxul de completari`);
}

const completeReview = simulateProviderReviewFlow([
  'submit',
  { action: 'request_more_info', note: 'Completeaza informatiile lipsa.' },
  'submit',
  'approve',
]);
assert.equal(completeReview.ok, true);
assert.equal(completeReview.status, 'approved');
assert.deepEqual(completeReview.history.map((item) => item.status), [
  'draft',
  'pending_review',
  'needs_more_info',
  'pending_review',
  'approved',
]);

const rejectedReview = simulateProviderReviewFlow([
  'submit',
  { action: 'reject', note: 'Datele nu corespund profilului.' },
]);
assert.equal(rejectedReview.ok, true);
assert.equal(rejectedReview.status, 'rejected');

const blockedMissingNote = simulateProviderReviewFlow(['submit', 'request_more_info']);
assert.equal(blockedMissingNote.ok, false);
assert.match(blockedMissingNote.error, /Nota administrativa/);

assert.equal(nextProviderReviewStatus('approved', 'submit').ok, false);
assert.equal(reviewNoteRequirement('reject', '').ok, false);
assert.equal(reviewNoteRequirement('approve', '').ok, true);

const publicProviderProfile = await source('base44/functions/getPublicProviderProfile/entry.ts');
const browseDirectory = await source('base44/functions/browseDirectoryProviders/entry.ts');
const publicOrganization = await source('base44/functions/getPublicOrganizationBrand/entry.ts');

hasAll(publicProviderProfile, [
  /publicDisclosure\?\.is_publicly_available !== true/,
  /ProviderLocationDirectoryState/,
  /public_detail_level/,
  /LocationService/,
], 'profil public');
assert.doesNotMatch(publicProviderProfile, /pending_changes/, 'profilul public nu trebuie sa citeasca drafturi');
assert.doesNotMatch(publicOrganization, /pending_changes/, 'brandul public nu trebuie sa citeasca drafturi');
hasAll(browseDirectory, [/loadPublicLocationsForLocality/, /public_visibility_status/, /paginateRows/], 'director public localizat si paginat');
assert.doesNotMatch(browseDirectory, /ProviderLocation\.filter\(\{ status: 'publicata' \}, null, 500\)/, 'directorul nu trebuie sa revina la limita globala de 500');

const accessInvite = await source('base44/functions/createProviderMemberInvitation/entry.ts');
const accessAccept = await source('base44/functions/acceptProviderMemberInvitation/entry.ts');
const accessManage = await source('base44/functions/setProviderMemberAccess/entry.ts');
hasAll(accessInvite, [/secure_token_hash/, /delivery_status/, /ProviderMemberInvitation/], 'invitatie membru');
hasAll(accessAccept, [/secure_token_hash/, /ProviderMembership/, /accepted/], 'acceptare invitatie');
hasAll(accessManage, [/organization_owner|ORGANIZATION_OWNER_ROLE/, /ProviderMembership/, /DirectoryAuditRecord/], 'administrare acces');

const overviewRoot = await source('src/components/workspace/provider/ProviderWorkspaceRoot.jsx');
hasAll(overviewRoot, [
  /refreshOverviewInPlace/,
  /key === "overview"/,
  /window\.addEventListener\("focus"/,
], 'refresh overview');

const photoUi = await source('src/components/workspace/provider/ProviderLocationPhotoCompact.jsx');
hasAll(photoUi, [
  /Salveaza ca draft/,
  /Trimite spre verificare/,
  /providerPhotoUploadLifecycleOps/,
], 'flux fotografie');

const lifecycleUi = await source('src/components/workspace/provider/ProviderSettings.jsx');
assert.doesNotMatch(lifecycleUi, /mailto:/, 'solicitarile de stare nu trebuie trimise prin mailto');
assert.match(lifecycleUi, /providerLocationLifecycleOps/);

const logoStatus = await source('base44/functions/getProviderLogoReviewStatus/entry.ts');
hasAll(logoStatus, [/profile_review_is_separate/, /logo_review_status/], 'status logo');

console.log('Provider account workflow contract E2E checks passed.');
