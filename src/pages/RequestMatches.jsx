import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, List, Map as MapIcon, MessageSquare, SlidersHorizontal } from "lucide-react";
import PatientRequestSubmission from "@/components/intake2/PatientRequestSubmission";
import MatchResults from "@/components/intake2/MatchResults";
import { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import ResultsMap from "@/components/results/ResultsMap";
import { base44 } from "@/api/base44Client";
import { recommendationMapContext } from "../../shared/recommendationMapContext.js";
import { INTENTS } from "@/lib/intentRegistry";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
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
  const location = useLocation();
  const navigate = useNavigate();
  const { results, meta } = location.state || {};
  const viewKey = useRef(location.state?.resultsViewKey || location.key).current;
  const restored = useRef(readSearchSession().recommendations).current;
  const savedView = restored?.key === viewKey ? restored : {};
  const restoreScroll = useRef(savedView.scrollTop || 0);
  const initialSelection = useRef(true);


  const [activeMeta, setActiveMeta] = useState(meta || {});
  const listRef = useRef(null);
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
  const [selectedId, setSelectedId] = useState(savedView.selectedId || null);
  const [hoveredId, setHoveredId] = useState(null);
  const [visibleResults, setVisibleResults] = useState(Array.isArray(results) ? results : []);
  const [resultMode, setResultMode] = useState(savedView.mode === "professionals" ? "professionals" : "locations");
  const [mobileView, setMobileView] = useState(savedView.mobileView === "map" ? "map" : "list");
  const [filterToViewport, setFilterToViewport] = useState(savedView.filterToViewport === true);
  const [viewport, setViewport] = useState({ visibleIds: null, mappedCount: 0 });

  const [nationalDirectory, setNationalDirectory] = useState([]);
  const [directoryStatus, setDirectoryStatus] = useState("loading");
  const [directoryRetry, setDirectoryRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer;
    setDirectoryStatus("loading");
    Promise.race([
      base44.functions.invoke("browseDirectoryProviders", { map_scope: "national" }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 25000); }),
    ]).then(response => {
      if (!active) return;
      if (response.data?.error || !Array.isArray(response.data?.results)) throw new Error("directory unavailable");
      setNationalDirectory(response.data.results);
      setDirectoryStatus("ready");
    }).catch(() => { if (active) setDirectoryStatus("error"); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, [directoryRetry]);
  const { mapResults, focusResults } = useMemo(
    () => recommendationMapContext(visibleResults, nationalDirectory, activeMeta),
    [visibleResults, nationalDirectory, activeMeta],
  );

  const saveView = useCallback(() => {
    writeSearchSession({ recommendations: {
      key: viewKey, selectedId, mode: resultMode, mobileView, filterToViewport,
      scrollTop: restoreScroll.current || listRef.current?.scrollTop || 0,
    } });
  }, [viewKey, selectedId, resultMode, mobileView, filterToViewport]);
  useEffect(() => { saveView(); }, [saveView]);
  useEffect(() => {
    if (!Array.isArray(results)) return;
    if (location.state?.resultsViewKey !== viewKey) {
      navigate(location.pathname, { replace: true, state: { ...location.state, resultsViewKey: viewKey } });
    }
  }, [results, viewKey, location.pathname, location.state, navigate]);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !restoreScroll.current) return;
    const apply = () => {
      const target = restoreScroll.current;
      if (!target) return;
      list.scrollTop = target;
      if (Math.abs(list.scrollTop - target) < 2) restoreScroll.current = 0;
    };
    const observer = new ResizeObserver(apply);
    if (list.firstElementChild) observer.observe(list.firstElementChild);
    const stop = () => { restoreScroll.current = 0; observer.disconnect(); };
    list.addEventListener("wheel", stop, { passive: true });
    list.addEventListener("touchstart", stop, { passive: true });
    const frame = requestAnimationFrame(apply);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); list.removeEventListener("wheel", stop); list.removeEventListener("touchstart", stop); };
  }, []);
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

  useEffect(() => {
    if (initialSelection.current) { initialSelection.current = false; return; }
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const card = [...(list?.querySelectorAll("[data-result-location-id]") || [])].find(node => node.dataset.resultLocationId === selectedId);
      if (!card || !list) return;
      const parent = list.getBoundingClientRect();
      const item = card.getBoundingClientRect();
      if (item.top < parent.top || item.bottom > parent.bottom) list.scrollTop += item.top - parent.top - 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, mobileView]);

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

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-base font-bold sm:text-lg">Recomandările tale</h1>
          <p className="truncate text-xs text-muted-foreground">{isProfessionalMode ? "Specialiști" : `${visibleResults.length} ${visibleResults.length === 1 ? "locație găsită" : "locații găsite"}`}{areaLabel ? ` · ${areaLabel}` : ""}{needLabel ? ` · ${needLabel}` : ""}</p>
        </div>
        <div role="group" aria-label="Zona paginii" className="flex rounded-full border border-border bg-secondary/60 p-1">
          <button type="button" aria-pressed={workspaceView === "results"} onClick={() => setWorkspaceView("results")} className={`min-h-11 rounded-full px-3 text-xs font-semibold ${workspaceView === "results" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Recomandari</button>
          <button type="button" aria-pressed={workspaceView === "request"} disabled={!visibleResults.length && !hasRequest} onClick={() => { setWorkspaceView("request"); requestAnimationFrame(() => requestRef.current?.focus({ preventScroll: true })); }} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold disabled:opacity-40 ${workspaceView === "request" ? "bg-card text-[#4f6080] shadow-sm" : "text-muted-foreground"}`}><MessageSquare aria-hidden="true" className="h-4 w-4" />{hasRequest ? "Cererea si mesaje" : "Trimite o cerere"}</button>
        </div>

        {/* Filtrarea dupa harta se ofera doar cand harta chiar poate ascunde ceva. */}
        <button
          type="button"
          onClick={() => setFilterToViewport((value) => !value)}
          aria-pressed={filterToViewport}
          disabled={isProfessionalMode || viewport.mappedCount === 0}
          className={`${workspaceView === "request" ? "!hidden" : ""} hidden min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors disabled:opacity-40 lg:inline-flex ${
            filterToViewport
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Doar ce se vede pe hartă
        </button>
      </div>

      <div className={`${workspaceView === "request" ? "hidden" : "flex"} mx-auto min-h-0 w-full max-w-[1800px] flex-1 gap-5 px-4 py-3 lg:px-8`}>
        {/* Lista. Propriul derulaj, ca harta sa nu plece de sub ochi. */}
        <div
          ref={listRef}
          onScroll={saveView}
          className={`min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-24 pt-1 lg:pb-8 ${
            mobileView === "map" ? "hidden lg:block" : ""
          }`}
        >
          <MatchResults
            initialResultMode={savedView.mode}
            initialShowMore={Boolean(savedView.scrollTop)}
            results={results}
            meta={meta}
            compact
            hideRequestSubmission
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
          {isProfessionalMode && (
            <div className="border-b border-border bg-secondary/40 px-4 py-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Harta arata locatiile publice din tara. Lista alaturata arata specialistii pentru cererea ta.
              </p>
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-xs text-muted-foreground" role="status">
            <span>{directoryStatus === "loading" ? "Se incarca locatiile din tara..." : directoryStatus === "error" ? "Locatiile din tara nu au putut fi incarcate." : "Locatii din tara · contur albastru: rezultatele cererii"}</span>
            {directoryStatus === "error" && <button type="button" className="min-h-11 rounded-full border border-border px-3 font-semibold" onClick={() => setDirectoryRetry(value => value + 1)}>Reincearca</button>}
          </div>
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
      {/* Comutatorul de pe telefon, flotant, ca la hartile de cautare. */}
      <div className={`${workspaceView === "request" ? "!hidden" : ""} pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden`}>
        <button
          type="button"
          onClick={() => setMobileView((view) => (view === "map" ? "list" : "map"))}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-lg"
        >
          {mobileView === "map" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          {mobileView === "map" ? "Listă" : "Hartă"}
        </button>
      </div>
    </div>
  );
}
