export const PATIENT_CONVERSATION_MAX_TURNS = 20;
export const PATIENT_CONVERSATION_MAX_CHARACTERS = 8000;

const PROHIBITED_OUTPUT_FIELDS = new Set([
  "provider_id",
  "provider_ids",
  "provider_name",
  "provider_names",
  "provider_ranking",
  "provider_rank",
  "rank",
  "ranking",
  "score",
  "recommended_provider",
  "recommended_providers",
  "top_providers",
  "top_3",
  "diagnosis",
  "diagnostic",
  "disease",
  "treatment",
  "medication",
  "medicine",
  "prescription_recommendation",
  "prognosis",
]);

const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = /\btop\s*3\b|\btop3\b|\b(?:locul|pozi[țt]ia)\s*(?:1|unu|intai|întâi)\b|\b(?:cea|cel)\s+mai\s+bun(?:a|ă)?\s+(?:clinic(?:a|ă)|cabinet|optic(?:a|ă)|furnizor|medic)\b|\brecomand(?:am|ăm|a)?\s+(?:clinica|cabinetul|optica|furnizorul|medicul)\b|\b(?:best|top[- ]?rated)\s+(?:clinic|doctor|provider|optical\s+store)\b|\brecommend(?:ed|s|ing)?\s+(?:the\s+)?(?:clinic|doctor|provider|optical\s+store)\b/iu;
const DIAGNOSIS_CLAIM_PATTERN = /\b(?:ai|ave[țt]i|suferi(?:[țt]i)?\s+de|este\s+(?:sigur|clar|probabil)\s+c[ăa]\s+ai)\s+(?:conjunctivit[ăa]|glaucom|cataract[ăa]|keratit[ăa]|uveit[ăa]|dezlipire\s+de\s+retin[ăa]|degenerescen[țt][ăa]\s+macular[ăa])(?=$|[\s.,;:!?])|\bdiagnosticul\s+(?:este|e)\b|\b(?:you\s+(?:likely\s+)?have|the\s+diagnosis\s+is)\s+(?:conjunctivitis|glaucoma|cataract|keratitis|uveitis|retinal\s+detachment|macular\s+degeneration)\b/iu;
const TREATMENT_DIRECTIVE_PATTERN = /\b(?:ia|lua[țt]i|folosi[țt]i|pune[țt]i|aplic[ăa])\s+(?:pic[ăa]turi|antibiotic(?:e)?|medicament(?:e)?|unguente?|tratament)\b|\b(?:tratamentul|medica[țt]ia)\s+(?:potrivit[ăa]|recomandat[ăa])\b|\b(?:take|use|apply)\s+(?:eye\s+drops?|antibiotics?|medication|ointment|treatment)\b/iu;
const GENERATED_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const GENERATED_ROMANIAN_PHONE_PATTERN = /(^|[^\d])(?:\+?40[\s.-]?)?(?:0?2\d{2}|0?3\d{2}|0?7\d{2})(?:[\s.-]?\d){6,7}(?!\d)/;
const GENERATED_IDENTIFIER_PATTERN = /\b\d{13}\b/;

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedFieldName(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function schemaPath(parentPath, key) {
  return /^\d+$/.test(String(key))
    ? `${parentPath}[${key}]`
    : `${parentPath}.${key}`;
}

function validateSchemaNode(value, schema, path, violations, depth = 0) {
  if (!schema || typeof schema !== "object" || depth > 16) return;

  if (Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some((candidateSchema) => {
      const candidateViolations = new Set();
      validateSchemaNode(value, candidateSchema, path, candidateViolations, depth + 1);
      return candidateViolations.size === 0;
    });
    if (!matched) violations.add(`schema_any_of:${path}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    violations.add(`schema_enum:${path}`);
    return;
  }

  if (schema.type === "object") {
    if (!isPlainObject(value)) {
      violations.add(`schema_type_object:${path}`);
      return;
    }
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const requiredKey of required) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        violations.add(`schema_missing:${schemaPath(path, requiredKey)}`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          violations.add(`schema_unexpected:${schemaPath(path, key)}`);
        }
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateSchemaNode(value[key], propertySchema, schemaPath(path, key), violations, depth + 1);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      violations.add(`schema_type_array:${path}`);
      return;
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      violations.add(`schema_max_items:${path}`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateSchemaNode(item, schema.items, schemaPath(path, index), violations, depth + 1);
      });
    }
    return;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      violations.add(`schema_type_string:${path}`);
      return;
    }
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
      violations.add(`schema_max_length:${path}`);
    }
    return;
  }

  if (schema.type === "boolean" && typeof value !== "boolean") {
    violations.add(`schema_type_boolean:${path}`);
    return;
  }

  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    violations.add(`schema_type_number:${path}`);
    return;
  }

  if (schema.type === "integer" && !Number.isInteger(value)) {
    violations.add(`schema_type_integer:${path}`);
    return;
  }

  if (schema.type === "null" && value !== null) {
    violations.add(`schema_type_null:${path}`);
  }
}

function generatedOutputStrings(value) {
  const strings = [];
  const visited = new WeakSet();

  function collect(node, depth = 0) {
    if (typeof node === "string") {
      strings.push(node);
      return;
    }
    if (!node || typeof node !== "object" || depth > 8) return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => collect(item, depth + 1));
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (normalizedFieldName(key) === "evidence_phrases") continue;
      collect(child, depth + 1);
    }
  }

  collect(value);
  return strings;
}

export function redactPatientConversationText(value, maxLength = 1200) {
  return clean(value, maxLength)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email eliminat]")
    .replace(/\b\d{13}\b/g, "[identificator eliminat]")
    .replace(/(^|[^\d])((?:\+?40[\s.-]?)?(?:0?2\d{2}|0?3\d{2}|0?7\d{2})(?:[\s.-]?\d){6,7})(?!\d)/g, "$1[telefon eliminat]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function sanitizePatientConversationTurns(conversation, fallbackText = "", options = {}) {
  const maxTurns = Number.isInteger(options.maxTurns) && options.maxTurns > 0
    ? options.maxTurns
    : PATIENT_CONVERSATION_MAX_TURNS;
  const maxCharacters = Number.isInteger(options.maxCharacters) && options.maxCharacters > 0
    ? options.maxCharacters
    : PATIENT_CONVERSATION_MAX_CHARACTERS;
  const maxTurnLength = Number.isInteger(options.maxTurnLength) && options.maxTurnLength > 0
    ? options.maxTurnLength
    : 1200;
  const source = Array.isArray(conversation)
    ? conversation
    : (fallbackText ? [{ role: "user", content: fallbackText }] : []);
  const rows = source
    .slice(-maxTurns)
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : (turn?.role === "user" ? "user" : ""),
      content: redactPatientConversationText(turn?.content, maxTurnLength),
    }))
    .filter((turn) => turn.role && turn.content);

  let totalCharacters = 0;
  const bounded = [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (totalCharacters + row.content.length > maxCharacters) continue;
    bounded.unshift(row);
    totalCharacters += row.content.length;
  }
  return bounded;
}

export function validatePatientConversationModelResponse(value, responseSchema) {
  const violations = new Set();
  validateSchemaNode(value, responseSchema, "$", violations);
  return [...violations].sort();
}

export function detectProhibitedPatientConversationOutput(value) {
  const violations = new Set();
  const visited = new WeakSet();

  function visit(node, depth = 0) {
    if (!node || typeof node !== "object" || depth > 8) return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      const normalizedKey = normalizedFieldName(key);
      if (PROHIBITED_OUTPUT_FIELDS.has(normalizedKey)) {
        violations.add(`forbidden_field:${normalizedKey}`);
      }
      visit(child, depth + 1);
    }
  }

  visit(value);

  const generatedStrings = generatedOutputStrings(value);
  if (generatedStrings.some((text) => RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN.test(text))) {
    violations.add("ranking_or_provider_recommendation_claim");
  }
  if (generatedStrings.some((text) => DIAGNOSIS_CLAIM_PATTERN.test(text))) {
    violations.add("diagnosis_claim");
  }
  if (generatedStrings.some((text) => TREATMENT_DIRECTIVE_PATTERN.test(text))) {
    violations.add("treatment_directive");
  }
  if (generatedStrings.some((text) => (
    GENERATED_EMAIL_PATTERN.test(text)
    || GENERATED_ROMANIAN_PHONE_PATTERN.test(text)
    || GENERATED_IDENTIFIER_PATTERN.test(text)
  ))) {
    violations.add("contact_details_without_consent");
  }

  return [...violations].sort();
}
