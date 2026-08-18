// Faza 2: zona (unit) cu grupurile ei de servicii, extrasa 1:1.
import React, { useState } from "react";
import { ChevronDown, ChevronLeft, Info } from "lucide-react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import ServiceRow from "./ServiceRow";
import SectionListRow from "./SectionListRow";
import CustomSuggestion from "./CustomSuggestion";
import UnitResourcesPanel from "./UnitResourcesPanel";
import CapabilityToggle from "./CapabilityToggle";
import CategorySymbol from "./CategorySymbol";
import { isSelected, possibleUnits, resolveSectionUnit, selectedCountForSection } from "./servicesConfigModel";
import { CAS_ELIGIBLE_GROUPS, GROUP_TONE, UNIT_FALLBACK_ICON, UNIT_ICONS, UNIT_TONE } from "./servicesUiTokens";

// Capabilitati grupate la nivel de zona (2026-08-18): cand o capabilitate deschide mai
// multe sectiuni in ACEEASI zona (ophthalmology_specialties -> 7 sectiuni) sau cand o
// zona intreaga e dedicata unei activitati (B2B), comutatorul sta o singura data, in
// capul zonei - nu repetat la fiecare sectiune. Restul capabilitatilor sunt inline,
// direct deasupra sectiunii unice pe care o deschid.
const ZONE_LEVEL_CAPABILITY_KEYS = {
  ophthalmology_office: ["ophthalmology_specialties"],
  b2b_distribution_center: ["b2b_distribution", "b2b_logistics", "b2b_technical_support"],
};

export default function UnitAccordion({ unitKey, sections, selected, approvedSelected, serviceUnitMap, prerequisites, config, resourceLinks, approvedResourceLinks, customSuggestions, capabilities = [], approvedCapabilities = [], onToggleCapability, open, disabled, casServiceKeys = [], onToggleCas, onOpen, onToggleService, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion, filter = "all", dataAttrs = {} }) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
  const selectedCount = sections.reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  // Capabilitatile atasate acestei zone (2026-08-18): fostul modul separat "Dotari si
  // activitati" - fiecare comutator se muta acum langa ce controleaza (vezi mai jos).
  const zoneCapabilityKeys = ZONE_LEVEL_CAPABILITY_KEYS[unitKey] || [];
  const findCapabilityRow = (capabilityKey) => capabilities.find((item) => item.capability_key === capabilityKey);
  const isCapabilityApproved = (capabilityKey) => approvedCapabilities.some((item) => item.capability_key === capabilityKey);
  const toggleZoneCapability = (capabilityKey) => onToggleCapability?.(capabilityKey, [unitKey]);
  const inlineCapabilityRendered = new Set();
  // Drill-down (2026-08-18): in loc de toate grupurile deschise simultan intr-o lista
  // foarte lunga, zona arata randurile grupurilor; apesi unul si intri doar in el.
  // Cu un filtru activ (selectate / observatii) randam plat, ca sa se vada tot ce trece
  // filtrul fara sa fie nevoie sa intri in fiecare grup.
  const [activeSectionKey, setActiveSectionKey] = useState("");
  // Aceeasi regula de vizibilitate ca in ServiceRow. Cand un filtru e activ, grupurile
  // fara niciun rand vizibil nu se mai randeaza - inainte rămâneau antetele goale.
  const rowVisible = (item) => {
    if (filter === "all") return true;
    const active = isSelected(selected, item);
    if (filter === "selected") return active;
    return active && prerequisites[item.id]?.eligible === false;
  };
  const allVisibleSections = filter === "all"
    ? sections
    : sections.filter((section) => section.items.some(rowVisible));
  const activeSection = filter === "all"
    ? allVisibleSections.find((section) => section.key === activeSectionKey) || null
    : null;
  // Lista de grupuri se arata doar cand nu esti intr-un grup si nu e activ niciun filtru.
  const inGroupList = filter === "all" && !activeSection;
  const visibleSections = activeSection ? [activeSection] : allVisibleSections;
  return (
    <section {...dataAttrs} className={`overflow-hidden rounded-[22px] border bg-card transition ${open ? "border-foreground/20 shadow-sm" : "border-border"}`}>
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
          {inGroupList && (
            <div className="divide-y divide-border/50">
              {visibleSections.map((section) => (
                <SectionListRow
                  key={section.key}
                  section={section}
                  selectedCount={selectedCountForSection(selected, section)}
                  onOpen={() => setActiveSectionKey(section.key)}
                />
              ))}
            </div>
          )}
          {(inGroupList ? [] : visibleSections).map((section) => {
            const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
            const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
            const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
            // Comutator inline (2026-08-18): sectiunile cu o capabilitate proprie, care NU
            // e deja tratata la nivel de zona mai sus, primesc un comutator chiar aici -
            // fostul card din "Dotari si activitati", mutat langa ce controleaza efectiv.
            // Deduplicat: doua sectiuni cu aceeasi capabilitate (ex. cele doua sectiuni de
            // lentile de contact profesionale) arata comutatorul o singura data.
            const sectionCapabilityKey = section.capabilityKey && !zoneCapabilityKeys.includes(section.capabilityKey) && !inlineCapabilityRendered.has(section.capabilityKey)
              ? section.capabilityKey
              : null;
            if (sectionCapabilityKey) inlineCapabilityRendered.add(sectionCapabilityKey);
            return (
              <div key={section.key} className="pt-4 first:pt-2">
                {activeSection && (
                  <button type="button" onClick={() => setActiveSectionKey("")} className="mb-1 flex items-center gap-1.5 px-4 py-1 text-[12px] font-bold text-muted-foreground hover:text-foreground sm:px-5">
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Toate grupurile
                  </button>
                )}
                {sectionCapabilityKey && (
                  <div className="px-4 pb-3 sm:px-5">
                    <CapabilityToggle
                      capabilityKey={sectionCapabilityKey}
                      activeRow={findCapabilityRow(sectionCapabilityKey)}
                      approved={isCapabilityApproved(sectionCapabilityKey)}
                      disabled={disabled}
                      onToggle={() => toggleZoneCapability(sectionCapabilityKey)}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Simbolul VIASEE, colorat pe categorie (2026-08-18, la cererea lui
                        Alex) - aceeasi forma ca logo-ul de pe homepage (ViaseeBrand.jsx),
                        dar cu fill solid in loc de gradient negru, cate o culoare pe
                        categorie. Inlocuieste bulina simpla folosita pana acum. */}
                    {GROUP_TONE[section.group] && (
                      <CategorySymbol color={GROUP_TONE[section.group].border} className="h-5 w-5 shrink-0" />
                    )}
                    <h3 className="min-w-0 truncate text-[15px] font-bold tracking-tight">{section.title}</h3>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{selectedCountForSection(selected, section)} din {section.items.length}</span>
                  </div>
                  {availableParents.length > 1 && (
                    <label className="text-[10px] font-semibold text-muted-foreground">Se realizează în
                      <select disabled={disabled} value={activeUnit} onChange={(event) => onChangeSectionUnit(section, event.target.value)} className="ml-2 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground">
                        {availableParents.map((key) => <option key={key} value={key}>{getFunctionalUnitDefinition(key)?.shortTitle || key}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {section.description && <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">{section.description}</p>}
                {section.note && <div className="services-note mx-4 mb-3 flex gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:mx-5"><Info className="mt-0.5 h-4 w-4 shrink-0" /> {section.note}</div>}
                <div className="border-t border-border/50">
                  {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey={activeUnit} disabled={disabled} onToggle={onToggleService} casEligible={CAS_ELIGIBLE_GROUPS.has(item.group)} casActive={casServiceKeys.includes(item.id)} onToggleCas={onToggleCas} filter={filter} />)}
                </div>
                {filter === "all" && <CustomSuggestion unitKey={unitKey} section={section} disabled={disabled} items={suggestions} onAdd={onAddSuggestion} onRemove={onRemoveSuggestion} />}
              </div>
            );
          })}
          {filter === "all" && inGroupList && <UnitResourcesPanel unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} approvedLinks={approvedResourceLinks} onToggle={onToggleResource} />}
        </div>
      )}
    </section>
  );
}