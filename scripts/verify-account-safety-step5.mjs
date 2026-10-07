// Conturi - pasul 5 (2026-10-01): profil ascuns de specialist + cererea de stergere in admin.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assignmentPublicEligibility,
  isHiddenByProfessional,
  isPublicProfessionalProfile,
  nextProfessionalProfileState,
} from '../shared/professionalProfileStatus.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------- 1. Poarta publica tine cont de ascunderea facuta de specialist ----------
const approved = { is_public: true, verification_status: 'verified', public_visibility_status: 'approved' };
assert.equal(isPublicProfessionalProfile(approved), true);
assert.equal(isPublicProfessionalProfile({ ...approved, hidden_by_professional: true }), false, 'un profil ascuns nu e public');
assert.equal(isHiddenByProfessional({ hidden_by_professional: true }), true);
assert.equal(isHiddenByProfessional({}), false);

// Ascunderea nu atinge statusurile: dupa reafisare profilul e public fara o noua aprobare.
const hidden = { ...approved, hidden_by_professional: true };
assert.equal(isPublicProfessionalProfile({ ...hidden, hidden_by_professional: false }), true);
// O aprobare de admin peste un profil ascuns nu il reafiseaza.
assert.equal(isPublicProfessionalProfile({ ...hidden, ...nextProfessionalProfileState('approve', hidden) }), false);

// Asocierea la locatie urmeaza aceeasi poarta.
const assignment = { active_status: 'activ', visibility_consent_status: 'accepted' };
const location = { status: 'publicata', active_status: 'activa', profile_control_status: 'claimed' };
assert.equal(assignmentPublicEligibility({ profile: approved, assignment, location }).eligible, true);
assert.deepEqual(assignmentPublicEligibility({ profile: hidden, assignment, location }).reasons, ['profile_not_public']);

const backendCopy = await read('base44/shared/professionalProfileStatus.js');
const frontendCopy = await read('shared/professionalProfileStatus.js');
assert.equal(backendCopy, frontendCopy, 'cele doua copii ale politicii trebuie sa fie identice');

const schema = await read('base44/entities/ProfessionalProfile.jsonc');
assert.match(schema, /"hidden_by_professional": \{\s*"type": "boolean"/);

const manage = await read('base44/functions/manageMyProfessionalProfile/entry.ts');
const hideBlock = manage.slice(manage.indexOf("if (action === 'hide_profile' || action === 'show_profile') {"), manage.indexOf("if (action === 'save_draft') {"));
assert.ok(hideBlock.length > 100, 'actiunile hide_profile / show_profile lipsesc');
assert.match(hideBlock, /hidden_by_professional: true/);
assert.match(hideBlock, /reconciledAssignmentPublicStatus\(/, 'asocierile se reconciliaza cu aceeasi regula');
assert.doesNotMatch(hideBlock, /verification_status|public_visibility_status|is_public:/, 'ascunderea nu schimba statusurile de verificare');
assert.match(hideBlock, /'hide_professional_profile'/);

const workspaceFn = await read('base44/functions/getMyProfessionalWorkspace/entry.ts');
assert.match(workspaceFn, /hidden_by_professional: profile\.hidden_by_professional === true/);

const workspaceUi = await read('src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx');
assert.match(workspaceUi, /function ProfileVisibilityCard\(/);
assert.match(workspaceUi, /action: hidden \? "show_profile" : "hide_profile"/);
assert.match(workspaceUi, /Da, ascunde profilul/, 'ascunderea cere confirmare');

// ---------- 2. Cererea de stergere a contului ----------
const eligibility = await read('base44/functions/getMyProviderWorkspace/getMyAccountDeletionEligibility.ts');
assert.match(eligibility, /ACCOUNT_DELETION_REQUEST_SOURCE = 'account_deletion_request'/);
assert.match(eligibility, /ACCOUNT_DELETION_RESPONSE_DAYS = 30/);
assert.match(eligibility, /if \(action === 'request'\) \{/);
assert.match(eligibility, /if \(!openRequest\) \{/, 'o singura cerere deschisa per cont');
assert.match(eligibility, /SupportTicket\.create\(/);
assert.doesNotMatch(eligibility, /\.delete\(/, 'cererea nu sterge nimic automat');
assert.match(eligibility, /deletion_request: deletionRequestView\(openRequest\)/);

const settings = await read('src/components/workspace/account/AccountSettings.jsx');
assert.doesNotMatch(settings, /mailto:contact@viasee\.ro\?subject=\$\{deletionSubject\}/, 'cererea nu mai pleaca pe email');
assert.match(settings, /action: "request"/);
assert.match(settings, /Da, trimite cererea/, 'trimiterea cere confirmare');
assert.match(settings, /Cererea de ștergere a fost înregistrată/);

// Din 2026-10-07 regulile tichetelor (sursa și termenul cererii de ștergere) sunt în src/lib/adminSupportRules.js.
const admin = await read('src/components/admin/support/AdminSupportTickets.jsx');
const adminRules = await read('src/lib/adminSupportRules.js');
assert.match(adminRules, /ACCOUNT_DELETION_SOURCE = "account_deletion_request"/);
assert.match(adminRules, /ACCOUNT_DELETION_RESPONSE_DAYS = 30/);
assert.match(admin, /function DeletionDeadlineBadge\(/);

console.log('verify-account-safety-step5: ok');
