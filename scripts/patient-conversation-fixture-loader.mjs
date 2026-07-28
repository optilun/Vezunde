import fs from 'node:fs';

export const DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS = Object.freeze([
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
  'tests/fixtures/patient-conversation-agent-state-evaluations.json',
  'tests/fixtures/patient-conversation-agent-evaluation-overrides.json',
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
  'invented_symptoms',
  'contact_details_without_consent',
  'forbidden_output_fields',
  'search_providers',
  'forget_previous_need',
]);

const CRITICAL_STATE_CATEGORIES = new Set([
  'prior_state_intent_replacement',
  'technical_to_routine_intent_switch',
  'locality_replacement',
  'locality_cleared',
  'person_replacement',
  'symptom_timing_correction',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fixtureId(fixture) {
  return String(fixture?.id || '').trim();
}

function normalizeFixtureMetadata(fixture) {
  if (!isPlainObject(fixture) || !isPlainObject(fixture.expected)) return fixture;
  const expected = fixture.expected;
  if (expected.question_goal === undefined) return fixture;

  const { question_goal: questionGoal, ...scoredExpected } = expected;
  return {
    ...fixture,
    fixture_notes: {
      ...(isPlainObject(fixture.fixture_notes) ? fixture.fixture_notes : {}),
      question_goal: String(questionGoal ?? '').trim(),
    },
    expected: scoredExpected,
  };
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
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return fallback;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function isCriticalPatientConversationFixture(fixture) {
  const category = String(fixture?.category || '');
  const urgency = fixture?.expected?.urgency;
  const forbidden = Array.isArray(fixture?.expected?.must_not)
    ? fixture.expected.must_not
    : [];
  const unimplementedChecks = Array.isArray(fixture?.expected?.unimplemented_checks)
    ? fixture.expected.unimplemented_checks
    : [];
  return urgency === 'possible'
    || urgency === 'confirmed'
    || category.startsWith('prompt_injection_')
    || category === 'prior_state_prompt_injection'
    || category === 'untrusted_role_injection'
    || CRITICAL_STATE_CATEGORIES.has(category)
    || forbidden.some((token) => CRITICAL_FORBIDDEN_TOKENS.has(token))
    || unimplementedChecks.length > 0;
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
    .map((fixture) => fixtureId(fixture))
    .filter((caseId, index, all) => caseId && all.indexOf(caseId) !== index))];
  if (duplicateCaseIds.length > 0) {
    throw new Error(`Duplicate patient conversation fixture IDs: ${duplicateCaseIds.join(', ')}`);
  }

  const replacements = payloads.flatMap(({ payload }) => (
    Array.isArray(payload?.replacements) ? payload.replacements : []
  ));
  const replacementIds = replacements.map((fixture) => fixtureId(fixture)).filter(Boolean);
  const duplicateReplacementIds = [...new Set(replacementIds
    .filter((caseId, index, all) => all.indexOf(caseId) !== index))];
  if (duplicateReplacementIds.length > 0) {
    throw new Error(`Duplicate patient conversation fixture replacement IDs: ${duplicateReplacementIds.join(', ')}`);
  }

  const caseIndexById = new Map(cases.map((fixture, index) => [fixtureId(fixture), index]));
  for (const replacement of replacements) {
    const id = fixtureId(replacement);
    if (!id || !caseIndexById.has(id)) {
      throw new Error(`Unknown patient conversation fixture replacement ID: ${id || '(missing)'}`);
    }
    cases[caseIndexById.get(id)] = replacement;
  }

  const normalizedCases = cases.map((fixture) => normalizeFixtureMetadata(fixture));
  const nonScoringQuestionGoalCaseIds = normalizedCases
    .filter((fixture) => fixture?.fixture_notes?.question_goal)
    .map((fixture) => fixture.id);

  return {
    fixture_paths: fixturePaths,
    fixture_versions: payloads.map(({ payload, fixture_path }) => ({
      fixture_path,
      fixture_version: payload?.fixture_version || null,
      contract_version: payload?.contract_version || null,
    })),
    replacement_case_ids: replacementIds,
    non_scoring_question_goal_case_ids: nonScoringQuestionGoalCaseIds,
    cases: normalizedCases,
  };
}
