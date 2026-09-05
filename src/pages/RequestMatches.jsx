import React, { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
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
    setMobileView("map");
  }, []);

  if (!Array.isArray(results)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Nu am gasit rezultate de afisat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este posibil sa fi ajuns direct pe aceasta pagina, fara sa treci prin cautare.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Inapoi la cautare
        </Link>
      </div>
    );
  }

  const isProfessionalMode = resultMode === RESULT_MODES.professionals.key;
  const areaLabel = meta?.selected_locality_name || meta?.client_address_text || "";

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
    <div className="flex h-[calc(100svh-4rem)] flex-col lg:h-[calc(100svh-5rem)]">
      {/* Bara de context. Ramane vizibila si cand lista se deruleaza, ca pacientul sa stie
          mereu ce cautare vede. */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 lg:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inapoi
        </button>

        <p className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground sm:text-sm">
          {results.length} {results.length === 1 ? "opțiune găsită" : "opțiuni găsite"}
          {areaLabel ? ` în ${areaLabel}` : ""}
        </p>

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

      <div className="flex min-h-0 flex-1">
        {/* Lista. Propriul derulaj, ca harta sa nu plece de sub ochi. */}
        <div
          className={`min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:max-w-[46rem] lg:px-6 ${
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
          />
        </div>

        {/* Harta. Permanenta pe desktop, comutabila pe telefon. */}
        <aside
          className={`min-w-0 flex-1 border-border lg:block lg:border-l ${
            mobileView === "map" ? "block" : "hidden"
          }`}
        >
          {isProfessionalMode && (
            <div className="border-b border-border bg-secondary/40 px-4 py-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Harta arată clinicile și opticile găsite pentru cererea ta, nu specialiștii.
              </p>
            </div>
          )}
          <div className={isProfessionalMode ? "h-[calc(100%-2.5rem)]" : "h-full"}>
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
