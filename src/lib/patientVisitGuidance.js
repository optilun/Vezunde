// Recomandari pentru vizita, afisate pacientului inainte de cautare.
//
// 2026-09-24, cerere explicita a owner-ului: pacientii sa primeasca recomandari, inclusiv
// pentru afectiuni ca cataracta sau tensiunea (oculara / arteriala), in locul unor semne
// alarmante. Textele sunt fixe si informative: cum te pregatesti, ce iei cu tine, ce spui
// medicului. Nu contin diagnostic, doze, tratamente noi sau alegeri de furnizori, iar
// modelul AI nu scrie nimic din ele - codul alege blocurile dupa nevoia confirmata,
// anamneza si cuvintele pacientului. De revizuit medical inainte de o extindere.
import { patientAnamnesisConditions } from "./patientAnamnesis.js";

export const PATIENT_VISIT_GUIDANCE_VERSION = "patient-visit-guidance-v1";

export const PATIENT_VISIT_GUIDANCE_DISCLAIMER =
  "Informații generale, orientative. Nu înlocuiesc sfatul medicului și nu reprezintă un diagnostic.";

const CONSULT_INTENTS = new Set(["control_vedere", "simptome_oftalmologice", "investigatii"]);

const CONDITION_NOTES = Object.freeze({
  cataracta: {
    title: "Cataractă",
    points: [
      "Cataracta se evaluează la un medic oftalmolog.",
      "Spune cum te încurcă la citit, la condus sau noaptea.",
      "Dacă se discută operația, întreabă ce măsurători sunt necesare și ce cristaline există.",
    ],
  },
  operat_cataracta: {
    title: "Operație de cataractă în trecut",
    points: [
      "Spune când și la ce ochi ai fost operat; adu scrisoarea medicală.",
    ],
  },
  glaucom: {
    title: "Glaucom sau tensiune oculară",
    points: [
      "Continuă tratamentul și nu întrerupe picăturile fără acordul medicului.",
      "Adu lista picăturilor și rezultatele anterioare (tensiune oculară, câmp vizual, OCT).",
      "Controalele periodice contează, chiar dacă vezi bine.",
    ],
  },
  glaucom_familie: {
    title: "Glaucom în familie",
    points: [
      "Spune medicului că ai rude cu glaucom.",
    ],
  },
  diabet: {
    title: "Diabet",
    points: [
      "Diabetul poate afecta retina fără simptome; fundul de ochi se verifică de obicei anual.",
      "Adu ultimele analize (glicemie, hemoglobină glicată).",
      "Pupila se dilată de obicei: nu conduce după consult.",
    ],
  },
  hipertensiune: {
    title: "Tensiune arterială mare",
    points: [
      "Spune că ai tensiune arterială mare și ce tratament iei.",
      "Adu lista medicamentelor.",
    ],
  },
  ochi_uscat: {
    title: "Ochi uscați sau iritați",
    points: [
      "Notează când apar simptomele și ce picături ai încercat.",
      "Dacă porți lentile de contact, spune câte ore pe zi.",
    ],
  },
  // 2026-09-26: note noi, revizuite de Claude (AI) pe baza ghidurilor publice pentru pacienti
  // (AAO, NHS), la cererea owner-ului, care nu are un medic disponibil. De revazut cu un medic
  // cand se poate. Raman informative: fara diagnostic, doze sau tratamente noi.
  keratocon: {
    title: "Keratocon",
    points: [
      "Spune ce tratamente ai făcut (cross-linking, lentile speciale).",
      "Adu ultimele topografii corneene; întreabă cât timp să nu porți lentilele înainte.",
      "Nu îți freca ochii. Keratoconul se urmărește periodic.",
    ],
  },
  degenerescenta_maculara: {
    title: "Degenerescență maculară",
    points: [
      "Adu OCT-urile anterioare și lista injecțiilor, dacă ai făcut.",
      "Spune dacă liniile drepte par ondulate sau vezi o pată în centru.",
      "Dacă aceste semne apar brusc, cere o evaluare cât mai curând.",
    ],
  },
  conjunctivita: {
    title: "Conjunctivită sau alergie la ochi",
    points: [
      "Nu purta lentile de contact până la consult.",
      "Spală-te des pe mâini și nu folosi prosoape comune.",
      "Dacă apar durere mare, sensibilitate la lumină sau vedere încețoșată, cere o evaluare fără să aștepți.",
    ],
  },
  miopie_copil: {
    title: "Miopie la copil",
    points: [
      "Adu rețetele vechi ale copilului.",
      "Întreabă despre controlul miopiei.",
      "Timpul petrecut afară și pauzele de la ecrane ajută des; întreabă medicul.",
    ],
  },
  ochi_lenes_strabism: {
    title: "Ochi leneș sau strabism",
    points: [
      "Spune de când ai observat și dacă ochiul deviază mereu sau doar uneori.",
      "Tratamentul merge cel mai bine când începe devreme: nu amâna consultul.",
      "Dacă ochiul a început brusc să devieze, cere o evaluare cât mai curând.",
    ],
  },
});

// Ordinea de afisare cand sunt mai multe afectiuni.
const CONDITION_ORDER = [
  "glaucom", "glaucom_familie", "keratocon", "degenerescenta_maculara", "cataracta", "operat_cataracta",
  "diabet", "hipertensiune", "conjunctivita", "ochi_uscat", "miopie_copil", "ochi_lenes_strabism",
];

// Glaucomul unei rude nu e glaucomul pacientului: "am glaucom in familie", "mama are glaucom".
const FAMILY_GLAUCOMA_PATTERN = /\bglaucom (?:in|din) famili\w*|\brud\w* cu glaucom|\b(?:mama|mamei|tata|tatal|tatalui|parintii|parintilor|bunica|bunicul|bunicii|fratele|sora)\b(?: \w+){0,2} (?:are|au|a avut|au avut) glaucom/;

const TEXT_CONDITION_RULES = [
  { condition: "cataracta", pattern: /\bcataract/ },
  { condition: "glaucom", pattern: /\bglaucom|\btensiune(?:a)? oculara|\bpresiune(?:a)? oculara|\btensiune(?:a)? (?:in|la) ochi/ },
  { condition: "diabet", pattern: /\bdiabet/ },
  { condition: "hipertensiune", pattern: /\bhipertensiune|\btensiune(?:a)? arteriala|\btensiune(?:a)? mare\b(?! oculara)|\bam tensiune\b(?! oculara)/ },
  { condition: "ochi_uscat", pattern: /\bochi(?:i)? uscat|\buscaciune|\bma usuca ochii|\bnisip in ochi/ },
  // Nota proprie din 2026-09-26; la lentile de contact schimba si unde e indrumat pacientul.
  { condition: "keratocon", pattern: /\b(?:k|ch)eratocon/ },
  { condition: "degenerescenta_maculara", pattern: /\bdegenerescent\w* macular|\bdmla\b|\bmaculopati/ },
  { condition: "conjunctivita", pattern: /\bconjunctivit|\balergi/ },
];

// Doar la controlul pentru copil: notele de mai jos vorbesc despre copil.
const CHILD_TEXT_CONDITION_RULES = [
  { condition: "miopie_copil", pattern: /\bmiopi|\bmiop\b/ },
  { condition: "ochi_lenes_strabism", pattern: /\bochi(?:ul)? lenes|\bambliopi|\bstrabism|\bcrucis|\bsasi[ue]\b|\bse uita cruc|\bochi\w* (?:care )?fug|\bfuge un ochi|\bdeviaz/ },
];

const CHILD_SERVICE_CONDITIONS = Object.freeze({
  myopia_control_children: "miopie_copil",
  strabismus: "ochi_lenes_strabism",
  strabismus_screening: "ochi_lenes_strabism",
  amblyopia_screening: "ochi_lenes_strabism",
});

const SERVICE_CONDITIONS = Object.freeze({
  cataract_consultation: "cataracta",
  cataract_surgery: "cataracta",
  glaucoma_consultation: "glaucom",
  diabetic_retinopathy: "diabet",
  dry_eye_management: "ochi_uscat",
  dry_eye_screening: "ochi_uscat",
  macular_degeneration: "degenerescenta_maculara",
});

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function answerMap(answers = []) {
  return Object.fromEntries((Array.isArray(answers) ? answers : [])
    .filter((answer) => answer?.question_key)
    .map((answer) => [answer.question_key, String(answer.answer_value || "")]));
}

export function detectPatientConditionsFromText(text) {
  const normalized = normalize(text);
  const conditions = new Set();
  const withoutFamily = normalized.replace(new RegExp(FAMILY_GLAUCOMA_PATTERN.source, "g"), " ");
  if (withoutFamily !== normalized) conditions.add("glaucom_familie");
  for (const rule of TEXT_CONDITION_RULES) {
    if (rule.pattern.test(withoutFamily)) conditions.add(rule.condition);
  }
  return conditions;
}

function whereToGo(intent, byKey, conditions) {
  const medicalCondition = ["cataracta", "glaucom", "diabet"].some((condition) => conditions.has(condition));
  switch (intent) {
    case "control_vedere":
      return medicalCondition
        ? "La un medic oftalmolog, pentru afecțiunile menționate."
        : "La un optometrist sau un medic oftalmolog.";
    case "control_copil":
      return "La un consult oftalmologic sau optometric pentru copii.";
    case "simptome_oftalmologice":
      return "La un medic oftalmolog.";
    case "investigatii":
      return "La o clinică de oftalmologie care face investigația din trimitere.";
    case "ochelari_lentile":
      return byKey.prescription_status === "needs_exam" || byKey.reteta === "needs_exam"
        ? "Întâi un consult pentru dioptrii, apoi o optică (multe au și cabinet)."
        : "La o optică. Adu rețeta.";
    case "lentile_contact":
      // 2026-09-26, decizia owner-ului: la keratocon lentilele se adapteaza la specialist.
      if (conditions.has("keratocon")) {
        return "La un specialist care adaptează lentile de contact speciale.";
      }
      return byKey.contact_lens_experience === "first_time" || byKey.prima_data === "da"
        ? "La un optometrist sau oftalmolog care adaptează lentile de contact."
        : "La o optică sau un cabinet cu lentilele tale.";
    case "reparatii_ochelari":
      return "La o optică cu atelier; reglajele se fac des pe loc.";
    default:
      return "Un consult optometric sau oftalmologic e un bun început.";
  }
}

function preparationTips(intent, byKey, conditions) {
  const wearsLenses = conditions.has("poarta_lentile");
  const consult = CONSULT_INTENTS.has(intent)
    || ((intent === "ochelari_lentile") && (byKey.prescription_status === "needs_exam" || byKey.reteta === "needs_exam"))
    || ((intent === "lentile_contact") && (byKey.contact_lens_experience === "first_time" || byKey.prima_data === "da" || conditions.has("keratocon")));

  if (intent === "control_copil") {
    return [
      "Alege o oră la care copilul este odihnit.",
      "Adu ochelarii și scrisorile medicale ale copilului.",
      "Spune ce ai observat acasă sau la școală.",
      "Picăturile pentru dioptrii pot încețoșa vederea câteva ore, uneori până a doua zi.",
    ];
  }
  if (intent === "reparatii_ochelari") {
    return [
      "Ia ochelarii și piesele desprinse, dacă le ai.",
      "Întreabă dacă se repară pe loc și cât costă.",
    ];
  }
  if (intent === "ochelari_lentile" && !consult) {
    const tips = ["Adu rețeta și ochelarii actuali."];
    if (byKey.optical_product_type === "progressive_lenses" || byKey.ce_cauti === "lentile_progresive") {
      tips.push("Spune la ce folosești cel mai des vederea: citit, calculator, condus.");
    }
    tips.push("Întreabă în cât timp sunt gata.");
    return tips;
  }
  if (intent === "lentile_contact" && !consult) {
    return [
      "Adu cutia lentilelor actuale și rețeta.",
    ];
  }
  if (!consult) return [];

  const tips = ["Ia ochelarii și ultima rețetă."];
  if (wearsLenses || intent === "lentile_contact") {
    tips.push("Dacă porți lentile de contact, întreabă dacă să nu le porți înainte.");
  }
  tips.push("Notează medicamentele și picăturile.");
  if (intent === "investigatii") {
    tips.push("Adu trimiterea și investigațiile anterioare.");
  } else {
    tips.push("Adu scrisorile medicale și rezultatele anterioare.");
  }
  tips.push("Pupila poate fi dilatată: nu conduce după consult; vino însoțit, dacă poți.");
  return tips;
}

export function buildPatientVisitGuidance({ intent = "unknown", answers = [], text = "", serviceKeys = [] } = {}) {
  const byKey = answerMap(answers);
  const conditions = patientAnamnesisConditions(answers);
  for (const condition of detectPatientConditionsFromText(text)) conditions.add(condition);
  const keys = Array.isArray(serviceKeys) ? serviceKeys : [];
  const fromServicesOnly = new Set();
  for (const key of keys) {
    const condition = SERVICE_CONDITIONS[key];
    if (condition && !conditions.has(condition)) {
      conditions.add(condition);
      fromServicesOnly.add(condition);
    }
  }
  if (intent === "control_copil") {
    const normalized = normalize(text);
    for (const rule of CHILD_TEXT_CONDITION_RULES) {
      if (rule.pattern.test(normalized)) conditions.add(rule.condition);
    }
    for (const key of keys) {
      if (CHILD_SERVICE_CONDITIONS[key]) conditions.add(CHILD_SERVICE_CONDITIONS[key]);
    }
  }
  // Nota despre glaucomul din familie nu se repeta cand exista deja nota de glaucom.
  if (conditions.has("glaucom")) conditions.delete("glaucom_familie");
  // O conjunctivita sau o alergie nu primeste si nota de ochi uscat venita doar din servicii.
  if (conditions.has("conjunctivita") && fromServicesOnly.has("ochi_uscat")) conditions.delete("ochi_uscat");

  const notes = CONDITION_ORDER
    .filter((condition) => conditions.has(condition) && CONDITION_NOTES[condition])
    .slice(0, 3)
    .map((condition) => ({ key: condition, ...CONDITION_NOTES[condition] }));

  return {
    version: PATIENT_VISIT_GUIDANCE_VERSION,
    where: whereToGo(intent, byKey, conditions),
    prepare: preparationTips(intent, byKey, conditions).slice(0, 5),
    notes,
    // Plasa de siguranta pentru simptome: fara spital, UPU sau 112 (politica pentru suprafetele
    // care nu sunt o urgenta confirmata), acelasi mesaj ca pe ecranul de confirmare.
    safety_net: intent === "simptome_oftalmologice"
      ? "Dacă se agravează brusc (vederea scade, durere mare, o umbră), cere o evaluare fără să aștepți."
      : "",
    disclaimer: PATIENT_VISIT_GUIDANCE_DISCLAIMER,
  };
}
