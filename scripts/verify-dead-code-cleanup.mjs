import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const obsoleteFiles = [
  'src/components/workspace/provider/ProviderServicesGuided.jsx',
  'src/components/workspace/provider/ProviderServicesGuided.css',
  'src/components/workspace/provider/ProviderServicesProgressive.jsx',
  'src/components/workspace/provider/ProviderServicesClean.css',
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
  assert.equal(await exists(path), false, `${path} a fost reintrodus desi este inlocuit de workspace-ul operational`);
}

const providerServices = await readFile(new URL('../src/components/workspace/provider/ProviderServices.jsx', import.meta.url), 'utf8');
const threeColumn = await readFile(new URL('../src/components/workspace/provider/ProviderServicesThreeColumn.jsx', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../src/components/workspace/provider/ProviderServicesWorkspaceRuntime.jsx', import.meta.url), 'utf8');

assert.match(providerServices, /ProviderServicesThreeColumn/);
assert.match(threeColumn, /ProviderServicesWorkspaceRuntime/);
assert.match(runtime, /ProviderServicesWorkspaceOperational/);
assert.doesNotMatch(providerServices, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);
assert.doesNotMatch(threeColumn, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);
assert.doesNotMatch(runtime, /ProviderServicesGuided|ProviderServicesProgressive|ProviderServicesWorkspaceStructured/);

console.log('Dead code cleanup regression checks passed.');
