// Zona (unit) cu grupurile ei de servicii.
//
// 2026-08-23 (varianta A aprobata de Alex): grupurile nu se mai deschid pe rand. Toate
// grupurile zonei se vad deodata, in coloane, fiecare in cardul lui (GroupCard.jsx).
// Drill-down-ul din 2026-08-18 rezolvase lungimea listei, dar te obliga sa intri si sa
// iesi din fiecare grup ca sa stii ce ai bifat.
//
// Zona are acum o bara proprie, deasupra cardurilor: contorul ei, comutatorul
// "Descrieri" (descrierile de catalog sunt ascunse implicit - de acolo venea cea mai
// mare parte a textului de citit) si actiunile in masa pe toata zona.
import React, { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Eraser, ListChecks, Text } from "lucide-react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import ServiceRow from "./ServiceRow";
import GroupCard from "./GroupCard";
import UnitResourcesPanel from "./UnitResourcesPanel";
import CapabilityToggle from "./CapabilityToggle";
import { isSelected, possibleUnits, resolveSectionUnit, selectedCountForSection } from "./servicesConfigModel";
import { CAS_ELIGIBLE_GROUPS, UNIT_FALLBACK_ICON, UNIT_ICONS, UNIT_TONE } from "./servicesUiTokens";

// Capabilitati grupate la nivel de zona (2026-08-18): cand o capabilitate deschide mai
// multe sectiuni in ACEEASI zona (ophthalmology_specialties -> 7 sectiuni) sau cand o
// zona intreaga e dedicata unei activitati (B2B), comutatorul sta o singura data, in
// capul zonei - nu repetat la fiecare sectiune. Restul capabilitatilor sunt inline,
// direct in cardul sectiunii unice pe care o deschid.
const ZONE_LEVEL_CAPABILITY_KEYS = {
  ophthalmology_office: ["ophthalmology_specialties"],
  b2b_distribution_center: ["b2b_distribution", "b2b_logistics", "b2b_technical_support"],
};

export default function UnitAccordion({ unitKey, sections, selected, approvedSelected, serviceUnitMap, prerequisites, config, resourceLinks, approvedResourceLinks, customSuggestions, capabilities = [], approvedCapabilities = [], onToggleCapability, open, disabled, casServiceKeys = [], onToggleCas, onOpen, onToggleService, onSetSelection, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion, filter = "all", dataAttrs = {}, stepIndex = 0, stepCount = 0, stepMode = false, onGoToUnit, onChooseView, unitTitles = [] }) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
  const selectedCount = sections.reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  const zoneCapabilityKeys = ZONE_LEVEL_CAPABILITY_KEYS[unitKey] || [];
  const findCapabilityRow = (capabilityKey) => capabilities.find((item) => item.capability_key === capabilityKey);
  const isCapabilityApproved = (capabilityKey) => approvedCapabilities.some((item) => item.capability_key === capabilityKey);
  const toggleZoneCapability = (capabilityKey) => onToggleCapability?.(capabilityKey, [unitKey]);
  const inlineCapabilityRendered = new Set();
  // Descrierile de catalog, ascunse implicit. Comutatorul e per zona: il pornesti cand
  // chiar nu stii ce inseamna un serviciu, nu il porti dupa tine tot timpul.
  const [showDescriptions, setShowDescriptions] = useState(false);
  // Aceeasi regula de vizibilitate ca in ServiceRow. Cand un filtru e activ, grupurile
  // fara niciun rand vizibil nu se mai randeaza.
  const rowVisible = (item) => {
    if (filter === "all") return true;
    const active = isSelected(selected, item);
    if (filter === "selected") return active;
    return active && prerequisites[item.id]?.eligible === false;
  };
  const visibleSections = filter === "all"
    ? sections
    : sections.filter((section) => section.items.some(rowVisible));
  const allItems = sections.flatMap((section) => section.items);
  const missingItems = allItems.filter((item) => !isSelected(selected, item));
  // Subsolul de pas (2026-08-23, la cererea lui Alex): cadrul zonei se inchide cu
  // pozitia in sir si cu butonul catre zona urmatoare, ca intr-o aplicatie. Apare doar
  // cand esti INTR-o zona (stepMode) si fara filtru - la lista completa sau la un filtru
  // de verificare nu exista "urmatorul".
  const nextUnitKey = unitTitles[stepIndex + 1] || "";
  const nextUnitTitle = nextUnitKey ? (getFunctionalUnitDefinition(nextUnitKey)?.shortTitle || getFunctionalUnitDefinition(nextUnitKey)?.title || "") : "";
  const showStepFooter = stepMode && filter === "all" && stepCount > 0;
  return (
    <section {...dataAttrs} data-services-step={showStepFooter ? "true" : "false"} className={`services-unit overflow-hidden rounded-[22px] border bg-card transition ${open ? "border-foreground/20 shadow-sm" : "border-border"}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 sm:px-5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${UNIT_TONE[unitKey] ? "" : open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}
          style={UNIT_TONE[unitKey] ? { background: UNIT_TONE[unitKey].bg, borderColor: UNIT_TONE[unitKey].border, color: UNIT_TONE[unitKey].text } : undefined}
        ><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="services-unit__title block text-sm font-bold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {zoneCapabilityKeys.length > 0 && (
            <div className="space-y-2 border-b border-border/60 bg-secondary/10 p-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Activități pentru această zonă</p>
              {zoneCapabilityKeys.map((capabilityKey) => (
                <CapabilityToggle
                  key={capabilityKey}
                  capabilityKey={capabilityKey}
                  activeRow={findCapabilityRow(capabilityKey)}
                  approved={isCapabilityApproved(capabilityKey)}
                  disabled={disabled}
                  onToggle={() => toggleZoneCapability(capabilityKey)}
                  compact
                />
              ))}
            </div>
          )}

          {filter === "all" && total > 0 && (
            <div className="services-unit__toolbar">
              <span className="services-unit__toolbar-count"><strong>{selectedCount}</strong> din {total} alese</span>
              <span className="services-unit__toolbar-spacer" />
              {missingItems.length > 0 ? (
                <button type="button" disabled={disabled} onClick={() => onSetSelection?.(missingItems, unitKey, true)} className="services-unit__toolbar-button">
                  <ListChecks aria-hidden="true" /> Selectează toate ({missingItems.length})
                </button>
              ) : null}
              {selectedCount > 0 && (
                <button type="button" disabled={disabled} onClick={() => onSetSelection?.(allItems, unitKey, false)} className="services-unit__toolbar-button">
                  <Eraser aria-hidden="true" /> Golește zona
                </button>
              )}
              <button type="button" aria-pressed={showDescriptions} onClick={() => setShowDescriptions((value) => !value)} className="services-unit__toolbar-button is-quiet">
                <Text aria-hidden="true" /> Descrieri
              </button>
            </div>
          )}

          {filter === "all" ? (
            <div className="services-group-grid">
              {visibleSections.map((section) => {
                const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
                const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
                const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
                // Comutator inline: sectiunile cu o capabilitate proprie, care NU e deja
                // tratata la nivel de zona, il primesc in card. Deduplicat: doua sectiuni
                // cu aceeasi capabilitate il arata o singura data.
                const sectionCapabilityKey = section.capabilityKey && !zoneCapabilityKeys.includes(section.capabilityKey) && !inlineCapabilityRendered.has(section.capabilityKey)
                  ? section.capabilityKey
                  : "";
                if (sectionCapabilityKey) inlineCapabilityRendered.add(sectionCapabilityKey);
                return (
                  <GroupCard
                    key={section.key}
                    section={section}
                    unitKey={unitKey}
                    activeUnit={activeUnit}
                    selected={selected}
                    approvedSelected={approvedSelected}
                    prerequisites={prerequisites}
                    disabled={disabled}
                    availableParents={availableParents}
                    capabilityKey={sectionCapabilityKey}
                    capabilityRow={findCapabilityRow(sectionCapabilityKey)}
                    capabilityApproved={isCapabilityApproved(sectionCapabilityKey)}
                    onToggleCapability={onToggleCapability}
                    casServiceKeys={casServiceKeys}
                    onToggleCas={onToggleCas}
                    onToggleService={onToggleService}
                    onSetSelection={onSetSelection}
                    onChangeSectionUnit={onChangeSectionUnit}
                    suggestions={suggestions}
                    onAddSuggestion={onAddSuggestion}
                    onRemoveSuggestion={onRemoveSuggestion}
                    showDescription={showDescriptions}
                    filter={filter}
                  />
                );
              })}
            </div>
          ) : (
            // Cu un filtru activ (selectate / observatii) randam plat: se vede tot ce
            // trece filtrul, fara carduri si fara actiuni in masa.
            visibleSections.map((section) => {
              const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
              return (
                <div key={section.key} className="pt-3 first:pt-1">
                  <h3 className="px-4 pb-1 text-[13px] font-bold tracking-tight sm:px-5">{section.title}</h3>
                  <div className="border-t border-border/50">
                    {section.items.map((item) => (
                      <ServiceRow
                        key={`${item.group}:${item.id}`}
                        item={item}
                        selected={selected}
                        approvedSelected={approvedSelected}
                        prerequisite={prerequisites[item.id]}
                        unitKey={activeUnit}
                        disabled={disabled}
                        onToggle={onToggleService}
                        casEligible={CAS_ELIGIBLE_GROUPS.has(item.group)}
                        casActive={casServiceKeys.includes(item.id)}
                        onToggleCas={onToggleCas}
                        filter={filter}
                        showDescription={false}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {filter === "all" && <UnitResourcesPanel unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} approvedLinks={approvedResourceLinks} onToggle={onToggleResource} />}

          {showStepFooter && (
            <div className="services-unit__footer">
              <span className="services-unit__footer-step">Zona {stepIndex + 1} din {stepCount}</span>
              <span aria-hidden="true" className="services-unit__footer-dots">
                {Array.from({ length: stepCount }).map((_, index) => (
                  <i key={index} data-active={index === stepIndex ? "true" : "false"} data-done={index < stepIndex ? "true" : "false"} />
                ))}
              </span>
              <span className="services-unit__toolbar-spacer" />
              {stepIndex > 0 && (
                <button type="button" onClick={() => onGoToUnit?.(stepIndex - 1)} className="services-unit__footer-back">
                  <ArrowLeft aria-hidden="true" /> Înapoi
                </button>
              )}
              {nextUnitTitle ? (
                <button type="button" onClick={() => onGoToUnit?.(stepIndex + 1)} className="services-unit__footer-next">
                  Continuă: {nextUnitTitle} <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={() => onChooseView?.("selected")} className="services-unit__footer-next">
                  Vezi oferta selectată <ArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
