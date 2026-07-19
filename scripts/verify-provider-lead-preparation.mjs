import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  acquirePatientRequestDistributionLock,
  releasePatientRequestDistributionLock,
} from '../shared/patientRequestDistributionLock.js';
import {
  PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION,
  PROVIDER_LEAD_CONTRACT_VERSION,
  PROVIDER_LEAD_ELIGIBILITY_POLICY_VERSION,
  buildProviderLeadPreview,
  evaluateProviderLeadEligibility,
} from '../shared/providerLeadEligibility.js';

const request = { id: 'request-1', persistence_state: 'complete', intent: 'reparatii_ochelari', service_keys: ['eyeglasses_repair'], city: 'Timisoara', timing_key: 'cat_mai_repede', matching_need_level: 'technical' };
const match = { id: 'match-1', location_id: 'location-1', result_bucket: 'top3', need_level_snapshot: 'technical' };
const location = { id: 'location-1', status: 'publicata', active_status: 'activa', profile_control_status: 'claimed', request_intake_status: 'active', accepts_patients_directly: true };
const services = [{ location_id: 'location-1', service_key: 'eyeglasses_repair', is_active: true, accepts_requests: true, matching_allowed: true, confirmation_level: 'provider_confirmed', migration_review_required: false }];

const generalEligible = evaluateProviderLeadEligibility({ request, match, location, services });
assert.equal(generalEligible.eligible, true);
assert.deepEqual(generalEligible.matched_service_keys, ['eyeglasses_repair']);

const directoryExcluded = evaluateProviderLeadEligibility({ request, match: { ...match, result_bucket: 'extended_directory' }, location: { ...location, profile_control_status: 'directory' }, services });
assert.equal(directoryExcluded.eligible, false);
assert.ok(directoryExcluded.reasons.includes('match_bucket_not_distributable'));
assert.ok(directoryExcluded.reasons.includes('location_not_claimed'));

const specializedRequest = { ...request, matching_need_level: 'specialized_medical' };
const verifiedSpecialized = evaluateProviderLeadEligibility({ request: specializedRequest, match: { ...match, need_level_snapshot: 'specialized_medical' }, location: { ...location, profile_control_status: 'verified' }, services: [{ ...services[0], confirmation_level: 'vezunde_verified' }] });
assert.equal(verifiedSpecialized.eligible, true);

assert.equal(buildProviderLeadPreview(request), 'Reparatii sau reglaje · Timisoara · Cat mai repede');
assert.equal(PROVIDER_LEAD_CONTRACT_VERSION, 'provider-lead-v1');
assert.equal(PROVIDER_LEAD_ELIGIBILITY_POLICY_VERSION, 'provider-lead-eligibility-v1');
assert.equal(PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION, 'patient-request-distribution-top3-pro-v2');

const lockState = { token: '', at: '' };
const lockSvc = { entities: { PatientRequest: { async updateMany(query, update) { if (update?.$set) { if (lockState.token) return { updated: 0 }; lockState.token = update.$set.distribution_lock_token; lockState.at = update.$set.distribution_lock_at; return { updated: 1 }; } if (update?.$unset && query?.distribution_lock_token === lockState.token) { lockState.token = ''; lockState.at = ''; return { updated: 1 }; } return { updated: 0 }; } } } };
const firstLock = await acquirePatientRequestDistributionLock(lockSvc, request.id);
assert.ok(firstLock?.token);
assert.equal(await acquirePatientRequestDistributionLock(lockSvc, request.id), null);
assert.equal(await releasePatientRequestDistributionLock(lockSvc, firstLock), true);

const leadSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLead.jsonc', import.meta.url), 'utf8'));
for (const forbiddenField of ['contact_name', 'contact_email', 'contact_phone', 'original_message', 'detailed_message']) {
  assert.equal(leadSchema.properties[forbiddenField], undefined, `${forbiddenField} nu trebuie sa existe in ProviderLead`);
}
assert.equal(leadSchema.rls.read.user_condition.role, 'admin');

const functionSource = await readFile(new URL('../base44/functions/authorizePatientRequestDistribution/entry.ts', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const submissionSource = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');

assert.match(functionSource, /match\.result_bucket === 'top3' \? 'pro_full' : 'free_preview'/);
assert.match(functionSource, /top3_full_detail_count/);
assert.match(functionSource, /provider_contact_sharing_consent: false/);
assert.match(functionSource, /contact_access_state: 'hidden'/);
assert.match(functionSource, /conversation_access_state: 'locked'/);
assert.doesNotMatch(functionSource, /contact_phone:/);
assert.match(clientSource, /patient-request-distribution-top3-pro-v2/);
assert.match(submissionSource, /locațiilor Pro din Top 3/);
assert.match(submissionSource, /Numărul de telefon rămâne ascuns/);

console.log('Provider lead preparation checks passed.');
