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
    answers: [
      {
        question_key: 'ce_deteriorat',
        question_label: 'Ce s-a deteriorat?',
        answer_value: 'rama_rupta',
        answer_label: 'Rama rupta',
      },
      {
        question_key: 'locatie',
        question_label: 'Unde cauti?',
        answer_value: 'Timisoara',
        answer_label: 'Timisoara',
      },
    ],
    interpretation: {
      version: 'patient-need-ai-v1',
      confidence_band: 'high',
      agreement_status: 'agree',
      possible_safety_flags: [],
    },
  },
  contact: {
    name: 'Ana Popescu',
    email: ' ANA@example.com ',
    phone: '',
    preference: 'email',
  },
  consent: {
    processing: true,
    version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION,
    provider_contact_sharing: true,
  },
  recommendation: {
    contract_version: 'provider-recommendation-v1',
    coverage_status: 'results_found',
    need_level: 'technical',
    results: [
      {
        id: 'location-1',
        result_bucket: 'top3',
        bucket_rank: 1,
        recommendation_score: 92,
        semantic_match_score: 0.91,
        matched_service_keys: ['reparatii_ochelari'],
        profile_control_status: 'verified',
        is_top3_eligible: true,
        recommendation_explanations: [{ code: 'service_match', label: 'Ofera reparatii' }],
      },
    ],
  },
};

const sanitized = sanitizePatientRequestSubmission(validInput);
assert.equal(sanitized.idempotency_key, validInput.idempotency_key);
assert.equal(sanitized.contact.contact_email, 'ana@example.com');
assert.equal(sanitized.request.locality_siruta_code, '155243');
assert.equal(sanitized.request.match_count, 1);
assert.equal(sanitized.request.top3_count, 1);
assert.equal(sanitized.answers[0].position, 1);
assert.equal(sanitized.matches[0].snapshot_source, 'client_confirmed_search');
assert.equal(sanitized.matches[0].result_bucket, 'top3');
assert.ok(sanitized.matches[0].matched_service_keys.length > 0);

assert.throws(
  () => sanitizePatientRequestSubmission({
    ...validInput,
    consent: { processing: false, version: PATIENT_REQUEST_PROCESSING_CONSENT_VERSION },
  }),
  PatientRequestValidationError,
);
assert.throws(
  () => sanitizePatientRequestSubmission({
    ...validInput,
    request_draft: { ...validInput.request_draft, service_keys: ['invented_service'] },
  }),
  PatientRequestValidationError,
);
assert.throws(
  () => sanitizePatientRequestSubmission({
    ...validInput,
    contact: { ...validInput.contact, preference: 'phone', phone: '' },
  }),
  PatientRequestValidationError,
);

const patientRequestSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequest.jsonc', import.meta.url), 'utf8'));
const contactSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestContact.jsonc', import.meta.url), 'utf8'));
const answerSchema = JSON.parse(await readFile(new URL('../base44/entities/PatientRequestAnswer.jsonc', import.meta.url), 'utf8'));
const matchSchema = JSON.parse(await readFile(new URL('../base44/entities/RequestMatch.jsonc', import.meta.url), 'utf8'));

for (const forbiddenField of ['contact_name', 'contact_email', 'contact_phone', 'consent']) {
  assert.equal(patientRequestSchema.properties[forbiddenField], undefined, `${forbiddenField} nu trebuie pastrat in PatientRequest`);
}
assert.ok(contactSchema.properties.contact_email);
assert.ok(contactSchema.properties.processing_consent_version);
assert.ok(contactSchema.properties.provider_contact_sharing_consent);
assert.equal(contactSchema.rls.read.user_condition.role, 'admin');
assert.ok(answerSchema.properties.questionnaire_version);
assert.ok(answerSchema.properties.answer_label);
assert.ok(matchSchema.properties.snapshot_source);
assert.ok(matchSchema.properties.recommendation_contract_version);

const functionSource = await readFile(new URL('../base44/functions/createPatientRequest/entry.ts', import.meta.url), 'utf8');
const submissionSource = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');
const resultsSource = await readFile(new URL('../src/components/intake2/MatchResults.jsx', import.meta.url), 'utf8');
const reviewSource = await readFile(new URL('../src/components/intake2/PatientRequestReview.jsx', import.meta.url), 'utf8');

assert.match(functionSource, /findExisting\(svc, submission\.idempotency_key\)/);
assert.match(functionSource, /IDEMPOTENCY_SETTLE_MS/);
assert.match(functionSource, /finalWinner/);
assert.match(functionSource, /MAX_REQUESTS_PER_EMAIL_PER_HOUR/);
assert.match(functionSource, /validatePublishedMatches/);
assert.match(functionSource, /provider_contact_sharing_consent: false/);
assert.match(functionSource, /PatientRequestContact\.create/);
assert.match(functionSource, /PatientRequestAnswer\.bulkCreate/);
assert.match(functionSource, /RequestMatch\.bulkCreate/);
assert.match(functionSource, /persistence_state: 'complete'/);
assert.match(functionSource, /contact_sharing_enabled: false/);
assert.match(submissionSource, /Datele tale de contact nu au fost transmise niciunui furnizor/);
assert.match(submissionSource, /Confirmă și salvează/);
assert.match(resultsSource, /PatientRequestSubmission/);
assert.match(reviewSource, /storePatientRequestDraft/);

console.log('Patient request persistence checks passed.');
