import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../src/components/provider/shell/ProviderAppShell.jsx', import.meta.url), 'utf8');
const header = await readFile(new URL('../src/components/provider/shell/ProviderTeamHeaderAccess.jsx', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../src/lib/workspaceNav.js', import.meta.url), 'utf8');
const settings = await readFile(new URL('../src/components/workspace/provider/ProviderSettings.jsx', import.meta.url), 'utf8');

assert.match(shell, /ProviderTeamHeaderAccess/);
assert.match(shell, /subtitle === "Spațiu furnizor"/);
assert.match(shell, /userId=\{user\?\.id \|\| ""\}/);
assert.match(shell, /locationId=\{providerLocationId\}/);
assert.match(shell, /publicProfileUrl\.match\(\/\^\\\/furnizor/);

assert.match(header, /getMyProviderMembers/);
assert.match(header, /Utilizatori și acces/);
assert.match(header, /\/contul-meu\?s=settings/);
assert.match(header, /aria-expanded=\{open\}/);
assert.match(header, /aria-haspopup="dialog"/);
assert.match(header, /document\.addEventListener\("pointerdown"/);
assert.match(header, /selectedOrganizationIdFor/);
assert.match(header, /manageable_organization_ids/);
assert.match(header, /membership\.organization_id === selectedOrganizationId/);
assert.match(header, /invitation\.organization_id === selectedOrganizationId/);
assert.match(header, /void load\(\{ silent: true \}\)/);
assert.doesNotMatch(header, /createProviderMemberInvitation|setProviderMemberAccess|revokeProviderMemberInvitation/);
assert.doesNotMatch(header, /PopoverContent/);

assert.doesNotMatch(navigation, /key:\s*"access"/);
assert.doesNotMatch(navigation, /Acces si utilizatori/);
assert.match(navigation, /key:\s*"settings"/);
assert.match(navigation, /canManageMembers/);

assert.match(settings, /title="Acces și utilizatori"/);
assert.match(settings, /onNavigate\?\.\("access"\)/);

console.log('Provider team header access checks passed.');
