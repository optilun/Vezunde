import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  ListFilter,
  Save,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";

const INITIAL_SNAPSHOT = {
  units: [],
  selectedCount: 0,
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

function setNativeInputValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
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
    const nativeSearch = intro?.querySelector('input[placeholder^="Caută"], input[placeholder^="Cauta"]');
    if (nativeSearch && nativeSearch.value !== query) setNativeInputValue(nativeSearch, query);

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
      if (section) section.dataset.servicesPanel = "configuration";
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

    const rows = [...operationalRoot.querySelectorAll("button.grid")];
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
  }, [activeUnitIndex, filter, query, snapshot.issueServiceKeys, view]);

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

  const chooseView = useCallback((nextView) => {
    setQuery("");
    setView(nextView);
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const updateSearch = useCallback((value) => {
    setQuery(value);
    const input = contentRef.current?.querySelector('input[placeholder^="Caută"], input[placeholder^="Cauta"]');
    if (input) setNativeInputValue(input, value);
  }, []);

  const clickNativeAction = useCallback((pattern) => {
    const actions = contentRef.current?.querySelector('[data-services-role="native-actions"]');
    const button = [...(actions?.querySelectorAll("button") || [])]
      .find((item) => pattern.test(cleanText(item)));
    button?.click();
  }, []);

  const activeUnit = snapshot.units.find((unit) => unit.index === activeUnitIndex);
  const centerTitle = query
    ? `Rezultate pentru „${query}”`
    : view === "configuration"
      ? "Zone și tip de activitate"
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

  const selectedPreview = useMemo(() => snapshot.selectedServices.slice(0, 5), [snapshot.selectedServices]);
  const showActionBar = snapshot.hasSave || snapshot.hasSubmit || snapshot.hasWithdraw || Boolean(snapshot.actionStatus);
  const dataView = query ? "search" : view;

  return (
    <div className="provider-services-three" data-view={dataView} data-filter={filter}>
      <div className="provider-services-three__layout">
        <aside className="provider-services-three__left" aria-label="Organizarea serviciilor">
          <div className="provider-services-three__left-sticky">
            <div className="provider-services-three__left-heading">
              <PanelLabel index="01" label="Navigare" />
              <strong>Alege ce configurezi</strong>
              <small>Fiecare opțiune deschide partea corespunzătoare a configurației.</small>
            </div>

            <div className="provider-services-three__nav-groups">
              <nav className="provider-services-three__nav-group" aria-label="Configurarea locației">
                <p>Structura locației</p>
                <NavButton active={view === "configuration" && !query} icon={Settings2} label="Zone și tip de activitate" status={snapshot.unitCount > 0 ? `${snapshot.unitCount} zone` : "Opțional"} onClick={() => chooseView("configuration")} />
                <NavButton active={view === "options" && !query} icon={SlidersHorizontal} label="La nivelul locației" onClick={() => chooseView("options")} />
              </nav>

              {snapshot.units.length > 0 && (
                <nav className="provider-services-three__nav-group provider-services-three__units" aria-label="Servicii după spațiu">
                  <p>Oferta pe zone</p>
                  {snapshot.units.map((unit) => (
                    <NavButton
                      key={`${unit.title}-${unit.index}`}
                      active={view === "unit" && !query && activeUnitIndex === unit.index}
                      icon={unit.index === 0 ? Store : Building2}
                      label={unit.title}
                      count={unit.selected}
                      onClick={() => openUnit(unit.index)}
                    />
                  ))}
                </nav>
              )}

              <nav className="provider-services-three__nav-group" aria-label="Filtrarea serviciilor">
                <p>Oferta locației</p>
                <NavButton active={view === "all" && !query} icon={ListFilter} label="Oferta completă" count={snapshot.units.reduce((sum, unit) => sum + unit.total, 0)} onClick={() => chooseView("all")} />
                <NavButton active={view === "selected" && !query} icon={CheckCircle2} label="Oferta selectată" count={snapshot.selectedCount} onClick={() => chooseView("selected")} />
                <NavButton active={view === "issues" && !query} icon={AlertTriangle} label="Observații de catalog" count={snapshot.issueCount} onClick={() => chooseView("issues")} />
              </nav>
            </div>
          </div>
        </aside>

        <section className="provider-services-three__center" aria-labelledby="provider-services-center-title">
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
            <ProviderServicesWorkspaceRuntime location={location} {...props} onWorkspaceSnapshot={updateWorkspaceSnapshot} />
          </div>
        </section>

        <aside className="provider-services-three__right" aria-label="Previzualizarea configurației">
          <div className="provider-services-three__preview-card">
            <div className="provider-services-three__preview-heading">
              <div>
                <PanelLabel index="03" label="Rezumat" />
                <strong>Rezumat configurație</strong>
              </div>
            </div>

            <div className="provider-services-three__location">
              <strong>{locationName}</strong>
              {locationPlace && <span>{locationPlace}</span>}
              {snapshot.status && <em>{snapshot.status}</em>}
            </div>

            <section className="provider-services-three__preview-section">
              <h3>Structura locației</h3>
              {snapshot.units.length > 0 ? (
                <ul>
                  {snapshot.units.slice(0, 4).map((unit) => <li key={unit.index}><Building2 aria-hidden="true" /> {unit.title}</li>)}
                  {snapshot.units.length > 4 && <li className="is-more">+ {snapshot.units.length - 4} alte zone</li>}
                </ul>
              ) : <p>Configurează cel puțin o zonă pentru locație.</p>}
              {snapshot.careSetting && <div className="provider-services-three__care"><span>Tipul activității</span><strong>{snapshot.careSetting}</strong></div>}
            </section>

            <section className="provider-services-three__preview-section">
              <h3>Oferta și informațiile opționale</h3>
              <dl>
                <div><dt>În ofertă</dt><dd>{snapshot.selectedCount}</dd></div>
                <div><dt>Zone</dt><dd>{snapshot.unitCount}</dd></div>
                <div><dt>Activități asociate</dt><dd>{snapshot.capabilityCount}</dd></div>
                {snapshot.globalOptionCount > 0 && <div><dt>La nivelul locației</dt><dd>{snapshot.globalOptionCount}</dd></div>}
                {snapshot.issueCount > 0 && <div className="has-issues"><dt>Observații</dt><dd>{snapshot.issueCount}</dd></div>}
              </dl>
              {snapshot.configurationComplete && !snapshot.dirty && (
                <div className="provider-services-three__complete-state">
                  <CheckCircle2 aria-hidden="true" />
                  <span>Pregătită pentru trimitere</span>
                </div>
              )}
            </section>

            {snapshot.issueCount > 0 && (
              <button type="button" className="provider-services-three__requirements" onClick={() => chooseView("issues")}>
                <AlertTriangle aria-hidden="true" />
                <span><strong>{snapshot.issueCount} observații de catalog</strong><small>Clarifică opțiunile necunoscute; specialiștii și resursele nu sunt obligatorii.</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            )}

            <section className="provider-services-three__preview-section">
              <div className="provider-services-three__preview-section-heading">
                <h3>Oferta selectată</h3>
                {snapshot.selectedCount > selectedPreview.length && <button type="button" onClick={() => chooseView("selected")}>Vezi toate</button>}
              </div>
              {selectedPreview.length > 0 ? (
                <ul className="provider-services-three__selected-list">
                  {selectedPreview.map((service) => <li key={service}><CheckCircle2 aria-hidden="true" /> {service}</li>)}
                  {snapshot.selectedCount > selectedPreview.length && <li className="is-more">+ {snapshot.selectedCount - selectedPreview.length} alte opțiuni</li>}
                </ul>
              ) : <p>Oferta publică nu conține încă servicii sau produse.</p>}
            </section>

            {snapshot.adminNote && (
              <section className="provider-services-three__preview-section">
                <h3>Completări solicitate</h3>
                <p>{snapshot.adminNote}</p>
              </section>
            )}
          </div>
        </aside>
      </div>

      {showActionBar && (
        <div className="provider-services-three__actions" role="region" aria-label="Acțiuni servicii">
          <div>
            <strong>{snapshot.actionStatus || "Configurația serviciilor"}</strong>
            {snapshot.actionMessage && <span>{snapshot.actionMessage}</span>}
          </div>
          <div className="provider-services-three__action-buttons">
            {snapshot.hasSave && (
              <button type="button" disabled={!snapshot.canSave} onClick={() => clickNativeAction(/Salvează draftul|Salveaza draftul/i)}>
                <Save aria-hidden="true" /> Salvează draftul
              </button>
            )}
            {snapshot.hasSubmit && (
              <button type="button" className="is-primary" disabled={!snapshot.canSubmit} onClick={() => clickNativeAction(/Trimite modificările spre aprobare/i)}>
                <Send aria-hidden="true" /> Trimite spre aprobare
              </button>
            )}
            {snapshot.hasWithdraw && (
              <button type="button" disabled={!snapshot.canWithdraw} onClick={() => clickNativeAction(/Retrage cererea/i)}>
                <X aria-hidden="true" /> Retrage cererea
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
