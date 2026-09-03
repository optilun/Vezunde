import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
  buildPatientGuidancePlannerProfile,
  buildPatientGuidanceQuestionSelection,
  runPatientGuidanceRuntimeShadow,
} from "../shared/patientGuidancePlanner.js";
import {
  getApprovedPatientGuidanceQuestion,
  isApprovedPatientGuidanceQuestionKey,
} from "../shared/patientGuidanceQuestionCatalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => (
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n")
);
const locality = () => ({ siruta_code: "155243", city: "Timisoara", county_code: "TM" });
const scenarios = [];

async function scenario(name, fn) {
  await fn();
  scenarios.push(name);
}

function deterministicProfile(input = {}) {
  return buildPatientGuidancePlannerProfile(input, { status: "not_requested" });
}

function select(input = {}, options = {}) {
  return buildPatientGuidanceQuestionSelection(deterministicProfile(input), options);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

await scenario("selection contract is versioned", () => {
  assert.equal(
    PATIENT_GUIDANCE_QUESTION_SELECTION_VERSION,
    "patient-guidance-question-selection-v1",
  );
});

await scenario("complete OCT request asks no unnecessary question", () => {
  const result = select({
    text: "Vreau OCT in Timisoara",
    explicitPrimaryIntent: "investigatii",
    explicitFacts: { locality: locality() },
    guidedAnswers: [{ question_key: "timing", answer_value: "zilele_urmatoare" }],
  });
  assert.equal(result.status, "complete");
  assert.equal(result.next_question_key, null);
});

await scenario("simple control continues with the mandatory routine question", () => {
  const result = select({
    text: "Vreau control oftalmologic",
    explicitPrimaryIntent: "control_vedere",
  });
  assert.equal(result.status, "selected");
  assert.equal(result.next_question_key, "routine_vs_symptom");
});

await scenario("first pair of lenses follows contact lens flow", () => {
  const profile = deterministicProfile({ text: "Prima pereche de lentile" });
  assert.equal(profile.confirmed_primary_intent, "lentile_contact");
  assert.equal(profile.confirmed_facts.contact_lens_experience, "first_time");
  assert.equal(
    buildPatientGuidanceQuestionSelection(profile).next_question_key,
    "locality",
  );
});

await scenario("repair details skip the already explicit repair question", () => {
  const profile = deterministicProfile({ text: "Am rama rupta" });
  assert.equal(profile.confirmed_facts.repair_type, "broken_frame");
  assert.equal(
    buildPatientGuidanceQuestionSelection(profile).next_question_key,
    "locality",
  );
});

await scenario("unknown investigation asks for investigation type", () => {
  const result = select({ text: "Mi-a recomandat medicul o investigatie" });
  assert.equal(result.status, "selected");
  assert.equal(result.next_question_key, "investigation_type");
});

await scenario("child request preserves mandatory clarification order", () => {
  const result = select({ text: "Vreau un control pentru copil" });
  assert.equal(result.status, "selected");
  assert.equal(result.next_question_key, "routine_vs_symptom");
});

await scenario("safety blocking remains prioritary", () => {
  const profile = deterministicProfile({
    text: "Ma doare foarte tare ochiul",
    explicitPrimaryIntent: "simptome_oftalmologice",
    deterministicSafetyState: "blocking",
  });
  const result = buildPatientGuidanceQuestionSelection(profile);
  assert.equal(result.status, "safety_blocked");
  assert.equal(result.next_question_key, null);
  assert.equal(result.safety_blocking, true);
});

await scenario("planner timeout selects immediate legacy fallback", () => {
  const profile = deterministicProfile({
    text: "Vreau un control",
    explicitPrimaryIntent: "control_vedere",
  });
  const result = buildPatientGuidanceQuestionSelection({
    ...profile,
    status: "fallback",
    ai_status: "timeout",
    fallback_reason: "ai_timeout",
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.fallback_reason, "ai_timeout");
});

await scenario("invalid planner output selects immediate legacy fallback", () => {
  const result = buildPatientGuidanceQuestionSelection({
    status: "completed",
    ai_status: "completed",
    next_question_key: "routine_vs_symptom",
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.fallback_reason, "planner_invalid");
});

await scenario("frontend fallback keeps the legacy question order", () => {
  const card = source("src/components/intake2/ConversationalCard.jsx");
  assert.match(card, /fallbackQuestionSelection/);
  assert.match(card, /\["fallback", "idle"\]\.includes\(questionSelection\.status\) \? legacyCurrent/);
});

await scenario("answered questions are never selected again", () => {
  const profile = deterministicProfile({
    text: "Vreau un control",
    explicitPrimaryIntent: "control_vedere",
    guidedAnswers: [{ question_key: "routine_vs_symptom", answer_value: "routine" }],
  });
  const result = buildPatientGuidanceQuestionSelection(profile, {
    answeredQuestionKeys: ["routine_vs_symptom"],
  });
  assert.notEqual(result.next_question_key, "routine_vs_symptom");
});

await scenario("question history prevents loops", () => {
  const profile = deterministicProfile({
    text: "Vreau un control",
    explicitPrimaryIntent: "control_vedere",
  });
  const result = buildPatientGuidanceQuestionSelection(profile, {
    askedQuestionKeys: ["routine_vs_symptom"],
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.fallback_reason, "question_loop_prevented");
});

await scenario("mandatory investigation question cannot be skipped by history", () => {
  const result = select(
    { text: "Mi-a recomandat medicul o investigatie" },
    { askedQuestionKeys: ["timing"] },
  );
  assert.equal(result.next_question_key, "investigation_type");
});

await scenario("guided answers have priority over the planner candidate", () => {
  const profile = deterministicProfile({
    text: "Vreau un control",
    explicitPrimaryIntent: "control_vedere",
    explicitFacts: { locality: locality() },
    guidedAnswers: [{ question_key: "routine_vs_symptom", answer_value: "routine" }],
  });
  assert.equal(profile.confirmed_facts.routine_vs_symptom, "routine");
  // 2026-09-01: for_whom a trecut din "inferable" in lista ceruta pentru control_vedere.
  // Inainte nu se punea niciodata, iar un parinte care cauta pentru un copil de 6 ani era
  // potrivit ca adult. Acum e urmatoarea intrebare, inaintea localitatii si a termenului.
  assert.equal(
    buildPatientGuidanceQuestionSelection(profile).next_question_key,
    "for_whom",
  );
});

await scenario("every selected question resolves only through the approved catalog", () => {
  const result = select({ text: "Mi-a recomandat medicul o investigatie" });
  assert.equal(isApprovedPatientGuidanceQuestionKey(result.next_question_key), true);
  assert.equal(
    getApprovedPatientGuidanceQuestion(result.next_question_key).key,
    result.next_question_key,
  );
  const card = source("src/components/intake2/ConversationalCard.jsx");
  assert.match(card, /getApprovedPatientGuidanceQuestion\(selection\.next_question_key\)/);
  assert.doesNotMatch(card, /selection\.next_question\b/);
});

await scenario("legacy free-text clarification is not used by the wizard", () => {
  assert.doesNotMatch(
    source("src/components/intake2/PatientIntentConfirmation.jsx"),
    /clarification_question/,
  );
  assert.doesNotMatch(
    source("src/lib/patientIntentConfirmation.js"),
    /clarification_question/,
  );
});

await scenario("question-only runtime performs no second InvokeLLM", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  assert.equal((entry.match(/Core\.InvokeLLM\(/g) || []).length, 1);
  const questionOnlyStart = entry.indexOf("function selectPatientGuidanceQuestion");
  const questionOnlyEnd = entry.indexOf("async function interpretPatientNeed", questionOnlyStart);
  assert.ok(questionOnlyStart >= 0 && questionOnlyEnd > questionOnlyStart);
  assert.doesNotMatch(entry.slice(questionOnlyStart, questionOnlyEnd), /InvokeLLM/);
});

await scenario("full planner profile is never exposed to the browser", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  assert.match(entry, /patient_guidance_question_selection: observation\.question_selection/);
  assert.doesNotMatch(entry, /Response\.json\([^;]*patient_guidance_shadow_profile/s);
});

await scenario("matching implementation remains byte-stable", () => {
  const entry = source("base44/functions/matchProvidersSemantic/entry.ts");
  const marker = "    const unmappedQuery = requestedKeys.length === 0;";
  const matchingTail = entry.slice(entry.indexOf(marker)).trimEnd();
  // Amprenta actualizata 2026-08-06. Modificarile din acea sesiune au fost verificate
  // linie cu linie si NU ating scoringul, ordonarea sau selectia Top 3:
  //  - fallback structural: praguri (3->8, 3->12) si acceptarea profilurilor
  //    revendicate/verificate fara servicii declarate
  //  - extindere nationala (query_scope 'national', expansionTier 'tara')
  //  - diagnostic pentru esecul silentios al InvokeLLM
  //  - photo_url si eticheta afisata pentru profiluri revendicate
  // Orice schimbare viitoare a acestei amprente trebuie justificata la fel de explicit.
  //
  // Amprenta actualizata 2026-09-01, la cerere explicita: fallback-ul structural nu mai
  // filtreaza binar dupa capacitate. Inainte, orice nevoie non-medicala elimina complet
  // cabinetele si clinicile oftalmologice (~175 locatii), inclusiv cand nivelul nevoii
  // iesea 'unknown'. Acum: nevoie medicala -> doar medical; orice altceva -> ambele, cu
  // opticile primele. S-au schimbat componenta si ordinea interna a fallback-ului
  // structural. NU s-au atins buildRecommendationScore, assignRecommendationBuckets, Top 3.
  // 2026-09-02: amprenta s-a schimbat pentru ca textele vizibile pacientului din ramura
  // de potrivire au primit diacritice (routingReason, notitele fallbackului structural).
  // Doar copie afisata: nicio schimbare de scor, ordonare sau selectie Top 3.
  // 2026-09-03, audit flow intrebari/recomandari (aprobat explicit de owner). Ancora s-a
  // mutat de la "if (requestedKeys.length === 0) {" la "const unmappedQuery = ...":
  // ramura care returna lista goala cand descrierea nu se lega de catalog a fost
  // inlocuita cu o variabila, iar cererea merge acum pana la fallback-ul structural.
  // Cu requestedKeys gol nicio locatie nu intra in `results`, deci toate raman candidati
  // structurali. Statusul ramane 'query_not_mapped'. NU s-au atins buildRecommendationScore,
  // assignRecommendationBuckets sau selectia Top 3.
  assert.equal(fnv1a(matchingTail), "9895eaca");
});

await scenario("ranking and recommendation client remain byte-stable", () => {
  const client = source("src/lib/providerSemanticSearch.js");
  const marker = "export async function matchProvidersWithSemanticFallback";
  // 2026-09-03: clientul nu mai opreste cererea cand textul nu produce chei de serviciu.
  // Decizia se ia pe server, care are localitatea si poate raspunde cu fallback-ul
  // structural. Nicio schimbare de scor sau ordonare.
  assert.equal(fnv1a(client.slice(client.indexOf(marker))), "8242e30f");
});

await scenario("live result is identical when question selection does not intervene", () => {
  const liveResult = {
    mode: "shadow",
    status: "completed",
    interpretation: {
      intent: "control_vedere",
      service_keys: ["optometry_consultation"],
      confidence_band: "high",
      possible_safety_flags: [],
    },
  };
  const observation = runPatientGuidanceRuntimeShadow({
    liveResult,
    text: "Vreau un control",
    legacyStatus: "completed",
    legacyInterpretation: liveResult.interpretation,
  });
  assert.strictEqual(observation.live_result, liveResult);
});

await scenario("question history is persisted with the intake session", () => {
  const session = source("src/lib/patientIntakeSession.js");
  const card = source("src/components/intake2/ConversationalCard.jsx");
  assert.match(session, /questionHistory/);
  assert.match(card, /question_history: state\.questionHistory/);
  assert.match(card, /questionHistory: \[\.\.\.new Set/);
});

await scenario("physical Base44 function count remains unchanged", () => {
  const functionsRoot = path.join(root, "base44/functions");
  const physicalFunctions = readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => (
      entry.isDirectory()
      && existsSync(path.join(functionsRoot, entry.name, "entry.ts"))
    ));
  assert.equal(physicalFunctions.length, 48);
});

console.log(`Patient guidance adaptive question selection checks passed: ${scenarios.length} scenarios.`);
