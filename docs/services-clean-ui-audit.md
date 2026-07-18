# Audit UX — modulul Servicii

## Scop

Refacerea vizuala si organizationala pastreaza neschimbate catalogul canonic, cheile serviciilor, matchingul, prerequisitele, drafturile, review-ul si fallbackul V2/legacy.

## Ordinea de lucru afisata furnizorului

1. Spatiile existente fizic in locatie.
2. Activitatile speciale dependente de spatii.
3. Modul de functionare al locatiei.
4. Optiunile generale aplicabile intregii locatii.
5. Produsele si serviciile organizate pe spatiu.
6. Specialistii, echipamentele si facilitatile asociate.
7. Salvarea draftului si trimiterea spre verificare.

## Actiuni principale

- Navigare rapida: Configurare, Optiuni generale, Catalog servicii, Rezumat.
- Selectarea unui spatiu sau serviciu ramane o singura actiune pe rand.
- Eliminarea unui element aprobat continua sa foloseasca dialogul de dependente existent.
- Salvarea draftului ramane secundara.
- Trimiterea spre verificare ramane actiunea principala.
- Retragerea cererii ramane disponibila numai pentru drafturile aflate in verificare si numai in fluxul V2.

## Reguli responsive

- Pe desktop, catalogul si rezumatul raman in doua coloane.
- Pe telefon, rezumatul compact este afisat inaintea configurarii.
- Detaliile duplicate din sidebar sunt ascunse pe telefon.
- Randurile serviciilor trec la o singura coloana de continut, cu statusul sub denumire.
- Bara de actiuni ramane vizibila jos, iar butoanele devin late si usor de apasat.
- Campul de cautare foloseste font de minimum 16 px pe ecrane mici pentru a evita zoomul automat iOS.

## Elemente neschimbate

- `ProviderServicesWorkspaceOperational.jsx`
- functiile Base44
- entitatile si schema
- permisiunile owner/manager/read-only
- logica de salvare, submit, withdraw si dependency removal
- catalogul semantic si serviciile legacy
