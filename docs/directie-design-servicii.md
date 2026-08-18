# Directia de design — modulul Servicii

Data: 2026-08-06. Sursa unica de adevar pentru cum arata si se comporta
configurarea serviciilor. Orice schimbare viitoare de design se verifica
fata de acest document inainte de implementare.

## Regula controalelor

> **DECIZIE DE OWNER (2026-08-06):** serviciile folosesc **comutator**, nu bifa.
> Recomandarea initiala de mai jos a fost argumentata de trei ori si respinsa;
> decizia finala apartine owner-ului si e implementata ca atare.
> **CAS ramane bifa**, deliberat diferit: e un atribut al serviciului deja
> activat, nu o activare de sine statatoare.
> Nota tehnica ramasa valabila: selectia NU se aplica imediat, trece prin draft
> si "Trimite spre aprobare" — bara de actiuni de jos e singurul indiciu ca
> modificarile trebuie salvate. Tabelul de mai jos se pastreaza ca istoric al
> rationamentului, nu ca regula activa pentru servicii.

| Control | Cand se foloseste | De ce |
|---|---|---|
| **Bifa** (checkbox) | Selectie dintr-o lista, confirmata printr-o actiune separata | Serviciile, CAS, dotarile — nimic din ele nu se aplica pana nu apesi "Salveaza draftul" sau "Trimite spre aprobare". Comutatorul ar minti ca actiunea e instant. |
| **Comutator** (toggle) | Doar unde exista efect imediat, fara pas de confirmare | Nu exista niciun asemenea loc in acest ecran — totul trece prin draft. Daca apare un asemenea loc in viitor (ex. o setare care se aplica pe loc), atunci si numai atunci se foloseste comutator. |
| **Lista derulanta** (dropdown) | O singura alegere din mai multe optiuni numite | "Se realizeaza in [zona]", tipul activitatii. |
| **Card mare cu iconita** | Alegere rara, structurala, putine optiuni (sub 10) | Zonele existente, dotarile si activitatile, atributele de la nivelul locatiei. |
| **Rand compact cu bifa** | Selectie deasa, multe optiuni (10-30) | Catalogul de servicii dintr-o zona. |

Sursa cercetarii: regula "toggle = efect imediat, checkbox = confirmat prin salvare"
e standard de design (NN/g, UX Collective), nu inventie proprie. Inversarea ei
induce utilizatorul in eroare cu privire la ce s-a aplicat deja.

Daca cineva cere din nou comutator la selectia de servicii: raspunsul e nu,
cu acest motiv. Daca comportamentul de salvare se schimba vreodata (ex. salvare
automata pe fiecare bifare, fara pas de "Trimite"), ATUNCI regula se schimba
si comutatorul devine corect.

## Sistemul de culoare — preluat din homepage, nu inventat

Sursa: `src/components/home/CategoryShowcase.jsx`, cele 5 categorii afisate
pe pagina principala. Culorile de mai jos sunt valorile hex exacte de acolo.

| Categorie homepage | Culoare | Grupuri de servicii mapate |
|---|---|---|
| Ochelari si lentile | `#efd5c5` | optical_retail, lenses_and_measurements |
| Control de vedere | `#dce5e9` | optometry, contact_lenses |
| Medici si clinici | `#e8e0ea` | ophthalmology_consults, specialties, procedures_surgery, children_and_prevention |
| Investigatii | `#dfe3d2` | investigations |
| Reparatii si reglaje | `#eadcba` | technical_activities |
| — (fara culoare) | — | business_attributes (nu e categorie de pe homepage, e atribut de afacere) |

Aceeasi mapare determina si culoarea zonelor fizice (Magazin optic → piersica,
Cabinet optometric → albastru-gri etc.) — vezi `UNIT_TONE` in
`ProviderServicesWorkspaceOperational.jsx` pentru maparea completa pe toate
cele 10 zone, cu justificarea fiecareia in comentariu.

Unde apare culoarea: placa mica (bulina) langa titlul fiecarei sectiuni de
servicii si placa iconitei fiecarei zone, in continut si in sidebar.

Unde NU apare culoarea, deliberat: pe randul de serviciu, indiferent daca e
activat sau nu; atributele de la nivelul locatiei (nu sunt categorie de pe
homepage).

Corectie 2026-08-18: linia colorata din stanga serviciilor activate a fost
ELIMINATA din implementare inca din 2026-08-06 (arata ca o eroare de randare).
Descrierea anterioara de aici o mai cerea si contrazicea codul.

## Spatiere si tipografie

- Randurile de servicii: fara chenar, fara colturi rotunjite, fara fundal
  propriu — doar linie fina de separare (`border-bottom`) intre randuri din
  acelasi grup.
  Corectie 2026-08-18: fundalul alternant pe randul par a fost ELIMINAT din
  implementare (facea lista sa arate ca tabel bifat, nu ca panou de setari).
  Nu se reintroduce.
- Titlurile de grup: 15px, bold, cu spatiu generos deasupra (`pt-7`), fara linie
  de separare intre grupuri — spatiul singur marcheaza trecerea la alt subiect.
- Randul de serviciu: doua niveluri de text — titlu (14px, semibold) si
  descriere (11px, gri) dedesubt. Vezi `shared/serviceDescriptions.js`.
- Antetul paginii: un singur rand, titlu compact + locatia ca subtitlu, X in
  dreapta care duce inapoi la lista de locatii (nu antet de pagina pe 3-4 randuri).

## Planul de refactorizare

Structura, arhitectura si ordinea fazelor sunt descrise in
`docs/plan-refactor-servicii-2026-08-18.md`. Documentul de fata ramane sursa
pentru regulile vizuale; planul este sursa pentru arhitectura si pasii de lucru.

## Ce ramane deschis (nu inca decis)

- Descrierile exista doar pentru cele 21 de servicii de pe Lunera. Restul
  catalogului (peste 100 de servicii) nu are inca descriere — randul arata
  doar cu titlu, fara al doilea nivel de text, pana se scriu.
- Suprapunere vs pagina separata pentru Servicii ca fereastra — decizie
  discutata cu Opus, nu inca finala (vezi `docs/servicii-audit-si-directie-pentru-opus.md`).