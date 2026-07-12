import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const submit = read('base44/functions/submitProviderWorkspaceChange/entry.ts');
const organization = read('base44/functions/manageProviderOrganizationProfile/entry.ts');
const adminLocation = read('base44/functions/adminWorkspaceReview/entry.ts');
const adminOrganization = read('base44/functions/adminOrganizationProfileReview/entry.ts');
const client = read('src/api/base44Client.js');

const checks = [
  [submit.includes("hasPublishedSectionChanges('location_details'"), 'location create/update/submit compares published values'],
  [submit.includes("sameSubmissionPayload(submission.section"), 'location pending duplicates use canonical comparison'],
  [submit.includes("status: 'withdrawn'"), 'location no-op drafts can be withdrawn'],
  [organization.includes("hasPublishedSectionChanges('public_profile'"), 'organization compares canonical published values'],
  [organization.includes('activeAfterCreate'), 'organization has post-create race guard'],
  [organization.includes("status: 'withdrawn'"), 'organization no-op drafts can be withdrawn'],
  [adminLocation.includes('Cererea nu contine modificari reale fata de datele publicate.'), 'admin blocks no-op location approval'],
  [adminOrganization.includes('Cererea nu contine modificari reale fata de profilul publicat.'), 'admin blocks no-op organization approval'],
  [!client.includes('new Proxy'), 'global Base44 client Proxy was removed'],
];
for (const [condition, message] of checks) assert.equal(condition, true, message);
console.log(`provider submission backend: ${checks.length} checks passed`);
