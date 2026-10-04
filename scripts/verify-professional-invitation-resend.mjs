// Audit cont organizație, #19 (2026-10-04): o invitație de specialist expirată poate fi trimisă
// din nou. Rulează funcția reală pe date false: aceleași verificări ca la crearea unei invitații.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeDb(tables) {
  let sequence = 0;
  const entities = new Proxy({}, {
    get: (_target, rawName) => {
      const name = String(rawName);
      tables[name] ||= [];
      return {
        async filter(query) {
          return tables[name].filter((row) => Object.entries(query || {}).every(([key, value]) => row[key] === value)).map((row) => structuredClone(row));
        },
        async get(id) {
          const row = tables[name].find((item) => item.id === id);
          if (!row) throw new Error('not found');
          return structuredClone(row);
        },
        async create(data) {
          const row = { id: `${name}-${++sequence}`, created_date: new Date().toISOString(), ...structuredClone(data) };
          tables[name].push(row);
          return structuredClone(row);
        },
        async update(id, data) {
          const row = tables[name].find((item) => item.id === id);
          Object.assign(row, structuredClone(data));
          return structuredClone(row);
        },
      };
    },
  });
  return { entities };
}

const outDir = await mkdtemp(path.join(os.tmpdir(), 'viasee-invite-resend-'));
try {
  const outfile = path.join(outDir, 'professionalInvitationOps.mjs');
  await build({
    entryPoints: [path.join(root, 'base44/functions/professionalInvitationOps/entry.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
    plugins: [{ name: 'sdk', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export function createClientFromRequest() { return globalThis.__viaseeResendClient; }', loader: 'js' }));
    } }],
  });
  let handler = null;
  globalThis.Deno = { serve: (fn) => { handler = fn; } };
  await import(pathToFileURL(outfile).href);
  assert.equal(typeof handler, 'function');

  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const tables = {
    ProviderMembership: [
      { id: 'm1', user_id: 'owner', location_id: 'L1', status: 'active', role: 'organization_owner' },
    ],
    ProviderLocation: [{ id: 'L1', organization_id: 'O1', name: 'Locația test', claim_verification_status: 'approved' }],
    ProfessionalInvitation: [
      { id: 'expired-1', location_id: 'L1', organization_id: 'O1', invited_email_normalized: 'spec@example.test', professional_type: 'optometrist', status: 'expired', expires_at: past },
      { id: 'pending-1', location_id: 'L1', organization_id: 'O1', invited_email_normalized: 'alt@example.test', professional_type: 'optometrist', status: 'pending', expires_at: future },
      { id: 'other-loc', location_id: 'L2', organization_id: 'O2', invited_email_normalized: 'x@example.test', professional_type: 'optometrist', status: 'expired', expires_at: past },
    ],
  };
  const db = fakeDb(tables);
  const sent = [];
  const call = async (user, body) => {
    globalThis.__viaseeResendClient = {
      auth: { me: async () => user },
      asServiceRole: { entities: db.entities },
      integrations: { Core: { SendEmail: async (message) => { sent.push(message); } } },
    };
    const response = await handler(new Request('http://local/fn', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
  const owner = { id: 'owner', email: 'owner@example.test' };

  // Invitația expirată se trimite din nou: invitație nouă, același email și aceeași profesie.
  let result = await call(owner, { action: 'resend', invitation_id: 'expired-1', invitation_base_url: 'https://viasee.test' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.email_sent, true);
  assert.match(result.body.invitation_link, /^https:\/\/viasee\.test\/accept-professional-invitation\?token=/);
  const created = tables.ProfessionalInvitation.find((item) => item.id === result.body.invitation.id);
  assert.equal(created.invited_email_normalized, 'spec@example.test');
  assert.equal(created.professional_type, 'optometrist');
  assert.equal(created.status, 'pending');
  assert.equal(sent.at(-1).to, 'spec@example.test');
  assert.equal(tables.ProfessionalInvitation.find((item) => item.id === 'expired-1').status, 'expired', 'invitația veche rămâne în istoric');
  const audit = tables.DirectoryAuditRecord.at(-1);
  assert.match(audit.previous_values, /expired-1/);
  assert.match(audit.note, /^Retrimisa dupa expirarea/);

  // A doua retrimitere: există deja o invitație activă, deci refuz (fără duplicat).
  result = await call(owner, { action: 'resend', invitation_id: 'expired-1' });
  assert.equal(result.status, 409);

  // O invitație încă activă nu se retrimite.
  result = await call(owner, { action: 'resend', invitation_id: 'pending-1' });
  assert.equal(result.status, 400);

  // Fără acces la locație: refuz.
  result = await call(owner, { action: 'resend', invitation_id: 'other-loc' });
  assert.equal(result.status, 403);

  // Clientul nu poate scrie singur în audit că a fost o retrimitere.
  result = await call(owner, { action: 'create', location_id: 'L1', invited_email: 'nou@example.test', professional_type: 'optometrist', resent_from_invitation_id: 'fals' });
  assert.equal(result.status, 200);
  assert.doesNotMatch(tables.DirectoryAuditRecord.at(-1).previous_values, /fals/);

  const team = await readFile(path.join(root, 'src/components/workspace/provider/ProviderTeam.jsx'), 'utf8');
  assert.match(team, /action: "resend"/);
  assert.match(team, /Istoric invitații \(\{pastInvitations\.length\}\)/);
  assert.match(team, /invitation\.status === "expired" && \(\s*<button[^>]*onClick=\{\(\) => resendInvitation\(invitation\.id\)\}/);
} finally {
  delete globalThis.Deno;
  await rm(outDir, { recursive: true, force: true });
}

console.log('Professional invitation resend: OK');
