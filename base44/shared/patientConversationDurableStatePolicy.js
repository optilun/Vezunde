export const PATIENT_CONVERSATION_DURABLE_STATE_POLICY_VERSION =
  "viasee-patient-conversation-durable-state-policy-v1";
export const PATIENT_CONVERSATION_DURABLE_STATE_RECORD_VERSION =
  "viasee-patient-conversation-durable-state-record-v1";

export const PATIENT_CONVERSATION_DURABLE_STATE_POLICY = Object.freeze({
  mode: "inactive_contract_only",
  persistence_adapter: "none",
  patient_visible_persistence_enabled: false,
  admin_shadow_persistence_enabled: false,
  session_ttl_ms: 2 * 60 * 60 * 1000,
  maximum_clock_skew_ms: 5 * 60 * 1000,
  concurrency_control: "optimistic_revision",
  raw_conversation_persistence: "forbidden",
  evidence_provenance_required: true,
  max_model_calls_per_session: null,
  max_model_calls_per_subject_24h: null,
  release_ready: false,
});

export const PATIENT_CONVERSATION_DURABLE_STATE_GROUNDED_FIELDS = Object.freeze([
  "symptom_onset",
  "symptom_duration",
  "symptom_pattern",
]);

const RECORD_STATUS_VALUES = new Set([
  "active",
  "completed",
  "expired",
  "revoked",
]);
const FORBIDDEN_RECORD_FIELDS = Object.freeze([
  "conversation",
  "messages",
  "raw_turns",
  "raw_conversation",
  "email",
  "phone",
  "name",
  "access_token",
  "contact",
]);

function clean(value, maxLength = 400) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEvidence(value) {
  return clean(value, 1600)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/\s+/g, " ")
    .trim();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function validSessionId(value) {
  return /^pcs_[a-z0-9_-]{16,80}$/i.test(clean(value, 84));
}

function validSubjectKey(value) {
  return /^subject_[a-z0-9_-]{16,120}$/i.test(clean(value, 128));
}

function validMessageId(value) {
  return /^msg_[a-z0-9_-]{8,120}$/i.test(clean(value, 124));
}

function emptyGroundedFacts() {
  return Object.fromEntries(
    PATIENT_CONVERSATION_DURABLE_STATE_GROUNDED_FIELDS.map((field) => [field, ""]),
  );
}

function emptyFactProvenance() {
  return Object.fromEntries(
    PATIENT_CONVERSATION_DURABLE_STATE_GROUNDED_FIELDS.map((field) => [field, null]),
  );
}

function sanitizedUserMessages(value) {
  return (Array.isArray(value) ? value : [])
    .filter((message) => message?.role === "user")
    .map((message) => ({
      message_id: clean(message?.message_id, 124),
      content: clean(message?.content, 1600),
    }))
    .filter((message) => validMessageId(message.message_id) && message.content);
}

function evidencePhrasesForField(factEvidence, field) {
  return [...new Set((Array.isArray(factEvidence?.[field]) ? factEvidence[field] : [])
    .map((value) => clean(value, 400))
    .filter(Boolean))]
    .slice(0, 4);
}

function provenanceForField({ field, facts, factEvidence, userMessages, revision }) {
  const value = clean(facts?.[field], field === "symptom_pattern" ? 400 : 240);
  if (!value) return null;
  const normalizedValue = normalizeEvidence(value);
  const evidencePhrases = evidencePhrasesForField(factEvidence, field);
  const evidencePhrase = evidencePhrases.find((phrase) => (
    normalizeEvidence(phrase) === normalizedValue
  ));
  if (!evidencePhrase) return null;

  const sourceMessage = userMessages.find((message) => (
    normalizeEvidence(message.content).includes(normalizedValue)
  ));
  if (!sourceMessage) return null;

  return Object.freeze({
    value,
    evidence_phrase: value,
    source_message_id: sourceMessage.message_id,
    verified_at_revision: integer(revision),
  });
}

export function buildPatientConversationDurableFactProvenance({
  facts,
  factEvidence,
  userMessages,
  revision = 0,
} = {}) {
  const messages = sanitizedUserMessages(userMessages);
  const provenance = emptyFactProvenance();
  const missingFields = [];

  for (const field of PATIENT_CONVERSATION_DURABLE_STATE_GROUNDED_FIELDS) {
    const value = clean(facts?.[field], field === "symptom_pattern" ? 400 : 240);
    if (!value) continue;
    const entry = provenanceForField({
      field,
      facts,
      factEvidence,
      userMessages: messages,
      revision,
    });
    if (!entry) {
      missingFields.push(field);
      continue;
    }
    provenance[field] = entry;
  }

  return {
    valid: missingFields.length === 0,
    provenance,
    missing_fields: missingFields,
  };
}

export function createPatientConversationDurableStateRecord({
  sessionId,
  subjectKey,
  now = Date.now(),
} = {}) {
  const createdAt = Number(now);
  if (!validSessionId(sessionId) || !validSubjectKey(subjectKey)) return null;
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null;

  return {
    record_version: PATIENT_CONVERSATION_DURABLE_STATE_RECORD_VERSION,
    policy_version: PATIENT_CONVERSATION_DURABLE_STATE_POLICY_VERSION,
    session_id: clean(sessionId, 84),
    subject_key: clean(subjectKey, 128),
    status: "active",
    revision: 0,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: createdAt + PATIENT_CONVERSATION_DURABLE_STATE_POLICY.session_ttl_ms,
    model_calls_used: 0,
    grounded_facts: emptyGroundedFacts(),
    fact_provenance: emptyFactProvenance(),
  };
}

function recordViolations(record, { now = Date.now() } = {}) {
  const violations = [];
  if (!isPlainObject(record)) return ["record_required"];
  if (record.record_version !== PATIENT_CONVERSATION_DURABLE_STATE_RECORD_VERSION) {
    violations.push("record_version_invalid");
  }
  if (record.policy_version !== PATIENT_CONVERSATION_DURABLE_STATE_POLICY_VERSION) {
    violations.push("policy_version_invalid");
  }
  if (!validSessionId(record.session_id)) violations.push("session_id_invalid");
  if (!validSubjectKey(record.subject_key)) violations.push("subject_key_invalid");
  if (!RECORD_STATUS_VALUES.has(record.status)) violations.push("status_invalid");
  if (!Number.isInteger(record.revision) || record.revision < 0) {
    violations.push("revision_invalid");
  }
  if (!Number.isInteger(record.model_calls_used) || record.model_calls_used < 0) {
    violations.push("model_calls_used_invalid");
  }

  const createdAt = Number(record.created_at);
  const updatedAt = Number(record.updated_at);
  const expiresAt = Number(record.expires_at);
  if (!Number.isFinite(createdAt) || createdAt <= 0) violations.push("created_at_invalid");
  if (!Number.isFinite(updatedAt) || updatedAt < createdAt) violations.push("updated_at_invalid");
  if (
    !Number.isFinite(expiresAt)
    || expiresAt !== createdAt + PATIENT_CONVERSATION_DURABLE_STATE_POLICY.session_ttl_ms
  ) {
    violations.push("expires_at_invalid");
  }
  if (Number(now) > expiresAt) violations.push("record_expired");
  if (createdAt > Number(now) + PATIENT_CONVERSATION_DURABLE_STATE_POLICY.maximum_clock_skew_ms) {
    violations.push("created_at_in_future");
  }

  for (const field of FORBIDDEN_RECORD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      violations.push(`forbidden_field:${field}`);
    }
  }

  const facts = isPlainObject(record.grounded_facts) ? record.grounded_facts : {};
  const provenance = isPlainObject(record.fact_provenance) ? record.fact_provenance : {};
  for (const field of PATIENT_CONVERSATION_DURABLE_STATE_GROUNDED_FIELDS) {
    const value = clean(facts[field], field === "symptom_pattern" ? 400 : 240);
    const source = provenance[field];
    if (!value && source !== null && source !== undefined) {
      violations.push(`unexpected_provenance:${field}`);
      continue;
    }
    if (!value) continue;
    if (!isPlainObject(source)) {
      violations.push(`missing_provenance:${field}`);
      continue;
    }
    if (normalizeEvidence(source.value) !== normalizeEvidence(value)) {
      violations.push(`provenance_value_mismatch:${field}`);
    }
    if (normalizeEvidence(source.evidence_phrase) !== normalizeEvidence(value)) {
      violations.push(`evidence_phrase_mismatch:${field}`);
    }
    if (!validMessageId(source.source_message_id)) {
      violations.push(`source_message_id_invalid:${field}`);
    }
    if (
      !Number.isInteger(source.verified_at_revision)
      || source.verified_at_revision < 0
      || source.verified_at_revision > record.revision
    ) {
      violations.push(`provenance_revision_invalid:${field}`);
    }
  }

  return [...new Set(violations)].sort();
}

export function validatePatientConversationDurableStateRecord(record, options = {}) {
  const violations = recordViolations(record, options);
  return {
    valid: violations.length === 0,
    violations,
  };
}

export function evaluatePatientConversationDurableBudget({
  record,
  modelCallsIncrement = 1,
  sessionLimit,
  subjectCalls24h,
  subjectLimit,
} = {}) {
  const increment = integer(modelCallsIncrement, 0);
  const configured = Number.isInteger(sessionLimit)
    && sessionLimit > 0
    && Number.isInteger(subjectLimit)
    && subjectLimit > 0
    && Number.isInteger(subjectCalls24h)
    && subjectCalls24h >= 0;
  if (!configured) {
    return {
      allowed: false,
      reason: "durable_budget_policy_unconfigured",
    };
  }

  const sessionUsed = integer(record?.model_calls_used, 0);
  if (sessionUsed + increment > sessionLimit) {
    return {
      allowed: false,
      reason: "session_model_call_budget_exceeded",
    };
  }
  if (subjectCalls24h + increment > subjectLimit) {
    return {
      allowed: false,
      reason: "subject_model_call_budget_exceeded",
    };
  }
  return {
    allowed: true,
    reason: null,
    session_calls_after: sessionUsed + increment,
    subject_calls_24h_after: subjectCalls24h + increment,
  };
}

export function planPatientConversationDurableStateUpdate(record, {
  expectedRevision,
  groundedFacts,
  factProvenance,
  modelCallsIncrement = 0,
  status = "active",
  now = Date.now(),
} = {}) {
  const currentValidation = validatePatientConversationDurableStateRecord(record, { now });
  if (!currentValidation.valid) {
    return {
      status: "rejected",
      reason: "durable_state_record_invalid",
      violations: currentValidation.violations,
      record: null,
    };
  }
  if (integer(expectedRevision, -1) !== record.revision) {
    return {
      status: "conflict",
      reason: "durable_state_revision_mismatch",
      violations: [],
      record: null,
    };
  }
  if (!RECORD_STATUS_VALUES.has(status) || ["expired", "revoked"].includes(record.status)) {
    return {
      status: "rejected",
      reason: "durable_state_transition_invalid",
      violations: [],
      record: null,
    };
  }

  const nextRevision = record.revision + 1;
  const facts = {
    ...emptyGroundedFacts(),
    ...(isPlainObject(groundedFacts) ? groundedFacts : {}),
  };
  const provenance = {
    ...emptyFactProvenance(),
    ...(isPlainObject(factProvenance) ? factProvenance : {}),
  };
  const next = {
    ...record,
    status,
    revision: nextRevision,
    updated_at: Number(now),
    model_calls_used: record.model_calls_used + integer(modelCallsIncrement, 0),
    grounded_facts: facts,
    fact_provenance: provenance,
  };
  const nextValidation = validatePatientConversationDurableStateRecord(next, { now });
  if (!nextValidation.valid) {
    return {
      status: "rejected",
      reason: "durable_state_update_invalid",
      violations: nextValidation.violations,
      record: null,
    };
  }

  return {
    status: "planned",
    reason: "persistence_adapter_not_implemented",
    violations: [],
    record: next,
    activation_allowed: false,
  };
}

export function patientConversationDurableStateActivationReadiness() {
  const policy = PATIENT_CONVERSATION_DURABLE_STATE_POLICY;
  const blockers = [];
  if (policy.persistence_adapter === "none") blockers.push("persistence_adapter_missing");
  if (!Number.isInteger(policy.max_model_calls_per_session)) {
    blockers.push("session_budget_unapproved");
  }
  if (!Number.isInteger(policy.max_model_calls_per_subject_24h)) {
    blockers.push("subject_budget_unapproved");
  }
  if (!policy.patient_visible_persistence_enabled) {
    blockers.push("patient_visible_persistence_disabled");
  }
  return {
    ready: blockers.length === 0 && policy.release_ready === true,
    blockers,
  };
}
