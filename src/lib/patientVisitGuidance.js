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
      "Spune medicului cum îți afectează vederea viața de zi cu zi: cititul, condusul, lumina puternică sau farurile noaptea.",
      "Dacă se discută operația, pot fi necesare măsurători suplimentare ale ochiului. Întreabă ce presupun și ce tipuri de cristalin artificial există.",
    ],
  },
  operat_cataracta: {
    title: "Operație de cataractă în trecut",
    points: [
      "Spune medicului când ai fost operat și la ce ochi; adu scrisoarea medicală de la operație, dacă o ai.",
    ],
  },
  glaucom: {
    title: "Glaucom sau tensiune oculară",
    points: [
      "Continuă tratamentul prescris și nu întrerupe picăturile fără să vorbești cu medicul.",
      "Adu lista picăturilor (numele și de câte ori pe zi) și rezultatele anterioare: tensiunea oculară, câmpul vizual, OCT.",
      "Glaucomul se urmărește periodic, chiar dacă nu observi schimbări ale vederii.",
    ],
  },
  glaucom_familie: {
    title: "Glaucom în familie",
    points: [
      "Spune medicului că ai rude cu glaucom: istoricul familial contează la evaluare și poate duce la măsurarea tensiunii oculare.",
    ],
  },
  diabet: {
    title: "Diabet",
    points: [
      "Diabetul poate afecta retina fără simptome la început, de aceea fundul de ochi se verifică regulat, de obicei anual sau cum recomandă medicul.",
      "Adu ultimele analize (de exemplu glicemia sau hemoglobina glicată), dacă le ai.",
      "Fundul de ochi se examinează de obicei cu pupila dilatată: nu conduce după consult.",
    ],
  },
  hipertensiune: {
    title: "Tensiune arterială mare",
    points: [
      "Spune medicului că ai tensiune arterială mare și ce tratament urmezi; tensiunea poate influența vasele de sânge ale retinei.",
      "Adu lista medicamentelor pe care le iei.",
    ],
  },
  ochi_uscat: {
    title: "Ochi uscați sau iritați",
    points: [
      "Notează când apar simptomele (la ecran, în aer condiționat, dimineața) și ce picături ai încercat.",
      "Dacă porți lentile de contact, spune câte ore pe zi le porți.",
    ],
  },
});

// Ordinea de afisare cand sunt mai multe afectiuni.
const CONDITION_ORDER = ["glaucom", "glaucom_familie", "cataracta", "operat_cataracta", "diabet", "hipertensiune", "ochi_uscat"];

// Glaucomul unei rude nu e glaucomul pacientului: "am glaucom in familie", "mama are glaucom".
const FAMILY_GLAUCOMA_PATTERN = /\bglaucom (?:in|din) famili\w*|\brud\w* cu glaucom|\b(?:mama|mamei|tata|tatal|tatalui|parintii|parintilor|bunica|bunicul|bunicii|fratele|sora)\b(?: \w+){0,2} (?:are|au|a avut|au avut) glaucom/;

const TEXT_CONDITION_RULES = [
  { condition: "cataracta", pattern: /\bcataract/ },
  { condition: "glaucom", pattern: /\bglaucom|\btensiune(?:a)? oculara|\bpresiune(?:a)? oculara|\btensiune(?:a)? (?:in|la) ochi/ },
  { condition: "diabet", pattern: /\bdiabet/ },
  { condition: "hipertensiune", pattern: /\bhipertensiune|\btensiune(?:a)? arteriala|\btensiune(?:a)? mare\b(?! oculara)|\bam tensiune\b(?! oculara)/ },
  { condition: "ochi_uscat", pattern: /\bochi(?:i)? uscat|\buscaciune|\bma usuca ochii|\bnisip in ochi/ },
];

const SERVICE_CONDITIONS = Object.freeze({
  cataract_consultation: "cataracta",
  cataract_surgery: "cataracta",
  glaucoma_consultation: "glaucom",
  diabetic_retinopathy: "diabet",
  dry_eye_management: "ochi_uscat",
  dry_eye_screening: "ochi_uscat",
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
        ? "La un medic oftalmolog (cabinet sau clinică de oftalmologie), pentru afecțiunile pe care le-ai menționat."
        : "La un optometrist sau la un medic oftalmolog. Dacă ai diabet, glaucom sau cataractă, alege un medic oftalmolog.";
    case "control_copil":
      return "La un consult pentru copii (oftalmologic sau optometric pediatric).";
    case "simptome_oftalmologice":
      return "La un medic oftalmolog (cabinet sau clinică de oftalmologie).";
    case "investigatii":
      return "La o clinică sau un cabinet de oftalmologie care are aparatura pentru investigația din trimitere.";
    case "ochelari_lentile":
      return byKey.prescription_status === "needs_exam" || byKey.reteta === "needs_exam"
        ? "Întâi un consult pentru dioptrii (optometrist sau medic oftalmolog), apoi o optică. Multe optici au și cabinet."
        : "La o optică. Adu rețeta.";
    case "lentile_contact":
      return byKey.contact_lens_experience === "first_time" || byKey.prima_data === "da"
        ? "La un optometrist sau medic oftalmolog care face adaptarea lentilelor de contact."
        : "La o optică sau un cabinet care are lentilele tale.";
    case "reparatii_ochelari":
      return "La o optică cu atelier. Reglajele și șuruburile se rezolvă de multe ori pe loc; întreabă înainte.";
    default:
      return "Dacă nu ești sigur, un consult optometric sau oftalmologic este un punct bun de pornire.";
  }
}

function preparationTips(intent, byKey, conditions) {
  const wearsLenses = conditions.has("poarta_lentile");
  const consult = CONSULT_INTENTS.has(intent)
    || ((intent === "ochelari_lentile") && (byKey.prescription_status === "needs_exam" || byKey.reteta === "needs_exam"))
    || ((intent === "lentile_contact") && (byKey.contact_lens_experience === "first_time" || byKey.prima_data === "da"));

  if (intent === "control_copil") {
    return [
      "Alege o oră la care copilul este odihnit.",
      "Adu ochelarii copilului (dacă are) și scrisorile medicale anterioare.",
      "Spune ce ai observat acasă sau la școală și dacă în familie există ochelari purtați de mic, strabism sau ochi leneș.",
      "La copii se folosesc des picături pentru măsurarea exactă a dioptriilor; vederea poate fi încețoșată câteva ore după consult.",
    ];
  }
  if (intent === "reparatii_ochelari") {
    return [
      "Ia ochelarii și, dacă le ai, piesele desprinse (șurub, plachetă, braț).",
      "Întreabă înainte dacă reparația se face pe loc și cât costă.",
    ];
  }
  if (intent === "ochelari_lentile" && !consult) {
    const tips = ["Adu rețeta și ochelarii pe care îi porți acum."];
    if (byKey.optical_product_type === "progressive_lenses" || byKey.ce_cauti === "lentile_progresive") {
      tips.push("Pentru lentile progresive, spune la ce distanțe folosești cel mai mult vederea: citit, calculator, condus.");
    }
    tips.push("Întreabă cât durează realizarea ochelarilor.");
    return tips;
  }
  if (intent === "lentile_contact" && !consult) {
    return [
      "Adu cutia lentilelor actuale (are parametrii pe ea) și rețeta, dacă o ai.",
    ];
  }
  if (!consult) return [];

  const tips = ["Ia cu tine ochelarii pe care îi porți și, dacă o ai, ultima rețetă."];
  if (wearsLenses || intent === "lentile_contact") {
    tips.push("Dacă porți lentile de contact, adu-le (sau cutia lor) și întreabă la programare dacă trebuie să nu le porți înainte de consult.");
  }
  tips.push("Notează medicamentele și picăturile pe care le folosești.");
  if (intent === "investigatii") {
    tips.push("Adu trimiterea și, dacă ai, investigațiile anterioare de același tip, pentru comparație.");
  } else {
    tips.push("Adu scrisorile medicale sau rezultatele investigațiilor anterioare, dacă ai.");
  }
  tips.push("La unele consulturi se folosesc picături care dilată pupila: vederea poate rămâne încețoșată și sensibilă la lumină câteva ore. Nu conduce după consult și, dacă poți, vino însoțit.");
  return tips;
}

export function buildPatientVisitGuidance({ intent = "unknown", answers = [], text = "", serviceKeys = [] } = {}) {
  const byKey = answerMap(answers);
  const conditions = patientAnamnesisConditions(answers);
  for (const condition of detectPatientConditionsFromText(text)) conditions.add(condition);
  for (const key of Array.isArray(serviceKeys) ? serviceKeys : []) {
    if (SERVICE_CONDITIONS[key]) conditions.add(SERVICE_CONDITIONS[key]);
  }
  // Nota despre glaucomul din familie nu se repeta cand exista deja nota de glaucom.
  if (conditions.has("glaucom")) conditions.delete("glaucom_familie");

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
      ? "Dacă simptomele se agravează brusc (vederea scade repede, apare o durere puternică sau o umbră în fața ochiului), cere o evaluare medicală fără să aștepți programarea."
      : "",
    disclaimer: PATIENT_VISIT_GUIDANCE_DISCLAIMER,
  };
}
