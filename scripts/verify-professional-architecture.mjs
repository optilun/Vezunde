// Arhitectura specialistilor: identitate, statusuri, eligibilitate publica, navigare.
//
// 2026-09-03. Inainte de sesiunea asta, acelasi adevar despre specialisti era scris in cinci
// locuri: doua backend-uri de scriere, unul de citire publica, review-ul de admin si catalogul
// din interfata. Fiecare avea propria harta de specializari, propria traducere tip -> rol si
// propria conditie de "e public?". Verificarile de mai jos nu testeaza doar ca functiile merg,
// ci ca duplicatele NU se intorc - pentru ca asta era problema reala, nu un bug punctual.
//
// A doua zona acoperita: tranzitiile de stare. Codul vechi punea `verification_status` pe
// `pending_review` la fiecare trimitere de draft, ceea ce scotea offline un specialist deja
// verificat care isi corecta o virgula. Cazul are test propriu mai jos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFESSIONAL_IDENTITY_CONTRACT_VERSION,
  PROFESSIONAL_TYPES,
  PROFESSIONAL_TYPE_CODES,
  isMedicalProfessionalType,
  normalizeProfessionalType,
  professionalDisplayName,
  professionalInitials,
  professionalLegacyRole,
  professionalSpecializationLabel,
  professionalSpecializationsFor,
  professionalTypeLabel,
  sanitizeProfessionalSpecializations,
} from '../shared/professionalIdentity.js';
import {
  PROFESSIONAL_PROFILE_STATUS_CONTRACT_VERSION,
  assignmentPublicEligibility,
  isProfessionalProfileLocked,
  isPublicProfessionalProfile,
  nextProfessionalProfileState,
  professionalProfileCompleteness,
  professionalSubmissionBlockers,
  reconciledAssignmentPublicStatus,
} from '../shared/professionalProfileStatus.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Toate locurile in care taxonomia era rescrisa inainte de 2026-09-03. Lista este deliberat lunga:
// exact numarul de copii era problema, nu continutul vreuneia dintre ele.
const DEDUPED_FILES = [
  'base44/functions/getPublicProfessionalProfile/entry.ts',
  'base44/functions/manageMyProfessionalProfile/entry.ts',
  'base44/functions/professionalInvitationOps/entry.ts',
  'base44/functions/directoryOps/adminProfessionalProfileReview.ts',
  'src/lib/professionalProfileCatalog.js',
  'src/lib/vezunde.js',
  'src/pages/ProviderProfile.jsx',
  'src/pages/ProfessionalOnboarding.jsx',
  'src/components/workspace/provider/ProviderTeam.jsx',
  'src/components/admin/directory/AdminProfessionalProfileReview.jsx',
  'src/components/admin/directory/AdminWorkspaceSubmissionsReview.jsx',
  'src/components/provider/steps/WizProfessionalBasics.jsx',
  'src/pages/AcceptProfessionalInvitation.jsx',
];

// --- Identitate ---------------------------------------------------------------------------

check('contractele au versiune declarata', () => {
  assert.equal(PROFESSIONAL_IDENTITY_CONTRACT_VERSION, 'professional-identity-v1');
  assert.equal(PROFESSIONAL_PROFILE_STATUS_CONTRACT_VERSION, 'professional-profile-status-v1');
});

check('cele trei profesii suportate sunt declarate o singura data', () => {
  assert.deepEqual(PROFESSIONAL_TYPE_CODES, ['ophthalmologist', 'optometrist', 'optician']);
  for (const entry of PROFESSIONAL_TYPES) {
    assert.ok(entry.label, `lipseste eticheta pentru ${entry.code}`);
    assert.ok(entry.label_plural, `lipseste pluralul pentru ${entry.code}`);
    assert.ok(entry.specializations.length > 0, `lipsesc specializarile pentru ${entry.code}`);
    assert.ok(entry.legacy_role, `lipseste rolul legacy pentru ${entry.code}`);
  }
});

check('lista de profesii nu mai este scrisa de mana in interfata', () => {
  for (const file of DEDUPED_FILES) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /ophthalmologist:\s*["']Medic oftalmolog["']/,
      `${file} isi rescrie lista de profesii`,
    );
  }
});

check('workspace-ul specialistului foloseste aceleasi praguri ca serverul', () => {
  const workspace = read('src/components/workspace/professional/ProfessionalWorkspaceRoot.jsx');
  assert.match(workspace, /professionalSubmissionBlockers\(/, 'checklist-ul isi scrie propriile praguri');
  assert.match(workspace, /professionalProfileCompleteness\(/, 'completitudinea e calculata local');
  assert.match(workspace, /public_visibility_status === "archived"/, 'un profil arhivat s-ar afisa ca public');
});

check('adminul poate arhiva si reactiva un profil', () => {
  const backend = read('base44/functions/directoryOps/adminProfessionalProfileReview.ts');
  assert.match(backend, /action === 'archive' \|\| action === 'restore'/, 'ciclul de viata nu e rutat');
  assert.match(backend, /nextProfessionalProfileState\(action, profile\)/);
  assert.match(backend, /if \(!note\) return res\(\{ error: 'Nota este obligatorie' \}, 400\);/, 'arhivarea nu cere motiv scris');
  const ui = read('src/components/admin/directory/AdminProfessionalProfileReview.jsx');
  assert.match(ui, /decide\(profile, "archive"\)/);
  assert.match(ui, /decide\(profile, "restore"\)/);
});

check('traducerea tip -> rol legacy acopera toate tipurile', () => {
  assert.equal(professionalLegacyRole('ophthalmologist'), 'medic_oftalmolog');
  assert.equal(professionalLegacyRole('optometrist'), 'optometrist');
  assert.equal(professionalLegacyRole('optician'), 'optician');
  // Si invers: rolul legacy din date vechi trebuie sa se normalizeze la codul canonic.
  assert.equal(normalizeProfessionalType('medic_oftalmolog'), 'ophthalmologist');
  assert.equal(normalizeProfessionalType('necunoscut'), '');
});

check('doar oftalmologul este profesie medicala', () => {
  assert.equal(isMedicalProfessionalType('ophthalmologist'), true);
  assert.equal(isMedicalProfessionalType('optometrist'), false);
  assert.equal(isMedicalProfessionalType('optician'), false);
});

check('fiecare specializare are eticheta in romana', () => {
  for (const code of PROFESSIONAL_TYPE_CODES) {
    for (const specialization of professionalSpecializationsFor(code)) {
      const label = professionalSpecializationLabel(specialization);
      assert.notEqual(label, specialization, `specializarea ${specialization} nu are eticheta`);
    }
  }
});

check('specializarile straine de profesie sunt eliminate, nu afisate', () => {
  const cleaned = sanitizeProfessionalSpecializations('optician', [
    'frame_consulting',
    'glaucoma',            // apartine oftalmologului
    'frame_consulting',    // duplicat
    '<script>',            // gunoi
  ]);
  assert.deepEqual(cleaned, ['frame_consulting']);
});

check('numele si initialele nu inventeaza nimic', () => {
  assert.equal(professionalDisplayName({ full_name: 'Ana Pop' }), 'Ana Pop');
  assert.equal(professionalDisplayName({ public_display_name: 'Dr. Ana Pop', full_name: 'Ana Pop' }), 'Dr. Ana Pop');
  assert.equal(professionalDisplayName({}), '');
  assert.equal(professionalInitials({ full_name: 'Ana Maria Pop' }), 'AP');
  assert.equal(professionalInitials({}), '?');
});

check('eticheta necunoscuta cade pe "Specialist", nu pe cheia bruta', () => {
  assert.equal(professionalTypeLabel('ortoptist'), 'Specialist');
});

// --- Statusuri si tranzitii ---------------------------------------------------------------

const verifiedProfile = Object.freeze({
  is_public: true,
  verification_status: 'verified',
  public_visibility_status: 'approved',
  profile_review_status: 'approved',
});

check('poarta publica cere simultan verificare, aprobare si is_public', () => {
  assert.equal(isPublicProfessionalProfile(verifiedProfile), true);
  assert.equal(isPublicProfessionalProfile({ ...verifiedProfile, is_public: false }), false);
  assert.equal(isPublicProfessionalProfile({ ...verifiedProfile, verification_status: 'pending_review' }), false);
  assert.equal(isPublicProfessionalProfile({ ...verifiedProfile, public_visibility_status: 'draft' }), false);
  assert.equal(isPublicProfessionalProfile(null), false);
});

check('un profil deja public nu dispare cand trimite un draft nou', () => {
  const next = nextProfessionalProfileState('submit', verifiedProfile);
  assert.equal(next.profile_review_status, 'pending_review');
  assert.equal(next.is_public, true);
  assert.equal(isPublicProfessionalProfile({ ...verifiedProfile, ...next }), true);
});

check('un profil nepublicat ramane nepublicat cat e in verificare', () => {
  const next = nextProfessionalProfileState('submit', { profile_review_status: 'draft' });
  assert.equal(next.is_public, false);
  assert.equal(next.verification_status, 'pending_review');
  assert.equal(isPublicProfessionalProfile(next), false);
});

check('aprobarea publica profilul, respingerea nu scoate offline unul deja public', () => {
  const approved = nextProfessionalProfileState('approve', { profile_review_status: 'pending_review' });
  assert.equal(approved.is_public, true);
  assert.equal(approved.verification_status, 'verified');

  const rejectedFresh = nextProfessionalProfileState('reject', { profile_review_status: 'pending_review' });
  assert.equal(rejectedFresh.is_public, false);
  assert.equal(rejectedFresh.public_visibility_status, 'rejected');

  const rejectedLive = nextProfessionalProfileState('reject', verifiedProfile);
  assert.equal(rejectedLive.is_public, true, 'respingerea unui draft nu inchide pagina publica existenta');
  assert.equal(rejectedLive.profile_review_status, 'rejected');
});

check('arhivarea este singura actiune care scoate offline deliberat', () => {
  const archived = nextProfessionalProfileState('archive', verifiedProfile);
  assert.equal(archived.is_public, false);
  assert.equal(archived.public_visibility_status, 'archived');
  assert.equal(isPublicProfessionalProfile({ ...verifiedProfile, ...archived }), false);
});

check('actiunile necunoscute nu produc tranzitii tacite', () => {
  assert.equal(nextProfessionalProfileState('publica_te_singur', verifiedProfile), null);
  assert.equal(nextProfessionalProfileState('', verifiedProfile), null);
});

check('editarea este blocata doar cat draftul e in verificare', () => {
  assert.equal(isProfessionalProfileLocked({ profile_review_status: 'pending_review' }), true);
  assert.equal(isProfessionalProfileLocked({ profile_review_status: 'needs_more_info' }), false);
});

// --- Eligibilitatea asocierii --------------------------------------------------------------

const publishedLocation = Object.freeze({ status: 'publicata', active_status: 'activa', profile_control_status: 'verified' });
const consentedAssignment = Object.freeze({ active_status: 'activ', visibility_consent_status: 'accepted' });

check('asocierea publica cere toate cele patru conditii', () => {
  assert.equal(assignmentPublicEligibility({
    profile: verifiedProfile, assignment: consentedAssignment, location: publishedLocation,
  }).eligible, true);

  const missingConsent = assignmentPublicEligibility({
    profile: verifiedProfile,
    assignment: { ...consentedAssignment, visibility_consent_status: 'pending' },
    location: publishedLocation,
  });
  assert.equal(missingConsent.eligible, false);
  assert.ok(missingConsent.reasons.includes('consent_missing'));
});

check('o locatie suspendata scoate asocierea din public', () => {
  const suspended = assignmentPublicEligibility({
    profile: verifiedProfile,
    assignment: consentedAssignment,
    location: { ...publishedLocation, profile_control_status: 'suspended' },
  });
  assert.equal(suspended.eligible, false);
  assert.ok(suspended.reasons.includes('location_suspended'));
  assert.equal(reconciledAssignmentPublicStatus({
    profile: verifiedProfile,
    assignment: consentedAssignment,
    location: { ...publishedLocation, profile_control_status: 'suspended' },
  }), 'privat');
});

check('aprobarea profilului nu publica singura asocierile fara acord', () => {
  assert.equal(reconciledAssignmentPublicStatus({
    profile: verifiedProfile,
    assignment: { active_status: 'activ', visibility_consent_status: 'not_requested' },
    location: publishedLocation,
  }), 'privat');
});

// --- Completitudine si blocaje --------------------------------------------------------------

check('completitudinea insumeaza exact 100 pentru un profil complet', () => {
  const full = {
    public_display_name: 'Dr. Ana Pop',
    professional_bio: 'x'.repeat(120),
    specializations: ['glaucoma'],
    profile_photo_url: 'data:image/png;base64,aaaa',
    public_email: 'ana@example.com',
    linkedin_url: 'https://example.com/ana',
  };
  assert.equal(professionalProfileCompleteness(full, 'ophthalmologist', true), 100);
  assert.equal(professionalProfileCompleteness({}, '', false), 0);
});

check('blocajele de trimitere sunt aceleasi pentru interfata si server', () => {
  assert.deepEqual(professionalSubmissionBlockers({}), ['display_name', 'bio', 'specializations']);
  assert.deepEqual(professionalSubmissionBlockers({
    public_display_name: 'Ana Pop',
    professional_bio: 'x'.repeat(80),
    specializations: ['glaucoma'],
  }), []);
});

// --- Anti-regresie: duplicatele nu se intorc ------------------------------------------------


check('harta de specializari nu mai este copiata in niciun fisier', () => {
  for (const file of DEDUPED_FILES) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /SPECIALIZATIONS_BY_TYPE\s*[:=]/,
      `${file} isi redeclara harta de specializari`,
    );
    assert.doesNotMatch(
      content,
      /'general_ophthalmology'|"general_ophthalmology"/,
      `${file} isi rescrie lista de specializari`,
    );
  }
});

check('traducerea tip -> rol nu mai este copiata in backend', () => {
  for (const file of ['base44/functions/manageMyProfessionalProfile/entry.ts', 'base44/functions/professionalInvitationOps/entry.ts']) {
    assert.doesNotMatch(read(file), /ROLE_BY_TYPE\s*[:=]/, `${file} isi redeclara ROLE_BY_TYPE`);
    assert.match(read(file), /professionalLegacyRole\(/, `${file} nu foloseste traducerea comuna`);
  }
});

check('conditia de profil public nu mai este rescrisa in fiecare functie', () => {
  for (const file of [
    'base44/functions/getPublicProfessionalProfile/entry.ts',
    'base44/functions/manageProfessionalAssignment/entry.ts',
    'base44/functions/getPublicProviderProfile/entry.ts',
    'base44/functions/directoryOps/adminProfessionalProfileReview.ts',
  ]) {
    const content = read(file);
    // Fie poarta de profil, fie eligibilitatea asocierii (care o contine) - ambele vin din
    // shared/professionalProfileStatus.js. Ce nu are voie sa existe este conditia rescrisa local.
    assert.match(
      content,
      /isPublicProfessionalProfile|assignmentPublicEligibility/,
      `${file} nu foloseste poarta comuna`,
    );
    assert.doesNotMatch(
      content,
      /verification_status !== 'verified'/,
      `${file} rescrie local conditia de profil verificat`,
    );
  }
});

check('cele doua arbori shared raman identici pentru fisierele noi', () => {
  for (const name of ['professionalIdentity.js', 'professionalProfileStatus.js', 'professionalRecommendation.js']) {
    assert.equal(
      read(`shared/${name}`),
      read(`base44/shared/${name}`),
      `shared/${name} si base44/shared/${name} au divergat`,
    );
  }
});

// --- Navigare fara capete de drum ------------------------------------------------------------

check('profilul de specialist duce spre locatii si spre organizatii', () => {
  const page = read('src/pages/ProfessionalProfile.jsx');
  assert.match(page, /to=\{`\/furnizor\/\$\{location\.id\}`\}/, 'lipseste legatura specialist -> locatie');
  assert.match(page, /to=\{`\/organizatie\/\$\{organization\.id\}`\}/, 'lipseste legatura specialist -> organizatie');
});

check('profilul de organizatie duce spre specialisti', () => {
  const page = read('src/pages/OrganizationProfile.jsx');
  assert.match(page, /to=\{`\/specialist\/\$\{professional\.id\}`\}/, 'lipseste legatura organizatie -> specialist');
  const backend = read('base44/functions/getPublicProviderProfile/entry.ts');
  assert.match(backend, /publicProfessionalsForLocations/, 'backendul nu trimite specialistii organizatiei');
  assert.match(backend, /visibility_consent_status !== 'accepted'/, 'lista de specialisti nu verifica acordul explicit');
});

check('profilul de locatie duce spre specialisti', () => {
  assert.match(read('src/pages/ProviderProfile.jsx'), /\/specialist\//, 'lipseste legatura locatie -> specialist');
});

check('paleta VIASEE, nu verdele de sistem, pe profilul de specialist', () => {
  const page = read('src/pages/ProfessionalProfile.jsx');
  assert.doesNotMatch(page, /bg-green-\d{2,3}/, 'profilul de specialist foloseste culori din afara paletei');
});

// --- Raport ---------------------------------------------------------------------------------

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.ok ? '' : `\n      ${entry.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} verificari trecute.`);
if (failed.length > 0) process.exit(1);
