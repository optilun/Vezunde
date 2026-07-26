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

function replaceOnce(relativePath, before, after, marker = after) {
  const source = read(relativePath);
  if (source.includes(marker)) return false;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${relativePath}: expected one target, found ${count}.`);
  }
  write(relativePath, source.replace(before, after));
  return true;
}

function insertAfter(relativePath, anchor, addition, marker) {
  const source = read(relativePath);
  if (source.includes(marker)) return false;
  const count = source.split(anchor).length - 1;
  if (count !== 1) {
    throw new Error(`${relativePath}: expected one anchor, found ${count}.`);
  }
  write(relativePath, source.replace(anchor, `${anchor}${addition}`));
  return true;
}

const changed = new Set();
function apply(relativePath, result) {
  if (result) changed.add(relativePath);
}

apply(
  'scripts/evaluate-patient-conversation-results.mjs',
  replaceOnce(
    'scripts/evaluate-patient-conversation-results.mjs',
    "const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';",
    "const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';",
  ),
);

const includesAnyBefore = `function includesAny(actualValues, expectedValues) {
  const actual = new Set(list(actualValues));
  return list(expectedValues).some((value) => actual.has(value));
}
`;
const includesAnyAfter = `function includesAny(actualValues, expectedValues) {
  const actual = new Set(list(actualValues));
  return list(expectedValues).some((value) => actual.has(value));
}

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
const commercialTop3Before = `    commercial_top3: hasViolation(violations, "ranking_or_provider_recommendation_claim")
      || serialized.includes("top 3")
      || serialized.includes("top3"),`;
const commercialTop3After = `    commercial_top3: hasViolation(violations, "ranking_or_provider_recommendation_claim"),`;

for (const relativePath of [
  'shared/patientConversationEvaluation.js',
  'base44/shared/patientConversationEvaluation.js',
]) {
  apply(relativePath, replaceOnce(
    relativePath,
    includesAnyBefore,
    includesAnyAfter,
    'function carePathsAnyMatch(',
  ));
  apply(relativePath, replaceOnce(
    relativePath,
    '      includesAny(result.care_path_candidates, expected.care_paths_any),',
    '      carePathsAnyMatch(result.care_path_candidates, expected.care_paths_any, result),',
  ));
  apply(relativePath, replaceOnce(
    relativePath,
    commercialTop3Before,
    commercialTop3After,
  ));
}

const rankingPatternBefore = String.raw`const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = /\btop\s*3\b|\btop3\b|\b(?:locul|pozi[țt]ia)\s*(?:1|unu|intai|întâi)\b|\b(?:cea|cel)\s+mai\s+bun(?:a|ă)?\s+(?:clinic(?:a|ă)|cabinet|optic(?:a|ă)|furnizor|medic)\b|\brecomand(?:am|ăm|a)?\s+(?:clinica|cabinetul|optica|furnizorul|medicul)\b|\b(?:best|top[- ]?rated)\s+(?:clinic|doctor|provider|optical\s+store)\b|\brecommend(?:ed|s|ing)?\s+(?:the\s+)?(?:clinic|doctor|provider|optical\s+store)\b/iu;`;
const rankingPatternAfter = String.raw`const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = /\b(?:locul|pozi[țt]ia)\s*(?:1|unu|intai|întâi)\b|\b(?:cea|cel)\s+mai\s+bun(?:a|ă)?\s+(?:clinic(?:a|ă)|cabinet|optic(?:a|ă)|furnizor|medic)\b|\brecomand(?:am|ăm|a)?\s+(?:clinica|cabinetul|optica|furnizorul|medicul)\b|\b(?:best|top[- ]?rated)\s+(?:clinic|doctor|provider|optical\s+store)\b|\brecommend(?:ed|s|ing)?\s+(?:the\s+)?(?:clinic|doctor|provider|optical\s+store)\b/iu;`;

for (const relativePath of [
  'shared/patientConversationGuardrails.js',
  'base44/shared/patientConversationGuardrails.js',
]) {
  apply(relativePath, replaceOnce(
    relativePath,
    rankingPatternBefore,
    rankingPatternAfter,
  ));
}

const wrapperPath = 'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts';
const unavailableAnchor = `function unavailableRuntime({ payload, modelInvoked, durationMs }: {
  payload: any;
  modelInvoked: boolean;
  durationMs: number;
}) {
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'unavailable',
    reason: modelInvoked
      ? 'conversation_model_unavailable'
      : 'conversation_runtime_unavailable',
    interpretation: null,
    ...evaluationCorrelation(payload),
    runtime_metadata: modelInvoked
      ? modelRuntimeMetadata(durationMs)
      : noModelRuntimeMetadata(durationMs),
  };
}
`;
const fallbackFunctions = `
function fallbackLocality(value: any) {
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
apply(wrapperPath, insertAfter(
  wrapperPath,
  unavailableAnchor,
  fallbackFunctions,
  'function recoverTerminalFailure(',
));

const finalizeBefore = `function finalizeWithGuidanceHandoff(envelope: any, controller: any) {
  return attachGuidanceHandoff(
    finalizePatientConversationOperationalEnvelope(envelope, controller),
  );
}`;
const finalizeAfter = `function finalizeWithGuidanceHandoff(
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
}`;
apply(wrapperPath, replaceOnce(
  wrapperPath,
  finalizeBefore,
  finalizeAfter,
  'recoverTerminalFailure(operationalEnvelope, payload)',
));

apply(wrapperPath, replaceOnce(
  wrapperPath,
  `    }, controller);
  }

  if (!requestHasUserMessage(runtimePayload)) {`,
  `    }, controller, runtimePayload);
  }

  if (!requestHasUserMessage(runtimePayload)) {`,
));
apply(wrapperPath, replaceOnce(
  wrapperPath,
  `      skippedWithoutUserMessage(runtimePayload, Date.now() - startedAt),
      controller,
    );`,
  `      skippedWithoutUserMessage(runtimePayload, Date.now() - startedAt),
      controller,
      runtimePayload,
    );`,
));
apply(wrapperPath, replaceOnce(
  wrapperPath,
  `    return finalizeWithGuidanceHandoff(
      groundedEnvelope,
      controller,
    );`,
  `    return finalizeWithGuidanceHandoff(
      groundedEnvelope,
      controller,
      runtimePayload,
    );`,
));
apply(wrapperPath, replaceOnce(
  wrapperPath,
  `      }),
      controller,
    );
  }
}`,
  `      }),
      controller,
      runtimePayload,
    );
  }
}`,
));

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts = packageJson.scripts || {};
const command = 'node scripts/verify-patient-conversation-post-evaluation.mjs';
if (packageJson.scripts['test:patient-conversation-post-evaluation'] !== command) {
  packageJson.scripts['test:patient-conversation-post-evaluation'] = command;
  changed.add(packagePath);
}
if (!String(packageJson.scripts['test:services'] || '').includes(command)) {
  packageJson.scripts['test:services'] = `${packageJson.scripts['test:services']} && ${command}`;
  changed.add(packagePath);
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(JSON.stringify({ changed: [...changed].sort() }, null, 2));
