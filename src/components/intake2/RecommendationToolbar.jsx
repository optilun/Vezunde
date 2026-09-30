import React from "react";
import { X } from "lucide-react";
import RecommendationZoneMenu from "./RecommendationZoneMenu";
import RecommendationFilterMenu from "./RecommendationFilterMenu";

// Bara de deasupra listei de recomandari (2026-09-30): filele (locatii / specialisti), apoi zona
// cautarii si filtrele.
//
// Verificata pe viasee.ro, prima varianta (totul intr-o singura bara lipicioasa) avea 203 px cu
// doua filtre active, la latimea unui laptop obisnuit (lista de ~510 px): eticheta filei se rupea
// pe doua randuri, „Filtre” ramanea singur pe rand, iar etichetele filtrelor treceau pe trei
// randuri. De aceea acum:
//  - filele stau pe randul lor si se deruleaza odata cu lista (comutarea de mod e rara);
//  - ramane lipit doar randul cu zona si filtrele: un singur rand, ~56 px;
//  - filtrele active stau pe un singur rand care se deruleaza pe orizontala (rezumatul „N din M”
//    si „Sterge filtrele” raman la vedere), deci bara lipita ajunge la ~100 px cu filtre active.
// Bara lipita se aplica de la latimea `sm`; pe telefon totul se deruleaza cu lista.
//
// Bara nu decide nimic: primeste elementele gata facute si le asaza.
export default function RecommendationToolbar({ sticky = false, modeTabs, zone, filters = null, activeChips = [], summary = "", onClearAll = null }) {
  const hasChips = activeChips.length > 0;
  return (
    <>
      <div className="mb-2 flex max-w-full">{modeTabs}</div>
      <div className={sticky ? "-mx-1 mb-3 px-1 pb-2 pt-1 sm:sticky sm:top-0 sm:z-20 sm:border-b sm:border-border/70 sm:bg-background/95 sm:backdrop-blur-sm" : "mb-4"}>
        <div className="flex items-center gap-2">
          <RecommendationZoneMenu {...zone} />
          {filters && <RecommendationFilterMenu {...filters} />}
        </div>
        {hasChips && (
          <div className="mt-2 flex items-center gap-2" role="group" aria-label="Filtre active">
            {summary && <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-muted-foreground">{summary}</span>}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  aria-label={`Elimină filtrul ${chip.label}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d7dce4] bg-[#eff1f5] px-3 text-xs font-medium text-[#4f6080] hover:bg-[#e2e7f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]"
                >
                  {chip.label}
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            {onClearAll && <button type="button" onClick={onClearAll} className="inline-flex min-h-9 shrink-0 items-center px-1 text-xs underline">Șterge filtrele</button>}
          </div>
        )}
      </div>
    </>
  );
}
