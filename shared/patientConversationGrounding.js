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

function unique(values, limit = 4, maxLength = 160) {
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

function groundedValue(field, phrases) {
  const maxLength = SYMPTOM_FIELD_LIMITS[field] || 400;
  return clean((Array.isArray(phrases) ? phrases : []).join("; "), maxLength);
}

export function groundPatientConversationSymptomFacts({
  rawFacts,
  factEvidence,
  conversation,
} = {}) {
  const facts = isPlainObject(rawFacts) ? rawFacts : {};
  const sanitized = sanitizePatientConversationFactEvidence(factEvidence, conversation);
  const groundedFacts = {};
  const groundedFields = [];
  const rejectedFactFields = [];

  for (const field of PATIENT_CONVERSATION_GROUNDED_SYMPTOM_FIELDS) {
    const rawValue = clean(facts[field], SYMPTOM_FIELD_LIMITS[field] || 400);
    const phrases = sanitized.fact_evidence[field];
    const value = groundedValue(field, phrases);
    groundedFacts[field] = value;
    if (value) groundedFields.push(field);
    if (rawValue && !value) rejectedFactFields.push(field);
  }

  return {
    grounded_facts: groundedFacts,
    fact_evidence: sanitized.fact_evidence,
    diagnostics: {
      grounding_version: PATIENT_CONVERSATION_GROUNDING_VERSION,
      grounded_fields: groundedFields,
      rejected_fact_fields: rejectedFactFields,
      rejected_evidence_phrase_count: sanitized.rejected_phrase_count,
      release_ready:
        rejectedFactFields.length === 0
        && sanitized.rejected_phrase_count === 0,
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
    const expected = groundedValue(field, sanitized.fact_evidence[field]);
    if (actual) presentSymptomFields.push(field);
    if (actual && !expected) missingEvidenceFields.push(field);
    if (actual && expected && normalizeForEvidence(actual) !== normalizeForEvidence(expected)) {
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
