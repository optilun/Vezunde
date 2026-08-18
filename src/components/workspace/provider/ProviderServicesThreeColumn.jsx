import React, { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Eye,
  FlaskConical,
  Glasses,
  Hospital,
  ListFilter,
  Microscope,
  PackageOpen,
  Search,
  Stethoscope,
  Store,
  Wrench,
  X,
} from "lucide-react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";
import ServicesHeaderActions from "./services/ServicesHeaderActions";

// Iconita fiecarei zone, dupa cheia ei. Deliberat iconite, nu imagini generate:
// imaginile AI ar consuma credite la fiecare afisare, s-ar incarca lent si ar bate cap
// in cap cu estetica editoriala a aplicatiei.
const UNIT_CARD_ICONS = {
  optical_store: Store,
  optical_cabinet: Glasses,
  optometry_cabinet: Eye,
  ophthalmology_office: Stethoscope,
  optical_workshop: Wrench,
  optical_laboratory: FlaskConical,
  ophthalmology_diagnostics: Microscope,
  ophthalmology_procedure_room: CircleDot,
  ophthalmology_surgery_unit: Hospital,
  b2b_distribution_center: PackageOpen,
};

// Aceleasi culori de categorie ca in continut (ProviderServicesWorkspaceOperational.jsx,
// GROUP_TONE), aplicate pe placile mici din sidebar (2026-08-06). Duplicat mic si
// intentionat: cele doua fisiere nu impart module, iar valorile sunt scurte si stabile
// - preluate din CategoryShowcase.jsx (homepage), nu inventate.
const UNIT_CARD_TONE = {
  optical_store: { bg: "#efd5c5", border: "#e1bda8" },
  optical_cabinet: { bg: "#efd5c5", border: "#e1bda8" },
  optometry_cabinet: { bg: "#dce5e9", border: "#c6d3da" },
  ophthalmology_office: { bg: "#e8e0ea", border: "#d4c6d8" },
  optical_workshop: { bg: "#eadcba", border: "#dac69b" },
  optical_laboratory: { bg: "#eadcba", border: "#dac69b" },
  ophthalmology_diagnostics: { bg: "#dfe3d2", border: "#ccd2ba" },
  ophthalmology_procedure_room: { bg: "#e8e0ea", border: "#d4c6d8" },
  ophthalmology_surgery_unit: { bg: "#e8e0ea", border: "#d4c6d8" },
};

const INITIAL_SNAPSHOT = {
  units: [],
  selectedCount: 0,
  approvedCount: 0,
  pendingReview: false,
  globalOptionCount: 0,
  suggestionCount: 0,
  unitCount: 0,
  capabilityCount: 0,
  issueCount: 0,
  issueServiceKeys: [],
  blockers: [],
  selectedServices: [],
  careSetting: "",
  status: "",
  dirty: false,
  readyToSubmit: false,
  configurationComplete: false,
  adminNote: "",
  conflictMessage: "",
  actionStatus: "",
  actionMessage: "",
  actionTone: "info",
  saving: false,
  canSave: false,
  canSubmit: false,
  canWithdraw: false,
  hasSave: false,
  hasSubmit: false,
  hasWithdraw: false,
};

function NavButton({ active, icon: Icon, label, count, status, onClick }) {
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {status && <small>{status}</small>}
      {Number.isFinite(count) && <em>{count}</em>}
    </button>
  );
}

function PanelLabel({ index, label }) {
  return (
    <div className="provider-services-three__panel-label" aria-hidden="true">
      <span>{index}</span>
      <i>{label}</i>
    </div>
  );
}

export default function ProviderServicesThreeColumn({ location, ...props }) {
  const contentRef = useRef(null);
  const [view, setView] = useState("configuration");
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [configStep, setConfigStep] = useState(1);
  // Ecranul-lista e "acasa" pe telefon (2026-08-06): apesi un rand, intri in el, te
  // intorci la lista. Tiparul standard folosit de Apple in Setari si de Google in
  // Business Profile pentru configurari mari - in locul unui selector de navigare.
  const [mobileHome, setMobileHome] = useState(true);
  // Cererea de deschidere a unei zone: "indexZona#nonce". Nonce-ul permite redeschiderea
  // aceleiasi zone dupa ce utilizatorul a pliat-o din continut.
  const [unitOpenRequest, setUnitOpenRequest] = useState("");
  // Doar pasul 1 a mai ramas numerotat (2026-08-18): pasii 2 si 3 au fost desfiintate.
  const CONFIG_STEP_TITLES = { 1: "Spațiile existente" };

  // Plasa de siguranta: daca snapshotul primit e identic pe valori cu cel curent, nu
  // mai declansam o randare. Fara asta, orice valoare derivata instabila din hook
  // devine o bucla de randari (vezi useProviderServicesConfig).
  const updateWorkspaceSnapshot = useCallback((nextSnapshot) => {
    setSnapshot((current) => {
      const merged = { ...current, ...nextSnapshot };
      const unchanged = Object.keys(merged).every((key) => {
        const before = current[key];
        const after = merged[key];
        if (typeof after === "function") return typeof before === "function";
        if (before === after) return true;
        return JSON.stringify(before) === JSON.stringify(after);
      });
      return unchanged ? current : merged;
    });
  }, []);

  const filter = ["selected", "issues"].includes(view) ? view : "all";

  // Faza 3 (docs/plan-refactor-servicii-2026-08-18.md): decorarea DOM prin
  // MutationObserver a fost eliminata. Sectiunea activa, filtrul si zona deschisa se
  // transmit ca proprietati catre componenta operationala, care scrie atributele
  // data-* declarativ, in randare.
  const openUnit = useCallback((index) => {
    setQuery("");
    setView("unit");
    setActiveUnitIndex(index);
    setUnitOpenRequest((current) => {
      const nonce = Number(String(current).split("#")[1] || 0) + 1;
      return `${index}#${nonce}`;
    });
    requestAnimationFrame(() => {
      contentRef.current?.querySelector(`[data-services-unit-index="${index}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // BUG REAL (2026-08-06): chooseView("configuration") face mereu setConfigStep(1).
  // Randurile "Dotari si activitati" (pas 2) si "Tipul activitatii" (pas 3) apelau
  // setConfigStep(row.step) INAINTE de chooseView, care il suprascria imediat inapoi
  // la 1 - deci apasarea parea sa nu faca nimic, te trimitea mereu la pasul 1.
  const goToConfigStep = (step) => {
    setQuery("");
    setView("configuration");
    setConfigStep(step);
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const chooseView = useCallback((nextView) => {
    setQuery("");
    setView(nextView);
    if (nextView === "configuration") setConfigStep(1);
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const chooseMobileView = useCallback((value) => {
    const unitMatch = String(value).match(/^unit:(\d+)$/);
    if (unitMatch) {
      openUnit(Number(unitMatch[1]));
      return;
    }
    chooseView(value);
  }, [chooseView, openUnit]);

  const updateSearch = useCallback((value) => {
    setQuery(value);
  }, []);

  const activeUnit = snapshot.units.find((unit) => unit.index === activeUnitIndex);
  const [requestedUnitIndex, requestedUnitNonce] = String(unitOpenRequest).split("#");
  const requestedUnitKey = snapshot.units.find((unit) => unit.index === Number(requestedUnitIndex))?.key || "";
  const requestedOpenUnitKey = requestedUnitKey ? `${requestedUnitKey}#${requestedUnitNonce}` : "";
  const centerTitle = query
    ? `Rezultate pentru „${query}”`
    : view === "configuration"
      ? CONFIG_STEP_TITLES[configStep]
      : view === "options"
        ? "La nivelul locației"
        : view === "selected"
          ? "Oferta selectată"
          : view === "issues"
            ? "Observații de catalog"
            : view === "unit"
              ? activeUnit?.title || "Oferta zonei"
              : "Oferta completă";

  // O singura linie de context, specifica pasului. Inainte descrierea era generica aici
  // si se repeta, mai lunga, in interiorul fiecarei sectiuni.
  const CONFIG_STEP_HINTS = {
    1: "Tipurile de spații existente. Nu e nevoie să treci fiecare cameră.",
  };
  const centerDescription = view === "configuration"
    ? CONFIG_STEP_HINTS[configStep]
    : view === "options"
      ? "Opțiuni valabile pentru întreaga locație, nu pentru o singură zonă."
      : view === "issues"
        ? "Sunt afișate numai observațiile de catalog. Acestea nu cer acte, specialiști sau echipamente."
        : view === "selected"
          ? "Sunt afișate numai elementele adăugate în oferta curentă."
          : "Selectează serviciile declarate ca disponibile și adaugă opțional detaliile relevante.";

  const locationName = location?.public_display_name
    || location?.display_name
    || location?.name
    || "Locația selectată";
  const locationPlace = [location?.locality || location?.city, location?.county]
    .filter(Boolean)
    .join(", ");

  // selectedPreview a fost eliminat odata cu coloana de rezumat (2026-08-06): lista
  // primelor 5 servicii selectate repeta ce se vede deja in continut.
  // showActionBar a fost eliminat (2026-08-18): pilota bara duplicata, stearsa in
  // acelasi audit.
  const dataView = query ? "search" : view;
  const mobileNavValue = view === "unit" ? `unit:${activeUnitIndex}` : view;
  // UN SINGUR sir de pasi (2026-08-06). Inainte existau doua numaratori suprapuse pe
  // acelasi ecran - "Pasul 1 din 6" (navigare) si "Pasul 1 din 3" (subpasii de
  // configurare) - plus acelasi titlu repetat de trei ori. Acum configurarea isi
  // desfasoara subpasii in acelasi sir, deci exista o singura numaratoare si un singur
  // buton de avansare. Filtrele de verificare raman in afara numaratorii.
  const flowSteps = [
    { value: "configuration", step: 1, label: "Spațiile existente" },
    // Dotari si activitati (pas 2) si Tipul activitatii (pas 3) au fost desfiintate ca
    // pasi separati (2026-08-18) - vezi comentariile din UnitAccordion.jsx si mai jos.
    { value: "options", step: null, label: "La nivelul locației" },
    ...snapshot.units.map((unit) => ({
      value: `unit:${unit.index}`,
      step: null,
      label: unit.title,
    })),
  ];
  const flowIndex = flowSteps.findIndex((entry) => (
    entry.value === mobileNavValue && (entry.step === null || entry.step === configStep)
  ));
  const isReviewView = flowIndex < 0;

  // Randurile ecranului-lista. Bifa apare cand pasul are un rezultat vizibil, ca sa
  // vezi dintr-o privire ce ai terminat si ce a ramas.
  // Doua grupuri distincte (2026-08-06): structura (ce ai) si oferta (ce faci in
  // fiecare zona). Inainte erau amestecate la acelasi nivel, iar cele trei subsectiuni
  // de configurare - inclusiv dotarile - erau ascunse intr-un singur rand.
  const homeGroups = [
    {
      label: "Structura locației",
      rows: [
        {
          value: "configuration",
          step: 1,
          label: "Spațiile existente",
          hint: "Ce spații ai la această locație: magazin, cabinet, atelier.",
          icon: Building2,
          meta: snapshot.unitCount > 0
            ? `${snapshot.unitCount} ${snapshot.unitCount === 1 ? "zonă" : "zone"}`
            : "Nicio zonă aleasă",
          done: snapshot.unitCount > 0,
        },
        // "Dotari si activitati" a fost desfiintat complet (2026-08-18, la cererea lui
        // Alex): fiecare capabilitate traieste acum inline, in zona pe care o controleaza
        // (vezi UnitAccordion.jsx), nu intr-un pas separat de sidebar.
        {
          value: "options",
          step: null,
          label: "La nivelul locației",
          // Tipul activitatii mutat aici (2026-08-18) - atribut de locatie, nu pas separat.
          hint: "Tipul activității, servicii la domiciliu, la sediul firmelor, optică mobilă.",
          icon: Store,
          meta: snapshot.globalOptionCount > 0 ? `${snapshot.globalOptionCount} opțiuni` : "Opțional",
          done: snapshot.globalOptionCount > 0,
        },
      ],
    },
    ...(snapshot.units.length > 0 ? [{
      label: "Oferta pe zone",
      rows: snapshot.units.map((unit) => ({
        value: `unit:${unit.index}`,
        unitKey: unit.key,
        step: null,
        label: unit.title,
        hint: unit.description,
        icon: UNIT_CARD_ICONS[unit.key] || Building2,
        meta: `${unit.selected} din ${unit.total} servicii`,
        // Forma scurta, pentru coloana de pasi: acolo marginea dreapta arata mereu o
        // cantitate, nu cand o bifa si cand un numar (2026-08-18).
        count: `${unit.selected}/${unit.total}`,
        done: unit.selected > 0,
      })),
    }] : []),
    {
      label: "Verificare",
      isReview: true,
      rows: [
        { value: "selected", label: "Oferta selectată", meta: String(snapshot.selectedCount), done: false },
        { value: "issues", label: "Observații de catalog", meta: String(snapshot.issueCount), done: false },
      ],
    },
  ];
  const homeProgressRows = homeGroups.flatMap((group) => (group.isReview ? [] : group.rows));
  const homeDoneCount = homeProgressRows.filter((row) => row.done).length;

  // Acelasi bug ca in sidebar: pe telefon randurile pasilor 2 si 3 trimiteau tot la
  // pasul 1, pentru ca chooseView("configuration") reseta subpasul.
  const openFromHome = (value, step) => {
    if (value === "configuration") goToConfigStep(step || 1);
    else chooseMobileView(value);
    setMobileHome(false);
  };

  // Starea profilului, in stilul Uber/Revolut: spune raspicat daca esti sau nu vizibil
  // pacientilor, si care e singurul lucru ramas de facut. Pragul e cel putin un serviciu
  // APROBAT - sub el, profilul apare doar ca alternativa neconfirmata, cu avertisment.
  const readinessBanner = snapshot.approvedCount > 0
    ? {
      tone: "live",
      title: "Profilul apare la căutările pacienților",
      detail: `${snapshot.approvedCount} ${snapshot.approvedCount === 1 ? "serviciu confirmat" : "servicii confirmate"}`,
    }
    : snapshot.pendingReview
      ? {
        tone: "pending",
        title: "Modificările sunt în verificare",
        detail: "Te anunțăm când sunt aprobate. Până atunci nu poți edita.",
      }
      : snapshot.selectedCount > 0
        ? {
          tone: "action",
          title: "Nu apari încă la căutări",
          detail: `Ai ${snapshot.selectedCount} ${snapshot.selectedCount === 1 ? "serviciu pregătit" : "servicii pregătite"}. Trimite-le spre aprobare.`,
        }
        : {
          tone: "empty",
          title: "Nu apari încă la căutări",
          detail: "Alege cel puțin un serviciu într-o zonă, apoi trimite spre aprobare.",
        };

  return (
    <div className="provider-services-three" data-view={dataView} data-filter={filter} data-mobile-home={mobileHome ? "true" : "false"}>
      <div className="provider-services-three__layout">
        <aside className="provider-services-three__left" aria-label="Organizarea serviciilor">
          <div className="provider-services-three__left-sticky">
            {/* Coloana e un indicator de pasi, nu o lista de linkuri egale (2026-08-06).
                Pasii sunt numerotati, cei terminati primesc bifa verde, iar filtrele de
                verificare sunt clar despartite - inainte erau al patrulea grup identic,
                desi se comporta complet diferit. */}
            <div className="provider-services-three__left-heading">
              <PanelLabel index="01" label="Configurare" />
              <strong>{homeDoneCount} din {homeProgressRows.length} secțiuni</strong>
              {/* Progresul se arata si vizual, nu doar in text - acelasi tipar folosit de
                  Stripe si Google Business Profile pentru configurari cu mai multi pasi. */}
              <span className="provider-services-three__progress" aria-hidden="true">
                <i style={{ width: `${Math.round((homeDoneCount / Math.max(homeProgressRows.length, 1)) * 100)}%` }} />
              </span>
            </div>

            {/* Cautarea sta in sidebar, deasupra categoriilor (2026-08-06), ca in
                referinta - nu in antetul continutului. Aceeasi stare `query`, doar
                mutata vizual; comportamentul de filtrare ramane neschimbat. */}
            <div className="provider-services-three__left-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Caută un serviciu"
                aria-label="Caută un serviciu"
              />
            </div>

            <div className="provider-services-three__nav-groups">
              {homeGroups.filter((group) => !group.isReview).map((group) => (
                <nav key={group.label} className="provider-services-three__steps" aria-label={group.label}>
                  <p className="provider-services-three__steps-label">{group.label}</p>
                  {group.rows.map((row) => {
                    const isActive = !query && (
                      (row.value === "configuration" && view === "configuration" && row.step === configStep)
                      || (row.value === "options" && view === "options")
                      || (row.value.startsWith("unit:") && view === "unit" && `unit:${activeUnitIndex}` === row.value)
                    );
                    return (
                      <button
                        key={`${row.value}-${row.step || 0}`}
                        type="button"
                        className={`provider-services-three__step${isActive ? " is-active" : ""}${row.done ? " is-done" : ""}`}
                        onClick={() => {
                          if (row.value === "configuration") { goToConfigStep(row.step || 1); }
                          else if (row.value.startsWith("unit:")) openUnit(Number(row.value.slice(5)));
                          else chooseView(row.value);
                        }}
                      >
                        <span
                          className="provider-services-three__step-mark"
                          aria-hidden="true"
                          style={row.unitKey && UNIT_CARD_TONE[row.unitKey] ? { background: UNIT_CARD_TONE[row.unitKey].bg, borderColor: UNIT_CARD_TONE[row.unitKey].border } : undefined}
                        >
                          {row.icon ? <row.icon /> : <CheckCircle2 />}
                        </span>
                        <span className="provider-services-three__step-body">
                          <span>{row.label}</span>
                        </span>
                        {row.count ? (
                          <em className="provider-services-three__step-count">{row.count}</em>
                        ) : row.done ? (
                          <Check className="provider-services-three__step-done" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              ))}

              {/* Pastram si clasa nav-group: stilurile butoanelor (iconita, contor,
                  aliniere) sunt legate de ea in trei fisiere CSS. Fara ea, randurile
                  se stricau - text lipit de numar, iconite pe randuri separate. */}
              <nav className="provider-services-three__nav-group provider-services-three__review" aria-label="Verificare">
                <p>Verificare</p>
                <NavButton active={view === "all" && !query} icon={ListFilter} label="Oferta completă" count={snapshot.units.reduce((sum, unit) => sum + unit.total, 0)} onClick={() => chooseView("all")} />
                <NavButton active={view === "selected" && !query} icon={CheckCircle2} label="Oferta selectată" count={snapshot.selectedCount} onClick={() => chooseView("selected")} />
                <NavButton active={view === "issues" && !query} icon={AlertTriangle} label="Observații" count={snapshot.issueCount} onClick={() => chooseView("issues")} />
              </nav>
            </div>
          </div>
        </aside>

        <section className="provider-services-three__center" aria-labelledby="provider-services-center-title">
          <div className="provider-services-three__mobile-nav" aria-label="Navigarea serviciilor pe telefon">
            {mobileHome ? (
              <div className="provider-services-three__home">
                <div className="provider-services-three__status" data-tone={readinessBanner.tone}>
                  <span className="provider-services-three__status-dot" aria-hidden="true" />
                  <div>
                    <strong>{readinessBanner.title}</strong>
                    <small>{readinessBanner.detail}</small>
                  </div>
                </div>
                <div className="provider-services-three__home-head">
                  <div>
                    <span>Configurarea serviciilor</span>
                    <strong>{homeDoneCount} din {homeProgressRows.length} secțiuni</strong>
                  </div>
                </div>
                {homeGroups.map((group) => (
                  <div key={group.label} className="provider-services-three__home-group">
                    <p>{group.label}</p>
                    {group.rows.map((row) => {
                      const RowIcon = row.icon;
                      return (
                        <button
                          key={`${row.value}-${row.step || 0}`}
                          type="button"
                          onClick={() => openFromHome(row.value, row.step)}
                          className={group.isReview ? "is-review" : row.done ? "is-done" : ""}
                        >
                          {RowIcon && (
                            <span className="provider-services-three__home-icon" aria-hidden="true">
                              <RowIcon />
                            </span>
                          )}
                          <span className="provider-services-three__home-body">
                            <span className="provider-services-three__home-label">{row.label}</span>
                            {row.hint && <span className="provider-services-three__home-hint">{row.hint}</span>}
                            <span className="provider-services-three__home-meta">
                              {row.done && <CheckCircle2 aria-hidden="true" />}
                              {row.meta}
                            </span>
                          </span>
                          <ChevronDown aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="provider-services-three__home-back"
                  onClick={() => setMobileHome(true)}
                >
                  <ChevronDown aria-hidden="true" /> Toate secțiunile
                </button>
                <div className="provider-services-three__mobile-nav-heading">
                  <div>
                    <span>{isReviewView ? "Verificare" : "Configurezi acum"}</span>
                    <strong>{centerTitle}</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          <details className="provider-services-three__mobile-overview">
            <summary>
              <span>
                <small>Rezumatul locației</small>
                <strong>{snapshot.selectedCount} în ofertă · {snapshot.unitCount} zone</strong>
              </span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="provider-services-three__mobile-overview-body">
              <div>
                <strong>{locationName}</strong>
                {locationPlace && <span>{locationPlace}</span>}
                {snapshot.status && <em>{snapshot.status}</em>}
              </div>
              <dl>
                <div><dt>În ofertă</dt><dd>{snapshot.selectedCount}</dd></div>
                <div><dt>Zone</dt><dd>{snapshot.unitCount}</dd></div>
                <div><dt>Observații</dt><dd>{snapshot.issueCount}</dd></div>
              </dl>
              <div className="provider-services-three__mobile-overview-links">
                <button type="button" onClick={() => chooseView("selected")}>
                  Vezi oferta selectată <ChevronRight aria-hidden="true" />
                </button>
                {snapshot.issueCount > 0 && (
                  <button type="button" onClick={() => chooseView("issues")}>
                    Vezi observațiile <ChevronRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </details>

          <header className="provider-services-three__center-header">
            <div className="provider-services-three__center-copy">
              <PanelLabel index="02" label="Configurare" />
              <h2 id="provider-services-center-title">{centerTitle}</h2>
              <p>{centerDescription}</p>
            </div>
            {/* Actiunile stau langa titlu (2026-08-18): o singura actiune primara pe
                ecran, in dreapta. Pe telefon rămâne bara sticky de jos. */}
            <ServicesHeaderActions snapshot={snapshot} />
            {!(["configuration", "options", "advanced"].includes(view)) && (
              <div className="provider-services-three__search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Caută un serviciu"
                  aria-label="Caută un serviciu"
                />
                {query && (
                  <button type="button" onClick={() => updateSearch("")} aria-label="Șterge căutarea">
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </header>

          {/* Rezumatul si starea vin DUPA titlu (2026-08-18): inainte stateau deasupra lui,
              deci ochiul citea meta inainte de a sti pe ce ecran se afla. */}
          {/* Rezumatul de stare apare doar unde are sens (2026-08-18): inainte randul
              "Tipul activitatii" si marcajul de trimitere se vedeau pe TOATE ecranele,
              inclusiv pe cel al zonelor - informatie despre alt pas, chiar sub titlu.
              Iar "Pregatita pentru trimitere" aparea si cu zero servicii alese, ceea ce
              spunea exact invers de ce arata contorul din stanga. */}
          <div className="provider-services-three__meta">
            {/* Meta-informatia despre "Tipul activitatii" a fost eliminata (2026-08-18):
                pasul 3 nu mai exista, iar acest camp aparea doar in acel pas - nu se mai
                activa niciodata. Tipul activitatii se vede acum in ecranul La nivelul
                locatiei, unde s-a mutat. */}
            {snapshot.configurationComplete && !snapshot.dirty && snapshot.selectedCount > 0 && (
              <span className="provider-services-three__meta-badge is-ready">
                <CheckCircle2 aria-hidden="true" /> Pregătită pentru trimitere
              </span>
            )}
            {snapshot.issueCount > 0 && (
              <button type="button" className="provider-services-three__meta-badge is-issues" onClick={() => chooseView("issues")}>
                <AlertTriangle aria-hidden="true" /> {snapshot.issueCount} observații
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>

          {snapshot.adminNote && (
            <div className="provider-services-three__admin-note">
              <strong>Completări solicitate</strong>
              <p>{snapshot.adminNote}</p>
            </div>
          )}

          <div ref={contentRef} className="provider-services-three__native">
            <ProviderServicesWorkspaceRuntime
              location={location}
              {...props}
              query={query}
              onQueryChange={setQuery}
              onWorkspaceSnapshot={updateWorkspaceSnapshot}
              navigation={{ view, filter, configStep, activeUnitIndex }}
              requestedOpenUnitKey={requestedOpenUnitKey}
            />
          </div>

          {/* Butonul "Continua catre..." a fost eliminat (2026-08-18): navigarea o face
              coloana de pasi din stanga, iar pe telefon ecranul-lista. Doua mecanisme de
              avansare pe acelasi ecran se bat cap in cap. */}
        </section>

        {/* Coloana din dreapta a fost eliminata (2026-08-06): repeta informatie deja
            vizibila in coloana de pasi si in continut - zone, numar de servicii, lista
            selectata. Ce era unic (tipul activitatii, starea de trimitere, nota de la
            admin, observatiile) urca in antetul continutului, pe un rand.
            Rezultat: doua coloane in loc de trei, continutul primeste tot spatiul. */}
      </div>

      {/* Bara de actiuni duplicata ELIMINATA (2026-08-18, audit dupa restructurarea
          Fazei 2). ServicesActionBar.jsx, folosita in interiorul componentei
          operationale, acopera 1:1 acelasi comportament (Salveaza/Trimite/Retrage).
          Aici, hasSave era mereu true - deci amandoua barele se afisau simultan,
          de fiecare data. Planul cerea explicit "O singura bara". */}
    </div>
  );
}