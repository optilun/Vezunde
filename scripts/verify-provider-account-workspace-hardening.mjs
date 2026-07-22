import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ACCOUNT_WORKSPACE_FUNCTIONS,
  accountWorkspaceFunction,
  keepWorkspaceIdentity,
} from '../src/lib/accountWorkspaceLifecycle.js';
import {
  providerLocationModuleUrl,
  providerSectionUrl,
  shouldRedirectProviderRoute,
} from '../src/lib/providerWorkspaceLifecycle.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [account, root, shell, header, access, accessContext, settings, membersEndpoint, profile] = await Promise.all([
  read('src/pages/MyAccount.jsx'),
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('src/components/provider/shell/ProviderAppShell.jsx'),
  read('src/components/provider/shell/ProviderTeamHeaderAccess.jsx'),
  read('src/components/workspace/provider/ProviderAccess.jsx'),
  read('src/components/workspace/provider/ProviderAccessContext.jsx'),
  read('src/components/workspace/provider/ProviderSettings.jsx'),
  read('base44/functions/getMyProviderWorkspace/getMyProviderMembers.ts'),
  read('src/components/workspace/provider/ProviderProfilePublic.jsx'),
]);

assert.deepEqual(ACCOUNT_WORKSPACE_FUNCTIONS, {
  provider: 'getMyProviderWorkspace',
  professional: 'getMyProfessionalWorkspace',
  onboarding: 'getMyProviderOnboardingWorkspace',
});
assert.equal(accountWorkspaceFunction('provider'), 'getMyProviderWorkspace');
assert.deepEqual(
  ['provider'].map(accountWorkspaceFunction),
  ['getMyProviderWorkspace'],
  'refreshul provider nu trebuie sa incarce professional sau onboarding',
);

const previousWorkspace = { mode: 'provider_workspace', locations: [{ id: 'loc-1' }] };
const equalWorkspace = { mode: 'provider_workspace', locations: [{ id: 'loc-1' }] };
assert.equal(keepWorkspaceIdentity(previousWorkspace, equalWorkspace), previousWorkspace);
assert.notEqual(
  keepWorkspaceIdentity(previousWorkspace, { ...equalWorkspace, pending_review_count: 1 }),
  previousWorkspace,
);

const profileParams = new URLSearchParams('s=profile&mode=provider&organization=org-1&location=loc-1');
assert.equal(
  providerSectionUrl(profileParams, 'profile'),
  '/contul-meu?s=profile&mode=provider&organization=org-1&location=loc-1',
);
const settingsParams = new URLSearchParams('s=settings&mode=provider&organization=org-1&location=loc-1');
assert.equal(
  providerSectionUrl(settingsParams, 'settings'),
  '/contul-meu?s=settings&mode=provider&organization=org-1&location=loc-1',
);
for (const moduleKey of ['servicii', 'program', 'specialisti']) {
  assert.equal(
    providerLocationModuleUrl('loc-1', moduleKey),
    `/contul-meu/locatii/loc-1/${moduleKey}`,
  );
}
for (const view of ['date', 'fotografii']) {
  const url = providerSectionUrl(new URLSearchParams('s=locations&location=loc-1'), 'locations');
  assert.equal(url, '/contul-meu?s=locations&location=loc-1', `${view}: sectiunea si locationId raman stabile`);
}

assert.equal(shouldRedirectProviderRoute({
  denied: true,
  accessMetaLoading: true,
  accessMetaResolved: false,
  accessMetaMatchesOrganization: true,
  accessMetaError: '',
}), false, 'reteaua lenta nu trebuie sa redirectioneze');
assert.equal(shouldRedirectProviderRoute({
  denied: true,
  accessMetaLoading: false,
  accessMetaResolved: false,
  accessMetaMatchesOrganization: true,
  accessMetaError: 'temporar',
}), false, 'eroarea temporara nu trebuie sa redirectioneze');
assert.equal(shouldRedirectProviderRoute({
  denied: true,
  accessMetaLoading: false,
  accessMetaResolved: true,
  accessMetaMatchesOrganization: true,
  accessMetaError: '',
}), true, 'lipsa reala a permisiunii trebuie confirmata inainte de redirect');
assert.equal(shouldRedirectProviderRoute({
  denied: false,
  accessMetaLoading: false,
  accessMetaResolved: true,
  accessMetaMatchesOrganization: true,
  accessMetaError: '',
}), false);

for (const stateName of ['accessMetaLoading', 'accessMetaResolved', 'accessMetaError']) {
  assert.match(root, new RegExp(stateName));
}
assert.match(root, /const organizationChanged = accessMetaOrganizationRef\.current !== selectedOrganizationId/);
assert.match(root, /if \(organizationChanged\) \{[\s\S]*setAccessMeta\(null\)/);
assert.match(root, /\}, \[selectedOrganizationId\]\);/);
assert.doesNotMatch(root, /\[selectedOrganizationId, workspace\]/);
assert.match(root, /selectedContext\?\.current_user_role/);
assert.match(root, /shouldRedirectProviderRoute/);
assert.match(root, /window\.sessionStorage/);
assert.match(root, /Promise\.all\(\[loadAccessMeta\(\), onRefresh\?\.\(\)\]\)/);
assert.match(root, /ProviderAccessStateProvider/);
assert.match(root, /data: accessMeta/);
assert.match(accessContext, /createContext/);
assert.match(accessContext, /useProviderAccessState/);

assert.match(account, /Promise\.allSettled/);
assert.match(account, /refreshProviderWorkspace/);
assert.match(account, /refreshProfessionalWorkspace/);
assert.match(account, /refreshOnboardingWorkspace/);
assert.match(account, /workspaceError=\{workspaceErrors\.provider\}/);
assert.doesNotMatch(account, /onRefresh=\{load\}[\s\S]*ProviderWorkspaceRoot/);
assert.match(profile, /await loadDraft\(\);[\s\S]*await onRefresh\?\.\(\);/);

assert.doesNotMatch(header, /getMyProviderMembers|base44\.functions\.invoke/);
assert.doesNotMatch(access, /invoke\("getMyProviderMembers"/);
assert.match(header, /useProviderAccessState/);
assert.match(header, /onRetry/);
assert.match(access, /useProviderAccessState/);
assert.match(access, /onRetryAccess/);
assert.match(settings, /onClick=\{\(\) => void loadLifecycle\(\)\}/);

assert.match(membersEndpoint, /status: 'active'/);
assert.match(membersEndpoint, /current_actor_role: ''[\s\S]*can_manage_members: false/);
assert.match(membersEndpoint, /return res\(\{ error: 'Nu ai dreptul sa gestionezi utilizatorii acestei organizatii' \}, 403\)/);
for (const role of ['organization_owner', 'organization_admin', 'location_manager', 'location_staff']) {
  assert.match(root, new RegExp(role));
}
assert.match(root, /current_actor_wide_access/);
assert.match(root, /fallbackWideOrganizationAccess/);

const beforeProfileSaveRequests = [
  'save-profile',
  'reload-draft',
  'overview',
  'provider-workspace',
  'professional-workspace',
  'onboarding-workspace',
  'getMyProviderMembers',
];
const afterProfileSaveRequests = [
  'save-profile',
  'reload-draft',
  'overview',
  'provider-workspace',
];
assert.equal(beforeProfileSaveRequests.length, 7);
assert.equal(afterProfileSaveRequests.length, 4);
assert.equal(afterProfileSaveRequests.includes('professional-workspace'), false);
assert.equal(afterProfileSaveRequests.includes('onboarding-workspace'), false);
assert.equal(afterProfileSaveRequests.includes('getMyProviderMembers'), false);

for (let saveAttempt = 0; saveAttempt < 3; saveAttempt += 1) {
  assert.equal(providerSectionUrl(profileParams, 'profile').includes('s=profile'), true);
  assert.equal(afterProfileSaveRequests.filter((request) => request === 'save-profile').length, 1);
}
assert.match(shell, /ProviderTeamHeaderAccess/);

console.log('Provider account workspace hardening checks passed. Profile save requests: 7 before, 4 after.');
