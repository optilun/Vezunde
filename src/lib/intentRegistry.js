// Registru declarativ de intente pentru colectarea ghidata de informatii pentru orientare.
// Fara AI deocamdata: mesajul liber este doar context pastrat; intentia vine din
// URL / category picker. Fiecare optiune poate adauga service_keys sau comuta intentia.

export const TIMING_OPTIONS = [
  { key: "cat_mai_repede", label: "Cat mai repede" },
  { key: "zilele_urmatoare", label: "In zilele urmatoare" },
  { key: "saptamana_aceasta", label: "Saptamana aceasta" },
  { key: "nu_e_urgent", label: "Nu e urgent" },
];

const LOCATION_QUESTION = { key: "locatie", type: "location", title: "Unde cauti?" };
const TIMING_QUESTION = { key: "timing", type: "choice", title: "Cand ai nevoie?", options: TIMING_OPTIONS };

export const INTENTS = {
  control_vedere: {
    label: "Control de vedere",
    service_keys: ["control_vedere_adulti"],
    questions: [
      {
        key: "pentru_cine", type: "choice", title: "Este pentru tine sau pentru un copil?",
        options: [
          { key: "adult", label: "Pentru mine" },
          { key: "copil", label: "Pentru un copil", next_intent: "control_copil" },
        ],
      },
      {
        key: "ultimul_control", type: "choice", title: "Cand ai facut ultimul control?",
        options: [
          { key: "sub_1_an", label: "Acum mai putin de un an" },
          { key: "1_3_ani", label: "Acum 1-3 ani" },
          { key: "peste_3_ani", label: "Acum peste 3 ani" },
          { key: "niciodata", label: "Nu am facut niciodata" },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  control_copil: {
    label: "Control pentru copil",
    service_keys: ["control_vedere_copii", "managementul_miopiei"],
    questions: [
      {
        key: "varsta_copil", type: "choice", title: "Ce varsta aproximativa are copilul?",
        options: [
          { key: "sub_3_ani", label: "Sub 3 ani" },
          { key: "3_6_ani", label: "3-6 ani" },
          { key: "7_12_ani", label: "7-12 ani" },
          { key: "13_18_ani", label: "13-18 ani" },
        ],
      },
      {
        key: "primul_control", type: "choice", title: "Este primul control?",
        options: [
          { key: "da", label: "Da, este primul control" },
          { key: "nu", label: "A mai fost la control" },
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
        key: "ce_cauti", type: "choice", title: "Ce cauti?",
        options: [
          { key: "ochelari_noi", label: "Ochelari noi" },
          { key: "lentile_progresive", label: "Lentile progresive", service_keys: ["lentile_progresive"] },
          { key: "schimbare_lentile", label: "Schimbare lentile" },
          { key: "lentile_contact", label: "Lentile de contact", next_intent: "lentile_contact" },
          { key: "nu_sunt_sigur", label: "Nu sunt sigur" },
        ],
      },
      {
        key: "reteta", type: "choice", title: "Ai deja o reteta?",
        options: [
          { key: "da", label: "Da, am o reteta" },
          { key: "nu", label: "Nu, am nevoie si de un control", service_keys: ["control_vedere_adulti"] },
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
        key: "prima_data", type: "choice", title: "Este prima data cand folosesti lentile de contact?",
        options: [
          { key: "da", label: "Da, este prima data" },
          { key: "nu", label: "Am mai purtat lentile" },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  reparatii_ochelari: {
    label: "Reparatii sau reglaje",
    service_keys: ["reparatii_ochelari", "reglaj_rame"],
    notice: "Un specialist poate evalua daca reparatia este posibila. Vezunde nu poate garanta reparatia doar pe baza informatiilor oferite.",
    questions: [
      {
        key: "ce_deteriorat", type: "choice", title: "Ce s-a deteriorat?",
        options: [
          { key: "rama_rupta", label: "Rama rupta" },
          { key: "balama_surub", label: "Balamaua sau surubul" },
          { key: "lentila_zgariata", label: "Lentila zgariata sau sparta", service_keys: ["montaj_lentile"] },
          { key: "reglaj_rama", label: "Reglaj rama" },
          { key: "nu_stiu", label: "Nu stiu exact" },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  simptome_oftalmologice: {
    label: "O problema la ochi",
    service_keys: ["consult_oftalmologic"],
    notice: "Vezunde nu ofera diagnostic medical. Te ajutam sa gasesti unde poti merge pentru evaluare.",
    questions: [
      {
        key: "descriere", type: "text", title: "Descrie pe scurt ce te preocupa.",
        placeholder: "Ex: de cateva zile vad in ceata la ochiul drept",
      },
      {
        key: "pentru_cine", type: "choice", title: "Este pentru tine sau pentru un copil?",
        options: [
          { key: "adult", label: "Pentru mine" },
          { key: "copil", label: "Pentru un copil" },
        ],
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },

  investigatii: {
    label: "Investigatii",
    service_keys: [],
    questions: [
      {
        key: "investigatie", type: "choice", title: "Ce investigatie cauti?",
        options: [
          { key: "oct", label: "OCT", service_keys: ["oct"] },
          { key: "camp_vizual", label: "Camp vizual", service_keys: ["camp_vizual"] },
          { key: "tonometrie", label: "Tonometrie", service_keys: ["tonometrie"] },
          { key: "fund_de_ochi", label: "Fund de ochi", service_keys: ["fund_de_ochi"] },
          { key: "topografie_corneana", label: "Topografie corneana", service_keys: ["topografie_corneana"] },
          { key: "nu_sunt_sigur", label: "Nu sunt sigur", service_keys: ["consult_oftalmologic"] },
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
        key: "descriere", type: "text", title: "Descrie pe scurt ce ai nevoie.",
        placeholder: "Scrie in cuvintele tale, ca intr-o conversatie",
      },
      LOCATION_QUESTION,
      TIMING_QUESTION,
    ],
  },
};

export const CATEGORY_QUESTION = {
  key: "categorie",
  type: "choice",
  title: "Cu ce te putem ajuta?",
  options: [
    { key: "control_vedere", label: "Nu vad bine / vreau un control" },
    { key: "ochelari_lentile", label: "Ochelari sau lentile" },
    { key: "reparatii_ochelari", label: "Reparatii sau reglaje" },
    { key: "simptome_oftalmologice", label: "Am o problema la ochi" },
    { key: "investigatii", label: "Investigatii" },
    { key: "unknown", label: "Nu sunt sigur" },
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