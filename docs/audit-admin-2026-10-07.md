# Audit panou Admin VIASEE — 7 octombrie 2026

Tip: audit si plan. **Nicio modificare de cod sau de date.**
Versiune analizata: GitHub `main` @ `549ec454` (7 oct 2026) = Base44 `main` (aceleasi fisiere in `src/components/admin` si in `docs/`; Base44 are o singura ramura activa).
Limba documentului: romana fara diacritice, conform regulii din `VIASEE_CODEX_CONTEXT.md` sectiunea 15. Textele din interfata propuse in plan folosesc diacritice (vezi T7).

---

## 1. Cum s-a facut auditul si ce nu acopera

- **Cod:** am citit shell-ul admin, pagina `AdminDirectoryOps.jsx`, panoul de azi, coada de verificare (toate cele 6 sub-cozi), revendicari, corectii, suport, profiluri, servicii, contacte din cautari, analytics, plati, emailuri automate, lista de campanii si contactele de outreach, integritate/reparatii/geocodare, istoric audit, adaugare locatie, import SIRUTA, plus stilurile (`index.css`, `admin-mobile.css`).
- **Date:** interogari **read-only** prin Base44 (numaratori si campuri minime), pentru a ma uita la volumul real. Nu am creat, modificat sau sters nimic.
- **Ce NU am facut:** nu am deschis panoul in browser cu cont de admin si nu am capturi de ecran. Observatiile vizuale sunt deduse din cod. Lista de verificat live e in Anexa B.
- **Citit partial sau deloc** (se re-auditeaza in profunzime cand lucram modulul respectiv):
  - partial: Import director (primele ~50%), Mapare si identitate (~25%), detaliul unei campanii (~50%), cozile de Research si AI Copilot (doar nivelul de lista);
  - nu am citit: Feedback utilizatori, Oferte Enterprise, selectorul de destinatari/constructorul de audienta/editorul de sabloane/raportul de campanie, ecranele de detaliu Research (profil, dovezi, acoperire, loturi, draft AI), Organizatii fragmentate, Contract geografic, randul/adaugarea de servicii, cardurile din Analytics.
- **Documentul `VIASEE_CODEX_CONTEXT.md` este vechi** (4-5 aug 2026) si nu l-am folosit ca sursa de adevar. Exemplu depasit: listeaza Analytics ca neimplementat, desi exista (commit-urile din 5 oct).
- **Nu exista un plan scris dedicat panoului admin.** Cele mai recente documente de directie sunt `docs/directie-design-servicii.md`, `docs/module-locatie-design-2026-10-05.md` si `docs/servicii-editor-2026-10-05.md` (design neutru, accent albastru-gri, actiuni explicite, afisare la 320/390 px). Planul de mai jos le urmeaza.

---

## 2. Starea reala a datelor (7 oct 2026)

| Element | Valoare |
|---|---|
| Utilizatori cu rol admin | **1** |
| Locatii (ProviderLocation) | ~1.500–1.750 |
| Locatii publicate ca „director” (nerevendicate) | ~1.200–1.500 |
| Locatii revendicate / verificate | 7 |
| Organizatii | 500–1.000 |
| Revendicari | 7 in total (3 aprobate, 4 respinse), **0 in asteptare** |
| Tichete de suport | **0** |
| Sesizari de corectie | **0** |
| Cereri de pacienti (PatientRequest) | **0** |
| Contacte lasate la cautare | 1 |
| Feedback utilizatori | 0 |
| Abonamente Pro | 1 activ, 1 anulat |
| Trimiteri workspace (modificari de profil/servicii) | 17 (16 aprobate, 1 retrasa, **0 in asteptare**) |
| Contacte outreach | 500–600 (primele 500, verificate: **toate „new”**) |
| Campanii outreach create | **0** |

**Concluzie:** platforma e in faza de pre-lansare; cozile de lucru sunt practic goale. Prioritatea nu este scalarea, ci (1) sa nu afiseze informatii false, (2) sa fie clar si rapid pe zi, (3) sa fie pregatita cand vin primele revendicari, cereri si campanii. O singura exceptie de volum: directorul (~1.6k locatii) face ecranele de tip „lista completa” grele.

---

## 3. Rezumat

### Ce merge bine si se pastreaza
- Cifrele din Panou si Analytics se numara pe server (`count`/`aggregate`), cu cache de 5 minute si „indisponibil” (nu zero) in Analytics.
- Deciziile cu efect (suspendare, respingere, transfer de locatie, aprobare) cer **nota** si intra in audit (`DirOpsActionNote`, `DirectoryAuditRecord`).
- Trimiterea de campanii are protectii serioase: confirmare tastata, ritm zilnic cu crestere, oprire automata la bounce/spam, verificare DNS a domeniului.
- Suportul (tichete) si Contactele din cautari au structura buna: lista + detaliu, filtre, export CSV, stergere GDPR cu confirmare, termen de 30 de zile pentru stergerea contului.
- Meniul e grupat pe intentie (Azi / De rezolvat / Director / Clienti / Sistem) si exista protectii pentru telefon (`admin-mobile.css`, sertar lateral).
- Backend-ul reparatiilor de integritate e sigur (repara doar locatii deja publicate **si** verificate, cu semnatura reverificata).

### Cele mai importante probleme
1. **P0 — Panoul poate spune „Totul e la zi” fals** (esec = 0, coada se incarca ulterior).
2. **P0 — „Status nealiniat” / „Probleme de date” marcheaza ca eroare starea normala a ~1.200–1.500 de profiluri din director.**
3. **P0 (latent) — Doua ecrane citesc mai putine locatii decat exista** (1.000 si 1.500), deci pot arata „locatie necunoscuta” si un avertisment gresit la inchiderea unei locatii.
4. **P1 — Navigarea nu are URL:** refresh duce la Panou, butonul Inapoi paraseste adminul, nu poti salva/trimite un link catre un ecran.
5. **P1 — Niciun contor in meniu sau in cele 6 tab-uri ale Cozii de verificare.**
6. **P1 — Lista „Profiluri si locatii” randeaza toate locatiile deodata** si nu are link catre pagina publica.
7. **P1 — Locatia se alege dintr-un `<select>` cu ~1.600 de optiuni** (Catalog si eligibilitate).
8. **P2 — Sistem de design fragmentat:** componenta comuna `StatusBadge` are 0 utilizari, 12 duplicate locale, 565 clase de culoare scrise de mana, 5+ stiluri de tab.
9. **P2 — Limba amestecata:** 23 de fisiere fara diacritice, statusuri brute in engleza/cod (`submitted`, `in_asteptare`, `none`).
10. **P2 — Admin-ul mosteneste CSS scris pentru contul de furnizor** (`.workspace-neutral`).
11. **P1 — Nu primesti nicio notificare** la revendicare, tichet, sesizare sau modificare de profil noua, iar raspunsul la tichet nu ajunge pe email la utilizator (T12).

---

## 4. Probleme transversale

Legenda: **P0** = afiseaza informatii false / poate duce la decizii gresite · **P1** = frictiune zilnica · **P2** = consistenta si design · **P3** = optional.

### T1 (P1) Navigare fara URL
- Dovada: `src/pages/AdminDirectoryOps.jsx:213` (`useState("dashboard")`); sub-tab-urile sunt tot stare locala: `AdminReviewQueue.jsx:44`, `AdminProfilesSection.jsx:7`, `DirResearch.jsx:19`, `OutreachWorkspace.jsx:14`, `AdminSupportCenter.jsx:16`, `AdminDirectoryOps.jsx:144` si `:189`.
- Efect: refresh = inapoi la Panou; Inapoi paraseste adminul; nu poti pune un ecran in favorite; nu poti deschide o sectiune in alt tab de browser.
- Fix: sectiune + sub-tab in query string (`/admin/operatiuni?s=profiluri&t=migrare`), pastrand `LEGACY_TAB_REDIRECTS`. Efort S–M.

### T2 (P1) Fara contoare in navigare
- Dovada: `AdminSidebarContent.jsx:6-19` (doar eticheta); `AdminReviewQueue.jsx:10-41,49-69` (6 tab-uri fara numere).
- Efect: ca sa afli unde asteapta ceva, deschizi fiecare tab.
- Fix: un hook `useAdminCounts` folosit de Panou, meniu si tab-uri (reimprospatare la 60 s, numaratori pe server). Efort M.

### T3 (P0) Panoul poate afisa „Totul e la zi” fals
- Dovada: `AdminDashboardHome.jsx:12-15` (`safeInvoke`/`safeCount` transforma orice eroare in `0`/lista goala); `:38` (`reviewQueue: null` pana vin cele 4 apeluri lente); `ActionQueueCard.jsx:9` (`items.filter((i) => i.count > 0)` ignora `null`).
- Efect: cat timp coada se incarca — sau daca un apel esueaza — cardul „De rezolvat acum” spune „Totul e la zi”. Cu datele de azi (revendicari 0, tichete 0, sesizari 0) mesajul apare mereu intai.
- Mai mult: numarul „Coada de verificare” (`:46-50`) aduna 4 surse din 6; lipsesc „Stare locatii” (`providerLocationLifecycleOps`), „asocieri profil existent” (`providerLocationIdentityResolutionOps`), „Cereri fara rezultate” si „Curatare media”.
- Fix: stari distincte „se incarca / indisponibil / numar”; acelasi set de surse ca in tab-uri (T2). Efort S.

### T4 (P0) Reguli de „neconcordanta” gresite pentru profilele din director
- Dovada: `DirOpsProfiles.jsx:67-69` si `AdminDataIntegrity.jsx:108-115`: orice locatie `status = publicata` cu `profile_control_status != verified` e marcata ca problema; la Integritate chiar cu severitate **„error”** („publicata fara status verificat”).
- Date reale: un esantion de 6 profiluri din mijlocul listei (Base44) arata `publicata` + `directory` + `claim_verification_status = none` + `public_visibility_status = approved` — adica **starea normala dupa import** (VIASEE_CODEX_CONTEXT 7.3: „directory, published, unclaimed, unverified”). Sunt ~1.200–1.500.
- Efect: filtrul „Status nealiniat” si categoria „Statusuri” din Integritate sunt zgomot; problemele reale (ex. verificat dar nepublicat, revendicare aprobata fara control, `pending_changes` legacy) se pierd. Fiecare card din Profiluri are un chenar galben „Statusuri de verificat”.
- Backend-ul este corect (`base44/functions/directoryOps/adminDataIntegrityOps.ts:220` repara doar `publicata` + `verified`); problema e doar in regulile din interfata.
- Fix: redefinire reguli (directory publicat nerevendicat = OK), pastrand doar contradictiile reale; eventual mutarea scanarii pe server. Efort S–M.

### T5 (P0/P1) Liste incarcate integral in browser, unele cu limite sub dimensiunea reala

| Fisier:linie | Citeste | Problema |
|---|---|---|
| `AdminLocationLifecycleReview.jsx:103` | 1.000 locatii (sortate dupa nume) | Directorul are ~1.6k → nume lipsa („Locatie necunoscuta”) si **numar gresit de „locatii active”** (`:134-138`) → avertisment fals „ultima locatie activa” (`:42,69`) |
| `DirOpsClaims.jsx:102` | 1.500 locatii | Sub totalul real → revendicari pentru locatii dincolo de limita apar „locatie noua / necunoscuta” |
| `DirOpsProfiles.jsx:130-131,288` | 2 x 5.000, apoi **randeaza toate cardurile** | ~1.200–1.600 carduri in DOM, fara paginare/sortare |
| `AdminDataIntegrity.jsx:288-297` | 5 colectii x 5.000 | Mii de randuri JSON in browser la fiecare scanare |
| `AdminWorkspaceSubmissionsReview.jsx:355-356,387` | 2 x 5.000 | La deschidere **si dupa fiecare decizie**, doar pentru a afisa cateva nume |
| `DirOpsMigrationQueue.jsx:19` | 5.000 | Doar pentru harta de nume |
| `DirOpsAudit.jsx:156` | 2.000 evenimente, fara paginare | Evenimentele de sistem acopera istoricul adminului (vezi M17) |
| `OutreachContactsList.jsx:109,310` | 2.000, afiseaza 500 | Fara avertisment ca restul nu se vede |

- Fix: filtru pe server pentru ce e nevoie (`filter` cu `$in` pe id-uri), `count`/`aggregate` unde se numara, paginare sau virtualizare pentru liste mari. Efort M.

### T6 (P2) Sistem de design fragmentat
- Primitive comune exista: `AdminCard` (38 de fisiere), `EmptyState` (22), `AdminPageHeader`. **`StatusBadge` comun nu e importat nicaieri** (0).
- Duplicate locale (12): `FollowUpBadge`, `Tag`, `SummaryCard` (Contacte); `SummaryCard` (Cereri fara rezultate); `StatusBadge`+`SummaryCard` (Tichete), `StatusBadge`+`SummaryCard` (Feedback); `StatusBadge` (Profiluri); `SummaryItem` (Servicii); `Badge` (Import); `StatTile` (Geocodare).
- 565 de utilizari de clase de culoare scrise de mana (`bg-green-50`, `text-amber-800`…); `index.css` nu are tokeni semantici (succes / avertisment / info / eroare).
- Cel putin 5 stiluri diferite de tab/pill selectat (`rounded-full bg-foreground`, `rounded-xl bg-foreground`, `rounded-lg bg-secondary`…) si raze de colt diferite (`rounded-2xl`, `rounded-3xl`, `rounded-[22px]`).
- Fix: tokeni semantici + `AdminTabs`, `StatusBadge`, `StatCard`, `AdminToolbar`, `AdminDialog`, `DataTable`; migrare treptata, ecran cu ecran. Efort M (fundatie) + cate S pe modul.

### T7 (P2) Limba interfetei
- 23 de fisiere cu text predominant fara diacritice (ex. `DirOpsClaims`, `DirOpsCorrections`, `DirOpsAudit`, `DirOpsImportPipeline`, `DirOpsMapping`, `OutreachCampaign*`, `AutomaticEmailWorkspace`, `QuickActionsGrid`), in timp ce ecrane noi (Suport, Cereri fara rezultate, Contacte, Verificare) au diacritice. Site-ul public foloseste diacritice.
- Statusuri brute afisate: `DirOpsClaims.jsx:224` (`in_asteptare`, `aprobata`), `DirOpsCorrections.jsx:215` (`submitted`, `in_review`), `DirOpsProfiles.jsx:324-336` (`Publicare: publicata`, `Revendicare: none`), `AdminLocationLifecycleReview.jsx:64-65`.
- Jargon tehnic expus: „campul legacy pending_changes” (`AdminProfilesSection.jsx:21`), „Provider type / Profile type”, „dry-run”, „snapshot”, „rollback”.
- Fix: glosar unic + trecere pe ecran; etichete prin dictionar comun (nu `status` brut). Efort S pe modul.

### T8 (P2) Confirmari si dialoguri
- 10 apeluri `window.confirm` in 9 fisiere (`OutreachTemplateEditor`, `OutreachCampaignDetail`, `AdminEnterpriseOffers`, `DirOpsCorrections`, `DirOpsServices`, `AdminDataRepairs`, `AdminFragmentedOrganizations`, `AdminDataIntegrity`, `AdminLocationGeocoding`) — casete native, fara stil, inconsistente cu modalul `DirOpsActionNote`.
- `DirOpsActionNote.jsx`: fara focus trap si fara focus initial pe camp; id-uri fixe (`directory-action-note-title/value`).
- Fix: un singur `AdminDialog` (Radix Dialog exista deja in `components/ui`) pentru confirmare, nota obligatorie si formulare. Efort S–M.

### T9 (P2) CSS cuplat de workspace-ul de furnizor
- `AdminAppShell.jsx:28` foloseste clasa `workspace-neutral`. In `index.css` exista 34 de aparitii `.workspace-neutral`, scrise pentru contul de furnizor (unii cu `:has()` pe clase utilitare ca `section.pt-3 > div.mt-5.divide-y…`; 43 de `!important` in fisier). Ex.: `.workspace-neutral section.border-red-200` devine portocaliu, deci o sectiune de eroare din admin poate arata altfel decat in cod.
- Fix: `admin-surface` cu tokeni proprii; fara override pe selectori. Efort S–M.

### T10 (P3) Accesibilitate
- `NavButton` fara `aria-current` si fara `type="button"` (`AdminSidebarContent.jsx:6-19`); tab-urile sunt butoane simple fara `role="tablist"`/`aria-selected` (exceptii: Plati, Emailuri automate, care au `aria-pressed`); unele stari se disting doar prin culoare.
- Fix: incorporat in `AdminTabs` si `AdminDialog`.

### T11 (P1) Fara cautare globala
- Header-ul (`AdminAppShell.jsx:55-91`) are doar breadcrumb, „Vezi site-ul” si avatar. A gasi o locatie, o organizatie sau un utilizator cere intrarea in ecranul potrivit si filtrare locala.
- Fix: cautare globala (Ctrl/Cmd+K) peste locatii, organizatii, revendicari, tichete, contacte → deschide ecranul corect (necesita T1). Efort M.

### T12 (P1) Fluxuri fara notificare
- Catalogul de emailuri automate din cod (`base44/shared/automaticEmailCatalog.js`, sursa de adevar a ecranului „Emailuri automate”) are **16 mesaje VIASEE, toate catre pacienti, furnizori sau solicitanti — niciunul catre admin**. Deci nu primesti email cand apare o **revendicare, un tichet, o sesizare sau o modificare de profil** noua; afli doar daca deschizi panoul.
- `docs/email-notification-events.md` listeaza alerte catre „admin VIASEE” (draft de workspace trimis `:63`, logo trimis `:67`) care **nu apar in catalogul din cod**; de verificat daca se trimit pe alta cale sau doar sunt planificate (deriva documentatie ↔ cod).
- Raspunsul la tichet se salveaza direct pe entitate (`AdminSupportTickets.jsx:278`) si se vede doar in contul utilizatorului (`HelpSupport.jsx:302`); **nu exista eveniment de email** pentru el. Utilizatorul trebuie sa intre in cont ca sa-l vada.
- Fix: eveniment „raspuns suport” (catre solicitant) + alerte catre admin pentru revendicare/tichet/sesizare/modificare de profil, cu sablon editabil in „Emailuri automate”. Efort M (backend + sabloane).

---

## 5. Audit pe module

Format: ce face · date reale · functional · design · imbunatatiri propuse · prioritate/efort. Ordinea urmeaza meniul; ecranele ascunse sunt la final.

### M1 Panou de azi (`AdminDashboardHome`)
- **Date reale:** aproape tot pe 0 (revendicari, tichete, sesizari); 1 abonament Pro activ; 7 profiluri revendicate/verificate.
- **Functional:** T3 (fals „la zi”, numar incomplet). „Activitate recenta” afiseaza codul brut (`RecentActivityCard.jsx:20`: `update_service_configuration_draft`) si „admin” si pentru evenimente de sistem; are propriile etichete in `DirOpsAudit` pe care nu le foloseste. Nu arata starea automatizarilor (cele 3 workflow-uri din `base44/workflows`: import director la 5 min, scheduler campanii, reconciliere Stripe) si nici erori de trimitere email (`CommunicationDelivery.status = failed`).
- **Design:** din cele 6 „Actiuni rapide”, 3 dubleaza meniul (Coada, Revendicari, Research); celelalte 3 duc la ecrane ascunse (Adauga, Import, SIRUTA) si sunt singura lor cale de acces — **„Istoric audit” nu are nicio cale directa din Panou** in afara de „Vezi tot”. Titlul „Azi” apare langa „Panou de azi”; `QuickActionsGrid` fara diacritice.
- **Propuneri:** „Azi v2”: (1) „De rezolvat” cu stari corecte + toate sursele; (2) banda de sanatate: ultimul import/ultima rulare, geocodare ramasa, email-uri esuate, sincronizare Stripe; (3) „Ce s-a schimbat de ieri” cu etichetele din Audit; (4) „Actiuni rapide” reduse la ecranele ascunse (Adauga, Import, SIRUTA, Istoric audit).
- **P0 (T3) / efort S; restul P1 / M.**

### M2 Coada de verificare (`AdminReviewQueue` + 6 sub-cozi)
- **Date reale:** 0 in asteptare; 17 trimiteri in total, dintre care 16 aprobate.
- **Functional:** fara contoare pe tab-uri (T2); arata doar ce asteapta, nu istoric (pentru „de ce am aprobat asta?” mergi in Audit); fara cautare/filtru dupa organizatie, sectiune sau vechime; fara sabloane de raspuns pentru nota; deciziile se iau una cate una; `AdminWorkspaceSubmissionsReview` reincarca 2 x 5.000 randuri dupa fiecare decizie (T5); `AdminLocationLifecycleReview` are limitele din T5.
- **Bine:** comparatia „publicat acum / propus” pe campuri, previzualizarea fotografiilor, avertismentul la inchiderea ultimei locatii (dupa corectarea T5), nota obligatorie pentru respingere/transfer.
- **Design:** carduri cu raze si stiluri diferite intre sub-cozi (`rounded-2xl` vs `rounded-3xl`); sub-coada „Specialisti” are diacritice, „Profil si continut” nu.
- **Propuneri:** contoare + „Istoric” pe fiecare sub-coada; vechimea cererii („asteapta de 3 zile”); sabloane de nota; deep-link catre profilul public si catre locatie; navigare cu tastatura (urmatorul element dupa decizie).
- **P1 / efort M.**

### M3 Revendicari (`DirOpsClaims`)
- **Date reale:** 7 in total, **0 in asteptare** — dar este poarta principala catre creștere (revendicare → Pro).
- **Functional:** lista amestecata (in asteptare + aprobate + respinse), fara filtru implicit „de rezolvat” (`:100-107`, 300 de randuri); statusul brut (T7); limita de 1.500 locatii (T5); fara link catre profilul public sau catre alte revendicari ale aceluiasi solicitant; fara sabloane de respingere.
- **Bine:** logica de domeniu foarte atenta (rol maxim pe scope, duplicate aparute dupa trimitere, aprobare partiala pe locatii, locatie distincta) — **nu se atinge**.
- **Propuneri:** „De rezolvat” implicit + „Istoric”; etichete RO; cardul arata evidenta (domeniu email, site, telefon) langa datele din director; sabloane de motive; bara de stare cu vechime. 
- **P1 / efort S–M.**

### M4 Corectii si eliminari (`DirOpsCorrections`)
- **Date reale:** 0 sesizari in total (formularul public exista: `provider/DirectoryCorrectionForm.jsx`).
- **Functional:** `personal_data_removal` (GDPR) nu are termen/avertisment de scadenta, desi Tichetele au termen de 30 de zile pentru stergerea contului; rezolvarea „corectata manual” nu duce direct la profil/editare (`Profil` deschide pagina publica); statusul brut (T7); `window.confirm` (T8).
- **Design:** cel mai „vechi” stil din admin (`rounded-3xl`, fara diacritice).
- **Propuneri:** termen + insigna de scadenta pentru eliminare date personale; butoane „Editeaza profilul” / „Suspenda” direct din sesizare; mutare in aceeasi structura lista+detaliu ca Suportul.
- **P2, dar GDPR → insigna de termen P1 / efort S.**

### M5 Tichete suport + Feedback (`AdminSupportCenter`)
- **Date reale:** 0 tichete, 0 feedback.
- **Functional:** structura buna (lista+detaliu, filtre, termen 30 de zile pentru stergere cont, raspuns obligatoriu pentru statusuri finale). Lipseste notificarea prin email (T12); citeste doar 500 de tichete (acceptabil la volumul actual). Feedback utilizatori: parcurs doar la nivel de structura (acelasi tipar).
- **Design:** model de referinta pentru restul listelor (carduri de sumar, filtre, detaliu) — de extras in `StatCard`/`DataTable` comune.
- **Propuneri:** email la raspuns; raspunsuri-sablon; notificare catre admin la tichet nou.
- **P1 (email) / efort M.**

### M6 Profiluri si locatii (`AdminProfilesSection` → `DirOpsProfiles`, `DirOpsMigrationQueue`)
- **Date reale:** ~1.6k locatii, ~1.2–1.5k publicate ca director, 7 revendicate/verificate.
- **Functional:** T4 (zgomot), T5 (toate cardurile deodata); fara sortare, fara filtre pe judet/oras/tip/completitudine/„fara coordonate”/„fara telefon”; **niciun link „Vezi pe site”**; editarea rapida face 2 apeluri (`updateProviderLocation` apoi `reviewProfileChanges`, `:176-191`), fara validare telefon/URL/email si fara sa arate valoarea curenta langa cea noua; daca al doilea apel esueaza ramane o modificare propusa neaprobata; „Review migrare” incarca 5.000 de locatii doar pentru nume.
- **Bine:** campuri editabile limitate deliberat (nume/adresa/tip raman prin flux de corectie); note obligatorii pentru verificare/suspendare; „Ridica suspendarea” separat de „Verifica”.
- **Design:** carduri mari cu 4 insigne + chenar galben pe fiecare (zgomot vizual); `StatusBadge` local; text de ajutor cu jargon (`pending_changes`).
- **Propuneri:** tabel paginat pe server (nume, organizatie, oras, tip, stare, completitudine, ultima modificare) cu cautare + filtre salvate; panou lateral de detaliu cu „Vezi pe site”, istoric audit al locatiei, servicii, program, poza; bara „probleme reale” (T4); editare cu diferenta vechi/nou si validare; actiuni in lot pentru etichete (nu pentru suspendare).
- **P1 / efort L (este modulul cu cel mai mare impact zilnic).**

### M7 Catalog si eligibilitate (`DirOpsServices`)
- **Functional:** locatia se alege dintr-un `<select>` nativ cu ~1.600 de optiuni (`:114`) — practic inutilizabil; nu exista vedere „toate serviciile neconfirmate din toate locatiile” (Analytics trimite aici cu „Servicii neconfirmate”, dar ecranul nu le poate lista); `window.confirm` (T8). Numele „Catalog” nu corespunde: catalogul canonic e in cod, ecranul administreaza serviciile unei locatii si recalculeaza eligibilitatea pentru matching.
- **Bine:** verificarea (dry-run) inainte de aplicare, cu raport pe servicii si audit.
- **Propuneri:** cautare de locatie (combobox cu cautare pe nume/oras/organizatie); vedere transversala „servicii de confirmat” cu filtre; redenumire „Servicii pe locatii”. **Matching/ranking/Top 3 nu se ating** (regula 2, sectiunea 15).
- **P1 (alegerea locatiei) / efort S–M.**

### M8 Research director (`DirResearch`: coada, AI Copilot, loturi, acoperire)
- **Functional (la nivel de lista):** coada filtreaza dupa oras/judet cu text liber (fara autocomplete SIRUTA), tabel fara paginare/sortare (`ResearchQueue.jsx`), coloana „Responsabil” cu un singur admin; AI Copilot produce doar drafturi si iese prin formularul „Adauga locatie” (deliberat).
- **Design:** `ResearchQueue` si `AICopilot` sunt in stilul vechi (campuri mici, fara diacritice).
- **Propuneri:** filtre cu autocomplete, paginare, „urmatoarea locatie de verificat”; legatura cu Profiluri (deschide detaliul locatiei). Re-audit in profunzime inainte de lucru (ecranele de detaliu nu au fost citite).
- **P2 / efort M.**

### M9 Contacte din cautari (`AdminSearchContacts`)
- **Date reale:** 1 contact.
- **Functional:** bine facut (urmarire, nota interna, dezabonare, stergere GDPR cu confirmare, export CSV); limita 500; fara actiuni in lot; **neconectat la campanii** (campaniile folosesc `OutreachContact`, aici e `PatientSearchContact`) — decizie de produs/GDPR, nu bug.
- **Design:** `SummaryCard`/`Tag`/`FollowUpBadge` locale (T6).
- **Propuneri:** `StatCard`/`StatusBadge` comune; „Marcheaza contactat” rapid din lista; (optional, dupa decizie GDPR) punte catre o audienta „pacienti cu acord pentru oferte”.
- **P2–P3 / efort S.**

### M10 Campanii si marketing (`OutreachWorkspace`: Campanii / Contacte / Sabloane)
- **Date reale:** 500–600 contacte, toate „new”; 0 campanii. Scheduler-ul exista (`base44/workflows/Outreach Campaign Scheduler.jsonc`).
- **Functional:** tabelul de contacte afiseaza maxim 500 fara a spune ca exista mai multe (`:310`); fara sortare/paginare; distributia pe segmente (tip, retea, profil) apare doar imediat dupa o sincronizare (`OutreachContactsList.jsx:240`), nu ca vedere permanenta; detaliul campaniei are 4 pasi clari (Continut → Destinatari → Previzualizare si test → Trimitere). Partial citit.
- **Design:** fara diacritice (`Ciorna`, `Pregatita`, `Esuata`); `window.confirm` pentru anulare; un al treilea stil de pill.
- **Propuneri:** pagina „Prima campanie” ghidata (sablon de revendicare → segment → test → trimitere), pentru ca aici e cel mai probabil primul efort real de crestere; paginare + export pentru contacte; indicatori de sanatate a domeniului (bounce/spam) in antet.
- **P1 inainte de prima campanie / efort M.**

### M11 Emailuri automate (`AutomaticEmailWorkspace`)
- **Functional:** antetul paginii promite „Vezi mesajele trimise automat” (`AdminDirectoryOps.jsx:98-99`), dar ecranul este **un catalog de sabloane**, nu un jurnal; entitatea `CommunicationDelivery` (stare `pending/sent/failed/skipped`, `subject_preview`, `last_error`, acces doar admin) exista si **nu este citita nicaieri in admin** (0 referinte). Ecranul listeaza 16 mesaje VIASEE + 3 gestionate extern (Base44, Stripe). Previzualizarea afiseaza textul intr-un cadru generic („De la: VIASEE”); nu am verificat daca seamana cu emailul real compus de backend. Nu exista „trimite-mi un email de test”.
- **Design:** curat, o singura coloana de actiuni; fara diacritice.
- **Propuneri:** tab „Jurnal trimiteri” din `CommunicationDelivery` (filtre pe eveniment/stare, motiv esec); „Trimite test catre mine”; previzualizare cu layout real; alerta in Panou la esecuri.
- **P1 / efort M.**

### M12 Analytics (`AdminAnalytics`)
- **Date reale:** aproape goale (0 cereri), deci niciun grafic nu poate fi evaluat pe date reale.
- **Functional:** arhitectura buna (server-side, cache 5 min, „indisponibil” in loc de 0, `useAdminAnalytics.js:5,11-12`); dar cache-ul e la nivel de modul si nu exista buton „Actualizeaza” / „actualizat la HH:MM”; fara comparatie cu perioada anterioara, fara export.
- **Propuneri:** buton de reimprospatare + marca de timp; comparatie cu perioada precedenta; palnia cautare → cerere → raspuns furnizor → revendicare → Pro (cifre deja disponibile partial).
- **P2 / efort S–M.**

### M13 Plati si abonamente (`AdminBillingCenter`)
- **Date reale:** 2 abonamente (1 activ).
- **Functional:** lista Stripe cu paginare pe cursor; filtrul „Cauta in aceasta pagina” e doar local; fara cifre de sumar (activ, in grace, esuat, incasat luna aceasta); Oferte Enterprise nu a fost citit.
- **Design:** codul este foarte comprimat (cateva linii de cate 500+ caractere, `:9-13,39-63`), greu de intretinut; `button` ca variabila de clase.
- **Propuneri:** carduri de sumar deasupra tabelului; link din fiecare rand catre locatia din Profiluri; refactor de lizibilitate fara schimbare de comportament.
- **P2 / efort S–M.**

### M14 Integritate date (`DataIntegrityWorkspace`: Probleme / Organizatii fragmentate / Reparatii / Pozitii pe harta / Contract geografic)
- **Functional:** T4 (probleme fals critice), T5 (5 x 5.000 in browser), T8; titlul „Verificare read-only… nu modifica nimic” sta langa butonul „Repara in lot” (`AdminDataIntegrity.jsx:410-411` vs `:448-451`) — mesaj contradictoriu; geocodarea ruleaza de pe client, in bucla de pana la 200 de runde, deci cere tab-ul deschis.
- **Bine:** reparatii deterministe, cu previzualizare vechi/nou, semnatura reverificata, audit; geocodare cu limita de rata respectata.
- **Propuneri:** scanare pe server cu rezultat numaratoare + lista paginata; reguli corectate (T4); mesaje clare despre ce modifica fiecare buton; geocodare ca job de fundal cu stare vizibila in Panou.
- **P0 (T4) / efort M.**

### Ecrane ascunse (accesibile doar prin butoane, nu din meniu)

**M15 Import director + Mapare si identitate** (`DirOpsImportPipeline`, `DirOpsMapping`; partial citite) — functional matur (campanie nationala automata, aprobare cu fraza, watchdog); ecranul are 510/490 de linii, copy tehnic si fara diacritice, etichete in engleza („Provider type”, „Profile type”); „watchdog” care impinge un pas din browser cand bataia inimii e veche (`:145-161`) — util doar cu tab-ul deschis; scheduler-ul real e pe server. Propuneri: rezumat „starea importului” in Panou; simplificare vizuala (stepper), fara a atinge logica de import. **Pipeline-ul nu se modifica.** P3 / efort M.

**M16 Geografie (SIRUTA)** (`GeoImport`) — flux simplu si sigur (preview + confirmare), stil vechi; folosit rar. P3 / efort S (doar stil + diacritice).

**M17 Istoric audit** (`DirOpsAudit`) — bun ca model (grupare pe zile, detalii tehnice ascunse), dar: etichete lipsa pentru actiunile recente (`update_service_configuration_draft`, `create_service_configuration_draft`, `sync_organization_wide_access`, `add_self_as_location_specialist`, `national_audit_source_correction` — afisate ca text cu underscore inlocuit); incarca 2.000 de evenimente, iar datele reale arata ca 10 din ultimele 15 sunt acelasi eveniment de sistem (`national_audit_source_correction`, 3 oct) → o operatie in masa acopera istoricul actiunilor adminului; fara paginare/filtru de data/export. Propuneri: filtre pe server (actor, entitate, perioada), grupare „N x eveniment de sistem”, etichete complete, export CSV. P1 / efort S–M.

**M18 Adauga organizatie / locatie** (`DirOpsAddLocation`) — formular complet cu provenienta obligatorie si verificare de duplicate; ~25 de campuri intr-o pagina, „Oras/Judet (oglinda)” e jargon, program ca text liber (desi profilul public foloseste program structurat), fara diacritice. Propuneri: pasi (Organizatie → Locatie → Sursa), program structurat, previzualizare a cardului public. P2 / efort S–M.

---

## 6. Plan de lucru pe valuri

Estimarile sunt orientative (zile de lucru, o persoana) si se confirma dupa re-auditul fiecarui modul.

### Val 0 — Corectitudine (1–2 zile, doar frontend, risc mic)
1. **T3** Panou: stari „se incarca / indisponibil / numar”, aceleasi surse ca Coada.
2. **T4** Reguli „neconcordanta” corecte in Profiluri si Integritate.
3. **T5 (partial)** Lifecycle si Revendicari: citire doar a locatiilor necesare (filtru `$in`), fara limite fixe.
4. **T7 (partial)** Etichete RO pentru statusurile brute (Revendicari, Corectii, Profiluri, Lifecycle).
5. **M17 (partial)** Etichete lipsa in Audit + aceleasi etichete in „Activitate recenta”.
6. Mesaj corect pentru Integritate („Verificarea nu modifica; reparatiile sunt actiuni separate”).

### Val 1 — Fundatie de navigare si design (3–5 zile)
1. **T1** URL pentru sectiuni si sub-tab-uri.
2. **T2** `useAdminCounts` + contoare in meniu si in tab-urile Cozii.
3. **T6/T8/T10** Tokeni semantici + `AdminTabs`, `StatusBadge`, `StatCard`, `AdminDialog`, `DataTable` (primul consumator: Profiluri).
4. **T9** `admin-surface` in loc de `.workspace-neutral`.
5. **T7** Glosar si regula de diacritice pentru UI.

### Val 2 — Modulele de zi cu zi (1–2 saptamani)
Ordine propusa (se poate schimba): **M6 Profiluri si locatii → M2 Coada de verificare → M3 Revendicari → M1 Panou „Azi v2” → M7 Servicii pe locatii → T11 Cautare globala.**

### Val 3 — Comunicare, date, plati (1–2 saptamani)
**M11 Jurnal emailuri + test + T12 notificari → M10 „Prima campanie” → M12 Analytics → M13 Plati → M14 Integritate pe server → M17 Audit pe server.**

### Val 4 — Cand apare nevoia
Roluri/alocare pentru mai multi admini, „vezi ca furnizor” (citire), punte Contacte → audienta (cu decizie GDPR), simplificarea Import/Mapare, ecrane Research de detaliu.

### Cum lucram fiecare modul
1. Re-audit scurt al modulului (inclusiv fisierele neparcurse acum).
2. Schita de interfata (descriere sau macheta HTML) → confirmare.
3. Implementare mica, verificari (`npm run lint`, `npm run build`, scripturile `verify-*` relevante), test vizual la desktop si 390/320 px cu date demonstrative.
4. Commit pe ramura de lucru; **Publish App in Base44** doar la cererea ta (modificarile de frontend apar pe viasee.ro abia dupa publicare).

---

## 7. Ce nu atingem fara cerere explicita
- Matching, ranking, Top 3, recomandare furnizori, distribuirea cererilor (regula 2, `VIASEE_CODEX_CONTEXT.md` §15).
- Logica pipeline-ului de import, reconciliere, siguranta, rollback; scheduler-ele.
- Entitati, scheme, RLS, functii backend existente (in afara de adaugari aprobate, ex. eveniment email).
- Logica de revendicare/roluri/scope din `DirOpsClaims`.
- Directia vizuala din `docs/directie-design-servicii.md` si cele din 5 oct 2026 (neutru, accent albastru-gri, actiuni explicite).

---

## 8. Decizii de la tine
1. **Ordinea modulelor:** e in ordinea impactului zilnic pe care il presupun eu (nu stiu cum folosesti adminul). Ce faci cel mai des?
2. **Stil:** pastram limbajul vizual actual (crem + neutru + accent albastru-gri) sau vrei un admin mai dens, „de lucru” (tabele, panouri laterale)?
3. **Diacritice** peste tot in interfata admin (recomandat, ca pe site-ul public)?
4. **Notificari (T12):** vrei email catre tine la revendicare/tichet/sesizare noua si email catre utilizator la raspunsul de suport?
5. **Mai multi admini** in viitor (roluri, alocare)? Daca nu, scoatem coloane ca „Responsabil”.
6. **Publicare:** dupa fiecare modul (Publish App) sau le adunam pe un preview?

---

## Anexa A — Metrici (cod)

| Metrica | Valoare |
|---|---|
| Fisiere `.jsx/.js` in `src/components/admin` | 89 (~14.900 linii) |
| Importuri `AdminCard` / `EmptyState` / `StatusBadge` comun | 38 / 22 / **0** fisiere |
| Componente locale duplicate (badge, sumar, tile) | 12 |
| Clase de culoare scrise de mana (`bg|text|border-(green|amber|red|blue|…)-NNN`) | 565 |
| Apeluri `window.confirm` | 10 in 9 fisiere |
| Fisiere cu text predominant fara diacritice | 23 |
| Aparitii `.workspace-neutral` in `index.css` / `!important` in fisier | 34 / 43 |
| Sectiuni accesibile doar prin buton (nu din meniu) | Import director, Mapare, Geografie, Istoric audit, Adauga locatie |

## Anexa B — De verificat live (nu am avut sesiune de admin in browser)
- Aspectul real al fiecarui modul la desktop si la 390/320 px (sertarul lateral, tabelele cu defilare, modalele).
- Timpul de incarcare al „Profiluri si locatii” si al „Probleme de date” pe datele reale (~1.6k locatii).
- Cum arata `DirOpsProfiles` cu chenarul galben pe ~1.200–1.500 de carduri (T4).
- Efectul real al selectorilor `.workspace-neutral` asupra ecranelor de admin (T9).
- Mesajul „Totul e la zi” la prima incarcare a Panoului (T3).
- Formularul public de corectii si fluxul de revendicare, ca sa intelegem de ce volumul e 0 (descoperire/vizibilitate, nu doar admin).

Daca vrei verificare vizuala fara sa-mi dai acces la cont: trimite capturi de ecran sau rulez componentele reale local, cu date demonstrative si un client Base44 in memorie, ca in sesiunile anterioare (vezi `docs/servicii-editor-2026-10-05.md`).

---

## 9. Stare implementare (actualizat 7 oct 2026)

Ramura de lucru: `claude/tender-davinci-4q6djk`. Nimic nu apare pe viasee.ro pana la „Publish App” in Base44.

### Val 0 — Corectitudine: facut
| Cod | Ce s-a schimbat | Unde |
|---|---|---|
| T3 | Panoul nu mai spune „Totul e la zi” cat timp numara sau cand o sursa nu raspunde; numara aceleasi 6 surse ca Coada + revendicari, tichete, corectii; sursa indisponibila apare pe nume | `lib/adminCounts.js`, `dashboard/*` |
| T4 | „Neconcordanta” = doar contradictii reale (revendicata fara control, campuri de verificare diferite, publicata dar invizibila, schimbari vechi in asteptare). Profilele din director nu mai sunt marcate ca eroare | `lib/adminLocationStatusRules.js`, `DirOpsProfiles`, `AdminDataIntegrity` |
| T5 | Lifecycle, Revendicari, Coada migrare, Coada de verificare citesc doar locatiile necesare (`$in`, pe bucati de 100), nu primele 1.000/1.500/5.000 | `lib/adminEntityBatch.js` |
| T7 | Etichete in romana pentru statusuri, relatii, actiuni de audit (~130), entitati si campuri | `lib/adminLabels.js` |
| M17 | Audit: implicit doar oameni (filtru pe server), „Sistem” grupat, pagini de 200, detalii tehnice cu latime normala | `DirOpsAudit` |
| M4 | Termen GDPR de 30 de zile pe eliminarile de date personale | `DirOpsCorrections`, `lib/adminFormat.js` |
| M14 | „Verificarea citeste, reparatiile sunt actiuni separate”; confirmare in dialog, nu in caseta nativa | `AdminDataIntegrity`, `AdminLocationGeocoding` |

### Val 1 — Fundatie: facut
| Cod | Ce s-a schimbat |
|---|---|
| T1 | Fiecare sectiune si sub-tab are adresa (`?s=…&t=…&id=…`); Inapoi/Inainte/Reincarca pastreaza locul; rutele vechi duc in locul nou |
| T2 | `useAdminCounts`: numere in meniu, in taburile Cozii/Revendicarilor si pe Panou; se reimprospateaza la 60 s, la revenirea in fereastra si imediat dupa fiecare decizie |
| T6 | Tokeni semantici (`success/warning/info/danger` + soft/border) si primitive: `StatusBadge`, `StatCard`, `AdminTabs`, `AdminChips`, `AdminHint` (ⓘ), `AdminLoading`, `AdminConfirm` |
| T8 | `window.confirm` inlocuit peste tot cu dialog accesibil (9 fisiere) |
| T9 | `admin-surface` in locul `.workspace-neutral` (corecteaza si latimea fortata a elementelor `<details>`) |
| T10 | „Sari la continut”, `aria-current` pe meniu, taburi cu sageti, titlu/descriere pentru sertarul de pe telefon, focus in dialoguri |
| UX | Texte lungi mutate in ⓘ; meniu fara taieturi pe laptop; „Panou de azi” te duce la ce are de facut |

### Val 2 — modulele de zi cu zi: facut pana acum
| Modul | Ce s-a schimbat |
|---|---|
| M2 Coada de verificare | Bara de decizie comuna: „Aproba” dintr-un click, „Cere informatii/Respinge/Arhiveaza” deschid motivul sub butoane (validare locala, eroare langa butoane); doar campurile schimbate (restul in spatele unui comutator); „Trimisa acum N zile” (avertisment 3 zile, alerta 7); cele mai vechi primele; dupa decizie elementul dispare imediat; cand o coada se goleste, propune singura urmatoarea coada cu lucru; validari locale pentru transfer intre organizatii; stari in romana |
| M7 Servicii pe locatii | Cautare de locatie in loc de lista cu ~1.600 de optiuni (fara diacritice, cuvinte multiple, „Doar cu servicii”); locatia aleasa sta in adresa; servicii cu eticheta din catalog si stari in romana; „Adauga serviciu” pliat; eligibilitate cu rezumat compact |
| T11 Cautare globala | Ctrl/Cmd+K si buton in antet: meniu rapid cu toate sectiunile (inclusiv cele fara loc in bara) si cautare in locatii, organizatii, revendicari, tichete (nume, telefon in orice format, email); rezultatul deschide elementul (Profiluri/Revendicari/Tichete, cu `?id=`) |
| M11 Emailuri automate | Fila „Jurnal trimiteri” (CommunicationDelivery): ce a plecat/esuat si de ce, filtre cu numere exacte; rand in Panou + insigna in meniu pentru emailurile esuate in ultimele 7 zile |
| M3 Revendicari | „De rezolvat/Istoric”, „Trimisa acum N zile”, relatia si starea pe locatie in romana, text cu diacritice |
| M6 Profiluri | O singura insigna de stare, filtre cu numere, „De verificat” = doar contradictii reale, afisare treptata, „Vezi pe site”, deschidere din cautare |
| M5 Tichete suport + Feedback | Lista se deschide pe „Active”, in ordinea de lucru (termene de stergere de cont, apoi ce cere raspunsul tau dupa prioritate si vechime, apoi ce asteapta utilizatorul); „Primit acum N zile” (avertisment 3 zile, alerta 7); raspuns cu doua butoane clare („Trimite si rezolva”, „Trimite si asteapta utilizatorul”), dupa salvare trece la urmatorul tichet; ciorna se pastreaza cand schimbi tichetul; avertisment ca raspunsul nu se trimite pe email; organizatia se deschide direct din tichet; lista care nu se incarca nu mai spune „Nu ai niciun tichet”; Feedback cu aceleasi filtre si trecere la urmatorul mesaj nou |
| M1 Panou „Azi” (v2) | „De rezolvat acum” in doua grupe: ce asteapta decizia ta si „Procese automate” (emailuri netrimise, import director blocat/esuat, campanii oprite automat sau esuate, abonamente cu plata restanta); aceleasi numere ca insigne in meniu (Campanii, Plati); fereastra de timp discreta langa eticheta |
| M13 Plati si abonamente | Sumar (Pro active, plata restanta, anulate) din numaratori pe server; „Arata abonamentele cu plata restanta” duce direct la lista filtrata; file in adresa; paginarea porneste de la prima pagina la schimbarea filei; explicatiile lungi in ⓘ; cod rescris lizibil (linii de 500+ caractere), aceleasi apeluri; Oferte Enterprise cu componentele comune |
| M12 Analytics | „Actualizeaza” + „Cifre actualizate acum N min”; perioada cu chip-uri; comparatie cu perioada de dinainte (sageti +/−/„la fel”, doar unde exista istoric); liste taiate de server spuse in clar; surse cazute „indisponibil”, nu 0; filtru „De cercetat” pe judete; „7 zile / 30 de zile” scrise corect |
| M9 Contacte din cautari | Se deschide pe „Noi”, filtre cu numere in loc de carduri-sumar, „Marcheaza contactat” dintr-un click (apoi urmatorul contact nou), stergerea (GDPR) si dezabonarea cer confirmare in dialog, nota inceputa se pastreaza, lista care nu se incarca nu mai spune „Inca nu a lasat nimeni datele”; regulile Legea 506/2004 si exportul CSV protejat neschimbate |
| M14 / M8 / M16 / M18 / Mapare (text) | Diacritice, formulari mai scurte si culori semantice in Integritate date (inclusiv categoriile, cu cheile logice neschimbate), Reparatii controlate, Organizatii fragmentate, Research director (coada, profil, AI Copilot, loturi, acoperire), Geografie, Adauga locatie, Mapare si identitate; fara schimbari de logica |
| Profiluri (cautare) | Cautare fara diacritice, cu toate cuvintele, in adresa si telefon; un numar scris cu spatii/puncte/prefix de tara se cauta intreg (si in cautarea globala) |
| M10 Campanii si marketing | Ghid „Prima ta campanie” (4 pasi) cand nu exista nimic; lista de campanii cu filtre si numere, stare clara („Oprita automat”, „Continua maine”); creare in 3 pasi scurti; Contacte cu filtre pe stare (inclusiv „Probleme de domeniu”), afisare treptata (100 odata) si avertisment cand lista depaseste limita incarcata; pregatirea contactelor din director intr-o sectiune inchisa implicit; etichete comune intr-un modul pur (`lib/adminOutreachLabels.js`); text cu diacritice si tokeni semantici in tot modulul |

### Verificare
- `scripts/verify-admin-panel-correctness.mjs`: 76 de verificari (etichete, reguli, citire pe id-uri, numaratori incl. esec/lentoare, adrese, rute vechi, cautare, jurnal de emailuri, etichete de campanii, fara `window.confirm`, fara `.workspace-neutral` in shell, fara culori scrise de mana in ecranele refacute).
- `npm run lint` (0 erori), `npm run lint:services`, `npm run build`: trec.
- `npm run test:all`: aceleasi 18 esecuri ca inainte de lucru (toate in afara panoului admin); 9 teste pe sursa au fost aliniate la noua structura (adrese in loc de stare locala, diacritice, bara de decizie).
- Verificare in browser pe date demonstrative (local, nepublicata), 12 suite: Panou/Profiluri/Integritate/Revendicari/Audit/Corectii/telefon/rute vechi (40 de pasi), Coada de verificare (28), Servicii pe locatii (13), Cautare globala (12), Emailuri automate (9), Campanii si marketing (12), Tichete suport + Feedback (21), Panou: procese automate (5), Plati si abonamente (13), Analytics (13), Contacte din cautari (14), toate sub-ecranele (16). Fara erori in consola; fara defilare orizontala la 390 si 320 px.

### Publicat si reparat (8 oct 2026)
Panoul a fost publicat pe Base44 pe 7 oct 2026 (PR #293, checkpoint „Panou admin: audit si imbunatatiri pe module”). Dupa publicare:
- **Plasa de siguranta pentru erori** (`shell/AdminErrorBoundary.jsx`, `lib/adminErrors.js`): inainte, o singura eroare la afisare golea toata pagina, inclusiv meniul. Acum cardul de eroare apare doar in locul ecranului, cu „Reincearca”, „Mergi la Panou” si „Copiaza detaliile”; la schimbarea sectiunii se reia. Daca fila a ramas deschisa in timpul unei publicari (fisierele ecranelor au alte nume), pagina se reincarca singura o data, apoi arata butonul „Reincarca pagina”. Cautarea globala care nu se incarca se inchide fara sa strice restul.
- **Date incomplete ca in productie** (`.harness`, local): fiecare ecran a fost rulat cu campuri optionale lipsa/null/goale. Corectate: suma cu moneda lipsa din „Plati” arunca „Invalid currency code” si prabusea ecranul (`lib/billingFormat.js`), data lipsa aparea ca „Invalid Date”, detaliul unei campanii lipsa, „undefined” in randul unei revendicari.
- **Verificari CI aliniate cu codul publicat** (doar teste): numarul de functii backend (52, dupa `adminAnalyticsOps` si `recordSearchEvent` din 5 oct), apelul LLM mutat in `patientNeedLlmEngine.js`, amprenta clientului de cautare cu `recordSearchEvent`, etichete cu diacritice, harta din profil. Copiile `shared/patientNeedInterpretation.js` si `shared/patientAnswerContradictions.js` au fost aduse la identitate cu cele din `base44/shared/`. `typecheck:services` trece (tipuri in `professionalIdentity.js`, ambele copii).
- **Ramas rosu, de decis:** `verify-org-account-audit-fixes` — pagina modulului de locatie nu mai arata „Locatie inchisa: nu apare public”.

### Ramas
- Import director (cod foarte dens, flux de aprobare cu fraza): textul are inca multe cuvinte fara diacritice si culori scrise de mana; se trateaza separat, cu atentie, fara a atinge logica.
- Integritate date: scanarea inca ruleaza in browser (5 liste de pana la 5.000 de randuri); mutarea ei pe server cere functie backend noua.
- Research director: ecranele raman in stilul vechi (campuri mici); au text corect, dar nu au fost redesenate.
- Campanii si marketing: ecranele de detaliu ale campaniei (public, editor de sablon, raport) au primit etichete, diacritice si tokeni, dar structura lor interna (pasii de construire a publicului) nu a fost simplificata.
- Emailurile trimise utilizatorilor (sabloanele din `base44/shared/automaticEmailCatalog.js`) sunt scrise fara diacritice („Buna ziua”): decizie de continut, necesita deploy de backend.
- T12 notificari catre admin (revendicare/tichet/sesizare noua) si email la raspunsul de suport: necesita functii backend.
- Panou: nu exista un semnal de „ultima rulare” pentru scheduler-ele din `base44/workflows` (nu scriu nicaieri o stare care sa se poata citi); alertele de mai sus acopera ce se poate masura (import blocat/esuat, campanii oprite, plati restante, emailuri esuate).
