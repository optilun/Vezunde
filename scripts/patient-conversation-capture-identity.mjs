import crypto from 'node:crypto';
import {
  patientConversationFixtureAttemptCount,
} from './patient-conversation-fixture-loader.mjs';

const EXPECTED_CONTRACT_VERSION = 'viasee-patient-conversation-agent-v1';
const EXPECTED_MODEL_CONTEXT = 'Base44 Core.InvokeLLM';
const MINIMUM_CRITICAL_REPEAT_COUNT = 3;
const MAXIMUM_REPEAT_COUNT = 5;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validRepeatCount(value, minimum = 1) {
  return Number.isInteger(value) && value >= minimum && value <= MAXIMUM_REPEAT_COUNT;
}

function validTimestamp(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

export function patientConversationFixtureFingerprint(fixtureSuite) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      fixture_versions: fixtureSuite?.fixture_versions || [],
      cases: fixtureSuite?.cases || [],
    }))
    .digest('hex');
}

export function assessPatientConversationCaptureIdentity({ fixtureSuite, capture } = {}) {
  const suite = isPlainObject(fixtureSuite) ? fixtureSuite : {};
  const payload = isPlainObject(capture) ? capture : {};
  const modelRun = isPlainObject(payload.model_run) ? payload.model_run : {};
  const cases = Array.isArray(suite.cases) ? suite.cases : [];
  const selectedCaseIds = cases.map((fixture) => String(fixture?.id || '').trim());
  const defaultRepeat = modelRun.default_repeat_count;
  const criticalRepeat = modelRun.critical_repeat_count;
  const repeatPolicyValid = validRepeatCount(defaultRepeat)
    && validRepeatCount(criticalRepeat, MINIMUM_CRITICAL_REPEAT_COUNT)
    && criticalRepeat >= defaultRepeat;
  const expectedAttemptsByCase = repeatPolicyValid
    ? Object.fromEntries(cases.map((fixture) => [
      fixture.id,
      patientConversationFixtureAttemptCount(fixture, {
        defaultRepeat,
        criticalRepeat,
      }),
    ]))
    : null;
  const expectedFingerprint = patientConversationFixtureFingerprint(suite);
  const issues = [];

  if (cases.length === 0) issues.push('fixture_cases_missing');
  if (!sameJson(payload.fixture_paths, suite.fixture_paths || [])) {
    issues.push('fixture_paths_mismatch');
  }
  if (!sameJson(payload.fixture_versions, suite.fixture_versions || [])) {
    issues.push('fixture_versions_mismatch');
  }
  if (modelRun.fixture_fingerprint !== expectedFingerprint) {
    issues.push('fixture_fingerprint_mismatch');
  }
  if (modelRun.contract_version !== EXPECTED_CONTRACT_VERSION) {
    issues.push('contract_version_mismatch');
  }
  if (modelRun.model_context !== EXPECTED_MODEL_CONTEXT) {
    issues.push('model_context_mismatch');
  }
  if (!sameJson(modelRun.selected_case_ids, selectedCaseIds)) {
    issues.push('selected_case_ids_mismatch');
  }
  if (!repeatPolicyValid) issues.push('repeat_policy_invalid');
  if (repeatPolicyValid
    && !sameJson(modelRun.expected_attempts_by_case, expectedAttemptsByCase)) {
    issues.push('expected_attempts_by_case_mismatch');
  }
  if (!validTimestamp(modelRun.started_at)) issues.push('started_at_invalid');
  if (!validTimestamp(modelRun.completed_at)) issues.push('completed_at_invalid');

  return {
    complete: issues.length === 0,
    issues,
    expected: {
      fixture_fingerprint: expectedFingerprint,
      contract_version: EXPECTED_CONTRACT_VERSION,
      model_context: EXPECTED_MODEL_CONTEXT,
      selected_case_ids: selectedCaseIds,
      expected_attempts_by_case: expectedAttemptsByCase,
    },
    observed: {
      fixture_fingerprint: modelRun.fixture_fingerprint || null,
      contract_version: modelRun.contract_version || null,
      model_context: modelRun.model_context || null,
      selected_case_ids: Array.isArray(modelRun.selected_case_ids)
        ? modelRun.selected_case_ids
        : [],
      default_repeat_count: defaultRepeat ?? null,
      critical_repeat_count: criticalRepeat ?? null,
      expected_attempts_by_case: isPlainObject(modelRun.expected_attempts_by_case)
        ? modelRun.expected_attempts_by_case
        : null,
      started_at: modelRun.started_at || null,
      completed_at: modelRun.completed_at || null,
    },
  };
}
