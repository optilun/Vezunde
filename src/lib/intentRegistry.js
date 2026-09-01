// Registru declarativ de intente pentru colectarea ghidata de informatii pentru orientare.
// Detectia locala si raspunsurile ghidate raman sursa de adevar. Interpretarea AI
// ruleaza controlat pentru evaluare si nu poate decide singura eligibilitatea sau ordinea.

// 2026-09-01 (rescrierea chestionarului): formularile si cheile de serviciu de aici sunt
// aliniate cu shared/patientGuidanceQuestionCatalog.js. Inainte, cele doua liste nu erau
// de acord: acelasi clic al pacientului producea servicii diferite - deci potriviri
// diferite - dupa cum apuca sa raspunda la lista noua sau la aceasta. Cat timp exista
// amandoua, orice modificare intr-una trebuie facuta si in cealalta.
// "saptamana_aceasta" ramane definita dar `hidden` - vezi explicatia din
// shared/patientGuidanceQuestionCatalog.js. Nu se afiseaza, dar ramane valida.
export const TIMING_OPTIONS = [
  { key: "cat_mai_repede", label: "Cât mai repede" },
  { key: "zilele_urmatoare", label: "În următoarele zile" },
  { key: "saptamana_aceasta", label: "Săptămâna aceasta", hidden: true },
  { key: "nu_e_urgent", label: "Nu e urgent" },
];

const LOCATION_QUESTION = { key: "locatie", type: "location", title: "Unde cauți?" };
const TIMING_QUESTION = { key: "timing", type: "choice", title: "Cât de repede ai nevoie?", options: TIMING_OPTIONS };

export const INTENTS = {
  control_vedere: {
    label: "Control de vedere",
    service_keys: ["control_vedere_adulti"],
    questions: [
      {
        key: "pentru_cine", type: "choice", title: "Pentru cine este?",
        options: [
          { key: "adult", label: "Pentru mine" },
          { key: "copil", label: "Pentru copilul meu", next_intent: "control_copil" },
          // Cheia e identica cu cea din catalog, ca sa nu fie nevoie de alias de valoare.
          { key: "other_adult", label: "Pentru altcineva (părinte, partener)" },
        ],
      },
      {
        // Inlocuieste "Cand ai facut ultimul control?", al carei raspuns nu ajungea
        // niciodata la motorul de rutare. Aceasta spune mai mult: consult, cumparare, sau
        // amandoua. Aceleasi optiuni ca prescription_status din catalog.
        key: "reteta", type: "choice", title: "Îți știi dioptriile?",
        options: [
          { key: "recent_prescription", label: "Da, am o rețetă recentă" },
          { key: "old_prescription", label: "Am una mai veche" },
          { key: "needs_exam", label: "Nu, am nevoie și de un control", service_keys: ["optometry_consultation"] },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  control_copil: {
    label: "Control pentru copil",
    // Module 3E: child vision checks route to a neutral pediatric review flow —
    // never inferred as specialized myopia management availability.
    service_keys: ["control_vedere_copii"],
    questions: [
      {
        key: "varsta_copil", type: "choice", title: "Ce vârstă are copilul?",
        options: [
          { key: "sub_3_ani", label: "Sub 3 ani" },
          { key: "3_6_ani", label: "3–6 ani" },
          { key: "7_12_ani", label: "7–14 ani" },
          { key: "13_18_ani", label: "15–18 ani" },
        ],
      },
      {
        key: "primul_control", type: "choice", title: "A mai fost la un control de vedere?",
        options: [
          { key: "nu", label: "Nu, ar fi primul" },
          { key: "da", label: "Da, a mai fost" },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  ochelari_lentile: {
    label: "Ochelari sau lentile",
    service_keys: ["montaj_lentile"],
    questions: [
      {
        // Titlul era "Ce cauti?" - fara niciun context, imediat dupa ce pacientul tocmai
        // spusese ce cauta. Cheile de serviciu sunt acum aceleasi ca in catalog: inainte,
        // majoritatea optiunilor nu aveau niciuna si mosteneau serviciul generic al intentiei.
        key: "ce_cauti", type: "choice", title: "Ce anume cauți?",
        options: [
          { key: "ochelari_noi", label: "Ochelari", service_keys: ["eyeglasses"] },
          { key: "lentile_progresive", label: "Lentile progresive", service_keys: ["progressive_lenses"] },
          { key: "schimbare_lentile", label: "Schimb lentilele în rama mea", service_keys: ["lens_replacement"] },
          { key: "lentile_contact", label: "Lentile de contact", next_intent: "lentile_contact" },
          { key: "nu_sunt_sigur", label: "Nu m-am hotărât încă" },
        ],
      },
      {
        key: "reteta", type: "choice", title: "Îți știi dioptriile?",
        options: [
          { key: "recent_prescription", label: "Da, am o rețetă recentă" },
          { key: "old_prescription", label: "Am una mai veche" },
          { key: "needs_exam", label: "Nu, am nevoie și de un control", service_keys: ["optometry_consultation"] },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  lentile_contact: {
    label: "Lentile de contact",
    service_keys: ["lentile_contact"],
    questions: [
      {
        // ATENTIE la cheile de aici: intrebarea a fost inversata ("Ai mai purtat?" in loc
        // de "Este prima data?"), dar cheile raman "da" = prima data si "nu" = are
        // experienta, pentru ca sunt mapate ca atare in LEGACY_ANSWER_VALUE_ALIASES si
        // exista raspunsuri deja salvate cu ele. Nu redenumi cheile fara sa schimbi si
        // aliasurile din matchProvidersSemantic/entry.ts.
        key: "prima_data", type: "choice", title: "Ai mai purtat lentile de contact?",
        options: [
          { key: "da", label: "Nu, ar fi prima dată", service_keys: ["contact_lens_consultation", "contact_lens_fitting"] },
          { key: "nu", label: "Da", service_keys: ["contact_lenses"] },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  reparatii_ochelari: {
    label: "Reparatii sau reglaje",
    service_keys: ["reparatii_ochelari", "reglaj_rame"],
    notice: "Un specialist poate evalua daca reparatia este posibila. VIASEE nu poate garanta reparatia doar pe baza informatiilor oferite.",
    questions: [
      {
        // "Ce s-a deteriorat?" avea printre optiuni "Reglaj rama" - o ajustare nu e o
        // deteriorare, deci cine avea doar ochelarii alunecosi nu se recunostea in intrebare.
        // Cheile de serviciu sunt acum aceleasi ca in catalog (repair_type).
        key: "ce_deteriorat", type: "choice", title: "Ce s-a întâmplat?",
        options: [
          { key: "rama_rupta", label: "S-a rupt rama", service_keys: ["frame_repair"], replace_service_keys: true },
          { key: "lentila_zgariata", label: "S-a spart sau s-a zgâriat o lentilă", service_keys: ["lens_replacement"], replace_service_keys: true },
          { key: "balama_surub", label: "Balamaua sau un șurub", service_keys: ["hinge_repair", "screw_replacement"], replace_service_keys: true },
          { key: "reglaj_rama", label: "Nu-mi mai stau bine pe nas", service_keys: ["eyeglasses_adjustment"], replace_service_keys: true },
          { key: "nu_stiu", label: "Altceva", service_keys: ["eyeglasses_repair"], replace_service_keys: true },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  simptome_oftalmologice: {
    label: "O problema la ochi",
    service_keys: ["consult_oftalmologic"],
    notice: "VIASEE nu ofera diagnostic medical. Te ajutam sa gasesti unde poti merge pentru evaluare.",
    questions: [
      {
        key: "descriere", type: "text", title: "Spune-ne pe scurt ce se întâmplă.",
        placeholder: "Ex: de câteva zile văd în ceață la ochiul drept",
      },
      {
        // Cheia e exact cea din catalog, ca sa fie recunoscuta server-side fara alias.
        // Este cea mai utila intrebare despre un simptom si singura la care orice pacient
        // poate raspunde sigur. Exista in catalog, dar niciun pacient n-o vedea, pentru ca
        // fluxul de simptome cade mereu pe lista asta veche.
        key: "symptom_timing_or_acuity", type: "choice", title: "De când ai problema?",
        options: [
          { key: "sudden", label: "De azi sau de ieri" },
          { key: "recent", label: "De câteva zile" },
          { key: "gradual", label: "De săptămâni sau mai mult" },
          { key: "recurrent", label: "A mai apărut și înainte" },
          { key: "not_sure", label: "Nu-mi dau seama" },
        ],
      },
      {
        key: "pentru_cine", type: "choice", title: "Pentru cine este?",
        options: [
          { key: "adult", label: "Pentru mine" },
          { key: "copil", label: "Pentru copilul meu" },
          { key: "other_adult", label: "Pentru altcineva (părinte, partener)" },
        ],
      },
      // Adaugat 2026-08-06, la cererea explicita a lui Alex: cine merge la medic pentru
      // o problema are adesea deja o recomandare de investigatie de la alt medic (familie,
      // urgenta). Optiunea "Nu am o recomandare" evita frictiune pentru restul pacientilor.
      {
        key: "investigatie_recomandata", type: "choice", title: "Ai primit o trimitere pentru o investigație?",
        options: [
          { key: "nu_am", label: "Nu", service_keys: [] },
          { key: "oct", label: "Da — OCT", service_keys: ["oct"] },
          { key: "visual_field_analyzer", label: "Da — Câmp vizual", service_keys: ["visual_field_analyzer"] },
          { key: "tonometry", label: "Da — Tonometrie", service_keys: ["tonometry"] },
          { key: "fundus_exam", label: "Da — Fund de ochi", service_keys: ["fundus_exam"] },
          { key: "corneal_topography", label: "Da — Topografie corneană", service_keys: ["corneal_topography"] },
          { key: "nu_stiu", label: "Da, dar nu înțeleg ce scrie pe ea", service_keys: ["consult_oftalmologic"] },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  investigatii: {
    label: "Trimitere de la medic",
    service_keys: [],
    questions: [
      {
        // Inainte: "Ce investigatie cauti?" - ii cerea pacientului sa aleaga singur intre
        // OCT, camp vizual si tonometrie, imposibil fara o hartie de la medic. Acum premisa
        // e explicita: intrebam ce scrie pe trimitere. Cheile de serviciu sunt canonice,
        // nu aliasuri romanesti, ca sa fie identice cu cele din catalog.
        key: "investigatie", type: "choice", title: "Ce scrie pe trimiterea ta?",
        options: [
          { key: "oct", label: "OCT", service_keys: ["oct"] },
          { key: "camp_vizual", label: "Câmp vizual", service_keys: ["visual_field_analyzer"] },
          { key: "tonometrie", label: "Tonometrie", service_keys: ["tonometry"] },
          { key: "fund_de_ochi", label: "Fund de ochi", service_keys: ["fundus_exam"] },
          { key: "topografie_corneana", label: "Topografie corneană", service_keys: ["corneal_topography"] },
          { key: "nu_sunt_sigur", label: "Nu o am la mine sau nu înțeleg ce scrie", service_keys: ["consult_oftalmologic"] },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  unknown: {
    label: "Nu sunt sigur",
    service_keys: ["consult_oftalmologic", "control_vedere_adulti"],
    questions: [
      {
        key: "descriere", type: "text", title: "Spune-ne cu ce te putem ajuta.",
        placeholder: "Scrie în cuvintele tale, ca într-o conversație",
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },
};

export const CATEGORY_QUESTION = {
  key: "categorie",
  type: "choice",
  title: "Cu ce te ajutăm?",
  options: [
    // "Investigatii" devine "Am o trimitere de la medic": nimeni nu cauta un OCT fara
    // sa i-l fi cerut cineva. Iar "Nu sunt sigur" promite ajutor, nu doar inregistreaza
    // nesiguranta - inainte era ramura cu cele mai putine intrebari, desi e pacientul care
    // are cea mai mare nevoie de ghidare.
    { key: "control_vedere", label: "Vreau un control — nu văd bine sau a trecut mult timp" },
    { key: "simptome_oftalmologice", label: "Am o problemă apărută recent" },
    { key: "ochelari_lentile", label: "Ochelari sau lentile de contact" },
    { key: "reparatii_ochelari", label: "Îmi repar ochelarii" },
    { key: "investigatii", label: "Am o trimitere de la medic" },
    { key: "unknown", label: "Nu sunt sigur — ajută-mă să aleg" },
  ],
};

// Parametrii vechi din linkurile existente (?categorie=...) -> intente noi
export const LEGACY_CATEGORY_TO_INTENT = {
  control_vedere: "control_vedere",
  copii_miopie: "control_copil",
  reparatii: "reparatii_ochelari",
  consult_oftalmologic: "simptome_oftalmologice",
  lentile_ochelari: "ochelari_lentile",
  ochi_uscat: "simptome_oftalmologice",
};

// Detectie deterministica de intentie pe baza de cuvinte cheie, fara AI.
// Se foloseste doar pentru a sari peste categorie atunci cand potrivirea e clara.
const INTENT_KEYWORDS = {
  control_copil: [
    "consultatie copil",
    "consultatie copii",
    "control copil",
    "control copii",
    "vedere copil",
    "copil nu vede",
    "nu vede tabla",
    "copilul nu vede",
    "control pentru copil",
    "control pentru copii",
    "consult pediatric",
    "consultatie pediatrica",
    "control oftalmologic copil",
    "control de vedere copil",
    "verificare vedere copil",
    "copil are probleme cu vederea",
    "copilul vede neclar",
    // 2026-09-01: formulari uzuale care nu erau prinse deloc.
    "copilul mijeste ochii",
    "copilul sta aproape de televizor",
    "copilul se plange ochii",
    "strabism copil",
    "copilul are ochelari",
  ],
  control_vedere: [
    "consultatie vedere",
    "control vedere",
    "vad neclar",
    "nu vad bine",
    "dioptrii",
    "verificare vedere",
    // 2026-09-01: cele mai frecvente moduri in care un pacient descrie o problema
    // refractiva obisnuita. Fara ele, textul cadea in categoria generica.
    "nu vad distanta",
    "nu vad aproape",
    "vedere incetosata",
    // ATENTIE: nu adauga aici "am nevoie de ochelari". normalize() sterge secventa
    // "am nevoie de", deci cheia s-ar reduce la cuvantul "ochelari" si ar captura orice
    // text care contine "ochelari" - inclusiv reparatiile si ochelarii de soare.
    "cred ca am nevoie de ochelari",
    "miopie",
    "hipermetropie",
    "astigmatism",
    "prezbiopie",
    "mi-au crescut dioptriile",
  ],
  reparatii_ochelari: [
    "ochelari rupti",
    "rama rupta",
    "balama",
    "surub",
    "reparatie ochelari",
    "reglaj rama",
    "mi s-au rupt ochelarii",
    // 2026-09-01: "ochelarii mei s-au rupt" nu se potrivea cu niciuna din cheile de mai sus.
    "s-au rupt ochelarii",
    "ochelarii s-au rupt",
    "ochelari sparti",
    "s-a rupt rama",
    "s-a rupt bratul",
    "lentila sparta",
    "am spart lentila",
    "am spart ochelarii",
    "ochelari stricati",
    "reparat ochelari",
  ],
  ochelari_lentile: [
    "lentile progresive",
    "ochelari noi",
    "schimbare lentile",
    "rame noi",
    "lentile pentru ochelari",
    "ochelari de soare",
    "ochelari soare",
    "rama noua",
  ],
  lentile_contact: [
    "lentile de contact",
    "adaptare lentile",
    "port lentile",
  ],
  investigatii: [
    "oct",
    "camp vizual",
    "tonometrie",
    "fund de ochi",
    "topografie corneana",
  ],
  simptome_oftalmologice: [
    "oftalmolog",
    "durere la ochi",
    "ochi rosu",
    "vedere dubla",
    "ma doare ochiul",
    "problema la ochi",
    // 2026-09-01: simptome descrise curent in romana, care inainte nu erau detectate deloc
    // si trimiteau pacientul la intrebarea generica "Cu ce te putem ajuta?".
    "ochiul rosu",
    "imi curge ochiul",
    "curge ochiul",
    "ma mananca ochii",
    "mancarime ochi",
    "conjunctivita",
    "vad puncte",
    "puncte negre",
    "musculite",
    "imi lacrimeaza",
    "lacrimeaza ochiul",
    "usturime ochi",
    "ma ustura ochii",
    "ochi uscat",
    "pleoapa umflata",
    "urcior",
    "vad in ceata",
    "sensibil la lumina",
    "vreau la medic de ochi",
    "doctor de ochi",
    "medic oftalmolog",
  ],
};

// Cuvinte de legatura ignorate la normalizare, ca sa nu influenteze potrivirea.
const CONNECTOR_WORDS = ["pentru", "la", "un", "o", "vreau"];

function normalize(text) {
  let t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  t = t.replace(/\bam nevoie de\b/g, " ");
  const words = t.split(/\s+/).filter((w) => w && !CONNECTOR_WORDS.includes(w));
  return words.join(" ").trim();
}

function escapeForRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 2026-09-01: inainte se folosea `normalized.includes(...)`, o cautare bruta de subsir,
// cu doua consecinte gresite:
//
// 1. Chei scurte se potriveau in interiorul altor cuvinte. Cheia "oct" (investigatia OCT)
//    se potrivea in "d-oct-or" si in "-oct-ombrie", asa ca "vreau la un doctor de ochi"
//    era rutat spre "Ce investigatie cauti?" - exact intrebarea la care pacientul nu are
//    ce raspunde.
// 2. Cheile din mai multe cuvinte cereau text lipit. "copilul meu nu vede bine la tabla"
//    nu se potrivea cu cheia "nu vede tabla", desi e exact acelasi lucru spus natural,
//    deci intreaga ramura pentru copii ramanea nedetectata.
//
// Acum fiecare cuvant din cheie trebuie gasit ca CUVANT INTREG si in ordine, dar cu
// cuvinte permise intre ele. E o potrivire mai iertatoare, potrivita pentru o prima
// ipoteza pe care pacientul o confirma oricum in pasul urmator.
function keywordMatches(normalizedText, keyword) {
  const words = normalize(keyword).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  let cursor = 0;
  for (const word of words) {
    const rest = normalizedText.slice(cursor);
    const offset = rest.search(new RegExp(`\\b${escapeForRegExp(word)}\\b`));
    if (offset === -1) return false;
    cursor += offset + word.length;
  }
  return true;
}

export function detectIntentFromText(text) {
  if (!text) return null;
  const normalized = normalize(text);
  for (const [intentKey, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => keywordMatches(normalized, kw))) {
      return intentKey;
    }
  }
  return null;
}

// Prefill deterministic pentru sub-alegeri clar identificate in text,
// pentru a nu mai intreba o data o optiune deja exprimata explicit.
const SUB_INTENT_PREFILL = {
  ochelari_lentile: [
    { question_key: "ce_cauti", option_key: "lentile_progresive", keywords: ["lentile progresive"] },
  ],
  investigatii: [
    { question_key: "investigatie", option_key: "oct", keywords: ["oct"] },
  ],
};

export function detectSubIntentPrefill(intentKey, text) {
  if (!intentKey || !text) return null;
  const rules = SUB_INTENT_PREFILL[intentKey];
  if (!rules) return null;
  const normalized = normalize(text);
  for (const rule of rules) {
    // Aceeasi potrivire pe cuvant intreg ca in detectIntentFromText: altfel prefill-ul
    // "oct" se declansa din "doctor" si sarea peste intrebarea despre investigatie.
    if (rule.keywords.some((kw) => keywordMatches(normalized, kw))) {
      return { question_key: rule.question_key, option_key: rule.option_key };
    }
  }
  return null;
}
