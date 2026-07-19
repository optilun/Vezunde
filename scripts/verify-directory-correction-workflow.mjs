import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entity = await readFile(new URL("../base44/entities/DirectoryCorrectionRequest.jsonc", import.meta.url), "utf8");
const submit = await readFile(new URL("../base44/functions/submitDirectoryCorrection/entry.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../base44/functions/adminDirectoryCorrectionReview/entry.ts", import.meta.url), "utf8");
const notice = await readFile(new URL("../src/components/provider/DirectoryProfileNotice.jsx", import.meta.url), "utf8");
const form = await readFile(new URL("../src/components/provider/DirectoryCorrectionForm.jsx", import.meta.url), "utf8");
const adminQueue = await readFile(new URL("../src/components/admin/directory/DirOpsCorrections.jsx", import.meta.url), "utf8");
const adminNav = await readFile(new URL("../src/lib/adminNavConfig.js", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../src/pages/AdminDirectoryOps.jsx", import.meta.url), "utf8");
const presentation = await readFile(new URL("../src/lib/providerPublicPresentation.js", import.meta.url), "utf8");

for (const required of [
  "incorrect_information",
  "location_closed",
  "location_moved",
  "duplicate_profile",
  "wrong_organization",
  "personal_data_removal",
  "submitted",
  "in_review",
  "needs_more_info",
  "resolved",
  "hide_profile",
  "close_location",
]) {
  assert.match(entity, new RegExp(`"${required}"`));
}
assert.match(entity, /"contact_email_normalized"/);
assert.match(entity, /"public_reference"/);
assert.match(entity, /"source_snapshot_json"/);
assert.match(entity, /"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/);

assert.match(submit, /privacy_confirmed !== true/);
assert.match(submit, /company_website \|\| payload\.website_honeypot/);
assert.match(submit, /validEmail\(contactEmail\)/);
assert.match(submit, /explanation\.length < 20/);
assert.match(submit, /Date\.now\(\) - submittedAt < 7 \* 86400000/);
assert.match(submit, /VCR-/);
assert.match(submit, /DirectoryCorrectionRequest\.create/);
assert.match(submit, /submit_directory_correction_request/);
assert.match(submit, /contact_email_masked/);
assert.doesNotMatch(submit, /new_values:[\s\S]{0,500}explanation/);
assert.match(submit, /confirmation_email_sent/);

assert.match(admin, /user\.role !== 'admin'/);
assert.match(admin, /start_review/);
assert.match(admin, /request_more_info/);
assert.match(admin, /resolve_directory_correction/);
assert.match(admin, /status: 'in_verificare'/);
assert.match(admin, /public_visibility_status: 'archived'/);
assert.match(admin, /status: 'suspendata'/);
assert.match(admin, /active_status: 'inactiva'/);
assert.match(admin, /request_intake_status: 'inactive'/);
assert.match(admin, /updateOrganizationAfterClose/);
assert.match(admin, /notification_sent/);

assert.match(notice, /DirectoryCorrectionForm/);
assert.match(notice, /Semnaleaza informatii incorecte/);
assert.doesNotMatch(notice, /buildDirectoryReportHref/);
assert.doesNotMatch(notice, /mailto:/);
assert.match(notice, /nu este administrat inca de furnizor/);
assert.match(notice, /nu reprezinta un parteneriat sau o recomandare VIASEE/);

assert.match(form, /functions\.invoke\("submitDirectoryCorrection"/);
assert.match(form, /privacy_confirmed/);
assert.match(form, /evidence_urls/);
assert.match(form, /Referinta:/);
assert.match(form, /Nu include date medicale/);

assert.match(adminQueue, /functions\.invoke\("adminDirectoryCorrectionReview"/);
assert.match(adminQueue, /request_more_info/);
assert.match(adminQueue, /resolution_action/);
assert.match(adminQueue, /close_location/);
assert.match(adminQueue, /hide_profile/);

assert.match(adminNav, /key: "corectii"/);
assert.match(adminNav, /Corectii si eliminari/);
assert.match(adminPage, /DirOpsCorrections/);
assert.match(adminPage, /tab === "corectii"/);
assert.match(presentation, /label: "Profil nerevendicat"/);
assert.doesNotMatch(presentation, /buildDirectoryReportHref/);

console.log("Directory correction workflow checks passed.");
