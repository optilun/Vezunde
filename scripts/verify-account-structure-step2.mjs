// Structura conturilor, pasul 2 (2026-10-03, aprobat de Alex): echipa unificată.
//
// 1. Specialistul cere singur „Lucrez aici”; organizația aprobă sau refuză.
// 2. Ownerul/managerul care e și specialist se afișează singur („Afișează-mă ca specialist”).
// 3. O singură invitație în echipă poate cere și afișarea ca specialist: un email, o acceptare.
//
// Funcțiile reale sunt rulate pe o bază de date falsă, în memorie.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import {
  approvedAssociationPatch,
  associationRequestBlockReason,
  associationRequestRecord,
  isPendingAssociationRequest,
  selfAssociationRecord,
} from '../base44/shared/professionalAssociationPolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

// ---------- date ----------
const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 7 * 86400000).toISOString();
const publicLocation = (id, extra = {}) => ({ id, organization_id: 'O1', name: `Locația ${id}`, status: 'publicata', public_visibility_status: 'approved', active_status: 'activa', profile_control_status: 'claimed', claim_verification_status: 'approved', provider_profile_type: 'optica_medicala', ...extra });
const publicProfile = { id: 'P2', user_id: 'u2', full_name: 'Specialist Doi', public_display_name: 'Specialist Doi', professional_type: 'optometrist', verification_status: 'verified', public_visibility_status: 'approved', profile_review_status: 'approved', is_public: true };
const draftProfile = { id: 'P1', user_id: 'u1', full_name: 'Owner Unu', public_display_name: 'Owner Unu', professional_type: 'optometrist', verification_status: 'unverified', public_visibility_status: 'draft', profile_review_status: 'draft', is_public: false };

// ---------- 0. politica, funcții pure ----------
assert.match(associationRequestBlockReason(publicLocation('X', { profile_control_status: 'directory', claim_verification_status: 'none' })), /nu este încă administrată/);
assert.match(associationRequestBlockReason(publicLocation('X', { active_status: 'inactiva' })), /nu mai este activă/);
assert.equal(associationRequestBlockReason(publicLocation('X')), '');
const requested = associationRequestRecord({ profile: publicProfile, locationId: 'L1', showPublicly: true, userId: 'u2', now: NOW });
assert.equal(requested.active_status, 'inactiv');
assert.equal(requested.public_status, 'privat');
assert.equal(requested.visibility_consent_status, 'accepted', 'cine cere singur își dă acordul de afișare în aceeași cerere');
assert.ok(isPendingAssociationRequest(requested));
assert.ok(!Object.values(associationRequestRecord({ profile: publicProfile, locationId: 'L1', showPublicly: false, userId: 'u2', now: NOW })).includes(''), 'fără string-uri goale');
assert.equal(approvedAssociationPatch({ assignment: requested, profile: publicProfile, location: publicLocation('L1'), actorUserId: 'u1', now: NOW }).public_status, 'public');
assert.equal(approvedAssociationPatch({ assignment: { ...requested, visibility_consent_status: 'not_requested' }, profile: publicProfile, location: publicLocation('L1'), actorUserId: 'u1', now: NOW }).public_status, 'privat', 'fără acord rămâne privat');
assert.equal(selfAssociationRecord({ profile: draftProfile, location: publicLocation('L1'), userId: 'u1', now: NOW }).public_status, 'privat', 'profil neverificat: privat');
assert.equal(selfAssociationRecord({ profile: publicProfile, location: publicLocation('L1'), userId: 'u2', now: NOW }).public_status, 'public');

// ---------- bază de date falsă ----------
function createDb(seed) {
  const tables = structuredClone(seed);
  let counter = 0;
  const calls = { emails: [], invokes: [] };
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
      async filter(query, sort, limit, skip) {
        const found = rows().filter((row) => matches(row, query));
        const start = Number(skip) || 0;
        return structuredClone(found.slice(start, limit == null ? undefined : start + limit));
      },
      async list() { return structuredClone(rows()); },
      async get(id) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); return structuredClone(row); },
      async create(data) { const row = { id: `${name}-${++counter}`, created_date: new Date(Date.now() + counter).toISOString(), ...structuredClone(data) }; rows().push(row); return structuredClone(row); },
      async update(id, data) { const row = rows().find((item) => item.id === id); if (!row) throw new Error('not found'); Object.assign(row, structuredClone(data)); return structuredClone(row); },
      async updateMany(query, ops) {
        const found = rows().filter((row) => !query.id || row.id === query.id);
        for (const row of found) {
          Object.assign(row, ops.$set || {});
          for (const key of Object.keys(ops.$unset || {})) delete row[key];
        }
        return { updated: found.length };
      },
    };
  };
  const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
  return { tables, calls, entities };
}

const seed = {
  User: [
    { id: 'u1', email: 'owner@exemplu.test', full_name: 'Owner Unu', role: 'user' },
    { id: 'u2', email: 'spec@exemplu.test', full_name: 'Specialist Doi', role: 'user' },
    { id: 'u3', email: 'nou@exemplu.test', full_name: 'Nou Trei', role: 'user' },
  ],
  ProviderOrganization: [{ id: 'O1', name: 'Optica Test', status: 'activa' }],
  ProviderLocation: [publicLocation('L1'), publicLocation('L2'), publicLocation('L3', { profile_control_status: 'directory', claim_verification_status: 'none' })],
  ProviderMembership: [
    { id: 'm1', user_id: 'u1', organization_id: 'O1', location_id: 'L1', role: 'organization_owner', status: 'active', organization_wide_access: true, claim_scope: 'organization' },
    { id: 'm2', user_id: 'u1', organization_id: 'O1', location_id: 'L2', role: 'organization_owner', status: 'active', organization_wide_access: true, claim_scope: 'organization' },
  ],
  ProfessionalProfile: [publicProfile, draftProfile],
};

// ---------- încărcarea funcțiilor reale ----------
const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-step2-'));
const sdkStub = { name: 'sdk', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
  b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeStep2Client; }', loader: 'js' }));
} };
async function loadServeHandler(fn) {
  const outfile = path.join(outDir, `${fn}.mjs`);
  await build({ entryPoints: [path.join(root, `base44/functions/${fn}/entry.ts`)], bundle: true, platform: 'node', format: 'esm', outfile, plugins: [sdkStub], logLevel: 'silent' });
  let captured = null;
  globalThis.Deno = { serve: (handler) => { captured = handler; } };
  await import(pathToFileURL(outfile).href);
  assert.ok(captured, `${fn}: Deno.serve`);
  return captured;
}

try {
  const handlers = {};
  for (const fn of ['manageProfessionalAssignment', 'createProviderMemberInvitation', 'acceptProviderMemberInvitation', 'professionalInvitationOps', 'revokeProviderMemberInvitation']) {
    handlers[fn] = await loadServeHandler(fn);
  }
  const db = createDb(seed);
  const call = async (fn, userId, payload) => {
    const user = db.tables.User.find((row) => row.id === userId);
    globalThis.__viaseeStep2Client = {
      auth: { me: async () => user },
      asServiceRole: { entities: db.entities },
      integrations: { Core: { SendEmail: async (message) => { db.calls.emails.push(message); return { ok: true }; } } },
      functions: { invoke: async (name, body) => { db.calls.invokes.push({ name, body, userId }); return { data: await call(name, userId, body) }; } },
    };
    const response = await handlers[fn](new Request('https://viasee.test/fn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
    return { status: response.status, ...(await response.json()) };
  };
  const assignmentOf = (professionalId, locationId) => db.tables.ProfessionalLocationAssignment?.find((row) => row.professional_id === professionalId && row.location_id === locationId);

  // ---------- 1. „Lucrez aici” ----------
  let result = await call('manageProfessionalAssignment', 'u2', { action: 'request_association', location_id: 'L3', show_publicly: true });
  assert.equal(result.status, 409, 'locație neadministrată: nimeni nu poate aproba');
  result = await call('manageProfessionalAssignment', 'u2', { action: 'request_association', location_id: 'L1', show_publicly: true });
  assert.equal(result.status, 200);
  assert.equal(assignmentOf('P2', 'L1').active_status, 'inactiv');
  assert.equal(assignmentOf('P2', 'L1').public_status, 'privat', 'până la aprobare nu apare public');
  assert.ok(db.calls.emails.some((mail) => mail.to === 'owner@exemplu.test' && /Cerere de asociere/.test(mail.subject)), 'ownerul primește email');
  assert.equal((await call('manageProfessionalAssignment', 'u2', { action: 'request_association', location_id: 'L1' })).already_pending, true);

  const list = await call('manageProfessionalAssignment', 'u1', { action: 'list', location_id: 'L1' });
  assert.equal(list.assignments.find((row) => row.professional_id === 'P2').is_association_request, true);
  assert.equal(list.current_user_professional.id, 'P1');
  assert.equal((await call('manageProfessionalAssignment', 'u2', { action: 'approve_association', location_id: 'L1', professional_id: 'P2' })).status, 403, 'specialistul nu își aprobă singur cererea');

  result = await call('manageProfessionalAssignment', 'u1', { action: 'approve_association', location_id: 'L1', professional_id: 'P2' });
  assert.equal(result.status, 200);
  assert.equal(assignmentOf('P2', 'L1').active_status, 'activ');
  assert.equal(assignmentOf('P2', 'L1').public_status, 'public', 'profil verificat + acord dat = public');
  assert.ok(!db.tables.ProviderMembership.some((row) => row.user_id === 'u2'), 'aprobarea nu dă acces la contul organizației');

  await call('manageProfessionalAssignment', 'u2', { action: 'request_association', location_id: 'L2', show_publicly: false });
  assert.equal((await call('manageProfessionalAssignment', 'u2', { action: 'cancel_association_request', location_id: 'L2' })).association_request_status, 'withdrawn');
  await call('manageProfessionalAssignment', 'u2', { action: 'request_association', location_id: 'L2', show_publicly: false });
  assert.equal(assignmentOf('P2', 'L2').association_request_status, 'pending', 'cererea se poate retrimite');
  await call('manageProfessionalAssignment', 'u1', { action: 'decline_association', location_id: 'L2', professional_id: 'P2' });
  assert.equal(assignmentOf('P2', 'L2').association_request_status, 'declined');
  assert.equal(assignmentOf('P2', 'L2').active_status, 'inactiv');

  // ---------- 2. „Afișează-mă ca specialist” ----------
  result = await call('manageProfessionalAssignment', 'u1', { action: 'add_self', location_id: 'L1' });
  assert.equal(result.status, 200);
  assert.equal(assignmentOf('P1', 'L1').active_status, 'activ');
  assert.equal(assignmentOf('P1', 'L1').visibility_consent_status, 'accepted');
  assert.equal(assignmentOf('P1', 'L1').public_status, 'privat', 'profilul ownerului nu e încă verificat');
  assert.equal((await call('manageProfessionalAssignment', 'u3', { action: 'add_self', location_id: 'L1' })).status, 403, 'doar cine administrează locația');

  // ---------- 3. o singură invitație ----------
  result = await call('createProviderMemberInvitation', 'u1', { organization_id: 'O1', invited_email: 'nou@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L1'], specialist: { professional_type: 'optometrist', location_ids: ['L2'] } });
  assert.equal(result.status, 400, 'specialistul apare doar la locațiile din invitație');
  const emailsBefore = db.calls.emails.length;
  result = await call('createProviderMemberInvitation', 'u1', { organization_id: 'O1', invited_email: 'nou@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L1', 'L2'], specialist: { professional_type: 'optometrist', location_ids: ['L1'] } });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.specialist_invitation_count, 1);
  const memberInvitationId = result.invitation.id;
  const bundled = db.tables.ProfessionalInvitation.filter((row) => row.bundled_member_invitation_id === memberInvitationId);
  assert.equal(bundled.length, 1);
  assert.equal(bundled[0].location_id, 'L1');
  assert.equal(db.calls.emails.length, emailsBefore + 1, 'un singur email');
  assert.match(db.calls.emails.at(-1).body, /Vei aparea si ca Optometrist/);

  const inspected = await call('acceptProviderMemberInvitation', 'u3', { action: 'inspect', invitation_id: memberInvitationId });
  assert.equal(inspected.invitation.specialist.professional_type, 'optometrist');
  assert.deepEqual(inspected.invitation.specialist.locations.map((row) => row.id), ['L1']);

  result = await call('acceptProviderMemberInvitation', 'u3', { action: 'accept', invitation_id: memberInvitationId, specialist_visibility_consent: true });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.specialist_results.length, 1);
  assert.equal(result.specialist_results[0].success, true, JSON.stringify(result.specialist_results));
  assert.ok(db.calls.invokes.some((item) => item.name === 'professionalInvitationOps' && item.body.accept_visibility === true));
  const u3Profile = db.tables.ProfessionalProfile.find((row) => row.user_id === 'u3');
  assert.ok(u3Profile, 'profil profesional privat creat la acceptare');
  const u3Assignment = assignmentOf(u3Profile.id, 'L1');
  assert.equal(u3Assignment.visibility_consent_status, 'accepted');
  assert.equal(u3Assignment.public_status, 'privat', 'public abia după verificarea profilului');
  assert.ok(db.tables.ProviderMembership.some((row) => row.user_id === 'u3' && row.location_id === 'L2'), 'accesul în echipă e creat');

  // revocarea invitației de echipă revocă și partea de specialist
  db.tables.User.push({ id: 'u4', email: 'patru@exemplu.test', full_name: 'Patru', role: 'user' });
  result = await call('createProviderMemberInvitation', 'u1', { organization_id: 'O1', invited_email: 'patru@exemplu.test', proposed_role: 'location_staff', invited_location_ids: ['L1'], specialist: { professional_type: 'optician', location_ids: ['L1'] } });
  const secondId = result.invitation.id;
  result = await call('revokeProviderMemberInvitation', 'u1', { invitation_id: secondId });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.ok(db.tables.ProfessionalInvitation.filter((row) => row.bundled_member_invitation_id === secondId).every((row) => row.status === 'revoked'));
} finally {
  delete globalThis.Deno;
  await rm(outDir, { recursive: true, force: true });
}

// ---------- interfața ----------
const [team, access, acceptPage, professionalRoot, requestsUi, schemaAssignment, schemaInvitation] = await Promise.all([
  read('src/components/workspace/provider/ProviderTeam.jsx'),
  read('src/components/workspace/provider/ProviderAccess.jsx'),
  read('src/pages/AcceptProviderInvitation.jsx'),
  read('src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx'),
  read('src/components/workspace/professional/ProfessionalAssociationRequests.jsx'),
  read('base44/entities/ProfessionalLocationAssignment.jsonc'),
  read('base44/entities/ProfessionalInvitation.jsonc'),
]);
assert.match(team, /approve_association/);
assert.match(team, /Afișează-mă ca specialist/);
assert.match(access, /<InviteSpecialistOption/);
assert.match(access, /specialist: \{ professional_type: form\.professional_type, location_ids: specialistLocationIds \}/);
assert.match(acceptPage, /specialist_visibility_consent: specialistConsent/);
assert.match(professionalRoot, /<ProfessionalAssociationRequests/);
assert.match(requestsUi, /action: "request_association"/);
assert.match(requestsUi, /getClaimableProviderLocations/);
for (const field of ['association_origin', 'association_request_status', 'association_requested_at']) assert.match(schemaAssignment, new RegExp(`"${field}"`));
assert.match(schemaInvitation, /"bundled_member_invitation_id"/);

console.log('Account structure step 2: OK');
