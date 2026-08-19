# Audit mobil — modulul Servicii, pentru Opus

Data: 2026-08-19. Status: audit de expert, cercetat si verificat in cod — decizii
luate, gata de implementat. Nu e o lista de intrebari, e o directie.

Scop: performanta si aspect vizual ale modulului Servicii **la capacitate maxima
pe telefon** — nu ajustari cosmetice, ci verificare sistematica fata de standardele
reale (Apple Human Interface Guidelines, Material Design) si fata de codul existent.

---

## 1. CONSTATARI CRITICE — de implementat

### 1.1 Zona de atingere a randului CAS — sub minimul ambelor platforme

**Fisier**: `src/components/workspace/provider/services/ServiceRow.jsx`

Randul "Decontat prin CAS" (sub-randul de sub fiecare serviciu eligibil) foloseste
`py-2.5` (10px sus-jos) cu un singur rand de text la 11px. Inaltime rezultata:
aproximativ **34-36px**.

Minime recomandate: **44pt pe iOS**, **48dp pe Android** (Apple Human Interface
Guidelines: "Apple's minimum is 44x44 points. Smaller tap targets create friction
for users with motor impairments and inflate your error rates in analytics.").

**Decizie**: creste padding-ul vertical al randului CAS la minim `py-3.5` (14px),
tinta finala minim 44px inaltime totala. Verificat: nicio regula CSS din cele 3
fisiere nu compenseaza acest randul in acest moment (cautat explicit, nimic gasit).

### 1.2 Randul de navigare din lista "acasa" (drill-down mobil) — sub minim

**Fisiere**: `ProviderServicesFlow.css` (`.provider-services-three__step`, linia 795)
si `ProviderServicesTheme.css` (aceeasi clasa, linia 566, adauga grid dar nu
resetează padding-ul).

Padding actual: `8px 10px` → inaltime aproximativa **32-34px** cu un rand de text.
Acesta e randul cel mai frecvent apasat pe telefon — navigarea principala intre
"Spatiile existente", "La nivelul locatiei", fiecare zona din "Oferta pe zone".
Sub minimul de 44/48px, la un rand folosit constant, e mai grav decat cazul CAS.

**Decizie**: la breakpoint-ul mobil (`max-width: 820px`), adauga
`padding: 12px 10px` minim (tinta 44px+ inaltime totala cu text si icon).
Pe desktop (unde exista mouse, nu deget), 8px 10px ramane acceptabil — nu schimba
valoarea de baza, adauga un override specific in breakpoint-ul mobil.

### 1.3 Marimea textului — sub recomandarile ambelor platforme, pentru un public care are nevoie de text MAI mare

Cercetare (surse: Apple Human Interface Guidelines, Material Design 3, WCAG):

| Standard | Recomandare text principal |
|---|---|
| Apple HIG | 17pt |
| Material Design 3 | 16sp |
| WCAG (minim, nu ideal) | 14pt |
| Apple HIG — prag ABSOLUT minim, doar pentru fine print rar citit | 11pt |

Starea actuala in modul:
- Titlul serviciului: `text-sm` = **14px** — sub recomandarea ambelor platforme (16-17px), la limita minimului WCAG
- Descrierea serviciului (unificata azi la o singura valoare, dar valoarea insasi e problema): **11px** — exact pragul minim absolut al Apple, recomandat explicit doar pentru text rar citit, NU pentru continut principal

Descrierea nu e fine print — e explicatia a ce face fiecare serviciu ("Verifici cat
de bine vede clientul, la distanta si aproape."). E continut principal, citit de
fiecare data cand furnizorul decide ce sa bifeze. Si publicul modulului sunt
optometristi si oftalmologi — profesionisti care lucreaza cu pacienti care au
frecvent problema exact opusa (nevoie de text MAI mare, nu mai mic).

**Decizie**: pe breakpoint mobil (`max-width: 820px`):
- Titluri de rand (`.services-row__title` si echivalentele din SelectionCard,
  CapabilityToggle, CareSettingPicker): `14px` → **15px** minim, ideal `16px`
- Descrieri (`.services-row__detail` si echivalentele): `11px` → **13px** minim
- Pe desktop, unde spatiul si densitatea conteaza mai mult si utilizatorul nu tine
  telefonul la distanta variabila, valorile actuale (14px/11px) pot ramane —
  problema e specific mobila, nu universala.

Fisiere de atins: `ServiceRow.jsx`, `SelectionCard.jsx` (ambele variante),
`CapabilityToggle.jsx`, `CareSettingPicker.jsx` — toate patru au fost aliniate azi
la aceeasi valoare (11px descriere), acum trebuie adaugat un breakpoint mobil care
sa creasca acea valoare, nu schimbata valoarea de baza (desktop ramane cum e).

---

## 2. VERIFICAT, CONFIRMAT CORECT — nu necesita schimbare

### 2.1 Zona de siguranta (notch / home indicator)
Verificat in cod: `env(safe-area-inset-bottom)` folosit corect, in trei locuri
diferite (`ProviderServicesFlow.css` liniile 129, 355; `ProviderServicesTheme.css`
linia 262). Bara de actiuni si scroll-ul respecta corect zona de siguranta pe
iPhone-urile cu notch/home indicator.

### 2.2 Performanta listelor lungi (fara virtualizare)
Verificat: nu exista `react-window`, `react-virtual` sau alt mecanism de
virtualizare — toate randurile unei sectiuni deschise sunt in DOM simultan.
**Nu e o problema la dimensiunea actuala a catalogului** (maxim 28 de servicii
intr-o singura zona, maxim ~80 in total pe o locatie). Virtualizarea ar adauga
complexitate fara beneficiu masurabil sub cateva sute de randuri simultane.
Merita reconsiderat DOAR daca registrul de servicii creste semnificativ (ex. peste
150-200 de randuri simultan vizibile intr-o singura zona).

### 2.3 Cautarea, fara debounce
Verificat: fiecare litera tastata declanseaza filtrare imediata, fara debounce.
**Nu e o problema reala** — catalogul maxim (80 de servicii) se filtreaza instant,
sub 1ms, chiar si pe telefoane vechi. Debounce ar adauga complexitate pentru un
castig de performanta imposibil de masurat la aceasta scara de date.

### 2.4 Simbolul de categorie (CategorySymbol), randat de zeci de ori pe ecran
SVG simplu, 5 forme geometrice de baza (dreptunghiuri). Randat de pana la 8-10 ori
pe un ecran (o data per sectiune/grup). **Nu e o problema de performanta** — SVG-uri
de aceasta complexitate se randeaza trivial, fara cost masurabil, chiar si in
numar mare.

---

## 3. ORDINEA RECOMANDATA DE IMPLEMENTARE

1. **1.1 si 1.2** (zone de atingere) — risc de accesibilitate real, prioritate maxima
2. **1.3** (marime text mobil) — necesita breakpoint nou in 4 fisiere, testare vizuala
   dupa implementare pe un telefon real sau simulator, nu doar in cod

## 4. CE NU SE ATINGE

Logica de salvare, payload-ul, validarile, structura de date — nimic din auditul
acesta cere schimbari in `useProviderServicesConfig.js` sau in contractul de
backend. E strict prezentare si zone de atingere, pe breakpoint-ul mobil.
