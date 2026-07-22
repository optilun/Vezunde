import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PATIENT_CONVERSATION_AGENT_VERSION,
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
  new URL("../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts", import.meta.url),
  "utf8",
);

assert.equal(base44ModuleSource, moduleSource);
assert.equal((shadowRunnerSource.match(/Core\.InvokeLLM/g) || []).length, 1);
assert(shadowRunnerSource.includes("add_context_from_internet: false"));
assert(shadowRunnerSource.includes("response_json_schema: getPatientConversationAgentResponseSchema()"));
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
assert(catalog.services.some((service) => service.key === "oct"));
assert(catalog.services.some((service) => service.key === "hinge_repair"));
assert(catalog.provider_types.some((profile) => profile.key === "independent_optometrist"));
assert(!catalog.provider_types.some((profile) => profile.key === "optical_laboratory_b2b"));

const schema = getPatientConversationAgentResponseSchema();
assert.equal(schema.additionalProperties, false);
assert(schema.properties.next_action.enum.includes("ask_clarifying_question"));
assert(schema.properties.next_action.enum.includes("search_providers"));
assert(schema.properties.urgency.properties.level.enum.includes("possible"));
assert(schema.properties.urgency.properties.level.enum.includes("confirmed"));
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
assert(prompt.includes("Use the full conversation"));
assert(prompt.includes("Do not route by exact phrase matching"));
assert(prompt.includes("do not ask unnecessary questions"));
assert(prompt.includes("Do not use 112 as a generic or primary action"));
assert(prompt.includes("VIASEE_CATALOG_JSON="));
assert(prompt.includes("De fapt am trimitere pentru OCT"));

function rawResult(overrides = {}) {
  const base = {
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    language: "ro",
    need_summary: "Reparatie balama ochelari in Arad.",
    primary_intent: "reparatii_ochelari",
    alternative_intents: [],
    care_path_candidates: ["technical_optical_service"],
    service_keys: ["hinge_repair"],
    provider_type_candidates: ["independent_optical_store"],
    facts: {
      for_whom: "adult",
      age_group: "adult",
      locality: {
        siruta_code: "",
        city: "Arad",
        county_code: "",
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
    urgency: {
      level: "none",
      needs_clarification: false,
      reason: "",
    },
    understanding_confidence: "high",
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: true,
      missing_critical_fields: [],
    },
    next_action: "search_providers",
    assistant_message: "Am inteles. Caut locatii potrivite in Arad.",
    specialist_summary: "Persoana cauta repararea unei balamale de ochelari in Arad.",
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
    urgency: {
      ...base.urgency,
      ...(overrides.urgency || {}),
    },
    information_status: {
      ...base.information_status,
      ...(overrides.information_status || {}),
    },
  };
}

const repaired = sanitizePatientConversationAgentResult(rawResult({
  service_keys: ["hinge_repair", "invented_service"],
  provider_type_candidates: ["independent_optical_store", "invented_provider"],
  evidence_phrases: ["balama", "invented evidence"],
}), {
  conversation: [{ role: "user", content: "S-a rupt balamaua la ochelari si sunt in Arad." }],
});
assert.deepEqual(repaired.result.service_keys, ["hinge_repair"]);
assert.deepEqual(repaired.result.provider_type_candidates, ["independent_optical_store"]);
assert.deepEqual(repaired.result.evidence_phrases, ["balama"]);
assert.equal(repaired.result.next_action, "search_providers");
assert.equal(repaired.diagnostics.rejected_service_count, 1);
assert.equal(repaired.diagnostics.rejected_provider_type_count, 1);

const ambiguous = sanitizePatientConversationAgentResult(rawResult({
  need_summary: "Schimbare neclara a vederii.",
  primary_intent: "simptome_oftalmologice",
  care_path_candidates: ["ophthalmology"],
  service_keys: ["ophthalmology_consultation"],
  facts: {
    locality: { city: "" },
  },
  urgency: {
    level: "possible",
    needs_clarification: false,
    reason: "Formularea este ambigua.",
  },
  information_status: {
    sufficient_for_search: true,
    sufficient_for_specialist_message: false,
    missing_critical_fields: [],
  },
  next_action: "show_emergency_guidance",
  assistant_message: "Suna la 112.",
  specialist_summary: null,
}), {
  conversation: [{ role: "user", content: "Nu mai vad bine cu stangul." }],
});
assert.equal(ambiguous.result.urgency.level, "possible");
assert.equal(ambiguous.result.urgency.needs_clarification, true);
assert.equal(ambiguous.result.next_action, "ask_clarifying_question");
assert.equal(ambiguous.result.information_status.sufficient_for_search, false);
assert(ambiguous.result.information_status.missing_critical_fields.includes("symptom_severity"));
assert(!ambiguous.result.assistant_message.includes("112"));
assert.equal(ambiguous.diagnostics.safety_action_corrected, true);

const confirmed = sanitizePatientConversationAgentResult(rawResult({
  primary_intent: "simptome_oftalmologice",
  care_path_candidates: ["emergency_interruption"],
  service_keys: ["emergency_ophthalmology"],
  urgency: {
    level: "confirmed",
    needs_clarification: true,
    reason: "Pierderea a fost confirmata ca brusca si aproape completa.",
  },
  information_status: {
    sufficient_for_search: true,
    sufficient_for_specialist_message: true,
    missing_critical_fields: [],
  },
  next_action: "search_providers",
  assistant_message: "Text nesigur.",
}), {
  conversation: [
    { role: "user", content: "Nu mai vad cu un ochi." },
    { role: "assistant", content: "A disparut brusc aproape complet?" },
    { role: "user", content: "Da, azi dimineata, aproape complet." },
  ],
});
assert.equal(confirmed.result.urgency.level, "confirmed");
assert.equal(confirmed.result.next_action, "show_emergency_guidance");
assert.equal(confirmed.result.information_status.sufficient_for_search, false);
assert(confirmed.result.assistant_message.includes("cel mai apropiat spital"));
assert(!confirmed.result.assistant_message.includes("112"));
assert.equal(confirmed.result.specialist_summary, null);

const missingLocality = sanitizePatientConversationAgentResult(rawResult({
  facts: { locality: { city: "", siruta_code: "" } },
  information_status: {
    sufficient_for_search: false,
    sufficient_for_specialist_message: false,
    missing_critical_fields: ["locality"],
  },
  next_action: "search_providers",
}), {
  conversation: [{ role: "user", content: "Mi s-a rupt balamaua la ochelari." }],
});
assert.equal(missingLocality.result.next_action, "ask_locality");
assert.equal(missingLocality.diagnostics.search_action_corrected, true);

const unavailable = buildPatientConversationShadowEnvelope({
  status: "unavailable",
  reason: "model_unavailable",
});
assert.equal(unavailable.mode, "shadow");
assert.equal(unavailable.interpretation, null);

const completed = buildPatientConversationShadowEnvelope({
  status: "completed",
  raw: rawResult(),
  conversation: [{ role: "user", content: "S-a rupt balamaua la ochelari si sunt in Arad." }],
});
assert.equal(completed.status, "completed");
assert.equal(completed.interpretation.next_action, "search_providers");

console.log(`Patient conversation agent contract verified with ${fixtures.cases.length} semantic fixtures.`);
