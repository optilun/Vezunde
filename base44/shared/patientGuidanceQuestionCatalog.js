export const PATIENT_GUIDANCE_QUESTION_CATALOG_VERSION = "patient-guidance-questions-v1";

// 2026-09-01 (rescrierea chestionarului): patru optiuni amestecau doua axe -
// "In zilele urmatoare" si "Saptamana aceasta" se suprapuneau, iar "Nu e urgent"
// raspundea la urgenta, nu la termen. Pacientul vede acum trei, distincte intre ele.
//
// "saptamana_aceasta" ramane DEFINITA, dar marcata `hidden`: nu se mai ofera in
// interfata, insa ramane o valoare valida. Exista cereri deja salvate cu ea, schema
// raspunsului LLM o accepta in continuare, si e punctata in buildRecommendationScore.
// Daca ar fi fost stearsa complet, toate acestea ar fi devenit invalide tacit.
const TIMING_OPTIONS = Object.freeze([
  { key: "cat_mai_repede", label: "Cât mai repede" },
  { key: "zilele_urmatoare", label: "În următoarele zile" },
  { key: "saptamana_aceasta", label: "Săptămâna aceasta", hidden: true },
  { key: "nu_e_urgent", label: "Nu e urgent" },
]);

const SAFETY_OPTIONS = Object.freeze([
  { key: "pierdere_brusca_vedere", label: "În ultimele ore sau zile, vederea a dispărut brusc la un ochi (nu vedere slabă de mai mult timp)" },
  { key: "substanta_chimica", label: "A ajuns o substanță chimică în ochi" },
  { key: "traumatism_obiect", label: "Un obiect a pătruns în ochi sau a existat o lovitură puternică" },
  { key: "durere_severa", label: "Am durere oculară foarte mare, mai ales cu vedere modificată, greață sau cefalee" },
  { key: "fulgerari_perdea_diplopie", label: "Au apărut brusc fulgerări, multe puncte, o umbră/perdea sau vedere dublă" },
  { key: "postoperator_acut", label: "Am durere, roșeață sau modificarea vederii după operație ori injecție oculară recentă" },
  { key: "niciuna", label: "Niciuna dintre acestea" },
]);

export const APPROVED_PATIENT_SAFETY_COPY = Object.freeze({
  eyebrow: "Informații de siguranță",
  blocking_title: "Oprește căutarea și solicită ajutor medical imediat",
  advisory_title: "Cererea conține un posibil semnal de urgență",
  explanation: "VIASEE nu poate stabili cauza sau gravitatea simptomelor. Pentru situațiile de mai jos, nu aștepta recomandări sau răspunsuri în platformă.",
  primary_instruction: "Mergi imediat la UPU, camera de gardă sau un serviciu de urgențe oftalmologice.",
  emergency_instruction: "Sună la 112 dacă nu te poți deplasa în siguranță, vederea s-a pierdut brusc, există un traumatism sever sau starea se agravează. Nu conduce.",
  chemical_instruction: "Dacă a ajuns o substanță chimică în ochi: clătește imediat cu apă curată cel puțin 20 de minute, îndepărtează lentilele de contact dacă se desprind ușor și nu freca ochiul. Continuă apoi spre urgență.",
  // 2026-09-02: pana acum, un pacient cu un obiect patruns in ochi nu primea niciun prim
  // ajutor pe ecranul blocant, desi politica il defineste (sectiunea 3) si constructorul
  // canonic de mesaj din shared/patientEmergencyGuidance.js il include. Formularea nu e
  // scrisa acum: e copiata cuvant cu cuvant din instructiunea aprobata pentru traumatism
  // penetrant din acel fisier, ca ecranul si mesajul canonic sa spuna exact acelasi lucru.
  // Cele doua constante raman separate deliberat (fiecare cu suprafata ei de aprobare);
  // aici se dubleaza doar textul, nu si referinta.
  // Precedenta ceruta de politica: cand exista si traumatism penetrant, si substanta chimica,
  // precautia pentru obiect are prioritate si instructiunea de clatire se suprima.
  penetrating_instruction: "Dacă un obiect a pătruns sau a rămas înfipt în ochi, nu încerca să îl scoți, nu freca și nu apăsa pe ochi.",
  disclaimer: "Acest mesaj este informațional și nu reprezintă diagnostic sau triaj medical.",
});

// 2026-09-01: rescrierea chestionarului pacientului.
// Formularile sunt scrise acum cu diacritice - textul citit de pacient trebuie sa arate
// ca romana scrisa corect. Cheile de optiune raman NESCHIMBATE peste tot, pentru ca sunt
// referite in matricea de rutare, in aliasurile de valori legacy si in cererile deja
// salvate. Singura cheie noua este for_whom.other_adult.
// Formularile de triaj de urgenta (SAFETY_OPTIONS, APPROVED_PATIENT_SAFETY_COPY) NU au
// fost atinse: sunt text clinic si au nevoie de revizuire medicala, nu de redactare.
const CATALOG = {
  routine_vs_symptom: {
    type: "choice",
    title: "Ce te aduce la noi?",
    options: [
      { key: "routine", label: "Un control — nu văd bine sau a trecut mult timp" },
      { key: "symptom", label: "O problemă apărută recent" },
      { key: "not_sure", label: "Nu sunt sigur — ajută-mă să aleg" },
    ],
  },
  for_whom: {
    type: "choice",
    title: "Pentru cine este?",
    legacy_question_keys: ["pentru_cine"],
    options: [
      { key: "adult", label: "Pentru mine" },
      // 2026-09-01: pana acum, raspunsul "pentru copil" nu ajungea deloc in service_keys pe
      // fluxul de simptome - se schimba intentia doar cand nevoia era un control de rutina.
      // Un copil cu ochiul rosu ajungea deci la aceleasi locatii ca un adult, iar cheia
      // children_eye_exam nu era accesibila din chestionar. Acum optiunea poarta ea insasi
      // cheia, deci semnalul intra si prin resolveOptionServiceKeys pe client, si prin
      // confirmedServiceKeysFromAnswers pe server, pe orice flux.
      // Potrivirea pe servicii e aditiva (requestedSet.has, OR peste chei), iar cheia are
      // acelasi service_need_level 'specialized_medical' si aceeasi prerechizita
      // (ophthalmologist) ca un consult oftalmologic - deci nu restrange rezultatele,
      // doar avantajeaza locatiile care chiar declara consult pentru copii.
      { key: "child", label: "Pentru copilul meu", service_keys: ["children_eye_exam"] },
      // Optiune noua: cine cauta pentru un parinte in varsta - o parte importanta din
      // cererea de cataracta si glaucom - nu avea ce bifa si se incadra ca adult-pentru-sine.
      { key: "other_adult", label: "Pentru altcineva (părinte, partener)" },
    ],
  },
  child_age_group: {
    type: "choice",
    title: "Ce vârstă are copilul?",
    legacy_question_keys: ["varsta_copil"],
    options: [
      { key: "under_3", label: "Sub 3 ani" },
      { key: "3_6", label: "3–6 ani" },
      { key: "7_12", label: "7–14 ani" },
      { key: "13_18", label: "15–18 ani" },
    ],
  },
  investigation_type: {
    type: "choice",
    title: "Ce scrie pe trimiterea ta?",
    legacy_question_keys: ["investigatie"],
    // Inainte intrebarea era "Ce investigatie cauti?", adica ii cerea pacientului sa aleaga
    // singur intre OCT, camp vizual si tonometrie - imposibil fara o hartie de la medic.
    // Acum premisa e explicita: intrebam ce scrie pe trimitere, nu ce crede ca ii trebuie.
    helper: "Dacă ai primit o trimitere sau o recomandare, alege ce scrie pe ea.",
    options: [
      { key: "oct", label: "OCT", service_keys: ["oct"] },
      { key: "visual_field_analyzer", label: "Câmp vizual", service_keys: ["visual_field_analyzer"] },
      { key: "tonometry", label: "Tonometrie", service_keys: ["tonometry"] },
      { key: "fundus_exam", label: "Fund de ochi", service_keys: ["fundus_exam"] },
      { key: "corneal_topography", label: "Topografie corneană", service_keys: ["corneal_topography"] },
      { key: "not_sure", label: "Nu am trimiterea la mine sau nu înțeleg ce scrie" },
    ],
  },
  investigation_reference_text: {
    type: "text",
    title: "Ce scrie pe trimitere?",
    helper: "Poți scrie exact ce vezi, chiar dacă nu îți spune nimic. Dacă nu o ai la tine, treci mai departe.",
    placeholder: "Ex: OCT ochi drept, sau consult glaucom",
    // Permite trecerea fara raspuns: inainte, un pacient care nu avea hartia la el ramanea
    // blocat - campul nu accepta raspuns gol si nu exista nicio iesire.
    allow_skip: true,
    skip_label: "Nu o am la mine acum",
  },
  optical_product_type: {
    type: "choice",
    title: "Ce anume cauți?",
    legacy_question_keys: ["ce_cauti"],
    options: [
      { key: "new_eyeglasses", label: "Ochelari", service_keys: ["eyeglasses"] },
      { key: "progressive_lenses", label: "Lentile progresive", service_keys: ["progressive_lenses"] },
      { key: "lens_replacement", label: "Schimb lentilele în rama mea", service_keys: ["lens_replacement"] },
      { key: "contact_lenses", label: "Lentile de contact", service_keys: ["contact_lenses"] },
      { key: "not_sure", label: "Nu m-am hotărât încă" },
    ],
  },
  prescription_status: {
    type: "choice",
    // Intrebare noua in catalog. Exista in lista veche ca "reteta", dar raspunsul ei nu
    // ajungea niciodata la motorul de rutare: cheia nu era recunoscuta si se arunca.
    // Este cea mai utila intrebare din fluxul optic - decide daca pacientul are nevoie de
    // o optica, de un cabinet, sau de amandoua.
    title: "Îți știi dioptriile?",
    legacy_question_keys: ["reteta"],
    options: [
      { key: "recent_prescription", label: "Da, am o rețetă recentă" },
      { key: "old_prescription", label: "Am una mai veche" },
      { key: "needs_exam", label: "Nu, am nevoie și de un control", service_keys: ["optometry_consultation"] },
    ],
  },
  contact_lens_experience: {
    type: "choice",
    title: "Ai mai purtat lentile de contact?",
    legacy_question_keys: ["prima_data"],
    options: [
      { key: "first_time", label: "Nu, ar fi prima dată", service_keys: ["contact_lens_consultation", "contact_lens_fitting"] },
      { key: "experienced", label: "Da", service_keys: ["contact_lenses"] },
      { key: "not_sure", label: "Nu sunt sigur" },
    ],
  },
  repair_type: {
    type: "choice",
    // Inainte: "Ce s-a deteriorat?" - dar printre optiuni aparea "Reglaj rama". O ajustare
    // nu e o deteriorare, deci pacientul caruia ii aluneca ochelarii nu se recunostea.
    title: "Ce s-a întâmplat?",
    legacy_question_keys: ["ce_deteriorat"],
    options: [
      { key: "broken_frame", label: "S-a rupt rama", service_keys: ["frame_repair"] },
      { key: "damaged_lens", label: "S-a spart sau s-a zgâriat o lentilă", service_keys: ["lens_replacement"] },
      { key: "hinge_or_screw", label: "Balamaua sau un șurub", service_keys: ["hinge_repair", "screw_replacement"] },
      { key: "frame_adjustment", label: "Nu-mi mai stau bine pe nas", service_keys: ["eyeglasses_adjustment"] },
      { key: "not_sure", label: "Altceva", service_keys: ["eyeglasses_repair"] },
    ],
  },
  symptom_description: {
    type: "text",
    title: "Spune-ne pe scurt ce se întâmplă.",
    legacy_question_keys: ["descriere"],
    helper: "Scrie cu cuvintele tale. Nu trebuie să știi termeni medicali.",
    placeholder: "Ex: de câteva zile văd în ceață la ochiul drept",
  },
  symptom_timing_or_acuity: {
    type: "choice",
    // Cea mai utila intrebare despre un simptom si singura la care orice pacient poate
    // raspunde cu certitudine. Exista deja in catalog, dar niciun pacient n-o vedea:
    // e declarata intr-un flux care cade mereu pe lista veche.
    title: "De când ai problema?",
    options: [
      { key: "sudden", label: "De azi sau de ieri" },
      { key: "recent", label: "De câteva zile" },
      { key: "gradual", label: "De săptămâni sau mai mult" },
      { key: "recurrent", label: "A mai apărut și înainte" },
      { key: "not_sure", label: "Nu-mi dau seama" },
    ],
  },
  locality: {
    type: "location",
    title: "Unde cauți?",
    legacy_question_keys: ["locatie"],
  },
  timing: {
    type: "choice",
    title: "Cât de repede ai nevoie?",
    options: TIMING_OPTIONS,
  },
  safety_targeted_check: {
    type: "choice",
    title: "Ți s-a întâmplat recent una dintre situațiile de mai jos?",
    legacy_question_keys: ["safety_screening"],
    helper: "Întrebăm doar despre situații apărute brusc, în ultimele ore sau zile. Dacă ai o problemă de vedere de mai mult timp (de exemplu nu vezi bine la distanță sau la aproape), alege \"Niciuna dintre acestea\" și continuăm căutarea normal.",
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
