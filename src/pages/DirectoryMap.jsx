import React, { useCallback, useEffect, useMemo, useState } from "react";
import { List, Map as MapIcon, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ResultsMap from "@/components/results/ResultsMap";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";

// Directorul pe harta Romaniei.
//
// 2026-09-06. Pana acum, ca sa vezi ceva pe harta trebuia sa stii deja unde cauti: scriai
// localitatea, si abia apoi apareau punctele. Pagina asta inverseaza ordinea - pornesti de la
// tara intreaga si cobori cu zoom-ul pana unde te intereseaza. Este singurul ecran din care se
// vede acoperirea reala a directorului.
//
// Ce NU este: o cautare. Nu scoreaza, nu ordoneaza dupa relevanta, nu are Top 3 si nu trimite
// cereri. Cine vrea o recomandare merge prin `/cerere`, unde intrebarile si potrivirea sunt
// facute pentru asta. De aici pacientul intra pe un profil.
//
// Filtrarea dupa tip se face in browser, pe punctele deja primite: sunt sub o mie, iar o
// re-interogare la fiecare bifa ar fi mai lenta decat filtrarea locala.

export default function DirectoryMap({ providerType = "" }) {
  const [state, setState] = useState({ status: "loading", points: [], meta: null, error: "" });
  const type = providerType;
  const [retry, setRetry] = useState(0);
  const [visibleIds, setVisibleIds] = useState(null);
  const [pageSize, setPageSize] = useState(24);
  const [mobileView, setMobileView] = useState("map");
  const handleViewport = useCallback(({ visibleIds: ids }) => {
    setVisibleIds(ids);
    setPageSize(24);
  }, []);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", points: [], meta: null, error: "" });
    base44.functions
      .invoke("browseDirectoryProviders", { map_scope: "national" })
      .then((response) => {
        if (!active) return;
        if (response.data?.error) throw new Error(response.data.error);
        setState({
          status: "ready",
          points: Array.isArray(response.data?.results) ? response.data.results : [],
          meta: {
            total: Number(response.data?.total_published) || 0,
            withoutPosition: Number(response.data?.without_position) || 0,
          },
          error: "",
        });
      })
      .catch((reason) => {
        if (!active) return;
        setState({
          status: "error",
          points: [],
          meta: null,
          error: reason?.message || "Harta directorului nu a putut fi încărcată.",
        });
      });
    return () => { active = false; };
  }, [retry]);

  const visiblePoints = useMemo(
    () => (type ? state.points.filter((point) => point.provider_type === type) : state.points),
    [state.points, type],
  );

  useEffect(() => { setSelectedId(null); setHoveredId(null); }, [type]);

  const inView = useMemo(() => {
    if (visibleIds === null) return visiblePoints;
    const ids = new Set(visibleIds);
    return visiblePoints.filter((point) => ids.has(point.id));
  }, [visiblePoints, visibleIds]);
  const listedPoints = inView.slice(0, pageSize);
  // Keep a selected marker represented even beyond the first page of cards.
  const selectedPoint = inView.find((point) => point.id === selectedId);
  if (selectedPoint && !listedPoints.some((point) => point.id === selectedId)) {
    listedPoints.unshift(selectedPoint);
  }

  return (
    <section aria-label="Explorează locațiile pe hartă" className="mt-6">
      <div className="mb-4 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
              Explorează România
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {state.status === "ready"
                ? `${visiblePoints.length} ${visiblePoints.length === 1 ? "locație" : "locații"} pe hartă${
                    state.meta?.withoutPosition
                      ? `, ${state.meta.withoutPosition} fără poziție publicată`
                      : ""
                  }`
                : state.status === "error" ? "Directorul nu a putut fi încărcat." : "Se încarcă locațiile publicate..."}
            </p>
          </div>


        </div>
      </div>

      <div className="min-h-[24rem]">
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă directorul...
          </div>
        )}

        {state.status === "error" && (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p role="alert" className="text-sm text-muted-foreground">{state.error}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)}
                className="mt-4 min-h-11 rounded-full border border-border bg-card px-5 text-sm font-semibold">
                Reîncearcă
              </button>
            </div>
          </div>
        )}

        {state.status === "ready" && visiblePoints.length === 0 && (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <MapPin className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Nicio locație de acest tip pe hartă
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Schimbă tipul selectat sau caută direct într-o localitate.
              </p>
            </div>
          </div>
        )}

        {state.status === "ready" && visiblePoints.length > 0 && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">{inView.length} locații în zona vizibilă</p>
              <button type="button" onClick={() => setMobileView((view) => view === "map" ? "list" : "map")}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold lg:hidden">
                {mobileView === "map" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
                {mobileView === "map" ? "Vezi lista" : "Vezi harta"}
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className={mobileView === "map" ? "hidden lg:block" : ""}>
                {inView.length === 0 && <p className="rounded-2xl border border-border bg-card p-6 text-sm">Nu sunt locații în această zonă. Deplasează harta sau micșorează zoom-ul.</p>}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {listedPoints.map((point) => (
                    <div key={point.id}
                      onMouseEnter={() => setHoveredId(point.id)} onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(point.id)} onBlur={() => setHoveredId(null)}
                      className={`rounded-2xl transition-shadow ${selectedId === point.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : hoveredId === point.id ? "shadow-md" : ""}`}>
                      <DirectoryResultCard location={point} />
                      <button type="button" onClick={() => { setSelectedId(point.id); setMobileView("map"); }}
                        className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary">
                        <MapPin className="h-4 w-4" /> Vezi pe hartă
                      </button>
                    </div>
                  ))}
                </div>
                {inView.length > pageSize && (
                  <button type="button" onClick={() => setPageSize((size) => size + 24)}
                    className="mt-5 min-h-11 rounded-full border border-border bg-card px-6 text-sm font-semibold hover:bg-secondary">
                    Arată mai multe
                  </button>
                )}
              </div>
              <aside className={`lg:sticky lg:top-24 ${mobileView === "map" ? "" : "hidden lg:block"}`}>
                <ResultsMap
                  results={visiblePoints}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={setSelectedId}
                  onHover={setHoveredId}
                  onViewportChange={handleViewport}
                  className="h-[65svh] min-h-[24rem] w-full overflow-hidden rounded-3xl border border-border lg:h-[calc(100vh-8rem)]"
                />
              </aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
