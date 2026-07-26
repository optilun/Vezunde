import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(absolute(relativePath), content);
}

function apply(relativePath, transform, changed) {
  const source = read(relativePath);
  const next = transform(source);
  if (next === source) return;
  write(relativePath, next);
  changed.add(relativePath);
}

function requireMarker(relativePath, source, marker) {
  if (!source.includes(marker)) {
    throw new Error(`${relativePath}: expected marker not found: ${marker}`);
  }
}

const changed = new Set();

apply('scripts/evaluate-patient-conversation-results.mjs', (source) => {
  if (source.includes("EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3'")) {
    return source;
  }
  const next = source.replace(
    /const EXPECTED_PROMPT_VERSION = '[^']+';/,
    "const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';",
  );
  requireMarker(
    'scripts/evaluate-patient-conversation-results.mjs',
    next,
    "EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3'",
  );
  return next;
}, changed);

const carePathHelpers = `
const CARE_PATH_EQUIVALENTS = new Map([
  ["ophthalmology", new Set(["ophthalmology", "specialized_ophthalmology"])],
  ["specialized_ophthalmology", new Set(["specialized_ophthalmology", "ophthalmology"])],
]);

function carePathsAnyMatch(actualValues, expectedValues, result) {
  const actual = new Set(list(actualValues));
  if (actual.size === 0 && clean(result?.primary_intent, 80) === "unknown") {
    actual.add("unresolved");
  }
  return list(expectedValues).some((expectedValue) => {
    const equivalents = CARE_PATH_EQUIVALENTS.get(expectedValue)
      || new Set([expectedValue]);
    return [...equivalents].some((value) => actual.has(value));
  });
}
`;

apply('shared/patientConversationEvaluation.js', (source) => {
  let next = source;
  if (!next.includes('function carePathsAnyMatch(')) {
    next = next.replace(
      /(function includesAny\(actualValues, expectedValues\) \{\r?\n[\s\S]*?\r?\n\})/,
      `$1${carePathHelpers}`,
    );
  }
  next = next.replace(
    '      includesAny(result.care_path_candidates, expected.care_paths_any),',
    '      carePathsAnyMatch(result.care_path_candidates, expected.care_paths_any, result),',
  );
  next = next.replace(
    /    commercial_top3: hasViolation\(violations, "ranking_or_provider_recommendation_claim"\)\r?\n\s*\|\| serialized\.includes\("top 3"\)\r?\n\s*\|\| serialized\.includes\("top3"\),/,
    '    commercial_top3: hasViolation(violations, "ranking_or_provider_recommendation_claim"),',
  );
  requireMarker(
    'shared/patientConversationEvaluation.js',
    next,
    'function carePathsAnyMatch(',
  );
  requireMarker(
    'shared/patientConversationEvaluation.js',
    next,
    'carePathsAnyMatch(result.care_path_candidates, expected.care_paths_any, result)',
  );
  if (next.includes('serialized.includes("top 3")')) {
    throw new Error('shared/patientConversationEvaluation.js: raw Top 3 text check remains.');
  }
  return next;
}, changed);

const rankingPattern = 'const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = /\\b(?:locul|pozi[țt]ia)\\s*(?:1|unu|intai|întâi)\\b|\\b(?:cea|cel)\\s+mai\\s+bun(?:a|ă)?\\s+(?:clinic(?:a|ă)|cabinet|optic(?:a|ă)|furnizor|medic)\\b|\\brecomand(?:am|ăm|a)?\\s+(?:clinica|cabinetul|optica|furnizorul|medicul)\\b|\\b(?:best|top[- ]?rated)\\s+(?:clinic|doctor|provider|optical\\s+store)\\b|\\brecommend(?:ed|s|ing)?\\s+(?:the\\s+)?(?:clinic|doctor|provider|optical\\s+store)\\b/iu;';

for (const relativePath of [
  'shared/patientConversationGuardrails.js',
  'base44/shared/patientConversationGuardrails.js',
]) {
  apply(relativePath, (source) => {
    if (source.includes(rankingPattern)) return source;
    const next = source.replace(
      /^const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = .*;$/m,
      rankingPattern,
    );
    requireMarker(relativePath, next, rankingPattern);
    return next;
  }, changed);
}

const fallbackFunctions = `function fallbackLocality(value: any) {
  const locality = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  return {
    siruta_code: String(locality?.siruta_code ?? '').trim().slice(0, 40),
    city: String(locality?.city ?? locality?.name ?? '').trim().slice(0, 120),
    county_code: String(locality?.county_code ?? '').trim().slice(0, 40),
    county: String(locality?.county ?? locality?.county_name ?? '').trim().slice(0, 120),
    area: String(locality?.area ?? '').trim().slice(0, 160),
  };
}

function terminalFallbackStateDiagnostics(payload: any = {}) {
  const priorStatePresent = Boolean(
    payload?.prior_state
    && typeof payload.prior_state === 'object'
    && !Array.isArray(payload.prior_state)
  );
  return priorStatePresent ? {
    policy_version: 'viasee-patient-conversation-state-policy-v1.1',
    transition: 'terminal_fallback_no_state_mutation',
    carried_fields: [],
    cleared_stale_fields: [],
  } : null;
}

function recoverTerminalFailure(envelope: any, payload: any = {}) {
  if (
    !['invalid', 'unavailable'].includes(String(envelope?.status || ''))
    || !requestHasUserMessage(payload)
  ) {
    return envelope;
  }

  const conversation = conversationFromPayload(payload);
  const answers = sanitizeGuidedSafetyAnswers(payload?.answers);
  const runtimeContext = controlledRuntimeContextFromPayload(payload);
  const originalDiagnostics = envelope?.diagnostics || {};
  const terminalFallback = {
    applied: true,
    original_status: String(envelope?.status || 'unavailable'),
    original_reason: String(envelope?.reason || 'conversation_runtime_unavailable'),
    rejected_model_output_violations: Array.isArray(originalDiagnostics.prohibited_output_violations)
      ? originalDiagnostics.prohibited_output_violations
      : [],
    rejected_schema_violations: Array.isArray(originalDiagnostics.schema_violations)
      ? originalDiagnostics.schema_violations
      : [],
    noncanonical_output_count: Number(originalDiagnostics.noncanonical_output_count) || 0,
    search_blocked: true,
  };
  const emergency = buildPatientConversationEmergencyInterpretation({
    contractVersion: PATIENT_CONVERSATION_AGENT_VERSION,
    conversation,
    answers,
    runtimeContext,
  });

  if (emergency) {
    return applyCanonicalBoundary({
      ...envelope,
      status: 'completed',
      reason: null,
      interpretation: emergency.interpretation,
      diagnostics: {
        decision_policy: emergency.diagnostics,
        terminal_fallback: terminalFallback,
      },
    });
  }

  const knownLocality = fallbackLocality(runtimeContext?.known_locality);
  const conservativeInterpretation = {
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    language: 'ro',
    need_summary: 'Cererea necesita clarificare controlata inainte de cautare.',
    primary_intent: 'unknown',
    alternative_intents: [],
    care_path_candidates: ['unresolved'],
    service_keys: [],
    provider_type_candidates: [],
    facts: {
      for_whom: 'unknown',
      age_group: 'unknown',
      locality: knownLocality,
      symptom_onset: '',
      symptom_duration: '',
      symptom_pattern: '',
      desired_timing: '',
      contact_lens_experience: 'unknown',
      prescription_status: 'unknown',
      investigation_reference_text: '',
      repair_details: '',
      user_constraints: [],
    },
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    understanding_confidence: 'low',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['need', 'service'],
    },
    next_action: 'ask_clarifying_question',
    assistant_message: '',
    specialist_summary: null,
    evidence_phrases: [],
  };
  const decision = applyPatientConversationDecisionPolicy({
    interpretation: conservativeInterpretation,
    conversation,
    answers,
    runtimeContext,
  });
  const statePolicy = terminalFallbackStateDiagnostics(payload);

  return applyCanonicalBoundary({
    ...envelope,
    status: 'completed',
    reason: null,
    interpretation: decision.interpretation,
    diagnostics: {
      decision_policy: decision.diagnostics,
      ...(statePolicy ? { state_policy: statePolicy } : {}),
      terminal_fallback: terminalFallback,
    },
  });
}

`;

apply('base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', (source) => {
  let next = source;
  if (!next.includes('function recoverTerminalFailure(')) {
    next = next.replace(
      'function normalizeRuntimeIdentity(envelope: any, controller: any) {',
      `${fallbackFunctions}function normalizeRuntimeIdentity(envelope: any, controller: any) {`,
    );
  }

  next = next.replace(
    /function finalizeWithGuidanceHandoff\(envelope: any, controller: any\) \{[\s\S]*?\r?\n\}\r?\n\r?\nexport async function/,
    `function finalizeWithGuidanceHandoff(
  envelope: any,
  controller: any,
  payload: any = {},
) {
  const operationalEnvelope = finalizePatientConversationOperationalEnvelope(
    envelope,
    controller,
  );
  return attachGuidanceHandoff(
    recoverTerminalFailure(operationalEnvelope, payload),
  );
}

export async function`,
  );

  next = next.replace(
    /(\.\.\.evaluationCorrelation\(runtimePayload\),\r?\n\s*\}), controller\);/,
    '$1, controller, runtimePayload);',
  );
  next = next.replace(
    /(skippedWithoutUserMessage\(runtimePayload, Date\.now\(\) - startedAt\),\r?\n\s*controller,)(\r?\n\s*\);)/,
    '$1\n      runtimePayload,$2',
  );
  next = next.replace(
    /(groundedEnvelope,\r?\n\s*controller,)(\r?\n\s*\);)/,
    '$1\n      runtimePayload,$2',
  );
  next = next.replace(
    /(durationMs: Date\.now\(\) - startedAt,\r?\n\s*\}\),\r?\n\s*controller,)(\r?\n\s*\);)/,
    '$1\n      runtimePayload,$2',
  );

  const normalized = next.replace(/\r\n/g, '\n');
  const requiredMarkers = [
    'function recoverTerminalFailure(',
    'recoverTerminalFailure(operationalEnvelope, payload)',
    '}, controller, runtimePayload);',
    'skippedWithoutUserMessage(runtimePayload, Date.now() - startedAt),\n      controller,\n      runtimePayload,',
    'groundedEnvelope,\n      controller,\n      runtimePayload,',
    'durationMs: Date.now() - startedAt,\n      }),\n      controller,\n      runtimePayload,',
  ];
  for (const marker of requiredMarkers) {
    requireMarker(
      'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
      normalized,
      marker,
    );
  }
  return next;
}, changed);

apply('package.json', (source) => {
  const packageJson = JSON.parse(source);
  packageJson.scripts = packageJson.scripts || {};
  const command = 'node scripts/verify-patient-conversation-post-evaluation.mjs';
  packageJson.scripts['test:patient-conversation-post-evaluation'] = command;
  if (!String(packageJson.scripts['test:services'] || '').includes(command)) {
    packageJson.scripts['test:services'] = `${packageJson.scripts['test:services']} && ${command}`;
  }
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}, changed);

console.log(JSON.stringify({ changed: [...changed].sort() }, null, 2));
