import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [root, shell, header, access, accessContext, navigation, settings] = await Promise.all([
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('src/components/provider/shell/ProviderAppShell.jsx'),
  read('src/components/provider/shell/ProviderTeamHeaderAccess.jsx'),
  read('src/components/workspace/provider/ProviderAccess.jsx'),
  read('src/components/workspace/provider/ProviderAccessContext.jsx'),
  read('src/lib/workspaceNav.js'),
  read('src/components/workspace/provider/ProviderSettings.jsx'),
]);

assert.match(shell, /ProviderTeamHeaderAccess/);
assert.match(shell, /subtitle === "Spațiu furnizor"/);
assert.match(root, /ProviderAccessStateProvider/);
assert.match(accessContext, /createContext/);
assert.match(accessContext, /useProviderAccessState/);

assert.match(header, /Utilizatori și acces/);
assert.match(header, /\/contul-meu\?s=access/);
assert.match(header, /organization_admin/);
assert.match(header, /aria-expanded=\{open\}/);
assert.match(header, /aria-haspopup="dialog"/);
assert.match(header, /selectedOrganizationIdFor/);
assert.match(header, /useProviderAccessState/);
assert.match(header, /onRetry/);
assert.doesNotMatch(header, /getMyProviderMembers|base44\.functions\.invoke/);

assert.match(access, /useProviderAccessState/);
assert.match(access, /onRetryAccess/);
assert.match(access, /refreshAfterMutation/);
assert.doesNotMatch(access, /invoke\("getMyProviderMembers"/);

const memberLoads = [root, shell, header, access]
  .join('\n')
  .match(/invoke\("getMyProviderMembers"/g) || [];
assert.equal(memberLoads.length, 1, 'getMyProviderMembers trebuie sa aiba o singura sursa frontend');

assert.doesNotMatch(navigation, /key:\s*"access"/);
assert.match(navigation, /key:\s*"settings"/);
assert.match(navigation, /canManageMembers/);
assert.match(settings, /title="Acces și utilizatori"/);
assert.match(settings, /onNavigate\?\.\("access"\)/);

console.log('Provider team header shared access checks passed.');
