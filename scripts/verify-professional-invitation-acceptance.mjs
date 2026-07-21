import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../base44/function_modules/professionalInvitationOps.ts', import.meta.url), 'utf8');

assert.match(source, /async function loadAcceptableInvitationLocation\(svc, invitation\)/);
assert.match(source, /location\.organization_id !== invitation\.organization_id/);
assert.match(source, /location\.claim_verification_status !== 'approved'/);
assert.match(source, /location\.active_status === 'inactiva'/);
assert.match(source, /svc\.entities\.ProviderOrganization\.get\(invitation\.organization_id\)/);
assert.match(source, /organization\.status === 'inactiva'/);
assert.match(source, /const locationContext = await loadAcceptableInvitationLocation\(svc, currentInvitation\)/);
assert.match(source, /if \(locationContext\.error\) return response\(\{ error: locationContext\.error \}, locationContext\.status\)/);

const lockCheck = source.indexOf('const lifecycleLock = await acquireProfessionalLifecycleLock');
const invitationReload = source.indexOf('const currentInvitation = await svc.entities.ProfessionalInvitation.get', lockCheck);
const scopeCheck = source.indexOf('const locationContext = await loadAcceptableInvitationLocation', invitationReload);
const profileLookup = source.indexOf('svc.entities.ProfessionalProfile.filter({ user_id: user.id }', scopeCheck);
const assignmentWrite = source.indexOf('svc.entities.ProfessionalLocationAssignment.create(assignmentData)', scopeCheck);
assert.ok(lockCheck > -1, 'professional lifecycle lock is missing');
assert.ok(invitationReload > lockCheck, 'invitation must be reloaded after acquiring the lifecycle lock');
assert.ok(scopeCheck > invitationReload, 'location and organization must be revalidated after reloading the invitation');
assert.ok(profileLookup > scopeCheck, 'profile lookup must happen after location and organization revalidation');
assert.ok(assignmentWrite > scopeCheck, 'assignment creation must happen after location and organization revalidation');

assert.match(source, /user\.is_verified === false/);
assert.match(source, /user\.email_verified === false/);
assert.match(source, /user\.email_verified === 'false'/);
assert.match(source, /invitation\.status === 'accepted'/);
assert.match(source, /invitation\.accepted_by_user_id !== user\.id/);
assert.match(source, /normalizeEmail\(user\.email\) !== invitation\.invited_email_normalized/);
assert.match(source, /currentInvitation\.status === 'accepted'/);
assert.match(source, /currentInvitation\.accepted_by_user_id !== user\.id/);
assert.match(source, /normalizeEmail\(user\.email\) !== currentInvitation\.invited_email_normalized/);
assert.doesNotMatch(source, /ProviderMembership\.create/);

console.log('Professional invitation acceptance checks passed.');
