# Email notification events — VIASEE

Acest document este catalogul operational al evenimentelor de comunicare VIASEE.

Fundatia centralizata `communication-events-v1` este implementata initial pentru doua evenimente legate de cererile pacientilor. Celelalte evenimente din acest document raman planificate pana cand sunt conectate explicit la catalog, jurnal si reguli de livrare.

## Regula de lucru pentru dezvoltare

Pentru fiecare eveniment se definesc minimum:

- `event_key` stabil;
- momentul declansarii;
- destinatarul;
- canalul;
- scopul mesajului;
- prioritatea;
- versiunea template-ului;
- cheia de idempotenta;
- jurnalul livrarii;
- datele minime necesare pentru template.

Emailurile nu sunt sursa de adevar. Starea cererii, leadului, raspunsului si acordului ramane in entitatile operationale VIASEE.

## Cereri pacient si leaduri

| Event key | Status | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|---|
| `provider_lead_available` | implementat | Dupa crearea unui lead eligibil si redactionat | ownerii si managerii activi ai locatiei, maximum 20 destinatari | Anunta ca exista o cerere relevanta in Inbox furnizor, fara date de contact | mare |
| `patient_provider_response_received` | implementat | Cand o locatie schimba raspunsul structurat la un lead | contactul pacientului, numai daca emailul este verificat | Anunta ca exista un raspuns nou si cere revenirea in pagina cererii | mare |
| `patient_request_received` | planificat | Dupa salvarea completa a cererii | pacient | Confirma primirea cererii | mare |
| `patient_no_results` | planificat | Cand nu exista suficiente variante eligibile | pacient | Explica urmatorii pasi fara a prezenta rezultate slabe ca potriviri | medie |
| `patient_contact_share_changed` | planificat | Dupa aprobarea sau revocarea acordului de contact | pacient si locatia vizata | Confirma schimbarea accesului la contact | mare |
| `patient_request_closed` | planificat | La inchiderea sau expirarea cererii | pacient | Confirma inchiderea si efectele asupra accesului | medie |

### Reguli implementate pentru primele doua evenimente

- jurnal admin-only in `CommunicationDelivery`;
- emailul destinatarului este stocat numai ca hash in jurnal;
- corpul emailului si valorile de contact nu sunt stocate in jurnal;
- livrarea este idempotenta per eveniment, sursa si destinatar;
- erorile de email nu anuleaza leadul sau raspunsul;
- adresele lipsa sau neverificate sunt marcate `skipped`;
- mesajele nu includ textul original al pacientului, date medicale, telefon sau alte date sensibile;
- niciun email nu confirma o programare si nu ofera diagnostic sau recomandare medicala;
- chatul si distribuirea contactului raman fluxuri separate.

## Claim si acces furnizor

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_claim_submitted` | Dupa trimiterea unei revendicari normale | solicitant | Confirmare ca cererea a fost primita | mare |
| `provider_new_location_submitted` | Dupa trimiterea unei locatii noi | solicitant | Confirmare ca locatia intra in verificare | mare |
| `provider_access_request_submitted` | Dupa solicitare acces la profil deja administrat | solicitant | Confirmare ca cererea de acces a fost primita | mare |
| `provider_access_request_owner_notice` | Dupa solicitare acces la profil deja administrat | owner / admin locatie existent | Atentionare ca cineva cere acces la profil | mare |
| `provider_claim_approved` | Admin aproba claim/acces | solicitant | Anunt ca accesul este activ | mare |
| `provider_claim_rejected` | Admin respinge claim/acces | solicitant | Anunt respingere + motiv | mare |
| `provider_claim_needs_more_info` | Admin cere completari | solicitant | Cere informatii suplimentare | mare |

## Workspace si continut profil

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_workspace_draft_submitted` | Furnizor trimite modificari spre review | admin VIASEE | Notificare ca exista modificari de verificat | medie |
| `provider_workspace_draft_approved` | Admin aproba modificari profil | furnizor | Anunt ca modificarile au fost aprobate/publicate | medie |
| `provider_workspace_draft_rejected` | Admin respinge modificari profil | furnizor | Anunt respingere + motiv | medie |
| `provider_workspace_draft_needs_more_info` | Admin cere completari pe draft | furnizor | Cere informatii suplimentare | medie |
| `provider_logo_submitted_for_review` | Furnizor incarca logo/imagine profil | admin VIASEE | Notificare ca exista un logo de verificat | medie |
| `provider_logo_approved` | Admin aproba logo/imagine profil | furnizor | Anunt ca logo-ul este public | medie |
| `provider_logo_rejected` | Admin respinge logo/imagine profil | furnizor | Anunt respingere + motiv | medie |

## Membri, invitatii si specialisti

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_member_invited` | Owner/manager invita membru | invitat | Invitatie sa accepte accesul la locatie | mare |
| `provider_member_access_granted` | Cerere acces aprobata / membru activat | solicitant | Confirmare ca are acces | mare |
| `provider_member_access_granted_owner_notice` | Cerere acces aprobata pentru profil deja administrat | owner existent | Informare ca un membru nou a fost adaugat | medie |
| `professional_affiliation_invited` | Locatia adauga specialist cu email in echipa | specialist | Invita specialistul sa confirme afilierea prin cont | mare |
| `professional_affiliation_confirmed` | Specialistul confirma afilierea | locatie + specialist | Confirmare ca afilierea este activa/confirmata | medie |
| `professional_affiliation_removed` | Locatia sau specialistul retrage afilierea | locatie + specialist | Anunt ca afilierea nu mai este activa | medie |
| `professional_profile_claimed` | Specialistul revendica profilul profesional | specialist | Confirmare cerere profil profesional | medie |
| `professional_profile_verified` | Admin verifica profilul profesional | specialist | Confirmare profil profesional verificat | medie |

## Parteneri B2B si listari platite

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `b2b_supplier_profile_submitted` | Furnizorul B2B trimite profilul spre verificare | solicitant | Confirmare primire cerere furnizor | mare |
| `b2b_supplier_profile_approved` | Admin aproba profilul de furnizor B2B | solicitant | Confirmare acces/listare partener | mare |
| `b2b_supplier_profile_rejected` | Admin respinge profilul de furnizor B2B | solicitant | Anunt respingere + motiv | mare |
| `b2b_supplier_listing_started` | Listarea platita este activata | billing owner | Confirmare listare/abonament | mare |
| `b2b_supplier_listing_payment_failed` | Plata listarii esueaza | billing owner | Cere actualizarea metodei de plata | mare |
| `b2b_supplier_listing_cancelled` | Listarea platita este anulata | billing owner | Confirmare anulare listare | medie |

## Auth si billing

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `auth_password_setup_requested` | Utilizatorul cere setare/recuperare parola pentru cont existent | utilizator | Permite acces prin email fara cont duplicat | medie |
| `billing_subscription_started` | Abonament activat pentru organizatie/locatie | billing owner | Confirmare plata si activare | mare |
| `billing_subscription_failed_payment` | Plata recurenta esueaza | billing owner | Cere actualizarea metodei de plata | mare |
| `billing_subscription_cancelled` | Abonament anulat | billing owner | Confirmare anulare si efecte | medie |
| `billing_owner_changed` | Persoana responsabila de plata se schimba | vechiul si noul billing owner | Confirmare schimbare responsabil plata | medie |

## Reguli de siguranta

- Emailurile nu contin informatii sensibile inutile.
- Emailurile nu includ niciodata coduri interne, hashuri, tokenuri sau mesajul original al pacientului.
- Pentru profil deja administrat, notificarea catre owner trebuie sa permita ignorare sau raportare.
- Aprobarea accesului ramane manuala in MVP.
- Niciun email nu inlocuieste audit trail-ul entitatii operationale.
- Esecul livrarii este vizibil in jurnal, dar nu inverseaza tranzactia de produs deja finalizata.
