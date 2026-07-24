import { PATIENT_EMERGENCY_GUIDANCE_COPY } from "./patientEmergencyGuidance.js";

export const PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION = "patient-guidance-questions-v1";

const TIMING_OPTIONS = Object.freeze([
  { key: "cat_mai_repede", label: "Cat mai repede" },
  { key: "zilele_urmatoare", label: "In zilele urmatoare" },
  { key: "saptamana_aceasta", label: "Saptamana aceasta" },
  { key: "nu_e_urgent", label: "Nu e urgent" },
]);

const SAFETY_OPTIONS = Object.freeze([
  { key: "pierdere_brusca_vedere", label: "Nu mai vad brusc sau vederea a scazut mult" },
  { key: "substanta_chimica", label: "A ajuns o substanta chimica in ochi" },
  { key: "traumatism_obiect", label: "Un obiect a patruns in ochi sau a existat o lovitura puternica" },
  { key: "durere_severa", label: "Am durere oculara foarte mare, mai ales cu vedere modificata, greata sau cefalee" },
  { key: "fulgerari_perdea_diplopie", label: "Au aparut brusc fulgerari, multe puncte, o umbra/perdea sau vedere dubla" },
  { key: "postoperator_acut", label: "Am durere, roseata sau modificarea vederii dupa operatie ori injectie oculara recenta" },
  { key: "niciuna", label: "Niciuna dintre acestea" },
]);

export const APPROVED_PATIENT_SAFETY_COPY = Object.freeze({
  eyebrow: "Informatii de siguranta",
  blocking_title: "Opreste cautarea si solicita ajutor medical imediat",
  advisory_title: "Cererea contine un posibil semnal de urgenta",
  explanation: "VIASEE nu poate stabili cauza sau gravitatea simptomelor. Pentru situatiile de mai jos, nu astepta recomandari sau raspunsuri in platforma.",
  primary_instruction: PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction,
  emergency_instruction: [
    PATIENT_EMERGENCY_GUIDANCE_COPY.fallback_instruction,
    PATIENT_EMERGENCY_GUIDANCE_COPY.transport_instruction,
    PATIENT_EMERGENCY_GUIDANCE_COPY.emergency_call_instruction,
  ].join(" "),
  chemical_instruction: "Daca a ajuns o substanta chimica in ochi: clateste imediat cu apa curata cel putin 20 de minute, indeparteaza lentilele de contact daca se desprind usor si nu freca ochiul. Continua apoi spre urgenta.",
  disclaimer: "Acest mesaj este informational si nu reprezinta diagnostic sau triaj medical.",
});

const CATALOG = {
  routine_vs_symptom: {
    type: "choice",
    title: "Cauti un control de rutina sau ai o problema la ochi?",
    options: [
      { key: "routine", label: "Control de rutina" },
      { key: "symptom", label: "Am o problema sau un simptom la ochi" },
      { key: "not_sure", label: "Nu sunt sigur" },
    ],
  },
  for_whom: {
    type: "choice",
    title: "Este pentru tine sau pentru un copil?",
    legacy_question_keys: ["pentru_cine"],
    options: [
      { key: "adult", label: "Pentru mine" },
      { key: "child", label: "Pentru un copil" },
    ],
  },
  child_age_group: {
    type: "choice",
    title: "Ce varsta aproximativa are copilul?",
    legacy_question_keys: ["varsta_copil"],
    options: [
      { key: "under_3", label: "Sub 3 ani" },
      { key: "3_6", label: "3-6 ani" },
      { key: "7_12", label: "7-12 ani" },
      { key: "13_18", label: "13-18 ani" },
    ],
  },
  investigation_type: {
    type: "choice",
    title: "Ce investigatie cauti?",
    legacy_question_keys: ["investigatie"],
    options: [
      { key: "oct", label: "OCT", service_keys: ["oct"] },
      { key: "visual_field_analyzer", label: "Camp vizual", service_keys: ["visual_field_analyzer"] },
      { key: "tonometry", label: "Tonometrie", service_keys: ["tonometry"] },
      { key: "fundus_exam", label: "Fund de ochi", service_keys: ["fundus_exam"] },
      { key: "corneal_topography", label: "Topografie corneana", service_keys: ["corneal_topography"] },
      { key: "not_sure", label: "Nu stiu ce investigatie este" },
    ],
  },
  investigation_reference_text: {
    type: "text",
    title: "Scrie ce apare pe recomandare sau pe biletul primit.",
  },
  optical_product_type: {
    type: "choice",
    title: "Ce cauti?",
    legacy_question_keys: ["ce_cauti"],
    options: [
      { key: "new_eyeglasses", label: "Ochelari noi", service_keys: ["eyeglasses"] },
      { key: "progressive_lenses", label: "Lentile progresive", service_keys: ["progressive_lenses"] },
      { key: "lens_replacement", label: "Schimbare lentile", service_keys: ["lens_replacement"] },
      { key: "contact_lenses", label: "Lentile de contact", service_keys: ["contact_lenses"] },
      { key: "not_sure", label: "Nu sunt sigur" },
    ],
  },
  contact_lens_experience: {
    type: "choice",
    title: "Este prima data cand folosesti lentile de contact?",
    legacy_question_keys: ["prima_data"],
    options: [
      { key: "first_time", label: "Da, este prima data", service_keys: ["contact_lens_consultation", "contact_lens_fitting"] },
      { key: "experienced", label: "Am mai purtat lentile", service_keys: ["contact_lenses"] },
      { key: "not_sure", label: "Nu sunt sigur" },
    ],
  },
  repair_type: {
    type: "choice",
    title: "Ce s-a deteriorat?",
    legacy_question_keys: ["ce_deteriorat"],
    options: [
      { key: "broken_frame", label: "Rama rupta", service_keys: ["frame_repair"] },
      { key: "hinge_or_screw", label: "Balamaua sau surubul", service_keys: ["hinge_repair", "screw_replacement"] },
      { key: "damaged_lens", label: "Lentila zgariata sau sparta", service_keys: ["lens_replacement"] },
      { key: "frame_adjustment", label: "Reglaj rama", service_keys: ["eyeglasses_adjustment"] },
      { key: "not_sure", label: "Nu stiu exact", service_keys: ["eyeglasses_repair"] },
    ],
  },
  symptom_description: {
    type: "text",
    title: "Descrie pe scurt ce te preocupa.",
    legacy_question_keys: ["descriere"],
    placeholder: "Ex: de cateva zile vad in ceata la ochiul drept",
  },
  symptom_timing_or_acuity: {
    type: "choice",
    title: "Cand a aparut si cum a evoluat problema?",
    options: [
      { key: "sudden", label: "A aparut brusc" },
      { key: "recent", label: "A aparut recent si persista" },
      { key: "gradual", label: "A aparut treptat" },
      { key: "recurrent", label: "A mai aparut si inainte" },
      { key: "not_sure", label: "Nu sunt sigur" },
    ],
  },
  locality: {
    type: "location",
    title: "Unde cauti?",
    legacy_question_keys: ["locatie"],
  },
  timing: {
    type: "choice",
    title: "Cand ai nevoie?",
    options: TIMING_OPTIONS,
  },
  safety_targeted_check: {
    type: "choice",
    title: "Se aplica acum una dintre situatiile de mai jos?",
    legacy_question_keys: ["safety_screening"],
    helper: "Selecteaza situatia exacta. VIASEE nu stabileste diagnosticul, dar nu continua cautarea obisnuita cand exista un semnal clar de urgenta.",
    options: SAFETY_OPTIONS,
    safety_copy: APPROVED_PATIENT_SAFETY_COPY,
  },
};

export const PATIENT_GUIDANCE_QUESTION_CATALOG = Object.freeze(
  Object.fromEntries(Object.entries(CATALOG).map(([key, question]) => [
    key,
    Object.freeze({
      key,
      ...question,
      options: question.options ? Object.freeze(question.options.map((option) => Object.freeze({ ...option }))) : undefined,
      legacy_question_keys: Object.freeze([...(question.legacy_question_keys || [])]),
    }),
  ])),
);

export const PATIENT_GUIDANCE_QUESTION_KEYS = Object.freeze(
  Object.keys(PATIENT_GUIDANCE_QUESTION_CATALOG),
);

export function isApprovedPatientGuidanceQuestionKey(questionKey) {
  return Object.hasOwn(PATIENT_GUIDANCE_QUESTION_CATALOG, String(questionKey || ""));
}

export function getApprovedPatientGuidanceQuestion(questionKey) {
  const question = PATIENT_GUIDANCE_QUESTION_CATALOG[String(questionKey || "")];
  if (!question) return null;
  return {
    ...question,
    options: question.options?.map((option) => ({
      ...option,
      service_keys: [...(option.service_keys || [])],
    })),
    legacy_question_keys: [...question.legacy_question_keys],
  };
}

export function resolvePatientGuidanceQuestionPlan(questionKey) {
  const question = getApprovedPatientGuidanceQuestion(questionKey);
  return question
    ? { status: "approved", question_key: question.key, question }
    : { status: "rejected", question_key: null, question: null };
}
