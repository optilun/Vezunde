import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LocationsWithMap from "@/components/results/LocationsWithMap";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
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
  const [saved] = useState(() => readSearchSession().national || {});
  const scrollRestored = useRef(false);
  const [state, setState] = useState({ status: "loading", points: [], meta: null, error: "" });
  const type = providerType;
  const [retry, setRetry] = useState(0);
  const [visibleIds, setVisibleIds] = useState(null);
  const [pageSize, setPageSize] = useState(saved.pageSize || 24);
  const [mobileView, setMobileView] = useState(saved.mobileView || "map");
  const handleViewport = useCallback(({ visibleIds: ids }) => {
    setVisibleIds(ids);

  }, []);
  const [selectedId, setSelectedId] = useState(saved.selectedId || null);
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

  useEffect(() => {
    writeSearchSession({ national: { selectedId, mobileView, pageSize } });
  }, [selectedId, mobileView, pageSize]);
  useEffect(() => {
    if (state.status !== "ready" || scrollRestored.current) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: readSearchSession().nationalScroll || 0, behavior: "instant" });
      scrollRestored.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.status]);
  useEffect(() => {
    const save = () => { if (scrollRestored.current) writeSearchSession({ nationalScroll: window.scrollY }); };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

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
            <p className="text-sm text-muted-foreground" aria-live="polite">{inView.length} locații în zona vizibilă</p>
            <LocationsWithMap
              results={visiblePoints}
              listResults={listedPoints}
              renderCard={(point) => <DirectoryResultCard location={point} />}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={() => setMobileView((view) => view === "map" ? "list" : "map")}
              onViewportChange={handleViewport}
              storageKey="national"
            >
              {inView.length === 0 && <p className="rounded-2xl border border-border bg-card p-6 text-sm">Nu sunt locații în această zonă. Deplasează harta sau micșorează zoom-ul.</p>}
              {inView.length > pageSize && <button type="button" onClick={() => setPageSize((size) => size + 24)} className="mt-5 min-h-11 rounded-full border border-border bg-card px-6 text-sm font-semibold hover:bg-secondary">Arată mai multe</button>}
            </LocationsWithMap>
          </>
        )}
      </div>
    </section>
  );
}