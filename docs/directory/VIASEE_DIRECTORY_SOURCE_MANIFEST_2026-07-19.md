# VIASEE Directory — source manifest si checkpoint de integritate

**Data:** 2026-07-19  
**Scop:** pastrarea surselor de cercetare si blocarea oricarui import prematur  
**Status:** sursa privata de staging; nu este pregatita pentru import sau publicare

## 1. Surse inghetate

### Registru cumulativ V2

- Nume primit: `viasee_directory_registry_v2_bistrita_final.md`
- Dimensiune: 911452 bytes
- Linii: 2395
- SHA-256: `61b7f12385e694ec5a9f49e1ed35699a7343fe1ff4e1978bc8e10e58f6140ed3`
- Versiune declarata: 2026-07-19

### Changelog cumulativ V2

- Nume primit: `viasee_directory_registry_v2_changelog_bistrita_final.md`
- Dimensiune: 111310 bytes
- Linii: 648
- SHA-256: `ad2cbe275e87c15b25306558c47a18f68309557cba612feebfb7b2a02fe4830c`
- Versiune declarata: 2026-07-19

Fisierele originale trebuie pastrate nemodificate. Orice corectie ulterioara se face intr-o versiune noua, nu prin rescrierea silentioasa a snapshotului V2.

## 2. Ce declara snapshotul V2

- 1342 randuri V2;
- 1019 `official_confirmed`;
- 268 `official_partial`;
- 39 `discovery_only`;
- 16 `excluded`;
- toate orasele planificate sunt declarate inchise;
- urmatorul pas declarat este auditul national final, deduplicarea transversala si selectia pentru import controlat.

Aceste valori sunt utile ca checkpoint narativ, dar nu pot fi tratate drept inventar canonic fara reconciliere structurala.

## 3. Audit structural al fisierului primit

Parserul tabelar a gasit:

- 74 tabele cu schema de 18 coloane;
- 1265 randuri tabelare efective;
- distributie efectiva:
  - `official_confirmed`: 954;
  - `official_partial`: 256;
  - `discovery_only`: 39;
  - `excluded`: 16;
- 14 randuri sunt rezumate generice despre acoperirea unor retele, nu locatii fizice;
- dupa eliminarea acestor 14 pseudo-locatii raman 1251 randuri de locatie/excludere efectiv reprezentate in tabele.

### Diferenta Bucuresti

Tabelele din registru contin numai loturile initiale sau intermediare pentru mai multe sectoare, desi rezumatul si changelogul declara inchiderea finala la 229 locatii.

| Sector | Declarat final | Randuri efective in tabel | Lipsa |
|---|---:|---:|---:|
| Sector 1 | 50 | 35 | 15 |
| Sector 2 | 34 | 29 | 5 |
| Sector 3 | 51 | 22 | 29 |
| Sector 4 | 34 | 27 | 7 |
| Sector 5 | 21 | 21 | 0 |
| Sector 6 | 39 | 18 | 21 |
| **Total** | **229** | **152** | **77** |

Diferenta de 77 randuri explica exact diferenta dintre distributiile declarate si distributiile efectiv parsate.

### Verdict de integritate

Snapshotul V2 este valoros ca cercetare si jurnal de decizii, dar nu este un fisier final importabil:

1. 77 randuri Bucuresti sunt descrise in changelog, dar nu sunt prezente ca randuri complete in tabelele registrului;
2. 14 randuri generice de retea folosesc schema de locatie si pot fi numarate accidental ca locatii;
3. valoarea `1342 locatii reale` nu poate fi folosita ca total canonic pana la reconstruirea randurilor lipsa si eliminarea pseudo-locatiilor;
4. toate statusurile V2 sunt statusuri de cercetare, nu statusuri publice VIASEE.

## 4. Regula de siguranta

Pana la reconcilierea V3:

- nu se importa nimic in Base44;
- nu se creeaza profiluri publice din acest fisier;
- nu se marcheaza nicio locatie `claimed` sau `verified`;
- nu se confirma servicii pentru matching;
- nu se creeaza specialisti;
- nu se atribuie automat locatii unei organizatii doar pe baza asemanarii de nume.

## 5. Sursa de adevar pentru continuare

Ordinea de incredere este:

1. snapshoturile originale V2, verificate prin checksum;
2. randurile complete de locatie, nu rezumatele narative;
3. sursa oficiala specifica locatiei;
4. deciziile de reconciliere documentate;
5. registrul canonic V3 rezultat dupa audit.

Changelogul ramane jurnal de decizie si instrument de recuperare a loturilor lipsa. El nu substituie randurile structurate necesare importului.
