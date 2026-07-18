import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import ProviderServicesWorkspaceRuntime from "./ProviderServicesWorkspaceRuntime";

const EMPTY_SNAPSHOT = {
  selectedCount: 0,
  unitCount: 0,
  capabilityCount: 0,
  status: "",
  configurationComplete: false,
  unitNames: [],
  capabilityNames: [],
  careSetting: "",
  openUnitTitle: "",
  categories: [],
  visibleRows: 0,
  issueCount: 0,
  advancedAvailable: false,
};

function text(element) {
  return String(element?.textContent || "").trim().replace(/\s+/g, " ");
}

function numberFrom(element) {
  const match = text(element).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function setNativeInputValue(input, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectedNames(section) {
  if (!section) return [];
  return [...section.querySelectorAll('button[aria-pressed="true"]')]
    .map((button) => text(button.querySelector("span:nth-child(2) > span:first-child")) || text(button))
    .filter(Boolean);
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

export default function ProviderServicesProgressive(props) {
  const contentRef = useRef(null);
  const initializedRef = useRef(false);
  const [configurationOpen, setConfigurationOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);

  const decorate = useCallback(() => {
    const root = contentRef.current;
    const operationalRoot = root?.querySelector(":scope > div");
    if (!operationalRoot) return;

    const intro = operationalRoot.querySelector(":scope > section:first-child");
    if (intro) intro.dataset.servicesRole = "native-search";
    const nativeSearch = intro?.querySelector('input[placeholder^="Caută"], input[placeholder^="Cauta"]');
    if (nativeSearch && nativeSearch.value !== searchValue) setNativeInputValue(nativeSearch, searchValue);

    const mainGrid = findMainGrid(root);
    if (!mainGrid) return;
    mainGrid.dataset.servicesRole = "workspace";

    const mainColumn = [...mainGrid.children].find((element) => element.classList?.contains("space-y-4"));
    const sidebar = [...mainGrid.children].find((element) => element.tagName === "ASIDE");
    if (!mainColumn) return;
    mainColumn.dataset.servicesRole = "content";
    if (sidebar) sidebar.dataset.servicesRole = "summary";

    const directSections = [...mainColumn.children].filter((element) => element.tagName === "SECTION");
    const sectionByNumber = new Map();
    directSections.forEach((section) => {
      const headingElement = section.querySelector("h2");
      const heading = text(headingElement);
      const match = heading.match(/^(\d+)\./);
      if (!match) return;
      const number = Number(match[1]);
      sectionByNumber.set(number, section);
      section.dataset.servicesConfigurationIndex = String(number);
      if (headingElement) headingElement.dataset.servicesCleanTitle = heading.replace(/^\d+\.\s*/, "");
    });

    [1, 2, 3, 4].forEach((number) => {
      const section = sectionByNumber.get(number);
      if (section) section.dataset.servicesRole = "configuration";
    });

    const catalogIntro = sectionByNumber.get(5);
    if (catalogIntro) catalogIntro.dataset.servicesRole = "catalog-intro";

    const unitList = [...mainColumn.children].find((element) => element.classList?.contains("space-y-3"));
    if (unitList) unitList.dataset.servicesRole = "unit-list";

    const legacy = directSections.find((section) => text(section).includes("Date existente care necesită migrare"));
    if (legacy) legacy.dataset.servicesRole = "advanced";

    const stickyActions = [...operationalRoot.children].find((element) => (
      element.classList?.contains("sticky") && element.classList?.contains("bottom-0")
    ));
    if (stickyActions) {
      stickyActions.dataset.servicesRole = "actions";
      const hasEnabledAction = [...stickyActions.querySelectorAll("button")].some((button) => !button.disabled);
      const actionText = text(stickyActions);
      const needsAttention = /modificări nesalvate|în verificare/i.test(actionText);
      stickyActions.dataset.servicesActionsVisible = hasEnabledAction || needsAttention ? "true" : "false";
    }

    let openUnitTitle = "";
    const categories = [];
    let visibleRows = 0;
    let issueCount = 0;
    let advancedAvailable = Boolean(legacy);

    const serviceRows = [...operationalRoot.querySelectorAll("button.grid")];
    serviceRows.forEach((row) => {
      const selected = row.getAttribute("aria-pressed") === "true";
      const rowText = text(row);
      const issue = /Configurare incompletă|Cerințe lipsă|Necesită verificare|Spațiu neconfigurat/i.test(rowText);
      row.dataset.serviceSelected = selected ? "true" : "false";
      row.dataset.serviceIssue = issue ? "true" : "false";
      const matches = filter === "all" || (filter === "selected" && selected) || (filter === "issues" && issue);
      row.dataset.serviceFilterVisible = matches ? "true" : "false";
      if (matches) visibleRows += 1;
      if (issue) issueCount += 1;
    });

    if (unitList) {
      [...unitList.children].forEach((unitSection) => {
        if (!(unitSection instanceof HTMLElement) || unitSection.tagName !== "SECTION") return;
        unitSection.dataset.servicesRole = "unit";
        const unitHeader = unitSection.querySelector(":scope > button:first-child");
        const unitContent = [...unitSection.children].find((child) => child !== unitHeader && child instanceof HTMLElement);
        if (!unitContent) return;

        openUnitTitle = text(unitHeader?.querySelector("span:nth-child(2) > span:first-child")) || text(unitHeader);
        const categoryElements = [...unitContent.children].filter((child) => (
          child instanceof HTMLElement
          && child.querySelector("h3")
          && child.querySelector("button.grid")
        ));

        categoryElements.forEach((category, index) => {
          const title = text(category.querySelector("h3")) || `Categoria ${index + 1}`;
          const rows = [...category.querySelectorAll("button.grid")];
          const selected = rows.filter((row) => row.getAttribute("aria-pressed") === "true").length;
          const issues = rows.filter((row) => row.dataset.serviceIssue === "true").length;
          const matching = rows.filter((row) => row.dataset.serviceFilterVisible === "true").length;
          category.dataset.servicesRole = "category";
          category.dataset.servicesCategoryIndex = String(index);
          category.dataset.servicesCategoryActive = index === activeCategory ? "true" : "false";
          category.dataset.servicesCategoryVisible = matching > 0 ? "true" : "false";
          categories.push({ index, title, total: rows.length, selected, issues, matching });

          const suggestion = [...category.children].find((child) => text(child).includes("Nu găsești opțiunea?"));
          if (suggestion instanceof HTMLElement) {
            suggestion.dataset.servicesRole = "advanced";
            advancedAvailable = true;
          }
        });

        const resources = [...unitContent.children].find((child) => text(child).includes("Specialiști și dotări asociate acestei unități"));
        if (resources instanceof HTMLElement) {
          const resourceCount = numberFrom(resources.querySelector("span.rounded-full"));
          const needed = issueCount > 0 || resourceCount > 0;
          resources.dataset.servicesRole = "resources";
          resources.dataset.servicesNeeded = needed ? "true" : "false";
          advancedAvailable = true;
        }
      });
    }

    const counters = sidebar ? [...sidebar.querySelectorAll('[class*="grid-cols-3"] > div')] : [];
    const selectedCount = numberFrom(counters.find((item) => /Opțiuni/i.test(text(item))));
    const unitCount = numberFrom(counters.find((item) => /Spații/i.test(text(item))));
    const capabilityCount = numberFrom(counters.find((item) => /Activități/i.test(text(item))));
    const status = text(intro?.querySelector("span.rounded-full"));
    const unitNames = selectedNames(sectionByNumber.get(1));
    const capabilityNames = selectedNames(sectionByNumber.get(2));
    const careSection = sectionByNumber.get(3);
    const careSetting = text(careSection?.querySelector('button[aria-pressed="true"]'));
    const configurationComplete = unitCount > 0 && (!careSection || Boolean(careSetting));

    if (!initializedRef.current) {
      initializedRef.current = true;
      setConfigurationOpen(!configurationComplete);
    }

    setSnapshot({
      selectedCount,
      unitCount,
      capabilityCount,
      status,
      configurationComplete,
      unitNames,
      capabilityNames,
      careSetting,
      openUnitTitle,
      categories,
      visibleRows,
      issueCount,
      advancedAvailable,
    });
  }, [activeCategory, filter, searchValue]);

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

  useEffect(() => {
    if (snapshot.categories.length === 0) {
      if (activeCategory !== 0) setActiveCategory(0);
      return;
    }
    if (!snapshot.categories.some((category) => category.index === activeCategory && category.matching > 0)) {
      const firstVisible = snapshot.categories.find((category) => category.matching > 0);
      if (firstVisible && firstVisible.index !== activeCategory) setActiveCategory(firstVisible.index);
    }
  }, [activeCategory, snapshot.categories]);

  const configurationSummary = useMemo(() => {
    if (snapshot.unitNames.length === 0) {
      return snapshot.unitCount > 0
        ? `${snapshot.unitCount} spații configurate`
        : "Configurarea locației nu este completată.";
    }
    const units = snapshot.unitNames.slice(0, 2).join(", ");
    const extra = snapshot.unitNames.length > 2 ? ` +${snapshot.unitNames.length - 2}` : "";
    return `${units}${extra}`;
  }, [snapshot.unitCount, snapshot.unitNames]);

  const configurationDetail = snapshot.careSetting
    || (snapshot.unitCount > 0
      ? "Configurarea de bază este completă."
      : "Alege spațiile, activitățile și modul de funcționare.");

  const updateSearch = (value) => {
    setSearchValue(value);
    const input = contentRef.current?.querySelector('input[placeholder^="Caută"], input[placeholder^="Cauta"]');
    if (input) setNativeInputValue(input, value);
  };

  const filterOptions = [
    { id: "all", label: "Toate" },
    { id: "selected", label: "Selectate" },
    { id: "issues", label: "Necesită completare" },
  ];

  return (
    <div
      className={`provider-services-progressive ${configurationOpen ? "is-configuration-open" : "is-configuration-collapsed"} ${advancedOpen ? "is-advanced-open" : "is-advanced-closed"}`}
      data-services-filter={filter}
    >
      <section className="provider-services-progressive__overview" aria-label="Rezumat servicii">
        <div className="provider-services-progressive__overview-copy">
          <div className="provider-services-progressive__eyebrow">
            {snapshot.status && <span>{snapshot.status}</span>}
            <span>{snapshot.selectedCount} opțiuni selectate</span>
          </div>
          <h2>Oferta publică a locației</h2>
          <p>Selectează serviciile disponibile și completează doar informațiile cerute de opțiunile alese.</p>
        </div>
        <div className="provider-services-progressive__metrics" aria-label="Sumar configurare">
          <span><strong>{snapshot.selectedCount}</strong> opțiuni</span>
          <span><strong>{snapshot.unitCount}</strong> spații</span>
          <span><strong>{snapshot.capabilityCount}</strong> activități</span>
        </div>
      </section>

      <section className="provider-services-progressive__configuration">
        <button
          type="button"
          className="provider-services-progressive__configuration-button"
          aria-expanded={configurationOpen}
          onClick={() => setConfigurationOpen((value) => !value)}
        >
          <span className="provider-services-progressive__configuration-copy">
            <span className="provider-services-progressive__configuration-title">Configurarea locației</span>
            <strong>{configurationSummary}</strong>
            <small>{configurationDetail}</small>
          </span>
          <span className="provider-services-progressive__configuration-action">
            {configurationOpen ? "Restrânge" : "Modifică"}
            <ChevronDown aria-hidden="true" />
          </span>
        </button>
      </section>

      <section className="provider-services-progressive__catalog-toolbar" aria-label="Căutare și filtrare servicii">
        <div className="provider-services-progressive__search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Caută un serviciu"
            aria-label="Caută un serviciu"
          />
          {searchValue && (
            <button type="button" onClick={() => updateSearch("")} aria-label="Șterge căutarea">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="provider-services-progressive__filters" role="group" aria-label="Filtre servicii">
          <Filter aria-hidden="true" />
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {snapshot.openUnitTitle && snapshot.categories.length > 1 && (
        <section className="provider-services-progressive__categories" aria-label={`Categorii pentru ${snapshot.openUnitTitle}`}>
          <div className="provider-services-progressive__categories-heading">
            <span>{snapshot.openUnitTitle}</span>
            <small>Alege categoria pe care vrei să o configurezi.</small>
          </div>
          <div className="provider-services-progressive__category-list" role="tablist" aria-label="Categorii de servicii">
            {snapshot.categories.filter((category) => category.matching > 0).map((category) => (
              <button
                key={`${snapshot.openUnitTitle}-${category.index}`}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.index}
                onClick={() => setActiveCategory(category.index)}
              >
                <span>{category.title}</span>
                <small>{filter === "issues" ? category.issues : filter === "selected" ? category.selected : category.total}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {filter !== "all" && snapshot.visibleRows === 0 && (
        <div className="provider-services-progressive__empty-filter">
          <SlidersHorizontal aria-hidden="true" />
          <span>Nu există servicii în filtrul selectat pentru secțiunea deschisă.</span>
          <button type="button" onClick={() => setFilter("all")}>Arată toate serviciile</button>
        </div>
      )}

      <div ref={contentRef} className="provider-services-polish">
        <ProviderServicesWorkspaceRuntime {...props} />
      </div>

      {snapshot.advancedAvailable && (
        <button
          type="button"
          className="provider-services-progressive__advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          <Settings2 aria-hidden="true" />
          <span>
            <strong>Setări avansate</strong>
            <small>Propuneri manuale, resurse opționale și date existente.</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
