// Faza 2: pasul 2 - activitatile asociate zonelor.
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getCapabilityDefinition, getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import SelectionCard from "./SelectionCard";
import { CAPABILITY_FALLBACK_ICON, CAPABILITY_ICONS } from "./servicesUiTokens";

export default function CapabilityPicker({ capabilityKeys, approvedCapabilities, capabilities, activeUnits, primaryCapabilities, disabled, onToggle, dataAttrs = {} }) {
  const [showOptional, setShowOptional] = useState(false);
  if (capabilityKeys.length === 0) return null;
  const activeCapabilityKeys = new Set(capabilities.map((item) => item.capability_key));
  const approvedCapabilityKeys = new Set(approvedCapabilities.map((item) => item.capability_key));
  const hiddenCapabilities = capabilityKeys.filter((key) => !primaryCapabilities.includes(key) && !activeCapabilityKeys.has(key) && !approvedCapabilityKeys.has(key));
  const visibleCapabilities = showOptional
    ? capabilityKeys
    : capabilityKeys.filter((key) => primaryCapabilities.includes(key) || activeCapabilityKeys.has(key) || approvedCapabilityKeys.has(key));

  return (
    <section {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="services-card-grid space-y-2">
        {visibleCapabilities.map((capabilityKey) => {
          const definition = getCapabilityDefinition(capabilityKey);
          const activeRow = capabilities.find((item) => item.capability_key === capabilityKey);
          const parentOptions = (definition?.allowedParentUnits || []).filter((unitKey) => activeUnits.includes(unitKey));
          const Icon = CAPABILITY_ICONS[capabilityKey] || CAPABILITY_FALLBACK_ICON;
          return (
            <SelectionCard
              key={capabilityKey}
              active={Boolean(activeRow)}
              approved={approvedCapabilityKeys.has(capabilityKey)}
              title={definition?.title || capabilityKey}
              description={definition?.description || ""}
              helper={activeRow ? `Asociat: ${getFunctionalUnitDefinition(activeRow.parent_unit_key)?.shortTitle || activeRow.parent_unit_key}` : parentOptions.length === 0 ? "Selectează mai întâi o zonă compatibilă" : primaryCapabilities.includes(capabilityKey) ? "Recomandat pentru acest profil" : "Opțional"}
              icon={Icon}
              disabled={disabled || parentOptions.length === 0}
              onClick={() => onToggle(capabilityKey, parentOptions)}
            />
          );
        })}
      </div>
      {hiddenCapabilities.length > 0 && (
        <button type="button" onClick={() => setShowOptional((value) => !value)} className="services-more-toggle mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Ascunde activitățile opționale" : `Arată alte activități (${hiddenCapabilities.length})`}
        </button>
      )}
    </section>
  );
}