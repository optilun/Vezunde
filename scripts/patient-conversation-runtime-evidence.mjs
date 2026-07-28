export const PATIENT_CONVERSATION_RUNTIME_EVIDENCE_VERSION =
  'viasee-patient-conversation-runtime-evidence-v1';

export function assessPatientConversationRuntimeEvidence(report = {}) {
  const expectedAttemptCount = Object.values(
    report?.repeat_policy?.expected_attempts_by_case || {},
  ).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const measuredAttemptCount = Number(report?.runtime?.duration_ms?.measured_attempts) || 0;
  const missingDurationCount = Number(report?.runtime?.duration_ms?.missing_attempts) || 0;
  const complete = expectedAttemptCount > 0
    && measuredAttemptCount === expectedAttemptCount
    && missingDurationCount === 0;

  return {
    version: PATIENT_CONVERSATION_RUNTIME_EVIDENCE_VERSION,
    complete,
    expected_attempts: expectedAttemptCount,
    measured_attempts: measuredAttemptCount,
    missing_duration_attempts: missingDurationCount,
  };
}
