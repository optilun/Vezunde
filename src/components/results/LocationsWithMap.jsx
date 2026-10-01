import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { List, Map as MapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import useDesktopResults from "@/hooks/useDesktopResults";
import ResultsMap from "./ResultsMap";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import { mapPointFromResult } from "../../../shared/resultsMapPoints.js";
import { withDirectoryContext } from "../../../shared/searchMapArea.js";
import { requestMapCardFocus } from "@/lib/mapCardFocus";
import { resultCellClassName, resultGridClassName } from "./resultGridClasses";

const NO_ROWS = [];

export default function LocationsWithMap({
  results,
  listResults = results,
  onViewportChange,
  storageKey,
  focusArea,
  fixedDesktop = false,
  mobileFullscreen = false,
  listHeader,
  mapActions,
  mapStatus,
  integratedMapAction = false,
  children,
  renderCard,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  mobileView,
  onToggleMobileView,
  // 2026-09-27: "grid" = cartile directorului intr-o grila cu linii fine intre celule (fara
  // carduri rotunjite separate). "cards" ramane pentru celelalte rezultate.
  listLayout = "cards",
  // 2026-09-27: rezultatele unei cautari de servicii au o ordine a potrivirii. Cu `numbered`, fiecare
  // card si pinul lui de pe harta poarta acelasi numar (1, 2, 3...). Numerotarea doar afiseaza
  // ordinea primita de la server; nu o schimba.
  numbered = false,
  // 2026-09-28 (audit /cauta, B6): cu `fitKey`, harta se reincadreaza doar cand se schimba cheia, nu
  // si cand aceleasi criterii primesc date noi (harta Romaniei: fisierul static, apoi lista actuala).
  fitKey = null,
  // 2026-09-30: restul locatiilor din director, ca puncte de context pe harta (fara numar, fara loc in
  // lista). Harta nu ramane goala cand vizitatorul o muta in alta zona. `results` ramane setul
  // cautarii: el hotaraste daca exista harta si ce incadreaza camera.
  contextResults = null,
  // Cheia sub care se pastreaza camera hartii; implicit cheia listei. Pe /cauta camera tine de
  // localitate, nu de filtre: o schimbare de filtru nu mai muta harta.
  mapStorageKey = storageKey,
  // Un element asezat peste harta (ex. „Caută în această zonă”).
  mapOverlay = null,
  // 2026-10-01: pozitia vizitatorului ({ lat, lng, accuracy }), desenata pe harta cu cercul de precizie.
  userLocation = null,
}) {
  const gridLayout = listLayout === "grid";
  const desktop = useDesktopResults();
  const mapToggleRef = useRef(null);
  const searchRows = results || NO_ROWS;
  // Fara puncte de context, `mapRows` este chiar `searchRows` (aceeasi referinta) si camera se incadreaza
  // pe el, ca inainte. Cu context, camera se incadreaza doar pe rezultatele cautarii.
  const mapRows = useMemo(() => withDirectoryContext(searchRows, contextResults), [searchRows, contextResults]);
  const fitRows = mapRows === searchRows ? null : searchRows;
  // Cheia este ordinea id-urilor, nu tabloul: o lista reconstruita cu aceeasi ordine nu redeseneaza pinii.
  const rankSignature = numbered ? (listResults || []).map((location) => location.id).join("|") : "";
  const rankById = useMemo(
    () => (numbered ? new Map(rankSignature.split("|").filter(Boolean).map((id, index) => [id, index + 1])) : null),
    [numbered, rankSignature],
  );
  useEffect(() => {
    if (!fixedDesktop) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const root = document.documentElement;
    const rootOverflow = root.style.overflow;
    const apply = () => {
      root.style.overflow = media.matches ? "hidden" : rootOverflow;
      if (media.matches) window.scrollTo({ top: 0, behavior: "instant" });
    };
    apply();
    media.addEventListener("change", apply);
    return () => { media.removeEventListener("change", apply); root.style.overflow = rootOverflow; };
  }, [fixedDesktop]);
  const listRef = useRef(null);
  const lastListTop = useRef(0);
  const restoredListKey = useRef(null);
  const listSignature = (listResults || []).slice(0, 2).map(row => row.id).join("|");
  useEffect(() => {
    if (!fixedDesktop || !storageKey || !window.matchMedia("(min-width: 1024px)").matches) return;
    if (restoredListKey.current === storageKey) return;
    const saved = readSearchSession().listScroll?.[storageKey];
    if (saved && saved.signature !== listSignature) return;
    const frame = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = saved?.top || 0;
      restoredListKey.current = storageKey;
    });
    return () => cancelAnimationFrame(frame);
  }, [fixedDesktop, storageKey, listSignature]);
  const rememberListNow = () => {
    if (!fixedDesktop || !storageKey || !window.matchMedia("(min-width: 1024px)").matches) return;
    restoredListKey.current = storageKey;
    const previous = readSearchSession().listScroll || {};
    // A bounded, tab-local cache; no device coordinates or analytics.
    const entries = Object.entries(previous).filter(([key]) => key !== storageKey).slice(-7);
    writeSearchSession({ listScroll: { ...Object.fromEntries(entries), [storageKey]: { top: lastListTop.current, signature: listSignature } } });
  };
  // 2026-09-24. Pozitia listei se salveaza dupa ce derularea se opreste, nu la fiecare eveniment
  // (fiecare salvare rescrie toata sesiunea de cautare). La plecarea de pe pagina se salveaza imediat.
  // Ultima pozitie se tine la fiecare eveniment: la demontare lista nu mai exista.
  const rememberTimer = useRef(0);
  const rememberLatest = useRef(rememberListNow);
  rememberLatest.current = rememberListNow;
  const rememberList = () => {
    lastListTop.current = listRef.current?.scrollTop || 0;
    clearTimeout(rememberTimer.current);
    rememberTimer.current = setTimeout(() => { rememberTimer.current = 0; rememberLatest.current(); }, 200);
  };
  useEffect(() => () => {
    if (!rememberTimer.current) return;
    clearTimeout(rememberTimer.current);
    rememberTimer.current = 0;
    rememberLatest.current();
  }, []);
  const cardRefs = useRef(new Map());
  // 2026-09-28 (audit /cauta, B7): callback-uri stabile pentru randuri (ResultRow e memoizat). Un hover
  // redeseneaza doar cele doua randuri care isi schimba starea, nu toata lista (300+ carduri).
  const registerCard = useCallback((id, element) => {
    if (element) cardRefs.current.set(id, element); else cardRefs.current.delete(id);
  }, []);
  const latestShowOnMap = useRef(null);
  latestShowOnMap.current = { onSelect, onToggleMobileView, mobileView };
  const showOnMap = useCallback((id) => {
    const { onSelect: select, onToggleMobileView: toggle, mobileView: view } = latestShowOnMap.current;
    requestMapCardFocus();
    select(id);
    if (!window.matchMedia("(min-width: 1024px)").matches && view !== "map") toggle();
  }, []);
  const previousSelection = useRef({ id: selectedId, view: mobileView });
  useEffect(() => {
    if (previousSelection.current.id === selectedId && previousSelection.current.view === mobileView) return;
    previousSelection.current = { id: selectedId, view: mobileView };
    const card = cardRefs.current.get(selectedId);
    if (!card) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop && fixedDesktop && listRef.current) {
      // scrollIntoView can also move the document behind the fixed search header.
      const list = listRef.current;
      const parent = list.getBoundingClientRect();
      const item = card.getBoundingClientRect();
      if (item.top < parent.top) list.scrollTop += item.top - parent.top;
      else if (item.bottom > parent.bottom) list.scrollTop += Math.min(item.top - parent.top, item.bottom - parent.bottom);
    } else if (desktop || mobileView === "list") {
      card.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedId, mobileView, fixedDesktop]);
  const hasPositions = (results || []).some((location) => mapPointFromResult(location) !== null);
  // 2026-09-24. Pe telefon, dupa ce harta a fost aratata o data, trecerea pe lista nu o mai scoate din
  // pagina (display: none), ci o ascunde pastrandu-i marimea: iese din flux (absolute), devine
  // invizibila si nu primeste atingeri. La revenire nu mai trebuie redimensionata si redesenata de la
  // zero (750-2.900 ms in test). Atributia hartii (MapLibre o face vizibila explicit cand e extinsa)
  // se ascunde si ea. Pana la prima afisare harta ramane scoasa din pagina, ca cine incepe cu lista sa
  // nu descarce fundalul hartii degeaba. Pe desktop (lg) nimic nu se schimba.
  const [mapShownOnce, setMapShownOnce] = useState(mobileView === "map");
  useEffect(() => { if (mobileView === "map") setMapShownOnce(true); }, [mobileView]);
  const mobileMapClass = mobileView === "map"
    ? "relative block"
    : mapShownOnce
      ? "relative max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:invisible max-lg:pointer-events-none max-lg:[&_.maplibregl-ctrl-attrib]:!invisible"
      : "relative hidden lg:block";

  const renderMapPanel = (fullscreen = false) => (
          <div data-results-map className={`isolate min-w-0 ${fixedDesktop ? "lg:h-full lg:overflow-hidden" : "lg:sticky lg:top-[var(--aside-top)]"} ${fullscreen ? "relative flex-1 min-h-0 h-full" : mobileMapClass}`} style={fixedDesktop ? undefined : { "--aside-top": "calc(var(--search-nav-height, 80px) + var(--search-controls-height, 0px) + 16px)" }}>
            <ResultsMap
              results={mapRows}
              fitResults={fitRows}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              onViewportChange={onViewportChange}
              storageKey={mapStorageKey}
              focusArea={focusArea}
              rankById={rankById}
              fitKey={fitKey}
              userLocation={userLocation}
              className={fullscreen ? "h-full w-full overflow-hidden" : fixedDesktop ? "h-[70vh] overflow-hidden rounded-3xl border border-border lg:h-full" : "h-[70vh] overflow-hidden rounded-3xl border border-border lg:h-[max(16rem,calc(100dvh-var(--search-nav-height,80px)-var(--search-controls-height,0px)-32px))]"}
            />
            {mapStatus && <p role="status" className="absolute left-16 right-3 top-16 z-[501] rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed shadow-sm lg:hidden">{mapStatus}</p>}
            {mapActions && <div className="absolute right-3 top-3 z-[500] max-w-[calc(100%-4.5rem)]">{mapActions}</div>}
            {mapOverlay}
          </div>
  );

  return (
    <>
      {hasPositions && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 lg:hidden">
          {/* Eticheta se schimba („Vezi lista” / „Vezi pe hartă”), deci butonul nu are si aria-pressed:
              cele doua impreuna s-ar contrazice. */}
          <button
            type="button"
            data-map-toggle
            ref={mapToggleRef}
            onClick={onToggleMobileView}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-lg transition-colors hover:border-foreground/40"
          >
            {mobileView === "map" ? <List aria-hidden="true" className="h-4 w-4" /> : <MapIcon aria-hidden="true" className="h-4 w-4" />}
            {mobileView === "map" ? "Vezi lista" : mobileFullscreen ? "Hartă" : "Vezi pe hartă"}
          </button>
        </div>
      )}

      {/* 2026-09-27 (audit /cauta, A1): distanta fata de antet si controale se aplica doar pe desktop,
          unde zona e `lg:fixed`. Inainte `top` era pus direct in style, la toate latimile: pe telefon
          si tableta elementul este `relative`, deci era impins in jos cu ~370 px si primul rezultat
          ajungea sub ecran. */}
      <div data-search-workspace={fixedDesktop ? "" : undefined} style={fixedDesktop ? { "--workspace-top": "calc(var(--search-nav-height, 80px) + var(--search-controls-height, 0px) + 12px)" } : undefined} className={hasPositions ? (fixedDesktop ? "relative mt-3 grid gap-5 lg:fixed lg:inset-x-0 lg:bottom-3 lg:mx-auto lg:mt-0 lg:max-w-[1800px] lg:grid-cols-2 lg:overflow-hidden lg:px-8 lg:top-[var(--workspace-top)]" : "relative mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start") : (fixedDesktop ? "mt-3 lg:fixed lg:inset-x-0 lg:bottom-3 lg:mx-auto lg:mt-0 lg:max-w-[1800px] lg:overflow-hidden lg:px-8 lg:top-[var(--workspace-top)]" : "mt-4")}>
        <div ref={listRef} onScroll={rememberList} data-search-list className={`min-w-0 ${!mobileFullscreen && mobileView === "map" && hasPositions ? "hidden lg:block" : ""} ${fixedDesktop ? "lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-8" : ""}`}>
          {listHeader}
          <div className={gridLayout
            ? resultGridClassName(hasPositions)
            : (hasPositions ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid gap-4 sm:grid-cols-2")}>
            {(listResults || []).map((location) => (
              <ResultRow
                key={location.id}
                location={location}
                selected={selectedId === location.id}
                hovered={hoveredId === location.id}
                rank={rankById?.get(location.id) ?? null}
                gridLayout={gridLayout}
                hasPositions={hasPositions}
                integratedMapAction={integratedMapAction}
                renderCard={renderCard}
                onHover={onHover}
                onShowMap={showOnMap}
                registerCard={registerCard}
              />
            ))}
          </div>
          {children}
          {fixedDesktop && <p className="mt-8 hidden text-xs text-muted-foreground lg:block">VIASEE nu oferă diagnostic medical.</p>}
          {fixedDesktop && <nav aria-label="Informații VIASEE" className="mt-8 hidden flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground lg:flex"><Link to="/confidentialitate" className="min-h-8 underline">Confidențialitate</Link><Link to="/termeni" className="min-h-8 underline">Termeni</Link><Link to="/ajutor-si-suport" className="min-h-8 underline">Ajutor</Link></nav>}
        </div>

        {/* C4 (2026-09-28): div, nu element aside: harta e parte din rezultate, nu continut complementar
            (axe: „landmark-complementary-is-top-level”). Harta are propria regiune etichetata. */}
        {hasPositions && (!mobileFullscreen || desktop) && (desktop || mapShownOnce || mobileView === "map") && renderMapPanel()}
        {hasPositions && mobileFullscreen && !desktop && (
          <Dialog open={mobileView === "map"} onOpenChange={(open) => { if (!open && mobileView === "map") onToggleMobileView(); }}>
            <DialogContent
              data-mobile-map-dialog
              style={{ animation: "none" }}
              className="inset-0 left-0 top-0 z-[60] flex h-[100dvh] w-[100vw] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none [&>button]:hidden"
              onCloseAutoFocus={(event) => { event.preventDefault(); mapToggleRef.current?.focus({ preventScroll: true }); }}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <DialogTitle className="text-base">Harta locațiilor</DialogTitle>
                <button type="button" onClick={onToggleMobileView} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  <List aria-hidden="true" className="h-4 w-4" /> Vezi lista
                </button>
              </div>
              <DialogDescription className="sr-only">Explorează locațiile pe hartă. Filtrele și poziția listei sunt păstrate la revenire.</DialogDescription>
              {renderMapPanel(true)}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
}

// 2026-09-28 (audit /cauta, B7). Un rand din lista, memoizat: se redeseneaza doar cand i se schimba
// locatia, selectia, hover-ul sau numarul. Punctul de harta se calculeaza o data pe rand (inainte:
// de trei ori la fiecare randare a listei), iar cardul se reconstruieste doar cand se schimba ce
// primeste (renderCard trebuie sa fie stabil in pagina care il da).
const ResultRow = memo(function ResultRow({
  location,
  selected,
  hovered,
  rank,
  gridLayout,
  hasPositions,
  integratedMapAction,
  renderCard,
  onHover,
  onShowMap,
  registerCard,
}) {
  const hasPoint = useMemo(() => mapPointFromResult(location) !== null, [location]);
  const shownRank = hasPoint ? rank : null;
  const showThis = useMemo(() => (hasPoint ? () => onShowMap(location.id) : undefined), [hasPoint, onShowMap, location.id]);
  const setRef = useCallback((element) => registerCard(location.id, element), [registerCard, location.id]);
  const card = useMemo(() => renderCard(location, showThis, shownRank), [renderCard, location, showThis, shownRank]);
  const enter = () => onHover(location.id);
  const leave = () => onHover(null);
  return (
    <div
      ref={setRef}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      data-selected={selected ? "" : undefined}
      className={gridLayout
        ? resultCellClassName({ hasPositions, selected, hovered })
        : `relative h-full rounded-[22px] transition-shadow ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      } ${hovered && !selected ? "shadow-[0_4px_16px_rgba(23,23,23,0.10)]" : ""}`}
    >
      {/* In grila, numarul pinului sta pe coperta cardului (al treilea argument al renderCard). */}
      {!gridLayout && shownRank !== null && (
        <span aria-hidden="true" title={`Pinul ${shownRank} pe hartă`} className={`pointer-events-none absolute -left-1 -top-1.5 z-10 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums shadow-[0_0_0_3px_hsl(var(--background))] ${selected ? "bg-[#4f6080] text-white" : "bg-[#171717] text-white"}`}>
          {shownRank}
        </span>
      )}
      {card}
      {!integratedMapAction && showThis && <button type="button" onClick={showThis} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-secondary"><MapIcon aria-hidden="true" className="h-4 w-4" /> Vezi pe hartă</button>}
    </div>
  );
});
