import React from "react";
import { List, Map as MapIcon } from "lucide-react";
import ResultsMap from "./ResultsMap";
import { mapPointFromResult } from "../../../shared/resultsMapPoints.js";

export default function LocationsWithMap({
  results,
  listResults = results,
  onViewportChange,
  storageKey,
  children,
  renderCard,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  mobileView,
  onToggleMobileView,
}) {
  const hasPositions = (results || []).some((location) => mapPointFromResult(location) !== null);

  return (
    <>
      {hasPositions && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
          <button
            type="button"
            onClick={onToggleMobileView}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-lg transition-colors hover:border-foreground/40"
          >
            {mobileView === "map" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
            {mobileView === "map" ? "Vezi lista" : "Vezi pe hartă"}
          </button>
        </div>
      )}

      <div className={hasPositions ? "mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start" : "mt-4"}>
        <div className={mobileView === "map" && hasPositions ? "hidden lg:block" : ""}>
          <div className={hasPositions ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
            {(listResults || []).map((location) => (
              <div
                key={location.id}
                onMouseEnter={() => onHover(location.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(location.id)}
                onBlur={() => onHover(null)}
                className={`rounded-2xl transition-shadow ${
                  selectedId === location.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                } ${hoveredId === location.id && selectedId !== location.id ? "shadow-[0_4px_16px_rgba(23,23,23,0.10)]" : ""}`}
              >
                {renderCard(location)}
                {mapPointFromResult(location) && <button type="button" onClick={() => { onSelect(location.id); if (mobileView !== "map") onToggleMobileView(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-secondary"><MapIcon className="h-4 w-4" /> Vezi pe hartă</button>}
              </div>
            ))}
          </div>
          {children}
        </div>

        {hasPositions && (
          <aside className={`lg:sticky lg:top-24 ${mobileView === "map" ? "block" : "hidden lg:block"}`}>
            <ResultsMap
              results={results || []}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              onViewportChange={onViewportChange}
              storageKey={storageKey}
              className="h-[70vh] overflow-hidden rounded-3xl border border-border lg:h-[calc(100vh-9rem)]"
            />
          </aside>
        )}
      </div>
    </>
  );
}
