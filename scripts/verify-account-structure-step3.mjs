// Structura conturilor, pasul 3 (2026-10-03, aprobat de Alex): patru roluri, fara „owner selectiv”.
//
// - Proprietar si Administrator: toata organizatia, inclusiv locatiile viitoare.
// - Manager locatie si Membru: doar locatiile bifate.
// - Matricea „rol -> ce poate” sta intr-un singur fisier (shared/providerRolePolicy.js), cu o copie
//   identica in base44/shared pentru functiile backend.
//
// Functiile reale sunt rulate pe o baza de date falsa, in memorie.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  PROVIDER_ACCESS_ROLES,
  PROVIDER_ROLE_LABELS,
  PROVIDER_ROLE_MATRIX,
  assignableProviderRoles,
  canManageProviderMember,
  capabilitiesForProviderRoles,
  providerAccessRoleFromMembership,
  providerRoleCoversOrganization,
  providerRoleHasCapability,
  providerRoleMatrixCell,
} from '../shared/providerRolePolicy.js';
import { ownerApprovalCoversOrganization } from '../shared/providerClaimScopePolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

// ---------- 0. matricea, functii pure ----------
for (const file of ['providerRolePolicy.js', 'providerOrganizationOwnerScope.js', 'providerClaimScopePolicy.js']) {
  assert.equal(await read(`shared/${file}`), await read(`base44/shared/${file}`), `${file}: cele doua copii sunt identice`);
}
assert.deepEqual(PROVIDER_ACCESS_ROLES, ['organization_owner', 'organization_admin', 'location_manager', 'location_staff']);
assert.deepEqual(Object.values(PROVIDER_ROLE_LABELS), ['Proprietar', 'Administrator', 'Manager locație', 'Membru']);
assert.ok(providerRoleCoversOrganization('organization_owner') && providerRoleCoversOrganization('organization_admin'));
assert.ok(!providerRoleCoversOrganization('location_manager') && !providerRoleCoversOrganization('location_staff'));
assert.deepEqual(assignableProviderRoles('organization_owner'), PROVIDER_ACCESS_ROLES);
assert.deepEqual(assignableProviderRoles('organization_admin'), ['location_manager', 'location_staff']);
assert.deepEqual(assignableProviderRoles('location_manager'), ['location_staff']);
assert.deepEqual(assignableProviderRoles('location_staff'), []);
assert.ok(canManageProviderMember('organization_admin', 'location_manager'));
assert.ok(!canManageProviderMember('organization_admin', 'organization_owner'));
assert.ok(!canManageProviderMember('location_manager', 'location_manager'));
assert.ok(canManageProviderMember('location_manager', ''), 'managerul poate adauga o persoana noua (ca membru)');
assert.ok(!canManageProviderMember('location_staff', ''));
for (const capability of ['organization.manage_billing', 'organization.manage_settings', 'organization.manage_privileged_members', 'location.manage_lifecycle']) {
  assert.ok(providerRoleHasCapability('organization_owner', capability), `proprietar: ${capability}`);
  assert.ok(!providerRoleHasCapability('organization_admin', capability), `administrator fara ${capability}`);
}
for (const capability of ['organization.manage_profile', 'organization.manage_locations', 'organization.manage_members']) {
  assert.ok(providerRoleHasCapability('organization_admin', capability), `administrator: ${capability}`);
  assert.ok(!providerRoleHasCapability('location_manager', capability), `manager fara ${capability}`);
}
assert.ok(providerRoleHasCapability('location_manager', 'location.manage_members'), 'managerul invita membri la locatiile lui');
assert.ok(!providerRoleHasCapability('location_staff', 'location.manage_content'));
assert.deepEqual(capabilitiesForProviderRoles(['location_staff']), ['organization.view', 'location.view', 'location.manage_requests', 'location.manage_operational_status']);
assert.equal(providerAccessRoleFromMembership({ role: 'location_manager', organization_role: 'organization_admin', organization_wide_access: true }), 'organization_admin');
assert.equal(providerAccessRoleFromMembership({ role: 'location_manager', organization_role: 'organization_admin', organization_wide_access: false }), 'location_manager');
assert.equal(providerRoleMatrixCell(PROVIDER_ROLE_MATRIX.find((row) => row.key === 'billing'), 'organization_admin'), false);
assert.equal(providerRoleMatrixCell(PROVIDER_ROLE_MATRIX.find((row) => row.key === 'scope'), 'location_staff'), 'Doar cele bifate');
assert.ok(ownerApprovalCoversOrganization(['L1', 'L2'], ['L2', 'L1']));
assert.ok(!ownerApprovalCoversOrganization(['L1'], ['L1', 'L2']), 'proprietar doar cu toate locatiile organizatiei');
assert.ok(!ownerApprovalCoversOrganization(['L1'], []));

// ---------- baza de date falsa ----------
function createDb(seed) {
  const tables = structuredClone(seed);
  let counter = 0;
  const calls = { emails: [], invites: [] };
  const matches = (row, query = {}) => Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return true;
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) return expected.$in.includes(row[key]);
      return true;
    }
    return row[key] === expected;
  });
  const entity = (name) => {
    const rows = () => (tables[name] ||= []);
    return {
      async filter(query, _sort, limit, skip) {
        const found = rows().filter((row) => matches(row, query));
        const start = Number(skip) || 0;
        return structuredClone(found.slice(start, limit == null ? undefined : start + limit));
      },
      async list() { return structuredClone(rows()); },
      async get(id) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { const row = { id: `${name}-${++counter}`, created_date: new Date(Date.now() + counter).toISOString(), ...structuredClone(data) }; rows().push(row); return structuredClone(row); },
      async update(id, data) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); Object.assign(row, structuredClone(data)); return structuredClone(row); },
    };
  };
  const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
  return { tables, calls, entities };
}

const FUTURE = new Date(Date.now() + 7 * 86400000).toISOString();
const location = (id) => ({ id, organization_id: 'O1', name: `Locatia ${id}`, status: 'publicata', public_visibility_status: 'approved', active_status: 'activa', profile_control_status: 'claimed', claim_verification_status: 'approved' });
const row = (id, userId, locationId, role, extra = {}) => ({ id, user_id: userId, organization_id: 'O1', location_id: locationId, role, status: 'active', organization_role: 'none', ...extra });
const adminRow = (id, userId, locationId) => row(id, userId, locationId, 'location_manager', { organization_role: 'organization_admin', organization_wide_access: true, claim_scope: 'organization' });
const ownerRow = (id, userId, locationId) => row(id, userId, locationId, 'organization_owner', { organization_wide_access: true, claim_scope: 'organization' });

const seed = {
  User: [
    { id: 'u1', email: 'proprietar@exemplu.test', full_name: 'Proprietar Unu', role: 'user' },
    { id: 'u4', email: 'admin@exemplu.test', full_name: 'Administrator Patru', role: 'user' },
    { id: 'u5', email: 'manager@exemplu.test', full_name: 'Manager Cinci', role: 'user' },
    { id: 'u6', email: 'membru6@exemplu.test', full_name: 'Membru Sase', role: 'user' },
    { id: 'u7', email: 'membru7@exemplu.test', full_name: 'Membru Sapte', role: 'user' },
    { id: 'u8', email: 'nou8@exemplu.test', full_name: 'Nou Opt', role: 'user' },
  ],
  ProviderOrganization: [{ id: 'O1', name: 'Optica Test', status: 'activa' }],
  ProviderLocation: [location('L1'), location('L2'), location('L3')],
  ProviderMembership: [
    ownerRow('m1', 'u1', 'L1'), ownerRow('m2', 'u1', 'L2'), ownerRow('m3', 'u1', 'L3'),
    adminRow('a1', 'u4', 'L1'), adminRow('a2', 'u4', 'L2'), adminRow('a3', 'u4', 'L3'),
    row('g1', 'u5', 'L1', 'location_manager', { claim_scope: 'location', organization_wide_access: false }),
    row('s1', 'u6', 'L1', 'location_staff', { claim_scope: 'location', organization_wide_access: false }),
    row('s2', 'u7', 'L2', 'location_staff', { claim_scope: 'location', organization_wide_access: false }),
  ],
  // O invitatie veche de „owner selectiv” (doar L1): nu mai poate fi acceptata.
  ProviderMemberInvitation: [
    { id: 'legacy-owner', organization_id: 'O1', invited_location_ids: ['L1'], invited_email_normalized: 'nou8@exemplu.test', proposed_role: 'organization_owner', organization_wide_access: false, invited_by_user_id: 'u1', status: 'pending', secure_token_hash: 'x', expires_at: FUTURE },
  ],
};

// ---------- incarcarea functiilor reale ----------
const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-step3-'));
const sdkStub = { name: 'sdk', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
  b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeStep3Client; }', loader: 'js' }));
} };
async function bundle(entry, name) {
  const outfile = path.join(outDir, `${name}.mjs`);
  await build({ entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'esm', outfile, plugins: [sdkStub], logLevel: 'silent' });
  return outfile;
}
async function loadServeHandler(fn) {
  const outfile = await bundle(`base44/functions/${fn}/entry.ts`, fn);
  let captured = null;
  globalThis.Deno = { serve: (handler) => { captured = handler; } };
  await import(pathToFileURL(outfile).href);
  assert.ok(captured, `${fn}: Deno.serve`);
  return captured;
}
async function loadHandle(file, name) {
  const outfile = await bundle(file, name);
  const module = await import(pathToFileURL(outfile).href);
  assert.equal(typeof module.handle, 'function', `${name}: handle`);
  return module.handle;
}

try {
  const handlers = {};
  for (const fn of ['createProviderMemberInvitation', 'setProviderMemberAccess', 'revokeProviderMemberInvitation', 'acceptProviderMemberInvitation']) {
    handlers[fn] = await loadServeHandler(fn);
  }
  handlers.getMyProviderMembers = await loadHandle('base44/functions/getMyProviderWorkspace/getMyProviderMembers.ts', 'getMyProviderMembers');
  handlers.getMyProviderWorkspace = await loadHandle('base44/functions/getMyProviderWorkspace/getMyProviderWorkspace.ts', 'getMyProviderWorkspace');

  const db = createDb(seed);
  const call = async (fn, userId, payload = {}) => {
    const user = db.tables.User.find((item) => item.id === userId);
    globalThis.__viaseeStep3Client = {
      auth: { me: async () => user, inviteUser: async (email) => { db.calls.invites.push(email); } },
      asServiceRole: { entities: db.entities },
      integrations: { Core: { SendEmail: async (message) => { db.calls.emails.push(message); return { ok: true }; } } },
      functions: { invoke: async () => ({ data: {} }) },
    };
    const response = await handlers[fn](new Request('https://viasee.test/fn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
    return { status: response.status, ...(await response.json()) };
  };
  const activeRows = (userId) => db.tables.ProviderMembership.filter((item) => item.user_id === userId && item.status === 'active');

  // ---------- 1. spatiul organizatiei: drepturile vin din matrice ----------
  let result = await call('getMyProviderWorkspace', 'u4');
  assert.equal(result.status, 200);
  assert.ok(result.memberships.every((membership) => membership.role === 'organization_admin'), 'administratorul se vede ca administrator, nu ca manager');
  let context = result.organization_contexts[0];
  assert.equal(context.current_user_role, 'organization_admin');
  for (const capability of ['organization.manage_profile', 'organization.manage_locations', 'organization.manage_members']) assert.ok(context.capabilities.includes(capability), capability);
  for (const capability of ['organization.manage_settings', 'organization.manage_billing', 'location.manage_lifecycle']) assert.ok(!context.capabilities.includes(capability), `fara ${capability}`);
  assert.equal(context.can_manage_members, true);
  assert.equal(context.can_manage_settings, false);
  assert.equal(result.member_summary.counters.organization_admins_count, 1);

  result = await call('getMyProviderWorkspace', 'u5');
  context = result.organization_contexts[0];
  assert.equal(context.current_user_role, 'location_manager');
  assert.equal(context.can_manage_members, true, 'managerul vede Echipa (membrii locatiilor lui)');
  assert.ok(!context.capabilities.includes('organization.manage_profile'));

  result = await call('getMyProviderWorkspace', 'u6');
  assert.equal(result.organization_contexts[0].can_manage_members, false, 'membrul nu gestioneaza echipa');

  result = await call('getMyProviderWorkspace', 'u1');
  assert.ok(result.organization_contexts[0].capabilities.includes('organization.manage_billing'), 'abonamentul: doar proprietarul');

  // ---------- 2. echipa: cine ce poate da ----------
  result = await call('getMyProviderMembers', 'u1', { organization_id: 'O1' });
  assert.deepEqual(result.available_invitation_roles, PROVIDER_ACCESS_ROLES);
  result = await call('getMyProviderMembers', 'u4', { organization_id: 'O1' });
  assert.deepEqual(result.available_invitation_roles, ['location_manager', 'location_staff']);
  assert.equal(result.manageable_location_ids.length, 3);
  result = await call('getMyProviderMembers', 'u5', { organization_id: 'O1' });
  assert.equal(result.status, 200, 'managerul are pagina Echipa');
  assert.deepEqual(result.available_invitation_roles, ['location_staff']);
  assert.deepEqual(result.manageable_location_ids, ['L1'], 'doar locatia lui');
  assert.ok(result.members.every((member) => member.location_id === 'L1'), 'vede doar oamenii locatiei lui');
  assert.equal(result.can_manage_members, true);
  result = await call('getMyProviderMembers', 'u6', { organization_id: 'O1' });
  assert.equal(result.status, 403, 'membrul nu gestioneaza echipa');

  // ---------- 3. invitatii ----------
  result = await call('createProviderMemberInvitation', 'u1', { organization_id: 'O1', invited_email: 'nou-proprietar@exemplu.test', proposed_role: 'organization_owner', invited_location_ids: ['L1'], organization_wide_access: false });
  assert.equal(result.status, 200);
  assert.equal(result.invitation.organization_wide_access, true, 'fara owner selectiv: proprietarul primeste toata organizatia');
  assert.deepEqual([...result.invitation.invited_location_ids].sort(), ['L1', 'L2', 'L3']);
  const ownerInvitationId = result.invitation.id;

  result = await call('createProviderMemberInvitation', 'u4', { organization_id: 'O1', invited_email: 'x1@exemplu.test', proposed_role: 'organization_owner' });
  assert.equal(result.status, 403, 'administratorul nu invita proprietari');
  result = await call('createProviderMemberInvitation', 'u4', { organization_id: 'O1', invited_email: 'x2@exemplu.test', proposed_role: 'organization_admin' });
  assert.equal(result.status, 403, 'administratorul nu invita administratori');
  result = await call('createProviderMemberInvitation', 'u4', { organization_id: 'O1', invited_email: 'x3@exemplu.test', proposed_role: 'location_manager', invited_location_ids: ['L2'] });
  assert.equal(result.status, 200, 'administratorul invita manageri');

  result = await call('createProviderMemberInvitation', 'u5', { organization_id: 'O1', invited_email: 'x4@exemplu.test', proposed_role: 'location_manager', invited_location_ids: ['L1'] });
  assert.equal(result.status, 403);
  assert.match(result.error, /doar membri/);
  result = await call('createProviderMemberInvitation', 'u5', { organization_id: 'O1', invited_email: 'x5@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L2'] });
  assert.equal(result.status, 403, 'managerul invita doar la locatiile lui');
  result = await call('createProviderMemberInvitation', 'u5', { organization_id: 'O1', invited_email: 'x6@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L1'] });
  assert.equal(result.status, 200, 'managerul invita membri la locatia lui');
  assert.equal(result.invitation.organization_wide_access, false);
  const staffInvitationId = result.invitation.id;
  result = await call('createProviderMemberInvitation', 'u6', { organization_id: 'O1', invited_email: 'x7@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L1'] });
  assert.equal(result.status, 403, 'membrul nu invita');

  // ---------- 4. revocare ----------
  result = await call('revokeProviderMemberInvitation', 'u4', { invitation_id: ownerInvitationId });
  assert.equal(result.status, 403, 'administratorul nu revoca invitatii de proprietar');
  result = await call('revokeProviderMemberInvitation', 'u5', { invitation_id: staffInvitationId });
  assert.equal(result.status, 200, 'managerul revoca invitatia de membru trimisa de el');
  result = await call('revokeProviderMemberInvitation', 'u1', { invitation_id: ownerInvitationId });
  assert.equal(result.status, 200);

  // ---------- 5. modificarea accesului ----------
  result = await call('setProviderMemberAccess', 'u5', { organization_id: 'O1', user_id: 'u6', assignments: [{ location_id: 'L1', role: 'location_manager' }] });
  assert.equal(result.status, 403, 'managerul nu face alti manageri');
  result = await call('setProviderMemberAccess', 'u5', { organization_id: 'O1', user_id: 'u4', assignments: [{ location_id: 'L1', role: 'location_staff' }] });
  assert.equal(result.status, 403, 'managerul nu modifica administratorul');
  result = await call('setProviderMemberAccess', 'u5', { organization_id: 'O1', user_id: 'u7', assignments: [{ location_id: 'L2', role: 'location_staff' }] });
  assert.equal(result.status, 403, 'managerul nu modifica alte locatii');
  result = await call('setProviderMemberAccess', 'u5', { organization_id: 'O1', user_id: 'u8', assignments: [{ location_id: 'L1', role: 'location_staff' }] });
  assert.equal(result.status, 200, 'managerul adauga un membru la locatia lui');
  assert.deepEqual(activeRows('u8').map((item) => [item.location_id, item.role]), [['L1', 'location_staff']]);

  result = await call('setProviderMemberAccess', 'u4', { organization_id: 'O1', user_id: 'u1', assignments: [{ location_id: 'L1', role: 'location_staff' }] });
  assert.equal(result.status, 403, 'administratorul nu modifica proprietarul');
  result = await call('setProviderMemberAccess', 'u4', { organization_id: 'O1', user_id: 'u6', assignments: [{ location_id: 'L1', role: 'organization_admin' }] });
  assert.equal(result.status, 403, 'administratorul nu face administratori');
  result = await call('setProviderMemberAccess', 'u4', { organization_id: 'O1', user_id: 'u5', assignments: [{ location_id: 'L1', role: 'location_manager' }, { location_id: 'L2', role: 'location_manager' }] });
  assert.equal(result.status, 200, 'administratorul muta managerul pe mai multe locatii');
  assert.deepEqual(activeRows('u5').map((item) => item.location_id).sort(), ['L1', 'L2']);

  // Proprietarul face din u6 proprietar bifand o singura locatie: primeste toata organizatia.
  result = await call('setProviderMemberAccess', 'u1', { organization_id: 'O1', user_id: 'u6', organization_wide_access: false, assignments: [{ location_id: 'L1', role: 'organization_owner' }] });
  assert.equal(result.status, 200);
  assert.equal(result.organization_wide_access, true);
  assert.deepEqual(activeRows('u6').map((item) => [item.location_id, item.role, item.organization_wide_access]).sort(), [
    ['L1', 'organization_owner', true], ['L2', 'organization_owner', true], ['L3', 'organization_owner', true],
  ]);

  // ---------- 6. invitatia veche de „owner selectiv” ----------
  result = await call('acceptProviderMemberInvitation', 'u8', { action: 'accept', invitation_id: 'legacy-owner' });
  assert.equal(result.status, 409);
  assert.match(result.error, /retrimisa/);
  assert.ok(!activeRows('u8').some((item) => item.role === 'organization_owner'), 'nu devine proprietar pe o singura locatie');
} finally {
  await rm(outDir, { recursive: true, force: true });
}

// ---------- 7. interfata si aprobarea revendicarilor ----------
const [access, accept, labels, workspaceRoot, scopedClaimReview, orgProfile, expansion, submitChange] = await Promise.all([
  read('src/components/workspace/provider/ProviderAccess.jsx'),
  read('src/pages/AcceptProviderInvitation.jsx'),
  read('src/lib/workspaceStatusLabels.js'),
  read('src/components/workspace/provider/ProviderWorkspaceRoot.jsx'),
  read('base44/functions/directoryOps/adminProviderScopedClaimReview.ts'),
  read('base44/functions/providerServiceConfigurationOps/manageProviderOrganizationProfile.ts'),
  read('base44/functions/providerLocationExpansionOps/entry.ts'),
  read('base44/functions/providerServiceConfigurationOps/submitProviderWorkspaceChange.ts'),
]);
assert.match(access, /<RoleMatrix \/>/, 'tabelul „Ce poate fiecare rol”');
assert.doesNotMatch(access, /ScopeChoice|· selectiv|Owneri globali/);
assert.match(accept, /PROVIDER_ROLE_DESCRIPTIONS/);
assert.match(labels, /PROVIDER_ROLE_LABELS as ROLE_LABELS/);
assert.match(workspaceRoot, /const ROLE_CAPABILITIES = PROVIDER_ROLE_CAPABILITIES;/);
assert.match(scopedClaimReview, /ownerApprovalCoversOrganization\(approvedLocationIds/);
assert.match(scopedClaimReview, /owner_requires_full_organization/);
assert.match(orgProfile, /'organization\.manage_profile'/, 'administratorul modifica profilul organizatiei');
assert.match(expansion, /'organization\.manage_locations'/, 'administratorul adauga locatii');
assert.match(submitChange, /public_profile: \['organization_owner', 'organization_admin'\]/);

console.log('Account structure step 3: OK');
