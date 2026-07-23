export const PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS = Object.freeze([
  'search_providers',
  'show_emergency_guidance',
  'emergency_interruption',
  'commercial_top3',
  'provider_recommendation',
  'forbidden_output_fields',
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

const SUPPORTED_MUST_NOT_TOKEN_SET = new Set(
  PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS,
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
  });

  return violations;
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
