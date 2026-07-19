import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adminReview = await readFile(new URL('../base44/functions/adminWorkspaceReview/entry.ts', import.meta.url), 'utf8');
const providerTeam = await readFile(new URL('../src/components/workspace/provider/ProviderTeam.jsx', import.meta.url), 'utf8');
const assignmentOps = await readFile(new URL('../base44/functions/manageProfessionalAssignment/entry.ts', import.meta.url), 'utf8');

const legacyGuard = adminReview.indexOf("if (submission.section === 'team') {");
const validation = adminReview.indexOf('const validation = validatePayload(submission.section, parsedPayload);');
const legacyApply = adminReview.indexOf('await applyTeam(svc, user, submission, validation.clean);');

assert.ok(legacyGuard > -1, 'legacy team approval guard is missing');
assert.ok(validation > legacyGuard, 'legacy team approval must be blocked before payload validation');
assert.ok(legacyApply > legacyGuard, 'legacy team approval must be blocked before ProfessionalProfile writes');
assert.match(adminReview, /Sectiunea legacy pentru echipa nu mai poate modifica identitatea profesionala/);
assert.match(adminReview, /Foloseste invitatiile profesionale si administrarea assignmenturilor dedicate/);

assert.match(providerTeam, /nu poți modifica identitatea profesională a specialistului/);
assert.match(providerTeam, /functions\.invoke\("professionalInvitationOps"/);
assert.match(providerTeam, /functions\.invoke\("manageProfessionalAssignment"/);

assert.doesNotMatch(assignmentOps, /ProfessionalProfile\.create/);
assert.doesNotMatch(assignmentOps, /ProfessionalProfile\.update/);
assert.match(assignmentOps, /ProfessionalLocationAssignment\.update/);

console.log('Professional identity ownership checks passed.');
