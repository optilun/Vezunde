// Cardul unui grup de servicii (2026-08-23, varianta A aprobata de Alex).
//
// Inlocuieste drill-down-ul din 2026-08-18 (SectionListRow -> intri in grup -> te
// intorci). Acolo problema nu era lungimea listei, ci ca nu vedeai niciodata mai mult
// de un grup deodata si trebuia sa intri si sa iesi ca sa stii ce ai bifat. Aici toate
// grupurile zonei stau unul langa altul, in coloane, si fiecare card isi tine singur
// antetul, contorul si actiunile in masa.
//
// Ce s-a scos din text, tot atunci:
//   - descrierea de catalog e ascunsa implicit (comutatorul "Descrieri" de la zona);
//   - nota contextuala a grupului apare DOAR dupa ce ai bifat ceva in el - inainte
//     statea acolo permanent si se citea ca instructiune, desi nu te privea inca;
//   - numele zonei nu se mai repeta in card: e scris o data, in antetul zonei.
import React from "react";
import { getCapabilityDefinition, getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import { Info } from "lucide-react";
import ServiceRow from "./ServiceRow";
import CapabilityToggle from "./CapabilityToggle";
import CategorySymbol from "./CategorySymbol";
import CustomSuggestion from "./CustomSuggestion";
import { CAS_ELIGIBLE_GROUPS, GROUP_TONE } from "./servicesUiTokens";
import { isSelected, selectedCountForSection } from "./servicesConfigModel";

export default function GroupCard({
  section, unitKey, activeUnit, selected, approvedSelected, prerequisites, disabled,
  availableParents = [], capabilityKey = "", capabilityRow, capabilityApproved, onToggleCapability,
  casServiceKeys = [], onToggleCas, onToggleService, onSetSelection, onChangeSectionUnit,
  suggestions = [], onAddSuggestion, onRemoveSuggestion, showDescription = false, filter = "all", wide = false,
}) {
  const tone = GROUP_TONE[section.group];
  const total = section.items.length;
  const selectedCount = selectedCountForSection(selected, section);
  const missing = section.items.filter((item) => !isSelected(selected, item));
  const allSelected = missing.length === 0 && total > 0;
  // Cand capabilitatea poarta exact numele grupului, comutatorul nu il mai repeta -
  // altfel acelasi titlu apare de doua ori, unul sub altul (gasit in captura lui Alex
  // la "Adaptare si monitorizare lentile de contact").
  const capabilityTitle = capabilityKey ? getCapabilityDefinition(capabilityKey)?.title || "" : "";
  const capabilityLabel = capabilityTitle && capabilityTitle.trim() === String(section.title || "").trim()
    ? "Activează acest grup"
    : "";
  return (
    <article className={`services-group-card${wide ? " services-group-card--wide" : ""}`} data-services-group={section.key}>
      <header className="services-group-card__head">
        {tone && <CategorySymbol color={tone.border} className={wide ? "h-7 w-7" : "h-5 w-5"} />}
        <h3 className="services-group-card__title">{section.title}</h3>
        <span className="services-group-card__count" data-full={allSelected ? "true" : "false"}>{selectedCount}/{total}</span>
      </header>

      {/* Cat din grup e acoperit. O linie, nu un procent scris - se citeste mai repede. */}
      <span aria-hidden="true" className="services-group-card__bar">
        <i style={{ width: `${total > 0 ? Math.round((selectedCount / total) * 100) : 0}%` }} />
      </span>

      {capabilityKey && (
        <div className="services-group-card__capability">
          <CapabilityToggle
            capabilityKey={capabilityKey}
            activeRow={capabilityRow}
            approved={capabilityApproved}
            disabled={disabled}
            onToggle={() => onToggleCapability?.(capabilityKey, [unitKey])}
            compact
            label={capabilityLabel}
          />
        </div>
      )}

      {showDescription && section.description && (
        <p className="services-group-card__description">{section.description}</p>
      )}

      {/* Nota contextuala: numai cand grupul e efectiv folosit. */}
      {section.note && selectedCount > 0 && (
        <div className="services-note services-group-card__note"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{section.note}</span></div>
      )}

      <div className="services-group-card__rows">
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
            showDescription={showDescription}
            compact
          />
        ))}
      </div>

      <footer className="services-group-card__foot">
        {allSelected ? (
          <button type="button" disabled={disabled} onClick={() => onSetSelection?.(section.items, activeUnit, false)} className="services-group-card__bulk">Golește grupul</button>
        ) : (
          <button type="button" disabled={disabled} onClick={() => onSetSelection?.(missing, activeUnit, true)} className="services-group-card__bulk">Selectează toate ({missing.length})</button>
        )}
        {selectedCount > 0 && !allSelected && (
          <button type="button" disabled={disabled} onClick={() => onSetSelection?.(section.items, activeUnit, false)} className="services-group-card__bulk is-quiet">Golește</button>
        )}
        {availableParents.length > 1 && (
          <label className="services-group-card__parent">Se realizează în
            <select disabled={disabled} value={activeUnit} onChange={(event) => onChangeSectionUnit(section, event.target.value)}>
              {availableParents.map((key) => <option key={key} value={key}>{getFunctionalUnitDefinition(key)?.shortTitle || key}</option>)}
            </select>
          </label>
        )}
      </footer>

      <CustomSuggestion unitKey={unitKey} section={section} disabled={disabled} items={suggestions} onAdd={onAddSuggestion} onRemove={onRemoveSuggestion} />
    </article>
  );
}
