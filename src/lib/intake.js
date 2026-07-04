// Configuratia wizard-ului de intake pacient. Fara diacritice.

export const INTAKE_CITIES = ["Sibiu", "Cluj-Napoca", "Timisoara", "Bucuresti"];

export const INTAKE_CATEGORIES = [
  { key: "control_vedere", label: "Nu vad bine / vreau un control", hint: "Verificarea vederii si a dioptriilor" },
  { key: "ochelari_lentile", label: "Ochelari sau lentile", hint: "Ochelari noi, progresive, lentile de contact" },
  { key: "reparatii", label: "Reparatii sau reglaje", hint: "Rame rupte, suruburi, reglaje" },
  { key: "problema_ochi", label: "Am o problema la ochi", hint: "Simptome sau disconfort ocular" },
  { key: "nesigur", label: "Nu sunt sigur", hint: "Te ghidam noi pas cu pas" },
];

export const DETAILS_CONFIG = {
  control_vedere: {
    title: "Este pentru tine sau pentru un copil?",
    options: [
      { label: "Pentru mine", for_whom: "adult", services: ["control_vedere_adulti"] },
      { label: "Pentru copil", for_whom: "copil", services: ["control_vedere_copii", "managementul_miopiei"] },
    ],
  },
  ochelari_lentile: {
    title: "Ce cauti?",
    options: [
      { label: "Ochelari noi", services: ["montaj_lentile"] },
      { label: "Lentile progresive", services: ["lentile_progresive"] },
      { label: "Lentile de contact", services: ["lentile_contact"] },
      { label: "Schimbare lentile", services: ["montaj_lentile"] },
      { label: "Nu sunt sigur", services: ["montaj_lentile", "lentile_progresive", "lentile_contact"] },
    ],
  },
  reparatii: {
    title: "Ce s-a intamplat?",
    photos: true,
    note: "Un specialist poate evalua daca reparatia este posibila. Vezunde nu poate garanta reparatia doar pe baza fotografiilor.",
    options: [
      { label: "Rama rupta", services: ["reparatii_ochelari"] },
      { label: "Balamaua sau surubul", services: ["reparatii_ochelari"] },
      { label: "Lentila zgariata sau sparta", services: ["montaj_lentile", "reparatii_ochelari"] },
      { label: "Rama necesita reglaj", services: ["reglaj_rame"] },
      { label: "Nu stiu exact", services: ["reparatii_ochelari", "reglaj_rame"] },
    ],
  },
  problema_ochi: {
    title: "Descrie ce te deranjeaza",
    textarea: true,
    note: "Vezunde nu ofera diagnostic medical. Te ajutam sa gasesti unde poti merge pentru evaluare.",
    services: ["consult_oftalmologic"],
  },
};

export const TIMING_OPTIONS = [
  { key: "astazi", label: "Astazi", urgency: "urgenta" },
  { key: "urmatoarele_zile", label: "In urmatoarele zile", urgency: "normala" },
  { key: "saptamana_aceasta", label: "Saptamana aceasta", urgency: "normala" },
  { key: "nu_ma_grabesc", label: "Nu ma grabesc", urgency: "normala" },
];

export const PREFERENCE_OPTIONS = [
  "Aproape de mine",
  "Program sambata",
  "Vreau consult medical",
  "Nu am preferinte",
];

// Mapare din vechile link-uri ?categorie= catre noile categorii de intake
export const LEGACY_CATEGORY_MAP = {
  control_vedere: "control_vedere",
  copii_miopie: "control_vedere",
  reparatii: "reparatii",
  lentile_ochelari: "ochelari_lentile",
  ochi_uscat: "problema_ochi",
  consult_oftalmologic: "problema_ochi",
};