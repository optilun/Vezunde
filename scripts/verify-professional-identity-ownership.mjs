import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reconciledAssignmentPublicStatus } from '../shared/professionalProfileStatus.js';

const adminReview = await readFile(new URL('../base44/functions/directoryOps/adminWorkspaceReview.ts', import.meta.url), 'utf8');
const professionalReview = await readFile(new URL('../base44/functions/directoryOps/adminProfessionalProfileReview.ts', import.meta.url), 'utf8');
const professionalProfileStatusPolicy = await readFile(new URL('../shared/professionalProfileStatus.js', import.meta.url), 'utf8');
const providerTeam = await readFile(new URL('../src/components/workspace/provider/ProviderTeam.jsx', import.meta.url), 'utf8');
const professionalWorkspace = await readFile(new URL('../src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx', import.meta.url), 'utf8');
const assignmentOps = await readFile(new URL('../base44/functions/manageProfessionalAssignment/entry.ts', import.meta.url), 'utf8');
const assignmentSchema = await readFile(new URL('../base44/entities/ProfessionalLocationAssignment.jsonc', import.meta.url), 'utf8');

const legacyGuard = adminReview.indexOf("if (submission.section === 'team') {");
const validation = adminReview.indexOf('const validation = validatePayload(submission.section, parsedPayload);');
const legacyApply = adminReview.indexOf('await applyTeam(svc, user, submission, validation.clean);');

assert.ok(legacyGuard > -1, 'legacy team approval guard is missing');
assert.ok(validation > legacyGuard, 'legacy team approval must be blocked before payload validation');
assert.ok(legacyApply > legacyGuard, 'legacy team approval must be blocked before ProfessionalProfile writes');
assert.match(adminReview, /Sectiunea legacy pentru echipa nu mai poate modifica identitatea profesionala/);
assert.match(adminReview, /Foloseste invitatiile profesionale si administrarea assignmenturilor dedicate/);

assert.match(providerTeam, /Specialistul decide dacă profilul său devine public/);
assert.match(providerTeam, /functions\.invoke\("professionalInvitationOps"/);
assert.match(providerTeam, /functions\.invoke\("manageProfessionalAssignment"/);
assert.match(providerTeam, /Solicită afișarea/);
assert.match(providerTeam, /Specialistul trebuie să accepte afișarea din contul său/);
assert.doesNotMatch(providerTeam, /Specialistul este acum vizibil pe profilul public/);

assert.doesNotMatch(assignmentOps, /ProfessionalProfile\.create/);
assert.doesNotMatch(assignmentOps, /ProfessionalProfile\.update/);
assert.match(assignmentOps, /ProfessionalLocationAssignment\.update/);
assert.match(assignmentOps, /PROFESSIONAL_VISIBILITY_ACTIONS/);
assert.match(assignmentOps, /request_visibility/);
assert.match(assignmentOps, /accept_visibility/);
assert.match(assignmentOps, /decline_visibility/);
assert.match(assignmentOps, /hide_visibility/);
assert.match(assignmentOps, /requires_professional_consent: true/);
assert.match(assignmentOps, /Publicarea necesita acordul specialistului/);

assert.match(assignmentSchema, /visibility_consent_status/);
assert.match(assignmentSchema, /"pending"/);
assert.match(assignmentSchema, /"accepted"/);
assert.match(assignmentSchema, /"declined"/);
assert.match(assignmentSchema, /"revoked"/);

assert.match(professionalReview, /reconcileAssignmentsAfterApproval/);
// 2026-09-03: conditia de consimtamant s-a mutat in shared/professionalProfileStatus.js, ca sa fie
// una singura pentru review-ul de admin, pentru citirea publica si pentru motorul de recomandare.
// Verificam ca review-ul o foloseste SI ca politica comuna chiar cere acordul explicit - altfel
// mutarea ar fi putut sa piarda tacit invariantul pe care il apara acest fisier.
assert.match(professionalReview, /nextAssignmentStatus\(/);
assert.match(professionalReview, /assignmentPublicEligibility/);
assert.match(professionalProfileStatusPolicy, /visibility_consent_status !== 'accepted'\) reasons\.push\('consent_missing'\)/);
assert.equal(
  reconciledAssignmentPublicStatus({
    profile: { is_public: true, verification_status: 'verified', public_visibility_status: 'approved' },
    assignment: { active_status: 'activ', visibility_consent_status: 'not_requested' },
    location: { status: 'publicata', active_status: 'activa', profile_control_status: 'verified' },
  }),
  'privat',
  'aprobarea profilului nu are voie sa publice o asociere fara acordul specialistului',
);
assert.match(professionalReview, /Aprobarea profilului nu publica automat asocierea/);
assert.doesNotMatch(professionalReview, /const nextStatus = eligibleLocation\(location\) \? 'public' : 'privat'/);

assert.match(professionalWorkspace, /Acceptă afișarea/);
assert.match(professionalWorkspace, /Refuză/);
assert.match(professionalWorkspace, /Ascunde profilul/);
assert.match(professionalWorkspace, /Tu controlezi unde apare profilul tău/);

console.log('Professional identity and visibility consent checks passed.');
