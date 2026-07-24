export const PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS = Object.freeze([
  'search_providers',
  'show_emergency_guidance',
  'emergency_interruption',
  'commercial_top3',
  'provider_recommendation',
  'forbidden_output_fields',
  'mention_112',
  'generic_112_action',
  'generic_112_primary_action',
  'automatic_confirmed_emergency',
  'diagnose',
  'diagnosis',
  'treatment_recommendation',
  'invented_symptoms',
  'contact_details_without_consent',
  'ask_child_age',
  'ask_safety_screening',
  'retain_superseded_eyeglasses_intent',
]);

export const PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS = Object.freeze([]);

const SUPPORTED_MUST_NOT_TOKEN_SET = new Set(
  PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS,
);
const UNIMPLEMENTED_EXPECTATION_TOKEN_SET = new Set(
  PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS,
);

function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function fixtureId(fixture, index) {
  return clean(fixture?.id, 120) || `fixture-index-${index}`;
}

export function validatePatientConversationFixtureContract(fixtures = []) {
  if (!Array.isArray(fixtures)) {
    return [{
      fixture_id: null,
      field: 'cases',
      code: 'fixture_cases_required',
      value: null,
    }];
  }

  const violations = [];
  fixtures.forEach((fixture, index) => {
    const id = fixtureId(fixture, index);
    const expected = fixture?.expected;
    if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
      violations.push({
        fixture_id: id,
        field: 'expected',
        code: 'fixture_expected_required',
        value: null,
      });
      return;
    }

    if (expected.must_not !== undefined && !Array.isArray(expected.must_not)) {
      violations.push({
        fixture_id: id,
        field: 'expected.must_not',
        code: 'fixture_must_not_array_required',
        value: clean(expected.must_not),
      });
      return;
    }

    for (const rawToken of expected.must_not || []) {
      const token = clean(rawToken, 120);
      if (!token || !SUPPORTED_MUST_NOT_TOKEN_SET.has(token)) {
        violations.push({
          fixture_id: id,
          field: 'expected.must_not',
          code: 'fixture_unknown_must_not_token',
          value: token || null,
        });
      }
    }

    if (
      expected.unimplemented_checks !== undefined
      && !Array.isArray(expected.unimplemented_checks)
    ) {
      violations.push({
        fixture_id: id,
        field: 'expected.unimplemented_checks',
        code: 'fixture_unimplemented_checks_array_required',
        value: clean(expected.unimplemented_checks),
      });
      return;
    }

    for (const rawToken of expected.unimplemented_checks || []) {
      const token = clean(rawToken, 120);
      if (!token || !UNIMPLEMENTED_EXPECTATION_TOKEN_SET.has(token)) {
        violations.push({
          fixture_id: id,
          field: 'expected.unimplemented_checks',
          code: 'fixture_unknown_unimplemented_check_token',
          value: token || null,
        });
      }
    }
  });

  return violations;
}

export function collectPatientConversationUnimplementedExpectations(fixtures = []) {
  if (!Array.isArray(fixtures)) return [];
  const blockers = [];
  fixtures.forEach((fixture, index) => {
    const id = fixtureId(fixture, index);
    const expected = fixture?.expected || {};
    for (const rawToken of expected.must_not || []) {
      const token = clean(rawToken, 120);
      if (UNIMPLEMENTED_EXPECTATION_TOKEN_SET.has(token)) {
        blockers.push({
          fixture_id: id,
          field: 'expected.must_not',
          code: 'fixture_unimplemented_expectation',
          value: token,
        });
      }
    }
    for (const rawToken of expected.unimplemented_checks || []) {
      const token = clean(rawToken, 120);
      if (UNIMPLEMENTED_EXPECTATION_TOKEN_SET.has(token)) {
        blockers.push({
          fixture_id: id,
          field: 'expected.unimplemented_checks',
          code: 'fixture_unimplemented_expectation',
          value: token,
        });
      }
    }
  });
  return blockers;
}

export function assertPatientConversationFixtureContract(fixtures = []) {
  const violations = validatePatientConversationFixtureContract(fixtures);
  if (violations.length === 0) return;

  const first = violations[0];
  const details = violations
    .map((violation) => (
      `${violation.fixture_id || 'suite'}:${violation.field}:${violation.value || violation.code}`
    ))
    .join(', ');
  const error = new Error(
    `Contract fixture invalid (${first.code}): ${details}`,
  );
  error.code = 'PATIENT_CONVERSATION_FIXTURE_CONTRACT_INVALID';
  error.violations = violations;
  throw error;
}

export function assertPatientConversationFixtureReleaseReady(fixtures = []) {
  assertPatientConversationFixtureContract(fixtures);
  const blockers = collectPatientConversationUnimplementedExpectations(fixtures);
  if (blockers.length === 0) return;

  const details = blockers
    .map((blocker) => `${blocker.fixture_id}:${blocker.value}`)
    .join(', ');
  const error = new Error(
    `Patient conversation fixture release blocked by unimplemented checks: ${details}`,
  );
  error.code = 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED';
  error.blockers = blockers;
  throw error;
}
