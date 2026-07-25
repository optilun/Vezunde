import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_RUNTIME_EVIDENCE_VERSION,
  assessPatientConversationRuntimeEvidence,
} from './patient-conversation-runtime-evidence.mjs';

assert.equal(
  PATIENT_CONVERSATION_RUNTIME_EVIDENCE_VERSION,
  'viasee-patient-conversation-runtime-evidence-v1',
);

const complete = assessPatientConversationRuntimeEvidence({
  repeat_policy: {
    expected_attempts_by_case: {
      routine: 1,
      critical: 3,
    },
  },
  runtime: {
    duration_ms: {
      measured_attempts: 4,
      missing_attempts: 0,
    },
  },
});
assert.deepEqual(complete, {
  version: PATIENT_CONVERSATION_RUNTIME_EVIDENCE_VERSION,
  complete: true,
  expected_attempts: 4,
  measured_attempts: 4,
  missing_duration_attempts: 0,
});

const missingDuration = assessPatientConversationRuntimeEvidence({
  repeat_policy: {
    expected_attempts_by_case: { critical: 3 },
  },
  runtime: {
    duration_ms: {
      measured_attempts: 2,
      missing_attempts: 1,
    },
  },
});
assert.equal(missingDuration.complete, false);
assert.equal(missingDuration.expected_attempts, 3);
assert.equal(missingDuration.measured_attempts, 2);
assert.equal(missingDuration.missing_duration_attempts, 1);

const mismatchedMeasuredCount = assessPatientConversationRuntimeEvidence({
  repeat_policy: {
    expected_attempts_by_case: { routine: 1, critical: 3 },
  },
  runtime: {
    duration_ms: {
      measured_attempts: 3,
      missing_attempts: 0,
    },
  },
});
assert.equal(mismatchedMeasuredCount.complete, false);

const empty = assessPatientConversationRuntimeEvidence({});
assert.equal(empty.complete, false);
assert.equal(empty.expected_attempts, 0);

const validatedLauncher = fs.readFileSync(
  new URL('./evaluate-patient-conversation-results-validated.mjs', import.meta.url),
  'utf8',
);
assert.match(validatedLauncher, /assessPatientConversationRuntimeEvidence/);
assert.match(validatedLauncher, /if \(!runtimeEvidence\.complete\)/);
assert.match(
  validatedLauncher,
  /patient_conversation_runtime_duration_evidence_incomplete/,
);

console.log('Patient conversation runtime duration evidence gate verified.');
