export const PATIENT_EYE_SAFETY_POLICY_VERSION = "patient-eye-safety-v1.2";

export const PATIENT_EYE_SAFETY_STATES = Object.freeze({
  clear: "clear",
  advisory: "advisory",
  blocking: "blocking",
});

export const PATIENT_SAFETY_FLAG_PRESENTATION = Object.freeze({
  sudden_vision_loss: "Pierderea brusca sau marcata a vederii",
  chemical_injury: "Substanta chimica ajunsa in ochi",
  penetrating_or_high_speed_trauma: "Obiect patruns in ochi sau traumatism puternic",
  severe_eye_pain: "Durere oculara severa, mai ales cu modificarea vederii, greata sau cefalee",
  postoperative_red_eye_or_vision_change: "Durere, roseata sau modificarea vederii dupa operatie ori injectie oculara recenta",
  other_possible_urgent_eye_problem: "Fulgerari sau puncte noi cu umbra/perdea, vedere dubla aparuta brusc ori alt semnal acut",
});

const GUIDED_ANSWER_TO_FLAG = Object.freeze({
  pierdere_brusca_vedere: "sudden_vision_loss",
  substanta_chimica: "chemical_injury",
  traumatism_obiect: "penetrating_or_high_speed_trauma",
  durere_severa: "severe_eye_pain",
  fulgerari_perdea_diplopie: "other_possible_urgent_eye_problem",
  postoperator_acut: "postoperative_red_eye_or_vision_change",
});

const GUIDED_CLEAR_ANSWER = "niciuna";
const GUIDED_SAFETY_QUESTION_KEYS = new Set([
  "safety_screening",
  "safety_targeted_check",
]);
const GUIDED_SAFETY_ANSWER_VALUES = new Set([
  ...Object.keys(GUIDED_ANSWER_TO_FLAG),
  GUIDED_CLEAR_ANSWER,
]);

const BLOCKING_PATTERNS = Object.freeze({
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
    /\bochi(?:ul)? (?:e|este) foarte rosu\b.{0,100}\b(?:ma )?doare tare\b.{0,100}\b(?:imi vine sa vomit|greata|varsaturi)\b/,
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

const ADVISORY_PATTERNS = Object.freeze({
  sudden_vision_loss: [
    /\bnu mai vad cu un ochi\b/,
    /\bnu vad cu ochiul (?:drept|stang)\b/,
    /\bnu vad bine cu ochiul (?:drept|stang)\b/,
    /\bvad mai slab cu (?:un ochi|ochiul drept|ochiul stang)\b/,
    /\bvad incetosat cu (?:un ochi|ochiul drept|ochiul stang)\b/,
    /\bvederea (?:e|este) mai slaba la (?:un ochi|ochiul drept|ochiul stang)\b/,
  ],
  chemical_injury: [
    /\b(?:sampon|sapun|gel de dus)\b.{0,80}\b(?:in|la) ochi\b.{0,120}\b(?:inca )?(?:ma )?(?:ustura|usturime|arde|iritat)\b/,
  ],
  penetrating_or_high_speed_trauma: [
    /\bm am lovit la ochi cu (?:mingea|un obiect)\b.{0,120}\b(?:vad|vedere)\b.{0,40}\b(?:in ceata|incetosat|mai slab)\b/,
  ],
  other_possible_urgent_eye_problem: [
    /\bam nevoie urgent de (?:un )?oftalmolog\b/,
  ],
});

const CLEAR_PATTERNS = Object.freeze({
  sudden_vision_loss: [
    /\bnu (?:e|este) brusc(?:a)?\b/,
    /\bnu (?:a aparut|s a instalat) brusc\b/,
    /\bnu am pierdut vederea\b/,
    /\bvad mai slab\b.{0,80}\bde (?:cateva|mai multe|[0-9]+) (?:zile|saptamani|luni|ani)\b/,
    /\bvad\b.{0,40}\b(?:mai|mult mai) slab\b.{0,80}\bde (?:vreo )?(?:un|o|doi|doua|trei|patru|cinci|sase|sapte|opt|noua|zece|cateva|mai multe|[0-9]+) (?:zile|saptamani|luni|ani)\b/,
    /\bproblema (?:exista|este) de (?:cateva|mai multe|[0-9]+) (?:zile|saptamani|luni|ani)\b/,
    /\b(?:vad|vederea|ochiul)\b.{0,80}\bde (?:mic|mica|copil|copilarie)\b/,
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
    /\bnu (?:e|este) brusc(?:a)?\b/,
    /\bnu vad dublu\b/,
    /\bnu (?:e|este) perdea\b/,
    /\bfara fulgerari\b/,
  ],
});

const KNOWN_FLAGS = new Set(Object.keys(PATIENT_SAFETY_FLAG_PRESENTATION));

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .slice(0, 10000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function uniqueFlags(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((flag) => KNOWN_FLAGS.has(flag)))];
}

function matchingFlags(text, catalog) {
  return Object.entries(catalog)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([flag]) => flag);
}

function userTurnTexts(conversation, fallbackText = "") {
  const source = Array.isArray(conversation) && conversation.length > 0
    ? conversation
    : (fallbackText ? [{ role: "user", content: fallbackText }] : []);
  return source
    .filter((turn) => turn?.role === "user")
    .map((turn) => normalizeText(turn?.content))
    .filter(Boolean);
}

function latestGuidedSafetyAnswer(answers) {
  const source = Array.isArray(answers) ? answers.slice(-30) : [];
  for (let index = source.length - 1; index >= 0; index -= 1) {
    const answer = source[index];
    if (!GUIDED_SAFETY_QUESTION_KEYS.has(answer?.question_key)) continue;
    const answerValue = String(answer?.answer_value ?? "").trim().slice(0, 80);
    if (GUIDED_SAFETY_ANSWER_VALUES.has(answerValue)) return answerValue;
  }
  return "";
}

export function sanitizeGuidedSafetyAnswers(answers) {
  const answerValue = latestGuidedSafetyAnswer(answers);
  return answerValue ? [{
    question_key: "safety_targeted_check",
    answer_value: answerValue,
  }] : [];
}

export function guidedSafetyFlagsFromAnswers(answers) {
  const answerValue = latestGuidedSafetyAnswer(answers);
  const flag = GUIDED_ANSWER_TO_FLAG[answerValue];
  return flag ? [flag] : [];
}

export function guidedSafetyClearRequestedFromAnswers(answers) {
  return latestGuidedSafetyAnswer(answers) === GUIDED_CLEAR_ANSWER;
}

export function deterministicSafetyFlagsFromText(value) {
  const text = normalizeText(value);
  return text ? uniqueFlags(matchingFlags(text, BLOCKING_PATTERNS)) : [];
}

export function advisorySafetyFlagsFromText(value) {
  const text = normalizeText(value);
  if (!text) return [];
  const blocking = matchingFlags(text, BLOCKING_PATTERNS);
  const cleared = matchingFlags(text, CLEAR_PATTERNS)
    .filter((flag) => !blocking.includes(flag));
  return uniqueFlags(matchingFlags(text, ADVISORY_PATTERNS))
    .filter((flag) => !cleared.includes(flag) && !blocking.includes(flag));
}

export function assessPatientEyeSafety({
  conversation = [],
  text = "",
  answers = [],
  aiFlags = [],
} = {}) {
  let blockingFlags = [];
  let advisoryFlags = [];
  const clearedFlags = [];

  for (const turnText of userTurnTexts(conversation, text)) {
    const turnBlocking = matchingFlags(turnText, BLOCKING_PATTERNS);
    const turnClears = matchingFlags(turnText, CLEAR_PATTERNS)
      .filter((flag) => !turnBlocking.includes(flag));

    blockingFlags = blockingFlags.filter((flag) => !turnClears.includes(flag));
    advisoryFlags = advisoryFlags.filter((flag) => !turnClears.includes(flag));
    clearedFlags.push(...turnClears);

    const turnAdvisory = matchingFlags(turnText, ADVISORY_PATTERNS)
      .filter((flag) => !turnClears.includes(flag) && !turnBlocking.includes(flag));
    blockingFlags = uniqueFlags([...blockingFlags, ...turnBlocking]);
    advisoryFlags = uniqueFlags([...advisoryFlags, ...turnAdvisory])
      .filter((flag) => !blockingFlags.includes(flag));
  }

  const guidedFlags = guidedSafetyFlagsFromAnswers(answers);
  const guidedClearRequested = guidedSafetyClearRequestedFromAnswers(answers);
  blockingFlags = uniqueFlags([...blockingFlags, ...guidedFlags]);
  const effectiveAiFlags = uniqueFlags(aiFlags)
    .filter((flag) => !clearedFlags.includes(flag));
  const unresolvedAdvisoryFlags = uniqueFlags([...advisoryFlags, ...effectiveAiFlags])
    .filter((flag) => !blockingFlags.includes(flag));

  if (guidedClearRequested) {
    clearedFlags.push(...unresolvedAdvisoryFlags);
    advisoryFlags = [];
  } else {
    advisoryFlags = unresolvedAdvisoryFlags;
  }

  const state = blockingFlags.length > 0
    ? PATIENT_EYE_SAFETY_STATES.blocking
    : (advisoryFlags.length > 0
      ? PATIENT_EYE_SAFETY_STATES.advisory
      : PATIENT_EYE_SAFETY_STATES.clear);
  const source = guidedFlags.length > 0
    ? "guided_answer"
    : (blockingFlags.length > 0
      ? "explicit_text"
      : (guidedClearRequested
        ? "guided_clear"
        : (advisoryFlags.length > 0
          ? (effectiveAiFlags.length > 0 ? "ai_or_text_advisory" : "ambiguous_text")
          : (clearedFlags.length > 0 ? "explicit_clear" : "none"))));

  return {
    policy_version: PATIENT_EYE_SAFETY_POLICY_VERSION,
    version: PATIENT_EYE_SAFETY_POLICY_VERSION,
    state,
    clear: state === PATIENT_EYE_SAFETY_STATES.clear,
    advisory: state === PATIENT_EYE_SAFETY_STATES.advisory,
    blocking: state === PATIENT_EYE_SAFETY_STATES.blocking,
    blocking_flags: blockingFlags,
    advisory_flags: advisoryFlags,
    cleared_flags: uniqueFlags(clearedFlags),
    source,
  };
}
