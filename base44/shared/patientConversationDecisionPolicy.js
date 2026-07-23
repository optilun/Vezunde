import { getCanonicalServiceDefinition } from "./canonicalServiceRegistryExtended.js";

export const PATIENT_CONVERSATION_DECISION_POLICY_VERSION = "viasee-patient-conversation-decision-policy-v1";
export const PATIENT_CONVERSATION_SAFETY_POLICY_VERSION = "patient-eye-safety-v1.1";

export const PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE = [
  "Mergi cat mai repede la cel mai apropiat spital, UPU, camera de garda",
  "sau serviciu de urgente oftalmologice.",
  "Nu conduce daca vederea este afectata.",
].join(" ");

const PATIENT_FACING_PROFILE_TYPES = new Set([
  "independent_optical_store",
  "optical_chain",
  "ophthalmology_clinic",
  "ophthalmology_office",
  "independent_ophthalmologist",
  "independent_optometrist",
  "independent_optician",
  "optical_laboratory_b2c",
]);

const SAFETY_FLAG_PRESENTATION = Object.freeze({
  sudden_vision_loss: "pierdere brusca sau marcata a vederii",
  chemical_injury: "substanta chimica ajunsa in ochi",
  penetrating_or_high_speed_trauma: "traumatism ocular important sau obiect patruns in ochi",
  severe_eye_pain: "durere oculara severa",
  postoperative_red_eye_or_vision_change: "simptome acute dupa operatie sau injectie oculara",
  other_possible_urgent_eye_problem: "alt semnal ocular acut",
});

const SAFETY_PATTERNS = Object.freeze({
  sudden_vision_loss: [
    /\bnu mai vad deloc\b/,
    /\baproape nu mai vad deloc\b/,
    /\bnu mai vad cu un ochi (?:brusc|deodata|dintr o data|de azi)\b/,
    /\bnu mai vad brusc cu un ochi\b/,
    /\bmi a disparut brusc vederea\b/,
    /\ba disparut brusc\b.{0,80}\baproape complet\b/,
    /\bmi am pierdut vederea\b/,
    /\bpierdere brusca (?:a )?vederii\b/,
    /\bmi am pierdut brusc vederea\b/,
    /\bvederea (?:a disparut|s a dus) brusc\b/,
    /\borbire brusca\b/,
  ],
  chemical_injury: [
    /\bsubstanta chimica (?:in|la) ochi\b/,
    /\bacid (?:in|la) ochi\b/,
    /\bclor (?:in|la) ochi\b/,
    /\binalbitor (?:in|la) ochi\b/,
    /\bdetergent puternic (?:in|la) ochi\b/,
    /\bsoda caustica (?:in|la) ochi\b/,
    /\bspray de curatat (?:cuptorul|aragazul)\b.{0,40}\b(?:in|la) ochi\b/,
    /\bsolutie de curatat (?:cuptorul|aragazul)\b.{0,40}\b(?:in|la) ochi\b/,
  ],
  penetrating_or_high_speed_trauma: [
    /\bobiect (?:infipt|patruns) in ochi\b/,
    /\bsticla in ochi\b/,
    /\baschie metalica in ochi\b/,
    /\baschie de metal\b.{0,80}\binfipta in ochi\b/,
    /\bmetal in ochi dupa polizor\b/,
    /\blovitura puternica (?:in|la) ochi\b/,
  ],
  severe_eye_pain: [
    /\bdurere severa (?:la|in) ochi\b/,
    /\bdurere foarte mare (?:la|in) ochi\b/,
    /\bdurere insuportabila (?:la|in) ochi\b/,
    /\bochi rosu durere mare si greata\b/,
    /\bdurere oculara severa\b/,
    /\bma doare foarte tare ochiul\b/,
    /\bdoare foarte tare ochiul\b/,
  ],
  postoperative_red_eye_or_vision_change: [
    /\bdupa operatie la ochi nu mai vad\b/,
    /\bdupa injectie in ochi nu mai vad\b/,
    /\bochi rosu si dureros dupa operatie\b/,
    /\bdurere dupa operatie la ochi\b/,
    /\bdupa operati(?:a|e)\b.{0,120}\bochiul (?:e|este) rosu\b.{0,120}\b(?:ma doare|doare)\b.{0,120}\bvad mai prost\b/,
  ],
  other_possible_urgent_eye_problem: [
    /\bfulgerari si (?:o )?perdea\b/,
    /\bfulgere si (?:o )?perdea\b/,
    /\bumbra ca o perdea\b/,
    /\bmuste zburatoare si (?:o )?perdea\b/,
    /\bvedere dubla aparuta brusc\b/,
    /\bvad dublu deodata\b/,
  ],
});

const SAFETY_CLEAR_PATTERNS = Object.freeze({
  sudden_vision_loss: [
    /\bnu (?:e|este) brusc\b/,
    /\bnu am pierdut vederea\b/,
    /\bvad mai slab de (?:cateva|mai multe|[0-9]+) (?:zile|saptamani|luni|ani)\b/,
  ],
  chemical_injury: [
    /\bnu (?:a fost|este) substanta chimica\b/,
    /\bnu mi a intrat nimic chimic in ochi\b/,
  ],
  penetrating_or_high_speed_trauma: [
    /\bnu m am lovit la ochi\b/,
    /\bnu (?:a fost|este) traumatism\b/,
    /\bfara traumatism\b/,
  ],
  severe_eye_pain: [
    /\bnu ma doare\b/,
    /\bnu doare\b/,
    /\bfara durere\b/,
  ],
  postoperative_red_eye_or_vision_change: [
    /\bnu am fost operat(?:a)? la ochi\b/,
    /\bnu este dupa operatie\b/,
  ],
  other_possible_urgent_eye_problem: [
    /\bnu (?:e|este) brusc\b/,
    /\bnu vad dublu\b/,
    /\bnu (?:e|este) perdea\b/,
    /\bfara fulgerari\b/,
  ],
});

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, 240))
    .filter(Boolean))].slice(0, limit);
}

function normalizeText(value) {
  return clean(value, 10000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function userConversationTurns(conversation) {
  return (Array.isArray(conversation) ? conversation : [])
    .filter((turn) => turn?.role === "user")
    .map((turn) => normalizeText(turn?.content))
    .filter(Boolean);
}

function matchingSafetyFlags(text, catalog) {
  return Object.entries(catalog)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([flag]) => flag);
}

function hasLocality(locality) {
  return Boolean(clean(locality?.siruta_code, 40) || clean(locality?.city, 120));
}

function cloneLocality(value) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: clean(locality.siruta_code, 40),
    city: clean(locality.city || locality.name, 120),
    county_code: clean(locality.county_code, 40),
    county: clean(locality.county || locality.county_name, 120),
    area: clean(locality.area, 160),
  };
}

function derivedProviderProfileTypes(serviceKeys) {
  return [...new Set(unique(serviceKeys, 12).flatMap((serviceKey) => {
    const definition = getCanonicalServiceDefinition(serviceKey);
    return Array.isArray(definition?.applicable_profile_types)
      ? definition.applicable_profile_types
      : [];
  }).filter((profileType) => PATIENT_FACING_PROFILE_TYPES.has(profileType)))].slice(0, 8);
}

function deterministicAssistantMessage(nextAction) {
  if (nextAction === "show_emergency_guidance") {
    return PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE;
  }
  if (nextAction === "ask_locality") {
    return "In ce oras sau zona doresti sa cauti?";
  }
  if (nextAction === "ask_clarifying_question") {
    return "Pentru siguranta si o cautare corecta, poti clarifica pe scurt ce ai nevoie sa rezolvi?";
  }
  if (nextAction === "search_providers") {
    return "Am suficiente informatii pentru a continua cautarea.";
  }
  return "";
}

export function assessPatientConversationDeterministicSafety(conversation) {
  let activeFlags = [];
  const clearedFlags = [];

  for (const text of userConversationTurns(conversation)) {
    const turnClears = matchingSafetyFlags(text, SAFETY_CLEAR_PATTERNS);
    if (turnClears.length > 0) {
      activeFlags = activeFlags.filter((flag) => !turnClears.includes(flag));
      clearedFlags.push(...turnClears);
    }
    const turnFlags = matchingSafetyFlags(text, SAFETY_PATTERNS);
    activeFlags = [...new Set([...activeFlags, ...turnFlags])];
  }

  return {
    policy_version: PATIENT_CONVERSATION_SAFETY_POLICY_VERSION,
    blocking: activeFlags.length > 0,
    blocking_flags: activeFlags,
    cleared_flags: [...new Set(clearedFlags)],
    source: activeFlags.length > 0 ? "explicit_text" : "none",
  };
}

export function buildPatientConversationEmergencyInterpretation({
  contractVersion,
  conversation,
  runtimeContext,
} = {}) {
  const safety = assessPatientConversationDeterministicSafety(conversation);
  if (!safety.blocking) return null;

  const knownLocality = cloneLocality(runtimeContext?.known_locality);
  return {
    interpretation: {
      contract_version: clean(contractVersion, 80),
      language: "ro",
      need_summary: "Semnal ocular acut care necesita evaluare urgenta.",
      primary_intent: "simptome_oftalmologice",
      alternative_intents: [],
      care_path_candidates: ["emergency_interruption"],
      service_keys: [],
      provider_type_candidates: [],
      facts: {
        for_whom: "unknown",
        age_group: "unknown",
        locality: knownLocality,
        symptom_onset: "",
        symptom_duration: "",
        symptom_pattern: "",
        desired_timing: "",
        contact_lens_experience: "unknown",
        prescription_status: "unknown",
        investigation_reference_text: "",
        repair_details: "",
        user_constraints: [],
      },
      urgency: {
        level: "confirmed",
        needs_clarification: false,
        reason: safety.blocking_flags
          .map((flag) => SAFETY_FLAG_PRESENTATION[flag] || flag)
          .join("; "),
      },
      understanding_confidence: "high",
      information_status: {
        sufficient_for_search: false,
        sufficient_for_specialist_message: false,
        missing_critical_fields: [],
      },
      next_action: "show_emergency_guidance",
      assistant_message: PATIENT_CONVERSATION_SAFE_EMERGENCY_MESSAGE,
      specialist_summary: null,
      evidence_phrases: [],
    },
    diagnostics: {
      policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
      safety_policy_version: safety.policy_version,
      deterministic_safety_preflight: true,
      deterministic_safety_flags: safety.blocking_flags,
      deterministic_safety_cleared_flags: safety.cleared_flags,
      model_invoked: false,
      model_urgency_advisory: null,
      model_next_action_ignored: null,
      provider_types_derived: true,
      decision_source: "deterministic_safety_preflight",
    },
  };
}

export function applyPatientConversationDecisionPolicy({
  interpretation,
  conversation,
  runtimeContext,
  stateDiagnostics,
} = {}) {
  if (!isPlainObject(interpretation)) {
    return {
      interpretation,
      diagnostics: {
        policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
        decision_source: "invalid_interpretation",
      },
    };
  }

  const current = {
    ...interpretation,
    alternative_intents: unique(interpretation.alternative_intents, 3),
    care_path_candidates: unique(interpretation.care_path_candidates, 4),
    service_keys: unique(interpretation.service_keys, 12),
    facts: {
      ...(isPlainObject(interpretation.facts) ? interpretation.facts : {}),
      locality: cloneLocality(interpretation?.facts?.locality),
      user_constraints: unique(interpretation?.facts?.user_constraints, 8),
    },
    urgency: { ...(isPlainObject(interpretation.urgency) ? interpretation.urgency : {}) },
    information_status: {
      ...(isPlainObject(interpretation.information_status)
        ? interpretation.information_status
        : {}),
      missing_critical_fields: unique(
        interpretation?.information_status?.missing_critical_fields,
        8,
      ),
    },
  };

  const safety = assessPatientConversationDeterministicSafety(conversation);
  const modelUrgency = ["none", "possible", "confirmed"].includes(current.urgency?.level)
    ? current.urgency.level
    : "none";
  const modelNextAction = clean(current.next_action, 80);
  const modelProviderTypes = unique(current.provider_type_candidates, 8);
  const localityWasCleared = stateDiagnostics?.locality_correction_detected === true
    && Array.isArray(stateDiagnostics?.cleared_stale_fields)
    && stateDiagnostics.cleared_stale_fields.includes("locality");
  const knownLocality = cloneLocality(runtimeContext?.known_locality);
  let localitySource = hasLocality(current.facts.locality) ? "interpretation" : "missing";

  if (!localityWasCleared && !hasLocality(current.facts.locality) && hasLocality(knownLocality)) {
    current.facts.locality = knownLocality;
    localitySource = "runtime_context";
  }

  const providerTypes = derivedProviderProfileTypes(current.service_keys);
  current.provider_type_candidates = providerTypes;

  let urgencyLevel = "none";
  let urgencyNeedsClarification = false;
  let urgencyReason = "";
  if (safety.blocking) {
    urgencyLevel = "confirmed";
    urgencyReason = safety.blocking_flags
      .map((flag) => SAFETY_FLAG_PRESENTATION[flag] || flag)
      .join("; ");
  } else if (["possible", "confirmed"].includes(modelUrgency)) {
    urgencyLevel = "possible";
    urgencyNeedsClarification = true;
    urgencyReason = "Semnal consultativ al modelului; necesita clarificare controlata.";
  }

  const hasIntent = clean(current.primary_intent, 80)
    && current.primary_intent !== "unknown";
  const hasServices = current.service_keys.length > 0;
  const localityPresent = hasLocality(current.facts.locality);
  const missingCriticalFields = [];

  if (!hasIntent) missingCriticalFields.push("need");
  if (!hasServices) missingCriticalFields.push("service");
  if (!localityPresent && urgencyLevel === "none") missingCriticalFields.push("locality");
  if (urgencyLevel === "possible") missingCriticalFields.push("symptom_severity");

  let nextAction = "ask_clarifying_question";
  if (urgencyLevel === "confirmed") {
    nextAction = "show_emergency_guidance";
  } else if (urgencyLevel === "possible") {
    nextAction = "ask_clarifying_question";
  } else if (!hasIntent || !hasServices) {
    nextAction = "ask_clarifying_question";
  } else if (!localityPresent) {
    nextAction = "ask_locality";
  } else {
    nextAction = "search_providers";
  }

  const sufficientForSearch = nextAction === "search_providers";
  current.urgency = {
    level: urgencyLevel,
    needs_clarification: urgencyNeedsClarification,
    reason: urgencyReason,
  };
  current.information_status = {
    sufficient_for_search: sufficientForSearch,
    sufficient_for_specialist_message: false,
    missing_critical_fields: missingCriticalFields,
  };
  current.next_action = nextAction;
  current.assistant_message = deterministicAssistantMessage(nextAction);
  current.specialist_summary = null;

  return {
    interpretation: current,
    diagnostics: {
      policy_version: PATIENT_CONVERSATION_DECISION_POLICY_VERSION,
      safety_policy_version: safety.policy_version,
      deterministic_safety_preflight: false,
      deterministic_safety_flags: safety.blocking_flags,
      deterministic_safety_cleared_flags: safety.cleared_flags,
      model_invoked: true,
      model_urgency_advisory: modelUrgency,
      model_urgency_overridden: modelUrgency !== urgencyLevel,
      model_next_action_advisory: modelNextAction || null,
      model_next_action_ignored: modelNextAction !== nextAction,
      model_provider_type_count: modelProviderTypes.length,
      derived_provider_type_count: providerTypes.length,
      provider_types_derived: true,
      locality_source: localitySource,
      locality_correction_respected: localityWasCleared,
      search_ready: sufficientForSearch,
      decision_source: safety.blocking
        ? "deterministic_safety"
        : (urgencyLevel === "possible"
          ? "deterministic_clarification"
          : "deterministic_search_readiness"),
    },
  };
}
