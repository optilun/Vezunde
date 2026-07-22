import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PATIENT_GUIDANCE_PLANNER_AI_FIELDS,
  PATIENT_GUIDANCE_PLANNER_INTERNAL_CLINICAL_VALIDATION_APPROVALS,
  PATIENT_GUIDANCE_PLANNER_VERSION,
  buildPatientGuidancePlannerProfile,
  getPatientGuidancePlannerResponseSchema,
  runPatientGuidancePlannerShadow,
  sanitizePatientGuidancePlannerProposal,
} from "../shared/patientGuidancePlanner.js";
import {
  isApprovedPatientGuidanceQuestionKey,
} from "../shared/patientGuidanceQuestionCatalog.js";

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

function locality(city = "Cluj-Napoca") {
  return { siruta_code: "54984", city };
}

function validAI(overrides = {}) {
  return {
    primary_intent: "unknown",
    alternative_intents: [],
    candidate_service_keys: [],
    extracted_facts: [],
    candidate_care_paths: [],
    next_question_key: null,
    confidence_band: "medium",
    possible_safety_flags: [],
    evidence_phrases: [],
    ...overrides,
  };
}

await scenario("versioned planner contract", () => {
  assert.equal(PATIENT_GUIDANCE_PLANNER_VERSION, "patient-guidance-planner-v1");
  assert.deepEqual(PATIENT_GUIDANCE_PLANNER_INTERNAL_CLINICAL_VALIDATION_APPROVALS, []);
});

await scenario("AI schema exposes only allowed proposal fields", () => {
  const schema = getPatientGuidancePlannerResponseSchema();
  assert.deepEqual(
    Object.keys(schema.properties).sort(),
    [...PATIENT_GUIDANCE_PLANNER_AI_FIELDS].sort(),
  );
  assert.equal(schema.additionalProperties, false);
  for (const forbidden of [
    "diagnosis",
    "medical_advice",
    "emergency_instructions",
    "providers",
    "ranking",
    "top3",
    "clinical_validation_approvals",
    "care_path",
    "sufficient_for_search",
    "sufficient_for_provider_request",
  ]) assert.equal(Object.hasOwn(schema.properties, forbidden), false);
});

await scenario("OCT in Cluj resolves deterministically", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Caut OCT in Cluj.",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.equal(profile.primary_intent, "investigatii");
  assert.deepEqual(profile.confirmed_service_keys, ["oct"]);
  assert.equal(profile.known_facts.investigation_type, "oct");
  assert.equal(profile.care_path, "specialized_ophthalmology");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("child consult stays guided", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Caut un consult pentru copil.",
  });
  assert.equal(profile.primary_intent, "control_copil");
  assert.equal(profile.care_path, "unresolved");
  assert.deepEqual(profile.candidate_care_paths, ["optometry", "ophthalmology"]);
  assert.ok(profile.missing_required_facts.includes("child_age_group"));
  assert.ok(profile.missing_required_facts.includes("routine_vs_symptom"));
});

await scenario("children plural is recognized", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Consult pentru copii.",
  });
  assert.equal(profile.primary_intent, "control_copil");
  assert.equal(profile.care_path, "unresolved");
});

await scenario("generic control asks deterministic clarification", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
  });
  assert.equal(profile.primary_intent, "control_vedere");
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.next_question_key, "routine_vs_symptom");
});

await scenario("exact ophthalmology consult resolves deterministic path", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Consult oftalmologic.",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["ophthalmology_consultation"]);
  assert.equal(profile.care_path, "ophthalmology");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("red eyes remain clinically blocked", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am ochii foarte rosii.",
  });
  assert.equal(profile.primary_intent, "simptome_oftalmologice");
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(
    profile.routing_profile.blocking_validation_rule_keys.includes("symptom_safety_completion"),
  );
});

await scenario("unknown destination stays unresolved", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Nu stiu unde trebuie sa merg.",
  });
  assert.equal(profile.primary_intent, "unknown");
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.next_question_key, "routine_vs_symptom");
});

await scenario("broken frame resolves technical service", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Mi s-a rupt rama.",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["frame_repair"]);
  assert.equal(profile.known_facts.repair_type, "broken_frame");
  assert.equal(profile.care_path, "technical_optical_service");
});

await scenario("eyeglasses adjustment resolves technical service", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am nevoie de reglaj la ochelari.",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["eyeglasses_adjustment"]);
  assert.equal(profile.known_facts.repair_type, "frame_adjustment");
  assert.equal(profile.care_path, "technical_optical_service");
});

await scenario("generic investigations stay unresolved", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am de facut niste investigatii la ochi.",
  });
  assert.equal(profile.primary_intent, "investigatii");
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.next_question_key, "investigation_type");
});

await scenario("OCT macular reference identifies canonical investigation", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Pe recomandare scrie OCT macular.",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["oct"]);
  assert.equal(profile.known_facts.investigation_type, "oct");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("generic contact lenses stay unresolved", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau lentile de contact.",
  });
  assert.equal(profile.primary_intent, "lentile_contact");
  assert.equal(profile.care_path, "unresolved");
  assert.deepEqual(
    profile.candidate_care_paths,
    ["optical_store", "optometry", "ophthalmology"],
  );
});

await scenario("first contact lens use remains validation blocked", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Este prima data cand port lentile de contact.",
    explicitFacts: { locality: locality() },
  });
  assert.equal(profile.known_facts.contact_lens_experience, "first_time");
  assert.equal(profile.care_path, "unresolved");
  assert.ok(
    profile.routing_profile.blocking_validation_rule_keys.includes("contact_lens_first_time_path"),
  );
});

await scenario("contact lens purchase resolves optical product", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau doar sa cumpar lentile de contact.",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["contact_lenses"]);
  assert.equal(profile.care_path, "optical_store");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("invented AI service is removed", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    candidate_service_keys: ["invented_service"],
  }), { text: "Vreau un control." });
  assert.equal(sanitized.valid, true);
  assert.deepEqual(sanitized.proposal.candidate_service_keys, []);
  assert.equal(sanitized.diagnostics.rejected_service_count, 1);
});

await scenario("invented AI question falls back to routing question", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
  }, {
    status: "completed",
    raw: validAI({ next_question_key: "invented_question" }),
  });
  assert.equal(profile.ai_proposal.next_question_key, null);
  assert.equal(profile.ai_validation.question_key_rejected, true);
  assert.equal(profile.next_question_key, "routine_vs_symptom");
});

await scenario("invented AI fact is removed", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
  }, {
    status: "completed",
    raw: validAI({
      extracted_facts: [{ fact_key: "invented_fact", value: "invented" }],
    }),
  });
  assert.equal(Object.hasOwn(profile.known_facts, "invented_fact"), false);
  assert.equal(profile.ai_validation.rejected_fact_count, 1);
});

await scenario("invented AI intent becomes unknown", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Nu stiu unde trebuie sa merg.",
  }, {
    status: "completed",
    raw: validAI({ primary_intent: "invented_intent" }),
  });
  assert.equal(profile.ai_proposal.primary_intent, "unknown");
  assert.equal(profile.primary_intent, "unknown");
  assert.equal(profile.ai_validation.rejected_intent_count, 1);
});

await scenario("AI timeout uses deterministic fallback", async () => {
  const profile = await runPatientGuidancePlannerShadow({
    text: "Vreau un control.",
  }, {
    timeoutMs: 5,
    invokeAI: () => new Promise(() => {}),
  });
  assert.equal(profile.status, "fallback");
  assert.equal(profile.ai_status, "timeout");
  assert.equal(profile.fallback_reason, "ai_timeout");
  assert.equal(profile.primary_intent, "control_vedere");
  assert.equal(profile.safety_state, "unchecked");
});

await scenario("invalid AI response uses deterministic fallback", async () => {
  const profile = await runPatientGuidancePlannerShadow({
    text: "Vreau un control.",
  }, {
    invokeAI: async () => "not-json-object",
  });
  assert.equal(profile.status, "fallback");
  assert.equal(profile.ai_status, "invalid");
  assert.equal(profile.fallback_reason, "ai_response_invalid");
  assert.equal(profile.primary_intent, "control_vedere");
});

await scenario("AI clinical approvals are ignored", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am ochii foarte rosii.",
    clinicalValidationApprovals: ["symptom_safety_completion"],
  }, {
    status: "completed",
    raw: {
      ...validAI({ primary_intent: "simptome_oftalmologice" }),
      clinical_validation_approvals: ["symptom_safety_completion"],
    },
  });
  assert.deepEqual(profile.clinical_validation_approvals, []);
  assert.deepEqual(profile.routing_profile.approved_validation_rule_keys, []);
  assert.equal(Object.hasOwn(profile.ai_proposal, "clinical_validation_approvals"), false);
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("AI cannot override explicit user choice", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
    explicitPrimaryIntent: "control_vedere",
    explicitFacts: {
      locality: locality(),
      routine_vs_symptom: "routine",
    },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "simptome_oftalmologice",
      candidate_service_keys: ["ophthalmology_consultation"],
      extracted_facts: [
        { fact_key: "locality", value: "Iasi" },
        { fact_key: "routine_vs_symptom", value: "symptom" },
      ],
    }),
  });
  assert.equal(profile.primary_intent, "control_vedere");
  assert.equal(profile.known_facts.locality.city, "Cluj-Napoca");
  assert.equal(profile.known_facts.routine_vs_symptom, "routine");
  assert.deepEqual(profile.confirmed_service_keys, []);
  assert.equal(profile.care_path, "optometry");
});

await scenario("safety blocking has absolute priority", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Consult oftalmologic.",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "blocking",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      candidate_care_paths: ["optometry"],
    }),
  });
  assert.equal(profile.care_path, "emergency_interruption");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("complete symptoms stay insufficient without approval", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "simptome_oftalmologice",
    explicitFacts: {
      symptom_description: "ochii sunt rosii",
      safety_targeted_check: "niciuna",
      locality: locality(),
    },
    deterministicSafetyState: "clear",
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.sufficient_for_provider_request, false);
  assert.ok(
    profile.routing_profile.blocking_validation_rule_keys.includes("symptom_safety_completion"),
  );
});

await scenario("exact investigation and locality are sufficient", () => {
  const profile = buildPatientGuidancePlannerProfile({
    deterministicIntent: "investigatii",
    deterministicServiceKeys: ["oct"],
    deterministicFacts: {
      locality: locality(),
    },
    deterministicSafetyState: "clear",
  });
  assert.equal(profile.known_facts.investigation_type, "oct");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("timing is not required for first search", () => {
  const profile = buildPatientGuidancePlannerProfile({
    deterministicIntent: "investigatii",
    deterministicServiceKeys: ["oct"],
    deterministicFacts: {
      locality: locality(),
    },
    deterministicSafetyState: "clear",
  });
  assert.equal(Object.hasOwn(profile.known_facts, "timing"), false);
  assert.equal(profile.sufficient_for_search, true);
  assert.equal(profile.sufficient_for_provider_request, false);
  assert.equal(profile.next_question_key, "timing");
});

await scenario("planner returns no providers or ranking", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Caut OCT in Cluj.",
    explicitFacts: { locality: locality() },
  });
  for (const forbidden of ["providers", "ranking", "results", "top3"]) {
    assert.equal(Object.hasOwn(profile, forbidden), false);
  }
  for (const forbidden of ["providers", "ranking", "results", "top3"]) {
    assert.equal(Object.hasOwn(profile.ai_proposal || {}, forbidden), false);
  }
});

await scenario("final question always belongs to catalog", () => {
  const inputs = [
    { text: "Vreau un control." },
    { text: "Consult pentru copii." },
    { text: "Am de facut niste investigatii la ochi." },
    { text: "Vreau lentile de contact." },
    { text: "Mi s-a rupt rama." },
  ];
  for (const input of inputs) {
    const profile = buildPatientGuidancePlannerProfile(input);
    assert.ok(
      profile.next_question_key === null
      || isApprovedPatientGuidanceQuestionKey(profile.next_question_key),
    );
  }
});

await scenario("old shared and Base44 interpretation copies stay identical", async () => {
  const [sharedCopy, base44Copy] = await Promise.all([
    readFile(new URL("../shared/patientNeedInterpretation.js", import.meta.url), "utf8"),
    readFile(new URL("../base44/shared/patientNeedInterpretation.js", import.meta.url), "utf8"),
  ]);
  assert.equal(base44Copy, sharedCopy);
});

await scenario("AI candidate path cannot become final path", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
    explicitFacts: { locality: locality() },
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      candidate_care_paths: ["ophthalmology"],
    }),
  });
  assert.equal(profile.care_path, "unresolved");
  assert.ok(profile.candidate_care_paths.includes("ophthalmology"));
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("AI cannot replace explicitly confirmed service", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "control_vedere",
    explicitConfirmedServiceKeys: ["optometry_consultation"],
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      candidate_service_keys: ["ophthalmology_consultation"],
    }),
  });
  assert.deepEqual(profile.confirmed_service_keys, ["optometry_consultation"]);
  assert.ok(profile.candidate_service_keys.includes("ophthalmology_consultation"));
  assert.equal(profile.care_path, "optometry");
});

await scenario("AI arrays and evidence are bounded", () => {
  const phrase = "vreau un control";
  const raw = validAI({
    alternative_intents: Array.from({ length: 20 }, (_, index) => (
      index % 2 === 0 ? "control_copil" : "investigatii"
    )),
    candidate_service_keys: Array.from({ length: 30 }, () => "oct"),
    candidate_care_paths: Array.from({ length: 20 }, () => "ophthalmology"),
    possible_safety_flags: Array.from({ length: 20 }, () => "severe_eye_pain"),
    evidence_phrases: Array.from({ length: 20 }, () => phrase),
  });
  const sanitized = sanitizePatientGuidancePlannerProposal(raw, {
    text: "Vreau un control acum.",
  });
  assert.ok(sanitized.proposal.alternative_intents.length <= 3);
  assert.ok(sanitized.proposal.candidate_service_keys.length <= 12);
  assert.ok(sanitized.proposal.candidate_care_paths.length <= 5);
  assert.ok(sanitized.proposal.possible_safety_flags.length <= 6);
  assert.ok(sanitized.proposal.evidence_phrases.length <= 5);
});

await scenario("unknown top-level AI keys are removed", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal({
    ...validAI(),
    diagnosis: "invented",
    providers: [{ id: "provider" }],
    ranking: [1, 2, 3],
  });
  assert.deepEqual(
    Object.keys(sanitized.proposal).sort(),
    [...PATIENT_GUIDANCE_PLANNER_AI_FIELDS].sort(),
  );
  assert.equal(sanitized.diagnostics.unknown_field_count, 3);
});

await scenario("AI failure never declares safe or invents route", async () => {
  const profile = await runPatientGuidancePlannerShadow({
    text: "Nu stiu unde trebuie sa merg.",
  }, {
    invokeAI: async () => {
      throw new Error("unavailable");
    },
  });
  assert.equal(profile.ai_status, "unavailable");
  assert.equal(profile.safety_state, "unchecked");
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("confirmed fact sources exclude AI candidates", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "control_vedere",
    explicitFacts: { locality: locality("Cluj-Napoca") },
    deterministicFacts: { routine_vs_symptom: "routine" },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      extracted_facts: [
        { fact_key: "locality", value: "Iasi" },
        { fact_key: "routine_vs_symptom", value: "symptom" },
        { fact_key: "timing", value: "zilele_urmatoare" },
      ],
    }),
  });
  assert.equal(profile.confirmed_facts.locality.city, "Cluj-Napoca");
  assert.equal(profile.confirmed_facts.routine_vs_symptom, "routine");
  assert.equal(Object.hasOwn(profile.confirmed_facts, "timing"), false);
  assert.equal(profile.fact_sources.locality, "explicit_user");
  assert.equal(profile.fact_sources.routine_vs_symptom, "deterministic");
  assert.equal(Object.hasOwn(profile.fact_sources, "timing"), false);
  assert.ok(profile.ai_candidate_facts.some((fact) => fact.fact_key === "timing"));
});

await scenario("AI-only service remains candidate and cannot resolve search", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "investigatii",
      candidate_service_keys: ["oct"],
      extracted_facts: [{ fact_key: "investigation_type", value: "oct" }],
      candidate_care_paths: ["specialized_ophthalmology"],
    }),
  });
  assert.deepEqual(profile.candidate_service_keys, ["oct"]);
  assert.deepEqual(profile.confirmed_service_keys, []);
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("guided answer outranks deterministic and AI facts", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
    guidedAnswers: [
      { question_key: "routine_vs_symptom", answer_value: "symptom" },
      { question_key: "locality", answer_value: "Cluj-Napoca" },
    ],
    deterministicFacts: { routine_vs_symptom: "routine" },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      extracted_facts: [{ fact_key: "routine_vs_symptom", value: "routine" }],
    }),
  });
  assert.equal(profile.known_facts.routine_vs_symptom, "symptom");
  assert.equal(profile.fact_sources.routine_vs_symptom, "guided_answer");
  assert.equal(profile.care_path, "ophthalmology");
});

await scenario("invalid evidence phrase is discarded", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    evidence_phrases: ["OCT", "diagnostic inventat"],
  }), { text: "Pe recomandare scrie OCT macular." });
  assert.deepEqual(sanitized.proposal.evidence_phrases, ["OCT"]);
});

await scenario("planner prompt forbids uncontrolled outputs", async () => {
  let request;
  await runPatientGuidancePlannerShadow({
    text: "Vreau un control.",
  }, {
    invokeAI: async (value) => {
      request = value;
      return validAI();
    },
  });
  assert.match(request.prompt, /Never return free text for a next question/);
  assert.match(request.prompt, /Never diagnose/);
  assert.match(request.prompt, /rank providers/);
  assert.match(request.prompt, /approve clinical rules/);
  assert.equal(
    Object.hasOwn(request.response_json_schema.properties, "clinical_validation_approvals"),
    false,
  );
});

await scenario("planner is not wired into live Base44 function", async () => {
  const source = await readFile(
    new URL("../base44/functions/matchProvidersSemantic/entry.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /patientGuidancePlanner/);
  assert.doesNotMatch(source, /patient-guidance-planner-v1/);
});


await scenario("generic control with AI routine and locality remains insufficient", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control in Cluj.",
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      extracted_facts: [
        {
          fact_key: "routine_vs_symptom",
          value: "routine",
          evidence_phrase: "control",
        },
        {
          fact_key: "locality",
          value: "Cluj",
          evidence_phrase: "Cluj",
        },
      ],
    }),
  });
  assert.equal(profile.confirmed_primary_intent, "control_vedere");
  assert.deepEqual(profile.confirmed_facts, {});
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.ai_candidate_facts.length, 2);
});

await scenario("AI-only intent remains candidate", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Nu stiu unde trebuie sa merg.",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "investigatii",
      alternative_intents: ["control_vedere"],
    }),
  });
  assert.equal(profile.confirmed_primary_intent, "unknown");
  assert.equal(profile.ai_proposed_primary_intent, "investigatii");
  assert.ok(profile.candidate_intents.includes("investigatii"));
  assert.equal(profile.primary_intent, "unknown");
  assert.equal(profile.care_path, "unresolved");
});

await scenario("AI repair type cannot resolve technical route", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Rama mea are o problema.",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "reparatii_ochelari",
      extracted_facts: [{
        fact_key: "repair_type",
        value: "broken_frame",
        evidence_phrase: "Rama",
      }],
      candidate_care_paths: ["technical_optical_service"],
    }),
  });
  assert.equal(profile.confirmed_primary_intent, "unknown");
  assert.equal(Object.hasOwn(profile.confirmed_facts, "repair_type"), false);
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("AI locality does not satisfy completeness", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "control_vedere",
    explicitFacts: { routine_vs_symptom: "routine" },
    deterministicSafetyState: "clear",
    text: "Vreau un control in Iasi.",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      extracted_facts: [{
        fact_key: "locality",
        value: "Iasi",
        evidence_phrase: "Iasi",
      }],
    }),
  });
  assert.equal(Object.hasOwn(profile.confirmed_facts, "locality"), false);
  assert.ok(profile.missing_required_facts.includes("locality"));
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("AI safety targeted check cannot complete safety", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "simptome_oftalmologice",
    explicitFacts: {
      symptom_description: "ochii sunt rosii",
      locality: locality(),
    },
    deterministicSafetyState: "clear",
    text: "Ochii sunt rosii, niciuna dintre situatiile grave.",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "simptome_oftalmologice",
      extracted_facts: [{
        fact_key: "safety_targeted_check",
        value: "niciuna",
        evidence_phrase: "niciuna",
      }],
    }),
  });
  assert.equal(Object.hasOwn(profile.confirmed_facts, "safety_targeted_check"), false);
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(profile.missing_required_facts.includes("safety_targeted_check"));
});

await scenario("AI contact lens experience cannot activate route", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "lentile_contact",
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
    text: "Este prima data.",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "lentile_contact",
      extracted_facts: [{
        fact_key: "contact_lens_experience",
        value: "first_time",
        evidence_phrase: "prima data",
      }],
      candidate_care_paths: ["optometry"],
    }),
  });
  assert.equal(Object.hasOwn(profile.confirmed_facts, "contact_lens_experience"), false);
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("invented routine versus symptom value is rejected", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    extracted_facts: [{
      fact_key: "routine_vs_symptom",
      value: "maybe_routine",
      evidence_phrase: "control",
    }],
  }), { text: "Vreau un control." });
  assert.deepEqual(sanitized.proposal.extracted_facts, []);
  assert.equal(sanitized.diagnostics.rejected_fact_count, 1);
});

await scenario("invented timing value is rejected", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    extracted_facts: [{
      fact_key: "timing",
      value: "maine_la_pranz",
      evidence_phrase: "maine",
    }],
  }), { text: "As vrea maine." });
  assert.deepEqual(sanitized.proposal.extracted_facts, []);
  assert.equal(sanitized.diagnostics.rejected_fact_count, 1);
});

await scenario("invented safety targeted value is rejected", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    extracted_facts: [{
      fact_key: "safety_targeted_check",
      value: "pare_sigur",
      evidence_phrase: "sigur",
    }],
  }), { text: "Pare sigur." });
  assert.deepEqual(sanitized.proposal.extracted_facts, []);
  assert.equal(sanitized.diagnostics.rejected_fact_count, 1);
});

await scenario("free text without evidence is unsupported", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am o problema la ochi.",
  }, {
    status: "completed",
    raw: validAI({
      extracted_facts: [{
        fact_key: "symptom_description",
        value: "ochi rosu",
      }],
    }),
  });
  assert.equal(profile.ai_candidate_facts[0].status, "unsupported");
  assert.equal(profile.ai_candidate_facts[0].evidence_phrase, null);
  assert.equal(Object.hasOwn(profile.confirmed_facts, "symptom_description"), false);
});

await scenario("nonexistent evidence phrase is rejected", () => {
  const sanitized = sanitizePatientGuidancePlannerProposal(validAI({
    extracted_facts: [{
      fact_key: "symptom_description",
      value: "ochi rosu",
      evidence_phrase: "vedere pierduta",
    }],
  }), { text: "Am un ochi rosu." });
  assert.equal(sanitized.proposal.extracted_facts[0].status, "unsupported");
  assert.equal(sanitized.proposal.extracted_facts[0].evidence_phrase, null);
  assert.equal(sanitized.diagnostics.rejected_evidence_phrase_count, 1);
});

await scenario("explicit optometry overrides deterministic ophthalmology service", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Consult oftalmologic.",
    explicitPrimaryIntent: "control_vedere",
    explicitConfirmedServiceKeys: ["optometry_consultation"],
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["optometry_consultation"]);
  assert.deepEqual(profile.candidate_service_keys, ["ophthalmology_consultation"]);
  assert.deepEqual(profile.deterministic_service_conflicts, ["ophthalmology_consultation"]);
  assert.equal(profile.care_path, "optometry");
});

await scenario("conflicting deterministic service remains candidate", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "control_vedere",
    explicitConfirmedServiceKeys: ["optometry_consultation"],
    deterministicServiceKeys: ["ophthalmology_consultation"],
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["optometry_consultation"]);
  assert.deepEqual(profile.candidate_service_keys, ["ophthalmology_consultation"]);
  assert.equal(profile.ai_validation.deterministic_service_conflict, true);
});

await scenario("guided choice still determines route", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Vreau un control.",
    guidedAnswers: [
      { question_key: "routine_vs_symptom", answer_value: "routine" },
      { question_key: "locality", answer_value: "Cluj-Napoca" },
    ],
    deterministicSafetyState: "clear",
  });
  assert.equal(profile.confirmed_facts.routine_vs_symptom, "routine");
  assert.equal(profile.fact_sources.routine_vs_symptom, "guided_answer");
  assert.equal(profile.care_path, "optometry");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("deterministic OCT and explicit locality remain sufficient", () => {
  const profile = buildPatientGuidancePlannerProfile({
    deterministicIntent: "investigatii",
    deterministicServiceKeys: ["oct"],
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, ["oct"]);
  assert.equal(profile.confirmed_facts.investigation_type, "oct");
  assert.equal(profile.sufficient_for_search, true);
});

await scenario("AI-only service remains candidate after separation", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "investigatii",
      candidate_service_keys: ["oct"],
    }),
  });
  assert.deepEqual(profile.confirmed_service_keys, []);
  assert.deepEqual(profile.candidate_service_keys, ["oct"]);
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("AI-only fact remains candidate after separation", () => {
  const profile = buildPatientGuidancePlannerProfile({
    text: "Am nevoie in zilele urmatoare.",
  }, {
    status: "completed",
    raw: validAI({
      extracted_facts: [{
        fact_key: "timing",
        value: "zilele_urmatoare",
        evidence_phrase: "zilele urmatoare",
      }],
    }),
  });
  assert.equal(Object.hasOwn(profile.confirmed_facts, "timing"), false);
  assert.equal(profile.ai_candidate_facts[0].status, "supported");
  assert.equal(profile.ai_candidate_facts[0].confirmation_eligible, false);
});

await scenario("AI-only intent cannot make search sufficient", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitFacts: {
      locality: locality(),
      investigation_type: "oct",
    },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "investigatii",
      candidate_service_keys: ["oct"],
      candidate_care_paths: ["specialized_ophthalmology"],
    }),
  });
  assert.equal(profile.confirmed_primary_intent, "unknown");
  assert.equal(profile.primary_intent, "unknown");
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

await scenario("safety blocking remains prioritary after separation", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "control_vedere",
    explicitConfirmedServiceKeys: ["optometry_consultation"],
    explicitFacts: { locality: locality() },
    deterministicSafetyState: "blocking",
  }, {
    status: "completed",
    raw: validAI({
      primary_intent: "control_vedere",
      candidate_care_paths: ["optometry"],
    }),
  });
  assert.equal(profile.care_path, "emergency_interruption");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.routing_profile.fallback_mode, "safety_interruption");
});

await scenario("clinical validation approvals remain empty", () => {
  const profile = buildPatientGuidancePlannerProfile({
    explicitPrimaryIntent: "simptome_oftalmologice",
    clinicalValidationApprovals: ["symptom_safety_completion"],
    explicitFacts: {
      symptom_description: "ochi rosu",
      safety_targeted_check: "niciuna",
      locality: locality(),
    },
    deterministicSafetyState: "clear",
  }, {
    status: "completed",
    raw: {
      ...validAI(),
      clinical_validation_approvals: ["symptom_safety_completion"],
    },
  });
  assert.deepEqual(profile.clinical_validation_approvals, []);
  assert.deepEqual(profile.routing_profile.approved_validation_rule_keys, []);
  assert.equal(profile.sufficient_for_search, false);
});

assert.ok(scenarioCount >= 62);
console.log("Patient guidance planner checks passed: " + scenarioCount + " scenarios.");
