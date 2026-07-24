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
  'forget_previous_need',
]);

export const PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS = Object.freeze([]);

export const PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS = Object.freeze([
  'primary_intent',
  'care_paths_any',
  'service_keys_all',
  'service_keys_any',
  'provider_types_any',
  'next_action',
  'urgency',
  'must_ask',
  'required_facts',
  'forbidden_facts',
  'must_include_guidance',
  'specialist_summary_must_include',
  'must_not',
  'unimplemented_checks',
]);

export const PATIENT_CONVERSATION_SUPPORTED_FACT_EXPECTATION_KEYS = Object.freeze([
  'for_whom',
  'age_group',
  'locality_city',
  'locality_area',
  'duration',
  'timing_preference',
  'symptom_onset',
  'symptom_duration',
  'symptom_pattern',
  'desired_timing',
  'contact_lens_experience',
  'prescription_status',
  'investigation_reference_text',
  'repair_details',
  'user_constraints',
]);

const SUPPORTED_MUST_NOT_TOKEN_SET = new Set(
  PATIENT_CONVERSATION_SUPPORTED_MUST_NOT_TOKENS,
);
const UNIMPLEMENTED_EXPECTATION_TOKEN_SET = new Set(
  PATIENT_CONVERSATION_UNIMPLEMENTED_EXPECTATION_TOKENS,
);
const SUPPORTED_EXPECTATION_FIELD_SET = new Set(
  PATIENT_CONVERSATION_SUPPORTED_EXPECTATION_FIELDS,
);
const SUPPORTED_FACT_EXPECTATION_KEY_SET = new Set(
  PATIENT_CONVERSATION_SUPPORTED_FACT_EXPECTATION_KEYS,
);
const NEXT_ACTION_VALUES = new Set([
  'ask_clarifying_question',
  'ask_locality',
  'confirm_understanding',
  'search_providers',
  'prepare_specialist_message',
  'show_emergency_guidance',
  'out_of_scope',
]);
const URGENCY_VALUES = new Set(['none', 'possible', 'confirmed']);
const ASKING_ACTIONS = new Set([
  'ask_clarifying_question',
  'ask_locality',
  'confirm_understanding',
]);
const ARRAY_EXPECTATION_FIELDS = Object.freeze([
  'care_paths_any',
  'service_keys_all',
  'service_keys_any',
  'provider_types_any',
  'forbidden_facts',
  'must_include_guidance',
  'specialist_summary_must_include',
]);
const USER_GROUNDED_EXPECTATION_KEYS = new Set([
  'duration',
  'timing_preference',
  'symptom_onset',
  'symptom_duration',
  'symptom_pattern',
  'desired_timing',
]);

function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalized(value) {
  return clean(value, 2000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO')
    .replace(/\s+/g, ' ')
    .trim();
}

function fixtureId(fixture, index) {
  return clean(fixture?.id, 120) || `fixture-index-${index}`;
}

function userText(fixture) {
  return (Array.isArray(fixture?.conversation) ? fixture.conversation : [])
    .filter((turn) => turn?.role === 'user')
    .map((turn) => clean(turn?.content, 1600))
    .filter(Boolean)
    .join(' ');
}

function violation(fixtureIdValue, field, code, value = null) {
  return {
    fixture_id: fixtureIdValue,
    field,
    code,
    value,
  };
}

export function validatePatientConversationFixtureContract(fixtures = []) {
  if (!Array.isArray(fixtures)) {
    return [violation(null, 'cases', 'fixture_cases_required')];
  }

  const violations = [];
  fixtures.forEach((fixture, index) => {
    const id = fixtureId(fixture, index);
    const expected = fixture?.expected;
    if (!isPlainObject(expected)) {
      violations.push(violation(id, 'expected', 'fixture_expected_required'));
      return;
    }

    for (const field of Object.keys(expected)) {
      if (!SUPPORTED_EXPECTATION_FIELD_SET.has(field)) {
        violations.push(violation(
          id,
          `expected.${field}`,
          'fixture_unknown_expectation_field',
          field,
        ));
      }
    }

    for (const field of ARRAY_EXPECTATION_FIELDS) {
      if (expected[field] !== undefined && !Array.isArray(expected[field])) {
        violations.push(violation(
          id,
          `expected.${field}`,
          'fixture_expectation_array_required',
          clean(expected[field]),
        ));
      }
    }

    if (expected.must_not !== undefined && !Array.isArray(expected.must_not)) {
      violations.push(violation(
        id,
        'expected.must_not',
        'fixture_must_not_array_required',
        clean(expected.must_not),
      ));
    } else {
      for (const rawToken of expected.must_not || []) {
        const token = clean(rawToken, 120);
        if (!token || !SUPPORTED_MUST_NOT_TOKEN_SET.has(token)) {
          violations.push(violation(
            id,
            'expected.must_not',
            'fixture_unknown_must_not_token',
            token || null,
          ));
        }
      }
    }

    if (
      expected.unimplemented_checks !== undefined
      && !Array.isArray(expected.unimplemented_checks)
    ) {
      violations.push(violation(
        id,
        'expected.unimplemented_checks',
        'fixture_unimplemented_checks_array_required',
        clean(expected.unimplemented_checks),
      ));
    } else {
      for (const rawToken of expected.unimplemented_checks || []) {
        const token = clean(rawToken, 120);
        if (!token || !UNIMPLEMENTED_EXPECTATION_TOKEN_SET.has(token)) {
          violations.push(violation(
            id,
            'expected.unimplemented_checks',
            'fixture_unknown_unimplemented_check_token',
            token || null,
          ));
        }
      }
    }

    if (expected.required_facts !== undefined && !isPlainObject(expected.required_facts)) {
      violations.push(violation(
        id,
        'expected.required_facts',
        'fixture_required_facts_object_required',
      ));
    }
    if (expected.forbidden_facts !== undefined && !Array.isArray(expected.forbidden_facts)) {
      violations.push(violation(
        id,
        'expected.forbidden_facts',
        'fixture_forbidden_facts_array_required',
      ));
    }

    for (const factKey of Object.keys(isPlainObject(expected.required_facts)
      ? expected.required_facts
      : {})) {
      if (!SUPPORTED_FACT_EXPECTATION_KEY_SET.has(factKey)) {
        violations.push(violation(
          id,
          `expected.required_facts.${factKey}`,
          'fixture_unknown_fact_expectation_key',
          factKey,
        ));
        continue;
      }
      const expectedValue = expected.required_facts[factKey];
      if (
        USER_GROUNDED_EXPECTATION_KEYS.has(factKey)
        && typeof expectedValue === 'string'
        && !normalized(userText(fixture)).includes(normalized(expectedValue))
      ) {
        violations.push(violation(
          id,
          `expected.required_facts.${factKey}`,
          'fixture_fact_expectation_not_user_grounded',
          clean(expectedValue, 240),
        ));
      }
    }

    for (const rawFactKey of expected.forbidden_facts || []) {
      const factKey = clean(rawFactKey, 120);
      if (!SUPPORTED_FACT_EXPECTATION_KEY_SET.has(factKey)) {
        violations.push(violation(
          id,
          'expected.forbidden_facts',
          'fixture_unknown_fact_expectation_key',
          factKey || null,
        ));
      }
    }

    if (expected.next_action !== undefined && !NEXT_ACTION_VALUES.has(expected.next_action)) {
      violations.push(violation(
        id,
        'expected.next_action',
        'fixture_unknown_next_action',
        clean(expected.next_action),
      ));
    }
    if (expected.urgency !== undefined && !URGENCY_VALUES.has(expected.urgency)) {
      violations.push(violation(
        id,
        'expected.urgency',
        'fixture_unknown_urgency',
        clean(expected.urgency),
      ));
    }
    if (expected.must_ask !== undefined && typeof expected.must_ask !== 'boolean') {
      violations.push(violation(
        id,
        'expected.must_ask',
        'fixture_must_ask_boolean_required',
        clean(expected.must_ask),
      ));
    }

    if (
      typeof expected.must_ask === 'boolean'
      && NEXT_ACTION_VALUES.has(expected.next_action)
      && ASKING_ACTIONS.has(expected.next_action) !== expected.must_ask
    ) {
      violations.push(violation(
        id,
        'expected.must_ask',
        'fixture_must_ask_action_contradiction',
        expected.next_action,
      ));
    }
    if (expected.urgency === 'confirmed' && expected.next_action !== 'show_emergency_guidance') {
      violations.push(violation(
        id,
        'expected.next_action',
        'fixture_confirmed_urgency_action_contradiction',
        clean(expected.next_action),
      ));
    }
    if (expected.urgency === 'possible' && expected.next_action !== 'ask_clarifying_question') {
      violations.push(violation(
        id,
        'expected.next_action',
        'fixture_possible_urgency_action_contradiction',
        clean(expected.next_action),
      ));
    }

    const mustNot = new Set(Array.isArray(expected.must_not) ? expected.must_not : []);
    if (expected.next_action === 'search_providers' && mustNot.has('search_providers')) {
      violations.push(violation(
        id,
        'expected.must_not',
        'fixture_action_forbidden_contradiction',
        'search_providers',
      ));
    }
    if (
      expected.next_action === 'show_emergency_guidance'
      && mustNot.has('show_emergency_guidance')
    ) {
      violations.push(violation(
        id,
        'expected.must_not',
        'fixture_action_forbidden_contradiction',
        'show_emergency_guidance',
      ));
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
        blockers.push(violation(
          id,
          'expected.must_not',
          'fixture_unimplemented_expectation',
          token,
        ));
      }
    }
    for (const rawToken of expected.unimplemented_checks || []) {
      const token = clean(rawToken, 120);
      if (UNIMPLEMENTED_EXPECTATION_TOKEN_SET.has(token)) {
        blockers.push(violation(
          id,
          'expected.unimplemented_checks',
          'fixture_unimplemented_expectation',
          token,
        ));
      }
    }
    if (
      Array.isArray(expected.specialist_summary_must_include)
      && expected.specialist_summary_must_include.some((value) => clean(value, 240))
    ) {
      blockers.push(violation(
        id,
        'expected.specialist_summary_must_include',
        'fixture_unsupported_runtime_expectation',
        'specialist_summary',
      ));
    }
  });
  return blockers;
}

export function assertPatientConversationFixtureContract(fixtures = []) {
  const violations = validatePatientConversationFixtureContract(fixtures);
  if (violations.length === 0) return;

  const first = violations[0];
  const details = violations
    .map((item) => (
      `${item.fixture_id || 'suite'}:${item.field}:${item.value || item.code}`
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
    `Patient conversation fixture release blocked by unsupported expectations: ${details}`,
  );
  error.code = 'PATIENT_CONVERSATION_FIXTURE_RELEASE_BLOCKED';
  error.blockers = blockers;
  throw error;
}
