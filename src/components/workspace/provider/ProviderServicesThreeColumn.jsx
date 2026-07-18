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
  unitCount: 0,
  capabilityCount: 0,
  issueCount: 0,
  selectedServices: [],
  careSetting: "",
  status: "",
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

function firstNumber(element) {
  const match = cleanText(element).match(/\d+/);
  return match ? Number(match[0]) : 0;
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

function selectedNames(section) {
  if (!section) return [];
  return [...section.querySelectorAll('button[aria-pressed="true"]')]
    .map((button) => cleanText(button.querySelector("span:nth-child(2) > span:first-child")) || cleanText(button))
    .filter(Boolean);
}

function NavButton({ active, icon: Icon, label, description, count, status, onClick }) {
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span className="provider-services-three__nav-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      {(status || Number.isFinite(count)) && <em>{status || count}</em>}
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
    const selectedServiceNames = new Set();
    let issueCount = 0;
    rows.forEach((row) => {
      const selected = row.getAttribute("aria-pressed") === "true";
      const rowText = cleanText(row);
      const issue = /Configurare incompletă|Cerințe lipsă|Necesită verificare|Spațiu neconfigurat/i.test(rowText);
      row.dataset.serviceSelected = selected ? "true" : "false";
      row.dataset.serviceIssue = issue ? "true" : "false";
      const visible = filter === "all" || (filter === "selected" && selected) || (filter === "issues" && selected && issue);
      row.dataset.serviceFilterVisible = visible ? "true" : "false";
      if (selected) {
        const label = cleanText(row.querySelector("span:nth-child(2) > span:first-child"));
        if (label) selectedServiceNames.add(label);
        if (issue) issueCount += 1;
      }
    });

    const units = [];
    if (unitList) {
      [...unitList.children].forEach((unitSection, index) => {
        if (!(unitSection instanceof HTMLElement) || unitSection.tagName !== "SECTION") return;
        const header = unitSection.querySelector(":scope > button:first-child");
        const title = cleanText(header?.querySelector("span:nth-child(2) > span:first-child")) || `Spațiul ${index + 1}`;
        const countText = cleanText(header?.querySelector("span:nth-child(2) > span:last-child"));
        const countMatch = countText.match(/(\d+)\s+selectate\s+din\s+(\d+)/i);
        const selected = countMatch ? Number(countMatch[1]) : 0;
        const total = countMatch ? Number(countMatch[2]) : 0;
        const visible = view === "all" || view === "selected" || view === "issues" || (view === "unit" && index === activeUnitIndex);
        unitSection.dataset.servicesUnitIndex = String(index);
        unitSection.dataset.servicesUnitVisible = visible ? "true" : "false";
        units.push({ index, title, selected, total });
      });
    }

    const counters = nativeSidebar ? [...nativeSidebar.querySelectorAll('[class*="grid-cols-3"] > div')] : [];
    const selectedCount = firstNumber(counters.find((item) => /Opțiuni/i.test(cleanText(item))));
    const unitCount = firstNumber(counters.find((item) => /Spații/i.test(cleanText(item))));
    const capabilityCount = firstNumber(counters.find((item) => /Activități/i.test(cleanText(item))));
    const careSetting = cleanText(numberedSections.get(3)?.querySelector('button[aria-pressed="true"]'));
    const status = cleanText(intro?.querySelector("span.rounded-full"));

    const actions = [...operationalRoot.children].find((element) => (
      element.classList?.contains("sticky") && element.classList?.contains("bottom-0")
    ));
    if (actions) actions.dataset.servicesRole = "native-actions";
    const actionButtons = actions ? [...actions.querySelectorAll("button")] : [];
    const saveButton = actionButtons.find((button) => /Salvează draftul|Salveaza draftul/i.test(cleanText(button)));
    const submitButton = actionButtons.find((button) => /Trimite spre verificare/i.test(cleanText(button)));
    const withdrawButton = actionButtons.find((button) => /Retrage cererea/i.test(cleanText(button)));
    const actionStatus = cleanText(actions?.querySelector(":scope > div > div:first-child"));
    const actionMessage = cleanText(actions?.querySelector(":scope > p"));

    setSnapshot((current) => {
      const next = {
        units: units.length > 0 ? units : current.units,
        selectedCount,
        unitCount,
        capabilityCount,
        issueCount,
        selectedServices: selectedServiceNames.size > 0 ? [...selectedServiceNames] : current.selectedServices,
        careSetting: careSetting || current.careSetting,
        status,
        actionStatus,
        actionMessage,
        canSave: Boolean(saveButton && !saveButton.disabled),
        canSubmit: Boolean(submitButton && !submitButton.disabled),
        canWithdraw: Boolean(withdrawButton && !withdrawButton.disabled),
        hasSave: Boolean(saveButton),
        hasSubmit: Boolean(submitButton),
        hasWithdraw: Boolean(withdrawButton),
      };
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }, [activeUnitIndex, filter, query, view]);

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
      ? "Spații și funcționare"
      : view === "options"
        ? "Opțiuni la nivelul locației"
        : view === "selected"
          ? "Servicii selectate"
        : view === "issues"
            ? "Servicii de completat"
            : view === "unit"
              ? activeUnit?.title || "Serviciile spațiului"
              : "Catalogul de servicii";

  const centerDescription = view === "configuration"
    ? "Definește spațiile existente, activitățile speciale și modul în care funcționează această locație."
    : view === "options"
      ? "Configurează opțiunile valabile pentru întreaga locație, precum decontarea CAS și serviciile oferite în afara sediului."
      : view === "issues"
        ? "Aici apar numai serviciile selectate cărora le lipsesc informații sau cerințe obligatorii."
        : view === "selected"
          ? "Verifică toate serviciile adăugate în configurația curentă a locației."
          : "Alege serviciile disponibile în această locație și completează cerințele relevante pentru fiecare spațiu.";

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
              <PanelLabel index="01" label="Selecție" />
              <strong>Alege ce configurezi</strong>
              <small>Fiecare opțiune deschide o parte diferită a configurației locației.</small>
            </div>

            <div className="provider-services-three__nav-groups">
              <nav className="provider-services-three__nav-group" aria-label="Structura și funcționarea locației">
                <p>Structura locației</p>
                <NavButton
                  active={view === "configuration" && !query}
                  icon={Settings2}
                  label="Spații și funcționare"
                  description="Alege spațiile, activitățile speciale și modul de funcționare."
                  status={snapshot.unitCount > 0 ? `${snapshot.unitCount} spații` : "Necesar"}
                  onClick={() => chooseView("configuration")}
                />
                <NavButton
                  active={view === "options" && !query}
                  icon={SlidersHorizontal}
                  label="Opțiuni la nivelul locației"
                  description="Configurează decontarea CAS și serviciile oferite în afara sediului."
                  onClick={() => chooseView("options")}
                />
              </nav>

              <nav className="provider-services-three__nav-group" aria-label="Filtrarea serviciilor">
                <p>Oferta locației</p>
                <NavButton
                  active={view === "all" && !query}
                  icon={ListFilter}
                  label="Catalogul de servicii"
                  description="Vezi oferta completă și alege ce este disponibil aici."
                  count={snapshot.units.reduce((sum, unit) => sum + unit.total, 0)}
                  onClick={() => chooseView("all")}
                />
                <NavButton
                  active={view === "selected" && !query}
                  icon={CheckCircle2}
                  label="Servicii selectate"
                  description="Verifică opțiunile adăugate în configurația curentă."
                  count={snapshot.selectedCount}
                  onClick={() => chooseView("selected")}
                />
                <NavButton
                  active={view === "issues" && !query}
                  icon={AlertTriangle}
                  label="Servicii de completat"
                  description="Rezolvă informațiile sau cerințele care încă lipsesc."
                  count={snapshot.issueCount}
                  onClick={() => chooseView("issues")}
                />
              </nav>

              {snapshot.units.length > 0 && (
                <nav className="provider-services-three__nav-group provider-services-three__units" aria-label="Servicii după spațiu">
                  <p>Servicii după spațiu</p>
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
            <ProviderServicesWorkspaceRuntime location={location} {...props} />
          </div>
        </section>

        <aside className="provider-services-three__right" aria-label="Previzualizarea configurației">
          <div className="provider-services-three__preview-card">
            <div className="provider-services-three__preview-heading">
              <div>
                <PanelLabel index="03" label="Previzualizare" />
                <strong>Rezumat servicii</strong>
              </div>
            </div>

            <div className="provider-services-three__location">
              <strong>{locationName}</strong>
              {locationPlace && <span>{locationPlace}</span>}
              {snapshot.status && <em>{snapshot.status}</em>}
            </div>

            <section className="provider-services-three__preview-section">
              <h3>Spații și activități</h3>
              {snapshot.units.length > 0 ? (
                <ul>
                  {snapshot.units.slice(0, 4).map((unit) => <li key={unit.index}><Building2 aria-hidden="true" /> {unit.title}</li>)}
                  {snapshot.units.length > 4 && <li className="is-more">+ {snapshot.units.length - 4} alte spații</li>}
                </ul>
              ) : <p>Configurează cel puțin un spațiu pentru locație.</p>}
              {snapshot.careSetting && <div className="provider-services-three__care"><span>Mod de funcționare</span><strong>{snapshot.careSetting}</strong></div>}
            </section>

            <section className="provider-services-three__preview-section">
              <h3>Rezumat servicii</h3>
              <dl>
                <div><dt>Selectate</dt><dd>{snapshot.selectedCount}</dd></div>
                <div><dt>Spații</dt><dd>{snapshot.unitCount}</dd></div>
                <div><dt>Activități</dt><dd>{snapshot.capabilityCount}</dd></div>
                {snapshot.issueCount > 0 && <div className="has-issues"><dt>Necesită completare</dt><dd>{snapshot.issueCount}</dd></div>}
              </dl>
              {snapshot.unitCount > 0 && snapshot.issueCount === 0 && (
                <div className="provider-services-three__complete-state">
                  <CheckCircle2 aria-hidden="true" />
                  <span>Configurație completă</span>
                </div>
              )}
            </section>

            {snapshot.issueCount > 0 && (
              <button type="button" className="provider-services-three__requirements" onClick={() => chooseView("issues")}>
                <AlertTriangle aria-hidden="true" />
                <span><strong>{snapshot.issueCount} cerințe de completat</strong><small>Verifică specialiștii, echipamentele și facilitățile necesare.</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            )}

            <section className="provider-services-three__preview-section">
              <div className="provider-services-three__preview-section-heading">
                <h3>Servicii selectate</h3>
                {snapshot.selectedCount > selectedPreview.length && <button type="button" onClick={() => chooseView("selected")}>Vezi toate</button>}
              </div>
              {selectedPreview.length > 0 ? (
                <ul className="provider-services-three__selected-list">
                  {selectedPreview.map((service) => <li key={service}><CheckCircle2 aria-hidden="true" /> {service}</li>)}
                  {snapshot.selectedCount > selectedPreview.length && <li className="is-more">+ {snapshot.selectedCount - selectedPreview.length} alte servicii</li>}
                </ul>
              ) : <p>Nu există servicii selectate încă.</p>}
            </section>
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
              <button type="button" className="is-primary" disabled={!snapshot.canSubmit} onClick={() => clickNativeAction(/Trimite spre verificare/i)}>
                <Send aria-hidden="true" /> Trimite spre verificare
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
