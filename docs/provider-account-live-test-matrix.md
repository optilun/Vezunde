# Matrice de verificare live pentru contul furnizorului

Acest document completeaza testele automate de contract. Verificarea live se executa dupa sincronizarea functiilor si schemelor in Base44.

## Roluri de test

- owner organizatie;
- manager locatie;
- membru locatie;
- administrator VIASEE;
- utilizator invitat nou.

## Date minime

- o organizatie cu doua locatii aprobate;
- o locatie existenta neasociata in director;
- o locatie apartinand altei organizatii de test;
- un serviciu publicat;
- un logo publicat;
- o fotografie publica a locatiei.

## Scenariul principal: draft -> completari -> aprobare -> public

1. Ownerul modifica datele profilului organizational si salveaza draftul.
2. Datele publice raman neschimbate.
3. Ownerul trimite draftul spre verificare.
4. Cererea apare in coada admin cu status `pending_review`.
5. Adminul cere completari si adauga o nota.
6. Ownerul vede statusul si nota, corecteaza datele si retrimite.
7. Adminul aproba.
8. Datele aprobate apar in profilul public.
9. Draftul si nota administrativa nu apar in endpointurile publice.
10. `DirectoryAuditRecord` contine trimiterea, solicitarea de completari, retrimiterea si aprobarea.

## Program

- salveaza un program valid si verifica publicarea imediata;
- incearca o ora de inchidere mai mica decat ora de deschidere;
- incearca o exceptie cu data finala mai mica decat data initiala;
- incearca doua exceptii suprapuse;
- confirma ca toate cazurile invalide sunt respinse in backend.

## Servicii

- salveaza draftul fara sa trimiti;
- verifica faptul ca serviciile publice nu se schimba;
- trimite si cere completari din admin;
- retrimite si aproba;
- verifica actualizarea `LocationService` si a matchingului;
- retrage o eliminare aflata in verificare si verifica restaurarea eligibilitatii.

## Fotografie locatie

- selecteaza un fisier si renunta inainte de salvare: nu trebuie sa existe upload;
- salveaza draftul: assetul trebuie legat de submission;
- inlocuieste draftul: assetul vechi intra in `pending_cleanup`;
- retrage draftul: assetul intra in coada admin de curatare;
- aproba o fotografie si verifica publicarea;
- respinge o fotografie si verifica faptul ca fotografia publica anterioara ramane neschimbata.

## Logo organizatie

- trimite logo-ul si verifica statusul separat `pending_review`;
- confirma ca datele text ale profilului isi pastreaza propriul status;
- respinge logo-ul cu nota si verifica mesajul ownerului;
- aproba o varianta noua si verifica logo-ul public;
- incearca trimiterea altui logo cat timp unul este in verificare.

## Locatii si duplicate

- adauga un punct de lucru fara potriviri si aproba o locatie noua;
- selecteaza un profil neasociat si aproba asocierea;
- selecteaza un profil al altei organizatii si aproba transferul cu confirmare si nota;
- verifica dezactivarea membershipurilor vechi doar pentru locatia transferata;
- verifica accesul ownerilor organizatiei destinatie;
- incearca ignorarea unei potriviri puternice fara confirmare si nota.

## Starea locatiei

- solicita ascunderea si verifica aparitia in coada admin;
- aproba si verifica disparitia din cautare;
- solicita republicarea si aproba;
- solicita inchiderea ultimei locatii active si verifica arhivarea organizatiei;
- confirma ca nu este generat niciun link `mailto:`.

## Acces si invitatii

- trimite o invitatie catre un utilizator existent;
- trimite o invitatie catre o adresa externa prin Resend;
- opreste temporar secretele email si verifica fallbackul manual;
- accepta invitatia si verifica membershipurile;
- incearca eliminarea ultimului owner;
- revoca o invitatie si verifica imposibilitatea acceptarii ulterioare.

## Prezentare generala

Dupa fiecare actiune de mai sus:

- revino in Prezentare generala;
- verifica actualizarea indicatorilor fara refresh manual;
- schimba tabul si revino in aplicatie pentru a verifica refreshul la focus;
- confirma actualizarea activitatii recente, a modificarilor active si a continutului public.

## Criteriu de acceptare

Fluxul este considerat valid numai daca:

- datele neaprobate nu ajung in endpointurile publice;
- fiecare tranzitie are status coerent;
- completarile si respingerile necesita nota;
- fiecare aplicare administrativa este auditata;
- permisiunile sunt verificate in backend;
- utilizatorul vede rezultatul actiunii si urmatorul pas.
