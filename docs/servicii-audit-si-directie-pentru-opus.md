# Modulul Servicii — stadiu si directie (pentru Opus)

Data: 2026-08-06. Scris de Claude Sonnet dupa o sesiune lunga de reproiectare
vizuala a tabului Servicii din workspace-ul furnizorului. Alex vrea sa continue
cu Opus pentru urmatorul pas de design. Acest document e rezumatul complet.

## Decizie deja luata: pagina separata, NU suprapunere

Am discutat cu Alex daca Servicii ar trebui sa se deschida ca panou suprapus
(stil Setari Claude Desktop, cu X in colt) sau ca pagina separata (cum e acum).

**Decizie: ramane pagina separata.** Motiv: configurarea are 8 sectiuni si zeci
de servicii, e o sesiune de lucru de minute, nu un reglaj rapid de comutator.
O suprapunere fara URL propriu si fara "inapoi" real din browser ar fi o
capcana pentru o sesiune atat de lunga.

**Ce ramane valabil din Setarile Claude**: aspectul continutului — randuri
simple fara chenar, comutatoare, spatiere generoasa, text asezat pe doua
niveluri (titlu + explicatie). Asta s-a implementat partial azi (vezi mai jos).

## Arhitectura reala (important, verificat in cod)

Tabul Servicii NU e o componenta simpla. E un invelis (`ProviderServicesThreeColumn.jsx`)
care controleaza vizual o componenta operationala mult mai mare
(`ProviderServicesWorkspaceOperational.jsx`, ~1700 linii) prin manipulare DOM:
`MutationObserver`, atribute `data-*`, cautare de elemente dupa continutul lor.

Nu e arhitectura ideala, dar e cea reala, si a fost facuta progresiv mai sigura
azi (vezi "Ce s-a reparat" mai jos). Orice schimbare viitoare de fond ar trebui
sa ia in calcul acest cuplaj.

Fisiere principale:
- `src/components/workspace/provider/ProviderServicesThreeColumn.jsx` — invelisul,
  navigarea, ecranul-lista de pe telefon, antetul, coloana de pasi
- `src/components/workspace/provider/ProviderServicesThreeColumn.css` — cel mai
  mare fisier de stil (~2900 linii)
- `src/components/workspace/provider/ProviderServicesRefinement.css` — rafinari
  suplimentare, praguri de ecran
- `src/components/workspace/provider/ProviderServicesSidebars.css` — praguri mici
- `src/components/workspace/provider/ProviderServicesWorkspaceOperational.jsx` —
  logica reala: randare servicii, salvare, validare (NEATINSA structural azi,
  doar clase vizuale schimbate)

## Decizie de arhitectura ramasa DESCHISA — Opus trebuie s-o discute cu Alex

Alex a intrebat explicit: cand apesi "Servicii", ar trebui sa se deschida ca
panou SUPRAPUS peste ecranul curent (exact ca in Claude Desktop cand apesi
Settings sau Connectors — panou alb, X in colt, restul ecranului intunecat
in spate), sau sa ramana pagina separata cum e acum?

**Raspunsul meu initial a fost "ramane pagina separata"**, motivat de volumul
de continut (8 sectiuni). Alex a corectat: pozele trimise nu erau doar despre
stilul randurilor, erau explicit despre FEREASTRA insasi — cum arata panoul
suprapus la Claude. Asta inseamna ca decizia mea a fost prea rapida si NU
trebuie tratata ca finala.

**Ce trebuie clarificat cu Alex, inainte de orice implementare:**
- Vrea panou suprapus chiar si pentru un continut de 8 sectiuni / zeci de
  servicii? (Posibil raspunsul e da, cu propria navigare interna in panou,
  nu doar un formular scurt)
- Sau vrea DOAR stilul vizual al panoului (alb, umbra, X in colt) aplicat
  peste actuala pagina separata, fara sa schimbe navigarea?
- Sau vrea suprapunere pentru module mici (Program, Fotografie) si pagina
  separata doar pentru Servicii, care e genuinely mare?

Nu presupune raspunsul — intreaba explicit, cu exemple concrete, inainte de
a alege o directie.

## Referinta vizuala directa (pozele lui Alex din Setarile Claude Desktop)

Aceleasi 4 poze arata SI fereastra (sectiunea de mai sus), SI stilul randurilor.
Din unghiul de stil al randurilor, trei elemente:

1. **Randul cu doua niveluri de text** — titlu normal (nu bold) + propozitie
   gri dedesubt, care explica ce face optiunea ("Search and reference chats" /
   "Allow Claude to search for relevant details in past chats. Learn more").
   ASTA e diferenta cea mai mare ramasa, si tine strict de continut (vezi
   sectiunea "Ce NU s-a facut" mai jos) — fara descrieri in catalog, orice
   ajustare de stil nu poate reproduce acest efect.
2. Comutatoare albastre/negre, rotunde, la dreapta randului — DEJA implementat.
3. Randuri fara chenar, spatiu generos, fara fundal pe randul activ — DEJA
   implementat (a necesitat reparatii CSS in 3 fisiere diferite).

Daca Opus vrea sa vada exact referinta, cere-i lui Alex sa retrimita cele 4
poze din acest schimb — arata Setari > Privacy, Setari > Capabilities si
Setari > Account din Claude Desktop.

## Ce s-a facut azi, in ordine

1. **Pasi adevarati pe telefon** — in loc de 3 sectiuni afisate simultan, un
   sub-pas la randul (`configStep`), cu buton Inapoi/Continua
2. **Coloana dreapta simplificata** — eliminata lista de zone duplicata
3. **Ecran-lista pe telefon** ("acasa" cu drill-down) — inlocuieste dropdown-ul
   de navigare, care se stricase o data (position:fixed intr-un parinte cu
   transform)
4. **Antet de stare** (stil Uber/Revolut) — spune explicit daca profilul
   apare la cautari, cu prag clar: minim 1 serviciu APROBAT
5. **Servicii in afara locatiei, separate** — 5 optiuni noi in loc de 2 vechi
   combinate (domiciliu / sediul firmei / HG 1028 decontare ochelari /
   optica mobila / screening scoli). Munca grea aici: cele 2 chei vechi
   (`cas_reimbursed_services`, `onsite_eye_testing_b2b`) erau referite in
   12 fisiere, inclusiv 4 "sharedDependencies.js" (bundle-uri pre-compilate
   care NU se regenereaza automat din sursa — necesita patch manual identic
   cu sursa, verificat separat)
6. **Camp CAS per serviciu** — comutator "Decontat prin CAS" pe fiecare
   serviciu medical (nu pe rame/reparatii). Bug critic gasit si reparat:
   campul era eliminat tacit in 4 puncte diferite pe drumul spre salvare
   (lista de campuri permise pe server, validator servicii, validator
   aprobare, apel frontend) — deci nu se salva NICIODATA pana a fost reparat
7. **Aprobare partiala** — daca aplicarea esueaza la jumatate, cererea ramane
   acum reluabila (idempotenta confirmata: verifica existenta inainte de
   creare), cu nota explicita pentru admin, nu mai ramane blocata tacit
8. **Desktop: doua coloane in loc de trei** — coloana dreapta (rezumat)
   eliminata, repeta informatie deja vizibila; ce era unic (tip activitate,
   stare, observatii) mutat pe un rand in capul continutului
9. **Servicii ca randuri, nu carduri, pe desktop** — comutator la dreapta
   in loc de bifa patrata, fara fundal colorat pe randul selectat (bug gasit:
   3 reguli CSS separate puneau fundal pe randul activ, contrar modelului
   Setari)
10. **Sidebar sistematizat** — doua grupuri cu eticheta ("Structura locatiei"
    vs "Oferta pe zone"), cele 3 subsectiuni de configurare devin randuri
    proprii in loc de ascunse intr-unul singur. Bug gasit si reparat: 2 din
    3 randuri (Dotari, Tipul activitatii) se randeaza CONDITIONAT in
    componenta reala (returneaza `null` daca n-au continut) — sidebar-ul
    trebuia sa stie asta, altfel aparea un rand care nu deschidea nimic

## Ce NU s-a facut (limita reala, nu alegere)

**Descrierile pe servicii.** Verificat: 0 din 146 de servicii din catalog au
camp de descriere. In Setarile Claude, fiecare rand are titlu + propozitie de
explicatie dedesubt — asta e diferenta vizuala cea mai mare ramasa fata de
poza de referinta. Fara descrieri, orice ajustare de spatiere/stil nu poate
face un rand de forma "Ochelari de vedere" sa arate ca "Search and reference
chats / Allow Claude to search for relevant details in past chats."

**Aceasta e o decizie de continut, nu de cod** — cineva trebuie sa scrie
~146 propozitii scurte, care explica ce inseamna fiecare serviciu pentru un
optician. Nu poate fi inventat de AI fara sa riste enunturi gresite despre
ce presupune un serviciu medical.

## Verificare tehnica standard, de respectat

- `git hash-object` pe `shared/providerRecommendation.js` si `matchProviders/entry.ts`
  trebuie sa ramana identic — orice atingere a rankingului necesita aprobare
  explicita a lui Alex, verificata separat de `verify-patient-conversation-marketplace-isolation.mjs`
- Bundle-urile `sharedDependencies.js` (4 functii: browseDirectoryProviders,
  getPublicProviderProfile, matchProviders, matchProvidersSemantic) NU se
  regenereaza automat — orice schimbare in `shared/canonicalServiceRegistryExtended.js`
  sau `shared/serviceOperationalTaxonomyExtended.js` trebuie propagata manual acolo
- `shared/*.js` si `base44/shared/*.js` sunt COPII care trebuie sincronizate
  manual (`cp` dupa fiecare editare)
- Bateria de teste: `for f in scripts/verify-*.mjs; do node "$f"; done` —
  baseline curent 116/118 (2 non-actionabile, cunoscute)

## Recomandare pentru Opus

Cel mai valoros lucru de facut acum: **decide impreuna cu Alex un plan pentru
descrierile de servicii** — fie generate cu revizuire umana obligatorie
serviciu-cu-serviciu, fie scrise manual pe grupuri mici (incepe cu "Magazin
optic", 8 servicii, sa se vada rezultatul inainte de restul de 138).

Al doilea lucru cu valoare reala: privire de ansamblu asupra arhitecturii
invelis-peste-componenta (punctul 2 de mai sus) — daca merita, la un moment
dat, o refactorizare reala in loc de patch-uri succesive prin `data-*`.
