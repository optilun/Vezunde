# VIASEE: inboxul centralizat pentru proprietar

Data: 26 septembrie 2026. Aplicatie Base44: 6a48cb9d04fa7f999d8a8054.

## Rezultat

Proprietarul cu cel putin doua locatii accesibile are optiunea Toate locatiile, filtru de locatie, filtre de stare si paginare. Lista pastreaza un rand per ProviderLead; aceeasi cerere poate avea mai multe livrari, grupate vizual numai in pagina curenta. Contoarele disting livrarile de cererile distincte. Selectia deschide exact leadul in inboxul locatiei, inclusiv atunci cand nu se afla intre primele 100 de rezultate.

Proprietarul global vede locatiile organizatiei, inclusiv locatii noi fara membership direct. Proprietarul selectiv vede numai locatiile atribuite. Managerul, personalul si organization_admin nu primesc vederea agregata. Autorizarea este derivata pe server, inclusiv pentru actiunile per locatie; o lista de ID-uri trimisa de client nu acorda acces.

Rezumatul agregat foloseste lista alba Free pentru toate randurile. Planul este indicat separat pentru fiecare locatie; datele private si actiunile sunt accesate in inboxul locatiei, prin regulile existente de entitlement, Top 3 si consimtamant. Cheia de grupare este opaca si temporara; request_id nu este returnat. Starea de plan afisata in panourile locatiei este legata de location_id, pentru a nu afisa temporar Pro de la locatia precedenta.

Notificarile arata locatia si navigheaza folosind lead_id plus location_id. Feedul agregat foloseste endpointurile autorizate existente, maximum cinci apeluri simultane, erori partiale vizibile si actualizare la intrare, redeschidere sau manual. Pollingul periodic ramane doar la o locatie. Generarea si deduplicarea emailurilor raman separate per locatie.

## Integrare

Operatia logica providerOrganizationLeadInboxOps se afla in base44/functions/getMyProviderWorkspace/providerOrganizationLeadInboxOps.ts si este rutata prin endpointul existent getMyProviderWorkspace. Ambele harti de rutare, din shared si base44/shared, sunt actualizate. Contractul ramane la 49 de functii fizice; workspace-ul are 14 rute logice.

providerOwnerWorkspaceScope extinde numai citirea workspace-ului cu acces owner virtual, fara a crea membership-uri. providerLeadLocationAccess verifica membership-ul direct sau accesul global al unui owner activ in aceeasi organizatie. Helperul este utilizat de inbox, raspuns, contact, chat, entitlement si de citirile auxiliare necesare navigarii.

Lista agregata citeste datele in pagini SDK de 500, fara trunchiere silentioasa la prima pagina. Pentru leaduri cu termen depasit, providerOrganizationLeadLifecycle citeste cererea originala si proiecteaza starea terminala in memorie. O cerere prelungita nu este declarata expirata pe baza snapshotului vechi al leadului. Aceasta operatie nu scrie date si nu trimite notificari. Reconcilierea persistenta ramane in fluxurile existente.

Nu au fost modificate de aceasta implementare matchingul, rankul, Top 3, regulile de consimtamant, pretul de 49 RON/luna per locatie sau operatiunile Stripe. Modificarile concurente din alte module au fost pastrate.

## Verificari

Testele specifice trec pentru:
- owner global/selectiv, roluri negative, organizatie straina si locatie noua fara membership direct;
- handlerul real al workspace-ului si citirile entitlement/completeness/overview, executate cu entitati in memorie;
- handlerul real al inboxului agregat, paginare SDK peste 500 de leaduri si 601 locatii in scope;
- izolarea Pro/Free, lipsa datelor private si a request_id, grupare opaca si contoare;
- expirare proiectata fara mutarea randului stocat si cerere prelungita;
- target lead dincolo de primele 100, schimbare de organizatie/filtru si notificari per locatie;
- regresiile existente pentru raspunsuri, contact, chat, lifecycle, acces, profil si rutare.

ESLint pe componentele modificate si npm run build: trecute.

npm run test:all: 148 trecute, 6 esuate, 1 sarita pentru CI, din 155 de scripturi. Esecurile sunt in afara implementarii inboxului:
- verify-dead-code-cleanup: referinta ProviderServicesThreeColumn;
- verify-directory-auto-import: schema temporara _noop_invalid;
- verify-home-performance: regula sticky a primului ecran;
- verify-outreach-email-router: culoarea CategoryShowcase;
- verify-page-stability-performance: inaltimea antetului desktop;
- verify-seo-profiles: referinta sitemap-locatii.

## Limite si stare de livrare

Codul este salvat in sandbox. Resursele backend sunt supuse auto-sync-ului Base44, dar testele de mai sus nu confirma o invocare autentificata a runtime-ului publicat. Frontendul nu a fost publicat in aceasta sesiune. Nu s-a folosit deploy, push sau restore.

Fluxul cu doua locatii a fost verificat prin teste de integrare cu date in memorie, nu printr-o sesiune live de owner cu doua locatii. Contul disponibil anterior avea o singura locatie.

Pentru contoare exacte, fiecare incarcare a listei reciteste leadurile locatiilor autorizate; costul creste cu istoricul retelei. Paginarea afisata nu este o paginare globala executata de baza de date. Feedul de notificari afiseaza cel mult cele mai recente 100 de notificari reunite. Aceste limite sunt explicite pentru o optimizare ulterioara, fara a relaxa autorizarea.
