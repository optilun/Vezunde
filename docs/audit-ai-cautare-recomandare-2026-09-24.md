# Audit modul AI: identificarea nevoii, chestionar, cautare si recomandare

Data: 2026-09-24
Cerere: owner (imbunatatirea LLM-ului si a fluxului de cautare/recomandare; audit, apoi
imbunatatiri pentru raspuns, identificarea nevoii si chestionar).
Status: implementat in sandbox. Backend-ul se sincronizeaza automat; frontend-ul cere publicare.

## 1. Metoda

- Citirea codului care ruleaza efectiv pentru pacient: `ConversationalCard.jsx`,
  `intentRegistry.js`, `providerSemanticSearch.js`, `patientIntentConfirmation.js`,
  `matchProvidersSemantic/entry.ts` (ramurile `interpret_only`, `question_only`, potrivire),
  planificatorul PR #265, catalogul de intrebari, politica de siguranta.
- Analitice de productie (ultimele 60 de zile, API-ul Base44 Analytics).
- Corpus de 68 de formulari realiste (fara date de pacient) rulat prin straturile
  deterministe (intentie, cautare semantica, siguranta).
- Simularea chestionarului complet cu functiile reale din `entry.ts` (ramura
  `question_only`, extrasa textual) si planificatorul real, pentru fiecare intrare in flux.
- Nu s-a apelat LLM-ul live: sandbox-ul nu are acces la functiile publicate si nu s-au
  consumat credite. Promptul nou nu are inca dovezi pe model real (vezi 6).

## 2. Cum functioneaza fluxul

```text
text liber (prima pagina)            link /cerere?categorie=X        card in chestionar
        |                                     |                              |
detectie determinista + LLM (interpret_only)  |                              |
        |                                     |                              |
confirmare pacient ------------------------> chestionar (planificator PR #265, determinist)
                                              |
                                        verificare cerere
                                              |
                                  potrivire determinista (matchProvidersSemantic)
                                              |
                                 Top 3 / rezultate / fallback structural
```

LLM-ul doar propune intentia, serviciile si cateva indicii. Intrebarile, potrivirea, scorul
si Top 3 sunt calculate de cod. Aceasta limita nu a fost schimbata.

## 3. Constatari

### CRITIC

**C1. Intentia confirmata nu ajungea la planificatorul de intrebari.**
Serverul afla intentia doar din raspunsul controlat `categorie`
(`controlledCategoryIntent`), care exista numai cand pacientul alegea un card in interiorul
chestionarului. Pe toate celelalte intrari - textul liber confirmat dupa interpretarea AI si
cele 25 de linkuri `/cerere?categorie=...` din site (prima pagina, ghiduri, pagini de
specialist) - planificatorul primea `unknown` si intreba "Ce te aduce la noi? Un control /
O problema aparuta recent / Nu sunt sigur". Exemple verificate prin simulare:
- butonul "Reparatie ochelari" -> intrebarea control/problema, fara nicio varianta potrivita;
- "am nevoie de ochelari noi" confirmat ca Ochelari -> raspunsul "Un control" rescria
  nevoia in control de vedere;
- reparatii: intrebarea "Ce s-a intamplat?" nu se mai punea, iar cererea pleca cu servicii
  generice.

**C2. Bundle-ul backend era desincronizat de surse.**
`matchProvidersSemantic/sharedDependencies.js` (si bundle-urile din `matchProviders`,
`browseDirectoryProviders`, `getPublicProviderProfile`) nu contin modificarile din
2026-08-08..09-03 la `shared/patientNeedInterpretation.js` si `shared/serviceSemanticSearch.js`.
Promptul LLM live folosea etichete vechi pentru raspunsuri, iar sinonimele adaugate pe
2026-09-03 (ochi rosu, urcior, puncte negre, OCT, "ma usuca ochii", permis auto) nu exista
pe server - scorul semantic server-side este 0 pentru ele. Testele treceau pentru ca verifica
sursele, nu bundle-ul.

### MARE

**M1.** 5 din 21 de interpretari AI reusite (24%) ajungeau la "alegere manuala" desi
increderea era `high` si intentia coincidea cu detectia determinista: modelul cerea
clarificare pentru detalii (varsta copilului) pe care chestionarul le intreaba oricum.
Pacientul vedea "Mai avem nevoie de o clarificare" fara sa afle ce, iar butonul
"Aleg categoria" continua de fapt cu intentia AI.

**M2.** Promptul LLM nu definea intentiile (modelul vedea doar chei precum `investigatii`),
nu avea exemple, nu explica `clarification_required` si nu avea reguli de extragere pentru
pentru cine / varsta / termen / localitate. `for_whom` nu avea "altcineva" (parinte).

**M3.** Indiciile extrase de AI (pentru cine, varsta, termen, localitate) erau aruncate:
pacientul era intrebat din nou ce spusese deja.

**M4.** Detectia determinista (ipoteza trimisa modelului si singura detectie cand modelul
nu raspunde) recunostea 29 din 68 de formulari (43%). Prima potrivire castiga in ordinea
obiectului: "ma dor ochii si nu vad bine" si "m-am lovit la ochi si nu mai vad bine" ->
control de rutina; "lentile de contact, port ochelari" -> ochelari; "ochelari de soare cu
dioptrii" -> control. Niciuna dintre urgentele din corpus nu primea intentie.

**M5.** Ramura "Nu sunt sigur - ajuta-ma sa aleg": planificatorul intreba doar
control/problema si localitatea. Cine raspundea "Nu sunt sigur" trimitea cererea dupa doua
intrebari, cu servicii generice, fara sa-si fi descris nevoia.

### MEDIU

- Prefill-uri lipsa: "s-a rupt rama", "surub", "camp vizual", "tonometrie", "port lentile de
  contact". Exemplu: o trimitere pentru camp vizual pleca cu `service_keys: []`.
- Simptome: pacientul care scrisese deja problema primea iar un camp gol "Spune-ne pe scurt".
- Localitatea din text nu precompleta cautarea localitatii.
- Cand modelul nu raspundea, intentia ghicita din cuvinte cheie se aplica tacit, fara
  confirmare si fara sa ajunga la server.

### Observatii fara modificare in aceasta sesiune

- **Zgomot in cheile de servicii la potrivire (necesita aprobare).** Textul liber trece prin
  cautarea semantica si cheile rezultate se adauga la cerere. "mi s-a rupt bratul la ochelari"
  produce `accessories, prescription_lenses, safety_glasses, sunglasses`, deci o optica ce vinde
  ochelari de soare poate aparea "potrivita" pentru o reparatie. Corectia atinge potrivirea
  (fisiere cu blob aprobat) si trebuie aprobata explicit.
- **Acoperirea datelor.** 25 din 26 de cautari finalizate au `coverage_status =
  local_service_data_missing`: rezultatele vin aproape integral din fallback-ul structural.
  Calitatea recomandarii este limitata de profilurile revendicate cu servicii declarate, nu de AI.
- **Siguranta.** Stratul determinist a prins 8 din 9 urgente din corpus. Varianta ratata:
  "dupa operatia de cataracta ochiul e rosu si ma doare" (ordine diferita a cuvintelor).
  Chestionarul de simptome o acopera prin intrebarea de siguranta, dar extinderea frazelor cere
  revizuire medicala (politica proiectului), deci nu s-a modificat.
- Trei verificari rosii preexistente, nelegate de modulul AI: `verify-dead-code-cleanup`,
  `verify-directory-auto-import` (`_noop_invalid`), `verify-seo-profiles`.

## 4. Ce s-a implementat

| Fisier | Schimbare |
| --- | --- |
| `shared/patientNeedInterpretation.js` + copia identica din `base44/shared/` | Interpretare v2 (`patient-need-ai-v2`): definitii pentru fiecare intentie, precedenta (simptom > investigatie > reparatie > lentile de contact > copil > ochelari > control), clarificare restransa la ambiguitatea reala de intentie, reguli de extragere, 7 exemple cu chei canonice, `alternative_intent`, `for_whom: other_adult`, maximum 6 servicii, localitatea si frazele-dovada pastrate doar daca apar in text. |
| `base44/functions/matchProvidersSemantic/entry.ts` | Interpretarea se importa din `base44/shared/patientNeedInterpretation.js` (nu din bundle-ul vechi) si primeste textul pentru verificare. Bundle-ul, potrivirea, scorul si Top 3 raman neatinse (amprenta `f33a9859` neschimbata). |
| `src/lib/intentRegistry.js` | Detectie cu precedenta si potrivire pe cuvant intreg cu cel mult 2 cuvinte intre termeni; prefill-uri noi (reparatii, investigatii, lentile de contact, ochelari); indicii din mesaj (pentru cine, varsta copilului, termen, debutul simptomului, reteta, localitate); etichete de afisare cu diacritice. `INTENTS[...].label` ramane neschimbat (este salvat in cereri). |
| `src/lib/patientIntentConfirmation.js` | Confirmare v2: increderea `high` nu mai e anulata de clarificare; alternativa si indiciile in propunere; propunere determinista cand modelul nu raspunde. |
| `src/components/intake2/ConversationalCard.jsx` | Orice alegere explicita (link de categorie, "Da, continua", alegere manuala) devine raspuns controlat la `categorie` (corectia C1). Sugestii in intrebari, localitate si descriere precompletate. Ramura "Nu sunt sigur" cere descrierea si o re-interpreteaza. Analitice noi: durata interpretarii, sursa, rata de acceptare a sugestiilor, `intake_flow_version: patient-intake-v2`. |
| `PatientIntentConfirmation.jsx` | Arata ce s-a inteles ("Am retinut din mesaj"); cand nevoia nu e clara, arata direct variantele aprobate cu sugestia marcata. Toata copia este aprobata; modelul nu scrie text pentru pacient. |
| `QuestionChoice.jsx`, `QuestionLocation.jsx`, `QuestionText.jsx` | Sugestie marcata (nu preselectata, niciodata pe intrebarea de siguranta); localitate precompletata; descriere precompletata (nu cand mesajul a declansat deja ecranul de urgenta). |
| `PatientRequestReview.jsx`, `patientRequestDraft.js` | Eticheta nevoii cu diacritice, "Cautam: ..." cu serviciile canonice, eticheta lizibila pentru `categorie`. |
| `scripts/verify-patient-need-identification.mjs` (nou, in `test:services`) | Corpus, precedenta, prefill, indicii, confirmare v2, contract LLM v2 si rutarea categoriilor evaluata cu functiile reale din `entry.ts`. |
| `scripts/verify-patient-conversation-marketplace-isolation.mjs` | Blob nou aprobat pentru `entry.ts`, cu justificare. |

Neschimbate deliberat: `providerSemanticSearch.js`, `sharedDependencies.js`,
`providerRecommendation.js`, scorul, bucket-urile, Top 3, distributia, politica de siguranta,
catalogul de intrebari si matricea de rutare, `questionnaire_version` (backend-ul accepta
doar `patient-questionnaire-v1`).

## 5. Rezultate masurate

| Masura | Inainte | Dupa |
| --- | --- | --- |
| Intentie determinista corecta pe corpus (68) | 29 (43%) | 65 (96%)* |
| Link de categorie -> prima intrebare potrivita | 0 din 6 intentii | 6 din 6 |
| Text liber confirmat -> chestionarul intentiei | nu (planificatorul primea `unknown`) | da |
| Trimitere camp vizual -> servicii in cerere | `[]` | `visual_field_analyzer` |
| Interpretari AI `high` trimise la alegere manuala | 5 din 21 (productie) | 0 prin regula noua; efectul promptului se masoara live |

\* Singurul caz ramas discutabil: "ma doare capul si mi se incetoseaza vederea seara cand
citesc" -> control de vedere (oboseala vizuala, defensabil). "nu stiu unde sa merg" si
"ajutor" raman corect fara intentie.

## 6. Verificari

- `npm run test:services`: trece (inclusiv testul nou).
- `node scripts/verify-all.mjs`: 141 trec, 3 esecuri preexistente nelegate de acest modul.
- ESLint pe fisierele modificate: 0 erori.
- `vite build`: reuseste.
- Nu s-a verificat in browser si nici pe modelul live.

## 7. De facut / de aprobat

1. **Publicare frontend** (manual, din Base44). Backend-ul nou este compatibil si cu
   frontend-ul publicat acum (campurile noi sunt ignorate de el).
2. **Pilot mic pe modelul live** pentru promptul v2 (5-10 formulari din corpus), urmarind in
   analitice `patient_search_ai_interpretation_resolved` (`outcome`, `duration_ms`) si
   `patient_search_answer_suggestion_resolved` (`accepted`).
3. **Aprobare explicita** pentru eliminarea zgomotului din cheile de servicii la potrivire.
4. **Re-sincronizarea controlata a bundle-urilor** din surse (schimba scorul semantic
   server-side pentru formularile adaugate pe 2026-09-03), cu aprobare explicita.
5. **Revizuire medicala** pentru variantele de formulare ale semnalelor de siguranta.
6. Scurtarea fluxului de simptome (6 ecrane) dupa ce regula clinica
   `symptom_safety_completion` este validata.

## 8. Coordonare

In timpul sesiunii, un alt agent a scris in acelasi sandbox (cache-ul hartii nationale:
`browseDirectoryProviders`, `PublicMapSnapshot`, `DirectoryMap.jsx`, `RequestMatches.jsx`,
`verify-national-map-cache.mjs`, `verify-results-map.mjs`, `tmp/check-map-live.cjs`). Nu exista
fisiere comune cu aceasta lucrare. Checkpoint-ul Base44 include si modificarile lui.
