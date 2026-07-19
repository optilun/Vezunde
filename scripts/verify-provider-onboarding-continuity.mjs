import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];

function expect(file, pattern, message) {
  const content = read(file);
  const pass = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  checks.push({ pass, message, file });
}

function reject(file, pattern, message) {
  const content = read(file);
  const pass = typeof pattern === 'string' ? !content.includes(pattern) : !pattern.test(content);
  checks.push({ pass, message, file });
}

expect('src/pages/Login.jsx', 'getAuthRoute("/register")', 'Login pastreaza destinatia spre Register');
expect('src/pages/Register.jsx', 'getAuthRoute("/login")', 'Register pastreaza destinatia spre Login');
expect('src/lib/postLoginRedirect.js', 'viasee.auth.return_to', 'Destinatia este memorata pe durata autentificarii');
reject('src/components/provider/ProviderSearch.jsx', 'redirectToLogin', 'Cautarea nu cere autentificare prematur');
expect('src/components/provider/ClaimForm.jsx', 'continueAfterRelation', 'Revendicarea cere autentificare dupa relatie');
expect('src/components/provider/ClaimForm.jsx', 'persistClaimResumeState(location, contact, step || "relation")', 'Locatia si pasul curent sunt salvate imediat pentru reluare');
expect('src/components/provider/ClaimForm.jsx', 'getSessionStorage', 'Revendicarea ramane functionala cand sessionStorage este indisponibil');
expect('src/pages/AddOrClaim.jsx', 'getResumeClaimStep', 'Reluarea valideaza relatia si datele de contact inainte de pasul final');
expect('src/pages/AddOrClaim.jsx', 'returnFromClaim', 'Intoarcerea la cautare curata revendicarea abandonata');
expect('src/pages/AddOrClaim.jsx', 'onClaimExisting={(loc) => {\n            clearResumeState();', 'Trecerea din locatie noua la profil existent elimina draftul vechi');
expect('src/components/provider/NewLocationWizard.jsx', 'currentKey === "relation"', 'Locatia noua cere autentificare dupa relatie');
reject('src/components/provider/NewLocationWizard.jsx', 'pendingSubmit', 'Locatia noua nu se trimite automat dupa login');
expect('src/pages/AddOrClaim.jsx', '/contul-meu?mode=applicant&onboarding=submitted', 'Trimiterea intra direct in Pregatire profil');
expect('src/pages/AddOrClaim.jsx', 'result.duplicate_review', 'Clarificarea unui duplicat nu intra intr-un workspace fara locatie');
expect('src/pages/MyAccount.jsx', 'getMyProviderOnboardingWorkspace', 'Contul incarca onboardingul separat de membershipuri');
expect('base44/functions/getMyProviderOnboardingWorkspace/entry.ts', "claim.mode !== 'new_location_duplicate_review'", 'Pregatirea exclude cererile care nu au o locatie creata');
expect('base44/functions/submitProviderClaim/entry.ts', 'requested_membership_role: requestedMembershipRole', 'Cererea salveaza rolul solicitat');
expect('base44/functions/adminProviderClaimReview/entry.ts', "approved_membership_role: approvedRole", 'Adminul salveaza rolul aprobat');
expect('base44/functions/adminProviderClaimReview/entry.ts', "status: 'draft', public_visibility_status: 'draft'", 'Locatia noua ramane draft dupa aprobare');
expect('src/components/specialists/SpecialistsHero.jsx', 'navigate("/profil-profesional/nou")', 'Profilul profesional nu intra in wizardul organizatiilor');
expect('src/components/specialists/SpecialistsHero.jsx', 'claim_action === "request_access"', 'Cautarea diferentiaza revendicarea de acces');
expect('src/pages/Partners.jsx', 'mailto:contact@viasee.ro', 'Partenerii B2B nu intra in onboardingul organizatiilor');
reject('src/pages/Partners.jsx', 'to="/adauga-sau-revendica"', 'CTA-ul B2B nu deschide wizardul locatiei');

expect('src/components/provider/ContactIdentityFields.jsx', 'requestedLocationRoleForRelationship', 'Revendicarea locatiei foloseste o mapare separata de roluri');
expect('src/components/provider/ClaimRelationStep.jsx', 'requestedLocationRoleForRelationship', 'Pasul real de revendicare afiseaza rolul limitat la locatie');
expect('src/components/provider/ClaimRelationStep.jsx', 'Administrarea intregii organizatii se verifica separat', 'Pasul real explica separarea dintre locatie si organizatie');
expect('src/components/provider/ClaimReviewStep.jsx', 'requestedLocationRoleForRelationship', 'Revizuirea afiseaza acelasi rol limitat la locatie');
reject('src/components/provider/ClaimReviewStep.jsx', 'requestedRoleForRelationship', 'Revizuirea nu mai afiseaza rol de owner pentru un claim de locatie');
expect('src/components/provider/steps/WizClaimRelation.jsx', 'requestedLocationRoleForRelationship', 'Wizardul de locatie noua pastreaza maparea explicita');
expect('base44/functions/submitProviderClaim/entry.ts', "claim_scope: 'location'", 'Backendul marcheaza revendicarea profilului existent ca fiind limitata la locatie');
expect('base44/functions/submitProviderClaim/entry.ts', 'LOCATION_ROLE_BY_RELATIONSHIP', 'Backendul nu transforma relatia cu afacerea in owner de organizatie pentru un claim de locatie');
expect('base44/functions/adminProviderClaimReview/entry.ts', "const isLocationScopedClaim = claim.mode === 'claim' || submitted.claim_scope === 'location'", 'Review-ul recunoaste inclusiv cererile vechi ca revendicari de locatie');
expect('base44/functions/adminProviderClaimReview/entry.ts', '!isLocationScopedClaim && approvedRole === \'organization_owner\'', 'Accesul pe toate locatiile este rezervat cererilor de organizatie');
expect('base44/functions/adminProviderClaimReview/entry.ts', 'Revendicarea unei locatii nu poate acorda rol de owner al organizatiei', 'Backendul blocheaza escaladarea unui claim de locatie la owner organizatie');
expect('src/components/admin/directory/DirOpsClaims.jsx', 'LOCATION_ROLE_OPTIONS', 'Adminul poate selecta doar roluri de locatie pentru un claim de locatie');

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.message} (${check.file})`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} verificari de onboarding au esuat.`);
  process.exit(1);
}

console.log(`\n${checks.length} verificari de onboarding au trecut.`);
