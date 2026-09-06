# VIASEE - preluare Codex, 6 septembrie 2026

## Directia primita de la Alex

Exclusiv VIASEE. Continuam munca existenta a lui Claude, fara reconstructie. Obiectivul general ramane coerenta conturilor client, organizatie, locatie, specialist si admin; profil profesional comun extensibil; relatii specialist-locatie-organizatie; selector clinici/optici versus specialisti in recomandari; Top 3 transparent, fara pay-to-rank; acelasi design; chat in contextul cererii. Backlog-ul din 12 iulie este istoric, se verifica fiecare punct in cod.

Punctul concret de intrerupere raportat de Alex: Claude incepuse directorul national pe harta dupa hartile din /rezultate si /cauta.

## Stare confirmata la preluare

GitHub main si checkpoint-ul Base44 initial coincid la a89525ea9ad4fabafda5e6de8c0a3671cdfbad1f. App: 6a48cb9d04fa7f999d8a8054. Checkpoint initial: 6a9dc020aa78bec867f63c82.

Exista deja src/pages/DirectoryMap.jsx, ruta /harta in App.jsx, legaturi in Layout, ResultsMap reutilizat si ramura map_scope=national in browseDirectoryProviders. Nu sunt creatii Codex. Pagina incarca locatiile nationale, filtreaza local dupa tip si permite accesul la profil din cardul hartii.

Numarul de 948 locatii geocodate si rezultatul 124/126 provin din predarea lui Claude; NU au fost reconfirmate pe baza de date in aceasta sesiune.

## Corectii Codex

- shared/resultsMapPoints.js: coordonatele absente, booleene, colectii si siruri goale nu mai sunt convertite la zero prin Number(). Sirurile numerice valide raman acceptate.
- scripts/verify-results-map.mjs: regresie pentru fiecare coordonata lipsa separat, tipuri invalide si coordonate numerice in format text.
- src/pages/DirectoryMap.jsx: mesaj corect dupa eroare si buton Reincearca; reincarcarea reseteaza starea explicit.

## Verificari efective

- node scripts/verify-results-map.mjs: OK.
- ESLint pe cele trei fisiere modificate: exit 0.
- npm run build: exit 0. Avertisment Browserslist pentru baza invechita, fara actualizare de dependinte.
- Browser catre site /harta: ERR_BLOCKED_BY_CLIENT. NU s-au confirmat vizual harta, responsive, tile-urile, clickurile sau numarul de locatii. Site-ul nu a fost publicat de Codex.

## De continuat

1. Verificare vizuala /harta, /cauta si /rezultate pe desktop si telefon.
2. Cazul locatiilor cu coordonate identice: clusterPoints separa toate punctele la zoom >=15; marker-ele identice se pot suprapune. Verificare si selectie explicita a locatiilor suprapuse, fara mutarea coordonatelor reale.
3. Ramura nationala numara profilurile suspendate printre total_published/without_position, desi nu le afiseaza. De corectat numaratorile cu teste pe eligibilitate.
4. loadAllPublicLocationsByCounty ascunde erorile de judet prin catch(() => []). Pentru harta nationala, o eroare partiala nu trebuie prezentata ca acoperire completa. Verificare distincta a comportamentului inainte de schimbarea helper-ului folosit si in alte fluxuri.
5. Audit pe codul actual pentru obiectivul general al conturilor; nu este finalizat in aceasta sesiune. Documentele din august contin reguli anterioare despre specialisti care trebuie comparate cu directia noua a lui Alex.

## Coordonare

Un singur agent scrie in sandbox-ul Base44 la un moment dat. Pentru munca simultana: taskuri separate in checkout-uri/branch-uri separate, integrare coordonata. Inregistrati fisierele atinse, verificarile efective si restul de lucru la fiecare predare. Nu folositi un raport vechi drept dovada ca fluxurile actuale functioneaza.
