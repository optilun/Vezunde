import fs from 'node:fs';

export const DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS = Object.freeze([
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
]);

const CRITICAL_FORBIDDEN_TOKENS = new Set([
  'show_emergency_guidance',
  'emergency_interruption',
  'automatic_confirmed_emergency',
  'generic_112_action',
  'generic_112_primary_action',
  'commercial_top3',
  'provider_recommendation',
  'diagnose',
  'diagnosis',
  'treatment_recommendation',
  'contact_details_without_consent',
  'forbidden_output_fields',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function normalizePatientConversationFixturePaths(value) {
  if (Array.isArray(value)) {
    const paths = value.flatMap((item) => String(item || '').split(','))
      .map((item) => item.trim())
      .filter(Boolean);
    return paths.length > 0 ? [...new Set(paths)] : [...DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS];
  }
  if (typeof value === 'string' && value.trim()) {
    return normalizePatientConversationFixturePaths([value]);
  }
  return [...DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS];
}

export function normalizePatientConversationRepeatCount(value, fallback = 1, maximum = 5) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function isCriticalPatientConversationFixture(fixture) {
  const category = String(fixture?.category || '');
  const urgency = fixture?.expected?.urgency;
  const forbidden = Array.isArray(fixture?.expected?.must_not)
    ? fixture.expected.must_not
    : [];
  return urgency === 'possible'
    || urgency === 'confirmed'
    || category.startsWith('prompt_injection_')
    || category === 'prior_state_prompt_injection'
    || category === 'untrusted_role_injection'
    || forbidden.some((token) => CRITICAL_FORBIDDEN_TOKENS.has(token));
}

export function patientConversationFixtureAttemptCount(fixture, options = {}) {
  const defaultRepeat = normalizePatientConversationRepeatCount(options.defaultRepeat, 1);
  const criticalRepeat = normalizePatientConversationRepeatCount(
    options.criticalRepeat,
    Math.max(3, defaultRepeat),
  );
  return isCriticalPatientConversationFixture(fixture)
    ? Math.max(defaultRepeat, criticalRepeat)
    : defaultRepeat;
}

export function loadPatientConversationFixtures(pathsInput) {
  const fixturePaths = normalizePatientConversationFixturePaths(pathsInput);
  const payloads = fixturePaths.map((fixturePath) => ({
    fixture_path: fixturePath,
    payload: readJson(fixturePath),
  }));
  const cases = payloads.flatMap(({ payload }) => (
    Array.isArray(payload?.cases) ? payload.cases : []
  ));
  const duplicateCaseIds = [...new Set(cases
    .map((fixture) => fixture?.id)
    .filter((caseId, index, all) => caseId && all.indexOf(caseId) !== index))];
  if (duplicateCaseIds.length > 0) {
    throw new Error(`Duplicate patient conversation fixture IDs: ${duplicateCaseIds.join(', ')}`);
  }

  return {
    fixture_paths: fixturePaths,
    fixture_versions: payloads.map(({ payload, fixture_path }) => ({
      fixture_path,
      fixture_version: payload?.fixture_version || null,
      contract_version: payload?.contract_version || null,
    })),
    cases,
  };
}
