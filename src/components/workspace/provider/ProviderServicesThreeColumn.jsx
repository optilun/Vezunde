import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
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
  Save,
  Search,
  Send,
  Settings2,
  Stethoscope,
  Store,
  Wrench,
  X,
} from "lucide-react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";

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
  hasCapabilitySection: false,
  hasCareSettingSection: false,
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
  canSave: false,
  canSubmit: false,
  canWithdraw: false,
  hasSave: false,
  hasSubmit: false,
  hasWithdraw: false,
};

function cleanText(element) {
  return String(element?.textContent || "").trim().replace(/\s+/g, " ");
}

function findMainGrid(root) {
  const operationalRoot = root?.querySelector(":scope > div");
  if (!operationalRoot) return null;
  return [...operationalRoot.children].find((element) => (
    element instanceof HTMLElement
    && element.classList.contains("grid")
    && String(element.className).includes("xl:grid-cols")
  )) || null;
}

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
  const CONFIG_STEP_TITLES = { 1: "Zonele existente", 2: "Dotări și activități", 3: "Tipul activității" };

  const updateWorkspaceSnapshot = useCallback((nextSnapshot) => {
    setSnapshot((current) => ({ ...current, ...nextSnapshot }));
  }, []);

  const filter = ["selected", "issues"].includes(view) ? view : "all";

  const decorate = useCallback(() => {
    const root = contentRef.current;
    const operationalRoot = root?.querySelector(":scope > div");
    if (!operationalRoot) return;

    const intro = operationalRoot.querySelector(":scope > section:first-child");
    if (intro) intro.dataset.servicesRole = "native-intro";

    const mainGrid = findMainGrid(root);
    if (!mainGrid) return;
    mainGrid.dataset.servicesRole = "workspace";

    const mainColumn = [...mainGrid.children].find((element) => element.classList?.contains("space-y-4"));
    const nativeSidebar = [...mainGrid.children].find((element) => element.tagName === "ASIDE");
    if (!mainColumn) return;
    mainColumn.dataset.servicesRole = "content";
    if (nativeSidebar) nativeSidebar.dataset.servicesRole = "native-summary";

    const directSections = [...mainColumn.children].filter((element) => element.tagName === "SECTION");
    const numberedSections = new Map();
    directSections.forEach((section) => {
      const heading = cleanText(section.querySelector("h2"));
      const match = heading.match(/^(\d+)\./);
      if (!match) return;
      const number = Number(match[1]);
      numberedSections.set(number, section);
      section.dataset.servicesSection = String(number);
    });

    [1, 2, 3].forEach((number) => {
      const section = numberedSections.get(number);
      if (section) {
        section.dataset.servicesPanel = "configuration";
        section.dataset.servicesSubstep = String(number);
        section.dataset.servicesSubstepVisible = number === configStep ? "true" : "false";
      }
    });
    if (numberedSections.get(4)) numberedSections.get(4).dataset.servicesPanel = "options";
    if (numberedSections.get(5)) numberedSections.get(5).dataset.servicesRole = "catalog-intro";

    const searchResults = directSections.find((section) => /Rezultate pentru/i.test(cleanText(section.querySelector("h2"))));
    if (searchResults) searchResults.dataset.servicesPanel = "search-results";

    const legacy = directSections.find((section) => /Date existente care necesită migrare/i.test(cleanText(section)));
    if (legacy) legacy.dataset.servicesPanel = "advanced";

    const unitList = [...mainColumn.children].find((element) => element.classList?.contains("space-y-3"));
    if (unitList) unitList.dataset.servicesPanel = "units";

    [...operationalRoot.querySelectorAll("button")].forEach((button) => {
      if (/^Arată alte (spații|activități)/i.test(cleanText(button))) {
        button.dataset.servicesDisclosure = "true";
      } else {
        delete button.dataset.servicesDisclosure;
      }
    });

    [...operationalRoot.querySelectorAll("span")].forEach((badge) => {
      if (/^Nou în draft$/i.test(cleanText(badge))) {
        badge.dataset.servicesDraftBadge = "true";
      } else {
        delete badge.dataset.servicesDraftBadge;
      }
    });

    // Randurile de servicii se gasesc dupa atributul stabil data-service-key, nu dupa
    // clasa de stil "grid" (2026-08-06). Varianta veche lega filtrele de o clasa
    // Tailwind - orice schimbare de aspect a randului rupea tacit "Oferta selectata"
    // si "Observatii de catalog".
    const rows = [...operationalRoot.querySelectorAll("button[data-service-key]")];
    const issueKeys = new Set(snapshot.issueServiceKeys || []);
    rows.forEach((row) => {
      const selected = row.getAttribute("aria-pressed") === "true";
      const issue = issueKeys.has(row.dataset.serviceKey || "");
      row.dataset.serviceSelected = selected ? "true" : "false";
      row.dataset.serviceIssue = issue ? "true" : "false";
      const visible = filter === "all" || (filter === "selected" && selected) || (filter === "issues" && selected && issue);
      row.dataset.serviceFilterVisible = visible ? "true" : "false";
    });

    if (unitList) {
      [...unitList.children].forEach((unitSection, index) => {
        if (!(unitSection instanceof HTMLElement) || unitSection.tagName !== "SECTION") return;
        const visible = view === "all" || view === "selected" || view === "issues" || (view === "unit" && index === activeUnitIndex);
        unitSection.dataset.servicesUnitIndex = String(index);
        unitSection.dataset.servicesUnitVisible = visible ? "true" : "false";
      });
    }

    const actions = [...operationalRoot.children].find((element) => (
      element.classList?.contains("sticky") && element.classList?.contains("bottom-0")
    ));
    if (actions) actions.dataset.servicesRole = "native-actions";
  }, [activeUnitIndex, configStep, filter, snapshot.issueServiceKeys, view]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-pressed", "class", "disabled"],
    });
    return () => observer.disconnect();
  }, [decorate]);

  const openUnit = useCallback((index) => {
    setQuery("");
    setView("unit");
    setActiveUnitIndex(index);
    requestAnimationFrame(() => {
      const section = contentRef.current?.querySelector(`[data-services-unit-index="${index}"]`);
      const header = section?.querySelector(":scope > button:first-child");
      const hasContent = section && section.children.length > 1;
      if (!hasContent) header?.click();
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const centerDescription = view === "configuration"
    ? "Alege zonele existente, activitățile asociate și tipul activității."
    : view === "options"
      ? "Configurează opțiunile valabile pentru întreaga locație, inclusiv decontarea CAS și serviciile oferite în afara locației."
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
  const showActionBar = snapshot.hasSave || snapshot.hasSubmit || snapshot.hasWithdraw || Boolean(snapshot.actionStatus);
  const dataView = query ? "search" : view;
  const mobileNavValue = view === "unit" ? `unit:${activeUnitIndex}` : view;
  // UN SINGUR sir de pasi (2026-08-06). Inainte existau doua numaratori suprapuse pe
  // acelasi ecran - "Pasul 1 din 6" (navigare) si "Pasul 1 din 3" (subpasii de
  // configurare) - plus acelasi titlu repetat de trei ori. Acum configurarea isi
  // desfasoara subpasii in acelasi sir, deci exista o singura numaratoare si un singur
  // buton de avansare. Filtrele de verificare raman in afara numaratorii.
  const flowSteps = [
    { value: "configuration", step: 1, label: "Zonele existente" },
    // Aceleasi conditii ca in sidebar: sarim pasii care nu au continut de aratat.
    ...(snapshot.hasCapabilitySection ? [{ value: "configuration", step: 2, label: "Dotări și activități" }] : []),
    ...(snapshot.hasCareSettingSection ? [{ value: "configuration", step: 3, label: "Tipul activității" }] : []),
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
  const nextFlowEntry = flowIndex >= 0 && flowIndex < flowSteps.length - 1
    ? flowSteps[flowIndex + 1]
    : null;
  const previousFlowEntry = flowIndex > 0 ? flowSteps[flowIndex - 1] : null;
  const goToFlowEntry = (entry) => {
    if (!entry) return;
    if (entry.step !== null) setConfigStep(entry.step);
    chooseMobileView(entry.value);
  };

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
          label: "Zonele existente",
          hint: "Ce spații ai la această locație: magazin, cabinet, atelier.",
          icon: Building2,
          meta: snapshot.unitCount > 0
            ? `${snapshot.unitCount} ${snapshot.unitCount === 1 ? "zonă" : "zone"}`
            : "Nicio zonă aleasă",
          done: snapshot.unitCount > 0,
        },
        // Randurile 2 si 3 apar doar cand sectiunea are efectiv continut de aratat.
        // Altfel apasarea nu deschidea nimic - sectiunile se randeaza conditionat.
        ...(snapshot.hasCapabilitySection ? [{
          value: "configuration",
          step: 2,
          label: "Dotări și activități",
          hint: "Ce poți face efectiv în fiecare zonă.",
          icon: Wrench,
          meta: snapshot.capabilityCount > 0
            ? `${snapshot.capabilityCount} ${snapshot.capabilityCount === 1 ? "activitate" : "activități"}`
            : "Opțional",
          done: snapshot.capabilityCount > 0,
        }] : []),
        ...(snapshot.hasCareSettingSection ? [{
          value: "configuration",
          step: 3,
          label: "Tipul activității",
          hint: "Comercială, medicală sau mixtă.",
          icon: Settings2,
          meta: snapshot.careSetting || "Nedefinit",
          done: Boolean(snapshot.careSetting),
        }] : []),
        {
          value: "options",
          step: null,
          label: "La nivelul locației",
          hint: "Servicii la domiciliu, la sediul firmelor, optică mobilă.",
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

  const openFromHome = (value) => {
    if (value === "configuration") setConfigStep(1);
    chooseMobileView(value);
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
                          {row.done && <CheckCircle2 className="provider-services-three__step-done" aria-hidden="true" />}
                        </span>
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
                          key={row.value}
                          type="button"
                          onClick={() => openFromHome(row.value)}
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

          {/* Rezumatul util, mutat din coloana eliminata (2026-08-06): doar informatia
              care nu apare deja in alta parte - tipul activitatii, starea si eventualele
              observatii sau cerinte de la admin. */}
          <div className="provider-services-three__meta">
            {snapshot.careSetting && (
              <span className="provider-services-three__meta-item">
                <small>Tipul activității</small>
                <strong>{snapshot.careSetting}</strong>
              </span>
            )}
            {snapshot.configurationComplete && !snapshot.dirty && (
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

          <header className="provider-services-three__center-header">
            <div className="provider-services-three__center-copy">
              <PanelLabel index="02" label="Configurare" />
              <h2 id="provider-services-center-title">{centerTitle}</h2>
              <p>{centerDescription}</p>
            </div>
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

          <div ref={contentRef} className="provider-services-three__native">
            <ProviderServicesWorkspaceRuntime location={location} {...props} query={query} onQueryChange={setQuery} onWorkspaceSnapshot={updateWorkspaceSnapshot} />
          </div>

          {/* Butonul de avansare: raspunsul direct la "nu stiu ce urmeaza". Duce la
              urmatoarea destinatie din drumul liniar, fara sa fie nevoie de dropdown. */}
          {!query && !isReviewView && (
            <div className="provider-services-three__flow-next">
              {previousFlowEntry && (
                <button type="button" className="is-back" onClick={() => goToFlowEntry(previousFlowEntry)}>
                  Înapoi
                </button>
              )}
              {nextFlowEntry ? (
                <button type="button" className="is-primary" onClick={() => goToFlowEntry(nextFlowEntry)}>
                  <span>Continuă către</span>
                  <strong>{nextFlowEntry.label}</strong>
                  <ChevronDown aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="is-primary" onClick={() => chooseMobileView("selected")}>
                  <span>Ai parcurs toate zonele</span>
                  <strong>Verifică oferta selectată</strong>
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Coloana din dreapta a fost eliminata (2026-08-06): repeta informatie deja
            vizibila in coloana de pasi si in continut - zone, numar de servicii, lista
            selectata. Ce era unic (tipul activitatii, starea de trimitere, nota de la
            admin, observatiile) urca in antetul continutului, pe un rand.
            Rezultat: doua coloane in loc de trei, continutul primeste tot spatiul. */}
      </div>

      {showActionBar && (
        <div className="provider-services-three__actions" role="region" aria-label="Acțiuni servicii">
          <div>
            <strong>{snapshot.actionStatus || "Configurația serviciilor"}</strong>
            {snapshot.actionMessage && <span>{snapshot.actionMessage}</span>}
          </div>
          <div className="provider-services-three__action-buttons">
            {snapshot.hasSave && (
              <button type="button" disabled={!snapshot.canSave} onClick={() => snapshot.onSave?.()}>
                <Save aria-hidden="true" />
                <span className="provider-services-three__action-label-desktop">Salvează draftul</span>
                <span className="provider-services-three__action-label-mobile">Salvează</span>
              </button>
            )}
            {snapshot.hasSubmit && (
              <button type="button" className="is-primary" disabled={!snapshot.canSubmit} onClick={() => snapshot.onSubmit?.()}>
                <Send aria-hidden="true" />
                <span className="provider-services-three__action-label-desktop">Trimite spre aprobare</span>
                <span className="provider-services-three__action-label-mobile">Trimite</span>
              </button>
            )}
            {snapshot.hasWithdraw && (
              <button type="button" disabled={!snapshot.canWithdraw} onClick={() => snapshot.onWithdraw?.()}>
                <X aria-hidden="true" />
                <span className="provider-services-three__action-label-desktop">Retrage cererea</span>
                <span className="provider-services-three__action-label-mobile">Retrage</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
