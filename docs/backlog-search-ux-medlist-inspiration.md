Status: BACKLOG NEIMPLEMENTAT — idei de urmarit, nu sarcini confirmate.
Data: 2026-08-06

# Idei pentru /cauta, inspirate din analiza medlist.ro

Alex a cerut research pe medlist.ro (motor de cautare medicala general, RO).
Patru idei relevante, aliniate cu ce exista deja construit in VIASEE — nu necesita
schimbari de arhitectura sau de matching, doar UI aditiv.

## 1. Comutator "Medici/Specialisti" vs "Clinici" in caseta de cautare
VIASEE are deja aceasta distinctie in date (`Professional` vs `ProviderLocation`),
doar ca nu e expusa ca alegere directa in cautare. Ar fi o adaugare naturala.

## 2. "Competente populare" ca linkuri rapide, clickabile
Nu specialitati generice, ci proceduri specifice (ex: OCT, topografie corneana).
Catalogul canonic de servicii are deja aceasta granularitate — doar nu e "la suprafata"
pe pagina de cautare. Medlist le arata ca chip-uri clickabile chiar pe homepage/cautare.

## 3. Orase populare, ca linkuri rapide
Un rand simplu de orase mari, clickabile direct, fara sa treci prin tot fluxul de
selectie a localitatii.

## 4. Explicatie in 4 pasi, cu iconite, sub hero sau pe pagina de cautare
Genul "Cauta -> Compara -> Contacteaza -> ...". Simplu modul vizual de incredere.

## Ce am decis deliberat sa NU copiem
Medlist e construit in jurul recenziilor si programarilor online (pasii 5-6 din
roadmap-ul VIASEE, lasati deliberat pentru mai tarziu). Documentul de produs spune
explicit "nu copiem Booking, eMAG" -- Medlist e mai aproape de acel model. Nu se
imprumuta acest aspect doar pentru ca exista la altii.

## Observatie laterala
Medlist are printre clientii afisati Terra Optic (mai multe orase) si Vista Vision --
nume care apar si in datele VIASEE. Suprapunere reala de piata, posibil utila ca sursa
de verificare incrucisata a datelor, separat de acest backlog.

---
Cand se implementeaza: la cerere explicita, sau cand Claude considera ca momentul e
potrivit si semnaleaza asta explicit lui Alex (vezi instructiunea din memoria Claude).
