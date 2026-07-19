import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../base44/functions/createProviderMemberInvitation/entry.ts', import.meta.url), 'utf8');
const schema = await readFile(new URL('../base44/entities/ProviderMemberInvitation.jsonc', import.meta.url), 'utf8');
const membersSource = await readFile(new URL('../base44/functions/getMyProviderMembers/entry.ts', import.meta.url), 'utf8');

assert.match(source, /RESEND_API_KEY/);
assert.match(source, /RESEND_FROM_EMAIL|VIASEE_EMAIL_FROM/);
assert.match(source, /https:\/\/api\.resend\.com\/emails/);
assert.match(source, /base44\.integrations\.Core\.SendEmail/);
assert.match(source, /Idempotency-Key/);
assert.match(source, /delivery_status:\s*delivery\.sent\s*\?\s*'sent'\s*:\s*'manual_required'/);
assert.match(source, /secure_token_hash:\s*await hash\(rawToken\)/);
assert.doesNotMatch(source, /secure_token\s*:\s*rawToken/);
assert.match(source, /create_provider_member_invitation/);
assert.match(source, /invitation_link:\s*invitationLink/);
assert.match(source, /email_sent:\s*delivery\.sent/);

assert.match(schema, /"delivery_status"/);
assert.match(schema, /"delivery_provider"/);
assert.match(schema, /"last_delivery_attempt_at"/);
assert.match(membersSource, /delivery_status:\s*invitation\.delivery_status/);
assert.match(membersSource, /delivery_provider:\s*invitation\.delivery_provider/);

console.log('Provider invitation delivery checks passed.');
