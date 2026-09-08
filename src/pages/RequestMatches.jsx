import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, List, Map as MapIcon, MessageSquare, SlidersHorizontal } from "lucide-react";
import MatchResults from "@/components/intake2/MatchResults";
import { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import ResultsMap from "@/components/results/ResultsMap";
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

  const [activeMeta, setActiveMeta] = useState(meta || {});
  const listRef = useRef(null);
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
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [visibleResults, setVisibleResults] = useState(Array.isArray(results) ? results : []);
  const [resultMode, setResultMode] = useState(RESULT_MODES.locations.key);
  const [mobileView, setMobileView] = useState("list");
  const [filterToViewport, setFilterToViewport] = useState(false);
  const [viewport, setViewport] = useState({ visibleIds: null, mappedCount: 0 });

  const handleViewport = useCallback((next) => {
    setViewport({ visibleIds: next.visibleIds, mappedCount: next.mappedCount });
  }, []);

  const selectFromList = useCallback((entry) => {
    setSelectedId(entry?.id || null);
    if (!window.matchMedia("(min-width: 1024px)").matches) setMobileView("map");
  }, []);

  useEffect(() => {
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
  }, [selectedId, mobileView, visibleResults]);

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

  const mapPanel = (
    <ResultsMap
      results={visibleResults}
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
          onClick={() => navigate(-1)}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inapoi
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-base font-bold sm:text-lg">Recomandările tale</h1>
          <p className="truncate text-xs text-muted-foreground">{isProfessionalMode ? "Specialiști" : `${visibleResults.length} ${visibleResults.length === 1 ? "locație găsită" : "locații găsite"}`}{areaLabel ? ` · ${areaLabel}` : ""}</p>
        </div>
        {!isProfessionalMode && visibleResults.length > 0 && <button type="button" onClick={() => {
          setMobileView("list");
          requestAnimationFrame(() => {
            const section = listRef.current?.querySelector("[data-request-followup]");
            if (section && listRef.current) {
              listRef.current.scrollTop += section.getBoundingClientRect().top - listRef.current.getBoundingClientRect().top;
              section.focus({ preventScroll: true });
            }
          });
        }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-[#4f6080] hover:bg-secondary"><MessageSquare aria-hidden="true" className="h-4 w-4" />Cererea mea</button>}

        {/* Filtrarea dupa harta se ofera doar cand harta chiar poate ascunde ceva. */}
        <button
          type="button"
          onClick={() => setFilterToViewport((value) => !value)}
          aria-pressed={filterToViewport}
          disabled={isProfessionalMode || viewport.mappedCount === 0}
          className={`hidden min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors disabled:opacity-40 lg:inline-flex ${
            filterToViewport
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Doar ce se vede pe hartă
        </button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 gap-5 px-4 py-3 lg:px-8">
        {/* Lista. Propriul derulaj, ca harta sa nu plece de sub ochi. */}
        <div
          ref={listRef}
          className={`min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-24 pt-1 lg:pb-8 ${
            mobileView === "map" ? "hidden lg:block" : ""
          }`}
        >
          <MatchResults
            results={results}
            meta={meta}
            compact
            onRequestCreated={() => clearPatientIntakeSession()}
            onSelectLocation={selectFromList}
            selectedLocationId={selectedId}
            onHoverLocation={setHoveredId}
            hoveredLocationId={hoveredId}
            visibleIds={filterToViewport && !isProfessionalMode ? viewport.visibleIds : null}
            onVisibleResultsChange={setVisibleResults}
            onResultModeChange={setResultMode}
            onContextChange={setActiveMeta}
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
                Harta arată clinicile și opticile găsite pentru cererea ta, nu specialiștii.
              </p>
            </div>
          )}
          <div className="min-h-0 flex-1">
            {mapPanel}
          </div>
        </aside>
      </div>

      {/* Comutatorul de pe telefon, flotant, ca la hartile de cautare. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden">
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
