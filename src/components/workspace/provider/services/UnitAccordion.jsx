// Faza 2: zona (unit) cu grupurile ei de servicii, extrasa 1:1.
import React, { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import ServiceRow from "./ServiceRow";
import CustomSuggestion from "./CustomSuggestion";
import UnitResourcesPanel from "./UnitResourcesPanel";
import { possibleUnits, resolveSectionUnit, selectedCountForSection } from "./servicesConfigModel";
import { CAS_ELIGIBLE_GROUPS, GROUP_TONE, UNIT_FALLBACK_ICON, UNIT_ICONS, UNIT_TONE } from "./servicesUiTokens";

export default function UnitAccordion({ unitKey, sections, selected, approvedSelected, serviceUnitMap, prerequisites, config, resourceLinks, approvedResourceLinks, customSuggestions, open, disabled, casServiceKeys = [], onToggleCas, onOpen, onToggleService, onChangeSectionUnit, onToggleResource, onAddSuggestion, onRemoveSuggestion }) {
  const definition = getFunctionalUnitDefinition(unitKey);
  const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
  const selectedCount = sections.reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  // Pornesc DESCHISE doar sectiunile care au deja selectii: utilizatorul vede imediat
  // ce si-a configurat, iar filtrele din invelis scaneaza randurile din DOM.
  const [openSections, setOpenSections] = useState(() => new Set(
    sections.filter((section) => selectedCountForSection(selected, section) > 0).map((section) => section.key),
  ));
  const toggleSection = (sectionKey) => setOpenSections((current) => {
    const next = new Set(current);
    if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
    return next;
  });
  return (
    <section className={`overflow-hidden rounded-[22px] border bg-card transition ${open ? "border-foreground/20 shadow-sm" : "border-border"}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary/20 sm:px-5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${UNIT_TONE[unitKey] ? "" : open ? "border-foreground/15 bg-secondary/55" : "border-border bg-background text-muted-foreground"}`}
          style={UNIT_TONE[unitKey] ? { background: UNIT_TONE[unitKey].bg, borderColor: UNIT_TONE[unitKey].border, color: UNIT_TONE[unitKey].text } : undefined}
        ><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold sm:text-base">{definition?.title || unitKey}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selectedCount} selectate din {total}</span></span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {sections.map((section) => {
            const activeUnit = resolveSectionUnit(section, selected, serviceUnitMap, [unitKey]);
            const availableParents = possibleUnits(section).filter((key) => config.activeUnits.includes(key));
            const suggestions = customSuggestions.filter((item) => item.functional_unit_key === unitKey && item.group === section.items[0]?.group);
            return (
              <div key={section.key} className="pt-7 first:pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={openSections.has(section.key)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {/* Bulina de culoare, dupa identitatea de pe homepage. */}
                    {GROUP_TONE[section.group] && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: GROUP_TONE[section.group].bg, border: `1.5px solid ${GROUP_TONE[section.group].border}` }}
                      />
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${openSections.has(section.key) ? "rotate-180" : ""}`} />
                    <h3 className="min-w-0 truncate text-[15px] font-bold tracking-tight">{section.title}</h3>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{selectedCountForSection(selected, section)} din {section.items.length}</span>
                  </button>
                  {openSections.has(section.key) && availableParents.length > 1 && (
                    <label className="text-[10px] font-semibold text-muted-foreground">Se realizează în
                      <select disabled={disabled} value={activeUnit} onChange={(event) => onChangeSectionUnit(section, event.target.value)} className="ml-2 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground">
                        {availableParents.map((key) => <option key={key} value={key}>{getFunctionalUnitDefinition(key)?.shortTitle || key}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {openSections.has(section.key) && (
                  <>
                    {section.description && <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">{section.description}</p>}
                    {section.note && <div className="mx-4 mb-3 flex gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:mx-5"><Info className="mt-0.5 h-4 w-4 shrink-0" /> {section.note}</div>}
                    <div className="border-t border-border/50">
                      {section.items.map((item) => <ServiceRow key={`${item.group}:${item.id}`} item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey={activeUnit} disabled={disabled} onToggle={onToggleService} casEligible={CAS_ELIGIBLE_GROUPS.has(item.group)} casActive={casServiceKeys.includes(item.id)} onToggleCas={onToggleCas} />)}
                    </div>
                    <CustomSuggestion unitKey={unitKey} section={section} disabled={disabled} items={suggestions} onAdd={onAddSuggestion} onRemove={onRemoveSuggestion} />
                  </>
                )}
              </div>
            );
          })}
          <UnitResourcesPanel unitKey={unitKey} config={config} disabled={disabled} links={resourceLinks} approvedLinks={approvedResourceLinks} onToggle={onToggleResource} />
        </div>
      )}
    </section>
  );
}