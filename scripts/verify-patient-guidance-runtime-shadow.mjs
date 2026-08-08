import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PATIENT_GUIDANCE_NEW_AI_CANARY,
  PATIENT_GUIDANCE_RUNTIME_SHADOW_VERSION,
  adaptLegacyPatientNeedInterpretationToPlannerProposal,
  comparePatientGuidanceLiveAndShadow,
  runPatientGuidanceRuntimeShadow,
  summarizePatientGuidanceShadowProfile,
} from "../shared/patientGuidancePlanner.js";
import {
  isApprovedPatientGuidanceQuestionKey,
} from "../shared/patientGuidanceQuestionCatalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let scenarioCount = 0;

async function scenario(name, verify) {
  scenarioCount += 1;
  try {
    await verify();
  } catch (error) {
    error.message = "[" + name + "] " + error.message;
    throw error;
  }
}

function legacy(overrides = {}) {
  return {
    version: "patient-need-ai-v1",
    intent: "unknown",
    service_keys: [],
    for_whom: "unknown",
    age_group: "unknown",
    timing_key: "unknown",
    location_text: "",
    confidence_band: "medium",
    clarification_required: false,
    clarification_question: "",
    possible_safety_flags: [],
    evidence_phrases: [],
    agreement_status: "not_comparable",
    shared_service_keys: [],
    ...overrides,
  };
}

function observation(overrides = {}, options = {}) {
  const liveResult = overrides.liveResult || {
    mode: "shadow",
    status: "completed",
    interpretation: overrides.legacyInterpretation || legacy(),
  };
  return runPatientGuidanceRuntimeShadow({
    liveResult,
    text: "Nu stiu unde trebuie sa merg.",
    legacyStatus: "completed",
    legacyInterpretation: liveResult.interpretation,
    deterministicIntent: "unknown",
    deterministicServiceKeys: [],
    deterministicSafetyState: "unchecked",
    ...overrides,
  }, options);
}

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

await scenario("live result remains the identical object with shadow enabled", () => {
  const liveResult = {
    mode: "shadow",
    status: "completed",
    interpretation: legacy({ intent: "control_vedere" }),
  };
  const result = observation({ liveResult });
  assert.strictEqual(result.live_result, liveResult);
  assert.deepEqual(result.live_result, liveResult);
});

await scenario("legacy intent is adapted only as an AI proposal", () => {
  const proposal = adaptLegacyPatientNeedInterpretationToPlannerProposal(
    legacy({ intent: "investigatii" }),
  );
  assert.equal(proposal.primary_intent, "investigatii");
  assert.equal(Object.hasOwn(proposal, "confirmed_primary_intent"), false);
});

await scenario("AI-only intent never becomes confirmed", () => {
  const result = observation({
    legacyInterpretation: legacy({ intent: "investigatii" }),
  });
  assert.equal(result.patient_guidance_shadow_profile.ai_proposed_primary_intent, "investigatii");
  assert.equal(result.patient_guidance_shadow_profile.confirmed_primary_intent, "unknown");
  assert.equal(result.patient_guidance_shadow_profile.sufficient_for_search, false);
});

await scenario("legacy services remain candidates", () => {
  const result = observation({
    legacyInterpretation: legacy({ service_keys: ["oct"] }),
  });
  assert.deepEqual(result.patient_guidance_shadow_profile.confirmed_service_keys, []);
  assert.deepEqual(result.patient_guidance_shadow_profile.candidate_service_keys, ["oct"]);
});

await scenario("legacy free-text clarification is ignored", () => {
  const proposal = adaptLegacyPatientNeedInterpretationToPlannerProposal(legacy({
    clarification_required: true,
    clarification_question: "Unde va doare?",
  }));
  assert.equal(proposal.next_question_key, null);
  assert.equal(Object.hasOwn(proposal, "clarification_question"), false);
});

await scenario("final next question always comes from the catalog", () => {
  const result = observation({
    text: "Vreau un control.",
    legacyInterpretation: legacy({
      clarification_required: true,
      clarification_question: "Intrebare libera",
    }),
  });
  const key = result.patient_guidance_shadow_profile.next_question_key;
  assert.ok(key === null || isApprovedPatientGuidanceQuestionKey(key));
  assert.equal(result.patient_guidance_shadow_profile.ai_proposed_next_question_key, null);
});

await scenario("explicit locality has priority over AI locality", () => {
  const result = observation({
    explicitLocality: { siruta_code: "54984", city: "Cluj-Napoca" },
    legacyInterpretation: legacy({ location_text: "Iasi" }),
  });
  assert.equal(
    result.patient_guidance_shadow_profile.confirmed_facts.locality.city,
    "Cluj-Napoca",
  );
  assert.equal(
    result.patient_guidance_shadow_profile.ai_candidate_facts
      .find((fact) => fact.fact_key === "locality")?.value,
    "Iasi",
  );
});

await scenario("guided answers have priority over AI candidate facts", () => {
  const result = observation({
    guidedAnswers: [{ question_key: "for_whom", answer_value: "adult" }],
    legacyInterpretation: legacy({ for_whom: "copil" }),
  });
  assert.equal(result.patient_guidance_shadow_profile.confirmed_facts.for_whom, "adult");
  assert.equal(
    result.patient_guidance_shadow_profile.ai_candidate_facts
      .find((fact) => fact.fact_key === "for_whom")?.value,
    "child",
  );
});

await scenario("explicit services are the only confirmed services", () => {
  const result = observation({
    explicitConfirmedServiceKeys: ["contact_lenses"],
    deterministicServiceKeys: ["oct"],
    legacyInterpretation: legacy({ service_keys: ["frame_repair"] }),
  });
  assert.deepEqual(
    result.patient_guidance_shadow_profile.confirmed_service_keys,
    ["contact_lenses"],
  );
  assert.deepEqual(
    result.patient_guidance_shadow_profile.candidate_service_keys.sort(),
    ["frame_repair", "oct"],
  );
});

await scenario("deterministic conflict remains candidate", () => {
  const result = observation({
    explicitConfirmedServiceKeys: ["contact_lenses"],
    deterministicServiceKeys: ["oct"],
  });
  assert.deepEqual(
    result.patient_guidance_shadow_profile.deterministic_service_conflicts,
    ["oct"],
  );
  assert.equal(
    result.patient_guidance_shadow_profile.confirmed_facts.investigation_type,
    undefined,
  );
});

await scenario("AI candidate facts never become confirmed", () => {
  const result = observation({
    legacyInterpretation: legacy({
      for_whom: "adult",
      age_group: "13_18_ani",
      timing_key: "saptamana_aceasta",
      location_text: "Sibiu",
    }),
  });
  assert.equal(result.patient_guidance_shadow_profile.ai_candidate_facts.length, 4);
  for (const fact of result.patient_guidance_shadow_profile.ai_candidate_facts) {
    assert.equal(fact.confirmation_eligible, false);
    assert.equal(
      Object.hasOwn(result.patient_guidance_shadow_profile.confirmed_facts, fact.fact_key),
      false,
    );
  }
});

await scenario("clinical approvals stay empty", () => {
  const result = observation({
    text: "Am ochii foarte rosii.",
    legacyInterpretation: {
      ...legacy({ intent: "simptome_oftalmologice" }),
      clinical_validation_approvals: ["symptom_safety_completion"],
    },
  });
  assert.deepEqual(result.patient_guidance_shadow_profile.clinical_validation_approvals, []);
  assert.deepEqual(
    result.patient_guidance_shadow_profile.routing_profile.approved_validation_rule_keys,
    [],
  );
});

await scenario("planner timeout never blocks the live result", () => {
  const liveResult = { mode: "shadow", status: "completed", interpretation: legacy() };
  const error = Object.assign(new Error("timeout"), {
    code: "PATIENT_GUIDANCE_PLANNER_TIMEOUT",
  });
  const result = observation({ liveResult }, {
    buildProfile: () => { throw error; },
  });
  assert.strictEqual(result.live_result, liveResult);
  assert.equal(result.summary.status, "unavailable");
  assert.equal(result.summary.fallback_reason, "planner_timeout");
});

await scenario("invalid planner output never blocks the live result", () => {
  const liveResult = { mode: "shadow", status: "completed", interpretation: legacy() };
  const result = observation({ liveResult }, { buildProfile: () => null });
  assert.strictEqual(result.live_result, liveResult);
  assert.equal(result.summary.status, "invalid");
  assert.equal(result.summary.fallback_reason, "planner_invalid");
});

await scenario("deterministic safety blocking remains prioritary", () => {
  const result = observation({
    text: "Consult oftalmologic.",
    explicitLocality: { siruta_code: "54984", city: "Cluj-Napoca" },
    deterministicSafetyState: "blocking",
  });
  assert.equal(result.patient_guidance_shadow_profile.care_path, "emergency_interruption");
  assert.equal(result.patient_guidance_shadow_profile.sufficient_for_search, false);
});

await scenario("runtime contains exactly one legacy InvokeLLM call", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  assert.equal((entry.match(/Core\.InvokeLLM\(/g) || []).length, 1);
  assert.equal(entry.includes("getPatientGuidancePlannerResponseSchema"), false);
});

await scenario("browser payload cannot enable the future canary", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  const client = source("src/lib/providerSemanticSearch.js");
  assert.doesNotMatch(entry, /payload[^\n]*canary|canary[^\n]*payload/i);
  assert.doesNotMatch(client, /canary/i);
  assert.equal(PATIENT_GUIDANCE_NEW_AI_CANARY.source, "server_constant");
  assert.equal(PATIENT_GUIDANCE_NEW_AI_CANARY.enabled, false);
});

await scenario("complete shadow profile is not returned publicly", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  assert.match(
    entry,
    /patient_guidance_question_selection: observation\.question_selection/,
  );
  assert.doesNotMatch(entry, /Response\.json\([^;]*patient_guidance_shadow_profile/s);
});

await scenario("runtime logs only controlled aggregate objects", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  const start = entry.indexOf("console.info(");
  const end = entry.indexOf("function activatedQuestionSelection", start);
  const logBlock = entry.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(
    logBlock,
    /JSON\.stringify\(\{ \.\.\.observation\.summary, \.\.\.observation\.comparison \}\)/,
  );
  assert.doesNotMatch(
    logBlock,
    /searchText|payload|legacyInterpretation|patient_guidance_shadow_profile|evidence|phone|email|address/i,
  );
});

await scenario("physical Base44 function count remains 48", () => {
  const functionsRoot = path.join(root, "base44/functions");
  const physicalFunctions = readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => (
      entry.isDirectory()
      && existsSync(path.join(functionsRoot, entry.name, "entry.ts"))
    ));
  assert.equal(physicalFunctions.length, 48);
});

await scenario("Base44 shared guidance copies are byte-identical", () => {
  for (const fileName of [
    "patientGuidanceQuestionCatalog.js",
    "patientGuidanceRouting.js",
    "patientGuidancePlanner.js",
  ]) {
    assert.equal(
      source("base44/shared/" + fileName),
      source("shared/" + fileName),
      fileName + " must remain byte-identical",
    );
  }
});

await scenario("matching and ranking implementation remains byte-stable", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  const entryMarker = "    if (requestedKeys.length === 0) {";
  // Amprenta actualizata 2026-08-06 (vezi verify-patient-guidance-adaptive-question-selection
  // pentru lista completa a modificarilor). Nu s-au atins scoringul, ordonarea sau Top 3.
  assert.equal(fnv1a(entry.slice(entry.indexOf(entryMarker)).trimEnd()), "ec0773fc");
  assert.match(entry, /error: 'Cererea nu a putut fi procesata\.'/);
  assert.match(entry, /headers: \{ 'Cache-Control': 'no-store' \}/);

  const client = source("src/lib/providerSemanticSearch.js");
  const clientMarker = "export async function matchProvidersWithSemanticFallback";
  assert.equal(fnv1a(client.slice(client.indexOf(clientMarker))), "37340f15");
});

await scenario("comparison exposes only controlled differences", () => {
  const comparison = comparePatientGuidanceLiveAndShadow(
    legacy({ intent: "investigatii", service_keys: ["oct"] }),
    {
      status: "completed",
      confirmed_primary_intent: "investigatii",
      confirmed_service_keys: ["oct"],
      candidate_service_keys: [],
      care_path: "specialized_ophthalmology",
      next_question_key: "timing",
      sufficient_for_search: true,
      deterministic_service_conflicts: [],
      deterministic_intent_conflict: null,
      deterministic_fact_conflicts: [],
      fallback_reason: null,
    },
  );
  assert.deepEqual(Object.keys(comparison).sort(), [
    "care_path_shadow",
    "conflict_detected",
    "fallback_used",
    "intent_agreement",
    "next_question_shadow",
    "service_agreement",
    "shadow_sufficient_for_search",
  ].sort());
  assert.equal(comparison.intent_agreement, "agree");
  assert.equal(comparison.service_agreement, "agree");
});

await scenario("future AI canary is disabled and has no approvals", () => {
  assert.equal(PATIENT_GUIDANCE_RUNTIME_SHADOW_VERSION, "patient-guidance-runtime-shadow-v1");
  assert.deepEqual(PATIENT_GUIDANCE_NEW_AI_CANARY, {
    enabled: false,
    source: "server_constant",
    approvals: [],
  });
});

await scenario("old AI failure keeps the existing live status", () => {
  const liveResult = {
    mode: "shadow",
    status: "unavailable",
    reason: "ai_interpretation_unavailable",
  };
  const result = observation({
    liveResult,
    legacyStatus: "unavailable",
    legacyInterpretation: null,
  });
  assert.strictEqual(result.live_result, liveResult);
  assert.equal(result.live_result.status, "unavailable");
  assert.equal(result.patient_guidance_shadow_profile.status, "fallback");
});

await scenario("legacy controlled facts are mapped as candidates", () => {
  const proposal = adaptLegacyPatientNeedInterpretationToPlannerProposal(legacy({
    for_whom: "copil",
    age_group: "7_12_ani",
    timing_key: "zilele_urmatoare",
    location_text: "Brasov",
  }));
  assert.deepEqual(proposal.extracted_facts, [
    { fact_key: "for_whom", value: "child" },
    { fact_key: "child_age_group", value: "7_12" },
    { fact_key: "timing", value: "zilele_urmatoare" },
    { fact_key: "locality", value: "Brasov" },
  ]);
});

await scenario("legacy candidate facts without direct evidence stay unsupported", () => {
  const result = observation({
    legacyInterpretation: legacy({
      for_whom: "adult",
      evidence_phrases: ["adult"],
    }),
  });
  const fact = result.patient_guidance_shadow_profile.ai_candidate_facts[0];
  assert.equal(fact.status, "unsupported");
  assert.equal(fact.evidence_phrase, null);
  assert.equal(fact.confirmation_eligible, false);
});

await scenario("shadow summary excludes raw and personal data fields", () => {
  const summary = summarizePatientGuidanceShadowProfile({
    contract_version: "patient-guidance-planner-v1",
    status: "completed",
    ai_status: "completed",
    confirmed_primary_intent: "control_vedere",
    candidate_intents: ["investigatii"],
    confirmed_service_keys: [],
    candidate_service_keys: ["oct"],
    care_path: "unresolved",
    sufficient_for_search: false,
    next_question_key: "routine_vs_symptom",
    deterministic_service_conflicts: [],
    deterministic_intent_conflict: null,
    deterministic_fact_conflicts: [],
    fallback_reason: null,
    text: "Nume Telefon Email Adresa",
    evidence_phrases: ["continut medical"],
  });
  for (const forbidden of [
    "text",
    "name",
    "phone",
    "email",
    "address",
    "evidence_phrases",
    "confirmed_facts",
    "ai_candidate_facts",
  ]) {
    assert.equal(Object.hasOwn(summary, forbidden), false);
  }
});

assert.ok(scenarioCount >= 28, "At least 28 runtime shadow scenarios are required");

console.log(JSON.stringify({
  contract: PATIENT_GUIDANCE_RUNTIME_SHADOW_VERSION,
  scenarios: scenarioCount,
  physical_function_count: 48,
  canary_enabled: PATIENT_GUIDANCE_NEW_AI_CANARY.enabled,
}));
