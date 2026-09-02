import assert from "node:assert/strict";
import {
  APPROVED_PATIENT_SAFETY_COPY,
  PATIENT_GUIDANCE_QUESTION_KEYS,
  getApprovedPatientGuidanceQuestion,
  resolvePatientGuidanceQuestionPlan,
} from "../shared/patientGuidanceQuestionCatalog.js";
import {
  CARE_PATH_VALUES,
  PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES,
  PATIENT_GUIDANCE_ROUTING_VERSION,
  REQUEST_CLARITY_VALUES,
  SEARCH_EXPANSION_POLICY_VALUES,
  TOP3_ELIGIBILITY_VALUES,
  buildPatientGuidanceRoutingProfile,
  buildPatientTop3EligibilityPolicy,
  canActivateNationalPatientSearch,
  classifyPatientRequestClarity,
  derivePatientCarePath,
  derivePatientSearchExpansionPolicy,
  detectPatientGuidanceSignals,
  evaluatePatientTop3Eligibility,
  getPatientGuidanceCompletenessPolicy,
  isPatientGuidanceClinicalRuleApproved,
} from "../shared/patientGuidanceRouting.js";

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

scenario("contract version", () => {
  assert.equal(PATIENT_GUIDANCE_ROUTING_VERSION, "patient-guidance-routing-v1");
  assert.deepEqual(REQUEST_CLARITY_VALUES, ["exact", "partial", "guided"]);
  assert.ok(CARE_PATH_VALUES.includes("specialized_ophthalmology"));
  assert.ok(SEARCH_EXPANSION_POLICY_VALUES.includes("national_opt_in"));
  assert.ok(TOP3_ELIGIBILITY_VALUES.includes("directory_only"));
});

scenario("approved question keys", () => {
  for (const key of [
    "routine_vs_symptom",
    "for_whom",
    "child_age_group",
    "investigation_type",
    "investigation_reference_text",
    "optical_product_type",
    "contact_lens_experience",
    "repair_type",
    "symptom_description",
    "symptom_timing_or_acuity",
    "locality",
    "timing",
    "safety_targeted_check",
  ]) assert.ok(PATIENT_GUIDANCE_QUESTION_KEYS.includes(key));
});

scenario("planner rejects invented question", () => {
  assert.deepEqual(resolvePatientGuidanceQuestionPlan("invented_question"), {
    status: "rejected",
    question_key: null,
    question: null,
  });
});

scenario("planner receives approved options only", () => {
  const plan = resolvePatientGuidanceQuestionPlan("investigation_type");
  assert.equal(plan.status, "approved");
  assert.deepEqual(
    plan.question.options.map((option) => option.key),
    ["oct", "visual_field_analyzer", "tonometry", "fundus_exam", "corneal_topography", "not_sure"],
  );
});

scenario("investigation reference text is approved", () => {
  const question = getApprovedPatientGuidanceQuestion("investigation_reference_text");
  assert.equal(question.type, "text");
  // Titlu actualizat 2026-09-01 (rescrierea chestionarului).
  assert.equal(question.title, "Ce scrie pe trimitere?");
  assert.equal(resolvePatientGuidanceQuestionPlan("investigation_reference_text").status, "approved");
});

scenario("not sure investigation has no automatic service mapping", () => {
  const question = getApprovedPatientGuidanceQuestion("investigation_type");
  const notSure = question.options.find((option) => option.key === "not_sure");
  assert.deepEqual(notSure.service_keys, []);
});

scenario("approved safety copy preserved", () => {
  const safetyQuestion = getApprovedPatientGuidanceQuestion("safety_targeted_check");
  assert.ok(safetyQuestion.options.some((option) => option.label === "Niciuna dintre acestea"));
  assert.match(APPROVED_PATIENT_SAFETY_COPY.chemical_instruction, /cel puțin 20 de minute/);
  assert.match(APPROVED_PATIENT_SAFETY_COPY.emergency_instruction, /Nu conduce/);
  assert.match(APPROVED_PATIENT_SAFETY_COPY.disclaimer, /nu reprezintă diagnostic sau triaj medical/);
});

scenario("OCT exact detection", () => {
  const signals = detectPatientGuidanceSignals("OCT in Cluj");
  assert.equal(signals.proposed_intent, "investigatii");
  assert.deepEqual(signals.exact_service_keys, ["oct"]);
});

scenario("OCT word boundary", () => {
  const signals = detectPatientGuidanceSignals("Caut un doctor in Cluj");
  assert.ok(!signals.exact_service_keys.includes("oct"));
  assert.notEqual(signals.proposed_intent, "investigatii");
});

scenario("frame repair exact detection", () => {
  const signals = detectPatientGuidanceSignals("reparatie rama in Sibiu");
  assert.equal(signals.proposed_intent, "reparatii_ochelari");
  assert.deepEqual(signals.exact_service_keys, ["frame_repair"]);
  assert.equal(signals.text_technical, true);
});

scenario("broken frame plural detection", () => {
  assert.deepEqual(
    detectPatientGuidanceSignals("Am doua rame rupte").exact_service_keys,
    ["frame_repair"],
  );
});

scenario("frame adjustment detection", () => {
  assert.deepEqual(
    detectPatientGuidanceSignals("Am nevoie de reglaj rama").exact_service_keys,
    ["eyeglasses_adjustment"],
  );
});

scenario("child consult singular", () => {
  assert.equal(detectPatientGuidanceSignals("consult pentru copil").proposed_intent, "control_copil");
});

scenario("child consult plural", () => {
  assert.equal(detectPatientGuidanceSignals("consult pentru copii").proposed_intent, "control_copil");
  assert.equal(detectPatientGuidanceSignals("consult copii").proposed_intent, "control_copil");
});

scenario("red eyes with diacritics", () => {
  const signals = detectPatientGuidanceSignals("Am ochii rosii");
  assert.equal(signals.proposed_intent, "simptome_oftalmologice");
  assert.equal(signals.text_symptomatic, true);
});

scenario("generic investigation singular and plural", () => {
  assert.equal(detectPatientGuidanceSignals("Caut o investigatie").proposed_intent, "investigatii");
  assert.equal(detectPatientGuidanceSignals("Caut investigatii").proposed_intent, "investigatii");
});

scenario("corneal topography diacritics", () => {
  const signals = detectPatientGuidanceSignals("Topografie corneana in Iasi");
  assert.deepEqual(signals.exact_service_keys, ["corneal_topography"]);
});

scenario("ophthalmology term does not force symptom intent", () => {
  const signals = detectPatientGuidanceSignals("consult oftalmologic");
  assert.equal(signals.text_medical_term_only, true);
  assert.equal(signals.text_symptomatic, false);
  assert.notEqual(signals.proposed_intent, "simptome_oftalmologice");
});

scenario("exact OCT clarity", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "OCT in Cluj",
    intent: "investigatii",
    confirmedServiceKeys: ["oct"],
    missingRequiredFacts: [],
    safetyState: "clear",
  }), "exact");
});

scenario("exact repair clarity", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "reparatie rama in Sibiu",
    intent: "reparatii_ochelari",
    confirmedServiceKeys: ["frame_repair"],
    missingRequiredFacts: [],
  }), "exact");
});

scenario("child consult partial clarity", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "consult pentru copil",
    intent: "control_copil",
    missingRequiredFacts: ["child_age_group", "locality"],
  }), "partial");
});

scenario("generic control partial clarity", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "vreau un control",
    intent: "control_vedere",
    missingRequiredFacts: ["locality"],
  }), "partial");
});

scenario("unknown request guided clarity", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "nu stiu unde sa merg",
    intent: "unknown",
    missingRequiredFacts: ["routine_vs_symptom"],
  }), "guided");
});

scenario("symptomatic request guided until safety", () => {
  assert.equal(classifyPatientRequestClarity({
    text: "am ochii rosii",
    intent: "simptome_oftalmologice",
    safetyState: "unchecked",
    missingRequiredFacts: ["safety_targeted_check"],
  }), "guided");
});

const octProfile = buildPatientGuidanceRoutingProfile({
  text: "OCT in Cluj",
  primaryIntent: "investigatii",
  candidateServiceKeys: ["oct"],
  confirmedServiceKeys: ["oct"],
  confirmedFacts: {
    investigation_type: "oct",
    locality: { siruta_code: "54984", city: "Cluj-Napoca" },
  },
  safetyState: "clear",
  clinicalValidationApprovals: ["specialized_service_trust_threshold"],
});

scenario("OCT locality sufficient for search", () => {
  assert.equal(octProfile.request_clarity, "exact");
  assert.equal(octProfile.care_path, "specialized_ophthalmology");
  assert.equal(octProfile.sufficient_for_search, true);
  assert.equal(octProfile.sufficient_for_provider_request, false);
  assert.equal(octProfile.next_question_key, "timing");
});

scenario("OCT timing completes provider request", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedServiceKeys: ["oct"],
    confirmedFacts: {
      investigation_type: "oct",
      locality: "Cluj-Napoca",
      timing: "zilele_urmatoare",
    },
    safetyState: "clear",
  });
  assert.equal(profile.sufficient_for_provider_request, true);
});

const repairProfile = buildPatientGuidanceRoutingProfile({
  text: "reparatie rama in Sibiu",
  primaryIntent: "reparatii_ochelari",
  candidateServiceKeys: ["frame_repair"],
  confirmedServiceKeys: ["frame_repair"],
  confirmedFacts: {
    repair_type: "broken_frame",
    locality: "Sibiu",
  },
  safetyState: "clear",
});

scenario("repair locality sufficient for search", () => {
  assert.equal(repairProfile.care_path, "technical_optical_service");
  assert.equal(repairProfile.sufficient_for_search, true);
  assert.equal(repairProfile.sufficient_for_provider_request, false);
  assert.equal(repairProfile.search_expansion_policy, "local_then_county");
});

scenario("unknown investigation insufficient", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedFacts: { locality: "Brasov" },
    safetyState: "clear",
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.next_question_key, "investigation_type");
  assert.equal(profile.care_path, "unresolved");
});

scenario("unknown investigation requests reference text without consultation fallback", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedFacts: {
      investigation_type: "not_sure",
      locality: "Brasov",
    },
    safetyState: "clear",
  });
  assert.deepEqual(profile.confirmed_service_keys, []);
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.next_question_key, "investigation_reference_text");
});

scenario("unknown investigation reference remains unresolved until canonical service confirmation", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedFacts: {
      investigation_type: "not_sure",
      investigation_reference_text: "investigatia notata pe bilet",
      locality: "Brasov",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.next_question_key, null);
});

scenario("explicitly confirmed consultation can resolve unknown investigation", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      investigation_type: "not_sure",
      investigation_reference_text: "utilizatorul a clarificat ca doreste consultatie",
      locality: "Brasov",
    },
    safetyState: "clear",
  });
  assert.equal(profile.sufficient_for_search, true);
  assert.equal(profile.care_path, "ophthalmology");
});

scenario("symptom safety unchecked blocks ordinary search", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    text: "am ochii rosii",
    primaryIntent: "simptome_oftalmologice",
    candidateServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      symptom_description: "ochii sunt rosii",
      locality: "Oradea",
    },
    safetyState: "unchecked",
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(profile.missing_required_facts.includes("safety_targeted_check"));
});

scenario("symptom safety clear enables search before provider request", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    text: "am ochii rosii",
    primaryIntent: "simptome_oftalmologice",
    candidateServiceKeys: ["ophthalmology_consultation"],
    confirmedServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      symptom_description: "ochii sunt rosii",
      safety_targeted_check: "niciuna",
      locality: "Oradea",
    },
    safetyState: "clear",
    clinicalValidationApprovals: ["symptom_safety_completion"],
  });
  assert.equal(profile.sufficient_for_search, true);
  assert.equal(profile.sufficient_for_provider_request, false);
  assert.equal(profile.next_question_key, "symptom_timing_or_acuity");
});

scenario("symptom provider request completeness", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    confirmedServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      symptom_description: "roseata persistenta",
      symptom_timing_or_acuity: "recent",
      safety_targeted_check: "niciuna",
      for_whom: "adult",
      locality: "Oradea",
      timing: "cat_mai_repede",
    },
    safetyState: "clear",
    clinicalValidationApprovals: ["symptom_safety_completion"],
  });
  assert.equal(profile.sufficient_for_provider_request, true);
});

scenario("generic adult control with locality requires routine clarification", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_vedere",
    candidateServiceKeys: ["optometry_consultation"],
    confirmedFacts: { locality: "Timisoara" },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.deepEqual(profile.candidate_care_paths, ["optometry", "ophthalmology"]);
  assert.ok(profile.missing_required_facts.includes("routine_vs_symptom"));
  assert.equal(profile.sufficient_for_search, false);
});

scenario("exact optometric adult control skips routine clarification", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_vedere",
    confirmedServiceKeys: ["optometry_consultation"],
    // 2026-09-01: for_whom e acum obligatoriu pentru control_vedere. Serviciul numit exact
    // scuteste clarificarea rutina/simptom, dar nu spune pentru cine este consultul.
    confirmedFacts: { locality: "Timisoara", for_whom: "adult" },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "optometry");
  assert.deepEqual(profile.candidate_care_paths, ["optometry"]);
  assert.ok(!profile.missing_required_facts.includes("routine_vs_symptom"));
  assert.equal(profile.sufficient_for_search, true);
  assert.equal(profile.sufficient_for_provider_request, false);
});

scenario("exact ophthalmology consultation resolves adult care path", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_vedere",
    confirmedServiceKeys: ["ophthalmology_consultation"],
    // 2026-09-01: for_whom e acum obligatoriu pentru control_vedere.
    confirmedFacts: { locality: "Timisoara", for_whom: "adult" },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "ophthalmology");
  assert.equal(profile.sufficient_for_search, true);
});

scenario("generic adult routine answer resolves optometry deterministically", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_vedere",
    confirmedFacts: {
      routine_vs_symptom: "routine",
      // 2026-09-01: for_whom e acum obligatoriu pentru control_vedere.
      for_whom: "adult",
      locality: "Timisoara",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "optometry");
  assert.equal(profile.sufficient_for_search, true);
});

scenario("child age and routine clarification are required for first search", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    candidateServiceKeys: ["children_eye_exam"],
    confirmedFacts: { locality: "Alba Iulia" },
    safetyState: "clear",
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.next_question_key, "child_age_group");
  assert.ok(profile.missing_required_facts.includes("routine_vs_symptom"));
});

scenario("generic child control never defaults to optometry", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedFacts: {
      child_age_group: "7_12",
      routine_vs_symptom: "routine",
      locality: "Alba Iulia",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(profile.blocking_validation_rule_keys.includes("pediatric_age_to_care_path"));
});

scenario("generic child control exposes compatible candidate paths", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedFacts: { locality: "Alba Iulia" },
    safetyState: "clear",
  });
  assert.deepEqual(profile.candidate_care_paths, ["optometry", "ophthalmology"]);
  assert.ok(profile.candidate_care_paths.every((value) => CARE_PATH_VALUES.includes(value)));
});

scenario("exact pediatric ophthalmology can skip routine clarification", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedServiceKeys: ["pediatric_ophthalmology"],
    confirmedFacts: {
      child_age_group: "7_12",
      locality: "Alba Iulia",
    },
    safetyState: "clear",
    clinicalValidationApprovals: ["pediatric_age_to_care_path"],
  });
  assert.equal(profile.care_path, "specialized_ophthalmology");
  assert.ok(!profile.missing_required_facts.includes("routine_vs_symptom"));
  assert.equal(profile.sufficient_for_search, true);
  assert.ok(profile.approved_validation_rule_keys.includes("pediatric_age_to_care_path"));
});

scenario("ambiguous pediatric exam stays unresolved", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedServiceKeys: ["children_eye_exam"],
    confirmedFacts: {
      child_age_group: "7_12",
      routine_vs_symptom: "routine",
      locality: "Alba Iulia",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
});

scenario("generic contact lens request stays unresolved", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "lentile_contact",
    candidateServiceKeys: ["contact_lenses"],
    confirmedFacts: {
      contact_lens_experience: "experienced",
      locality: "Iasi",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.deepEqual(profile.candidate_care_paths, ["optical_store", "optometry", "ophthalmology"]);
  assert.equal(profile.sufficient_for_search, false);
});

scenario("confirmed contact lens product resolves optical store", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "lentile_contact",
    confirmedServiceKeys: ["contact_lenses"],
    confirmedFacts: { locality: "Iasi" },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "optical_store");
  assert.equal(profile.sufficient_for_search, true);
});

scenario("first contact lens fitting remains blocked by clinical validation", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "lentile_contact",
    confirmedServiceKeys: ["contact_lens_fitting"],
    confirmedFacts: {
      contact_lens_experience: "first_time",
      locality: "Iasi",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(profile.blocking_validation_rule_keys.includes("contact_lens_first_time_path"));
  assert.deepEqual(profile.candidate_care_paths, ["optical_store", "optometry", "ophthalmology"]);
});

scenario("optical product type required for first search", () => {
  const policy = getPatientGuidanceCompletenessPolicy("ochelari_lentile");
  assert.ok(policy.required_for_search.includes("optical_product_type"));
  assert.ok(!policy.required_for_search.includes("timing"));
  assert.ok(policy.required_for_provider_request.includes("timing"));
});

scenario("unknown remains unresolved after generic answer", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "unknown",
    confirmedFacts: { routine_vs_symptom: "not_sure" },
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.fallback_mode, "guided_questions");
});

scenario("care path optometry", () => {
  assert.equal(derivePatientCarePath({
    confirmedServiceKeys: ["optometry_consultation"],
    safetyState: "clear",
  }), "optometry");
});

scenario("care path ophthalmology", () => {
  assert.equal(derivePatientCarePath({
    confirmedServiceKeys: ["ophthalmology_consultation"],
    safetyState: "clear",
  }), "ophthalmology");
});

scenario("care path specialized ophthalmology", () => {
  assert.equal(derivePatientCarePath({
    confirmedServiceKeys: ["corneal_topography"],
    safetyState: "clear",
  }), "specialized_ophthalmology");
});

scenario("care path optical store", () => {
  assert.equal(derivePatientCarePath({
    confirmedServiceKeys: ["frames"],
    safetyState: "clear",
  }), "optical_store");
});

scenario("care path technical optical service", () => {
  assert.equal(derivePatientCarePath({
    confirmedServiceKeys: ["eyeglasses_adjustment"],
    safetyState: "clear",
  }), "technical_optical_service");
});

scenario("safety blocking interrupts care path", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    candidateServiceKeys: ["ophthalmology_consultation"],
    confirmedServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      symptom_description: "nu mai vad cu un ochi",
      safety_targeted_check: "pierdere_brusca_vedere",
      locality: "Bucuresti",
    },
    safetyState: "blocking",
    clinicalValidationApprovals: PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES
      .map((rule) => rule.rule_key),
  });
  assert.equal(profile.care_path, "emergency_interruption");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.fallback_mode, "safety_interruption");
});

scenario("invented service key is removed", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_vedere",
    candidateServiceKeys: ["invented_service", "optometry_consultation"],
    confirmedServiceKeys: ["invented_service"],
    confirmedFacts: { locality: "Craiova" },
  });
  assert.deepEqual(profile.candidate_service_keys, ["optometry_consultation"]);
  assert.deepEqual(profile.confirmed_service_keys, []);
});

scenario("frame adjustment stays local only", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["eyeglasses_adjustment"],
    carePath: "technical_optical_service",
  }), "local_only");
});

scenario("frame repair expands locally then county", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["frame_repair"],
    carePath: "technical_optical_service",
  }), "local_then_county");
});

scenario("metal frame soldering expands locally then county", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["metal_frame_soldering"],
    carePath: "technical_optical_service",
  }), "local_then_county");
});

scenario("technical service overrides never activate national search", () => {
  for (const serviceKey of [
    "eyeglasses_adjustment",
    "screw_replacement",
    "nose_pad_replacement",
    "frame_cleaning",
    "ultrasonic_cleaning",
    "eyeglasses_repair",
    "frame_repair",
    "hinge_repair",
    "metal_frame_soldering",
    "lens_replacement",
    "client_frame_lens_mounting",
  ]) {
    assert.notEqual(derivePatientSearchExpansionPolicy({
      serviceKeys: [serviceKey],
      carePath: "technical_optical_service",
    }), "national_opt_in");
  }
});

scenario("county investigation expansion", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["oct"],
    carePath: "specialized_ophthalmology",
  }), "county_default");
});

scenario("national specialty opt in", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["retina_consultation"],
    carePath: "specialized_ophthalmology",
  }), "national_opt_in");
});

scenario("local then county optometry", () => {
  assert.equal(derivePatientSearchExpansionPolicy({
    serviceKeys: ["optometry_consultation"],
    carePath: "optometry",
  }), "local_then_county");
});

scenario("national search requires explicit confirmation", () => {
  assert.equal(canActivateNationalPatientSearch({
    searchExpansionPolicy: "national_opt_in",
    userConfirmed: false,
    safetyState: "clear",
    carePath: "specialized_ophthalmology",
    sufficientForSearch: true,
  }), false);
});

scenario("national search allowed after explicit confirmation", () => {
  assert.equal(canActivateNationalPatientSearch({
    searchExpansionPolicy: "national_opt_in",
    userConfirmed: true,
    safetyState: "clear",
    carePath: "specialized_ophthalmology",
    sufficientForSearch: true,
  }), true);
});

scenario("national search denied by safety blocking", () => {
  assert.equal(canActivateNationalPatientSearch({
    searchExpansionPolicy: "national_opt_in",
    userConfirmed: true,
    safetyState: "blocking",
    carePath: "specialized_ophthalmology",
    sufficientForSearch: true,
  }), false);
});

scenario("national search denied when route incomplete", () => {
  assert.equal(canActivateNationalPatientSearch({
    searchExpansionPolicy: "national_opt_in",
    userConfirmed: true,
    safetyState: "clear",
    carePath: "unresolved",
    sufficientForSearch: false,
  }), false);
});

const exactOctCandidate = {
  routingProfile: octProfile,
  active: true,
  published: true,
  suspended: false,
  mapping_conflict: false,
  profile_type: "ophthalmology_clinic",
  professional_types: ["ophthalmologist"],
  service_key: "oct",
  service_confirmed: true,
  service_confirmation_level: "vezunde_verified",
  service_matching_eligible: true,
  trust_level: "verified",
  in_search_area: true,
  in_expansion_area: false,
};

scenario("exact medical Top 3", () => {
  assert.equal(evaluatePatientTop3Eligibility(exactOctCandidate).eligibility, "exact_top3");
});

scenario("medical location without exact service is extended", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    service_confirmed: false,
  }).eligibility, "extended_relevant");
});

scenario("expanded county result is extended", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    in_search_area: false,
    in_expansion_area: true,
  }).eligibility, "extended_relevant");
});

scenario("directory profile stays directory only", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    trust_level: "directory",
    service_confirmation_level: "provider_confirmed",
  }).eligibility, "directory_only");
});

scenario("directory medical profile without confirmed specialist stays directory only", () => {
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    trust_level: "directory",
    professional_types: [],
  });
  assert.equal(result.eligibility, "directory_only");
  assert.ok(result.reasons.includes("required_professional_type_missing"));
});

scenario("directory profile with unconfirmed service stays directory only", () => {
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    trust_level: "directory",
    service_confirmed: false,
    service_confirmation_level: "not_confirmed",
    service_matching_eligible: false,
  });
  assert.equal(result.eligibility, "directory_only");
  assert.ok(result.reasons.includes("exact_service_not_confirmed"));
  assert.ok(result.reasons.includes("service_not_matching_eligible"));
});

scenario("directory profile can never enter exact Top 3", () => {
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    trust_level: "directory",
  });
  assert.equal(result.eligibility, "directory_only");
  assert.notEqual(result.eligibility, "exact_top3");
});

scenario("inactive location is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    active: false,
  }).eligibility, "ineligible");
});

scenario("unpublished location is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    published: false,
  }).eligibility, "ineligible");
});

scenario("suspended location is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    suspended: true,
  }).eligibility, "ineligible");
});

scenario("mapping conflict is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    mapping_conflict: true,
  }).eligibility, "ineligible");
});

scenario("incompatible profile type is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    profile_type: "independent_optician",
  }).eligibility, "ineligible");
});

scenario("missing required professional prevents exact Top 3 without structural ineligibility", () => {
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    professional_types: ["optician"],
  });
  assert.equal(result.eligibility, "extended_relevant");
  assert.ok(result.reasons.includes("required_professional_type_missing"));
});

scenario("invented service cannot enter Top 3", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    service_key: "invented_service",
  }).eligibility, "ineligible");
});

scenario("repair optical store exact Top 3", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    routingProfile: repairProfile,
    active: true,
    published: true,
    suspended: false,
    mapping_conflict: false,
    profile_type: "independent_optical_store",
    professional_types: ["optician"],
    service_key: "frame_repair",
    service_confirmed: true,
    service_confirmation_level: "provider_confirmed",
    service_matching_eligible: true,
    trust_level: "claimed",
    in_search_area: true,
    in_expansion_area: false,
  }).eligibility, "exact_top3");
});

scenario("repair incompatible medical professional is ineligible", () => {
  assert.equal(evaluatePatientTop3Eligibility({
    routingProfile: repairProfile,
    active: true,
    published: true,
    suspended: false,
    mapping_conflict: false,
    profile_type: "independent_ophthalmologist",
    professional_types: ["ophthalmologist"],
    service_key: "frame_repair",
    service_confirmed: true,
    service_confirmation_level: "provider_confirmed",
    service_matching_eligible: true,
    trust_level: "verified",
    in_search_area: true,
  }).eligibility, "ineligible");
});

scenario("routing profile minimum fields", () => {
  for (const key of [
    "request_clarity",
    "primary_intent",
    "alternative_intents",
    "confirmed_facts",
    "missing_required_facts",
    "candidate_service_keys",
    "confirmed_service_keys",
    "care_path",
    "candidate_care_paths",
    "allowed_profile_types",
    "required_professional_types",
    "safety_state",
    "sufficient_for_search",
    "sufficient_for_provider_request",
    "next_question_key",
    "next_question_reason",
    "clinical_validation_approvals",
    "clinical_validation_status",
    "blocking_validation_rule_keys",
    "approved_validation_rule_keys",
    "search_expansion_policy",
    "top3_eligibility_policy",
    "fallback_mode",
  ]) assert.ok(Object.hasOwn(octProfile, key), key);
});

scenario("clinical validation rules are explicit and non-live", () => {
  assert.ok(PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES.length >= 4);
  assert.ok(PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES
    .every((rule) => (
      rule.status === "requires_clinical_validation"
      && rule.affects_current_results === false
      && rule.blocks_activation === true
    )));
  assert.deepEqual(
    PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES.map((rule) => rule.rule_key).sort(),
    [
      "contact_lens_first_time_path",
      "pediatric_age_to_care_path",
      "specialized_service_trust_threshold",
      "symptom_safety_completion",
    ],
  );
});

scenario("unresolved care path can never be sufficient for search", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedFacts: {
      child_age_group: "13_18",
      routine_vs_symptom: "routine",
      locality: "Sibiu",
      timing: "nu_e_urgent",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.sufficient_for_provider_request, false);
});


scenario("clinical approvals default to empty", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "reparatii_ochelari",
    confirmedServiceKeys: ["frame_repair"],
    confirmedFacts: {
      repair_type: "broken_frame",
      locality: "Sibiu",
    },
    safetyState: "clear",
  });
  assert.deepEqual(profile.clinical_validation_approvals, []);
  assert.deepEqual(profile.approved_validation_rule_keys, []);
  assert.equal(profile.clinical_validation_status, "clear");
});

scenario("invented clinical rule approval is rejected", () => {
  assert.equal(
    isPatientGuidanceClinicalRuleApproved("invented_rule", ["invented_rule"]),
    false,
  );
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    confirmedFacts: {
      symptom_description: "roseata",
      safety_targeted_check: "niciuna",
      locality: "Oradea",
    },
    safetyState: "clear",
    clinical_validation_approvals: ["invented_rule"],
  });
  assert.deepEqual(profile.approved_validation_rule_keys, []);
});

scenario("complete symptom remains blocked without explicit approval", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    confirmedFacts: {
      symptom_description: "roseata persistenta",
      safety_targeted_check: "niciuna",
      locality: "Oradea",
    },
    safetyState: "clear",
  });
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.sufficient_for_provider_request, false);
  assert.equal(profile.clinical_validation_status, "blocked");
  assert.ok(profile.blocking_validation_rule_keys.includes("symptom_safety_completion"));
  assert.equal(profile.next_question_reason, "clinical_validation_required");
});

scenario("complete symptom can pass search completeness after explicit approval", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    confirmedFacts: {
      symptom_description: "roseata persistenta",
      safety_targeted_check: "niciuna",
      locality: "Oradea",
    },
    safetyState: "clear",
    clinicalValidationApprovals: ["symptom_safety_completion"],
  });
  assert.equal(profile.care_path, "ophthalmology");
  assert.equal(profile.sufficient_for_search, true);
  assert.ok(!profile.blocking_validation_rule_keys.includes("symptom_safety_completion"));
});

scenario("specialized Top 3 policy is blocked without explicit approval", () => {
  const policy = buildPatientTop3EligibilityPolicy({ serviceKeys: ["oct"] });
  assert.equal(policy.activation_status, "blocked");
  assert.deepEqual(
    policy.blocking_validation_rule_keys,
    ["specialized_service_trust_threshold"],
  );
  assert.deepEqual(policy.required_trust_levels, []);
  assert.deepEqual(policy.required_service_confirmation_levels, []);
});

scenario("specialized service cannot be exact Top 3 without approval", () => {
  const unapprovedProfile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedServiceKeys: ["oct"],
    confirmedFacts: {
      investigation_type: "oct",
      locality: "Cluj-Napoca",
    },
    safetyState: "clear",
  });
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    routingProfile: unapprovedProfile,
  });
  assert.equal(result.eligibility, "extended_relevant");
  assert.ok(result.reasons.includes("clinical_validation_required"));
});

scenario("approved specialized policy applies verified thresholds", () => {
  const policy = buildPatientTop3EligibilityPolicy({
    serviceKeys: ["oct"],
    clinical_validation_approvals: ["specialized_service_trust_threshold"],
  });
  assert.equal(policy.activation_status, "clear");
  assert.deepEqual(policy.blocking_validation_rule_keys, []);
  assert.deepEqual(policy.required_trust_levels, ["verified"]);
  assert.deepEqual(policy.required_service_confirmation_levels, ["vezunde_verified"]);
});

scenario("exact pediatric service is blocked without pediatric approval", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedServiceKeys: ["pediatric_ophthalmology"],
    confirmedFacts: {
      child_age_group: "7_12",
      locality: "Alba Iulia",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.equal(profile.sufficient_for_search, false);
  assert.ok(profile.blocking_validation_rule_keys.includes("pediatric_age_to_care_path"));
});

scenario("approved pediatric route follows existing canonical rules", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "control_copil",
    confirmedServiceKeys: ["pediatric_ophthalmology"],
    confirmedFacts: {
      child_age_group: "7_12",
      locality: "Alba Iulia",
    },
    safetyState: "clear",
    clinical_validation_approvals: ["pediatric_age_to_care_path"],
  });
  assert.equal(profile.care_path, "specialized_ophthalmology");
  assert.equal(profile.sufficient_for_search, true);
});

scenario("first contact lens fitting stays unresolved without approval", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "lentile_contact",
    confirmedServiceKeys: ["contact_lens_fitting"],
    confirmedFacts: {
      contact_lens_experience: "first_time",
      locality: "Iasi",
    },
    safetyState: "clear",
  });
  assert.equal(profile.care_path, "unresolved");
  assert.ok(profile.blocking_validation_rule_keys.includes("contact_lens_first_time_path"));
});

scenario("blocks activation metadata alone never grants approval", () => {
  const rule = PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES
    .find((item) => item.rule_key === "symptom_safety_completion");
  assert.equal(rule.blocks_activation, true);
  assert.equal(
    isPatientGuidanceClinicalRuleApproved(rule.rule_key, []),
    false,
  );
  assert.equal(
    isPatientGuidanceClinicalRuleApproved(rule.rule_key, [rule.rule_key]),
    true,
  );
});

scenario("directory candidate stays directory only while specialized activation is blocked", () => {
  const unapprovedProfile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "investigatii",
    confirmedServiceKeys: ["oct"],
    confirmedFacts: {
      investigation_type: "oct",
      locality: "Cluj-Napoca",
    },
    safetyState: "clear",
  });
  const result = evaluatePatientTop3Eligibility({
    ...exactOctCandidate,
    routingProfile: unapprovedProfile,
    trust_level: "directory",
  });
  assert.equal(result.eligibility, "directory_only");
  assert.ok(result.reasons.includes("clinical_validation_required"));
});

scenario("safety interruption wins even when every clinical rule is approved", () => {
  const profile = buildPatientGuidanceRoutingProfile({
    primaryIntent: "simptome_oftalmologice",
    confirmedServiceKeys: ["ophthalmology_consultation"],
    confirmedFacts: {
      symptom_description: "pierdere brusca a vederii",
      safety_targeted_check: "pierdere_brusca_vedere",
      locality: "Bucuresti",
    },
    safetyState: "blocking",
    clinicalValidationApprovals: PATIENT_GUIDANCE_CLINICAL_VALIDATION_RULES
      .map((rule) => rule.rule_key),
  });
  assert.equal(profile.care_path, "emergency_interruption");
  assert.equal(profile.sufficient_for_search, false);
  assert.equal(profile.sufficient_for_provider_request, false);
});

assert.ok(scenarioCount >= 97, `Expected at least 97 pure scenarios, received ${scenarioCount}`);
console.log(`Patient guidance routing contract verified with ${scenarioCount} pure scenarios.`);
