import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, List, Map as MapIcon, MessageSquare, SlidersHorizontal, LocateFixed, Globe } from "lucide-react";
import PatientRequestSubmission from "@/components/intake2/PatientRequestSubmission";
import MatchResults from "@/components/intake2/MatchResults";
import { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import ResultsMap from "@/components/results/ResultsMap";
import { preloadVectorCanvas } from "@/components/results/vectorCanvasLoader";
import { loadNationalDirectoryMap } from "@/lib/nationalDirectoryMap";
import { boundsForPoints, mapPointFromResult } from "../../shared/resultsMapPoints.js";
import { recommendationMapContext } from "../../shared/recommendationMapContext.js";
import { INTENTS } from "@/lib/intentRegistry";
import useRecommendationView from "@/hooks/useRecommendationView";
import { clearPatientIntakeSession } from "@/lib/patientIntakeSession";

// Ecranul de recomandari, in forma folosita de hartile de cautare (Airbnb, Booking).
//
// 2026-09-05. Inainte era o coloana ingusta de carduri inalte, cu o zona goala in dreapta care
// se umplea abia dupa un click. Ecranul nu ajuta la ce vine un pacient sa faca aici: sa COMPARE
// cateva optiuni si sa vada unde sunt.
//
// Ce s-a schimbat structural:
//   - pagina ocupa exact inaltimea ferestrei si nu se deruleaza in intregime. Lista are propriul
//     derulaj, harta ramane pe loc. Asa contextul spatial nu se pierde cand cauti in lista;
//   - harta este permanenta pe desktop, nu o recompensa pentru un click;
//   - pe telefon, unde nu incap alaturi, se comuta intre lista si harta - la fel ca la ei.
//
// Ce am refuzat sa preiau: "cauta in zona asta" ca re-interogare dupa dreptunghiul hartii. La
// Airbnb viewportul ESTE cautarea. La VIASEE cautarea este definita de localitatea si aria alese
// de pacient, iar rezultatele vin clasate de server dupa servicii confirmate si verificare. O
// re-interogare dupa harta ar insemna alt criteriu de potrivire decat cel ales. Butonul de aici
// doar filtreaza vizual lista deja primita - si spune cate optiuni a ascuns.

export default function RequestMatches() {
  // Harta vectoriala se descarca in paralel, fara sa blocheze rezultatele.
  useEffect(() => { preloadVectorCanvas(); }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { results, meta } = location.state || {};
  // 2026-09-30. Starea vederii (selectie, mod, harta/lista pe telefon, filtre, derulare) si salvarea ei
  // in sesiune stau intr-un singur loc: useRecommendationView.
  const {
    viewKey, savedView, listRef, saveView,
    selectedId, setSelectedId, resultMode, setResultMode, mobileView, setMobileView,
    filterToViewport, setFilterToViewport, listFilters, setListFilters,
  } = useRecommendationView({ hasResults: Array.isArray(results) });

  const [activeMeta, setActiveMeta] = useState(meta || {});
  const requestRef = useRef(null);
  const [workspaceView, setWorkspaceView] = useState("results");
  const [hasRequest, setHasRequest] = useState(false);
  const [navHeight, setNavHeight] = useState(80);
  useEffect(() => {
    if (!Array.isArray(results)) return;
    const headers = [...document.querySelectorAll("header")];
    const measure = () => setNavHeight(Math.max(0, ...headers.map(header => header.getBoundingClientRect().height)));
    const observer = new ResizeObserver(measure);
    headers.forEach(header => observer.observe(header));
    measure();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => { observer.disconnect(); root.style.overflow = previousOverflow; };
  }, [results]);
  const [hoveredId, setHoveredId] = useState(null);
  const [visibleResults, setVisibleResults] = useState(Array.isArray(results) ? results : []);
  const [viewport, setViewport] = useState({ visibleIds: null, mappedCount: 0 });

  const [focusArea, setFocusArea] = useState(null);
  const [nationalDirectory, setNationalDirectory] = useState([]);
  const [directoryStatus, setDirectoryStatus] = useState("loading");
  const [directoryRetry, setDirectoryRetry] = useState(0);
  const hasResults = Array.isArray(results);
  useEffect(() => {
    if (!hasResults) return;
    let active = true;
    let timer;
    setDirectoryStatus("loading");
    // Aceeasi harta ca pe /cauta, prin incarcatorul comun (reincercare la limita de trafic, harta
    // tinuta cateva minute): venind din /cauta, punctele nu se mai cer inca o data.
    Promise.race([
      loadNationalDirectoryMap({ force: directoryRetry > 0 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 25000); }),
    ]).then(data => {
      if (!active) return;
      if (!Array.isArray(data?.results)) throw new Error("directory unavailable");
      setNationalDirectory(data.results);
      setDirectoryStatus("ready");
    }).catch(() => { if (active) setDirectoryStatus("error"); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, [directoryRetry, hasResults]);
  // Lista pe care o vede harta dupa filtrele din bara (null = fara filtre). Doar pentru pini: cererea,
  // numarul din antet si starea recomandarii citesc `visibleResults`, lista completa.
  const [mapFilteredResults, setMapFilteredResults] = useState(null);
  const { mapResults, focusResults } = useMemo(() => {
    const full = recommendationMapContext(visibleResults, nationalDirectory, activeMeta);
    if (!mapFilteredResults) return full;
    // Camera ramane pe rezultatele intregi ale cererii, ca harta sa nu sara la fiecare filtru; un
    // rezultat ascuns de filtre ramane doar punct din directorul national, fara rang.
    return {
      mapResults: recommendationMapContext(mapFilteredResults, nationalDirectory, activeMeta).mapResults,
      focusResults: full.focusResults,
    };
  }, [visibleResults, mapFilteredResults, nationalDirectory, activeMeta]);

  const mappedLocationIds = useMemo(() => new Set(mapResults.filter(mapPointFromResult).map(row => row.id)), [mapResults]);
  const focusBounds = useMemo(() => boundsForPoints(focusResults.map(mapPointFromResult).filter(Boolean)), [focusResults]);
  const showMapArea = (bounds) => {
    setSelectedId(null);
    setFocusArea({ bounds });
  };

  useEffect(() => {
    if (directoryStatus === "ready" && selectedId && !mapResults.some(row => row.id === selectedId)) setSelectedId(null);
  }, [selectedId, mapResults, directoryStatus]);

  const handleViewport = useCallback((next) => {
    setViewport({ visibleIds: next.visibleIds, mappedCount: next.mappedCount });
  }, []);

  const selectFromList = useCallback((entry) => {
    setSelectedId(entry?.id || null);
    if (!window.matchMedia("(min-width: 1024px)").matches) setMobileView("map");
  }, []);

  if (!Array.isArray(results)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Nu am gasit rezultate de afisat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este posibil sa fi ajuns direct pe aceasta pagina, fara sa treci prin cautare.
        </p>
        <Link
          to="/cerere"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Inapoi la cautare
        </Link>
      </div>
    );
  }

  const isProfessionalMode = resultMode === RESULT_MODES.professionals.key;
  const areaLabel = activeMeta.query_scope === "national" ? "România" : activeMeta.query_scope === "county" ? activeMeta.selected_county_name || "" : activeMeta.selected_locality_name || activeMeta.client_address_text || "";

  const needLabel = INTENTS[activeMeta.resolved_intent]?.label || "";

  const mapPanel = (
    <ResultsMap
      storageKey={"recommendations:" + viewKey}
      results={mapResults}
      fitResults={focusResults}
      focusArea={focusArea}
      selectedId={selectedId}
      hoveredId={hoveredId}
      onSelect={setSelectedId}
      onHover={setHoveredId}
      onViewportChange={handleViewport}
      className="h-full w-full"
    />
  );

  return (
    <div style={{ top: navHeight }} className="fixed inset-x-0 bottom-0 z-10 flex flex-col bg-background">
      {/* Bara de context. Ramane vizibila si cand lista se deruleaza, ca pacientul sa stie
          mereu ce cautare vede. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/cerere", { state: { resumeIntake: true } })}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Modifica cererea
        </button>

        <div className="min-w-0 flex-1 basis-40">
          <h1 className="font-heading text-base font-bold sm:text-lg">Recomandările tale</h1>
          <p className="truncate text-xs text-muted-foreground">{isProfessionalMode ? "Specialiști" : `${visibleResults.length} ${visibleResults.length === 1 ? "locație găsită" : "locații găsite"}`}{areaLabel ? ` · ${areaLabel}` : ""}{needLabel ? ` · ${needLabel}` : ""}</p>
        </div>
        <div role="group" aria-label="Zona paginii" className="flex max-w-full rounded-full border border-border bg-secondary/60 p-1">
          <button type="button" aria-pressed={workspaceView === "results"} onClick={() => setWorkspaceView("results")} className={`min-h-11 rounded-full px-3 text-xs font-semibold ${workspaceView === "results" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Recomandari</button>
          <button type="button" aria-pressed={workspaceView === "request"} disabled={!visibleResults.length && !hasRequest} onClick={() => { setWorkspaceView("request"); requestAnimationFrame(() => requestRef.current?.focus({ preventScroll: true })); }} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold disabled:opacity-40 ${workspaceView === "request" ? "bg-card text-[#4f6080] shadow-sm" : "text-muted-foreground"}`}><MessageSquare aria-hidden="true" className="h-4 w-4" />{hasRequest ? "Cererea si mesaje" : "Trimite o cerere"}</button>
        </div>

        {workspaceView === "results" && (
          <button type="button" onClick={() => setMobileView(view => view === "map" ? "list" : "map")}
            aria-label={mobileView === "map" ? "Afiseaza lista rezultatelor" : "Afiseaza harta locatiilor"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold lg:hidden">
            {mobileView === "map" ? <List aria-hidden="true" className="h-4 w-4" /> : <MapIcon aria-hidden="true" className="h-4 w-4" />}
            {mobileView === "map" ? "Lista" : "Harta"}
          </button>
        )}
      </div>

      <div className={`${workspaceView === "request" ? "hidden" : "flex"} mx-auto min-h-0 w-full max-w-[1800px] flex-1 gap-5 px-4 py-3 lg:px-8`}>
        {/* Lista. Propriul derulaj, ca harta sa nu plece de sub ochi. */}
        <div
          ref={listRef}
          onScroll={saveView}
          className={`min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-8 pt-1 ${
            mobileView === "map" ? "hidden lg:block" : ""
          }`}
        >
          <MatchResults
            initialResultMode={savedView.mode}
            initialFilters={savedView.filters}
            onFiltersChange={setListFilters}
            onFilteredResultsChange={setMapFilteredResults}
            initialShowMore={Boolean(savedView.scrollTop)}
            results={results}
            meta={meta}
            compact
            hideRequestSubmission
            mappedLocationIds={mappedLocationIds}
            onClearViewport={() => setFilterToViewport(false)}
            onChangeLocation={() => navigate("/cerere", { state: { resumeIntake: true } })}
            onReviewCriteria={() => navigate("/cerere", { state: { resumeIntake: true } })}
            onRequestCreated={() => clearPatientIntakeSession()}
            onSelectLocation={selectFromList}
            selectedLocationId={selectedId}
            onHoverLocation={setHoveredId}
            hoveredLocationId={hoveredId}
            visibleIds={filterToViewport && !isProfessionalMode ? viewport.visibleIds : null}
            onVisibleResultsChange={setVisibleResults}
            onResultModeChange={setResultMode}
            onContextChange={setActiveMeta}
            onExpandedSnapshot={(snapshot) => navigate(location.pathname, { replace: true, state: { ...location.state, ...snapshot, resultsViewKey: viewKey } })}
          />
          <nav aria-label="Informații VIASEE" className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground"><Link to="/confidentialitate" className="min-h-9 underline">Confidențialitate</Link><Link to="/termeni" className="min-h-9 underline">Termeni</Link><Link to="/ajutor-si-suport" className="min-h-9 underline">Ajutor</Link></nav>
        </div>

        {/* Harta. Permanenta pe desktop, comutabila pe telefon. */}
        <aside
          className={`min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card lg:flex ${
            mobileView === "map" ? "flex" : "hidden"
          }`}
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card p-1.5">
            <button type="button" disabled={!focusBounds} onClick={() => showMapArea(focusBounds)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#4f6080] hover:bg-secondary disabled:opacity-40">
              <LocateFixed aria-hidden="true" className="h-4 w-4" />Zona cautata
            </button>
            <button type="button" onClick={() => showMapArea([[43.6,20.2],[48.3,29.8]])}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-secondary">
              <Globe aria-hidden="true" className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Romania</span>
            </button>
            {!isProfessionalMode && <button type="button" onClick={() => setFilterToViewport(value => !value)}
              aria-pressed={filterToViewport} aria-label="Arata doar rezultatele cererii vizibile pe harta" title="Filtreaza lista cererii dupa zona vizibila" disabled={!filterToViewport && viewport.mappedCount === 0}
              className={`ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 ${filterToViewport ? "border-[#4f6080] bg-[#4f6080] text-white" : "border-border bg-card hover:bg-secondary"}`}>
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />Filtreaza lista
            </button>}
          </div>
          {directoryStatus !== "ready" && <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground" role="status">
            <span>{directoryStatus === "loading" ? "Se incarca locatiile din tara..." : "Directorul national nu s-a incarcat."}</span>
            {directoryStatus === "error" && <button type="button" className="min-h-11 rounded-full border border-border px-3 font-semibold" onClick={() => setDirectoryRetry(value => value + 1)}>Reincearca</button>}
          </div>}
          {isProfessionalMode && <p className="shrink-0 border-b border-border px-3 py-2 text-xs text-muted-foreground">Harta arata locatii. Specialistii pentru cererea ta sunt in lista.</p>}
          <div className="min-h-0 flex-1">
            {mapPanel}
          </div>
        </aside>
      </div>

      <section ref={requestRef} tabIndex={-1} aria-label="Cererea si mesajele tale" className={`${workspaceView === "request" ? "block" : "hidden"} min-h-0 flex-1 overflow-y-auto overscroll-contain bg-secondary/20 px-4 py-5 sm:px-8`}>
        <div className={`mx-auto w-full pb-8 ${hasRequest ? "max-w-6xl" : "max-w-3xl"}`}>
          <h2 className="font-heading text-xl font-bold">{hasRequest ? "Cererea si mesajele tale" : "Primeste raspunsuri de la locatii"}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{hasRequest ? "Urmareste raspunsurile si continua discutia cu locatia aleasa." : "Verifica cererea si alege sa o trimiti. Conversatiile devin disponibile dupa un raspuns eligibil al locatiei."}</p>
          <PatientRequestSubmission defaultOpen results={visibleResults} meta={activeMeta} onRequestCreated={() => { setHasRequest(true); clearPatientIntakeSession(); }} />
        </div>
      </section>

    </div>
  );
}
