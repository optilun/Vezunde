export const PATIENT_CONVERSATION_GROUNDING_VERSION =
  "viasee-patient-conversation-grounding-v1";

export const PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS = Object.freeze([
  "symptom_onset",
  "symptom_duration",
  "symptom_pattern",
]);

const SYMPTOM_FIELD_LIMITS = Object.freeze({
  symptom_onset: 240,
  symptom_duration: 240,
  symptom_pattern: 400,
});

function clean(value, maxLength = 400) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values, limit = 8, maxLength = 160) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => clean(value, maxLength))
    .filter(Boolean))]
    .slice(0, limit);
}

function normalizeForEvidence(value) {
  return clean(value, 1600)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/\s+/g, " ")
    .trim();
}

function userMessages(conversation) {
  return (Array.isArray(conversation) ? conversation : [])
    .filter((turn) => turn?.role === "user")
    .map((turn) => clean(turn?.content, 1600))
    .filter(Boolean);
}

function phraseSupportedByUser(phrase, conversation) {
  const normalizedPhrase = normalizeForEvidence(phrase);
  if (!normalizedPhrase) return false;
  return userMessages(conversation)
    .some((message) => normalizeForEvidence(message).includes(normalizedPhrase));
}

function evidenceFrom(value) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS.map((field) => [
    field,
    unique(source[field], field === "symptom_pattern" ? 4 : 2, 160),
  ]));
}

function matchingEvidence(value, evidencePhrases) {
  const normalizedValue = normalizeForEvidence(value);
  if (!normalizedValue) return [];
  return unique(evidencePhrases, 8, 160)
    .filter((phrase) => normalizeForEvidence(phrase).includes(normalizedValue));
}

export function emptyPatientConversationFactEvidence() {
  return evidenceFrom(null);
}

export function sanitizePatientConversationFactEvidence(value, conversation) {
  const source = evidenceFrom(value);
  const factEvidence = {};
  let rejectedPhraseCount = 0;

  for (const field of PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS) {
    const accepted = source[field]
      .filter((phrase) => phraseSupportedByUser(phrase, conversation));
    factEvidence[field] = accepted;
    rejectedPhraseCount += source[field].length - accepted.length;
  }

  return {
    fact_evidence: factEvidence,
    rejected_phrase_count: rejectedPhraseCount,
  };
}

export function groundPatientConversationSymptomFacts({
  rawFacts,
  evidencePhrases,
  conversation,
} = {}) {
  const facts = isPlainObject(rawFacts) ? rawFacts : {};
  const groundedFacts = {};
  const factEvidence = emptyPatientConversationFactEvidence();
  const groundedFields = [];
  const rejectedFactFields = [];

  for (const field of PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS) {
    const rawValue = clean(facts[field], SYMPTOM_FIELD_LIMITS[field] || 400);
    if (!rawValue) {
      groundedFacts[field] = "";
      continue;
    }

    const supportedByUser = phraseSupportedByUser(rawValue, conversation);
    const evidence = supportedByUser
      ? matchingEvidence(rawValue, evidencePhrases)
      : [];
    if (evidence.length === 0) {
      groundedFacts[field] = "";
      rejectedFactFields.push(field);
      continue;
    }

    groundedFacts[field] = rawValue;
    factEvidence[field] = [rawValue];
    groundedFields.push(field);
  }

  return {
    grounded_facts: groundedFacts,
    fact_evidence: factEvidence,
    diagnostics: {
      grounding_version: PATIENT_CONVERSATION_GROUNDING_VERSION,
      grounded_fields: groundedFields,
      rejected_fact_fields: rejectedFactFields,
      release_ready: rejectedFactFields.length === 0,
    },
  };
}

export function evaluatePatientConversationSymptomGrounding({
  facts,
  factEvidence,
  conversation,
} = {}) {
  const sourceFacts = isPlainObject(facts) ? facts : {};
  const sanitized = sanitizePatientConversationFactEvidence(factEvidence, conversation);
  const missingEvidenceFields = [];
  const mismatchedFields = [];
  const presentSymptomFields = [];

  for (const field of PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS) {
    const actual = clean(sourceFacts[field], SYMPTOM_FIELD_LIMITS[field] || 400);
    const evidence = sanitized.fact_evidence[field];
    if (actual) presentSymptomFields.push(field);
    if (actual && evidence.length === 0) missingEvidenceFields.push(field);
    if (
      actual
      && evidence.length > 0
      && !evidence.some((phrase) => normalizeForEvidence(phrase) === normalizeForEvidence(actual))
    ) {
      mismatchedFields.push(field);
    }
  }

  return {
    grounding_version: PATIENT_CONVERSATION_GROUNDING_VERSION,
    valid:
      missingEvidenceFields.length === 0
      && mismatchedFields.length === 0
      && sanitized.rejected_phrase_count === 0,
    present_symptom_fields: presentSymptomFields,
    missing_evidence_fields: missingEvidenceFields,
    mismatched_fields: mismatchedFields,
    rejected_evidence_phrase_count: sanitized.rejected_phrase_count,
  };
}
