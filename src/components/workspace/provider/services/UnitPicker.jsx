// Faza 2: pasul 1 - zonele existente in locatie.
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import SelectionCard from "./SelectionCard";
import { UNIT_FALLBACK_ICON, UNIT_ICONS } from "./servicesUiTokens";

export default function UnitPicker({ units, approvedUnits, activeUnits, selectedByUnit, primaryUnits, disabled, onToggle, dataAttrs = {} }) {
  const [showOptional, setShowOptional] = useState(false);
  const hiddenUnits = units.filter((unitKey) => !primaryUnits.includes(unitKey) && !activeUnits.includes(unitKey) && !approvedUnits.includes(unitKey));
  const visibleUnits = showOptional
    ? units
    : units.filter((unitKey) => primaryUnits.includes(unitKey) || activeUnits.includes(unitKey) || approvedUnits.includes(unitKey));

  return (
    <section {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold">1. Zonele existente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selectează tipurile de zone existente în locație. Nu este necesar să introduci separat fiecare cameră.</p>
      </div>
      <div className="services-card-grid mt-4 space-y-2">
        {visibleUnits.map((unitKey) => {
          const definition = getFunctionalUnitDefinition(unitKey);
          const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
          const active = activeUnits.includes(unitKey);
          const count = selectedByUnit[unitKey] || 0;
          return (
            <SelectionCard
              key={unitKey}
              active={active}
              approved={approvedUnits.includes(unitKey)}
              title={definition?.title || unitKey}
              description={definition?.description || ""}
              helper={count > 0 ? `${count} opțiuni asociate` : primaryUnits.includes(unitKey) ? "Recomandat pentru acest profil" : "Opțional"}
              icon={Icon}
              disabled={disabled}
              onClick={() => onToggle(unitKey)}
            />
          );
        })}
      </div>
      {hiddenUnits.length > 0 && (
        <button type="button" onClick={() => setShowOptional((value) => !value)} className="services-more-toggle mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Ascunde zonele opționale" : `Arată alte zone disponibile (${hiddenUnits.length})`}
        </button>
      )}
    </section>
  );
}