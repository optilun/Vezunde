import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../base44/functions/professionalInvitationOps/entry.ts', import.meta.url), 'utf8');
const schema = await readFile(new URL('../base44/entities/ProfessionalInvitation.jsonc', import.meta.url), 'utf8');
const team = await readFile(new URL('../src/components/workspace/provider/ProviderTeam.jsx', import.meta.url), 'utf8');
const acceptPage = await readFile(new URL('../src/pages/AcceptProfessionalInvitation.jsx', import.meta.url), 'utf8');

assert.match(source, /base44\.integrations\.Core\.SendEmail/);
assert.match(source, /accept-professional-invitation\?token=/);
assert.match(source, /invitationEmail\(\{[\s\S]*invitationLink/);
assert.match(source, /email_sent:\s*delivery\.sent/);
assert.doesNotMatch(source, /email_sent:\s*false/);
assert.match(source, /delivery_status:\s*delivery\.sent\s*\?\s*'sent'\s*:\s*'manual_required'/);
assert.match(source, /delivery_provider:\s*delivery\.provider/);
assert.match(source, /delivery_error:\s*delivery\.sent\s*\?\s*''\s*:\s*delivery\.error/);
assert.match(source, /provider:\s*'manual'/);
assert.match(source, /createInvitation\(base44, svc, user, payload, req\)/);
assert.match(source, /secure_token_hash:\s*await hashToken\(rawToken\)/);
assert.doesNotMatch(source, /secure_token\s*:\s*rawToken/);

assert.match(schema, /"delivery_status"/);
assert.match(schema, /"sent"/);
assert.match(schema, /"manual_required"/);
assert.match(schema, /"delivery_provider"/);
assert.match(schema, /"last_delivery_attempt_at"/);
assert.match(schema, /"delivery_error"/);

assert.match(team, /response\.data\?\.email_sent\s*\?\s*"Invitația a fost trimisă\."/);
assert.match(team, /Trimite specialistului linkul afișat mai jos/);
assert.match(acceptPage, /redirectToLogin\(window\.location\.href\)/);
assert.match(acceptPage, /același email pe care a fost trimisă invitația/);

console.log('Professional invitation delivery checks passed.');
