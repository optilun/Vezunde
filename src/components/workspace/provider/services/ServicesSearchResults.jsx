// Faza 2: rezultatele cautarii in catalogul de servicii.
import React from "react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import ServiceRow from "./ServiceRow";
import { resolveSectionUnit } from "./servicesConfigModel";

// Figura pentru cautarea fara raspuns: o lupa peste o lentila, in cerneala si crem,
// aceleasi doua culori ca restul modulului. Desenata aici, fara imagini externe.
function NoResultsFigure() {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Nicio potrivire" className="h-20 w-20" fill="none">
      <circle cx="54" cy="54" r="30" fill="#f5f1e9" stroke="rgb(23 23 23 / 0.18)" strokeWidth="1.5" />
      <circle cx="54" cy="54" r="15" fill="#ffffff" stroke="rgb(23 23 23 / 0.14)" strokeWidth="1.5" />
      <path d="M76 76 96 96" stroke="#171717" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="54" cy="54" r="42" stroke="rgb(23 23 23 / 0.12)" strokeWidth="1.2" strokeDasharray="3 8" />
    </svg>
  );
}

export default function ServicesSearchResults({ query, results, selected, approvedSelected, serviceUnitMap, activeUnits, prerequisites, disabled, onToggleService, onClearQuery, dataAttrs = {}, filter = "all" }) {
  return (
    // Antetul propriu a fost scos (2026-08-23): titlul „Rezultate pentru ..." era scris
    // si aici, si in antetul modulului, unul sub altul.
    <section {...dataAttrs} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {results.length > 0 ? results.map(({ section, item }) => {
        const isLocationWide = section.key === "business_attributes";
        const unitKey = isLocationWide ? "" : resolveSectionUnit(section, selected, serviceUnitMap, activeUnits);
        return (
          <div key={`${section.key}:${item.id}`}>
            <div className="border-b border-border/60 bg-secondary/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{isLocationWide ? "Valabil la nivelul locației" : getFunctionalUnitDefinition(unitKey)?.shortTitle || "Zonă neconfigurată"} · {section.title}</div>
            <ServiceRow item={item} selected={selected} approvedSelected={approvedSelected} prerequisite={prerequisites[item.id]} unitKey={unitKey} disabled={disabled} onToggle={onToggleService} filter={filter} />
          </div>
        );
      }) : (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <NoResultsFigure />
          <p className="mt-4 font-heading text-[15px] font-semibold tracking-[-0.02em] text-foreground">Nicio potrivire pentru „{query}”</p>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Caută după ce face serviciul, nu după denumirea din catalog: „control”, „lentile”, „reparație”, „copii”.
          </p>
          {onClearQuery && (
            <button
              type="button"
              onClick={onClearQuery}
              className="mt-5 inline-flex min-h-10 items-center rounded-full border border-foreground/20 bg-background px-4 text-[12.5px] font-semibold text-foreground transition-colors hover:border-foreground/45"
            >
              Șterge căutarea
            </button>
          )}
        </div>
      )}
    </section>
  );
}