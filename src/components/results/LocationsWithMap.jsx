import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { List, Map as MapIcon } from "lucide-react";
import ResultsMap from "./ResultsMap";
import { mapPointFromResult } from "../../../shared/resultsMapPoints.js";

export default function LocationsWithMap({
  results,
  listResults = results,
  onViewportChange,
  storageKey,
  focusArea,
  fixedDesktop = false,
  listHeader,
  mapActions,
  integratedMapAction = false,
  children,
  renderCard,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  mobileView,
  onToggleMobileView,
}) {
  useEffect(() => {
    if (!fixedDesktop) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const root = document.documentElement;
    const body = document.body;
    const rootOverflow = root.style.overflow;
    const bodyOverflow = body.style.overflow;
    const apply = () => {
      root.style.overflow = media.matches ? "hidden" : rootOverflow;
      body.style.overflow = media.matches ? "hidden" : bodyOverflow;
      if (media.matches) window.scrollTo({ top: 0, behavior: "instant" });
    };
    apply();
    media.addEventListener("change", apply);
    return () => { media.removeEventListener("change", apply); root.style.overflow = rootOverflow; body.style.overflow = bodyOverflow; };
  }, [fixedDesktop]);
  const cardRefs = useRef(new Map());
  const previousSelection = useRef(selectedId);
  useEffect(() => {
    if (previousSelection.current === selectedId) return;
    previousSelection.current = selectedId;
    if (selectedId && (window.matchMedia("(min-width: 1024px)").matches || mobileView === "list")) {
      cardRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedId, mobileView]);
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

      <div style={fixedDesktop ? { top: "calc(var(--search-nav-height, 80px) + var(--search-controls-height, 0px) + 12px)" } : undefined} className={hasPositions ? (fixedDesktop ? "mt-3 grid gap-5 lg:fixed lg:inset-x-0 lg:bottom-3 lg:mx-auto lg:mt-0 lg:max-w-[1800px] lg:grid-cols-2 lg:overflow-hidden lg:px-8" : "mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start") : "mt-4"}>
        <div className={`min-w-0 ${mobileView === "map" && hasPositions ? "hidden lg:block" : ""} ${fixedDesktop ? "lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-8" : ""}`}>
          {listHeader}
          <div className={hasPositions ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
            {(listResults || []).map((location) => (
              <div
                key={location.id}
                ref={(element) => { if (element) cardRefs.current.set(location.id, element); else cardRefs.current.delete(location.id); }}
                onMouseEnter={() => onHover(location.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(location.id)}
                onBlur={() => onHover(null)}
                className={`h-full rounded-[22px] transition-shadow ${
                  selectedId === location.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                } ${hoveredId === location.id && selectedId !== location.id ? "shadow-[0_4px_16px_rgba(23,23,23,0.10)]" : ""}`}
              >
                {renderCard(location, mapPointFromResult(location) ? () => { onSelect(location.id); if (mobileView !== "map") onToggleMobileView(); } : undefined)}
                {!integratedMapAction && mapPointFromResult(location) && <button type="button" onClick={() => { onSelect(location.id); if (mobileView !== "map") onToggleMobileView(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-secondary"><MapIcon className="h-4 w-4" /> Vezi pe hartă</button>}
              </div>
            ))}
          </div>
          {children}
          {fixedDesktop && <nav aria-label="Informații VIASEE" className="mt-8 hidden flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground lg:flex"><Link to="/confidentialitate" className="min-h-8 underline">Confidențialitate</Link><Link to="/termeni" className="min-h-8 underline">Termeni</Link><Link to="/ajutor-si-suport" className="min-h-8 underline">Ajutor</Link></nav>}
        </div>

        {hasPositions && (
          <aside className={`relative isolate min-w-0 ${fixedDesktop ? "lg:h-full lg:overflow-hidden" : "lg:sticky"} ${mobileView === "map" ? "block" : "hidden lg:block"}`} style={fixedDesktop ? undefined : { top: "calc(var(--search-nav-height, 80px) + var(--search-controls-height, 0px) + 16px)" }}>
            <ResultsMap
              results={results || []}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              onViewportChange={onViewportChange}
              storageKey={storageKey}
              focusArea={focusArea}
              className={fixedDesktop ? "h-[70vh] overflow-hidden rounded-3xl border border-border lg:h-full" : "h-[70vh] overflow-hidden rounded-3xl border border-border lg:h-[max(16rem,calc(100dvh-var(--search-nav-height,80px)-var(--search-controls-height,0px)-32px))]"}
            />
            {mapActions && <div className="absolute right-3 top-3 z-[500] max-w-[calc(100%-4.5rem)]">{mapActions}</div>}
          </aside>
        )}
      </div>
    </>
  );
}