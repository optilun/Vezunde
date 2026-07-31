# VIASEE Directory — orchestrator automat controlat

## Scop

Orchestratorul elimina repetarea manuala a fluxului snapshot → validare → dry-run → aprobare → executie, fara sa ocoleasca protectiile existente.

## Model operational

1. Administratorul introduce un manifest JSON sau URL-uri JSON de lot.
2. Sistemul calculeaza amprenta pachetului si cere o singura confirmare exacta `AUTOIMPORT ...`.
3. Dupa publicarea versiunii, automatizarea Base44 ruleaza la fiecare 5 minute si este limitata la maximum 400 de executii pentru campania curenta.
4. La fiecare executie se avanseaza un singur pas durabil:
   - descarcare si verificare SHA-256;
   - filtrare determinista: numai candidate, confirmate oficial, active, fara `review_flags` si cu toate campurile canonice complete;
   - creare snapshot numai din randurile strict curate;
   - incarcare randuri;
   - validare;
   - dry-run;
   - inspectie fail-closed;
   - aprobare interna a lotului autorizata prin aprobarea unica;
   - executie a maximum 5 randuri;
   - verificare finala.
5. La rate limit sau citire temporar esuata, rularea ramane reluabila si foloseste mecanismul existent de reconciliere.

## Conditii obligatorii pentru executie automata

- maximum 40 de randuri per fisier;
- randurile necurate sunt excluse si raportate, nu importate;
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
- `DirectoryAutoImportItem` pastreaza starea fiecarui lot, snapshotul, batch-ul, tokenul de executie si rezultatul.
- Automatizarea foloseste functia fizica existenta `listProviderMemberInvitations`, astfel incat numarul de functii backend nu creste.

## Oprire si reluare

Administratorul poate:

- pune rularea pe pauza;
- relua rularea;
- anula rularea;
- executa manual un singur pas pentru testare.

Orice lot blocat opreste intreaga rulare pentru inspectie administrativa.

## Consum operational

Base44 contabilizeaza fiecare executie a automatizarii ca o rulare separata. Configuratia este limitata la 400 de executii, astfel incat procesul sa nu ramana activ la nesfarsit. Pentru pachetul national de 23 de loturi, bugetul acopera pasii de pregatire, executia in grupuri de 5 si o rezerva pentru reluari temporare.
