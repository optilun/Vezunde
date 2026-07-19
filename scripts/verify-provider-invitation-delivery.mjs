import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../base44/functions/createProviderMemberInvitation/entry.ts', import.meta.url), 'utf8');
const acceptSource = await readFile(new URL('../base44/functions/acceptProviderMemberInvitation/entry.ts', import.meta.url), 'utf8');
const schema = await readFile(new URL('../base44/entities/ProviderMemberInvitation.jsonc', import.meta.url), 'utf8');
const membersSource = await readFile(new URL('../base44/functions/getMyProviderMembers/entry.ts', import.meta.url), 'utf8');
const acceptPage = await readFile(new URL('../src/pages/AcceptProviderInvitation.jsx', import.meta.url), 'utf8');
const postLogin = await readFile(new URL('../src/pages/PostLogin.jsx', import.meta.url), 'utf8');

assert.match(source, /base44\.auth\.inviteUser\(invitedEmail, 'user'\)/);
assert.match(source, /base44\.integrations\.Core\.SendEmail/);
assert.match(source, /svc\.entities\.User\.filter/);
assert.doesNotMatch(source, /RESEND_API_KEY|api\.resend\.com|sendWithResend/);
assert.match(source, /delivery_status:\s*delivery\.sent\s*\?\s*'sent'\s*:\s*'manual_required'/);
assert.match(source, /secure_token_hash:\s*await hash\(rawToken\)/);
assert.doesNotMatch(source, /secure_token\s*:\s*rawToken/);
assert.match(source, /create_provider_member_invitation/);
assert.match(source, /invitation_link:\s*invitationLink/);
assert.match(source, /email_sent:\s*delivery\.sent/);
assert.match(source, /deliveryKind:\s*'app_invitation'/);
assert.match(source, /deliveryKind:\s*'existing_user_email'/);

assert.match(acceptSource, /action === 'list_mine'/);
assert.match(acceptSource, /invited_email_normalized:\s*userEmail/);
assert.match(acceptSource, /invitation_id/);
assert.match(acceptSource, /account_email_match/);
assert.match(acceptSource, /accept_provider_member_invitation/);
assert.match(acceptPage, /action:\s*"list_mine"/);
assert.match(acceptPage, /invitation_id:\s*invitation\.id/);
assert.match(postLogin, /acceptProviderMemberInvitation/);
assert.match(postLogin, /\/accept-provider-invitation/);

assert.match(schema, /"delivery_status"/);
assert.match(schema, /"delivery_provider"/);
assert.match(schema, /"last_delivery_attempt_at"/);
assert.match(membersSource, /delivery_status:\s*invitation\.delivery_status/);
assert.match(membersSource, /delivery_provider:\s*invitation\.delivery_provider/);

console.log('Provider invitation delivery checks passed.');