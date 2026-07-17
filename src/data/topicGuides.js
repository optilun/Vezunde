const SOURCES = {
  eyeDoctor: {
    label: "National Eye Institute — Finding an Eye Doctor",
    url: "https://www.nei.nih.gov/eye-health-information/healthy-vision/finding-eye-doctor",
  },
  dilatedExam: {
    label: "National Eye Institute — Get a Dilated Eye Exam",
    url: "https://www.nei.nih.gov/eye-health-information/healthy-vision/finding-eye-doctor/get-dilated-eye-exam",
  },
  healthyEyes: {
    label: "National Eye Institute — Keep Your Eyes Healthy",
    url: "https://www.nei.nih.gov/eye-health-information/healthy-vision/how-eyes-work/keep-your-eyes-healthy",
  },
  refractiveErrors: {
    label: "National Eye Institute — Refractive Errors",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors",
  },
  refractiveTypes: {
    label: "National Eye Institute — Types of Refractive Errors",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors/types-refractive-errors",
  },
  myopia: {
    label: "National Eye Institute — Nearsightedness (Myopia)",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia",
  },
  presbyopia: {
    label: "National Eye Institute — Presbyopia",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/presbyopia",
  },
  cataracts: {
    label: "National Eye Institute — Cataracts",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cataracts",
  },
  cataractSurgery: {
    label: "National Eye Institute — Cataract Surgery",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cataracts/cataract-surgery",
  },
  glaucoma: {
    label: "MedlinePlus — Glaucoma",
    url: "https://medlineplus.gov/glaucoma.html",
  },
  glaucomaTests: {
    label: "MedlinePlus — Glaucoma Tests",
    url: "https://medlineplus.gov/lab-tests/glaucoma-tests/",
  },
  oct: {
    label: "Cambridge University Hospitals — Optical Coherence Tomography",
    url: "https://www.cuh.nhs.uk/patient-information/optical-coherence-tomography-oct-and-photography-clinic-with-virtual-review/",
  },
  imaging: {
    label: "NHS University Hospitals of Liverpool — Ophthalmic Imaging",
    url: "https://www.uhliverpool.nhs.uk/services/service-finder/st-pauls-eye-unit/ophthalmic-imaging",
  },
  visualField: {
    label: "Guy's and St Thomas' NHS — Visual Field Eye Test",
    url: "https://www.guysandstthomas.nhs.uk/health-information/visual-field-eye-test",
  },
  tonometry: {
    label: "MedlinePlus — Tonometry",
    url: "https://medlineplus.gov/ency/article/003447.htm",
  },
  contactLenses: {
    label: "National Eye Institute — Contact Lenses",
    url: "https://www.nei.nih.gov/eye-health-information/healthy-vision/contact-lenses",
  },
  eyeglasses: {
    label: "National Eye Institute — Eyeglasses for Refractive Errors",
    url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors/eyeglasses-refractive-errors",
  },
  appointmentPrep: {
    label: "Moorfields Eye Hospital — Preparing for Your Appointment",
    url: "https://www.moorfields.nhs.uk/for-patients/plan-your-visit/pre-appointment-information",
  },
  firstAppointment: {
    label: "Salisbury NHS Foundation Trust — Your First Appointment",
    url: "https://www.salisbury.nhs.uk/wards-departments/departments/eye-clinic/your-first-appointment/",
  },
  contactAppointment: {
    label: "Kingston and Richmond NHS — Contact Lens Appointment",
    url: "https://www.kingstonandrichmond.nhs.uk/patients-and-families/patient-leaflets/contact-lens-appointment",
  },
  opticalAppointment: {
    label: "UCI Health — Optical Shop Appointment Preparation",
    url: "https://www.ucihealth.org/medical-services/programs/optical-shop/appointment-preparation",
  },
  cornealClinic: {
    label: "Royal Free London — Preparing for Corneal Measurements",
    url: "https://www.royalfree.nhs.uk/patients-and-visitors/patient-information-leaflets/virtual-keratoconus-clinic",
  },
};

const consultationCta = {
  label: "Caută un medic oftalmolog",
  to: "/cerere?categorie=consult_oftalmologic",
};

const visionCta = {
  label: "Caută un control de vedere",
  to: "/cerere?categorie=control_vedere",
};

const investigationCta = {
  label: "Caută investigația potrivită",
  to: "/cerere?categorie=investigatii",
};

const opticalCta = {
  label: "Caută o optică",
  to: "/cerere?categorie=ochelari_lentile",
};

export const TOPIC_GROUPS = [
  {
    key: "consultatii",
    number: "02",
    label: "Consultații și evaluări",
    description: "Înțelege diferența dintre verificarea vederii, consultația medicală și investigațiile recomandate de medic.",
    accent: "#735c80",
    tint: "#e7dfea",
  },
  {
    key: "investigatii",
    number: "03",
    label: "Investigații oftalmologice",
    description: "Află ce măsoară investigațiile frecvente, cum se desfășoară și de ce rezultatul are nevoie de interpretare clinică.",
    accent: "#345bc8",
    tint: "#dce8f2",
  },
  {
    key: "vedere",
    number: "04",
    label: "Dioptrii și vedere",
    description: "Explicații clare despre cele mai întâlnite erori de refracție și variantele de corecție optică.",
    accent: "#54745f",
    tint: "#dfe9dc",
  },
  {
    key: "afectiuni",
    number: "05",
    label: "Afecțiuni frecvente",
    description: "Repere introductive despre afecțiuni care necesită diagnostic, monitorizare și tratament medical.",
    accent: "#b45f4e",
    tint: "#f0d8d0",
  },
  {
    key: "ochelari",
    number: "06",
    label: "Ochelari și lentile",
    description: "Ghiduri practice despre alegere, adaptare, utilizare și întreținere, fără promisiuni comerciale exagerate.",
    accent: "#a97825",
    tint: "#efe2bd",
  },
];

export const TOPIC_GUIDES = {
  "consultatii/consult-oftalmologic": {
    category: "consultatii",
    slug: "consult-oftalmologic",
    number: "C01",
    shortTitle: "Consult oftalmologic",
    eyebrow: "Evaluare medicală a ochilor",
    title: "Ce este un consult oftalmologic și când ai nevoie de el?",
    description: "Află ce include un consult oftalmologic, când este recomandat și cum te pregătești pentru evaluarea medicală a ochilor.",
    accent: "#735c80",
    tint: "#e7dfea",
    intro: "Consultația oftalmologică este evaluarea medicală a vederii și a sănătății ochilor. Conținutul ei diferă în funcție de simptome, istoricul tău și motivul prezentării.",
    shortAnswer: "Alege consultul oftalmologic pentru simptome noi, evaluarea sănătății ochilor, diagnostic, tratament sau monitorizarea unei afecțiuni cunoscute.",
    sections: [
      {
        label: "Ce poate include",
        title: "O evaluare adaptată situației tale",
        items: [
          "discuția despre simptome, antecedente și tratamente curente",
          "testarea vederii și examinarea structurilor ochiului",
          "măsurarea presiunii oculare ori dilatarea pupilei, atunci când medicul consideră necesar",
        ],
      },
      {
        label: "Când este util",
        title: "Nu doar când ai nevoie de ochelari",
        items: [
          "când vederea se schimbă sau apare un simptom ocular nou",
          "când ai factori de risc, o afecțiune cunoscută ori recomandare de control",
          "când este nevoie de diagnostic, tratament sau urmărire medicală",
        ],
      },
      {
        label: "Înainte de vizită",
        title: "Ce merită să ai la tine",
        items: [
          "ochelarii și prescripțiile anterioare, dacă există",
          "lista medicamentelor și a afecțiunilor cunoscute",
          "întrebările tale și momentul în care au apărut simptomele",
        ],
      },
    ],
    important: {
      title: "Consultația este act medical.",
      text: "Doar medicul oftalmolog stabilește diagnosticul și tratamentul. O evaluare optometrică poate măsura funcția vizuală și corecția optică, dar nu înlocuiește consultația medicală.",
    },
    questions: [
      { question: "Consultul oftalmologic include automat toate investigațiile?", answer: "Nu. Medicul alege examinările și investigațiile relevante pentru motivul prezentării și pentru ce observă în timpul consultației." },
      { question: "Pot primi și o prescripție de ochelari?", answer: "Da, atunci când este necesar, consultația poate include stabilirea corecției optice. Medicul decide dacă aceasta poate fi stabilită în aceeași vizită." },
      { question: "Dilatarea pupilei se face de fiecare dată?", answer: "Nu neapărat. Este folosită când medicul are nevoie să examineze mai bine interiorul ochiului; după dilatare vederea poate rămâne temporar neclară și lumina poate deranja." },
    ],
    sources: [SOURCES.eyeDoctor, SOURCES.dilatedExam],
    cta: consultationCta,
    related: ["consultatii/examen-fund-de-ochi", "investigatii/tonometrie", "afectiuni/glaucom"],
  },
  "consultatii/control-vedere": {
    category: "consultatii",
    slug: "control-vedere",
    number: "C02",
    shortTitle: "Control de vedere",
    eyebrow: "Claritatea vederii și dioptrii",
    title: "Control de vedere: ce verifică și cu ce diferă de consultație?",
    description: "Află ce se întâmplă la un control de vedere, când este potrivit și când ai nevoie de un consult oftalmologic.",
    accent: "#345bc8",
    tint: "#dce8f2",
    intro: "În limbaj curent, „control de vedere” poate descrie servicii diferite. Uneori este o evaluare optometrică a funcției vizuale și a dioptriilor; alteori este folosit pentru o consultație medicală oftalmologică.",
    shortAnswer: "Pentru verificarea clarității vederii și a corecției optice poți căuta o evaluare optometrică. Pentru sănătatea ochilor, simptome sau diagnostic ai nevoie de medic oftalmolog.",
    sections: [
      {
        label: "Evaluare optometrică",
        title: "Când întrebarea principală este „văd clar?”",
        items: [
          "măsoară acuitatea vizuală la distanță și la aproape",
          "determină corecția optică și compară vederea cu ochelarii actuali",
          "poate identifica indicii care cer îndrumare către medic",
        ],
      },
      {
        label: "Consultație medicală",
        title: "Când întrebarea este „sunt ochii sănătoși?”",
        items: [
          "evaluează simptomele și sănătatea structurilor oculare",
          "poate stabili un diagnostic și un plan de tratament",
          "poate include investigații sau examinare cu pupila dilatată",
        ],
      },
      {
        label: "Cum alegi",
        title: "Spune clar ce te deranjează",
        items: [
          "menționează dacă vrei doar verificarea dioptriilor",
          "descrie orice durere, roșeață, schimbare bruscă sau simptom neobișnuit",
          "întreabă cine efectuează evaluarea și ce include serviciul",
        ],
      },
    ],
    important: {
      title: "Aceeași denumire poate ascunde servicii diferite.",
      text: "Înainte de programare, verifică dacă serviciul este evaluare optometrică sau consultație oftalmologică și dacă include prescripție, dilatare ori alte investigații.",
    },
    questions: [
      { question: "Cine poate verifica dioptriile?", answer: "Corecția optică poate fi evaluată de un optometrist, iar medicul oftalmolog o poate stabili în cadrul consultației medicale, atunci când este necesar." },
      { question: "Un control de vedere arată toate bolile de ochi?", answer: "Nu. O testare a acuității sau a dioptriilor nu este echivalentă cu examinarea medicală completă a ochilor." },
      { question: "Ce duc la control?", answer: "Ia ochelarii sau lentilele folosite, prescripțiile vechi și notează schimbările observate. Dacă porți lentile de contact, întreabă dinainte dacă trebuie scoase." },
    ],
    sources: [SOURCES.refractiveErrors, SOURCES.eyeDoctor],
    cta: visionCta,
    related: ["consultatii/consult-oftalmologic", "vedere/miopie", "vedere/astigmatism"],
  },
  "consultatii/control-vedere-copii": {
    category: "consultatii",
    slug: "control-vedere-copii",
    number: "C03",
    shortTitle: "Control de vedere pentru copii",
    eyebrow: "Evaluare adaptată vârstei",
    title: "Controlul vederii la copii: când și unde mergi?",
    description: "Ghid pentru părinți despre evaluarea vederii copilului, semne care merită verificate și diferența dintre screening și consult.",
    accent: "#54745f",
    tint: "#dfe9dc",
    intro: "Copiii nu descriu întotdeauna clar cum văd. Evaluarea se adaptează vârstei, colaborării și motivului prezentării și poate folosi simboluri, lumini sau metode care nu depind doar de citirea literelor.",
    shortAnswer: "Caută o evaluare dedicată copiilor când există suspiciuni, recomandarea medicului sau dificultăți de vedere. Un screening nu înlocuiește consultul complet dacă apare o problemă.",
    sections: [
      {
        label: "Ce poți observa",
        title: "Semne care merită discutate",
        items: [
          "copilul apropie mult obiectele, mijește ochii sau evită activități vizuale",
          "un ochi deviază, copilul înclină capul sau acoperă un ochi",
          "apar dureri de cap, oboseală vizuală ori dificultăți la școală fără explicație clară",
        ],
      },
      {
        label: "Tipul evaluării",
        title: "Screening sau consult?",
        items: [
          "screeningul caută semne de risc și poate indica nevoia unei examinări complete",
          "evaluarea optometrică măsoară funcția vizuală și corecția, în limitele competenței",
          "oftalmologia pediatrică evaluează medical ochii și stabilește diagnosticul ori tratamentul",
        ],
      },
      {
        label: "Pregătire",
        title: "Ajută copilul să vină fără teamă",
        items: [
          "explică simplu că va privi imagini și lumini, fără promisiuni despre fiecare procedură",
          "adu ochelarii, documentele și istoricul familial relevant",
          "spune de la început dacă există sensibilități, dificultăți de comunicare sau nevoi speciale",
        ],
      },
    ],
    important: {
      title: "Vârsta nu trebuie să fie o barieră pentru evaluare.",
      text: "Dacă observi ceva neobișnuit sau primești o recomandare după screening, caută un profesionist care lucrează cu copii. Metoda potrivită și urgența sunt stabilite în funcție de situație.",
    },
    questions: [
      { question: "Copilul trebuie să știe literele?", answer: "Nu. Există teste adaptate vârstei care folosesc simboluri, imagini, lumini și observația modului în care copilul fixează și urmărește." },
      { question: "Screeningul de la grădiniță sau școală este suficient?", answer: "Screeningul este util pentru identificarea riscului, dar nu oferă întotdeauna o evaluare completă. Un rezultat suspect trebuie urmat conform recomandării primite." },
      { question: "Unde merg dacă observ că un ochi deviază?", answer: "Caută o consultație la medic oftalmolog cu experiență pediatrică; acesta poate decide dacă este nevoie și de evaluare ortoptică sau alte investigații." },
    ],
    sources: [SOURCES.eyeDoctor, SOURCES.dilatedExam],
    cta: { label: "Caută un control pentru copil", to: "/cerere?categorie=copii_miopie" },
    related: ["consultatii/consult-oftalmologic", "vedere/miopie", "vedere/hipermetropie"],
  },
  "consultatii/examen-fund-de-ochi": {
    category: "consultatii",
    slug: "examen-fund-de-ochi",
    number: "C04",
    shortTitle: "Examen fund de ochi",
    eyebrow: "Retină, maculă și nerv optic",
    title: "Examenul fundului de ochi: ce vede medicul și cum te pregătești?",
    description: "Află ce este examenul fundului de ochi, când se folosește dilatarea pupilei și la ce să te aștepți după examinare.",
    accent: "#b45f4e",
    tint: "#f0d8d0",
    intro: "Examinarea fundului de ochi îi permite medicului să privească structurile din spatele ochiului, inclusiv retina, macula, vasele și nervul optic. Uneori este necesară dilatarea pupilei pentru o vizualizare mai amplă.",
    shortAnswer: "Este o examinare medicală a interiorului ochiului, folosită pentru depistare, diagnostic sau monitorizare. Nu este același lucru cu o simplă fotografie a retinei.",
    sections: [
      {
        label: "Ce examinează",
        title: "Structuri care nu se văd din exterior",
        items: [
          "retina și zona centrală numită maculă",
          "capul nervului optic și vasele retiniene",
          "semne care pot necesita documentare prin fotografii ori investigații suplimentare",
        ],
      },
      {
        label: "Cum se face",
        title: "Cu sau fără dilatarea pupilei",
        items: [
          "medicul folosește instrumente de iluminare și mărire pentru a examina interiorul ochiului",
          "picăturile de dilatare pot fi recomandate pentru a vedea o suprafață mai mare",
          "OCT-ul și fotografia de fund de ochi pot completa examenul, dar nu îl înlocuiesc automat",
        ],
      },
      {
        label: "După dilatare",
        title: "Planifică revenirea acasă",
        items: [
          "vederea la aproape poate fi temporar neclară",
          "lumina poate deranja câteva ore, așa că ochelarii de soare pot ajuta",
          "întreabă înainte dacă este sigur să conduci după vizită și organizează alternativ transportul",
        ],
      },
    ],
    important: {
      title: "Imaginea trebuie interpretată în context.",
      text: "Aspectul fundului de ochi se corelează cu simptomele, istoricul, examenul clinic și, când este necesar, cu investigații precum OCT sau câmp vizual.",
    },
    questions: [
      { question: "Examenul fundului de ochi doare?", answer: "Examinarea este în mod obișnuit nedureroasă. Lumina poate fi intensă, iar picăturile pot produce o scurtă senzație de usturime." },
      { question: "Trebuie dilatată pupila?", answer: "Nu în toate situațiile. Medicul decide în funcție de ce trebuie examinat și de caracteristicile ochiului." },
      { question: "Fotografia retiniană este același lucru?", answer: "Nu. Fotografia documentează anumite zone, în timp ce examenul clinic permite medicului să evalueze direct ochiul. Uneori se folosesc împreună." },
    ],
    sources: [SOURCES.dilatedExam, SOURCES.imaging],
    cta: consultationCta,
    related: ["investigatii/oct", "investigatii/camp-vizual", "afectiuni/glaucom"],
  },
  "consultatii/pregatire-consult-oftalmologic": {
    category: "consultatii",
    slug: "pregatire-consult-oftalmologic",
    number: "C05",
    shortTitle: "Pregătirea pentru consult",
    eyebrow: "Ce aduci și ce întrebi înainte",
    title: "Cum te pregătești pentru consultul oftalmologic sau controlul de vedere?",
    description: "Checklist complet pentru consultul oftalmologic, controlul de vedere sau vizita în optică: istoric, ochelari, lentile de contact, documente și transport.",
    accent: "#345bc8",
    tint: "#dce8f2",
    intro: "O pregătire bună îl ajută pe profesionist să înțeleagă schimbările, să compare corecțiile și să aleagă testele potrivite. Cerințele diferă însă între consultație, evaluare optometrică, adaptarea lentilelor și investigațiile corneene.",
    shortAnswer: "Adu ochelarii folosiți, prescripțiile și investigațiile vechi, datele lentilelor de contact, lista medicamentelor și informații despre bolile, operațiile și antecedentele oculare din familie.",
    sections: [
      {
        label: "Istoric și documente",
        title: "Construiește o imagine clară a sănătății tale",
        items: [
          "notează afecțiunile generale importante, inclusiv diabetul, hipertensiunea, bolile autoimune și alergiile cunoscute",
          "adu lista medicamentelor, suplimentelor și picăturilor folosite, cu doza și frecvența dacă le cunoști",
          "menționează operațiile, tratamentele cu laser, traumatismele și infecțiile oculare anterioare",
          "adu scrisori medicale, rezultate, imagini sau recomandări anterioare și istoricul familial de glaucom, degenerescență maculară, keratoconus ori alte boli oculare",
        ],
      },
      {
        label: "Ochelari și lentile",
        title: "Adu tot ce folosești pentru a vedea",
        items: [
          "ia ochelarii actuali pentru distanță, citit, calculator sau condus, chiar dacă nu îi porți permanent",
          "adu prescripțiile mai vechi și ochelarii anteriori dacă vederea s-a schimbat sau vrei o comparație",
          "pentru lentile de contact, notează marca, materialul, puterea, curbura, diametrul și programul de înlocuire sau adu ambalajul",
          "ia recipientul curat, soluția potrivită și ochelarii de rezervă, în cazul în care lentilele trebuie scoase",
        ],
      },
      {
        label: "Motivul vizitei",
        title: "Descrie problema și activitățile reale",
        items: [
          "notează când a început simptomul, dacă a apărut brusc sau treptat și dacă afectează unul ori ambii ochi",
          "spune ce te deranjează la distanță, la aproape, noaptea, la volan sau în fața ecranelor",
          "pentru ochelari, măsoară aproximativ distanța până la monitor și descrie activitatea, postura și numărul de ecrane",
          "scrie întrebările înainte de vizită și spune ce rezultat urmărești: sănătatea ochilor, dioptrii, lentile, ochelari sau o investigație",
        ],
      },
      {
        label: "Ziua programării",
        title: "Lasă timp pentru teste și întoarcerea acasă",
        items: [
          "urmează instrucțiunile primite de la locație și anunță dacă nu le-ai putut respecta",
          "nu întrerupe medicamentele și nu folosi picături noi din proprie inițiativă; întreabă locația dacă ai o nelămurire",
          "ia ochelari de soare și organizează transport alternativ dacă este posibil să ți se dilate pupilele",
          "spune dinainte dacă ai nevoie de interpret, însoțitor, accesibilitate sau mai mult timp pentru comunicare",
        ],
      },
    ],
    important: {
      title: "Nu aplica automat regula de „minimum 5 ore fără lentile”.",
      text: "Pentru evaluarea lentilelor, unele clinici cer să vii cu ele purtate dacă sunt confortabile. Pentru topografie, biometrie sau evaluare preoperatorie, lentilele moi pot necesita o pauză de câteva zile, iar cele rigide una de săptămâni. Instrucțiunea locației și tipul investigației au prioritate. Dacă ai durere, roșeață sau vedere brusc neclară, scoate lentilele și solicită sfat medical.",
    },
    questions: [
      {
        question: "Trebuie să scot lentilele de contact cu 5 ore înainte?",
        answer: "Nu există o regulă universală. Pentru o vizită de verificare a lentilelor ți se poate cere să le porți, iar pentru măsurători ale corneei pauza poate fi mult mai lungă. Sună locația și spune ce tip de lentile porți și pentru ce serviciu ești programat.",
      },
      {
        question: "Ce informații medicale sunt relevante pentru ochi?",
        answer: "Menționează diagnosticele generale, tratamentele și alergiile, operațiile sau traumatismele oculare și bolile de ochi din familie. Diabetul, hipertensiunea și unele medicamente pot conta pentru evaluare.",
      },
      {
        question: "Îmi iau toate perechile de ochelari?",
        answer: "Da, dacă le folosești pentru distanțe sau activități diferite. Profesionistul poate măsura lentilele, verifica poziția ramei și compara corecția actuală cu nevoile tale.",
      },
      {
        question: "Pot conduce după consultație?",
        answer: "Dacă se folosesc picături pentru dilatarea pupilei, vederea poate fi temporar neclară și lumina poate deranja. Planifică transport alternativ și urmează recomandarea primită înainte de a conduce.",
      },
      {
        question: "Trebuie să vin nemâncat sau să opresc tratamentul?",
        answer: "Pentru un consult obișnuit, în general nu, dar procedurile și evaluările preoperatorii pot avea alte reguli. Nu modifica tratamentul fără indicație și verifică instrucțiunile programării.",
      },
    ],
    sources: [
      SOURCES.appointmentPrep,
      SOURCES.firstAppointment,
      SOURCES.contactAppointment,
      SOURCES.opticalAppointment,
      SOURCES.cornealClinic,
      SOURCES.dilatedExam,
    ],
    cta: consultationCta,
    related: [
      "consultatii/consult-oftalmologic",
      "consultatii/control-vedere",
      "ochelari/lentile-de-contact",
    ],
  },
  "investigatii/oct": {
    category: "investigatii",
    slug: "oct",
    number: "I01",
    shortTitle: "OCT ocular",
    eyebrow: "Tomografie în coerență optică",
    title: "OCT ocular: ce arată investigația și cum se interpretează?",
    description: "Află ce este OCT-ul ocular, ce structuri poate scana, cum se desfășoară și de ce rezultatul trebuie interpretat de clinician.",
    accent: "#345bc8",
    tint: "#dce8f2",
    intro: "OCT-ul folosește lumină pentru a obține imagini în secțiune ale țesuturilor oculare. Poate documenta în detaliu retina, macula, nervul optic și, cu aparate potrivite, structuri din partea anterioară a ochiului.",
    shortAnswer: "OCT-ul este o investigație imagistică rapidă și neinvazivă. Arată structuri, nu stabilește singur diagnosticul; rezultatul se corelează cu consultația și celelalte teste.",
    sections: [
      {
        label: "Ce poate analiza",
        title: "Straturi fine, măsurate și comparate",
        items: [
          "retina și macula, inclusiv modificări ale grosimii sau acumulări de lichid",
          "nervul optic și stratul fibrelor nervoase în evaluări precum cele pentru glaucom",
          "corneea și segmentul anterior, atunci când aparatul și indicația permit",
        ],
      },
      {
        label: "Cum se desfășoară",
        title: "Privești un reper luminos",
        items: [
          "capul este sprijinit, iar aparatul scanează fără să atingă ochiul",
          "este important să fixezi reperul și să clipești când ți se spune",
          "uneori se folosesc picături de dilatare pentru o imagine mai bună",
        ],
      },
      {
        label: "Rezultatul",
        title: "O hartă care are nevoie de context",
        items: [
          "calitatea scanării influențează cât de sigur poate fi citit rezultatul",
          "valorile de referință ale aparatului nu înlocuiesc judecata clinică",
          "compararea în timp poate fi importantă pentru monitorizare",
        ],
      },
    ],
    important: {
      title: "OCT-ul nu este un diagnostic automat.",
      text: "O scanare aparent normală nu exclude orice problemă, iar o zonă marcată de aparat nu înseamnă automat boală. Interpretarea aparține clinicianului care cunoaște cazul.",
    },
    questions: [
      { question: "OCT-ul doare sau folosește radiații?", answer: "Scanarea este neinvazivă, folosește lumină și, în mod obișnuit, nu atinge ochiul. Nu este o investigație cu raze X." },
      { question: "Trebuie să îmi scot lentilele de contact?", answer: "Depinde de tipul scanării și de protocolul locației. Întreabă când faci programarea și urmează instrucțiunile primite." },
      { question: "Primesc diagnosticul imediat după scanare?", answer: "Nu întotdeauna. În unele locații imaginile sunt analizate ulterior de clinician, iar concluzia este comunicată separat." },
    ],
    sources: [SOURCES.oct, SOURCES.imaging],
    cta: investigationCta,
    related: ["consultatii/examen-fund-de-ochi", "investigatii/camp-vizual", "afectiuni/glaucom"],
  },
  "investigatii/camp-vizual": {
    category: "investigatii",
    slug: "camp-vizual",
    number: "I02",
    shortTitle: "Câmp vizual",
    eyebrow: "Vedere centrală și periferică",
    title: "Testul de câmp vizual: cum se face și ce măsoară?",
    description: "Află ce verifică testarea câmpului vizual, cum răspunzi la stimuli și de ce uneori testul trebuie repetat.",
    accent: "#735c80",
    tint: "#e7dfea",
    intro: "Câmpul vizual reprezintă aria pe care o percepi când privești drept înainte. Testarea măsoară sensibilitatea în diferite zone și este folosită în evaluarea retinei, nervului optic și căilor vizuale.",
    shortAnswer: "În timpul testului privești un punct fix și semnalizezi luminile pe care le observi. Concentrarea și poziția corectă influențează fiabilitatea rezultatului.",
    sections: [
      {
        label: "La ce folosește",
        title: "Detectează zone pe care poate nu le observi",
        items: [
          "evaluează vederea periferică și sensibilitatea la lumină",
          "ajută la diagnosticul și monitorizarea glaucomului și a altor afecțiuni",
          "poate urmări modificările între două sau mai multe vizite",
        ],
      },
      {
        label: "În timpul testului",
        title: "Fixezi centrul, răspunzi la periferie",
        items: [
          "fiecare ochi este testat separat, iar celălalt este acoperit",
          "apeși butonul când observi un stimul, fără să urmărești luminile cu privirea",
          "unele lumini sunt intenționat foarte slabe și este normal să nu le vezi pe toate",
        ],
      },
      {
        label: "Pentru un rezultat bun",
        title: "Spune dacă obosești sau pierzi fixarea",
        items: [
          "adu ochelarii folosiți, inclusiv cei de citit",
          "așază-te confortabil și urmează explicația tehnicianului",
          "cere o pauză dacă devine dificil să te concentrezi",
        ],
      },
    ],
    important: {
      title: "Repetarea nu înseamnă automat agravare.",
      text: "Testul are o componentă de învățare și depinde de atenție, oboseală și fixare. Clinicianul analizează și indicatorii de fiabilitate, nu doar harta finală.",
    },
    questions: [
      { question: "Cât durează testul?", answer: "Durata depinde de tipul testului și de fiecare persoană. Poate dura câteva minute pentru fiecare ochi sau mai mult în protocoale extinse." },
      { question: "De ce trebuie testat și ochiul care pare sănătos?", answer: "Testarea ambilor ochi oferă un reper de comparație și poate identifica schimbări care nu sunt încă percepute în activitățile zilnice." },
      { question: "Pot greși dacă apăs prea devreme?", answer: "Aparatele verifică răspunsurile și fiabilitatea. Câteva erori nu anulează automat testul, dar răspunde doar când crezi că ai observat lumina." },
    ],
    sources: [SOURCES.visualField, SOURCES.dilatedExam],
    cta: investigationCta,
    related: ["investigatii/oct", "investigatii/tonometrie", "afectiuni/glaucom"],
  },
  "investigatii/tonometrie": {
    category: "investigatii",
    slug: "tonometrie",
    number: "I03",
    shortTitle: "Tonometrie",
    eyebrow: "Măsurarea presiunii oculare",
    title: "Tonometria: cum se măsoară presiunea din ochi?",
    description: "Află ce este tonometria, ce metode de măsurare există și de ce o valoare izolată nu stabilește diagnosticul de glaucom.",
    accent: "#54745f",
    tint: "#dfe9dc",
    intro: "Tonometria măsoară presiunea intraoculară. Este o parte frecventă a evaluării pentru glaucom și a monitorizării tratamentului, dar rezultatul se interpretează împreună cu alte date despre ochi.",
    shortAnswer: "Presiunea poate fi măsurată printr-un puf de aer sau prin atingerea blândă a corneei după anestezie locală. Metoda folosită influențează experiența și interpretarea.",
    sections: [
      {
        label: "Metode",
        title: "Atingere controlată sau puf de aer",
        items: [
          "tonometria de aplanație măsoară forța necesară pentru a aplatiza o mică zonă a corneei",
          "tonometria non-contact folosește un puf scurt de aer",
          "există și dispozitive portabile, alese în funcție de context",
        ],
      },
      {
        label: "Pregătire",
        title: "Spune ce porți și ce antecedente ai",
        items: [
          "lentilele de contact trebuie scoase pentru anumite metode",
          "menționează intervenții, leziuni sau infecții oculare anterioare",
          "spune dacă ai glaucom în familie și ce tratamente folosești",
        ],
      },
      {
        label: "Interpretare",
        title: "Mai mult decât un singur număr",
        items: [
          "grosimea și proprietățile corneei pot influența măsurarea",
          "presiunea variază și poate fi comparată la vizite diferite",
          "diagnosticul de glaucom implică evaluarea nervului optic, a câmpului vizual și a altor factori",
        ],
      },
    ],
    important: {
      title: "Presiunea oculară nu este sinonimă cu glaucomul.",
      text: "O valoare mare nu confirmă singură boala, iar unele persoane pot avea glaucom fără o presiune foarte mare la o anumită măsurare. Concluzia aparține medicului.",
    },
    questions: [
      { question: "Tonometria doare?", answer: "Puful de aer poate surprinde, iar metodele de contact folosesc de obicei picături anestezice. În mod obișnuit, testul este scurt și bine tolerat." },
      { question: "Pot purta lentile de contact la programare?", answer: "Le poți purta până la vizită dacă nu primești alte instrucțiuni, dar este posibil să fie nevoie să le scoți înainte de măsurare. Ia recipientul și soluția potrivită." },
      { question: "O valoare normală exclude glaucomul?", answer: "Nu. Medicul evaluează riscul folosind mai multe teste și istoricul medical, nu doar o singură valoare a presiunii." },
    ],
    sources: [SOURCES.tonometry, SOURCES.glaucomaTests],
    cta: investigationCta,
    related: ["afectiuni/glaucom", "investigatii/oct", "investigatii/camp-vizual"],
  },
  "investigatii/topografie-corneana": {
    category: "investigatii",
    slug: "topografie-corneana",
    number: "I04",
    shortTitle: "Topografie corneană",
    eyebrow: "Harta curburii corneei",
    title: "Topografia corneană: ce măsoară și când este recomandată?",
    description: "Află ce este topografia corneană, cum se realizează harta suprafeței corneei și în ce situații poate fi utilă.",
    accent: "#a97825",
    tint: "#efe2bd",
    intro: "Topografia corneană este o investigație neinvazivă care creează o hartă a curburii corneei. Poate evidenția regularitatea suprafeței și diferențe care nu apar într-o măsurare simplă a dioptriilor.",
    shortAnswer: "Privești în aparat câteva secunde, fără contact cu ochiul în majoritatea sistemelor. Rezultatul ajută la evaluarea formei corneei și trebuie corelat cu examenul clinic.",
    sections: [
      {
        label: "Când se folosește",
        title: "Formă, simetrie și modificări în timp",
        items: [
          "evaluarea unui astigmatism neregulat sau a suspiciunii de keratoconus",
          "adaptarea anumitor lentile de contact și investigarea disconfortului vizual",
          "evaluări înainte sau după proceduri corneene, conform recomandării medicului",
        ],
      },
      {
        label: "Cum se face",
        title: "O serie de imagini ale suprafeței",
        items: [
          "sprijini bărbia și fruntea și privești un reper central",
          "aparatul proiectează un model luminos și calculează harta curburii",
          "scanarea este rapidă și, de regulă, nu atinge ochiul",
        ],
      },
      {
        label: "Înainte de test",
        title: "Lentilele de contact pot schimba forma corneei",
        items: [
          "întreabă cu cât timp înainte trebuie întreruptă purtarea lentilelor",
          "spune ce tip de lentile folosești și cât timp le porți zilnic",
          "adu măsurători mai vechi dacă investigația urmărește evoluția",
        ],
      },
    ],
    important: {
      title: "O hartă colorată nu se interpretează după culori, acasă.",
      text: "Scalele și algoritmii diferă între aparate. Clinicianul analizează tiparul, calitatea capturii, istoricul și comparația cu alte investigații.",
    },
    questions: [
      { question: "Este același lucru cu pahimetria?", answer: "Nu. Topografia descrie în principal curbura suprafeței, în timp ce pahimetria măsoară grosimea corneei. Unele aparate oferă mai multe tipuri de hărți." },
      { question: "Este același lucru cu tomografia corneană?", answer: "Nu exact. Tomografia poate reconstrui informații despre suprafețele anterioară și posterioară și despre grosime; denumirile sunt uneori folosite informal, așa că întreabă ce aparat și ce analiză sunt oferite." },
      { question: "De ce trebuie să scot lentilele înainte?", answer: "Lentilele pot modifica temporar forma corneei și pot influența măsurarea. Intervalul necesar depinde de tipul lentilei și de scopul investigației." },
    ],
    sources: [SOURCES.imaging],
    cta: investigationCta,
    related: ["vedere/astigmatism", "ochelari/lentile-de-contact", "consultatii/consult-oftalmologic"],
  },
  "vedere/miopie": {
    category: "vedere",
    slug: "miopie",
    number: "V01",
    shortTitle: "Miopie",
    eyebrow: "Vedere neclară la distanță",
    title: "Miopia: ce înseamnă și cum se corectează vederea?",
    description: "Află ce este miopia, cum se manifestă, cum se măsoară și ce opțiuni de corecție pot fi discutate cu specialistul.",
    accent: "#345bc8",
    tint: "#dce8f2",
    intro: "Miopia este o eroare de refracție în care obiectele aflate la distanță apar neclare. Lumina se focalizează în fața retinei, de obicei din cauza lungimii ochiului sau a formei corneei și cristalinului.",
    shortAnswer: "Miopia se identifică printr-o evaluare a vederii și poate fi corectată cu ochelari sau lentile de contact; opțiunile medicale și controlul progresiei se discută individual.",
    sections: [
      {
        label: "Cum se simte",
        title: "Distanța devine mai greu de focalizat",
        items: [
          "indicatoarele, tabla sau ecranele îndepărtate par neclare",
          "mijirea ochilor poate îmbunătăți temporar claritatea",
          "pot apărea oboseală vizuală sau dureri de cap, fără ca acestea să fie specifice doar miopiei",
        ],
      },
      {
        label: "Cum se verifică",
        title: "Dioptria este doar o parte din evaluare",
        items: [
          "acuitatea vizuală se testează separat pentru fiecare ochi",
          "refracția stabilește lentila care oferă claritatea potrivită",
          "la copii și în anumite situații pot fi necesare metode și examinări suplimentare",
        ],
      },
      {
        label: "Corecție și urmărire",
        title: "Soluția depinde de vârstă și nevoie",
        items: [
          "ochelarii sunt o metodă simplă de corecție",
          "lentilele de contact necesită adaptare și îngrijire corectă",
          "pentru copii, progresia miopiei trebuie urmărită și discutată cu un profesionist calificat",
        ],
      },
    ],
    important: {
      title: "O schimbare rapidă merită evaluată.",
      text: "Dioptriile se pot modifica în timp. Dacă vederea scade brusc, apar flash-uri, multe puncte noi sau o umbră în câmpul vizual, caută evaluare medicală rapidă.",
    },
    questions: [
      { question: "Miopia înseamnă doar că nu văd la distanță?", answer: "Acesta este semnul tipic, dar gradul și impactul diferă. O evaluare completă verifică fiecare ochi și exclude alte cauze ale vederii neclare." },
      { question: "Ochelarii fac miopia să crească?", answer: "Ochelarii corectează focalizarea și nu „lenevesc” ochii. Evoluția miopiei are alți factori și trebuie urmărită prin măsurători comparabile." },
      { question: "Miopia se poate corecta și cu lentile de contact?", answer: "Da, pentru multe persoane. Este necesară o adaptare corectă, o prescripție pentru lentile de contact și respectarea strictă a igienei și programului de purtare." },
    ],
    sources: [SOURCES.myopia, SOURCES.refractiveErrors],
    cta: visionCta,
    related: ["consultatii/control-vedere", "consultatii/control-vedere-copii", "ochelari/lentile-de-contact"],
  },
  "vedere/hipermetropie": {
    category: "vedere",
    slug: "hipermetropie",
    number: "V02",
    shortTitle: "Hipermetropie",
    eyebrow: "Efort de focalizare, mai ales la aproape",
    title: "Hipermetropia: de ce vederea poate obosi la aproape?",
    description: "Află ce este hipermetropia, cum poate fi compensată de ochi și când o evaluare a vederii poate clarifica simptomele.",
    accent: "#a97825",
    tint: "#efe2bd",
    intro: "Hipermetropia este o eroare de refracție în care lumina ar tinde să se focalizeze în spatele retinei. Persoanele tinere pot compensa o parte prin efort de acomodare, astfel încât simptomele nu sunt identice pentru toți.",
    shortAnswer: "Poate provoca neclaritate la aproape sau efort vizual, dar uneori rămâne ascunsă prin acomodare. Refracția și examenul adaptat vârstei stabilesc dacă este necesară corecția.",
    sections: [
      {
        label: "Manifestări posibile",
        title: "Claritate obținută cu efort",
        items: [
          "oboseală la citit sau lucru de aproape",
          "vedere neclară la aproape și, în forme mai mari, și la distanță",
          "dureri de cap sau dificultăți de concentrare vizuală, care pot avea și alte cauze",
        ],
      },
      {
        label: "La copii",
        title: "Compensarea poate ascunde dioptria",
        items: [
          "un copil poate vedea aparent bine și totuși depune efort mare",
          "evaluarea trebuie adaptată vârstei și poate necesita picături pentru măsurarea refracției",
          "asocierea cu deviația unui ochi necesită consult oftalmologic pediatric",
        ],
      },
      {
        label: "Corecție",
        title: "Nu orice valoare se tratează identic",
        items: [
          "decizia ține de vârstă, simptome, valoare și echilibrul dintre ochi",
          "ochelarii sau lentilele de contact pot compensa eroarea de refracție",
          "prescripția se stabilește după o evaluare, nu doar după un test automat",
        ],
      },
    ],
    important: {
      title: "Simptomele nu indică singure dioptria.",
      text: "Oboseala la aproape poate avea mai multe cauze. O evaluare măsoară refracția și verifică dacă există un motiv medical sau binocular care cere alt tip de îngrijire.",
    },
    questions: [
      { question: "Hipermetropia înseamnă că văd bine la distanță?", answer: "Nu întotdeauna. În forme mici, mai ales la persoane tinere, distanța poate fi clară prin efort de acomodare; în forme mai mari poate fi afectată și vederea la distanță." },
      { question: "Este același lucru cu presbiopia?", answer: "Nu. Hipermetropia ține de modul în care ochiul focalizează lumina, iar presbiopia apare odată cu scăderea flexibilității cristalinului la vârsta adultă." },
      { question: "Copilul poate avea hipermetropie fără să se plângă?", answer: "Da. Copiii compensează uneori bine și nu pot descrie efortul. Screeningul și evaluarea la nevoie sunt importante." },
    ],
    sources: [SOURCES.refractiveTypes, SOURCES.refractiveErrors],
    cta: visionCta,
    related: ["vedere/presbiopie", "consultatii/control-vedere-copii", "consultatii/control-vedere"],
  },
  "vedere/astigmatism": {
    category: "vedere",
    slug: "astigmatism",
    number: "V03",
    shortTitle: "Astigmatism",
    eyebrow: "Imagine neclară sau distorsionată",
    title: "Astigmatismul: cum influențează claritatea imaginii?",
    description: "Află ce este astigmatismul, ce simptome poate provoca și de ce măsurarea formei corneei poate fi uneori necesară.",
    accent: "#735c80",
    tint: "#e7dfea",
    intro: "Astigmatismul apare când corneea sau cristalinul are o formă care face lumina să se focalizeze diferit pe mai multe direcții. Imaginea poate fi neclară sau distorsionată atât la distanță, cât și la aproape.",
    shortAnswer: "Astigmatismul este o eroare de refracție frecventă și poate exista împreună cu miopia ori hipermetropia. Corecția se stabilește prin refracție.",
    sections: [
      {
        label: "Cum se manifestă",
        title: "Contururi mai puțin precise",
        items: [
          "litere sau lumini care par alungite, estompate ori dublate",
          "neclaritate la mai multe distanțe",
          "mijirea ochilor, oboseală vizuală sau dureri de cap nespecifice",
        ],
      },
      {
        label: "Cum se măsoară",
        title: "Valoare și axă",
        items: [
          "refracția stabilește puterea cilindrică și orientarea corecției",
          "keratometria poate măsura curbura centrală a corneei",
          "topografia sau tomografia corneană poate fi recomandată când forma pare neregulată",
        ],
      },
      {
        label: "Corecție",
        title: "Precizia montajului contează",
        items: [
          "ochelarii folosesc lentile cilindrice orientate pe axa prescrisă",
          "lentilele de contact torice necesită stabilitate și adaptare",
          "schimbările neobișnuite pot necesita evaluarea corneei, nu doar o prescripție nouă",
        ],
      },
    ],
    important: {
      title: "Astigmatismul regulat și cel neregulat nu sunt același lucru.",
      text: "Dacă valoarea se schimbă neobișnuit sau vederea nu se corectează suficient, clinicianul poate recomanda investigații ale corneei.",
    },
    questions: [
      { question: "Astigmatismul este o boală?", answer: "Astigmatismul regulat este o eroare de refracție frecventă. Unele forme neregulate pot fi asociate cu modificări ale corneei care necesită evaluare medicală." },
      { question: "Poate fi corectat cu ochelari?", answer: "Da, în multe cazuri. Prescripția include puterea cilindrică și axa, iar măsurarea și montajul precis sunt importante." },
      { question: "De ce se rotește vederea cu lentilele de contact?", answer: "Lentilele torice trebuie să rămână într-o poziție stabilă. Dacă se rotesc, claritatea poate fluctua și este necesară verificarea adaptării." },
    ],
    sources: [SOURCES.refractiveTypes, SOURCES.imaging],
    cta: visionCta,
    related: ["investigatii/topografie-corneana", "ochelari/lentile-de-contact", "consultatii/control-vedere"],
  },
  "vedere/presbiopie": {
    category: "vedere",
    slug: "presbiopie",
    number: "V04",
    shortTitle: "Presbiopie",
    eyebrow: "Focalizare mai dificilă la aproape",
    title: "Presbiopia: de ce apare nevoia de ajutor la citit?",
    description: "Află ce este presbiopia, cum apare odată cu vârsta și ce variante de corecție pot fi evaluate pentru aproape și distanțe intermediare.",
    accent: "#b45f4e",
    tint: "#f0d8d0",
    intro: "Presbiopia este reducerea treptată a capacității cristalinului de a focaliza la aproape. Este legată de vârstă și se poate adăuga miopiei, hipermetropiei sau astigmatismului deja existente.",
    shortAnswer: "Dacă îndepărtezi telefonul sau ai nevoie de mai multă lumină la citit, o evaluare poate stabili corecția pentru aproape și distanțele folosite zilnic.",
    sections: [
      {
        label: "Semne frecvente",
        title: "Aproapele cere mai mult efort",
        items: [
          "ții textul mai departe pentru a-l vedea clar",
          "obosești la citit, lucru manual sau telefon",
          "ai nevoie de lumină mai bună și de pauze mai dese",
        ],
      },
      {
        label: "Evaluare",
        title: "Contează toate distanțele tale",
        items: [
          "se măsoară vederea la distanță, intermediar și aproape",
          "se discută activitățile: condus, birou, citit, lucru de precizie",
          "se verifică dacă simptomele sunt explicate doar de presbiopie",
        ],
      },
      {
        label: "Variante de corecție",
        title: "Ochelari separați sau o singură pereche",
        items: [
          "ochelari de citit pentru o distanță specifică",
          "lentile ocupaționale pentru aproape și intermediar",
          "lentile progresive sau anumite lentile de contact, după evaluare și adaptare",
        ],
      },
    ],
    important: {
      title: "Ochelarii de citit nu sunt universali.",
      text: "Corecția potrivită depinde de dioptria fiecărui ochi, distanța de lucru și eventualul astigmatism. O pereche aleasă fără măsurare poate să nu răspundă nevoii reale.",
    },
    questions: [
      { question: "La ce vârstă apare presbiopia?", answer: "Este observată de obicei la vârsta adultă mijlocie, dar momentul și intensitatea diferă în funcție de corecția existentă și activități." },
      { question: "Presbiopia poate exista împreună cu miopia?", answer: "Da. Miopia nu împiedică apariția presbiopiei; poate schimba doar felul în care observi nevoia de corecție la aproape." },
      { question: "Lentilele progresive sunt singura soluție?", answer: "Nu. Există mai multe variante, iar alegerea depinde de distanțele folosite, toleranță, activități și preferințe." },
    ],
    sources: [SOURCES.presbyopia, SOURCES.refractiveErrors],
    cta: visionCta,
    related: ["ochelari/lentile-progresive", "vedere/hipermetropie", "consultatii/control-vedere"],
  },
  "afectiuni/cataracta": {
    category: "afectiuni",
    slug: "cataracta",
    number: "A01",
    shortTitle: "Cataractă",
    eyebrow: "Opacifierea cristalinului",
    title: "Cataracta: ce este și când se discută tratamentul?",
    description: "Informații introductive despre cataractă, simptome posibile, consultație și momentul în care medicul poate discuta operația.",
    accent: "#a97825",
    tint: "#efe2bd",
    intro: "Cataracta este opacifierea cristalinului, lentila naturală din interiorul ochiului. Poate face imaginea mai încețoșată, culorile mai puțin vii și lumina mai deranjantă.",
    shortAnswer: "Diagnosticul se stabilește la consultația oftalmologică. Operația este tratamentul care îndepărtează cataracta, iar momentul se decide în funcție de impact, examinare și starea generală a ochiului.",
    sections: [
      {
        label: "Ce poți observa",
        title: "O schimbare lentă a calității imaginii",
        items: [
          "vedere încețoșată sau lipsită de contrast",
          "halouri, sensibilitate la lumină ori dificultăți mai mari noaptea",
          "schimbări repetate ale dioptriilor sau culori care par mai estompate",
        ],
      },
      {
        label: "Consultație",
        title: "Medicul verifică mai mult decât cristalinul",
        items: [
          "măsoară vederea și examinează cataracta la biomicroscop",
          "evaluează retina, nervul optic și alte cauze care pot limita vederea",
          "discută impactul asupra activităților și beneficiul realist al tratamentului",
        ],
      },
      {
        label: "Tratament",
        title: "Decizia este individuală",
        items: [
          "ochelarii pot ajuta temporar când schimbarea este mică",
          "operația înlocuiește cristalinul opacifiat cu un implant artificial",
          "tipul implantului, riscurile și așteptările se discută cu chirurgul",
        ],
      },
    ],
    important: {
      title: "Nu orice vedere neclară este cataractă.",
      text: "Simptomele se pot suprapune cu alte probleme. Consultația stabilește cauza, iar rezultatul estimat după operație depinde și de sănătatea retinei, nervului optic și corneei.",
    },
    questions: [
      { question: "Cataracta trebuie operată imediat?", answer: "Nu în toate cazurile. Medicul discută operația când cataracta afectează activitățile sau împiedică evaluarea și tratamentul altor probleme oculare." },
      { question: "Picăturile pot dizolva cataracta?", answer: "Nu există picături demonstrate care să îndepărteze cataracta formată. Operația este metoda care înlătură cristalinul opacifiat." },
      { question: "După operație nu mai am nevoie de ochelari?", answer: "Depinde de implant, de ținta aleasă și de restul ochiului. Poate rămâne nevoie de corecție pentru unele distanțe." },
    ],
    sources: [SOURCES.cataracts, SOURCES.cataractSurgery],
    cta: consultationCta,
    related: ["consultatii/consult-oftalmologic", "consultatii/examen-fund-de-ochi", "investigatii/oct"],
  },
  "afectiuni/glaucom": {
    category: "afectiuni",
    slug: "glaucom",
    number: "A02",
    shortTitle: "Glaucom",
    eyebrow: "Afectarea nervului optic",
    title: "Glaucomul: de ce sunt importante controalele și investigațiile?",
    description: "Află ce este glaucomul, de ce poate evolua fără simptome și ce rol au presiunea oculară, OCT-ul și câmpul vizual.",
    accent: "#735c80",
    tint: "#e7dfea",
    intro: "Glaucomul descrie un grup de afecțiuni care afectează nervul optic. Unele forme evoluează lent și fără semne evidente la început, motiv pentru care depistarea și monitorizarea se bazează pe examen și investigații.",
    shortAnswer: "Presiunea oculară este un factor important, dar glaucomul nu se diagnostichează dintr-un singur număr. Medicul corelează nervul optic, câmpul vizual, OCT-ul și riscul individual.",
    sections: [
      {
        label: "Evaluare",
        title: "Mai multe piese ale aceleiași imagini",
        items: [
          "măsurarea presiunii intraoculare prin tonometrie",
          "examinarea nervului optic și, frecvent, documentarea prin OCT sau fotografie",
          "testarea câmpului vizual și compararea rezultatelor în timp",
        ],
      },
      {
        label: "Factori de risc",
        title: "Istoricul contează",
        items: [
          "rude apropiate cu glaucom și vârsta înaintată",
          "anumite caracteristici ale ochiului, afecțiuni și tratamente",
          "presiune oculară crescută, fără ca aceasta să însemne automat glaucom",
        ],
      },
      {
        label: "Monitorizare",
        title: "Tratamentul urmărește protejarea vederii",
        items: [
          "picături, laser sau chirurgie, în funcție de forma și stadiul bolii",
          "controale la intervalul stabilit de medic, chiar dacă nu simți schimbări",
          "folosirea corectă a tratamentului și discutarea efectelor adverse",
        ],
      },
    ],
    important: {
      title: "Unele simptome necesită evaluare imediată.",
      text: "Durerea oculară intensă, ochiul roșu, vederea brusc încețoșată, halourile și greața pot apărea într-o urgență oculară. Solicită rapid ajutor medical; nu aștepta o programare de rutină.",
    },
    questions: [
      { question: "Glaucomul are întotdeauna presiune mare?", answer: "Nu. Există persoane cu leziuni glaucomatoase la valori care nu par foarte mari, iar altele au presiune crescută fără leziuni. Diagnosticul folosește mai multe informații." },
      { question: "Vederea pierdută revine cu tratament?", answer: "Leziunile existente ale nervului optic nu sunt în mod obișnuit reversibile. Tratamentul urmărește încetinirea sau oprirea progresiei și protejarea vederii rămase." },
      { question: "De ce repet OCT-ul și câmpul vizual?", answer: "Seriile de rezultate îl ajută pe medic să distingă variația testului de o schimbare reală și să evalueze ritmul evoluției." },
    ],
    sources: [SOURCES.glaucoma, SOURCES.glaucomaTests, SOURCES.visualField],
    cta: consultationCta,
    related: ["investigatii/tonometrie", "investigatii/oct", "investigatii/camp-vizual"],
  },
  "ochelari/lentile-progresive": {
    category: "ochelari",
    slug: "lentile-progresive",
    number: "O01",
    shortTitle: "Lentile progresive",
    eyebrow: "Distanță, intermediar și aproape",
    title: "Lentilele progresive: cum funcționează și ce influențează adaptarea?",
    description: "Află cum sunt organizate zonele unei lentile progresive, ce măsurători contează și la ce să te aștepți în perioada de adaptare.",
    accent: "#a97825",
    tint: "#efe2bd",
    intro: "Lentilele progresive oferă puteri diferite pe verticală, pentru distanță, zona intermediară și aproape, fără o linie vizibilă de separare. Câmpurile utile și senzația la purtare depind de design, prescripție, ramă și măsurători.",
    shortAnswer: "O lentilă progresivă bună pentru tine nu se alege doar după dioptrie. Contează activitățile, rama, poziția de purtare, centrarea și reglajul final.",
    sections: [
      {
        label: "Cum privești prin ele",
        title: "Zone diferite pentru distanțe diferite",
        items: [
          "partea superioară este folosită în principal pentru distanță",
          "coridorul central oferă trecerea către intermediar și aproape",
          "zonele laterale pot avea distorsiuni inerente designului progresiv",
        ],
      },
      {
        label: "Ce se măsoară",
        title: "Centrarea se face pe persoană și pe ramă",
        items: [
          "distanța pupilară monoculară și înălțimea de montaj",
          "poziția ramei pe față și stabilitatea ei",
          "distanțele și activitățile dominante din viața de zi cu zi",
        ],
      },
      {
        label: "Adaptare",
        title: "Mișcări noi, învățate treptat",
        items: [
          "întoarce capul către obiectele laterale, nu doar ochii",
          "coboară privirea pentru citit și ridic-o pentru distanță",
          "dacă disconfortul persistă, revino pentru verificarea ramei, măsurătorilor și prescripției",
        ],
      },
    ],
    important: {
      title: "Adaptarea nu trebuie folosită pentru a explica orice problemă.",
      text: "O perioadă de acomodare poate exista, dar neclaritatea persistentă, poziția incomodă a capului sau dezechilibrul merită verificate de optician și, când este cazul, de profesionistul care a stabilit prescripția.",
    },
    questions: [
      { question: "Sunt lentilele progresive potrivite pentru orice ramă?", answer: "Nu orice combinație este ideală. Rama trebuie să ofere spațiu pentru zonele optice și să rămână stabilă; opticianul verifică compatibilitatea cu designul ales." },
      { question: "Cât durează adaptarea?", answer: "Variază de la persoană la persoană și depinde de prescripție, design și experiența anterioară. Dacă dificultățile persistă, nu amâna reverificarea." },
      { question: "Pot lucra mult la două monitoare cu lentile progresive?", answer: "Este posibil, dar zona intermediară a unui progresiv general poate fi mai îngustă decât într-o lentilă ocupațională. Descrie exact distanțele și configurația biroului înainte de alegere." },
    ],
    sources: [SOURCES.presbyopia, SOURCES.eyeglasses],
    cta: opticalCta,
    related: ["vedere/presbiopie", "ochelari/ochelari-pentru-calculator", "consultatii/control-vedere"],
  },
  "ochelari/lentile-de-contact": {
    category: "ochelari",
    slug: "lentile-de-contact",
    number: "O02",
    shortTitle: "Lentile de contact",
    eyebrow: "Adaptare, purtare și igienă",
    title: "Lentilele de contact: ce trebuie verificat înainte de purtare?",
    description: "Ghid despre adaptarea lentilelor de contact, prescripție, igienă și semnele pentru care trebuie să scoți lentilele și să ceri ajutor.",
    accent: "#345bc8",
    tint: "#dce8f2",
    intro: "Lentilele de contact se așază pe cornee și pot corecta erorile de refracție. Nu sunt un produs universal: curbura, diametrul, materialul, puterea și modul de purtare trebuie potrivite ochiului și nevoilor tale.",
    shortAnswer: "Ai nevoie de evaluare, probă și instrucțiuni de utilizare. Prescripția ochelarilor nu este automat aceeași cu prescripția lentilelor de contact.",
    sections: [
      {
        label: "Adaptare",
        title: "Claritatea și sănătatea suprafeței oculare",
        items: [
          "se evaluează corecția, forma corneei și modul în care lentila se așază",
          "se verifică vederea, mișcarea lentilei și confortul după o perioadă de probă",
          "primești instrucțiuni pentru aplicare, scoatere și programul de purtare",
        ],
      },
      {
        label: "Igienă",
        title: "Apa și saliva nu au loc în rutină",
        items: [
          "spală și usucă mâinile înainte de atingerea lentilelor",
          "folosește doar soluția recomandată și nu completa soluția veche din recipient",
          "scoate lentilele înainte de duș, înot sau baie și respectă înlocuirea lor",
        ],
      },
      {
        label: "Purtare sigură",
        title: "Respectă tipul de lentilă",
        items: [
          "nu dormi cu lentile care nu sunt prescrise pentru purtare peste noapte",
          "nu prelungi termenul de înlocuire și nu împrumuta lentilele",
          "păstrează ochelari de rezervă pentru zilele în care ochii au nevoie de pauză",
        ],
      },
    ],
    important: {
      title: "Scoate lentilele dacă apare durere, roșeață sau vedere brusc neclară.",
      text: "Sensibilitatea la lumină, lăcrimarea neobișnuită ori secrețiile necesită și ele atenție. Dacă simptomele persistă sau se agravează, caută rapid evaluare medicală.",
    },
    questions: [
      { question: "Pot cumpăra lentile după rețeta de ochelari?", answer: "Nu este recomandat. Puterea poate diferi, iar lentila are parametri de formă și material care trebuie adaptați și verificați pe ochi." },
      { question: "Pot spăla recipientul cu apă?", answer: "Nu. Apa poate conține microorganisme periculoase pentru ochi. Curățarea și păstrarea se fac cu soluția recomandată și conform instrucțiunilor." },
      { question: "Cât timp pot purta lentilele într-o zi?", answer: "Depinde de lentilă, ochi și recomandarea primită. Nu extinde programul doar pentru că lentila pare confortabilă." },
    ],
    sources: [SOURCES.contactLenses, SOURCES.refractiveErrors],
    cta: opticalCta,
    related: ["vedere/astigmatism", "investigatii/topografie-corneana", "consultatii/control-vedere"],
  },
  "ochelari/reparatii-ochelari": {
    category: "ochelari",
    slug: "reparatii-ochelari",
    number: "O03",
    shortTitle: "Reparații ochelari",
    eyebrow: "Ramă, balamale și reglaj",
    title: "Reparația ochelarilor: ce se poate remedia și când verifici lentilele?",
    description: "Află ce tipuri de reglaje și reparații pot fi făcute la ochelari și când deteriorarea ramei sau a lentilelor cere înlocuire.",
    accent: "#b45f4e",
    tint: "#f0d8d0",
    intro: "Ochelarii pot fi reglați sau reparați în funcție de material, tipul balamalei, zona ruptă și starea lentilelor. O evaluare fizică este de obicei necesară înainte ca optica să confirme soluția.",
    shortAnswer: "Reglajele, șuruburile, plachetele și unele îmbinări pot fi remediate. O ramă fisurată sau deformată sever poate necesita atelier specializat ori înlocuire.",
    sections: [
      {
        label: "Probleme frecvente",
        title: "De la reglaj simplu la intervenție tehnică",
        items: [
          "brațe slăbite, șuruburi lipsă sau plachete uzate",
          "ramă care alunecă, apasă ori stă strâmb",
          "balamale, brațe sau punți rupte care pot necesita piese ori sudură specializată",
        ],
      },
      {
        label: "Ce verifică opticianul",
        title: "Rama și lentilele funcționează împreună",
        items: [
          "materialul și posibilitatea unei reparații stabile",
          "tensiunea asupra lentilelor și riscul de fisurare",
          "poziția finală a ochelarilor și alinierea față de ochi",
        ],
      },
      {
        label: "Până ajungi la optică",
        title: "Evită improvizațiile care agravează ruptura",
        items: [
          "păstrează toate piesele și transportă ochelarii într-o cutie",
          "nu folosi adezivi puternici lângă lentile sau balamale",
          "nu îndoi la rece o ramă fără să cunoști materialul",
        ],
      },
    ],
    important: {
      title: "O reparație trebuie să rămână sigură la purtare.",
      text: "Dacă rama nu mai ține lentila stabil, are margini ascuțite sau se rupe repetat, opticianul poate recomanda înlocuirea chiar dacă o intervenție temporară este posibilă.",
    },
    questions: [
      { question: "Se poate suda orice ramă metalică?", answer: "Nu. Posibilitatea depinde de aliaj, finisaj, locul rupturii și echipamentul atelierului. Evaluarea la fața locului este necesară." },
      { question: "Lentilele vechi pot fi montate într-o ramă nouă?", answer: "Uneori, dar noua ramă trebuie să fie compatibilă ca formă și dimensiune, iar centrarea trebuie să rămână corectă. Opticianul verifică fezabilitatea." },
      { question: "Un reglaj schimbă vederea prin ochelari?", answer: "Poate. Poziția ramei influențează felul în care privești prin lentile, mai ales la prescripții mari sau lentile progresive." },
    ],
    sources: [SOURCES.eyeglasses, SOURCES.eyeDoctor],
    cta: { label: "Caută o reparație de ochelari", to: "/cerere?categorie=reparatii" },
    related: ["ochelari/lentile-progresive", "consultatii/control-vedere", "vedere/astigmatism"],
  },
  "ochelari/ochelari-pentru-calculator": {
    category: "ochelari",
    slug: "ochelari-pentru-calculator",
    number: "O04",
    shortTitle: "Ochelari pentru calculator",
    eyebrow: "Distanța reală de lucru",
    title: "Ochelari pentru calculator: când ajută și ce trebuie măsurat?",
    description: "Află când poate fi utilă o corecție pentru calculator, cum contează distanța de lucru și de ce filtrul de lumină albastră nu rezolvă orice disconfort.",
    accent: "#54745f",
    tint: "#dfe9dc",
    intro: "„Ochelari pentru calculator” poate însemna o corecție optimizată pentru distanța monitorului, o lentilă ocupațională sau doar un tratament de suprafață. Alegerea corectă pornește de la evaluarea vederii și a postului de lucru.",
    shortAnswer: "Măsoară distanța până la ecran și descrie câte monitoare folosești. O corecție pentru birou trebuie adaptată vederii și distanțelor, nu aleasă doar după eticheta „blue light”.",
    sections: [
      {
        label: "Înainte de ochelari",
        title: "Identifică sursa disconfortului",
        items: [
          "dioptrii necorectate sau o corecție veche",
          "clipit redus, uscăciune, reflexii și lumină nepotrivită",
          "poziția monitorului, fontul, distanța și timpul fără pauze",
        ],
      },
      {
        label: "Tipuri de soluții",
        title: "O singură distanță sau mai multe zone",
        items: [
          "lentile monofocale optimizate pentru distanța ecranului",
          "lentile ocupaționale pentru aproape și intermediar",
          "lentile progresive generale, dacă ergonomia și câmpul intermediar sunt potrivite",
        ],
      },
      {
        label: "Ergonomie vizuală",
        title: "Ochelarii nu înlocuiesc pauzele",
        items: [
          "privește periodic la distanță și clipește conștient",
          "reglează ecranul pentru o poziție neutră a capului și gâtului",
          "redu reflexiile și folosește o iluminare confortabilă, fără contrast excesiv",
        ],
      },
    ],
    important: {
      title: "Filtrul de lumină albastră nu este un diagnostic și nici o corecție.",
      text: "Poate modifica transmisia luminii, dar nu înlocuiește dioptria potrivită, evaluarea uscăciunii oculare sau ergonomia. Pentru simptome persistente, caută evaluare.",
    },
    questions: [
      { question: "Am nevoie de altă dioptrie pentru monitor?", answer: "Uneori. Necesitatea depinde de vârstă, presbiopie, distanța monitorului și corecția existentă. Evaluarea trebuie făcută pentru distanța reală de lucru." },
      { question: "Lentilele progresive sunt suficiente pentru birou?", answer: "Pot fi suficiente pentru unii utilizatori, dar zona intermediară poate fi limitată. O lentilă ocupațională poate oferi un câmp mai larg pentru monitor și aproape." },
      { question: "Ochelarii cu filtru albastru opresc oboseala digitală?", answer: "Nu pot rezolva toate cauzele. Pauzele, clipitul, corecția potrivită și ergonomia au un rol important, iar simptomele persistente trebuie evaluate." },
    ],
    sources: [SOURCES.healthyEyes, SOURCES.eyeglasses],
    cta: opticalCta,
    related: ["ochelari/lentile-progresive", "vedere/presbiopie", "consultatii/control-vedere"],
  },
};

export const getTopicGuide = (category, slug) =>
  TOPIC_GUIDES[`${category}/${slug}`] || null;

export const getTopicPath = (guide) =>
  `/ghid/${guide.category}/${guide.slug}`;

export const getTopicGroup = (category) =>
  TOPIC_GROUPS.find((group) => group.key === category) || null;

export const getGuidesByGroup = (category) =>
  Object.values(TOPIC_GUIDES).filter((guide) => guide.category === category);
