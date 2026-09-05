import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  PATIENT_REQUEST_RECOVERY_CONTRACT_VERSION,
  buildPatientRequestRecoveryRecord,
  patientRequestRecoveryReason,
  sanitizePatientRequestRecovery,
  sanitizePatientRequestRecoveryCoverageCounts,
} from '../shared/patientRequestRecovery.js';

assert.equal(PATIENT_REQUEST_RECOVERY_CONTRACT_VERSION, 'patient-request-recovery-v1');
assert.equal(PATIENT_REQUEST_RECOVERY_CONSENT_VERSION, 'patient-request-recovery-review-v1');
assert.equal(patientRequestRecoveryReason('no_local_providers'), 'no_local_providers');
assert.equal(patientRequestRecoveryReason('unexpected'), 'no_search_results');
assert.deepEqual(sanitizePatientRequestRecoveryCoverageCounts({
  local_provider_count: 4.8,
  configured_matching_provider_count: -2,
  eligible_provider_count: '3',
}), {
  local_provider_count: 4,
  configured_matching_provider_count: 0,
  eligible_provider_count: 3,
});

const record = buildPatientRequestRecoveryRecord({
  request: {
    id: 'request-1',
    public_reference: 'VS-TEST1',
    match_count: 0,
    matching_coverage_status: 'local_service_data_missing',
    intent: 'control_vedere',
    service_keys: ['control_vedere_adulti'],
    city: 'Timisoara',
    county: 'Timis',
  },
  consentVersion: PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  coverageCounts: {
    local_provider_count: 5,
    configured_matching_provider_count: 0,
    eligible_provider_count: 0,
  },
});
assert.equal(record.status, 'queued');
assert.equal(record.outcome, 'pending');
assert.equal(record.reason, 'local_service_data_missing');
assert.equal(record.local_provider_count, 5);
assert.equal(record.request_id, 'request-1');
assert.equal(record.consent_version, PATIENT_REQUEST_RECOVERY_CONSENT_VERSION);

assert.throws(() => buildPatientRequestRecoveryRecord({
  request: { id: 'request-2', match_count: 1 },
  consentVersion: PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
}), /numai pentru cererile fara rezultate/);
assert.throws(() => buildPatientRequestRecoveryRecord({
  request: { id: 'request-3', match_count: 0 },
  consentVersion: 'wrong',
}), /Acordul/);

const patientView = sanitizePatientRequestRecovery({
  id: 'case-1',
  request_id: 'request-secret',
  status: 'completed',
  outcome: 'criteria_revision_recommended',
  reason: 'query_not_mapped',
  patient_update: 'Reformuleaza criteriile si reia cautarea.',
  internal_note: 'private admin note',
});
assert.equal(patientView.status, 'completed');
assert.equal(patientView.outcome, 'criteria_revision_recommended');
assert.equal(patientView.patient_update, 'Reformuleaza criteriile si reia cautarea.');
assert.equal(Object.hasOwn(patientView, 'request_id'), false);
assert.equal(Object.hasOwn(patientView, 'internal_note'), false);

const sources = await Promise.all([
  readFile(new URL('../base44/entities/PatientRequestRecoveryCase.jsonc', import.meta.url), 'utf8'),
  readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/intake2/PatientRecoverySubmission.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/intake2/PatientRecoveryStatusCard.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/intake2/MatchResults.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/PatientRequestResume.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/admin/review/AdminPatientRequestRecoveryQueue.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/admin/review/AdminReviewQueue.jsx', import.meta.url), 'utf8'),
]);

const [entity, backend, client, submission, statusCard, matchResults, resume, adminQueue, adminReview] = sources;

assert.match(entity, /"name": "PatientRequestRecoveryCase"/);
assert.match(entity, /"role": "admin"/);
assert.doesNotMatch(entity, /contact_email|contact_phone|contact_name|access_token/);

assert.match(backend, /action === 'recovery_request'/);
assert.match(backend, /PATIENT_REQUEST_RECOVERY_CONSENT_VERSION/);
assert.match(backend, /Number\(request\.match_count \|\| 0\) > 0/);
assert.match(backend, /findRecoveryCase/);
assert.match(backend, /idempotent_replay/);
assert.match(backend, /sanitizePatientRequestRecovery/);

assert.match(client, /PATIENT_REQUEST_RECOVERY_CONSENT_VERSION/);
assert.match(client, /requestPatientRequestRecovery/);
assert.match(client, /recovery_consent: true/);

assert.match(submission, /results: \[\]/);
assert.match(submission, /requestPatientRequestRecovery/);
assert.match(submission, /Cererea nu a fost trimisă automat niciunei locații/);
assert.match(submission, /verificarea nu promite identificarea unei locații/);
assert.match(submission, /PatientRecoveryStatusCard/);

assert.match(statusCard, /Verificare VIASEE/);
assert.match(statusCard, /nu promite identificarea unei locații/);
assert.doesNotMatch(statusCard, /garantam|garantăm|sigur gasim|sigur găsim/i);

assert.match(matchResults, /PatientRecoverySubmission/);
// 2026-09-05: acelasi motiv ca in verify-no-results-flow - recuperarea se declanseaza cand
// serverul nu a gasit nimic, nu cand harta a fost mutata in alta parte.
assert.match(matchResults, /if \(list\.length === 0\) \{/);
assert.match(resume, /requestPatientRequestRecovery/);
assert.match(resume, /snapshot\.recovery/);
assert.match(resume, /noResults/);

assert.match(adminQueue, /PatientRequestRecoveryCase/);
assert.match(adminQueue, /PatientRequest\.get/);
assert.doesNotMatch(adminQueue, /PatientRequestContact/);
assert.match(adminQueue, /Mesaj vizibil pacientului/);
assert.match(adminReview, /Cereri fara rezultate/);
assert.match(adminReview, /AdminPatientRequestRecoveryQueue/);

console.log('Patient request recovery checks passed.');
