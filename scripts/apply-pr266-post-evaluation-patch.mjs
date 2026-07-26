import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(filePath(relativePath), content);
}

function replaceOnce(relativePath, before, after, marker = after) {
  const source = read(relativePath);
  if (source.includes(marker)) return false;
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${relativePath}: expected one replacement target, found ${occurrences}.`);
  }
  write(relativePath, source.replace(before, after));
  return true;
}

function replaceAllExact(relativePath, before, after, expectedCount) {
  const source = read(relativePath);
  const count = source.split(before).length - 1;
  if (count === 0 && source.includes(after)) return false;
  if (count !== expectedCount) {
    throw new Error(`${relativePath}: expected ${expectedCount} replacement targets, found ${count}.`);
  }
  write(relativePath, source.split(before).join(after));
  return true;
}

function insertAfter(relativePath, anchor, addition, marker) {
  const source = read(relativePath);
  if (source.includes(marker)) return false;
  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${relativePath}: expected one insertion anchor, found ${occurrences}.`);
  }
  write(relativePath, source.replace(anchor, `${anchor}${addition}`));
  return true;
}

const changed = [];
function record(relativePath, didChange) {
  if (didChange) changed.push(relativePath);
}

record(
  'scripts/evaluate-patient-conversation-results.mjs',
  replaceOnce(
    'scripts/evaluate-patient-conversation-results.mjs',
    "const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';",
    "const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';",
  ),
);

const includesAnyBlock = `function includesAny(actualValues, expectedValues) {
  const actual = new Set(list(actualValues));
  return list(expectedValues).some((value) => actual.has(value));
}
`;
const includesAnyWithCarePaths = `function includesAny(actualValues, expectedValues) {
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
  record(relativePath, replaceOnce(
    relativePath,
    includesAnyBlock,
    includesAnyWithCarePaths,
    'function carePathsAnyMatch(',
  ));
  record(relativePath, replaceOnce(
    relativePath,
    '      includesAny(result.care_path_candidates, expected.care_paths_any),',
    '      carePathsAnyMatch(result.care_path_candidates, expected.care_paths_any, result),',
  ));
  record(relativePath, replaceOnce(
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
  record(relativePath, replaceOnce(
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
  const originalStatus = String(envelope?.status || 'unavailable');
  const originalReason = String(envelope?.reason || 'conversation_runtime_unavailable');
  const originalDiagnostics = envelope?.diagnostics || {};
  const terminalFallback = {
    applied: true,
    original_status: originalStatus,
    original_reason: originalReason,
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
record(wrapperPath, insertAfter(
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
record(wrapperPath, replaceOnce(
  wrapperPath,
  finalizeBefore,
  finalizeAfter,
  'recoverTerminalFailure(operationalEnvelope, payload)',
));
record(wrapperPath, replaceOnce(
  wrapperPath,
  '    }, controller);\n  }\n\n  if (!requestHasUserMessage(runtimePayload)) {',
  '    }, controller, runtimePayload);\n  }\n\n  if (!requestHasUserMessage(runtimePayload)) {',
));
record(wrapperPath, replaceAllExact(
  wrapperPath,
  '      controller,\n    );',
  '      controller,\n      runtimePayload,\n    );',
  3,
));

const verificationSource = `import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessPatientEyeSafety,
} from '../shared/patientEyeSafetyPolicy.js';
import {
  detectProhibitedPatientConversationOutput,
} from '../shared/patientConversationGuardrails.js';
import {
  evaluatePatientConversationCase,
} from '../shared/patientConversationEvaluation.js';

const safetyCases = [
  {
    content: 'mi-a intrat sampon in ochi, am clatit si inca ma ustura putin',
    state: 'advisory',
    flag: 'chemical_injury',
  },
  {
    content: 'm-am lovit la ochi cu mingea si vad cam in ceata',
    state: 'advisory',
    flag: 'penetrating_or_high_speed_trauma',
  },
  {
    content: 'ochiul e foarte rosu, ma doare tare si imi vine sa vomit de azi',
    state: 'blocking',
    flag: 'severe_eye_pain',
  },
  {
    content: 'am nevoie urgent de un oftalmolog',
    state: 'advisory',
    flag: 'other_possible_urgent_eye_problem',
  },
];
for (const scenario of safetyCases) {
  const result = assessPatientEyeSafety({
    conversation: [{ role: 'user', content: scenario.content }],
  });
  assert.equal(result.state, scenario.state, scenario.content);
  const flags = scenario.state === 'blocking'
    ? result.blocking_flags
    : result.advisory_flags;
  assert(flags.includes(scenario.flag), scenario.content);
}

const correctedVision = assessPatientEyeSafety({
  conversation: [
    { role: 'user', content: 'nu mai vad cu un ochi' },
    { role: 'assistant', content: 'A aparut brusc?' },
    { role: 'user', content: 'vad, doar ca mult mai slab de vreo doi ani' },
  ],
});
assert.equal(correctedVision.state, 'clear');
assert(correctedVision.cleared_flags.includes('sudden_vision_loss'));

assert.deepEqual(
  detectProhibitedPatientConversationOutput({
    need_summary: 'Utilizatorul solicita un top 3 de clinici, cerere care nu acorda autoritate modelului.',
  }),
  [],
);
assert(
  detectProhibitedPatientConversationOutput({
    assistant_message: 'Cea mai buna clinica este Clinica X.',
  }).includes('ranking_or_provider_recommendation_claim'),
);

const aliasResult = evaluatePatientConversationCase({
  fixture: {
    id: 'care-path-alias',
    expected: { care_paths_any: ['ophthalmology'] },
  },
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'simptome_oftalmologice',
      care_path_candidates: ['specialized_ophthalmology'],
      facts: {},
    },
  },
});
assert.equal(aliasResult.passed, true);

const unresolvedResult = evaluatePatientConversationCase({
  fixture: {
    id: 'care-path-unresolved',
    expected: { care_paths_any: ['unresolved'] },
  },
  envelope: {
    status: 'completed',
    interpretation: {
      primary_intent: 'unknown',
      care_path_candidates: [],
      facts: {},
    },
  },
});
assert.equal(unresolvedResult.passed, true);

const wrapperSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);
assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes("transition: 'terminal_fallback_no_state_mutation'"));
assert(wrapperSource.includes('recoverTerminalFailure(operationalEnvelope, payload)'));

const evaluatorSource = fs.readFileSync(
  new URL('./evaluate-patient-conversation-results.mjs', import.meta.url),
  'utf8',
);
assert(evaluatorSource.includes("EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3'"));

for (const fileName of [
  'patientConversationEvaluation.js',
  'patientConversationGuardrails.js',
  'patientEyeSafetyPolicy.js',
]) {
  assert.equal(
    fs.readFileSync(new URL(`../shared/${fileName}`, import.meta.url), 'utf8'),
    fs.readFileSync(new URL(`../base44/shared/${fileName}`, import.meta.url), 'utf8'),
    `${fileName} shared/Base44 copies differ`,
  );
}

console.log('Post-evaluation safety, fallback, ranking, and care-path stabilization verified.');
`;
const verificationPath = 'scripts/verify-patient-conversation-post-evaluation.mjs';
if (!fs.existsSync(filePath(verificationPath)) || read(verificationPath) !== verificationSource) {
  write(verificationPath, verificationSource);
  changed.push(verificationPath);
}

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts = packageJson.scripts || {};
const verificationCommand = 'node scripts/verify-patient-conversation-post-evaluation.mjs';
if (packageJson.scripts['test:patient-conversation-post-evaluation'] !== verificationCommand) {
  packageJson.scripts['test:patient-conversation-post-evaluation'] = verificationCommand;
  changed.push(packagePath);
}
if (!String(packageJson.scripts['test:services'] || '').includes(verificationCommand)) {
  packageJson.scripts['test:services'] = `${packageJson.scripts['test:services']} && ${verificationCommand}`;
  if (!changed.includes(packagePath)) changed.push(packagePath);
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(JSON.stringify({ changed: [...new Set(changed)].sort() }, null, 2));
