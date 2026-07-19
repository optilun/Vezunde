import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_QUESTIONNAIRE_VERSION,
  PATIENT_REQUEST_DRAFT_CONTRACT_VERSION,
  buildPatientRequestDraft,
} from '../src/lib/patientRequestDraft.js';

const draft = buildPatientRequestDraft({
  originalMessage: 'Mi s-au rupt ochelarii si caut reparatie in Timisoara',
  interpretation: {
    version: 'patient-need-ai-v1',
    confidence_band: 'high',
    agreement_status: 'agree',
    possible_safety_flags: [],
  },
  state: {
    intent: 'reparatii_ochelari',
    serviceKeys: ['reparatii_ochelari', 'frame_repair', 'frame_repair'],
    scope: 'locality',
    city: 'Timisoara',
    locality: { siruta_code: '155243' },
    clientAddressText: 'Timisoara',
    answers: [
      { question_key: 'ce_deteriorat', answer_value: 'rama_rupta' },
      { question_key: 'locatie', answer_value: 'Timisoara' },
      { question_key: 'timing', answer_value: 'cat_mai_repede' },
    ],
  },
});

assert.equal(draft.contract_version, PATIENT_REQUEST_DRAFT_CONTRACT_VERSION);
assert.equal(draft.questionnaire_version, PATIENT_QUESTIONNAIRE_VERSION);
assert.equal(draft.questionnaire_key, 'patient-reparatii_ochelari-v1');
assert.equal(draft.intent, 'reparatii_ochelari');
assert.equal(draft.intent_label, 'Reparatii sau reglaje');
assert.deepEqual(draft.service_keys, ['reparatii_ochelari', 'frame_repair']);
assert.equal(draft.city, 'Timisoara');
assert.equal(draft.locality_siruta_code, '155243');
assert.equal(draft.timing_key, 'cat_mai_repede');
assert.equal(draft.answers.find((answer) => answer.question_key === 'ce_deteriorat')?.answer_label, 'Rama rupta');
assert.equal(draft.answers.find((answer) => answer.question_key === 'timing')?.answer_label, 'Cat mai repede');
assert.equal(draft.interpretation.version, 'patient-need-ai-v1');

const cardSource = await readFile(new URL('../src/components/intake2/ConversationalCard.jsx', import.meta.url), 'utf8');
const reviewSource = await readFile(new URL('../src/components/intake2/PatientRequestReview.jsx', import.meta.url), 'utf8');

assert.match(cardSource, /buildPatientRequestDraft/);
assert.match(cardSource, /setPhase\("review"\)/);
assert.match(cardSource, /phase !== "submitting" \|\| !requestDraft/);
assert.match(cardSource, /patient_search_request_review_opened/);
assert.match(cardSource, /patient_search_request_review_confirmed/);
assert.match(cardSource, /patient_search_request_review_edited/);
assert.match(cardSource, /questionnaire_version: requestDraft\.questionnaire_version/);

const reviewIndex = cardSource.indexOf('setPhase("review")');
const matchingIndex = cardSource.indexOf('const res = await matchProvidersWithSemanticFallback');
assert.ok(reviewIndex > -1, 'patient request review phase is missing');
assert.ok(matchingIndex > reviewIndex, 'matching must run only after the request review phase');

assert.match(reviewSource, /Caută rezultate/);
assert.match(reviewSource, /Modifică ultimul răspuns/);
assert.match(reviewSource, /draft\.questionnaire_version/);

console.log('Patient request review contract checks passed.');
