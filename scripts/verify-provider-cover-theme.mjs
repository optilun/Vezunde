import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { coverThemeBackground, normalizeCoverTheme, validateCoverTheme } from '../base44/shared/providerCoverTheme.js';

for (const bad of [null, [], { mode: 'photo', color: '#123456' }, { mode: 'solid', color: 'url(https://example.com)' }, { mode: 'solid', color: '#fff' }, { mode: 'gradient', color: '#123456' }, { mode: 'default', background: 'url(x)' }]) {
  assert.equal(validateCoverTheme(bad), null);
  assert.deepEqual(normalizeCoverTheme(bad), { mode: 'default' });
}
assert.deepEqual(normalizeCoverTheme('{invalid'), { mode: 'default' });
assert.deepEqual(normalizeCoverTheme('{"mode":"solid","color":"#AABBCC"}'), { mode: 'solid', color: '#aabbcc' });
assert.equal(coverThemeBackground({ mode: 'gradient', color: '#123456', colorEnd: '#ABCDEF' }), 'linear-gradient(135deg, #123456 0%, #abcdef 100%)');

// Exercise the real handler with an SDK stub; no hosted entities or production writes.
const handlerPath = path.resolve('base44/functions/providerServiceConfigurationOps/manageProviderOrganizationProfile.ts');
const handlerSource = fs.readFileSync(handlerPath, 'utf8')
  .replace("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';", 'const createClientFromRequest = () => globalThis.__providerCoverClient;')
  .replace('req: Request', 'req')
  .replace(/from '(\.\.\/[^']+)';/g, (_all, relative) => `from '${pathToFileURL(path.resolve(path.dirname(handlerPath), relative)).href}';`);
const { handle } = await import(`data:text/javascript;base64,${Buffer.from(handlerSource).toString('base64')}`);
let role = 'organization_owner';
let signedIn = true;
let writes = [];
let persisted = '';
globalThis.__providerCoverClient = {
  auth: { me: async () => signedIn ? { id: 'user', role: 'user' } : null },
  asServiceRole: { entities: {
    ProviderOrganization: {
      get: async (id) => ({ id, cover_theme_json: persisted, public_visibility_status: 'approved', name: 'Demo' }),
      update: async (id, values) => { writes.push({ id, values }); persisted = values.cover_theme_json; },
    },
    ProviderMembership: { filter: async (query) => query.organization_id === 'own-org' && role ? [{ role: role === 'organization_admin' ? 'location_manager' : role, organization_role: role, organization_wide_access: role === 'organization_admin', status: 'active' }] : [] },
    ProviderLocation: { get: async () => ({ id: 'own-location', organization_id: 'own-org' }), filter: async () => [{ id: 'own-location', organization_id: 'own-org' }] },
  } },
};
const call = async (theme, organization_id = 'own-org') => {
  const response = await handle(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ action: 'save_cover', organization_id, location_id: 'own-location', theme, public_visibility_status: 'approved', logo_url: 'malicious' }) }));
  return { status: response.status, data: await response.json() };
};
try {
  signedIn = false;
  assert.equal((await call({ mode: 'solid', color: '#123456' })).status, 401);
  signedIn = true;
  assert.equal((await call({ mode: 'solid', color: '#123456' }, 'another-org')).status, 403);
  for (role of ['location_manager', 'location_staff', '']) assert.equal((await call({ mode: 'solid', color: '#123456' })).status, 403);
  role = 'organization_owner';
  assert.equal((await call({ mode: 'solid', color: 'url(x)' })).status, 400);
  assert.equal(writes.length, 0);
  const result = await call({ mode: 'gradient', color: '#123456', colorEnd: '#ABCDEF' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.cover_theme, { mode: 'gradient', color: '#123456', colorEnd: '#abcdef' });
  assert.deepEqual(writes, [{ id: 'own-org', values: { cover_theme_json: '{"mode":"gradient","color":"#123456","colorEnd":"#abcdef"}' } }]);
  assert.equal((await call(result.data.cover_theme)).data.unchanged, true);
  assert.equal(writes.length, 1);
  role = 'organization_admin';
  assert.equal((await call({ mode: 'solid', color: '#456789' })).status, 200);
  assert.equal((await call({ mode: 'default' })).status, 200);
  assert.equal(persisted, '{"mode":"default"}');
} finally {
  delete globalThis.__providerCoverClient;
}
console.log('Provider cover: valid colors, CSS injection rejection, owner/admin scope, persistence, reset and no-op passed.');
