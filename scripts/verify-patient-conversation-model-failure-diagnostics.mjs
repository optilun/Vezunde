import assert from 'node:assert/strict';
import {
  PATIENT_CONVERSATION_MODEL_FAILURE_CLASSIFIER_VERSION,
  classifyPatientConversationModelFailure,
} from '../base44/functions/matchProvidersSemantic/patientConversationModelFailureDiagnostics.js';

const cases = [
  {
    error: { message: 'Integration credits exhausted for this app' },
    category: 'credits_exhausted',
    retryable: false,
  },
  {
    error: { response: { status: 429 } },
    category: 'rate_limited',
    retryable: true,
  },
  {
    error: { status: 403 },
    category: 'permission_denied',
    retryable: false,
  },
  {
    error: { code: 'ETIMEDOUT' },
    category: 'timeout',
    retryable: true,
  },
  {
    error: { response: { status: 400 }, message: 'Invalid response_json_schema' },
    category: 'invalid_request',
    retryable: false,
  },
  {
    error: { response: { status: 503 } },
    category: 'provider_unavailable',
    retryable: true,
  },
  {
    error: { code: 'PATIENT_CONVERSATION_MODEL_INVOKER_UNAVAILABLE' },
    category: 'invoker_unavailable',
    retryable: false,
  },
  {
    error: new Error('Unexpected model failure containing private details'),
    category: 'unknown',
    retryable: false,
  },
];

for (const testCase of cases) {
  const diagnostic = classifyPatientConversationModelFailure(testCase.error);
  assert.equal(
    diagnostic.classifier_version,
    PATIENT_CONVERSATION_MODEL_FAILURE_CLASSIFIER_VERSION,
  );
  assert.equal(diagnostic.category, testCase.category);
  assert.equal(diagnostic.retryable, testCase.retryable);
  assert.deepEqual(
    Object.keys(diagnostic).sort(),
    ['category', 'classifier_version', 'http_status', 'retryable', 'signal_source'].sort(),
  );
  assert.equal(JSON.stringify(diagnostic).includes('private details'), false);
}

console.log('Patient conversation model failure diagnostics verified.');
