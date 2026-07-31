# VIASEE Directory — orchestrator automat controlat

## Scop

Orchestratorul elimina repetarea manuala a fluxului snapshot → validare → dry-run → aprobare → executie, fara sa ocoleasca protectiile existente.

## Model operational

1. Administratorul incarca direct arhiva privata ZIP sau, alternativ, introduce un manifest JSON ori URL-uri JSON de lot.
2. Pentru ZIP, sistemul deschide arhiva in backend, citeste manifestul, verifica SHA-256 si pastreaza numai subsetul aprobat in entitati administrative protejate. Registrul nu trebuie publicat online.
3. Inainte de aprobare, sistemul analizeaza toate loturile, aplica filtrul strict si afiseaza exact cate randuri sunt eligibile si cate sunt excluse.
4. Amprenta aprobata include SHA-ul fiecarei surse si SHA-ul subsetului selectat; sistemul cere o singura confirmare exacta `AUTOIMPORT ...`.
5. Dupa publicarea versiunii, automatizarea Base44 ruleaza la fiecare 5 minute si este limitata la maximum 400 de executii pentru campania curenta.
6. La fiecare executie se avanseaza un singur pas durabil:
   - descarcare si verificare SHA-256;
   - completare si verificare a geografiei din `GeographicLocality` dupa codul SIRUTA: cod judet, UAT si denumire UAT;
   - filtrare determinista: numai candidate, confirmate oficial, active, fara `review_flags`, cu geografie valida si cu toate campurile canonice complete;
   - creare snapshot numai din randurile strict curate;
   - incarcare randuri;
   - validare;
   - dry-run;
   - inspectie fail-closed;
   - aprobare interna a lotului autorizata prin aprobarea unica;
   - executie a maximum 5 randuri;
   - verificare finala.
7. La rate limit sau citire temporar esuata, rularea ramane reluabila si foloseste mecanismul existent de reconciliere.

## Conditii obligatorii pentru executie automata

- maximum 40 de randuri per fisier;
- randurile necurate sunt excluse si raportate, nu importate;
- codul SIRUTA trebuie sa existe activ in `GeographicLocality`, iar judetul sursei trebuie sa coincida cu judetul canonic;
- snapshot `ready` si imuabil;
- toate randurile valide;
- zero randuri blocate;
- zero duplicate;
- zero avertismente;
- numai actiunile:
  - `create_organization_and_location`;
  - `create_location_use_existing_organization`;
- nicio locatie existenta tinta;
- nicio corectie administrativa pe rand;
- reutilizarea unei organizatii existente este permisa numai cand `directory_external_key` coincide exact;
- organizatiile planificate in acelasi lot pot fi reutilizate prin `reuse_planned_organization`.

## Protectii pastrate

Orchestratorul nu:

- publica profile;
- verifica profile;
- creeaza `LocationService`;
- acorda acces;
- actualizeaza profile controlate;
- importa randuri cu conflicte;
- continua dupa un rezultat neasteptat.

## Persistenta

- `DirectoryAutoImportRun` pastreaza aprobarea, progresul, blocarea si totalurile.
- `DirectoryAutoImportItem` pastreaza starea fiecarui lot, snapshotul, batch-ul, tokenul de executie, SHA-urile si subsetul de randuri aprobat.
- Automatizarea foloseste functia fizica existenta `listProviderMemberInvitations`, astfel incat numarul de functii backend nu creste.

## Oprire si reluare

Administratorul poate:

- pune rularea pe pauza;
- relua rularea;
- anula rularea;
- executa manual un singur pas pentru testare.

Orice lot blocat opreste intreaga rulare pentru inspectie administrativa.

## Campania nationala de director

Modul `national_directory` primeste registrul master JSON sau arhiva ZIP privata si proceseaza intregul registru fara aprobari pe fiecare lot.

Sunt eligibile automat numai locatiile care:

- reprezinta un punct fizic, nu un rezumat de retea;
- au nume, localitate, adresa, sursa si geografie canonica;
- sunt confirmate active;
- au sursa `official_confirmed` sau `official_partial`;
- nu sunt marcate `not_eligible` sau `blocked_conflict`;
- au clasificare location-first explicita ori inferabila determinist.

Inainte de lotizare, sistemul:

- deduplica registrul national;
- exclude locatiile live controlate (`claimed`, `verified`, `suspended`);
- exclude potrivirile live ambigue;
- reutilizeaza organizatiile existente numai prin cheie externa exacta, nume unic sau domeniu oficial unic;
- exclude organizatiile existente fara cheie externa in loc sa creeze duplicate.

Dupa executia fiecarui lot, locatiile sunt publicate automat ca profiluri de director neconfirmate:

- `profile_control_status = directory`;
- `verification_state = unclaimed`;
- `is_verified = false`;
- `request_intake_status = inactive`;
- fara servicii create automat;
- fara acces acordat furnizorilor;
- excluse din Top 3 si din eligibilitatea de matching.

Detaliile de baza sunt expuse numai pentru calitate `high` sau `medium`. Randurile cu calitate scazuta pot ramane profiluri `summary`, fara a prezenta datele drept confirmate.

Publicarea este jurnalizata ca mutatie a lotului si poate fi retrasa prin acelasi mecanism de rollback.

## Consum operational

Base44 contabilizeaza fiecare executie programata separat. Configuratia ramane limitata la 400 de executii. In cadrul unei executii sunt compactati pana la opt pasi pregatitori, dar se executa cel mult un fragment de import de cinci locatii, pentru a reduce consumul fara a creste riscul de rate limit.
