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

const RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN = /\btop\s*3\b|\btop3\b|\b(?:locul|pozi[țt]ia)\s*(?:1|unu|intai|întâi)\b|\b(?:cea|cel)\s+mai\s+bun(?:a|ă)?\s+(?:clinic(?:a|ă)|cabinet|optic(?:a|ă)|furnizor|medic)\b|\brecomand(?:am|ăm|a)?\s+(?:clinica|cabinetul|optica|furnizorul|medicul)\b/iu;
const DIAGNOSIS_CLAIM_PATTERN = /\b(?:ai|ave[țt]i|suferi(?:[țt]i)?\s+de|este\s+(?:sigur|clar|probabil)\s+c[ăa]\s+ai|pare\s+s[ăa]\s+fie)\s+(?:conjunctivit[ăa]|glaucom|cataract[ăa]|keratit[ăa]|uveit[ăa]|dezlipire\s+de\s+retin[ăa]|degenerescen[țt][ăa]\s+macular[ăa])\b|\bdiagnosticul\s+(?:este|e)\b/iu;
const TREATMENT_DIRECTIVE_PATTERN = /\b(?:ia|lua[țt]i|folosi[țt]i|pune[țt]i|aplic[ăa])\s+(?:pic[ăa]turi|antibiotic(?:e)?|medicament(?:e)?|unguente?|tratament)\b|\b(?:tratamentul|medica[țt]ia)\s+(?:potrivit[ăa]|recomandat[ăa])\b/iu;

function clean(value, maxLength = 1200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizedFieldName(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function redactPatientConversationText(value, maxLength = 1200) {
  return clean(value, maxLength)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email eliminat]")
    .replace(/(?:\+?40[\s.-]?)?(?:0?2\d{2}|0?3\d{2}|0?7\d{2})(?:[\s.-]?\d){6,7}/g, "[telefon eliminat]")
    .replace(/\b\d{13}\b/g, "[identificator eliminat]")
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

  const generatedText = [
    value?.need_summary,
    value?.assistant_message,
    value?.specialist_summary,
    value?.urgency?.reason,
  ].filter((item) => typeof item === "string").join("\n");

  if (RANKING_OR_PROVIDER_RECOMMENDATION_PATTERN.test(generatedText)) {
    violations.add("ranking_or_provider_recommendation_claim");
  }
  if (DIAGNOSIS_CLAIM_PATTERN.test(generatedText)) {
    violations.add("diagnosis_claim");
  }
  if (TREATMENT_DIRECTIVE_PATTERN.test(generatedText)) {
    violations.add("treatment_directive");
  }

  return [...violations].sort();
}
