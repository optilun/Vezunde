import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPatientSafetyAssessment,
  deterministicSafetyFlagsFromText,
  guidedSafetyFlagsFromAnswers,
} from "../base44/shared/patientSafety.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
let scenarioCount = 0;

function scenario(name, verify) {
  scenarioCount += 1;
  try {
    verify();
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
const questionOnlyStart = entry.indexOf("function selectPatientGuidanceQuestion");
const questionOnlyEnd = entry.indexOf("async function interpretPatientNeed", questionOnlyStart);
const questionOnlyBlock = entry.slice(questionOnlyStart, questionOnlyEnd);

scenario("question-only mode ignores browser deterministic authority", () => {
  assert.ok(questionOnlyStart >= 0 && questionOnlyEnd > questionOnlyStart);
  assert.doesNotMatch(questionOnlyBlock, /payload\.deterministic_intent/);
  assert.doesNotMatch(questionOnlyBlock, /payload\.deterministic_service_keys/);
  assert.doesNotMatch(questionOnlyBlock, /payload\.deterministic_facts/);
  assert.doesNotMatch(questionOnlyBlock, /payload\.deterministic_safety_state/);
  assert.doesNotMatch(questionOnlyBlock, /payload\.explicit_primary_intent/);
  assert.match(questionOnlyBlock, /deterministicIntent: 'unknown'/);
  assert.match(questionOnlyBlock, /deterministicFacts: \{\}/);
});

scenario("question-only services come from server semantics and controlled answers", () => {
  assert.match(entry, /searchText,\s*semantic\.service_keys,\s*\)\);/s);
  assert.match(questionOnlyBlock, /explicitConfirmedServiceKeys: confirmedServiceKeysFromAnswers\(guidedAnswers\)/);
  assert.doesNotMatch(questionOnlyBlock, /payload\.explicit_confirmed_service_keys/);
});

scenario("guided answers must exist in controlled history", () => {
  const helperStart = entry.indexOf("function controlledGuidedAnswers");
  const helperEnd = entry.indexOf("function controlledCategoryIntent", helperStart);
  const helper = entry.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(helper, /const history = new Set\(questionHistory\)/);
  assert.match(helper, /!history\.has\(questionKey\)/);
  assert.match(helper, /canonicalAnswerValue/);
});

scenario("wizard intent comes only from controlled category and guided answers", () => {
  const intentStart = entry.indexOf("function controlledCategoryIntent");
  const intentEnd = entry.indexOf("function confirmedServiceKeysFromAnswers", intentStart);
  const intentBlock = entry.slice(intentStart, intentEnd);
  assert.ok(intentStart >= 0 && intentEnd > intentStart);
  assert.match(intentBlock, /history\.has\('categorie'\)/);
  assert.match(intentBlock, /question_key\) === 'categorie'/);
  assert.match(intentBlock, /PATIENT_GUIDANCE_INTENTS\.has\(intent\)/);
  assert.match(intentBlock, /routine_vs_symptom === 'symptom'/);
  assert.match(intentBlock, /optical_product_type === 'contact_lenses'/);
  assert.match(questionOnlyBlock, /explicitPrimaryIntent: controlledIntentFromAnswers\(payload, guidedAnswers\)/);
  assert.doesNotMatch(intentBlock, /explicit_primary_intent/);
});

scenario("legacy question keys and values are canonicalized", () => {
  assert.match(entry, /legacy_question_keys/);
  assert.match(entry, /camp_vizual: 'visual_field_analyzer'/);
  assert.match(entry, /sub_3_ani: 'under_3'/);
  assert.match(entry, /rama_rupta: 'broken_frame'/);
  assert.match(entry, /da: 'first_time'/);
});

scenario("server safety assessment overrides browser claims", () => {
  assert.match(questionOnlyBlock, /serverQuestionSafetyState\(searchText, guidedAnswers\)/);
  const safetyStart = entry.indexOf("function serverQuestionSafetyState");
  const safetyEnd = entry.indexOf("function explicitLocalityFromPayload", safetyStart);
  const safetyBlock = entry.slice(safetyStart, safetyEnd);
  assert.match(safetyBlock, /buildPatientSafetyAssessment\(\{ text: searchText, answers \}\)/);
  assert.match(safetyBlock, /assessment\.blocking/);
});

scenario("clinical validation blocks adaptive activation but not safety interruption", () => {
  const activationStart = entry.indexOf("function activatedQuestionSelection");
  const activationEnd = entry.indexOf("function selectPatientGuidanceQuestion", activationStart);
  const activationBlock = entry.slice(activationStart, activationEnd);
  assert.match(activationBlock, /selection\?\.status === 'safety_blocked'/);
  assert.match(activationBlock, /blocking_validation_rule_keys/);
  assert.match(activationBlock, /PATIENT_GUIDANCE_QUESTION_SELECTION_BLOCKING_RULES\.has\(ruleKey\)/);
  assert.match(activationBlock, /fallback_reason: 'clinical_validation_required'/);
});

scenario("Top 3 trust validation cannot disable adaptive question selection", () => {
  const setStart = entry.indexOf("const PATIENT_GUIDANCE_QUESTION_SELECTION_BLOCKING_RULES");
  const setEnd = entry.indexOf("const LEGACY_ANSWER_VALUE_ALIASES", setStart);
  const blockerSet = entry.slice(setStart, setEnd);
  assert.match(blockerSet, /pediatric_age_to_care_path/);
  assert.match(blockerSet, /symptom_safety_completion/);
  assert.match(blockerSet, /contact_lens_first_time_path/);
  assert.doesNotMatch(blockerSet, /specialized_service_trust_threshold/);
});

scenario("urgent patient text is detected server-side", () => {
  assert.deepEqual(
    deterministicSafetyFlagsFromText("Nu mai vad cu un ochi"),
    ["sudden_vision_loss"],
  );
  assert.equal(buildPatientSafetyAssessment({ text: "Acid in ochi" }).blocking, true);
});

scenario("urgent guided answer is detected server-side", () => {
  const answers = [{
    question_key: "safety_targeted_check",
    answer_value: "durere_severa",
  }];
  assert.deepEqual(guidedSafetyFlagsFromAnswers(answers), ["severe_eye_pain"]);
  assert.equal(buildPatientSafetyAssessment({ answers }).blocking, true);
});

scenario("explicit none safety answer does not invent a blocking flag", () => {
  const result = buildPatientSafetyAssessment({
    answers: [{
      question_key: "safety_targeted_check",
      answer_value: "niciuna",
    }],
  });
  assert.equal(result.blocking, false);
  assert.deepEqual(result.blocking_flags, []);
});

scenario("Base44 and client patient safety rules remain byte-identical", () => {
  assert.equal(
    source("base44/shared/patientSafety.js"),
    source("src/lib/patientSafety.js"),
  );
});

scenario("question-only selection still performs no extra AI call", () => {
  assert.equal((entry.match(/Core\.InvokeLLM\(/g) || []).length, 1);
  assert.doesNotMatch(questionOnlyBlock, /InvokeLLM/);
});

scenario("matching and ranking implementation remains byte-stable", () => {
  const marker = "    if (requestedKeys.length === 0) {";
  assert.equal(fnv1a(entry.slice(entry.indexOf(marker)).trimEnd()), "acb8a9be");

  const client = source("src/lib/providerSemanticSearch.js");
  const clientMarker = "export async function matchProvidersWithSemanticFallback";
  assert.equal(fnv1a(client.slice(client.indexOf(clientMarker))), "37340f15");
});

scenario("physical Base44 function count remains 48", () => {
  const functionsRoot = path.join(root, "base44/functions");
  const physicalFunctions = readdirSync(functionsRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory() && existsSync(path.join(functionsRoot, item.name, "entry.ts")));
  assert.equal(physicalFunctions.length, 48);
});

assert.ok(scenarioCount >= 15);
console.log(JSON.stringify({
  contract: "patient-guidance-question-selection-hardening-v1",
  scenarios: scenarioCount,
  physical_function_count: 48,
}));
