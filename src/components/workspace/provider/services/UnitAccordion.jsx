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
import React, { useEffect, useState } from "react";
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

export default function UnitAccordion({ unitKey, sections, selected, approvedSelected, reviewState = {}, serviceUnitMap, prerequisites, config, resourceLinks, approvedResourceLinks, customSuggestions, capabilities = [], approvedCapabilities = [], onToggleCapability, open, disabled, casServiceKeys = [], onToggleCas, onOpen, onToggleService, onSetSelection, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion, filter = "all", dataAttrs = {}, stepIndex = 0, stepMode = false, active = true, onGoToUnit, onChooseView, unitTitles = [] }) {
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
    // Filtrul "changes" (2026-08-23): tot ce difera fata de starea aprobata. Testul e pe
    // DIFERENTA, nu pe selectie, pentru ca eliminarile propuse nu sunt bifate - un test
    // pe "active" le-ar sari exact pe cele care conteaza cel mai mult la verificare.
    if (filter === "changes") return active !== isSelected(approvedSelected, item);
    return active && prerequisites[item.id]?.eligible === false;
  };
  const visibleSections = filter === "all"
    ? sections
    : sections.filter((section) => section.items.some(rowVisible));
  const allItems = sections.flatMap((section) => section.items);
  const missingItems = allItems.filter((item) => !isSelected(selected, item));

  // UN SINGUR GRUP PE ECRAN (2026-08-23, corectat dupa Alex: "cardurile sa fie cate unu
  // si cu next"). Prima incercare arata toate grupurile deodata si muta butonul de
  // avansare la nivel de zona - gresit de doua ori: cardurile ieseau inguste si
  // inegale, iar "urmatorul" sarea in alt modul in loc sa treaca la grupul urmator.
  // Acum: cardul e lat, ocupa tot randul, iar avansarea merge din grup in grup. Abia la
  // ultimul grup al zonei butonul preia zona urmatoare.
  const [groupIndex, setGroupIndex] = useState(0);
  useEffect(() => { setGroupIndex(0); }, [unitKey, filter]);
  const groupCount = visibleSections.length;
  const safeGroupIndex = groupCount > 0 ? Math.min(groupIndex, groupCount - 1) : 0;
  const activeSection = visibleSections[safeGroupIndex] || null;
  const nextSection = visibleSections[safeGroupIndex + 1] || null;

  const nextUnitKey = unitTitles[stepIndex + 1] || "";
  const nextUnitTitle = nextUnitKey ? (getFunctionalUnitDefinition(nextUnitKey)?.shortTitle || getFunctionalUnitDefinition(nextUnitKey)?.title || "") : "";
  // Subsolul apare ori de cate ori exista grupuri de parcurs. Trecerea la zona
  // urmatoare ramane doar in stepMode (esti intr-o zona, nu in lista completa).
  const showStepFooter = filter === "all" && groupCount > 0;
  // Zona singura pe ecran (2026-08-23): antetul de acordeon repeta cuvant cu cuvant
  // titlul paginii ("Cabinet de optica"), iar contorul lui - "6 selectate din 11" -
  // repeta si bara de dedesubt, si coloana din stanga. Acelasi numar de trei ori, pe
  // trei randuri. Cand esti in zona, antetul dispare si zona ramane deschisa;
  // pliatul nu are sens acolo unde tocmai ai navigat inauntru.
  const solo = stepMode && active;
  const expanded = open || solo;
  const goBack = () => {
    if (safeGroupIndex > 0) { setGroupIndex(safeGroupIndex - 1); return; }
    if (stepMode && stepIndex > 0) onGoToUnit?.(stepIndex - 1);
  };
  const goNext = () => {
    if (nextSection) { setGroupIndex(safeGroupIndex + 1); return; }
    if (stepMode && nextUnitTitle) { onGoToUnit?.(stepIndex + 1); return; }
    onChooseView?.("selected");
  };
  const nextLabel = nextSection
    ? `Continuă: ${nextSection.title}`
    : stepMode && nextUnitTitle
      ? `Continuă: ${nextUnitTitle}`
      : "Vezi oferta selectată";
  const canGoBack = safeGroupIndex > 0 || (stepMode && stepIndex > 0);
  return (
    <section {...dataAttrs} data-services-step={showStepFooter ? "true" : "false"} className={`services-unit overflow-hidden rounded-[22px] border bg-card transition ${expanded ? "border-foreground/20 shadow-sm" : "border-border"}`}>
      {!solo && (
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 sm:px-5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${UNIT_TONE[unitKey] ? "" : open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}
          style={UNIT_TONE[unitKey] ? { background: UNIT_TONE[unitKey].bg, borderColor: UNIT_TONE[unitKey].border, color: UNIT_TONE[unitKey].text } : undefined}
        ><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="services-unit__title block text-sm font-semibold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      )}
      {expanded && (
        <div className={solo ? "" : "border-t border-border/70"}>
          {zoneCapabilityKeys.length > 0 && (
            <div className="space-y-2 border-b border-border/60 bg-secondary/10 p-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Activități pentru această zonă</p>
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
            <>
              {/* Sirul grupurilor zonei: vezi tot ce urmeaza si sari direct unde vrei,
                  fara sa pierzi din ochi cate ai bifat in fiecare. */}
              {groupCount > 1 && (
                <div className="services-unit__groups" role="tablist" aria-label="Grupurile zonei">
                  {visibleSections.map((section, index) => (
                    <button
                      key={section.key}
                      type="button"
                      role="tab"
                      aria-selected={index === safeGroupIndex}
                      onClick={() => setGroupIndex(index)}
                      className="services-unit__group-chip"
                    >
                      <span>{section.title}</span>
                      <em>{selectedCountForSection(selected, section)}/{section.items.length}</em>
                    </button>
                  ))}
                </div>
              )}

              {activeSection && (() => {
                const section = activeSection;
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
                  <div className="services-group-stage">
                    <GroupCard
                      key={section.key}
                      section={section}
                      unitKey={unitKey}
                      activeUnit={activeUnit}
                      selected={selected}
                      approvedSelected={approvedSelected}
                      reviewState={reviewState}
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
                      wide
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            // Cu un filtru activ (selectate / observatii) randam plat: se vede tot ce
            // trece filtrul, fara carduri si fara actiuni in masa.
            visibleSections.map((section) => {
              const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
              return (
                <div key={section.key} className="pt-3 first:pt-1">
                  <h3 className="px-4 pb-1 text-[13px] font-semibold tracking-tight sm:px-5">{section.title}</h3>
                  <div className="border-t border-border/50">
                    {section.items.map((item) => (
                      <ServiceRow
                        key={`${item.group}:${item.id}`}
                        item={item}
                        selected={selected}
                        approvedSelected={approvedSelected}
                        reviewState={reviewState}
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

          {showStepFooter && (
            <div className="services-unit__footer">
              <span className="services-unit__footer-step">Grup {safeGroupIndex + 1} din {groupCount}</span>
              <span aria-hidden="true" className="services-unit__footer-dots">
                {visibleSections.map((section, index) => (
                  <i key={section.key} data-active={index === safeGroupIndex ? "true" : "false"} data-done={index < safeGroupIndex ? "true" : "false"} />
                ))}
              </span>
              <span className="services-unit__toolbar-spacer" />
              {canGoBack && (
                <button type="button" onClick={goBack} className="services-unit__footer-back">
                  <ArrowLeft aria-hidden="true" /> Înapoi
                </button>
              )}
              <button type="button" onClick={goNext} className="services-unit__footer-next">
                <span>{nextLabel}</span> <ArrowRight aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Resursele stau DUPA subsolul de pas (2026-08-23): sunt o anexa a zonei, nu
              un pas de parcurs. Intre card si subsol aratau ca al doilea card. */}
          {filter === "all" && <UnitResourcesPanel unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} approvedLinks={approvedResourceLinks} onToggle={onToggleResource} />}
        </div>
      )}
    </section>
  );
}
