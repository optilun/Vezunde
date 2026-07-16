export const SPECIALIST_GUIDES = {
  "optician-medical": {
    slug: "optician-medical",
    number: "01",
    name: "Optician medical",
    eyebrow: "Ochelari, reglaje și reparații",
    accent: "#a97825",
    tint: "#efe2bd",
    title: "Ce face un optician medical și când te poate ajuta?",
    description:
      "Află ce face un optician medical, când să mergi la el și care este diferența față de optometrist și medicul oftalmolog.",
    definition:
      "Interpretează prescripția optică pentru a realiza, monta și adapta ochelarii tăi. Se asigură că lentilele și rama îți oferă corecția și confortul de care ai nevoie.",
    shortAnswer:
      "Mergi la opticianul medical când ai deja o prescripție și ai nevoie de ochelari, lentile montate în ramă, reglaje sau reparații.",
    helpsWith: [
      "alegerea ramei și a lentilelor potrivite prescripției tale",
      "măsurătorile necesare pentru realizarea și centrarea ochelarilor",
      "montarea, adaptarea și verificarea ochelarilor finali",
      "reglaje de ramă și reparații disponibile în optică",
    ],
    goWhen: [
      "Ai o prescripție și vrei să comanzi o pereche de ochelari.",
      "Ochelarii alunecă, apasă sau nu se așază corect.",
      "Ai nevoie de înlocuirea lentilelor ori de o reparație a ramei.",
    ],
    boundary:
      "Opticianul medical nu efectuează consultații medicale și nu diagnostichează ori tratează afecțiuni oculare. Pentru simptome noi sau pentru evaluarea sănătății ochilor, ai nevoie de medic oftalmolog.",
    cta: "Găsește o optică",
    ctaTo: "/cerere?categorie=reparatii",
    related: ["optometrist", "medic-oftalmolog"],
    questions: [
      {
        question: "Am nevoie de prescripție pentru a face ochelari?",
        answer:
          "Pentru realizarea ochelarilor este necesară o corecție optică stabilită în urma unei evaluări potrivite situației tale. Opticianul folosește această prescripție pentru realizarea și adaptarea ochelarilor.",
      },
      {
        question: "Opticianul medical îmi poate verifica sănătatea ochilor?",
        answer:
          "Nu. Evaluarea medicală, diagnosticul și tratamentul afecțiunilor oculare aparțin medicului oftalmolog.",
      },
    ],
  },
  optometrist: {
    slug: "optometrist",
    number: "02",
    name: "Optometrist",
    eyebrow: "Evaluarea vederii și corecție optică",
    accent: "#345bc8",
    tint: "#dce8f2",
    title: "Ce face un optometrist și când să mergi?",
    description:
      "Află ce evaluează un optometrist, când te poate ajuta și când este necesar un consult la medicul oftalmolog.",
    definition:
      "Evaluează funcția vizuală prin măsurători optometrice, determină corecția optică și recomandă soluții pentru vedere. Atunci când este necesară o evaluare medicală, te îndrumă către un medic oftalmolog.",
    shortAnswer:
      "Mergi la optometrist pentru evaluarea vederii, verificarea dioptriilor și identificarea unei corecții optice potrivite.",
    helpsWith: [
      "măsurarea acuității și a funcției vizuale",
      "determinarea corecției optice pentru ochelari",
      "evaluări legate de adaptarea la ochelari sau lentile de contact",
      "îndrumarea către medic atunci când apar indicii care cer evaluare medicală",
    ],
    goWhen: [
      "Vezi neclar la distanță sau la aproape și vrei să verifici dioptriile.",
      "Simți că ochelarii actuali nu te mai ajută la fel de bine.",
      "Ai nevoie de o evaluare a corecției optice și nu ai simptome care sugerează o problemă medicală.",
    ],
    boundary:
      "Optometristul nu este medic, iar evaluarea optometrică nu înlocuiește consultația, diagnosticul sau tratamentul oftalmologic. Competențele pot varia în funcție de calificare și autorizare.",
    cta: "Găsește un optometrist",
    ctaTo: "/cerere?categorie=control_vedere",
    related: ["optician-medical", "medic-oftalmolog"],
    questions: [
      {
        question: "Optometristul este medic?",
        answer:
          "Nu. Optometristul evaluează funcția vizuală și corecția optică, dar diagnosticul și tratamentul bolilor de ochi aparțin medicului oftalmolog.",
      },
      {
        question: "Când mă trimite optometristul la medic?",
        answer:
          "Atunci când situația depășește evaluarea optometrică sau apar indicii care necesită investigație, diagnostic ori tratament medical.",
      },
    ],
  },
  "medic-oftalmolog": {
    slug: "medic-oftalmolog",
    number: "03",
    name: "Medic oftalmolog",
    eyebrow: "Diagnostic și tratament",
    accent: "#735c80",
    tint: "#e7dfea",
    title: "Ce face medicul oftalmolog și când ai nevoie de consultație?",
    description:
      "Află ce tratează medicul oftalmolog, când este indicat un consult și cum diferă rolul său de cel al optometristului și opticianului medical.",
    definition:
      "Efectuează consultații medicale oftalmologice, diagnostichează și tratează bolile de ochi. Atunci când este necesar, prescrie medicamente sau recomandă investigații și inițiază tratamente ori proceduri chirurgicale.",
    shortAnswer:
      "Mergi la medicul oftalmolog pentru evaluarea sănătății ochilor, simptome noi, diagnostic, tratament și monitorizarea unei afecțiuni oculare.",
    helpsWith: [
      "consultații medicale și examinarea sănătății ochilor",
      "diagnosticul afecțiunilor oculare",
      "prescrierea tratamentelor și recomandarea investigațiilor",
      "monitorizarea bolilor de ochi și indicarea procedurilor necesare",
    ],
    goWhen: [
      "Ai durere, roșeață persistentă, sensibilitate neobișnuită la lumină sau un simptom nou.",
      "Observi o scădere bruscă ori importantă a vederii.",
      "Ai o afecțiune oculară cunoscută, ai nevoie de control medical sau de tratament.",
    ],
    boundary:
      "Este singurul dintre aceste trei roluri care stabilește un diagnostic medical și indică tratamentul unei afecțiuni oculare. Pentru simptome severe ori apărute brusc, solicită rapid evaluare medicală.",
    cta: "Găsește un medic oftalmolog",
    ctaTo: "/cerere?categorie=consult_oftalmologic",
    related: ["optometrist", "optician-medical"],
    questions: [
      {
        question: "Medicul oftalmolog poate prescrie și ochelari?",
        answer:
          "Da. În cadrul consultației, medicul poate stabili și prescrie corecția optică atunci când aceasta este necesară.",
      },
      {
        question: "Când nu ar trebui să aștept un control de rutină?",
        answer:
          "O pierdere bruscă a vederii, durerea intensă, traumatismele sau simptomele severe necesită evaluare medicală rapidă.",
      },
    ],
  },
};

export const GUIDE_ORDER = [
  "optician-medical",
  "optometrist",
  "medic-oftalmolog",
];

export const getGuide = (slug) => SPECIALIST_GUIDES[slug] || null;

