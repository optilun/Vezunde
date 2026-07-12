import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const authRedirect = read('src/lib/postLoginRedirect.js');
const login = read('src/pages/Login.jsx');
const register = read('src/pages/Register.jsx');
const forgotPassword = read('src/pages/ForgotPassword.jsx');
const resetPassword = read('src/pages/ResetPassword.jsx');
const app = read('src/App.jsx');
const addOrClaim = read('src/pages/AddOrClaim.jsx');
const organizationWizard = read('src/components/provider/OrganizationOnboardingWizard.jsx');
const subjectWizard = read('src/components/provider/NewLocationWizard.jsx');
const providerSearch = read('src/components/provider/ProviderSearch.jsx');
const searchBackend = read('base44/functions/getClaimableProviderLocations/entry.ts');
const identityBackend = read('base44/functions/findProviderIdentityCandidates/entry.ts');
const submitBackend = read('base44/functions/submitProviderClaim/entry.ts');
const reviewBackend = read('base44/functions/adminProviderClaimReview/entry.ts');
const adminClaims = read('src/components/admin/directory/DirOpsClaims.jsx');

const checks = [
  [authRedirect.includes('buildAuthRoute(pathname)'), 'auth helper preserves destination between login and register'],
  [authRedirect.includes('buildAuthRouteForCurrentPage(pathname)'), 'onboarding can construct an auth route back to the current page'],
  [authRedirect.includes('rememberPostAuthDestination'), 'password reset can remember the onboarding destination'],
  [login.includes('buildAuthRoute("/register")'), 'login preserves onboarding destination when creating an account'],
  [register.includes('buildAuthRoute("/login")'), 'register preserves onboarding destination when returning to login'],
  [forgotPassword.includes('rememberPostAuthDestination()'), 'password reset request stores the onboarding destination'],
  [resetPassword.includes('consumeRememberedPostAuthDestination()'), 'successful password reset returns through login to onboarding'],
  [app.includes('path="/pentru-organizatii"'), 'organization onboarding has a dedicated landing route'],
  [app.includes('path="/inscriere-specialist"'), 'professional onboarding has a dedicated route'],
  [app.includes('path="/inscriere-partener"'), 'B2B onboarding has a dedicated route'],
  [addOrClaim.includes('stage === "auth"'), 'existing-profile flow authenticates before private representation data'],
  [!addOrClaim.includes('redirectToLogin'), 'existing-profile flow does not redirect or submit from its form component'],
  [!organizationWizard.includes('pendingSubmit'), 'organization onboarding never auto-submits after login'],
  [!subjectWizard.includes('pendingSubmit'), 'professional and B2B onboarding never auto-submit after login'],
  [subjectWizard.includes('resumeStorageKey'), 'professional and B2B resume state is isolated'],
  [providerSearch.includes('loc.action_label'), 'search renders claim versus access labels from backend'],
  [searchBackend.includes("claim_action: controlled ? 'request_access' : 'claim'"), 'public search distinguishes controlled profiles'],
  [identityBackend.includes('provider_public_precheck'), 'new organization flow can run a safe duplicate precheck before login'],
  [submitBackend.includes('ROLE_BY_RELATIONSHIP'), 'backend derives requested role from the declared relationship'],
  [submitBackend.includes('Rolul solicitat nu corespunde relatiei declarate'), 'backend rejects forged requested roles'],
  [submitBackend.includes('request_type: requestType'), 'request type is persisted structurally'],
  [submitBackend.includes('new_professional_profile'), 'professional onboarding is represented as a separate request type'],
  [submitBackend.includes('new_b2b_supplier_profile'), 'B2B onboarding is represented as a separate request type'],
  [reviewBackend.includes('p.membership_role'), 'admin can explicitly select the approved role'],
  [reviewBackend.includes("approvedRole === 'organization_owner'"), 'owner approval propagates to organization locations'],
  [reviewBackend.includes('ProfessionalLocationAssignment'), 'professional approval creates a private location assignment'],
  [reviewBackend.includes("public_visibility_status: 'archived'"), 'rejected new profiles are archived instead of left active'],
  [adminClaims.includes('adminProviderClaimReview'), 'admin UI uses the role-aware review endpoint'],
  [adminClaims.includes('Aproba: {label}'), 'admin UI exposes the final membership role selector'],
];

for (const [condition, message] of checks) assert.equal(condition, true, message);
console.log(`provider onboarding: ${checks.length} checks passed`);
