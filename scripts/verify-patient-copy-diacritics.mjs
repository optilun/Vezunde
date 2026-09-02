// Textul citit de pacient trebuie sa fie romana scrisa corect.
//
// 2026-09-02. Verificarea vizuala a site-ului a aratat o inconsecventa sistemica: pe acelasi
// card, chenarul "Profil nerevendicat / Informatii din surse publice" era scris cu diacritice,
// iar chiar deasupra lui "Potrivire cu informatii limitate / Optiunea este relevanta" nu era.
// Cauza: regula de proiect "fara diacritice" se aplica COMENTARIILOR si codului, dar se
// scursese si in stringurile vizibile - mai ales in cele generate in stratul de potrivire
// (shared/providerDecisionConfidence.js, matchProvidersSemantic/entry.ts), unde autorul
// gandeste "backend" si scrie ca in cod. Cel mai grav caz era ecranul de urgenta, integral
// fara diacritice: textul cu miza cea mai mare din toata aplicatia.
//
// Verificarea de mai jos nu poate judeca gramatica; urmareste doar un set de cuvinte care in
// romana poarta intotdeauna diacritice si care apar frecvent in copy-ul nostru.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Suprafetele pe care le vede cineva care nu e din echipa: pacient sau furnizor public.
// Ecranele de administrare nu sunt incluse deliberat - au alt public si alt ritm de lucru.
const PATIENT_SURFACES = [
  'src/components/intake2',
  'src/components/results',
  'src/components/home',
  'src/components/specialists',
  'src/components/notifications',
  'shared/patientGuidanceQuestionCatalog.js',
  'shared/patientEmergencyGuidance.js',
  'shared/providerDecisionConfidence.js',
  'shared/providerRecommendation.js',
  // 2026-09-02: etichetele semnalelor de siguranta se afiseaza pe ecranul de urgenta,
  // dar traiau in src/lib si scapasera primei treceri - "Substanta chimica ajunsa in ochi"
  // aparea fara diacritice sub un titlu care le avea.
  'src/lib/patientSafety.js',
];

// Cuvinte care nu exista in romana fara diacritice. Nu includem forme ambigue
// ("sa"/"să", "ca"/"că", "cat"/"cât"), unde numai contextul decide.
const REQUIRE_DIACRITICS = [
  'informatii', 'informatiile', 'informatie',
  'optiune', 'optiunea', 'optiuni', 'optiunile',
  'locatia', 'locatie', 'locatii', 'locatiei', 'locatiile', 'locatiilor',
  'situatia', 'situatie', 'situatii', 'situatiile',
  'organizatia', 'organizatie', 'organizatii',
  'sustinuta', 'sustinut', 'sustin',
  'selectata', 'aleasa', 'relevanta', 'confirmata', 'potrivita', 'apropiata',
  'exista', 'existanta',
  'disparut', 'aparut', 'aparute', 'patruns',
  'greata', 'roseata', 'durere oculara',
  'opreste', 'stabileste', 'foloseste', 'gaseste', 'gasesti', 'gasit',
  'astepta', 'astepti',
  'agraveaza', 'indeparteaza', 'clateste',
  'substanta', 'urgenta', 'urgente oftalmologice',
  'nationala', 'national', 'judetul', 'judet',
  'cautare', 'cautarea', 'cauti',
  'intrebare', 'intrebari', 'intrebarile', 'intrebam',
  'inteles', 'intamplat', 'inainte', 'inapoi',
  'raspuns', 'raspunsuri', 'recomandari',
  'sanatate', 'urmatoarea', 'urmatoarele',
  'garda', 'platforma nu', 'informational',
  'persoana care', 'profesionala', 'actualizari',
  'actualizata', 'inca nivelul', 'aceasta cerere', 'aceasta optiune', 'publica separata',
  'analiza', 'aprobata', 'noua analiza', 'necesita', 'propuna',
  'afisat', 'afisata', 'inchisa', 'gresite', 'gresit',
];

// Regiuni exceptate explicit in cod, cu motiv scris acolo. O linie care contine
// "copy-diacritics: exempt" opreste verificarea pana la "copy-diacritics: end".
// Folosit pentru sabloanele de detectie, care se compara cu text normalizat (fara
// diacritice) si deci TREBUIE sa ramana fara.
const EXEMPT_START = 'copy-diacritics: exempt';
const EXEMPT_END = 'copy-diacritics: end';

// Exceptii reale, cu motiv. Fiecare intrare trebuie sa ramana justificabila.
const ALLOWED = [
  // Cuvinte-cheie de cautare si aliasuri: se compara cu text normalizat (fara diacritice),
  // deci trebuie sa ramana fara.
  /search_keywords/,
  /legacy_keys/,
  /aliases/,
  // Chei si valori de contract, nu text citit.
  /_key|_code|contract_version|question_key|answer_value|service_keys/,
];

function collectFiles(target) {
  const out = [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(js|jsx|ts)$/.test(target)) out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    out.push(...collectFiles(path.join(target, entry.name)));
  }
  return out;
}

const findings = [];
for (const surface of PATIENT_SURFACES) {
  for (const file of collectFiles(surface)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let exempt = false;
    lines.forEach((line, index) => {
      if (line.includes(EXEMPT_START)) { exempt = true; return; }
      if (line.includes(EXEMPT_END)) { exempt = false; return; }
      if (exempt) return;
      // Comentariile raman fara diacritice, prin conventia proiectului.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (ALLOWED.some((pattern) => pattern.test(line))) return;
      const literals = line.match(/'[^']{10,}'|"[^"]{10,}"|`[^`]{10,}`/g) || [];
      for (const literal of literals) {
        if (!/\s/.test(literal)) continue;
        if (/[ăâîșțĂÂÎȘȚ]/.test(literal)) continue;
        const lower = literal.toLowerCase();
        const missing = REQUIRE_DIACRITICS.filter((word) => new RegExp(`\\b${word}\\b`).test(lower));
        if (missing.length === 0) continue;
        findings.push(`${file}:${index + 1}  ${missing[0]}  ->  ${literal.slice(0, 90)}`);
      }
    });
  }
}

assert.deepEqual(
  findings,
  [],
  `Text vizibil pacientului scris fara diacritice:\n  ${findings.join('\n  ')}\n`
  + '\nRegula "fara diacritice" se aplica doar comentariilor si codului. Ce citeste pacientul\n'
  + 'trebuie sa fie romana scrisa corect, oriunde ar fi generat - inclusiv in stratul de potrivire.',
);

console.log(`Patient copy diacritics verified across ${PATIENT_SURFACES.length} surfaces.`);
