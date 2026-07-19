# Rezolvarea identitatii unei locatii

Fluxul pentru adaugarea unei locatii intr-o organizatie existenta nu creeaza automat un rand nou atunci cand exista un profil posibil duplicat.

## Optiuni administrative

- `create_new`: creeaza un punct fizic separat. Pentru o potrivire puternica necesita confirmare explicita si nota de minimum 20 de caractere.
- `use_existing`: asociaza un profil neasociat sau deja apartinand aceleiasi organizatii.
- `transfer_existing`: muta profilul dintre organizatii dupa confirmare administrativa si nota de minimum 20 de caractere.

## Protectii

- solicitarea poate folosi numai candidatii verificati in payload;
- profilurile inchise sau suspendate nu pot fi asociate;
- transferul dezactiveaza membershipurile vechii organizatii pentru locatia respectiva;
- ownerii organizatiei destinatie primesc acces;
- organizatia sursa este arhivata numai daca nu mai are alte locatii active;
- decizia si modificarile sunt inregistrate in `DirectoryAuditRecord`.
