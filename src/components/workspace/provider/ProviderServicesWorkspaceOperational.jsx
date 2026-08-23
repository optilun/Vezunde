// Faza 2 din docs/plan-refactor-servicii-2026-08-18.md: acest fisier doar COMPUNE
// ecranul. Starea si persistenta stau in services/useProviderServicesConfig.js,
// functiile pure in services/servicesConfigModel.js, iar fiecare bucata de
// interfata in propriul fisier din services/. Randarea nu s-a schimbat.
import React from "react";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { useProviderServicesConfig } from "./services/useProviderServicesConfig";
import UnitPicker from "./services/UnitPicker";
import CareSettingPicker from "./services/CareSettingPicker";
import GlobalServiceSections from "./services/GlobalServiceSections";
import ServiceCatalogIntro from "./services/ServiceCatalogIntro";
import ServicesSearchResults from "./services/ServicesSearchResults";
import UnitAccordion from "./services/UnitAccordion";
import { FigureNothingSelected } from "./services/ServicesFigures";
import LegacyServices from "./services/LegacyServices";
import ServicesSidebar from "./services/ServicesSidebar";
import DependencyRemovalDialog from "./services/DependencyRemovalDialog";
import ServicesActionBar from "./services/ServicesActionBar";

export default function ProviderServicesWorkspaceOperational(props) {
  const {
    config, draft, persistenceMode, loading, saving, message, error, conflicts, pendingRemoval,
    query, selected, approvedSelected, activeUnits, approvedUnits, capabilities, approvedCapabilities,
    serviceUnitMap, casServiceKeys, resourceLinks, approvedResourceLinks, careSetting, approvedCareSetting,
    setCareSetting, suggestions, rawRemovalKeys, openUnit, setOpenUnit, operationalLayout, profileSections,
    globalSections, sectionsByUnit, selectableUnits, primaryUnits, selectableCapabilities, primaryCapabilities,
    visibleUnits, searchResults, selectedCount, selectedByUnit, draftPrerequisites, readiness, dirty, editable,
    pendingReview, isB2BProfile, load, toggleUnit, toggleCapability, toggleService, setServicesSelection, toggleCasService,
    changeSectionUnit, toggleResource, addSuggestion, removeSuggestion, toggleRawRemoval,
    confirmDependencyRemoval, cancelDependencyRemoval, save, submit, withdraw, setQuery,
  } = useProviderServicesConfig(props);

  // Faza 3 din docs/plan-refactor-servicii-2026-08-18.md: sectiunea activa, filtrul si
  // zona deschisa vin acum ca proprietati de la invelis. Atributele data-* sunt scrise
  // declarativ aici, nu de un MutationObserver care citea titlurile din DOM.
  const nav = props.navigation || {};
  const navView = nav.view || "all";
  const navFilter = nav.filter || "all";
  const navConfigStep = nav.configStep || 1;
  const substep = (step) => ({
    "data-services-panel": "configuration",
    "data-services-substep": String(step),
    "data-services-substep-visible": navConfigStep === step ? "true" : "false",
  });
  const unitVisible = (index) => (
    navView === "unit" ? index === (nav.activeUnitIndex || 0) : true
  );

  if (loading) return <div className="rounded-[24px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă structura profesională a locației...</div>;
  if (error && !config) return <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-950"><p>{error}</p><button type="button" onClick={load} className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold">Încearcă din nou</button></div>;

  return (
    <div className="space-y-4 pb-20">
      {draft && (
        <div className="flex items-center gap-2 px-1">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>
        </div>
      )}

      {persistenceMode === "legacy" && <div className="services-alert rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Catalogul V2 este disponibil local. Draftul de servicii folosește fluxul compatibil până când endpointurile de configurare sunt publicate.</div>}
      {pendingReview && <div className="services-alert rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Modificările sunt în curs de aprobare. Editarea este blocată până la decizia administratorului.</div>}
      {draft?.admin_note && ["needs_more_info", "rejected"].includes(draft.status) && <div className="services-alert rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950"><strong className="block">Completări solicitate</strong><span className="mt-1 block">{draft.admin_note}</span></div>}
      {conflicts.length > 0 && !draft && <div className="services-alert rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">{conflicts[0].message}</div>}
      {/* Conditia "&& !pendingReview" a fost scoasa (2026-08-23): un membru fara drept de
          editare primea, in timpul unei verificari, explicatia "in curs de aprobare" in locul
          celei reale. Ii spunea ca trebuie sa astepte, cand de fapt nu ar fi putut edita nici
          dupa aprobare. Cele doua motive pot coexista si atunci se afiseaza amandoua. */}
      {config?.can_edit_services === false && <div className="services-alert rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">Ai acces de vizualizare. Modificarea serviciilor publice este disponibilă ownerului și managerului locației.</div>}
      {error && config && <div className="services-alert rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <div data-services-role="workspace" className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <div data-services-role="content" className="space-y-4">
          {/* CapabilityPicker eliminat complet (2026-08-18, la cererea lui Alex): modulul
              separat "Dotari si activitati" a fost desfiintat. Fiecare comutator traieste
              acum inline, in UnitAccordion, langa sectiunea sau zona pe care o controleaza. */}
          {!query && <UnitPicker dataAttrs={substep(1)} units={selectableUnits} approvedUnits={approvedUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={!editable} onToggle={toggleUnit} />}
          {/* CareSettingPicker mutat aici (2026-08-18, la cererea lui Alex): era pasul 3,
              de sine statator, pentru o singura lista derulanta - disproportionat pentru
              un modul intreg. "Tipul activitatii" e un atribut la nivel de locatie, ca si
              cele de mai jos (domiciliu, sediul firmei etc.), nu legat de o zona anume. */}
          {/* 2026-08-23: cele doua bucati ale ecranului "La nivelul locatiei" intra in
              acelasi panou. Tipul activitatii devine primul rand, nu un card separat cu
              gol dupa el. Atributul data-services-panel ramane pe UN singur element. */}
          {!query && (
            <GlobalServiceSections
              dataAttrs={{ "data-services-panel": "options" }}
              sections={globalSections}
              selected={selected}
              approvedSelected={approvedSelected}
              disabled={!editable}
              onToggleService={toggleService}
              onSetSelection={setServicesSelection}
              careSettingSlot={(
                <CareSettingPicker
                  embedded
                  options={operationalLayout.careSettings || []}
                  approvedValue={approvedCareSetting}
                  value={careSetting}
                  disabled={!editable}
                  onChange={setCareSetting}
                />
              )}
            />
          )}

          {!query && <ServiceCatalogIntro dataAttrs={{ "data-services-role": "catalog-intro" }} activeUnits={activeUnits} selectedCount={selectedCount} />}

          {query ? (
            <ServicesSearchResults
              dataAttrs={{ "data-services-panel": "search-results" }}
              filter={navFilter}
              query={query}
              results={searchResults}
              selected={selected}
              approvedSelected={approvedSelected}
              serviceUnitMap={serviceUnitMap}
              activeUnits={activeUnits}
              prerequisites={draftPrerequisites}
              disabled={!editable}
              onToggleService={toggleService}
              onClearQuery={() => setQuery("")}
            />
          ) : (
            <div data-services-panel="units" className="space-y-3">
              {/* Filtrele de verificare fara niciun rezultat lasau ecranul complet gol
                  (2026-08-23): apasai "Oferta selectata" cu zero servicii alese si nu
                  primeai nimic, nici macar o propozitie. */}
              {navFilter !== "all" && !visibleUnits.some((unitKey) => (sectionsByUnit[unitKey] || []).some((section) => section.items.some((item) => {
                const active = (selected[item.group] || []).includes(item.id);
                return navFilter === "selected" ? active : active && draftPrerequisites[item.id]?.eligible === false;
              }))) && (
                <div className="flex flex-col items-center rounded-[22px] border border-border bg-card px-6 py-12 text-center">
                  <FigureNothingSelected />
                  <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {navFilter === "selected" ? "Nu ai ales încă niciun serviciu" : "Nicio observație de catalog"}
                  </p>
                  <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                    {navFilter === "selected"
                      ? "Deschide o zonă din stânga și bifează serviciile pe care le oferi."
                      : "Nimic de corectat: niciun serviciu ales nu cere o condiție pe care locația nu o îndeplinește."}
                  </p>
                </div>
              )}
              {visibleUnits.map((unitKey, unitIndex) => <UnitAccordion key={unitKey} unitKey={unitKey} filter={navFilter} dataAttrs={{ "data-services-unit-index": String(unitIndex), "data-services-unit-visible": unitVisible(unitIndex) ? "true" : "false" }} sections={sectionsByUnit[unitKey] || []} selected={selected} approvedSelected={approvedSelected} serviceUnitMap={serviceUnitMap} prerequisites={draftPrerequisites} config={{ ...config, activeUnits }} resourceLinks={resourceLinks} approvedResourceLinks={approvedResourceLinks} customSuggestions={suggestions} capabilities={capabilities} approvedCapabilities={approvedCapabilities} onToggleCapability={toggleCapability} open={openUnit === unitKey} disabled={!editable} onOpen={() => setOpenUnit((current) => current === unitKey ? "" : unitKey)} onToggleService={toggleService} onSetSelection={setServicesSelection} stepIndex={unitIndex} stepMode={navView === "unit"} active={unitVisible(unitIndex)} onGoToUnit={nav.onOpenUnit} onChooseView={nav.onChooseView} unitTitles={visibleUnits} casServiceKeys={casServiceKeys} onToggleCas={toggleCasService} onChangeSectionUnit={changeSectionUnit} onToggleResource={toggleResource} onAddSuggestion={addSuggestion} onRemoveSuggestion={removeSuggestion} />)}
              {visibleUnits.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Selectează cel puțin o zonă care există în locație.</div>}
            </div>
          )}

          <LegacyServices dataAttrs={{ "data-services-panel": "advanced" }} services={config?.legacy_or_unknown_services || []} rawRemovalKeys={rawRemovalKeys} disabled={!editable} onToggle={toggleRawRemoval} />
        </div>

        <ServicesSidebar
          dataAttrs={{ "data-services-role": "native-summary" }}
          activeUnits={activeUnits}
          capabilities={capabilities}
          selectedCount={selectedCount}
          selectedByUnit={selectedByUnit}
          sections={profileSections}
          selected={selected}
          b2b={isB2BProfile}
          careSetting={careSetting}
          allowedCareSettings={operationalLayout.careSettings || []}
          resourceLinks={resourceLinks}
          unitOrder={selectableUnits}
        />
      </div>

      <DependencyRemovalDialog request={pendingRemoval} onCancel={cancelDependencyRemoval} onConfirm={confirmDependencyRemoval} />

      <ServicesActionBar
        dataAttrs={{ "data-services-role": "native-actions" }}
        pendingReview={pendingReview}
        dirty={dirty}
        draft={draft}
        saving={saving}
        editable={editable}
        persistenceMode={persistenceMode}
        configurationComplete={readiness.configurationComplete}
        blockerMessage={readiness.blockers[0]?.message || ""}
        message={message}
        onSave={save}
        onSubmit={submit}
        onWithdraw={withdraw}
      />
    </div>
  );
}