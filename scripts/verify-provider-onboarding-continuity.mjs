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
expect('src/components/provider/NewLocationWizard.jsx', 'currentKey === "relation"', 'Locatia noua cere autentificare dupa relatie');
reject('src/components/provider/NewLocationWizard.jsx', 'pendingSubmit', 'Locatia noua nu se trimite automat dupa login');
expect('src/pages/AddOrClaim.jsx', '/contul-meu?mode=applicant&onboarding=submitted', 'Trimiterea intra direct in Pregatire profil');
expect('src/pages/MyAccount.jsx', 'getMyProviderOnboardingWorkspace', 'Contul incarca onboardingul separat de membershipuri');
expect('base44/functions/submitProviderClaim/entry.ts', 'requested_membership_role: requestedMembershipRole', 'Cererea salveaza rolul solicitat');
expect('base44/functions/adminProviderClaimReview/entry.ts', "approved_membership_role: approvedRole", 'Adminul salveaza rolul aprobat');
expect('base44/functions/adminProviderClaimReview/entry.ts', "status: 'draft', public_visibility_status: 'draft'", 'Locatia noua ramane draft dupa aprobare');
expect('src/components/specialists/SpecialistsHero.jsx', 'setShowProfessionalNotice(true)', 'Profilul profesional nu intra in wizardul organizatiilor');
expect('src/components/specialists/SpecialistsHero.jsx', 'claim_action === "request_access"', 'Cautarea diferentiaza revendicarea de acces');

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.message} (${check.file})`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} verificari de onboarding au esuat.`);
  process.exit(1);
}

console.log(`\n${checks.length} verificari de onboarding au trecut.`);
