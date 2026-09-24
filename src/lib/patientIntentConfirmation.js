export const PATIENT_INTENT_CONFIRMATION_VERSION = "patient-intent-confirmation-v2";

const CONFIRMABLE_CONFIDENCE = new Set(["high", "medium"]);
const FOR_WHOM_VALUES = new Set(["adult", "copil", "other_adult"]);
const AGE_GROUP_VALUES = new Set(["sub_3_ani", "3_6_ani", "7_12_ani", "13_18_ani", "adult"]);
const TIMING_VALUES = new Set(["cat_mai_repede", "zilele_urmatoare", "saptamana_aceasta", "nu_e_urgent"]);

function cleanList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

function normalizeForGrounding(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function emptyCandidateFacts() {
  return { for_whom: null, age_group: null, timing_key: null, location_text: null };
}

// Indicii extrase de model. Nu devin raspunsuri: sunt folosite doar ca sugestii marcate in
// intrebarile ulterioare. Localitatea trece a doua oara prin verificarea ca apare in textul
// pacientului (prima data pe server), ca un model care inventeaza un oras sa nu ajunga pe ecran.
function candidateFacts(interpretation, text) {
  const facts = emptyCandidateFacts();
  if (FOR_WHOM_VALUES.has(interpretation?.for_whom)) facts.for_whom = interpretation.for_whom;
  if (AGE_GROUP_VALUES.has(interpretation?.age_group)) facts.age_group = interpretation.age_group;
  if (TIMING_VALUES.has(interpretation?.timing_key)) facts.timing_key = interpretation.timing_key;
  const location = String(interpretation?.location_text || "").trim().slice(0, 80);
  const groundingText = normalizeForGrounding(text);
  if (location && (!groundingText || groundingText.includes(normalizeForGrounding(location)))) {
    facts.location_text = location;
  }
  return facts;
}

export function buildIntentConfirmationProposal(response = {}, {
  allowedIntents = [],
  deterministicIntent = null,
  text = "",
} = {}) {
  const allowed = new Set(allowedIntents);
  const interpretation = response?.interpretation;

  if (response?.status !== "completed" || !interpretation) {
    return {
      status: "fallback",
      source: "fallback",
      intent: allowed.has(deterministicIntent) ? deterministicIntent : null,
      alternative_intent: null,
      service_keys: [],
      confidence_band: "low",
      agreement_status: "not_comparable",
      possible_safety_flags: [],
      candidate_facts: emptyCandidateFacts(),
      version: null,
    };
  }

  const interpretedIntent = allowed.has(interpretation.intent) && interpretation.intent !== "unknown"
    ? interpretation.intent
    : null;
  const confidenceBand = CONFIRMABLE_CONFIDENCE.has(interpretation.confidence_band)
    ? interpretation.confidence_band
    : "low";
  const clarificationRequired = interpretation.clarification_required === true;
  // 2026-09-24: in productie, 5 din 21 de interpretari reusite cereau clarificare cu
  // incredere "high" - modelul voia sa intrebe varsta copilului sau orasul, adica exact ce
  // intreaba chestionarul. Pacientul ajungea la alegere manuala fara sa i se spuna de ce.
  // O incredere "high" nu mai este anulata de acest semnal: pacientul confirma oricum
  // explicit intentia pe ecranul urmator. Pentru "medium", clarificarea ramane decisiva.
  const canConfirm = Boolean(interpretedIntent)
    && (confidenceBand === "high" || (confidenceBand === "medium" && !clarificationRequired));
  const alternativeIntent = allowed.has(interpretation.alternative_intent)
    && interpretation.alternative_intent !== "unknown"
    && interpretation.alternative_intent !== interpretedIntent
    ? interpretation.alternative_intent
    : null;

  return {
    status: canConfirm ? "confirm" : "manual_choice",
    source: "ai",
    intent: interpretedIntent,
    alternative_intent: alternativeIntent,
    service_keys: cleanList(interpretation.service_keys),
    confidence_band: confidenceBand,
    agreement_status: interpretation.agreement_status || "not_comparable",
    possible_safety_flags: cleanList(interpretation.possible_safety_flags),
    candidate_facts: candidateFacts(interpretation, text),
    version: interpretation.version || null,
  };
}

// Cand modelul nu raspunde (timeout, credit, eroare), detectia determinista devine propunerea.
// Inainte, intentia ghicita din cuvinte cheie era aplicata tacit, fara confirmare, si nu
// ajungea la server ca raspuns controlat - deci planificatorul nu o cunostea.
export function buildDeterministicIntentProposal(intent, { allowedIntents = [] } = {}) {
  const allowed = new Set(allowedIntents);
  if (!intent || intent === "unknown" || !allowed.has(intent)) return null;
  return {
    status: "confirm",
    source: "deterministic",
    intent,
    alternative_intent: null,
    service_keys: [],
    confidence_band: "medium",
    agreement_status: "not_comparable",
    possible_safety_flags: [],
    candidate_facts: emptyCandidateFacts(),
    version: null,
  };
}
