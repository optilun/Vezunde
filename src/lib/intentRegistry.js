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
          // 2026-09-01: aceleasi service_keys ca optiunea `child` din catalogul aprobat.
          // Chestionarul acesta e traseul de rezerva, folosit cand selectia de intrebari
          // esueaza; fara cheie, lead-ul livrat furnizorului ramanea fara semnalul
          // pediatric, desi cautarea il deriva server-side din raspunsuri.
          { key: "copil", label: "Pentru copilul meu", next_intent: "control_copil", service_keys: ["children_eye_exam"] },
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
          // Vezi comentariul de la control_vedere: acelasi semnal pediatric, pe traseul
          // de rezerva. Aici nu exista next_intent, deci cheia se aduna direct.
          { key: "copil", label: "Pentru copilul meu", service_keys: ["children_eye_exam"] },
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
//
// 2026-09-24, audit LLM cautare/recomandare. Detectia de aici are doua roluri: e ipoteza
// trimisa modelului (`deterministic_intent`) si e singura detectie cand modelul nu raspunde.
// Masurata pe un corpus de 68 de formulari, versiunea veche recunostea 29 (43%): prima
// intentie potrivita castiga in ordinea obiectului, deci "ma dor ochii si nu vad bine" si
// "m-am lovit la ochi si nu mai vad bine" ajungeau la control de rutina, iar "lentile de
// contact, port ochelari" la ochelari. Niciuna dintre urgentele din corpus nu primea intentie.
//
// Acum grupurile de semnale sunt evaluate in ordinea de precedenta (aceeasi ca in promptul
// LLM): simptomul acut bate orice, investigatia numita bate produsele, reparatia bate
// ochelarii noi, lentilele de contact bat ochelarii, copilul bate controlul de adult.
// Grupurile "slabe" (cuvantul "ochelari" singur, "oftalmolog" singur) se folosesc numai
// cand nu s-a potrivit nimic altceva. Rezultatul ramane o ipoteza: pacientul o confirma.
const INTENT_SIGNAL_GROUPS = [
  {
    intent: "simptome_oftalmologice",
    strength: "acute",
    phrases: [
      "durere la ochi", "durere de ochi", "dureri la ochi", "durere oculara", "ma doare ochiul",
      "ma dor ochii", "ma doare un ochi", "ma doare in ochi", "ochiul ma doare", "ochii ma dor",
      "ochi dureros", "ochiul dureros",
      "ochi rosu", "ochiul rosu", "ochii rosii", "ochi rosii", "ochiul e rosu", "ochii sunt rosii",
      "roseata la ochi", "ochi iritat", "ochii iritati", "iritatie la ochi", "ochi injectat",
      "vas de sange", "sange in ochi", "ochi umflat", "ochiul umflat", "ochii umflati",
      "imi curge ochiul", "curge ochiul", "ii curge", "secretii", "ochi lipit",
      "ma mananca ochii", "ma mananca ochiul", "mancarime ochi", "mancarimi la ochi",
      "imi lacrimeaza", "ii lacrimeaza", "lacrimeaza ochiul", "lacrimeaza ochii",
      "conjunctivita", "alergie la ochi",
      "usturime", "ma ustura", "ma ard ochii", "ma usuca ochii", "ochi uscat", "ochi uscati",
      "ochii uscati", "uscaciune", "nisip in ochi", "ma inteapa ochii",
      "pleoapa umflata", "pleoapele umflate", "pleoapa rosie", "s a umflat pleoapa",
      "urcior", "ulcior", "orjelet", "salazion", "bubita pe pleoapa", "umflatura la pleoapa",
      "vad puncte", "puncte negre", "pete negre", "musculite", "muste zburatoare",
      "corpi flotanti", "vad fulgere", "fulgerari", "vad dublu", "vedere dubla",
      "perdea", "umbra peste vedere", "pata in ochi", "pata pe ochi", "vad o pata",
      "sensibil la lumina", "sensibilitate la lumina", "ma supara lumina", "ma deranjeaza lumina",
      "lovit la ochi", "lovitura la ochi", "lovitura in ochi", "intrat ceva in ochi",
      "intrat in ochi", "sarit in ochi", "corp strain", "aschie", "chimic", "chimicale",
      "inalbitor", "var in ochi", "clor in ochi", "detergent in ochi", "spray in ochi",
      "nu mai vad deloc", "nu mai vad nimic", "nu mai vad cu", "am pierdut vederea",
      "vederea a disparut", "s a intunecat vederea",
      "dupa operatie", "dupa operatia", "dupa injectie", "dupa injectia",
      "inflamatie la ochi", "ceva in ochi",
    ],
  },
  {
    intent: "investigatii",
    phrases: [
      "oct", "tomografie", "camp vizual", "campul vizual", "perimetrie", "tonometrie",
      "tensiunea oculara", "tensiune oculara", "presiunea oculara", "presiune oculara",
      "fund de ochi", "fundul de ochi", "topografie corneana", "topografie", "biometrie",
      "angiografie", "angiofluorografie", "pahimetrie", "investigatie", "investigatii",
      "trimitere",
    ],
  },
  {
    intent: "reparatii_ochelari",
    phrases: [
      "ochelari rupti", "rama rupta", "rame rupte", "s a rupt rama", "rupt rama",
      "s au rupt ochelarii", "ochelarii s au rupt", "rupt ochelarii", "rupt bratul",
      "brat rupt", "bratul rupt", "s a rupt bratul", "balama", "balamaua", "surub", "surubul",
      "reparatie ochelari", "reparatii ochelari", "reparat ochelari", "repar ochelarii",
      "reglaj rama", "reglaj ochelari", "reglez ochelarii", "aluneca", "nu stau bine pe nas",
      "plachete", "ochelari sparti", "am spart ochelarii", "am spart lentila", "lentila sparta",
      "lentila zgariata", "lentile zgariate", "zgariat lentila", "zgariat lentilele",
      "sarit lentila", "cazut lentila", "ochelari stricati", "ochelarii stricati",
      "s au stricat", "stricat ochelarii", "calcat pe ochelari",
    ],
  },
  {
    intent: "lentile_contact",
    phrases: [
      "lentile de contact", "lentile contact", "lentila de contact", "lentilele de contact",
      "lentile colorate", "lentile lunare", "lentile zilnice", "lentile de unica folosinta",
      "adaptare lentile", "lentile moi", "lentile rigide", "ortokeratologie", "lentile de noapte",
    ],
  },
  {
    intent: "simptome_oftalmologice",
    strength: "condition",
    phrases: [
      "cataracta", "glaucom", "keratocon", "keratoconus", "degenerescenta maculara", "dmla",
      "retinopatie", "dezlipire de retina", "retina", "macula",
    ],
  },
  {
    intent: "control_copil",
    child: true,
    phrases: [
      "copil", "copilul", "copilului", "copii", "copiii", "fiul meu", "fiica mea", "fetita",
      "fetitei", "baietelul", "baietel", "baiatul meu", "bebelus", "bebelusul", "nepotul meu",
      "nepoata mea", "elev", "eleva", "gradinita", "clasa pregatitoare", "nu vede tabla",
      "strabism", "ochi lenes", "ambliopie", "mijeste",
    ],
  },
  {
    intent: "ochelari_lentile",
    phrases: [
      "ochelari noi", "ochelari de vedere", "ochelari cu dioptrii", "ochelari de citit",
      "ochelari citit", "ochelari de calculator", "ochelari calculator", "lumina albastra",
      "ochelari de soare", "ochelari soare", "ochelari heliomati", "lentile heliomate",
      "lentile fotocromatice", "lentile progresive", "progresive", "lentile ochelari",
      "lentile noi", "schimb lentilele", "schimbare lentile", "schimbarea lentilelor",
      "rame noi", "rama noua", "rame de ochelari", "am reteta", "reteta de ochelari",
      "fac ochelari", "fac niste ochelari", "cumpar ochelari",
    ],
  },
  {
    intent: "control_vedere",
    phrases: [
      "control vedere", "control de vedere", "control ochi", "control de ochi", "control oftalmologic",
      "control de rutina", "control anual", "control periodic", "consultatie vedere",
      "consult oftalmologic", "consultatie oftalmologica", "consult oftalmolog",
      "consultatie oftalmolog", "verificare vedere", "verific vederea", "verifica vederea",
      "verific ochii", "vad neclar", "nu vad bine", "nu mai vad bine", "nu vede bine",
      "nu mai vede bine", "vede neclar", "vede incetosat", "nu vad distanta",
      "nu vad aproape", "nu vad departe", "vad incetosat", "vad in ceata", "vedere incetosata",
      "incetoseaza vederea", "a scazut vederea", "scade vederea", "dioptrii", "dioptriile",
      "miopie", "miop", "miopa", "hipermetropie", "astigmatism", "prezbiopie", "presbiopie",
      "cred ca ochelari", "permis de conducere", "permisul de conducere", "permis auto",
      "permisul auto", "fisa medicala", "adeverinta",
      // "control" singur ("vreau un control la un doctor"): in contextul VIASEE inseamna un
      // control al ochilor. Sta ultimul in grup, dupa nevoile precise de mai sus.
      "control",
    ],
  },
  {
    intent: "ochelari_lentile",
    strength: "weak",
    phrases: ["ochelari", "ochelarii", "rame", "rama"],
  },
  {
    intent: "simptome_oftalmologice",
    strength: "weak",
    phrases: [
      "oftalmolog", "medic oftalmolog", "doctor de ochi", "doctor ochi", "medic de ochi",
      "medic ochi", "vreau la medic",
      // Formulari vagi: indica o problema medicala, dar nu una anume. Stau la coada ca sa nu
      // acopere o nevoie precisa spusa in aceeasi propozitie.
      "problema la ochi", "probleme la ochi", "problema cu ochii", "probleme cu ochii",
      "ceva la ochi",
    ],
  },
];

// Cuvinte de legatura ignorate la normalizare, ca sa nu influenteze potrivirea.
const CONNECTOR_WORDS = ["pentru", "la", "un", "o", "vreau"];

// Cate cuvinte pot sta intre doua cuvinte consecutive ale unei chei. Inainte nu exista nicio
// limita, deci "lentile de contact, port ochelari" se potrivea cu cheia "lentile (pentru)
// ochelari" peste trei cuvinte. Doua cuvinte acopera formularile naturale ("nu vede bine la
// tabla" -> "nu vede tabla") fara potriviri intamplatoare in propozitii lungi.
const MAX_WORD_GAP = 2;

function normalize(text) {
  let t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
  t = t.replace(/\bam nevoie de\b/g, " ");
  const words = t.split(/\s+/).filter((w) => w && !CONNECTOR_WORDS.includes(w));
  return words.join(" ").trim();
}

// Fiecare cuvant din cheie trebuie gasit ca CUVANT INTREG si in ordine, cu cel mult
// MAX_WORD_GAP cuvinte intre doua cuvinte consecutive. Asa "oct" nu se potriveste in
// "doctor" sau "octombrie", iar "nu vede tabla" se potriveste cu "nu vede bine la tabla".
function keywordMatches(normalizedText, keyword) {
  const phraseWords = normalize(keyword).split(" ").filter(Boolean);
  const words = normalizedText.split(" ").filter(Boolean);
  if (phraseWords.length === 0 || words.length === 0) return false;
  for (let start = 0; start < words.length; start += 1) {
    if (words[start] !== phraseWords[0]) continue;
    let position = start;
    let matched = 1;
    while (matched < phraseWords.length) {
      const limit = Math.min(words.length - 1, position + 1 + MAX_WORD_GAP);
      let found = -1;
      for (let next = position + 1; next <= limit; next += 1) {
        if (words[next] === phraseWords[matched]) {
          found = next;
          break;
        }
      }
      if (found === -1) break;
      position = found;
      matched += 1;
    }
    if (matched === phraseWords.length) return true;
  }
  return false;
}

function matchesAny(normalizedText, phrases) {
  return phrases.some((phrase) => keywordMatches(normalizedText, phrase));
}

// Varsta mentionata explicit ("de 5 ani", "are 16 ani", "3 luni"), in ani. Luni si
// saptamani inseamna sub un an.
function mentionedAgeYears(normalizedText) {
  const months = normalizedText.match(/\b(\d{1,2}) (?:de )?(?:luni|saptamani)\b/);
  if (months) return 0;
  const years = normalizedText.match(/\b(\d{1,2}) (?:de )?ani\b/);
  return years ? Number(years[1]) : null;
}

export function detectIntentFromText(text) {
  if (!text) return null;
  const normalized = normalize(text);
  if (!normalized) return null;
  const age = mentionedAgeYears(normalized);
  for (const group of INTENT_SIGNAL_GROUPS) {
    // "fiul meu de 25 de ani" nu e un control pediatric.
    if (group.child && age !== null && age >= 18) continue;
    if (matchesAny(normalized, group.phrases)) return group.intent;
  }
  return null;
}

// Prefill deterministic pentru sub-alegeri clar identificate in text, ca sa nu intrebam din
// nou ceva deja spus explicit. Raspunsurile precompletate apar pe ecranul de verificare, unde
// pacientul le poate modifica. Se pun doar formulari neechivoce.
const SUB_INTENT_PREFILL = {
  ochelari_lentile: [
    { question_key: "ce_cauti", option_key: "lentile_progresive", keywords: ["lentile progresive", "progresive"] },
    { question_key: "ce_cauti", option_key: "schimbare_lentile", keywords: ["schimb lentilele", "schimbare lentile", "schimbarea lentilelor", "lentile noi in rama"] },
    { question_key: "ce_cauti", option_key: "ochelari_noi", keywords: ["ochelari noi", "ochelari de vedere", "ochelari de citit", "ochelari de calculator", "ochelari cu dioptrii", "ochelari de soare cu dioptrii"] },
  ],
  reparatii_ochelari: [
    { question_key: "ce_deteriorat", option_key: "rama_rupta", keywords: ["rama rupta", "rame rupte", "s a rupt rama", "rupt rama", "rupt bratul", "brat rupt", "bratul rupt", "ochelari rupti", "s au rupt ochelarii", "ochelarii s au rupt"] },
    { question_key: "ce_deteriorat", option_key: "balama_surub", keywords: ["balama", "balamaua", "surub", "surubul"] },
    // O lentila cazuta din rama nu e neaparat deteriorata: pacientul alege singur.
    { question_key: "ce_deteriorat", option_key: "lentila_zgariata", keywords: ["lentila sparta", "lentila zgariata", "lentile zgariate", "am spart lentila"] },
    { question_key: "ce_deteriorat", option_key: "reglaj_rama", keywords: ["aluneca", "nu stau bine pe nas", "reglaj rama", "reglaj ochelari"] },
  ],
  lentile_contact: [
    // Cheile sunt inversate istoric: "da" = prima data, "nu" = are experienta.
    { question_key: "prima_data", option_key: "da", keywords: ["prima data", "prima oara", "prima pereche", "sa incerc", "nu am mai purtat", "nu am purtat niciodata"] },
    { question_key: "prima_data", option_key: "nu", keywords: ["port lentile de contact", "port lentile contact", "am mai purtat", "am purtat lentile", "lentilele mele"] },
  ],
  investigatii: [
    { question_key: "investigatie", option_key: "oct", keywords: ["oct", "tomografie"] },
    { question_key: "investigatie", option_key: "camp_vizual", keywords: ["camp vizual", "campul vizual", "perimetrie"] },
    { question_key: "investigatie", option_key: "tonometrie", keywords: ["tonometrie", "tensiunea oculara", "tensiune oculara", "presiunea oculara", "presiune oculara"] },
    { question_key: "investigatie", option_key: "fund_de_ochi", keywords: ["fund de ochi", "fundul de ochi"] },
    { question_key: "investigatie", option_key: "topografie_corneana", keywords: ["topografie corneana", "topografie"] },
  ],
};

export function detectSubIntentPrefill(intentKey, text) {
  if (!intentKey || !text) return null;
  const rules = SUB_INTENT_PREFILL[intentKey];
  if (!rules) return null;
  const normalized = normalize(text);
  for (const rule of rules) {
    if (matchesAny(normalized, rule.keywords)) {
      return { question_key: rule.question_key, option_key: rule.option_key };
    }
  }
  return null;
}

// --- Sugestii din mesajul pacientului -----------------------------------------------------
//
// 2026-09-24. Pacientul scrie des, din prima, pentru cine cauta, varsta copilului, cat de
// repede are nevoie si orasul - si era apoi intrebat din nou despre toate. Aceste indicii NU
// sunt raspunsuri: ele doar marcheaza varianta probabila ("Sugestie"), iar pacientul o alege
// el insusi. Asa faptele confirmate raman exclusiv raspunsuri controlate, cum cere politica.
// Intrebarea de siguranta nu primeste niciodata sugestie.

const OTHER_ADULT_PHRASES = [
  "mama mea", "mamei mele", "mama", "tatal meu", "tatalui meu", "tata", "tatal", "sotul meu",
  "sotul", "sotia mea", "sotia", "bunica", "bunicul", "bunicii", "parintii mei", "parintele meu",
  "soacra", "socrul", "fratele meu", "sora mea",
];

const TIMING_HINTS = [
  { value: "cat_mai_repede", phrases: ["urgent", "de urgenta", "cat mai repede", "cat mai curand", "cat de repede", "imediat", "chiar azi", "astazi", "azi daca se poate", "maine"] },
  // "de cateva zile" descrie de cand exista problema, nu cand vrea pacientul programarea.
  { value: "zilele_urmatoare", phrases: ["zilele urmatoare", "urmatoarele zile", "in cateva zile", "peste cateva zile", "saptamana asta", "saptamana aceasta", "saptamana viitoare"] },
  { value: "nu_e_urgent", phrases: ["nu e urgent", "nu este urgent", "nu ma grabesc", "nu ma grabeste", "fara graba", "cand se poate", "luna viitoare"] },
];

const SYMPTOM_ONSET_HINTS = [
  { value: "recurrent", phrases: ["din nou", "iar am", "a mai aparut", "mai am din cand in cand", "recurent", "de fiecare data"] },
  { value: "sudden", phrases: ["de azi", "de astazi", "de ieri", "de aseara", "de azi noapte", "de dimineata", "brusc", "dintr o data", "deodata", "de o ora", "de cateva ore", "de doua ore"] },
  { value: "recent", phrases: ["de doua zile", "de 2 zile", "de trei zile", "de 3 zile", "de cateva zile", "de patru zile", "de o saptamana", "de 1 saptamana"] },
  // Fara "de ani" sau "de luni" simple: s-ar potrivi cu varsta ("mama mea de 70 de ani").
  { value: "gradual", phrases: ["de cateva saptamani", "de saptamani bune", "de cateva luni", "de luni de zile", "de cativa ani", "de ani de zile", "de mai multi ani", "de un an", "de mult timp", "treptat", "de la an la an"] },
];

const PRESCRIPTION_HINTS = [
  { value: "needs_exam", phrases: ["nu am reteta", "nu stiu dioptriile", "nu imi stiu dioptriile", "fara reteta", "sa imi masor dioptriile", "masor dioptriile"] },
  { value: "recent_prescription", phrases: ["am reteta", "am o reteta", "reteta de la medic", "reteta noua", "am prescriptie"] },
];

const FIRST_EXAM_HINTS = [
  // Legacy `primul_control`: "nu" = ar fi primul control, "da" = a mai fost.
  { value: "nu", phrases: ["primul control", "prima data la control", "nu a mai fost la control", "nu a fost niciodata"] },
  { value: "da", phrases: ["a mai fost la control", "a mai fost la oftalmolog", "are deja ochelari", "poarta ochelari"] },
];

// Resedintele de judet si cateva orase mari. Doar precompletam campul de cautare; pacientul
// alege tot el localitatea oficiala din lista SIRUTA. Numele au diacritice pentru afisare;
// searchGeographicLocalities le normalizeaza oricum inainte de cautare.
const LOCALITY_HINTS = [
  { query: "București", phrases: ["bucuresti", "capitala"] },
  { query: "Cluj-Napoca", phrases: ["cluj napoca", "cluj"] },
  { query: "Timișoara", phrases: ["timisoara"] },
  { query: "Iași", phrases: ["iasi"] },
  { query: "Constanța", phrases: ["constanta"] },
  { query: "Craiova", phrases: ["craiova"] },
  { query: "Brașov", phrases: ["brasov"] },
  { query: "Galați", phrases: ["galati"] },
  { query: "Ploiești", phrases: ["ploiesti"] },
  { query: "Oradea", phrases: ["oradea"] },
  { query: "Brăila", phrases: ["braila"] },
  { query: "Arad", phrases: ["arad"] },
  { query: "Pitești", phrases: ["pitesti"] },
  { query: "Sibiu", phrases: ["sibiu"] },
  { query: "Bacău", phrases: ["bacau"] },
  { query: "Târgu Mureș", phrases: ["targu mures", "tg mures"] },
  { query: "Baia Mare", phrases: ["baia mare"] },
  { query: "Buzău", phrases: ["buzau"] },
  { query: "Botoșani", phrases: ["botosani"] },
  { query: "Satu Mare", phrases: ["satu mare"] },
  { query: "Râmnicu Vâlcea", phrases: ["ramnicu valcea", "rm valcea"] },
  { query: "Suceava", phrases: ["suceava"] },
  { query: "Piatra Neamț", phrases: ["piatra neamt"] },
  { query: "Drobeta-Turnu Severin", phrases: ["drobeta", "turnu severin"] },
  { query: "Târgu Jiu", phrases: ["targu jiu", "tg jiu"] },
  { query: "Tulcea", phrases: ["tulcea"] },
  { query: "Focșani", phrases: ["focsani"] },
  { query: "Bistrița", phrases: ["bistrita"] },
  { query: "Reșița", phrases: ["resita"] },
  { query: "Alba Iulia", phrases: ["alba iulia"] },
  { query: "Deva", phrases: ["deva"] },
  { query: "Hunedoara", phrases: ["hunedoara"] },
  { query: "Slatina", phrases: ["slatina"] },
  { query: "Vaslui", phrases: ["vaslui"] },
  { query: "Călărași", phrases: ["calarasi"] },
  { query: "Giurgiu", phrases: ["giurgiu"] },
  { query: "Zalău", phrases: ["zalau"] },
  { query: "Sfântu Gheorghe", phrases: ["sfantu gheorghe", "sf gheorghe"] },
  { query: "Târgoviște", phrases: ["targoviste"] },
  { query: "Miercurea Ciuc", phrases: ["miercurea ciuc"] },
  { query: "Slobozia", phrases: ["slobozia"] },
  { query: "Alexandria", phrases: ["alexandria"] },
  { query: "Mediaș", phrases: ["medias"] },
  { query: "Turda", phrases: ["turda"] },
  { query: "Roman", phrases: ["roman"] },
  { query: "Bârlad", phrases: ["barlad"] },
  { query: "Sighișoara", phrases: ["sighisoara"] },
  { query: "Mangalia", phrases: ["mangalia"] },
];

function firstHint(normalizedText, hints) {
  return hints.find((hint) => matchesAny(normalizedText, hint.phrases)) || null;
}

function childAgeGroupFromYears(age) {
  if (age === null || age === undefined || age >= 18) return null;
  if (age < 3) return "under_3";
  if (age <= 6) return "3_6";
  if (age <= 14) return "7_12";
  return "13_18";
}

function localityQueryFromText(normalizedText) {
  const sector = normalizedText.match(/\bsector(?:ul)? ([1-6])\b/);
  if (sector) return `Sector ${sector[1]}`;
  return firstHint(normalizedText, LOCALITY_HINTS)?.query || null;
}

export function detectPatientContextHints(text) {
  const normalized = normalize(text);
  const empty = {
    for_whom: null,
    child_age_group: null,
    timing: null,
    symptom_onset: null,
    prescription: null,
    first_exam: null,
    routine_vs_symptom: null,
    locality_query: null,
  };
  if (!normalized) return empty;

  const age = mentionedAgeYears(normalized);
  const childGroup = INTENT_SIGNAL_GROUPS.find((group) => group.child);
  const mentionsChild = (age === null || age < 18) && matchesAny(normalized, childGroup.phrases.filter((phrase) => !["strabism", "ochi lenes", "ambliopie", "mijeste", "nu vede tabla"].includes(phrase)));
  const mentionsOtherAdult = matchesAny(normalized, OTHER_ADULT_PHRASES);
  const acuteSymptom = matchesAny(normalized, INTENT_SIGNAL_GROUPS[0].phrases);
  const detectedIntent = detectIntentFromText(text);

  let forWhom = null;
  if (mentionsChild && !mentionsOtherAdult) forWhom = "child";
  else if (mentionsOtherAdult && !mentionsChild) forWhom = "other_adult";

  let routineVsSymptom = null;
  if (acuteSymptom) routineVsSymptom = "symptom";
  else if (["control_vedere", "control_copil"].includes(detectedIntent)) routineVsSymptom = "routine";

  return {
    ...empty,
    for_whom: forWhom,
    child_age_group: forWhom === "child" ? childAgeGroupFromYears(age) : null,
    timing: firstHint(normalized, TIMING_HINTS)?.value || null,
    symptom_onset: firstHint(normalized, SYMPTOM_ONSET_HINTS)?.value || null,
    prescription: firstHint(normalized, PRESCRIPTION_HINTS)?.value || null,
    first_exam: firstHint(normalized, FIRST_EXAM_HINTS)?.value || null,
    routine_vs_symptom: routineVsSymptom,
    locality_query: localityQueryFromText(normalized),
  };
}

const INTERPRETATION_FOR_WHOM = { copil: "child", other_adult: "other_adult" };
const INTERPRETATION_AGE_GROUP = {
  sub_3_ani: "under_3",
  "3_6_ani": "3_6",
  "7_12_ani": "7_12",
  "13_18_ani": "13_18",
};
const INTERPRETATION_TIMING = {
  cat_mai_repede: "cat_mai_repede",
  zilele_urmatoare: "zilele_urmatoare",
  // Optiunea e ascunsa in interfata; cea mai apropiata varianta afisata.
  saptamana_aceasta: "zilele_urmatoare",
  nu_e_urgent: "nu_e_urgent",
};

// Completeaza indiciile deterministe cu cele extrase de model din propunerea deja confirmata
// de pacient. Indiciul determinist are prioritate cand exista; modelul umple doar golurile.
// Localitatea vine din model numai daca a trecut verificarea ca apare in textul pacientului
// (vezi sanitizePatientNeedInterpretation si buildIntentConfirmationProposal).
/**
 * @param {Record<string, any> | null} [deterministicHints]
 * @param {Record<string, any> | null} [interpretationHints]
 * @returns {Record<string, any>}
 */
export function mergePatientContextHints(deterministicHints = {}, interpretationHints = null) {
  /** @type {Record<string, any>} */
  const base = { ...(deterministicHints || {}) };
  /** @type {Record<string, any>} */
  const candidate = interpretationHints || {};
  const forWhom = INTERPRETATION_FOR_WHOM[candidate.for_whom] || null;
  const ageGroup = INTERPRETATION_AGE_GROUP[candidate.age_group] || null;
  const timing = INTERPRETATION_TIMING[candidate.timing_key] || null;
  const locality = String(candidate.location_text || "").trim().slice(0, 80) || null;
  return {
    ...base,
    for_whom: base.for_whom || forWhom,
    child_age_group: base.child_age_group || ((base.for_whom || forWhom) === "child" ? ageGroup : null),
    timing: base.timing || timing,
    locality_query: base.locality_query || locality,
  };
}

const LEGACY_FOR_WHOM_OPTION = { child: "copil", other_adult: "other_adult" };
const LEGACY_AGE_OPTION = { under_3: "sub_3_ani", "3_6": "3_6_ani", "7_12": "7_12_ani", "13_18": "13_18_ani" };

// Cheia optiunii de marcat ca sugestie pentru o intrebare (catalog sau lista veche), sau
// null. Intoarce doar chei care exista si sunt vizibile in intrebarea respectiva.
/**
 * @param {any} question
 * @param {Record<string, any> | null} [hints]
 * @returns {string | null}
 */
export function suggestedOptionKeyForQuestion(question, hints = {}) {
  if (!question || question.type !== "choice" || !hints) return null;
  if (["safety_targeted_check", "safety_screening", "categorie"].includes(question.key)) return null;
  const byQuestion = {
    for_whom: hints.for_whom,
    pentru_cine: LEGACY_FOR_WHOM_OPTION[hints.for_whom],
    child_age_group: hints.child_age_group,
    varsta_copil: LEGACY_AGE_OPTION[hints.child_age_group],
    timing: hints.timing,
    symptom_timing_or_acuity: hints.symptom_onset,
    prescription_status: hints.prescription,
    reteta: hints.prescription,
    primul_control: hints.first_exam,
    routine_vs_symptom: hints.routine_vs_symptom,
  };
  const value = byQuestion[question.key];
  if (!value) return null;
  const option = (question.options || []).find((item) => item.key === value && !item.hidden);
  return option ? option.key : null;
}

// Etichetele afisate pacientului pentru o nevoie, cu diacritice. `INTENTS[...].label` ramane
// neschimbat: este salvat in cereri (`intent_label`) si folosit in verificari.
export const INTENT_DISPLAY = Object.freeze({
  control_vedere: { label: "Control de vedere", phrase: "un control de vedere" },
  control_copil: { label: "Control de vedere pentru copil", phrase: "un control de vedere pentru copil" },
  ochelari_lentile: { label: "Ochelari sau lentile pentru ochelari", phrase: "ochelari sau lentile noi" },
  lentile_contact: { label: "Lentile de contact", phrase: "lentile de contact" },
  reparatii_ochelari: { label: "Reparație sau reglaj de ochelari", phrase: "o reparație sau un reglaj la ochelari" },
  simptome_oftalmologice: { label: "O problemă la ochi", phrase: "o evaluare pentru o problemă la ochi" },
  investigatii: { label: "Investigație recomandată de medic", phrase: "o investigație recomandată de medic" },
  unknown: { label: "Nu sunt sigur", phrase: "ajutor ca să alegi" },
});

export function intentDisplayLabel(intentKey) {
  return INTENT_DISPLAY[intentKey]?.label || INTENTS[intentKey]?.label || "";
}
