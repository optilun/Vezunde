import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PATIENT_CONVERSATION_AGENT_VERSION,
  PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
  buildPatientConversationAgentPrompt,
  buildPatientConversationShadowEnvelope,
  getPatientConversationAgentCatalogContext,
  getPatientConversationAgentResponseSchema,
  sanitizePatientConversationAgentResult,
} from "../shared/patientConversationAgent.js";

const fixtures = JSON.parse(
  fs.readFileSync(new URL("../tests/fixtures/patient-conversation-agent-evaluations.json", import.meta.url), "utf8"),
);
const moduleSource = fs.readFileSync(
  new URL("../shared/patientConversationAgent.js", import.meta.url),
  "utf8",
);
const base44ModuleSource = fs.readFileSync(
  new URL("../base44/shared/patientConversationAgent.js", import.meta.url),
  "utf8",
);
const shadowRunnerSource = fs.readFileSync(
  new URL("../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts", import.meta.url),
  "utf8",
);

assert.equal(base44ModuleSource, moduleSource);
assert.equal((shadowRunnerSource.match(/Core\.InvokeLLM/g) || []).length, 1);
assert(shadowRunnerSource.includes("add_context_from_internet: false"));
assert(shadowRunnerSource.includes("response_json_schema: responseSchema"));
assert(!shadowRunnerSource.includes("assignRecommendationBuckets"));
assert(!shadowRunnerSource.includes("buildRecommendationScore"));
assert(!shadowRunnerSource.includes("recommendation_score"));

assert.equal(fixtures.contract_version, PATIENT_CONVERSATION_AGENT_VERSION);
assert(fixtures.cases.length >= 50);
assert.equal(new Set(fixtures.cases.map((item) => item.id)).size, fixtures.cases.length);
assert(fixtures.cases.some((item) => item.category === "spelling_and_informal_language"));
assert(fixtures.cases.some((item) => item.category === "conversation_correction"));
assert(fixtures.cases.some((item) => item.category === "confirmed_acute_vision_loss"));
assert(fixtures.cases.some((item) => item.category === "specialist_summary"));

for (const item of fixtures.cases) {
  assert(Array.isArray(item.conversation) && item.conversation.length > 0, item.id);
  assert(item.expected && typeof item.expected === "object", item.id);
  assert(!Object.hasOwn(item.expected, "exact_assistant_message"), item.id);
}

assert(!moduleSource.includes("ma ustra oki si park am nisip in ei"));
assert(!moduleSource.includes("s-a rupt balamaua la ochelari si sunt in Arad"));
assert(!moduleSource.includes("de fapt medicul mi-a dat trimitere pentru OCT"));

const catalog = getPatientConversationAgentCatalogContext();
assert.equal(catalog.semantic_contract_version, PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION);
assert(catalog.services.some((service) => service.key === "oct"));
assert(catalog.services.some((service) => service.key === "hinge_repair"));
assert(catalog.intents.includes("control_vedere"));
assert(catalog.possible_safety_flags.includes("sudden_vision_loss"));
assert(catalog.state_clear_fields.includes("locality"));
assert(!Object.hasOwn(catalog, "provider_types"));
assert(!Object.hasOwn(catalog, "care_paths"));
assert(!Object.hasOwn(catalog, "next_actions"));

const schema = getPatientConversationAgentResponseSchema();
assert.equal(schema.additionalProperties, false);
assert.deepEqual(
  schema.properties.contract_version.enum,
  [PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION],
);
for (const prohibitedOperationalField of [
  "care_path_candidates",
  "provider_type_candidates",
  "urgency",
  "information_status",
  "next_action",
  "assistant_message",
  "specialist_summary",
]) {
  assert.equal(
    Object.hasOwn(schema.properties, prohibitedOperationalField),
    false,
    `${prohibitedOperationalField} must not be part of the model schema`,
  );
}
assert(schema.properties.possible_safety_flags.items.enum.includes("sudden_vision_loss"));
assert(schema.properties.state_delta.properties.clear_fields.items.enum.includes("locality"));
assert(!Object.hasOwn(schema.properties, "provider_id"));
assert(!Object.hasOwn(schema.properties, "provider_ranking"));

const prompt = buildPatientConversationAgentPrompt({
  conversation: [
    { role: "user", content: "Vreau sa imi fac ochelari." },
    { role: "assistant", content: "Ai deja o reteta si in ce oras cauti?" },
    { role: "user", content: "De fapt am trimitere pentru OCT, in Iasi." },
  ],
  runtimeContext: {
    locale: "ro-RO",
    known_locality: { city: "Iasi" },
  },
});
assert(prompt.includes("CONVERSATION_JSON="));
assert(prompt.includes("semantic interpretation layer"));
assert(prompt.includes("Extract semantic meaning only"));
assert(prompt.includes("Do not choose a care path, provider type"));
assert(prompt.includes("possible_safety_flags are advisory"));
assert(prompt.includes("state_delta must describe only explicit corrections"));
assert(prompt.includes("VIASEE_SEMANTIC_CATALOG_JSON="));
assert(prompt.includes("De fapt am trimitere pentru OCT"));
assert(!prompt.includes("Choose search_providers"));
assert(!prompt.includes("Only confirmed urgency may use show_emergency_guidance"));

function rawSemanticResult(overrides = {}) {
  const base = {
    contract_version: PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
    language: "ro",
    need_summary: "Reparatie balama ochelari in Arad.",
    primary_intent: "reparatii_ochelari",
    alternative_intents: [],
    service_keys: ["hinge_repair"],
    facts: {
      for_whom: "adult",
      age_group: "adult",
      locality: {
        siruta_code: "",
        city: "Arad",
        county_code: "AR",
        county: "Arad",
        area: "",
      },
      symptom_onset: "",
      symptom_duration: "",
      symptom_pattern: "",
      desired_timing: "",
      contact_lens_experience: "unknown",
      prescription_status: "unknown",
      investigation_reference_text: "",
      repair_details: "balama rupta",
      user_constraints: [],
    },
    understanding_confidence: "high",
    ambiguity_fields: [],
    possible_safety_flags: [],
    state_delta: {
      correction_detected: false,
      clear_fields: [],
    },
    evidence_phrases: ["balama"],
  };
  return {
    ...base,
    ...overrides,
    facts: {
      ...base.facts,
      ...(overrides.facts || {}),
      locality: {
        ...base.facts.locality,
        ...(overrides.facts?.locality || {}),
      },
    },
    state_delta: {
      ...base.state_delta,
      ...(overrides.state_delta || {}),
    },
  };
}

const sanitized = sanitizePatientConversationAgentResult(rawSemanticResult({
  service_keys: ["hinge_repair", "invented_service"],
  evidence_phrases: ["balama", "invented evidence"],
}), {
  conversation: [{ role: "user", content: "S-a rupt balamaua la ochelari si sunt in Arad." }],
});
assert.deepEqual(sanitized.result.service_keys, ["hinge_repair"]);
assert.deepEqual(sanitized.result.care_path_candidates, ["technical_optical_service"]);
assert.deepEqual(sanitized.result.provider_type_candidates, []);
assert.deepEqual(sanitized.result.evidence_phrases, ["balama"]);
assert.equal(sanitized.result.urgency.level, "none");
assert.equal(sanitized.result.next_action, "ask_clarifying_question");
assert.equal(sanitized.result.assistant_message, "");
assert.equal(sanitized.result.specialist_summary, null);
assert.equal(sanitized.result.information_status.sufficient_for_search, false);
assert.equal(sanitized.diagnostics.model_operational_authority, false);
assert.equal(sanitized.diagnostics.rejected_service_count, 1);
assert.equal(sanitized.diagnostics.rejected_provider_type_count, 0);
assert.equal(sanitized.diagnostics.rejected_evidence_phrase_count, 1);

const advisorySafety = sanitizePatientConversationAgentResult(rawSemanticResult({
  primary_intent: "simptome_oftalmologice",
  service_keys: ["ophthalmology_consultation"],
  possible_safety_flags: ["sudden_vision_loss"],
  ambiguity_fields: ["symptom_severity"],
  facts: {
    locality: { city: "" },
    symptom_pattern: "vad mai slab cu stangul",
  },
}), {
  conversation: [{ role: "user", content: "Nu mai vad bine cu stangul." }],
});
assert.equal(advisorySafety.result.urgency.level, "possible");
assert.equal(advisorySafety.result.urgency.needs_clarification, true);
assert.equal(advisorySafety.result.next_action, "ask_clarifying_question");
assert.equal(advisorySafety.result.information_status.sufficient_for_search, false);
assert(advisorySafety.result.information_status.missing_critical_fields.includes("symptom_severity"));
assert.deepEqual(advisorySafety.diagnostics.advisory_safety_flags, ["sudden_vision_loss"]);

const correction = sanitizePatientConversationAgentResult(rawSemanticResult({
  primary_intent: "investigatii",
  service_keys: ["oct"],
  state_delta: {
    correction_detected: true,
    clear_fields: ["repair_details", "prescription_status"],
  },
}), {
  conversation: [{ role: "user", content: "De fapt am nevoie de OCT." }],
});
assert.equal(correction.diagnostics.semantic_state_delta.correction_detected, true);
assert.deepEqual(correction.diagnostics.semantic_state_delta.clear_fields, [
  "repair_details",
  "prescription_status",
]);

const completed = buildPatientConversationShadowEnvelope({
  status: "completed",
  raw: rawSemanticResult(),
  conversation: [{ role: "user", content: "S-a rupt balamaua la ochelari si sunt in Arad." }],
});
assert.equal(completed.status, "completed");
assert.equal(completed.contract_version, PATIENT_CONVERSATION_AGENT_VERSION);
assert.equal(
  completed.diagnostics.semantic_contract_version,
  PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
);
assert.equal(completed.interpretation.next_action, "ask_clarifying_question");

const unavailable = buildPatientConversationShadowEnvelope({
  status: "unavailable",
  reason: "model_unavailable",
});
assert.equal(unavailable.mode, "shadow");
assert.equal(unavailable.interpretation, null);

console.log(`Patient conversation semantic-only contract verified with ${fixtures.cases.length} semantic fixtures.`);
