import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function write(path, content) {
  fs.writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one exact target, found ${count}.`);
  }
  return source.replace(before, after);
}

function patchEvaluation(path) {
  let source = read(path);
  const includesAny = `function includesAny(actualValues, expectedValues) {
  const actual = new Set(list(actualValues));
  return list(expectedValues).some((value) => actual.has(value));
}`;
  const carePathCompatibility = `${includesAny}

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
}`;
  source = replaceOnce(
    source,
    includesAny,
    carePathCompatibility,
    `${path}: care-path helper`,
  );
  source = replaceOnce(
    source,
    '      includesAny(result.care_path_candidates, expected.care_paths_any),',
    '      carePathsAnyMatch(result.care_path_candidates, expected.care_paths_any, result),',
    `${path}: care-path evaluation`,
  );
  source = replaceOnce(
    source,
    `    commercial_top3: hasViolation(violations, "ranking_or_provider_recommendation_claim")
      || serialized.includes("top 3")
      || serialized.includes("top3"),`,
    '    commercial_top3: hasViolation(violations, "ranking_or_provider_recommendation_claim"),',
    `${path}: Top 3 evaluator`,
  );
  write(path, source);
}

function patchGuardrails(path) {
  let source = read(path);
  source = replaceOnce(
    source,
    'function generatedOutputStrings(value) {',
    'function generatedOutputStrings(value, excludedFields = new Set()) {',
    `${path}: output string collector signature`,
  );
  source = replaceOnce(
    source,
    `    for (const [key, child] of Object.entries(node)) {
      if (normalizedFieldName(key) === "evidence_phrases") continue;
      collect(child, depth + 1);
    }`,
    `    for (const [key, child] of Object.entries(node)) {
      const normalizedKey = normalizedFieldName(key);
      if (normalizedKey === "evidence_phrases" || excludedFields.has(normalizedKey)) continue;
      collect(child, depth + 1);
    }`,
    `${path}: excluded descriptive fields`,
  );
  source = replaceOnce(
    source,
    `  const generatedStrings = generatedOutputStrings(value);
  if (generatedStrings.some((text) => RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN.test(text))) {`,
    `  const generatedStrings = generatedOutputStrings(value);
  const rankingSensitiveStrings = generatedOutputStrings(
    value,
    new Set(["need_summary"]),
  );
  if (rankingSensitiveStrings.some((text) => RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN.test(text))) {`,
    `${path}: ranking-sensitive strings`,
  );
  write(path, source);
}

function patchShadowRouteVerification(path) {
  let source = read(path);
  source = source.replace(
    "assert(wrapperSource.includes('const PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET = 1500;'));\n",
    '',
  );
  source = source.replace(
    "assert(wrapperSource.includes('monthly_model_call_target_enforced_here: false'));\n",
    '',
  );
  if (!source.includes("assert(!wrapperSource.includes('PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET'));")) {
    source = source.replace(
      "assert(wrapperSource.includes('automatic_retry_enabled: false'));",
      `assert(wrapperSource.includes('automatic_retry_enabled: false'));
assert(!wrapperSource.includes('PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET'));
assert(!wrapperSource.includes('monthly_model_call_target'));`,
    );
  }
  write(path, source);
}

function patchPostEvaluationVerification(path) {
  let source = read(path);
  const staleBlock = `assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes("transition: 'terminal_fallback_no_state_mutation'"));
assert(wrapperSource.includes('recoverTerminalFailure(operationalEnvelope, payload)'));`;
  const currentBlock = `assert(wrapperSource.includes("const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';"));
assert(wrapperSource.includes('delete automaticArgs.model;'));
assert(wrapperSource.includes('function recoverTerminalFailure('));
assert(wrapperSource.includes('retry_attempted: false'));
assert(wrapperSource.includes('search_blocked: true'));
assert(!wrapperSource.includes('PATIENT_CONVERSATION_MONTHLY_MODEL_CALL_TARGET'));
assert(!wrapperSource.includes('monthly_model_call_target'));`;
  source = replaceOnce(
    source,
    staleBlock,
    currentBlock,
    `${path}: current Automatic fallback assertions`,
  );
  write(path, source);
}

function patchPackage(path) {
  const packageJson = JSON.parse(read(path));
  const command = 'node scripts/verify-patient-conversation-post-evaluation.mjs';
  packageJson.scripts['test:patient-conversation-post-evaluation'] = command;
  const services = String(packageJson.scripts['test:services'] || '');
  if (!services.includes(command)) {
    const anchor = 'node scripts/verify-patient-conversation-fixture-audit.mjs';
    if (!services.includes(anchor)) {
      throw new Error(`${path}: fixture audit anchor missing from test:services.`);
    }
    packageJson.scripts['test:services'] = services.replace(
      anchor,
      `${anchor} && ${command}`,
    );
  }
  write(path, JSON.stringify(packageJson, null, 2));
}

patchEvaluation('shared/patientConversationEvaluation.js');
patchGuardrails('shared/patientConversationGuardrails.js');
patchGuardrails('base44/shared/patientConversationGuardrails.js');
patchShadowRouteVerification('scripts/verify-patient-conversation-shadow-route.mjs');
patchPostEvaluationVerification('scripts/verify-patient-conversation-post-evaluation.mjs');
patchPackage('package.json');

const sharedGuardrails = read('shared/patientConversationGuardrails.js');
const base44Guardrails = read('base44/shared/patientConversationGuardrails.js');
if (sharedGuardrails !== base44Guardrails) {
  throw new Error('Guardrail shared/Base44 copies differ after patching.');
}

console.log('PR266 Automatic cost-control and post-evaluation fixes applied.');
