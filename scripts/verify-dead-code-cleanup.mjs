import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const obsoleteFiles = [
  'src/components/ProtectedRoute.jsx',
  'src/pages/AdminVerifications.jsx',
  'src/components/admin/AdminClaimCard.jsx',
  'src/components/admin/AdminLocationRow.jsx',
  'src/components/admin/AdminPendingChanges.jsx',
  'src/components/admin/AdminSettingsPlaceholder.jsx',
  'src/components/admin/directory/AdminProfileChangesReview.jsx',
  'src/components/admin/directory/AdminLocationPhotoReview.jsx',
  'src/components/admin/directory/DirOpsDashboard.jsx',
  'src/components/workspace/provider/ProviderAccessInvitations.jsx',
  'src/components/workspace/provider/ProviderAccessMembers.jsx',
  'src/components/workspace/provider/ProviderLocationPhotos.jsx',
  'src/components/workspace/provider/ProviderServicesGuided.jsx',
  'src/components/workspace/provider/ProviderServicesGuided.css',
  'src/components/workspace/provider/ProviderServicesProgressive.jsx',
  'src/components/workspace/provider/ProviderServicesClean.css',
  'src/components/workspace/provider/ProviderServicesPolish.css',
  'src/components/workspace/provider/ProviderServicesStructured.css',
  'src/components/workspace/provider/ProviderServicesWorkspace.jsx',
  'src/components/workspace/provider/ProviderServicesWorkspaceStructured.jsx',
];

async function exists(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

for (const path of obsoleteFiles) {
  assert.equal(await exists(path), false, `${path} a fost reintrodus desi are un inlocuitor activ`);
}

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const providerServices = await readFile(new URL('../src/components/workspace/provider/ProviderServices.jsx', import.meta.url), 'utf8');
const threeColumn = await readFile(new URL('../src/components/workspace/provider/ProviderServicesThreeColumn.jsx', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../src/components/workspace/provider/ProviderServicesWorkspaceRuntime.jsx', import.meta.url), 'utf8');
const providerWorkspace = await readFile(new URL('../src/components/workspace/provider/ProviderWorkspaceRoot.jsx', import.meta.url), 'utf8');
const locationsWithPhoto = await readFile(new URL('../src/components/workspace/provider/ProviderLocationsWithPhoto.jsx', import.meta.url), 'utf8');

assert.match(app, /RequireAuth/);
assert.match(app, /AdminDirectoryOps/);
assert.doesNotMatch(app, /ProtectedRoute|AdminVerifications/);
assert.match(providerWorkspace, /ProviderAccess/);
assert.match(locationsWithPhoto, /ProviderLocationPhotoCompact/);
assert.match(providerServices, /ProviderServicesThreeColumn/);
assert.match(threeColumn, /ProviderServicesWorkspaceRuntime/);
assert.match(runtime, /ProviderServicesWorkspaceOperational/);
assert.doesNotMatch(providerServices, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);
assert.doesNotMatch(threeColumn, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);
assert.doesNotMatch(runtime, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);

console.log('Dead code cleanup regression checks passed.');
