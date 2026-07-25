export const PATIENT_CONVERSATION_STATE_POLICY_VERSION = "viasee-patient-conversation-state-policy-v1.1";

const UNKNOWN_VALUES = new Set(["", "unknown"]);
const INTENT_SCOPED_FACT_FIELDS = Object.freeze([
  "symptom_onset",
  "symptom_duration",
  "symptom_pattern",
  "contact_lens_experience",
  "prescription_status",
  "investigation_reference_text",
  "repair_details",
]);
const SUBJECT_FACT_FIELDS = Object.freeze(["for_whom", "age_group"]);
const INTENT_FACT_COMPATIBILITY = Object.freeze({
  symptom_onset: new Set(["control_vedere", "simptome_oftalmologice"]),
  symptom_duration: new Set(["control_vedere", "simptome_oftalmologice"]),
  symptom_pattern: new Set(["control_vedere", "simptome_oftalmologice"]),
  contact_lens_experience: new Set(["lentile_contact"]),
  prescription_status: new Set(["control_vedere", "ochelari_lentile"]),
  investigation_reference_text: new Set(["investigatii"]),
  repair_details: new Set(["reparatii_ochelari"]),
});

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 20) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value, 240))
      .filter(Boolean),
  )].slice(0, limit);
}

function normalizeText(value) {
  return clean(value, 1600)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function latestUserMessage(conversation) {
  const rows = Array.isArray(conversation) ? conversation : [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.role === "user") return clean(rows[index]?.content, 1600);
  }
  return "";
}

export function detectPatientConversationStateSignals(conversation) {
  const latest = normalizeText(latestUserMessage(conversation));
  const genericCorrection = /\b(?:de fapt|corectez|am gresit|m am razgandit|nu mai vreau|vreau doar|nu caut|am zis .{0,80} dar)\b/.test(latest);
  const localityCorrection = /\b(?:nu (?:mai )?(?:sunt|caut|vreau) in|nu in|am zis .{0,80} dar (?:sunt|caut) in)\b/.test(latest);
  const subjectCorrection = /\b(?:nu pentru mine|e pentru|este pentru|pentru mama|pentru tata|pentru copil|pentru fiul|pentru fiica|pentru sot|pentru sotie|pentru altcineva)\b/.test(latest);
  const timingCorrection = /\b(?:nu (?:mai )?(?:azi|maine|urgent)|de fapt (?:azi|maine|saptamana|luna)|nu e urgent|nu este urgent)\b/.test(latest);
  const symptomCorrection = /\b(?:nu (?:e|este) brusc|nu ma doare|nu doare|nu de azi|de fapt de (?:cateva|mai multe|[0-9]+))\b/.test(latest);
  const intentReplacement = !localityCorrection
    && !subjectCorrection
    && !timingCorrection
    && !symptomCorrection
    && /\b(?:de fapt|m am razgandit|nu mai vreau|vreau doar)\b/.test(latest);
  const subjectTargetHint = /\b(?:pentru mama|pentru tata|pentru sot|pentru sotie|pentru bunica|pentru bunicul)\b/.test(latest)
    ? "adult"
    : (/\b(?:pentru copil|pentru fiul|pentru fiica)\b/.test(latest) ? "child" : null);

  return {
    generic_correction_detected: genericCorrection,
    intent_replacement_detected: intentReplacement,
    locality_correction_detected: localityCorrection,
    subject_correction_detected: subjectCorrection,
    timing_correction_detected: timingCorrection,
    symptom_correction_detected: symptomCorrection,
    subject_target_hint: subjectTargetHint,
  };
}

function hasEnumValue(value) {
  return !UNKNOWN_VALUES.has(clean(value, 80));
}

function hasStringValue(value) {
  return Boolean(clean(value, 1000));
}

function hasLocality(value) {
  return Boolean(clean(value?.siruta_code, 40) || clean(value?.city, 120));
}

function cloneLocality(value) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: clean(locality.siruta_code, 40),
    city: clean(locality.city, 120),
    county_code: clean(locality.county_code, 40),
    county: clean(locality.county, 120),
    area: clean(locality.area, 160),
  };
}

function emptyLocality() {
  return cloneLocality(null);
}

function sameLocality(left, right) {
  const leftSiruta = clean(left?.siruta_code, 40);
  const rightSiruta = clean(right?.siruta_code, 40);
  if (leftSiruta && rightSiruta) return leftSiruta === rightSiruta;
  const leftCity = normalizeText(left?.city);
  const rightCity = normalizeText(right?.city);
  return Boolean(leftCity && rightCity && leftCity === rightCity);
}

function fieldHasValue(field, value) {
  if (["for_whom", "age_group", "contact_lens_experience", "prescription_status"].includes(field)) {
    return hasEnumValue(value);
  }
  return hasStringValue(value);
}

function emptyFactValue(field) {
  return ["for_whom", "age_group", "contact_lens_experience", "prescription_status"].includes(field)
    ? "unknown"
    : "";
}

function copyFactValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

function factsFrom(value) {
  const facts = isPlainObject(value) ? value : {};
  return {
    for_whom: clean(facts.for_whom, 40) || "unknown",
    age_group: clean(facts.age_group, 40) || "unknown",
    locality: cloneLocality(facts.locality),
    symptom_onset: clean(facts.symptom_onset, 240),
    symptom_duration: clean(facts.symptom_duration, 240),
    symptom_pattern: clean(facts.symptom_pattern, 400),
    desired_timing: clean(facts.desired_timing, 240),
    contact_lens_experience: clean(facts.contact_lens_experience, 40) || "unknown",
    prescription_status: clean(facts.prescription_status, 40) || "unknown",
    investigation_reference_text: clean(facts.investigation_reference_text, 500),
    repair_details: clean(facts.repair_details, 500),
    user_constraints: unique(facts.user_constraints, 8),
  };
}

function isFactCompatibleWithIntent(field, intent) {
  const allowedIntents = INTENT_FACT_COMPATIBILITY[field];
  return !allowedIntents || allowedIntents.has(intent);
}

function shouldBlockFactCarry(field, sameIntent, signals) {
  if (INTENT_SCOPED_FACT_FIELDS.includes(field) && !sameIntent) return true;
  if (SUBJECT_FACT_FIELDS.includes(field) && signals.subject_correction_detected) return true;
  if (field === "desired_timing" && signals.timing_correction_detected) return true;
  if (field.startsWith("symptom_") && signals.symptom_correction_detected) return true;
  if (INTENT_SCOPED_FACT_FIELDS.includes(field) && signals.intent_replacement_detected) return true;
  return false;
}

function shouldRejectCopiedStaleValue(field, currentValue, priorValue, signals) {
  if (!fieldHasValue(field, currentValue) || !fieldHasValue(field, priorValue)) return false;
  if (normalizeText(currentValue) !== normalizeText(priorValue)) return false;
  if (field === "desired_timing" && signals.timing_correction_detected) return true;
  if (field.startsWith("symptom_") && signals.symptom_correction_detected) return true;
  if (INTENT_SCOPED_FACT_FIELDS.includes(field) && signals.intent_replacement_detected) return true;
  return false;
}

function applySubjectTargetHint(current, prior, signals, overwritten, clearedStale) {
  if (!signals.subject_target_hint) return;
  const target = signals.subject_target_hint;
  if (current.for_whom !== target) overwritten.push("for_whom");
  current.for_whom = target;
  if (target === "adult") {
    if (current.age_group !== "adult" && hasEnumValue(current.age_group)) overwritten.push("age_group");
    current.age_group = "adult";
  } else if (current.age_group === "adult" || current.age_group === prior.age_group) {
    current.age_group = "unknown";
    clearedStale.push("age_group");
  }
}

function reconcileFacts(currentFactsValue, priorFactsValue, context) {
  const current = factsFrom(currentFactsValue);
  const prior = factsFrom(priorFactsValue);
  const carried = [];
  const overwritten = [];
  const clearedStale = [];

  applySubjectTargetHint(current, prior, context.signals, overwritten, clearedStale);

  for (const field of [
    "for_whom",
    "age_group",
    "symptom_onset",
    "symptom_duration",
    "symptom_pattern",
    "desired_timing",
    "contact_lens_experience",
    "prescription_status",
    "investigation_reference_text",
    "repair_details",
  ]) {
    const currentHasValue = fieldHasValue(field, current[field]);
    const priorHasValue = fieldHasValue(field, prior[field]);
    if (currentHasValue) {
      if (INTENT_SCOPED_FACT_FIELDS.includes(field)
        && (context.unresolvedIntentReplacement
          || !isFactCompatibleWithIntent(field, context.effectiveIntent))) {
        current[field] = emptyFactValue(field);
        clearedStale.push(field);
        continue;
      }
      if (shouldRejectCopiedStaleValue(field, current[field], prior[field], context.signals)) {
        current[field] = emptyFactValue(field);
        clearedStale.push(field);
        continue;
      }
      if (priorHasValue && normalizeText(current[field]) !== normalizeText(prior[field])) {
        overwritten.push(field);
      }
      continue;
    }
    if (!priorHasValue) continue;
    if (shouldBlockFactCarry(field, context.sameIntent, context.signals)) {
      clearedStale.push(field);
      continue;
    }
    current[field] = copyFactValue(prior[field]);
    carried.push(field);
  }

  const currentHasLocality = hasLocality(current.locality);
  const priorHasLocality = hasLocality(prior.locality);
  if (currentHasLocality) {
    if (priorHasLocality && sameLocality(current.locality, prior.locality)) {
      if (context.signals.locality_correction_detected) {
        current.locality = emptyLocality();
        clearedStale.push("locality");
      } else {
        for (const field of ["siruta_code", "city", "county_code", "county", "area"]) {
          if (!current.locality[field] && prior.locality[field]) {
            current.locality[field] = prior.locality[field];
          }
        }
      }
    } else if (priorHasLocality) {
      overwritten.push("locality");
    }
  } else if (priorHasLocality && !context.signals.locality_correction_detected) {
    current.locality = cloneLocality(prior.locality);
    carried.push("locality");
  } else if (priorHasLocality && context.signals.locality_correction_detected) {
    clearedStale.push("locality");
  }

  current.user_constraints = unique([
    ...current.user_constraints,
    ...prior.user_constraints,
  ], 8);

  return {
    facts: current,
    carried_fields: [...new Set(carried)].sort(),
    overwritten_fields: [...new Set(overwritten)].sort(),
    cleared_stale_fields: [...new Set(clearedStale)].sort(),
  };
}

function usableCarePath(values) {
  return unique(values, 8).some((value) => !["unresolved", "emergency_interruption"].includes(value));
}

function searchReady(interpretation) {
  return interpretation?.urgency?.level === "none"
    && interpretation?.primary_intent
    && interpretation.primary_intent !== "unknown"
    && usableCarePath(interpretation.care_path_candidates)
    && unique(interpretation.service_keys, 12).length > 0
    && hasLocality(interpretation?.facts?.locality);
}

function rejectUnresolvedIntentReplacement(current) {
  current.primary_intent = "unknown";
  current.alternative_intents = [];
  current.care_path_candidates = [];
  current.service_keys = [];
  current.provider_type_candidates = [];
  current.need_summary = "";
  current.information_status.sufficient_for_search = false;
  current.information_status.sufficient_for_specialist_message = false;
  current.information_status.missing_critical_fields = unique([
    ...current.information_status.missing_critical_fields,
    "need",
  ], 8);
  current.next_action = "ask_clarifying_question";
  current.assistant_message = "Am inteles ca vrei sa corectezi cererea. Ce ai nevoie sa rezolvi acum?";
  current.specialist_summary = null;
}

export function reconcilePatientConversationState({
  interpretation,
  priorState,
  conversation,
} = {}) {
  const current = isPlainObject(interpretation) ? {
    ...interpretation,
    alternative_intents: unique(interpretation.alternative_intents, 3),
    care_path_candidates: unique(interpretation.care_path_candidates, 4),
    service_keys: unique(interpretation.service_keys, 12),
    provider_type_candidates: unique(interpretation.provider_type_candidates, 8),
    facts: factsFrom(interpretation.facts),
    urgency: { ...(isPlainObject(interpretation.urgency) ? interpretation.urgency : {}) },
    information_status: {
      ...(isPlainObject(interpretation.information_status) ? interpretation.information_status : {}),
      missing_critical_fields: unique(interpretation?.information_status?.missing_critical_fields, 8),
    },
  } : null;
  const prior = isPlainObject(priorState) ? priorState : null;
  const signals = detectPatientConversationStateSignals(conversation);

  if (!current || !prior) {
    return {
      interpretation: current || interpretation,
      diagnostics: {
        policy_version: PATIENT_CONVERSATION_STATE_POLICY_VERSION,
        transition: prior ? "invalid_current_state" : "initialize",
        prior_state_present: Boolean(prior),
        intent_changed: false,
        stale_intent_rejected: false,
        recovered_prior_intent: false,
        search_readiness_recovered: false,
        carried_fields: [],
        overwritten_fields: [],
        cleared_stale_fields: [],
        ...signals,
      },
    };
  }

  const priorIntent = clean(prior.primary_intent, 80) || "unknown";
  const initialCurrentIntent = clean(current.primary_intent, 80) || "unknown";
  const priorIntentKnown = priorIntent !== "unknown";
  const currentIntentKnown = initialCurrentIntent !== "unknown";
  const intentChanged = priorIntentKnown && currentIntentKnown && priorIntent !== initialCurrentIntent;
  const unresolvedIntentReplacement = priorIntentKnown
    && signals.intent_replacement_detected
    && (!currentIntentKnown || initialCurrentIntent === priorIntent);
  const canRecoverPriorCore = priorIntentKnown
    && !intentChanged
    && !unresolvedIntentReplacement
    && !signals.intent_replacement_detected;
  let recoveredPriorIntent = false;
  const carriedCoreFields = [];

  if (unresolvedIntentReplacement) {
    rejectUnresolvedIntentReplacement(current);
  } else if (!currentIntentKnown && canRecoverPriorCore) {
    current.primary_intent = priorIntent;
    recoveredPriorIntent = true;
    carriedCoreFields.push("primary_intent");
  }

  if (canRecoverPriorCore) {
    for (const [field, limit] of [
      ["alternative_intents", 3],
      ["care_path_candidates", 4],
      ["service_keys", 12],
      ["provider_type_candidates", 8],
    ]) {
      if (unique(current[field], limit).length === 0 && unique(prior[field], limit).length > 0) {
        current[field] = unique(prior[field], limit);
        carriedCoreFields.push(field);
      }
    }
    if (!clean(current.need_summary, 500) && clean(prior.need_summary, 500)) {
      current.need_summary = clean(prior.need_summary, 500);
      carriedCoreFields.push("need_summary");
    }
  }

  const effectiveIntent = clean(current.primary_intent, 80) || "unknown";
  const sameIntent = priorIntentKnown && effectiveIntent === priorIntent;
  const factResult = reconcileFacts(current.facts, prior.facts, {
    sameIntent,
    effectiveIntent,
    unresolvedIntentReplacement,
    signals,
  });
  current.facts = factResult.facts;

  if (hasLocality(current.facts.locality)) {
    current.information_status.missing_critical_fields = current.information_status.missing_critical_fields
      .filter((field) => field !== "locality");
  } else if (!current.information_status.missing_critical_fields.includes("locality")) {
    current.information_status.missing_critical_fields = unique([
      ...current.information_status.missing_critical_fields,
      "locality",
    ], 8);
  }

  const ready = searchReady(current);
  let searchReadinessRecovered = false;
  if (ready && ["ask_locality", "confirm_understanding"].includes(current.next_action)) {
    current.next_action = "search_providers";
    current.information_status.sufficient_for_search = true;
    searchReadinessRecovered = true;
  }

  const allCarriedFields = [...new Set([
    ...carriedCoreFields,
    ...factResult.carried_fields,
  ])].sort();
  const transition = intentChanged
    ? "intent_replaced"
    : (unresolvedIntentReplacement
      ? "intent_replacement_unresolved"
      : (signals.generic_correction_detected || factResult.overwritten_fields.length > 0
        ? "facts_corrected"
        : "continue"));

  return {
    interpretation: current,
    diagnostics: {
      policy_version: PATIENT_CONVERSATION_STATE_POLICY_VERSION,
      transition,
      prior_state_present: true,
      intent_changed: intentChanged,
      stale_intent_rejected: unresolvedIntentReplacement,
      recovered_prior_intent: recoveredPriorIntent,
      search_readiness_recovered: searchReadinessRecovered,
      carried_fields: allCarriedFields,
      overwritten_fields: factResult.overwritten_fields,
      cleared_stale_fields: factResult.cleared_stale_fields,
      ...signals,
    },
  };
}
