// Faza 2: rezultatele cautarii in catalogul de servicii.
import React from "react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import ServiceRow from "./ServiceRow";
import { resolveSectionUnit } from "./servicesConfigModel";

export default function ServicesSearchResults({ query, results, selected, approvedSelected, serviceUnitMap, activeUnits, prerequisites, disabled, onToggleService, dataAttrs = {}, filter = "all" }) {
  return (
    <section {...dataAttrs} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold">Rezultate pentru „{query}”</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">Căutarea recunoaște și formulări uzuale folosite de pacienții din România.</p>
      </div>
      {results.length > 0 ? results.map(({ section, item }) => {
        const isLocationWide = section.key === "business_attributes";
        const unitKey = isLocationWide ? "" : resolveSectionUnit(section, selected, serviceUnitMap, activeUnits);
        return (
          <div key={`${section.key}:${item.id}`}>
            <div className="border-b border-border/60 bg-secondary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{isLocationWide ? "Valabil la nivelul locației" : getFunctionalUnitDefinition(unitKey)?.shortTitle || "Zonă neconfigurată"} · {section.title}</div>
            <ServiceRow item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey={unitKey} disabled={disabled} onToggle={onToggleService} filter={filter} />
          </div>
        );
      }) : <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nu am găsit opțiuni pentru această căutare.</div>}
    </section>
  );
}