import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const requestFlow = await readFile(new URL('../src/pages/RequestFlow.jsx', import.meta.url), 'utf8');
const resumePage = await readFile(new URL('../src/pages/PatientRequestResume.jsx', import.meta.url), 'utf8');
const statusBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const emailBackend = await readFile(new URL('../base44/functions/patientRequestEmailVerificationOps/entry.ts', import.meta.url), 'utf8');

assert.match(client, /RESUME_REFERENCE_PREFIX/);
assert.match(client, /globalThis\.localStorage/);
assert.match(client, /buildPatientRequestResumeUrl/);
assert.match(client, /#\$\{hash\.toString\(\)\}/);
assert.doesNotMatch(client, /access_token=.*searchParams|searchParams.*access_token/);
assert.match(client, /getPatientRequestStatusByReference/);
assert.match(client, /public_reference: publicReference/);
assert.match(client, /replaceWithPatientRequestResumeRoute/);
assert.match(client, /new PopStateEvent\("popstate"\)/);
assert.match(client, /resume_url: buildPatientRequestResumeUrl/);

assert.match(requestFlow, /urlParams\.get\("ref"\)/);
assert.match(requestFlow, /<PatientRequestResume publicReference=\{publicReference\}/);
assert.match(requestFlow, /max-w-7xl/);

assert.match(resumePage, /tokenFromHash/);
assert.match(resumePage, /removeAccessHash/);
assert.match(resumePage, /getPatientRequestStatusByReference/);
assert.match(resumePage, /storePatientRequestAccess/);
assert.match(resumePage, /Copiaza linkul/);
assert.match(resumePage, /Referinta publica singura nu ofera acces/);
assert.match(resumePage, /distribution_authorized/);
assert.match(resumePage, /authorizePatientRequestDistribution/);
assert.match(resumePage, /<PatientRequestEmailVerification/);
assert.match(resumePage, /<RequestWorkspace/);
assert.doesNotMatch(resumePage, /base44\.entities\./);

assert.match(statusBackend, /resolveRequest\(svc, requestId, publicReference\)/);
assert.match(statusBackend, /access_token_hash: tokenHash/);
assert.match(statusBackend, /retentionExpired/);
assert.match(statusBackend, /buildWorkspacePayload/);
assert.match(statusBackend, /PatientRequestAnswer\.filter/);
assert.match(statusBackend, /RequestMatch\.filter/);
assert.match(statusBackend, /sanitizeWorkspaceResult/);
assert.match(statusBackend, /distribution_authorized/);
assert.doesNotMatch(statusBackend, /contact_email:|contact_phone:/);

assert.match(emailBackend, /safeResumeUrl/);
assert.match(emailBackend, /host\.endsWith\('\.base44\.app'\)/);
assert.match(emailBackend, /Poti reveni la cerere de pe orice dispozitiv/);
assert.match(emailBackend, /Linkul contine cheia privata de acces/);
assert.match(emailBackend, /resume_url/);

console.log('Request Workspace Resume v1 checks passed.');
