Status: DE FACUT — urmatoarea sesiune, cand Alex e acasa.
Data notarii: 2026-08-06

# Task: activare cont Google + test complet flux revendicare

## 1. Activare cont Google Cloud (blocant)
Contul Google nu e activ (Alex: "nu platisem aia 10 euro"). Trebuie activata
facturarea in Google Cloud Console — Google o cere chiar si pentru utilizare in
limita gratuita.

IMPORTANT (verificat 2026-08-06): din martie 2025 Google a inlocuit creditul unic
de 200$ cu praguri gratuite per SKU: 10.000 apeluri/luna pentru Essentials.
Masca de campuri din `placesDetails/entry.ts` cere DOAR campuri ieftine
(id, displayName, formattedAddress, addressComponents, location,
nationalPhoneNumber, websiteUri) — fara rating, recenzii sau fotografii, care ar
urca pretul la Enterprise. Deci utilizarea VIASEE incape confortabil in gratuit.

Recomandare: seteaza o COTA (quota) per API sub 10.000/luna. Alertele de buget
notifica dar NU opresc consumul; doar cotele opresc efectiv.

Config intern actual: GooglePlacesConfig are daily_session_limit 50,
monthly_session_limit 500 — se poate ridica dupa activare, pana aproape de 10.000.

## 2. De ce e blocant, nu optional
Fluxul de revendicare/adaugare locatie foloseste Google Places ca sa completeze
adresa si coordonatele (`GooglePlacesResults.jsx`, `ProviderAddLocationFlow.jsx`,
`ProviderLocations.jsx`). Daca contul nu e activ, un furnizor care vrea sa se
inscrie primeste eroare exact la prima lui interactiune cu platforma.

Concluzie importanta: NU e nevoie de o operatiune separata de completare a
coordonatelor pentru cele 1300 de locatii importate. Sistemul se auto-completeaza
pe masura ce furnizorii isi revendica profilurile, cu date confirmate chiar de ei —
mai de incredere decat potrivire automata in masa.

## 3bis. Unealta admin pentru editare manuala (gasita 2026-08-06)
Confirmat in cod: pagina de admin cu profiluri (`DirOpsProfiles.jsx`) are doar doua
butoane - "Verifica profil" si "Suspenda". NICIUN camp editabil. Functia backend
`updateProviderLocation` exista deja, dar e folosita doar in workspace-ul furnizorului
(`MyLocationCard.jsx`) si in teste - nicaieri in admin.

Decizie de produs discutata cu Alex: NU se trece la aprobare manuala universala a
tuturor locatiilor - ar contrazice filozofia "automation first" si ar bloca tot
directorul pana la revizuire manuala a ~1300 de locatii. Unealta de editare rapida e
solutia potrivita pentru ingrijorarea lui Alex, nu aprobarea universala.

## 3ter. Harta pe profilurile cu adresa (discutat 2026-08-06)
`react-leaflet` e instalat ca dependenta, dar NU e folosit nicaieri in cod (verificat:
zero rezultate in src/). Depinde de acelasi blocaj ca mai sus - are nevoie de
coordonate (lat/lng), care lipsesc aproape peste tot. Se rezolva natural cand se
activeaza Google Places (fiecare furnizor revendicat isi aduce coordonatele corecte).

## 3. Test complet flux revendicare (netestat pana acum)
Dupa activarea contului, de parcurs cap-coada, ca un furnizor real:
/adauga-sau-revendica -> cautare locatie -> formular claim -> review admin ->
membership activ -> configurare servicii in workspace.

E DRUMUL CRITIC al proiectului: fara el, directorul nu se poate umple cu date
confirmate, si toata munca de calitate a cautarii ramane teoretica.
