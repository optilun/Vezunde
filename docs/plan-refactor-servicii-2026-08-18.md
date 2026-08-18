# Plan de refactorizare — modulul Servicii (VIASEE)

Data: 2026-08-18
Versiune de referinta: GitHub `main`, revizia sincronizata `viasee-runtime-resync-2026-07-28-directory-runtime-info-compat-4`
Status: PLAN APROBAT DE OWNER PENTRU DOCUMENTARE, NEIMPLEMENTAT
Sursa de adevar pentru design: acest document + `docs/directie-design-servicii.md` (dupa corectiile din Faza 0)

---

## 0. Scopul documentului

Acest document este briefingul unic pentru refactorizarea modulului Servicii din
workspace-ul furnizorului. Este scris ca sa poata fi dat direct unui model AI
(recomandat: Opus 5) fara context suplimentar.

Regula de baza: **logica de business NU se schimba.** Se schimba doar modul in
care interfata este construita si prezentata.

---

## 1. Ce NU se modifica (interzis fara cerere explicita noua)

- Catalogul canonic de servicii si maparea pe grupuri.
- Fluxul draft → salvare → trimitere spre aprobare → retragere.
- Contractele backend: `providerServiceConfigurationOps`,
  `getProviderServiceConfiguration`, `getServiceSearchCatalog`,
  `submitProviderWorkspaceChange` (fallback compatibil).
- Forma payload-ului trimis la salvare, inclusiv `selected_ids`, `removal_ids`,
  `service_unit_map`, `cas_service_keys`, `capabilities`, `functional_units`,
  `resource_links`, `resource_removals`, `care_setting`.
- Logica de dependente la eliminarea unei zone sau activitati, inclusiv
  dialogul de confirmare si restaurarea configuratiei aprobate.
- Motorul de prerechizite (`servicePrerequisiteEngine`).
- Matching, ranking, Top 3, provider recommendation, distribuirea cererilor.
- Entitati, schema, RLS, date.

---

## 2. Problemele constatate la audit

1. **Doua interfete suprapuse.** Componenta exterioara identifica sectiunile
   generate de componenta operationala prin text vizibil ("1. Zonele existente"),
   clase Tailwind si ordinea copiilor, apoi le rescrie prin `MutationObserver`
   si `data-*`. Orice redenumire sau reordonare rupe tacit navigarea.
2. **Straturi CSS concurente.** Cinci fisiere CSS importate, fisierul principal
   ~2.900 linii, cu reguli succesive pentru trei coloane, doua coloane, carduri,
   randuri plate si continut direct pe canvas. Rezultatul final depinde de
   ordinea de import, nu de o directie unica.
3. **Document de design parțial expirat.** `docs/directie-design-servicii.md`
   mai descrie linia colorata pe serviciile bifate si fundalul alternant, desi
   ambele au fost eliminate ulterior.
4. **Componenta operationala prea mare** (~1.850 linii): date, stare, dependente,
   cautare, randuri, dialoguri si prezentare in acelasi fisier.
5. **Experienta prea apropiata de wizard.** Modulul trebuie sa se comporte ca
   ecran de setari recurente, nu ca onboarding parcurs de la capat.

---

## 3. Directia de design tinta

### 3.1 Desktop (peste 1024px)

Doua coloane: navigare la stanga, o singura suprafata de lucru la dreapta.

**Navigare (stanga)**
- Cautare in capul coloanei.
- Trei grupuri: `Structura`, `Oferta pe zone`, `Verificare`.
- Rand = iconita + nume complet. Fara numere `01`/`02`, fara contoare pe rand.
- Bifa discreta de completare doar pe randurile din `Structura` si `Oferta pe zone`.
- Numai randul activ primeste fundal gri cald; fara accent albastru.
- `Verificare` separata printr-o linie fina.

**Suprafata de lucru (dreapta)**
- Titlul sectiunii apare o singura data, urmat de o descriere de un rand.
- O singura suprafata alba, fara carduri imbricate.
- Fara al doilea antet in interiorul continutului.
- Fara al doilea camp de cautare.

**Randul de serviciu**
- Titlu (14px, semibold) si descriere (12px, gri) in stanga.
- Comutator in dreapta, culoare "pornit" = `foreground` VIASEE.
- CAS apare doar sub serviciul activ eligibil, ca rand secundar indentat, cu bifa.
- Separare exclusiv prin `border-bottom` fin.
- Fara fundal alternant. Fara chenar pe rand. Fara linie colorata in stanga.
- Culoarea categoriei apare numai ca bulina langa titlul grupului.

**Tipuri de control**
| Element | Control |
|---|---|
| Zonele existente | card compact cu iconita |
| Dotari si activitati | card compact cu iconita |
| Tipul activitatii | lista derulanta |
| Servicii | rand cu comutator |
| Decontare CAS | bifa secundara sub serviciu |
| Resurse asociate zonei | sectiune pliabila |
| Propunere manuala | link discret la finalul grupului |

**Bara de actiuni**
- Fixata jos, afisata numai cand exista actiuni disponibile.
- Stanga: starea ("Ai modificari nesalvate", "Draft salvat", "In verificare").
- Dreapta: `Salveaza draftul`, `Trimite spre aprobare`, `Retrage cererea`.
- O singura bara. Bara interna a componentei operationale se elimina.

### 3.2 Mobil (sub 1024px)

- Ecran initial: lista sectiunilor, grupata identic cu navigarea de pe desktop.
- Apasarea unui rand deschide sectiunea ca ecran propriu.
- Buton clar de intoarcere: `Inapoi la Servicii`.
- Fara sidebar orizontal derulabil, fara overlay `position: fixed`,
  fara rezumat care repeta cifrele din lista.
- Bara de actiuni se ridica deasupra navigarii aplicatiei.

---

## 4. Arhitectura tinta

### 4.1 Un controller pentru date si stare

Fisier nou: `src/components/workspace/provider/services/useProviderServicesConfig.js`

Contine, mutat 1:1 din componenta actuala, fara schimbari de comportament:
- incarcarea (catalog, configuratie, submisii, fallback legacy);
- starea selectiei, zonelor, activitatilor, CAS, resurselor, `care_setting`;
- `buildPayload`, semnatura de configuratie, calculul `dirty`;
- prerechizitele;
- dependentele si restaurarea;
- `save`, `submit`, `withdraw`.

Returneaza o singura valoare de stare plus handlerele. Nu randeaza nimic.

### 4.2 Componente de prezentare

Toate in `src/components/workspace/provider/services/`:

| Fisier | Rol |
|---|---|
| `ProviderServicesScreen.jsx` | compune navigarea, antetul, continutul si bara de actiuni |
| `ServicesNav.jsx` | coloana din stanga pe desktop |
| `ServicesMobileIndex.jsx` | ecranul-lista pe mobil |
| `ServicesSectionHeader.jsx` | titlu si descriere, o singura data |
| `UnitPicker.jsx` | zonele existente |
| `CapabilityPicker.jsx` | dotari si activitati |
| `CareSettingPicker.jsx` | tipul activitatii |
| `ServiceGroupList.jsx` | grupul de servicii al unei zone |
| `ServiceRow.jsx` | randul de serviciu si CAS |
| `UnitResourcesPanel.jsx` | resursele zonei |
| `ServicesActionBar.jsx` | bara de actiuni |
| `ServicesSearchResults.jsx` | rezultatele cautarii |

Regula: fiecare fisier sub ~150 linii; niciun fisier nu contine si logica de
persistenta si prezentare.

### 4.3 Eliminarea decorarii DOM

Se elimina complet:
- `MutationObserver` din `ProviderServicesThreeColumn.jsx`;
- `findMainGrid`, `cleanText`, `decorate`;
- identificarea sectiunilor dupa titluri numerotate;
- atributele `data-services-panel`, `data-services-substep`,
  `data-service-filter-visible`, `data-services-unit-visible`;
- click-urile programatice pe butoanele interne (`header?.click()`);
- titlurile numerotate ascunse vizual, care existau doar ca ancore de selectie.

Sectiunea activa, filtrul si zona deschisa devin proprietati transmise direct.

### 4.4 Un singur strat de styling

- Se pastreaza un singur fisier: `ProviderServices.css`, cu clase proprii,
  scrise pentru structura noua.
- Se elimina, dupa migrare: `ProviderServicesThreeColumn.css`,
  `ProviderServicesRefinement.css`, `ProviderServicesActionBar.css`,
  `ProviderServicesSidebars.css`, `ProviderServicesSidebarsTune.css`.
- Interzis in fisierul nou: selectori care depind de clase Tailwind
  (`[class*="rounded-2xl"]`), `:has(> button[data-service-key])`,
  `!important` folosit ca sa anuleze alt strat propriu.
- Culorile se iau din tokenii din `src/index.css`; hex direct doar pentru
  paleta de categorii preluata din `CategoryShowcase.jsx`.

---

## 5. Ordinea de implementare

**Faza 0 — corectarea documentatiei (fara cod)**
Actualizarea `docs/directie-design-servicii.md`: eliminarea liniei colorate si a
fundalului alternant din descriere, ca sa nu mai contrazica implementarea.

**Faza 1 — extragerea controllerului**
Mutarea logicii in `useProviderServicesConfig.js`, fara schimbari vizuale.
Criteriu de acceptare: interfata arata si se comporta identic.

**Faza 2 — componente de prezentare**
Spargerea randarii in componentele din 4.2, tot fara schimbari vizuale.

**Faza 3 — eliminarea decorarii DOM**
Navigarea si filtrarea trec pe proprietati. Se sterge `MutationObserver`.

**Faza 4 — noul strat de styling**
Un singur CSS, structura de doua coloane, randuri plate, bara unica de actiuni.

**Faza 5 — mobil**
Lista, drill-down, buton de intoarcere, bara de actiuni deasupra navigarii.

**Faza 6 — curatare**
Stergerea fisierelor CSS vechi si a componentelor ramase fara utilizare.

Fiecare faza este un pas separat, verificabil independent.

---

## 6. Criterii de acceptare

- Nicio schimbare in payloadul trimis la salvare, pentru aceeasi configuratie.
- Draft, trimitere, retragere si fallback legacy functioneaza ca inainte.
- Dependentele la eliminarea unei zone sau activitati se comporta identic.
- Navigarea intre sectiuni functioneaza fara cautare in DOM.
- Un singur titlu si un singur camp de cautare pe ecran.
- O singura bara de actiuni.
- Fara derulare orizontala la 1458px, 1024px, 768px si 390px.
- Sub 820px, apasarea unui rand deschide sectiunea corespunzatoare, inclusiv
  `Dotari si activitati` si `Tipul activitatii`.

---

## 7. Model AI recomandat

- **Opus 5** pentru fazele 1-5: audit pe mai multe fisiere, separarea logicii de
  prezentare, refactorizare fara pierdere de comportament.
- **GPT-5.6 Sol** pentru corectii punctuale ulterioare si verificari.
- Nu se recomanda Auto mode pentru aceasta lucrare: schimbarea modelului intre
  cereri pierde coerenta directiei.

Instructiunea de deschidere pentru model:
> Citeste `docs/plan-refactor-servicii-2026-08-18.md` si
> `docs/directie-design-servicii.md`. Implementeaza numai faza indicata.
> Nu modifica logica de business, contractele backend sau payloadul de salvare.