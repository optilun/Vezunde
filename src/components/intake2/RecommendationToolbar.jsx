import React from "react";
import { X } from "lucide-react";
import RecommendationZoneMenu from "./RecommendationZoneMenu";
import RecommendationFilterMenu from "./RecommendationFilterMenu";

// Bara de deasupra listei de recomandari (2026-09-30): filele (locatii / specialisti), zona
// cautarii si filtrele, pe un singur rand care se rupe doar cand nu incape. Pe ecranul cu harta
// ramane lipita sus in lista, ca zona si filtrele sa fie la indemana si la derulare. Sub ea,
// filtrele active apar ca etichete care se scot dintr-un click, cu numarul de optiuni ramase.
//
// Bara nu decide nimic: primeste elementele gata facute si le asaza.
export default function RecommendationToolbar({ sticky = false, modeTabs, zone, filters = null, activeChips = [], summary = "", onClearAll = null }) {
  return (
    <div className={sticky ? "sticky top-0 z-20 -mx-1 mb-3 border-b border-border/70 bg-background/95 px-1 pb-2 pt-1 backdrop-blur-sm" : "mb-4"}>
      <div className="flex flex-wrap items-center gap-2">
        {modeTabs}
        <RecommendationZoneMenu {...zone} />
        {filters && <RecommendationFilterMenu {...filters} />}
      </div>
      {activeChips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" role="group" aria-label="Filtre active">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.remove}
              aria-label={`Elimină filtrul ${chip.label}`}
              className="relative inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d7dce4] bg-[#eff1f5] px-3 text-xs font-medium text-[#4f6080] before:absolute before:-inset-1 before:rounded-full before:content-[''] hover:bg-[#e2e7f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]"
            >
              {chip.label}
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ))}
          {summary && <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{summary}</span>}
          {onClearAll && <button type="button" onClick={onClearAll} className="inline-flex min-h-9 items-center px-1 text-xs underline">Șterge filtrele</button>}
        </div>
      )}
    </div>
  );
}
