// Faza 2: coloana de progres a configurarii, extrasa 1:1.
import React from "react";
import { Check, Eye } from "lucide-react";
import { CARE_SETTINGS, getCapabilityDefinition, getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import { selectedCountForSection } from "./servicesConfigModel";
import { UNIT_FALLBACK_ICON, UNIT_ICONS } from "./servicesUiTokens";

export default function ServicesSidebar({ activeUnits, capabilities, selectedCount, selectedByUnit, sections, selected, b2b, careSetting, allowedCareSettings, resourceLinks, unitOrder, dataAttrs = {} }) {
  const publicRows = sections
    .map((section) => ({ ...section, count: selectedCountForSection(selected, section) }))
    .filter((section) => section.count > 0 && section.publicLabel);
  const globalOptionCount = sections
    .filter((section) => section.key === "business_attributes")
    .reduce((sum, section) => sum + selectedCountForSection(selected, section), 0);
  const serviceCount = Math.max(0, selectedCount - globalOptionCount);
  const orderedActiveUnits = [
    ...unitOrder.filter((unitKey) => activeUnits.includes(unitKey)),
    ...activeUnits.filter((unitKey) => !unitOrder.includes(unitKey)),
  ];
  const resourceUnitKeys = new Set([
    ...(resourceLinks.professionals || []).flatMap((item) => item.unit_keys || []),
    ...(resourceLinks.equipment || []).map((item) => item.unit_key),
    ...(resourceLinks.facilities || []).map((item) => item.unit_key),
  ].filter(Boolean));
  const careSettingComplete = allowedCareSettings.includes(careSetting);
  const steps = [
    { number: 1, label: "Zonele locației", detail: activeUnits.length > 0 ? `${activeUnits.length} configurate` : "Opțional", done: activeUnits.length > 0, optional: true },
    { number: 2, label: "Activități speciale", detail: capabilities.length > 0 ? `${capabilities.length} selectate` : "Opțional", done: capabilities.length > 0, optional: true },
    { number: 3, label: "Mod de funcționare", detail: careSettingComplete ? CARE_SETTINGS[careSetting]?.label : "Opțional", done: careSettingComplete, optional: true },
    { number: 4, label: "Opțiuni generale", detail: globalOptionCount > 0 ? `${globalOptionCount} selectate` : "Opțional", done: globalOptionCount > 0, optional: true },
    { number: 5, label: "Produse și servicii", detail: serviceCount > 0 ? `${serviceCount} selectate` : "Nicio selecție", done: serviceCount > 0, optional: true },
  ];

  return (
    <aside {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Progres configurare</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Opțiuni</div>
          <div className="mt-1 text-xl font-semibold">{selectedCount}</div>
        </div>
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Spații</div>
          <div className="mt-1 text-xl font-semibold">{activeUnits.length}</div>
        </div>
        <div className="rounded-2xl bg-secondary/45 px-3 py-3">
          <div className="text-[10px] font-semibold text-muted-foreground">Activități</div>
          <div className="mt-1 text-xl font-semibold">{capabilities.length}</div>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-xs font-semibold">Ordinea recomandată</h3>
        <ol className="mt-3 space-y-2">
          {steps.map((step) => (
            <li key={step.number} className="flex items-center gap-3 rounded-2xl bg-secondary/30 px-3 py-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${step.done ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground"}`}>
                {step.done ? <Check className="h-3.5 w-3.5" /> : step.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{step.label}</span>
                <span className={`mt-0.5 block truncate text-[10px] ${!step.done && !step.optional ? "text-amber-700" : "text-muted-foreground"}`}>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold">Spații selectate</h3>
        {orderedActiveUnits.length > 0 ? (
          <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
            {orderedActiveUnits.map((unitKey) => {
              const definition = getFunctionalUnitDefinition(unitKey);
              const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
              return (
                <li key={unitKey} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary"><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{definition?.shortTitle || definition?.title || unitKey}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{selectedByUnit[unitKey] || 0} opțiuni asociate</span>
                  </span>
                  {resourceUnitKeys.has(unitKey) && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-semibold text-muted-foreground">Resurse</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/25 px-3 py-4 text-center text-xs text-muted-foreground">Nu ai selectat încă nicio zonă.</p>
        )}
      </div>

      {capabilities.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold">Activități active</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {capabilities.map((item) => (
              <span key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-full bg-secondary px-2.5 py-1.5 text-[10px] font-semibold">
                {getCapabilityDefinition(item.capability_key)?.shortTitle || getCapabilityDefinition(item.capability_key)?.title || item.capability_key}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold">{b2b ? "Ofertă profesională B2B" : "Previzualizare după aprobare"}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {b2b ? "Oferta este prezentată separat și nu intră în filtrele pentru pacienți." : "Pacienții vor vedea filtre simple după nevoie, după aprobarea modificărilor."}
        </p>
        {!b2b && (
          publicRows.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {publicRows.map((row) => (
                <span key={row.key} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 text-[11px] font-semibold">
                  {row.publicLabel}<span className="text-muted-foreground">{row.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/25 px-3 py-4 text-center text-xs text-muted-foreground">Nu ai selectat încă servicii publice.</p>
          )
        )}
      </div>
    </aside>
  );
}