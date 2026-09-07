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


## Continuare 7 septembrie - cautare si harta unificate

Cerinta explicita Alex: o singura intrare in navbar, nu module separate Cauta si Harta.

Aplicat: Layout pastreaza doar Cauta in header/footer; meniul mobil avea deja doar Cauta. /harta si /cautare redirectioneaza la /cauta pastrand query/hash. Search integreaza DirectoryMap ca sectiune nationala cand nu sunt selectate localitate sau serviciu/text; tipul de furnizor este controlat de filtrul comun. Dupa alegerea localitatii se pastreaza cautarea existenta cu lista/harta. Pentru serviciu/text fara localitate se cere localitatea explicit, fara extindere automata. DirectoryMap nu mai are al doilea selector sau actiune duplicata. Detectia coordonatelor pe Search foloseste validatorul comun. Harta sticky respecta header-ul fix.

Verificat: verify-results-map OK, ESLint pe fisierele modificate exit 0, build exit 0. Regresie directa pentru doua pozitii identice la zoom 15/17/19 OK. verify-professional-architecture: 31/31. verify-professional-recommendation: 31/31. Nu s-a facut publicare de catre Codex; modificarea curenta necesita verificare vizuala in versiunea publicata/preview.

Observatie de continuitate: in codul gasit la reluare, loader-ul national a fost deja corectat pentru codurile numerice SIRUTA in alta sesiune. Nu am suprascris acea corectie sau modificarile la geocodare. Domeniul actual confirmat de Alex este https://viasee.ro/; adresa veche base44.app nu se mai foloseste.


## 2026-09-07 — Bara de cautare simplificata
- Search.jsx: doua campuri vizibile, «Ce cauți?» si «Unde?». Eliminate dropdown-urile separate Serviciu si Tip de furnizor; serviciile se aleg din sugestii (maximum 6).
- Pastrate ResultModeTabs, LocalityAutocomplete, ResultsMap si design tokens existente. Campuri suprapuse pe mobil, doua coloane de la md.
- Buton de stergere doar cand exista cautare; sugestii inchise la Escape, iesirea focusului si selectie. Serviciul din URL ramane vizibil in camp.
- Fara modificari de date/backend/matching. Filtrarea ascunsa dupa tip eliminata din Search; toate tipurile sunt incluse.
- Verificari: eslint Search.jsx 0 erori (un warning preexistent _error), verify-results-map OK, npm run build exit 0.
- Inspectie vizuala a versiunii publicate viasee.ro/cauta: inca bara veche cu 4 campuri si navigare separata Harta. Codul nou nu a fost publicat; verificarea vizuala a noii versiuni si interactiunea pe mobil raman de facut dupa preview/publicare.


## 2026-09-07 — Continuitate cautare si componenta comuna
- Search session: criterii, mod, selectie si scroll pastrate in sessionStorage cu TTL 30 minute, fara text liber in URL; harta pastreaza bounds pentru acelasi set de rezultate. Rezultatele se recitesc de la server.
- Specialistii primesc meta/contextul motorului existent al locatiilor (servicii rezolvate si need_level). Textul nemapat solicita selectie de serviciu; nu afiseaza tot directorul ca potrivire.
- Stari de eroare distincte cu Reincearca pentru cautare si specialisti. Anulare logica a raspunsurilor vechi la schimbarea textului.
- LocationsWithMap reutilizat in Search si DirectoryMap; comutare flotanta pe mobil, actiune explicita Vezi pe harta, focus/hover comun. Directorul filtreaza numai lista dupa viewport, fara a restrange setul de puncte al hartii.
- ProviderProfile are link inapoi la cautare; ProfessionalProfile il avea deja.
- Limita: cautarea locala ramane definita de localitatea selectata. Cautarea serviciilor dupa un dreptunghi arbitrar pe harta nu este implementata; ar necesita suport explicit al motorului. Nu extinde automat criteriile. Preview vizual si verificare browser/mobile raman de facut; nu s-a publicat.
