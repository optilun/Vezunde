# VIASEE Directory — contract de staging V3

**Data:** 2026-07-19  
**Scop:** organizarea datelor inainte de maparea si importul ulterior in director  
**Status:** contract de lucru; fara import si fara publicare

## 1. Principiul central

Registrul de cercetare nu se importa direct in entitatile publice VIASEE.

Intre cercetare si director trebuie sa existe un strat de staging care separa:

- randul brut primit;
- organizatia candidata;
- locatia fizica candidata;
- legatura dintre organizatie si locatie;
- dovezile per camp;
- conflictele si sarcinile de review;
- decizia finala de import.

## 2. Obiectele de staging

### SourceSnapshot

Identifica versiunea sursei inghetate.

Campuri minime:

- `snapshot_id`;
- `source_name`;
- `source_version`;
- `sha256`;
- `received_at`;
- `row_count_declared`;
- `row_count_parsed`;
- `integrity_status`;
- `notes`.

### RawDirectoryRow

Pastreaza fiecare rand exact asa cum a fost primit, fara interpretare distructiva.

Campuri minime:

- `raw_row_id`;
- `snapshot_id`;
- `source_line_number`;
- cele 18 campuri V2 originale;
- `raw_row_hash`;
- `parse_status`;
- `is_location_candidate`;
- `is_exclusion_record`;
- `is_generic_network_summary`.

### OrganizationCandidate

Reprezinta o identitate organizationala candidata, nu o organizatie publica deja confirmata.

Campuri minime:

- `organization_candidate_id`;
- `canonical_name`;
- `normalized_name`;
- `organization_type_candidate`;
- `official_domain`;
- `legal_identity_if_known`;
- `identity_confidence`;
- `review_status`;
- `possible_parent_organization_id`;
- `notes`.

### LocationCandidate

Reprezinta o locatie fizica sau o unitate functionala concreta.

Campuri minime:

- `location_candidate_id`;
- `organization_candidate_id` optional pana la review;
- `display_name_candidate`;
- `official_locality`;
- `locality_siruta_code`;
- `county_code`;
- `administrative_sector` optional;
- `normalized_address`;
- `unit_discriminator`;
- `location_type_candidate`;
- `operational_status_research`;
- `publication_eligibility`;
- `review_status`;
- `source_snapshot_id`.

### OrganizationLocationLinkCandidate

Legatura organizatie-locatie trebuie verificata separat de existenta locatiei.

Campuri minime:

- `link_candidate_id`;
- `organization_candidate_id`;
- `location_candidate_id`;
- `relationship_type`;
- `confidence_level`;
- `evidence_ids`;
- `conflict_status`;
- `reviewed_by`;
- `reviewed_at`.

### EvidenceCandidate

Dovada trebuie pastrata per camp important, nu doar per rand.

Campuri minime:

- `evidence_candidate_id`;
- `entity_candidate_type`;
- `entity_candidate_id`;
- `field_key`;
- `observed_value`;
- `source_url`;
- `source_type`;
- `checked_at`;
- `confidence_level`;
- `is_primary_source`;
- `conflicts_with_evidence_id` optional.

### DirectoryReviewTask

Orice blocaj trebuie sa devina o sarcina urmaribila.

Tipuri initiale:

- `identity_conflict`;
- `address_conflict`;
- `phone_conflict`;
- `locality_conflict`;
- `organization_link_conflict`;
- `same_address_distinct_unit`;
- `possible_duplicate`;
- `possible_rebrand`;
- `possible_closed_location`;
- `missing_official_data`;
- `location_type_mapping`;
- `source_staleness`.

### DirectoryImportBatch

Un batch de import trebuie sa fie reproductibil si reversibil.

Campuri minime:

- `batch_id`;
- `snapshot_id`;
- `selection_rule_version`;
- `dry_run_status`;
- `selected_location_ids`;
- `created_organization_ids`;
- `created_location_ids`;
- `skipped_rows`;
- `conflicts`;
- `rollback_manifest`;
- `started_at`;
- `finished_at`.

## 3. Maparea coloanelor V2

| Coloana V2 | Destinatie V3 | Regula |
|---|---|---|
| `location_display_name` | LocationCandidate | nume candidat, nu nume public final automat |
| `organization_display_name` | OrganizationCandidate | clusterizare si review obligatoriu |
| `official_locality` | LocationCandidate | trebuie legata de SIRUTA |
| `county_if_confirmed` | LocationCandidate | normalizare la cod judet |
| `research_status` | RawDirectoryRow / review | nu devine status `verified` |
| `operational_status` | LocationCandidate | semnal de cercetare, nu publicare automata |
| `import_readiness` | DirectoryReviewTask | controleaza coada, nu entitatea publica |
| `official_source_url` | EvidenceCandidate | dovada principala candidata |
| `official_source_type` | EvidenceCandidate | tip sursa normalizat |
| `source_checked_at` | EvidenceCandidate | data verificarii sursei |
| `confirmed_address` | LocationCandidate + Evidence | normalizare si conflict check |
| `confirmed_location_phone` | Evidence / camp public candidat | separare pe locatie obligatorie |
| `confirmed_location_email` | Evidence / camp public candidat | nu se presupune email organizational global |
| `confirmed_schedule` | Evidence / camp public candidat | se importa numai daca este locatie-specific |
| `confirmed_activity_category` | categorie provizorie | nu confirma servicii pentru matching |
| `review_flags` | DirectoryReviewTask | se sparg in taskuri separate |
| `evidence_note` | EvidenceCandidate | nota de cercetare, nu copy public |
| `observations` | review intern | nu se publica automat |

## 4. Statusurile V2 nu sunt statusuri VIASEE

### `official_confirmed`

Inseamna ca cercetarea a gasit o sursa oficiala suficienta pentru unele date. Nu inseamna:

- profil revendicat;
- identitate controlata;
- profil VIASEE verificat;
- servicii confirmate;
- specialist verificat.

### `official_partial`

Ramane in staging si necesita evaluarea campurilor lipsa sau conflictuale.

### `discovery_only`

Nu este eligibil pentru import public. Poate ramane numai in backlogul de cercetare.

### `excluded`

Nu creeaza organizatie sau locatie publica. Se pastreaza pentru anti-dubluri si istoric.

## 5. Reguli organizatie versus locatie

1. O locatie fizica distincta produce maximum un `LocationCandidate`.
2. Aceeasi organizatie poate avea oricate locatii.
3. Aceeasi adresa poate contine mai multe locatii numai daca sursa oficiala le individualizeaza sau exista un discriminator fizic clar.
4. O clinica si optica la aceeasi adresa devin un singur rand fizic daca functioneaza ca aceeasi unitate operationala.
5. Un spital este organizatia; sectia sau ambulatoriul este unitate functionala/locatie, nu organizatie separata.
6. Un medic mentionat pe pagina unei clinici nu devine automat `ProfessionalProfile`.
7. Un cabinet individual poate avea organizatia si locatia cu nume apropiate, dar entitatile raman separate logic.
8. Brandul comercial, operatorul juridic si organizatia publica nu se presupun identice fara dovezi.

## 6. Chei stabile si deduplicare

### Cheie candidat organizatie

Se construieste din combinatia:

- nume normalizat;
- domeniu oficial;
- identitate juridica, daca este cunoscuta;
- brand parinte;
- dovezi de retea.

Numele singur nu este suficient.

### Cheie candidat locatie

Se construieste din:

- `locality_siruta_code`;
- adresa normalizata;
- discriminator unitate/spatiu/etaj;
- organizatia candidata;
- telefonul locatiei, cand exista.

### Detectii obligatorii

- acelasi nume + aceeasi adresa;
- nume diferit + aceeasi adresa + acelasi telefon;
- acelasi brand + mai multe adrese;
- mai multe branduri la aceeasi adresa;
- rebranding istoric;
- locatie mutata;
- mall cu unitati distincte;
- sectie si ambulatoriu la aceeasi adresa;
- localitate comerciala diferita de localitatea administrativa.

Nicio detectie nu produce consolidare automata fara regula determinista sau review.

## 7. Tipuri de locatie care trebuie rezolvate inainte de import

Taxonomia minima propusa pentru candidati:

- `optica_medicala`;
- `cabinet_optometric`;
- `cabinet_oftalmologic`;
- `clinica_oftalmologica`;
- `spital_oftalmologic`;
- `clinica_multispecialitate_cu_oftalmologie`;
- `spital_public_unitate_oftalmologie`;
- `ambulatoriu_oftalmologie`;
- `laborator_optic`;
- `unitate_mixta_optica_clinica`;
- `unknown_needs_review`.

`confirmed_activity_category` poate sugera tipul, dar nu il decide singur.

## 8. Profesii, specialisti si utilizatori

Importul directorului nu creeaza:

- utilizatori;
- `ProviderMembership`;
- `ProfessionalProfile`;
- `ProfessionalInvitation`;
- `ProfessionalLocationAssignment`.

Specialistii apar numai prin fluxul controlat VIASEE:

1. profil creat de utilizator;
2. invitatie sau asociere acceptata;
3. review profesional;
4. acord separat pentru vizibilitatea la fiecare locatie.

Numele medicilor din pagini oficiale pot ramane doar ca dovezi interne privind existenta activitatii unei unitati, daca validarea juridica permite acest lucru. Nu devin profiluri publice.

## 9. Servicii si matching

Categoriile de activitate din V2 nu creeaza automat `LocationService` confirmat.

La import se poate crea cel mult:

- un indicator editorial intern;
- o categorie generala informativa;
- un task de configurare dupa revendicare.

Serviciile folosite de flow-ul clientului trebuie confirmate ulterior conform contractului separat al serviciilor.

## 10. Portile de import

### G0 — integritate sursa

- checksum valid;
- numar randuri reconciliat;
- fara randuri lipsa;
- fara pseudo-locatii in setul de import.

### G1 — identitate locatie

- localitate si SIRUTA;
- adresa suficienta;
- fara conflict critic;
- status operational acceptabil.

### G2 — identitate organizatie

- organizatie candidata creata;
- legatura locatie-organizatie evaluata;
- rebrandingurile si reteaua tratate.

### G3 — tip structural

- tip locatie mapat;
- unitatile publice si multi-specialitate tratate corect.

### G4 — eligibilitate publica

- validare juridica aplicabila;
- nivel de disclosure stabilit;
- fara date personale nepermise;
- eticheta `Profil nerevendicat`;
- provenienta si data verificarii disponibile intern.

### G5 — dry-run si import

- dry-run fara erori critice;
- raport de create/update/skip/conflict;
- batch mic;
- rollback manifest;
- verificare post-import.

## 11. Setul de artefacte V3 necesar

Inainte de primul import trebuie sa existe:

1. `directory_source_snapshot_v3`;
2. `directory_raw_rows_v3`;
3. `directory_organizations_v3`;
4. `directory_locations_v3`;
5. `directory_organization_location_links_v3`;
6. `directory_evidence_v3`;
7. `directory_review_queue_v3`;
8. `directory_import_manifest_v3`;
9. raport de deduplicare;
10. raport de diferente fata de V2.

## 12. Ordinea de lucru

1. Inghetarea snapshotului V2 si a checksumurilor.
2. Recuperarea celor 77 randuri Bucuresti lipsa din tabele.
3. Eliminarea celor 14 randuri generice de retea din setul de locatii.
4. Recalcularea totalului real si a distributiilor.
5. Deduplicarea transversala nationala.
6. Alocarea codurilor SIRUTA si a cheilor stabile.
7. Clusterizarea organizatiilor si validarea legaturilor multi-location.
8. Maparea tipului structural pentru randurile `blocked_type_mapping`.
9. Separarea conflictelor rezolvabile de cele care raman blocate.
10. Selectarea unui pilot cu 3 locatii cu risc redus.
11. Dry-run, verificare si rollback test.
12. Extindere la 30–50 de locatii numai dupa validarea pilotului.
13. Import national numai dupa validarea juridica si operationala.

## 13. Criterii pentru pilotul initial

Pilotul nu trebuie ales doar dupa oras. Fiecare locatie trebuie sa fie:

- `official_confirmed`;
- `active_confirmed`;
- fara `REVIEW_CONFLICT`;
- fara `REVIEW_LOCALITY`;
- fara `REVIEW_SAME_ADDRESS_DISTINCT_UNIT`;
- fara `blocked_type_mapping`;
- cu adresa completa;
- cu organizatie simpla sau legatura organizationala clara;
- fara specialisti importati;
- fara servicii medicale specializate deduse.

Setul recomandat pentru test trebuie sa includa:

- o optica independenta;
- o locatie dintr-o organizatie multi-location;
- o clinica dedicata cu structura clara.

Spitalele, clinicile multi-specialitate, mallurile cu unitati apropiate si randurile conflictuale nu intra in primul pilot.
