import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_QUESTIONNAIRE_VERSION,
  PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
  PATIENT_REQUEST_PROCESSING_CONSENT_VERSION,
  PatientRequestValidationError,
  sanitizePatientRequestSubmission,
} from '../shared/patientRequestPersistence.js';

const validInput = {
  idempotency_key: 'patient:1234567890abcdef',
  detailed_message: 'Rama este rupta la balama si as dori sa stiu daca poate fi reparata astazi.',
  request_draft: {
    contract_version: PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
    questionnaire_version: PATIENT_QUESTIONNAIRE_VERSION,
    questionnaire_key: 'patient-reparatii_ochelari-v1',
    intent: 'reparatii_ochelari',
    original_message: 'Mi s-au rupt ochelarii si caut reparatie in Timisoara',
    service_keys: ['reparatii_ochelari', 'frame_repair'],
    location_scope: 'locality',
    city: 'Timisoara',
    locality_siruta_code: '155243',
    client_address_text: 'Timisoara',
    timing_key: 'cat_mai_repede',
    answers: [{ question_key: 'ce_deteriorat', question_label: 'Ce s-a deteriorat?', answer_value: 'rama_rupta', answer_label: 'Rama rupta' }],
    interpretation: { version: 'patient-need-ai-v1', confidence_band: 'high', agreement_status: 'agree', possible_safety_flags: [] },
  },
  contact: { name: 'Ana Popescu', email: ' ANA@example.com ', phone: '', preference: 'email' },
  consent: { processing: true, version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION, provider_contact_sharing: true },
  recommendation: {
    contract_version: 'provider-recommendation-v1',
    coverage_status: 'results_found',
    need_level: 'technical',
    results: [{ id: 'location-1', result_bucket: 'top3', bucket_rank: 1, recommendation_score: 92, semantic_match_score: 0.91, matched_service_keys: ['reparatii_ochelari'], profile_control_status: 'verified', is_top3_eligible: true }],
  },
};

const sanitized = sanitizePatientRequestSubmission(validInput);
assert.equal(sanitized.contact.contact_email, 'ana@example.com');
assert.equal(sanitized.contact.contact_phone, '');
assert.equal(sanitized.request.detailed_message, validInput.detailed_message);
assert.equal(sanitized.request.top3_count, 1);
assert.equal(sanitized.contact.provider_contact_sharing_consent, false);

const phoneOnly = sanitizePatientRequestSubmission({
  ...validInput,
  idempotency_key: 'patient:phoneonly123456',
  contact: { name: 'Ana Popescu', email: '', phone: '0722 123 456', preference: 'phone' },
});
assert.equal(phoneOnly.contact.contact_email, '');
assert.equal(phoneOnly.contact.contact_phone, '0722 123 456');
assert.equal(phoneOnly.contact.contact_preference, 'phone');

assert.throws(() => sanitizePatientRequestSubmission({ ...validInput, detailed_message: 'scurt' }), PatientRequestValidationError);
assert.throws(() => sanitizePatientRequestSubmission({ ...validInput, contact: { name: 'Ana Popescu', email: '', phone: '', preference: 'email' } }), PatientRequestValidationError);
assert.throws(() => sanitizePatientRequestSubmission({ ...validInput, consent: { processing: false, version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION } }), PatientRequestValidationError);
assert.throws(() => sanitizePatientRequestSubmission({ ...validInput, request_draft: { ...validInput.request_draft, service_keys: ['invented_service'] } }), PatientRequestValidationError);

const patientRequestSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequest.jsonc', import.meta.url), 'utf8'));
const contactSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestContact.jsonc', import.meta.url), 'utf8'));
for (const forbiddenField of ['contact_name', 'contact_email', 'contact_phone', 'consent']) {
  assert.equal(patientRequestSchema.properties[forbiddenField], undefined, `${forbiddenField} nu trebuie pastrat in PatientRequest`);
}
assert.ok(patientRequestSchema.properties.detailed_message);
assert.ok(patientRequestSchema.properties.contact_identity_hash);
assert.ok(contactSchema.properties.contact_email);
assert.ok(contactSchema.properties.contact_phone);
assert.equal(contactSchema.required.includes('contact_email'), false);
assert.equal(contactSchema.rls.read.user_condition.role, 'admin');

const functionSource = await readFile(new URL('../base44/functions/createPatientRequest/entry.ts', import.meta.url), 'utf8');
const submissionSource = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');
const resultsSource = await readFile(new URL('../src/components/intake2/MatchResults.jsx', import.meta.url), 'utf8');
const reviewSource = await readFile(new URL('../src/components/intake2/PatientRequestReview.jsx', import.meta.url), 'utf8');

assert.match(functionSource, /contact_identity_hash/);
assert.match(functionSource, /MAX_REQUESTS_PER_CONTACT_PER_HOUR/);
assert.match(functionSource, /phoneIdentity/);
assert.match(functionSource, /provider_contact_sharing_consent: false/);
assert.match(functionSource, /PatientRequestContact\.create/);
assert.match(functionSource, /persistence_state: 'complete'/);
assert.match(submissionSource, /Descrie mai detaliat ce ai nevoie/);
assert.match(submissionSource, /emailul sau numărul de telefon/);
assert.match(submissionSource, /Telefonul nu a fost transmis/);
assert.match(resultsSource, /PatientRequestSubmission/);
assert.match(reviewSource, /storePatientRequestDraft/);

console.log('Patient request persistence checks passed.');
