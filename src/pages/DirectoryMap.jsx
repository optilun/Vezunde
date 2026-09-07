import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, LocateFixed } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LocationsWithMap from "@/components/results/LocationsWithMap";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";

import { nearestDirectory } from "../../shared/nearbyDirectory.js";

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
  const [origin, setOrigin] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle");
  const [radiusKm, setRadiusKm] = useState(15);
  const geoRequest = useRef(0);
  const alive = useRef(true);
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus("unavailable"); return; }
    const requestId = ++geoRequest.current;
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      if (!alive.current || requestId !== geoRequest.current) return;
      if (position.coords.accuracy > 5000) { setGeoStatus("imprecise"); return; }
      setRadiusKm(15);
      setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, requestId });
      setSelectedId(null);
      setPageSize(24);
      setGeoStatus("ready");
    }, (error) => {
      if (alive.current && requestId === geoRequest.current) setGeoStatus(error.code === 1 ? "denied" : "unavailable");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }, []);
  useEffect(() => {
    alive.current = true;
    navigator.permissions?.query({ name: "geolocation" }).then((permission) => {
      // Do not interrupt a returning user's map exploration.
      if (alive.current && permission.state === "granted" && !readSearchSession().maps?.national) requestLocation();
    }).catch(() => {});
    return () => { alive.current = false; geoRequest.current += 1; };
  }, [requestLocation]);
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
    () => (type ? state.points.filter((point) => type.split(",").includes(point.provider_type)) : state.points),
    [state.points, type],
  );

  useEffect(() => {
    writeSearchSession({ national: { ...readSearchSession().national, selectedId, mobileView, pageSize } });
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

  const orderedPoints = useMemo(() => {
    if (origin) return nearestDirectory(visiblePoints, origin);
    if (!saved.nearbyOrder) return visiblePoints;
    const rank = new Map(saved.nearbyOrder.map((id, index) => [id, index]));
    return [...visiblePoints].sort((a,b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [visiblePoints, origin, saved.nearbyOrder]);
  useEffect(() => {
    if (origin && orderedPoints.length) writeSearchSession({ national: { ...readSearchSession().national, nearbyOrder: orderedPoints.map((point) => point.id) } });
  }, [orderedPoints, origin]);
  const focusArea = useMemo(() => {
    if (!origin) return null;
    const latDelta = radiusKm / 111.32;
    const lngDelta = latDelta / Math.max(0.01, Math.cos(origin.lat * Math.PI / 180));
    return {
      key: `${origin.requestId}:${radiusKm}`,
      bounds: [[Math.max(-90, origin.lat-latDelta), Math.max(-180, origin.lng-lngDelta)], [Math.min(90, origin.lat+latDelta), Math.min(180, origin.lng+lngDelta)]],
    };
  }, [origin, radiusKm]);
  const inView = useMemo(() => {
    if (visibleIds === null) return orderedPoints;
    const ids = new Set(visibleIds);
    return orderedPoints.filter((point) => ids.has(point.id));
  }, [orderedPoints, visibleIds]);
  const selectedIndex = inView.findIndex((point) => point.id === selectedId);
  const listedPoints = inView.slice(0, Math.max(pageSize, selectedIndex + 1));

  return (
    <section aria-label="Explorează locațiile pe hartă" className="mt-3">
      <div className="mb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
              {origin || saved.nearbyOrder ? "Locații în zona explorată" : "Explorează România"}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {state.status === "ready"
                ? origin || saved.nearbyOrder ? "Locațiile din zona hărții, în ordinea apropierii. Pozițiile pot fi aproximative." : "Alege localitatea sau folosește poziția dispozitivului."
                : state.status === "error" ? "Directorul nu a putut fi încărcat." : "Se încarcă locațiile publicate..."}
            </p>
          </div>
          <button type="button" onClick={requestLocation} disabled={geoStatus === "loading"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c9d3e3] bg-[#eff1f5] px-5 text-sm font-semibold text-[#4f6080] hover:bg-[#dce4f2] disabled:opacity-60">
            {geoStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {geoStatus === "loading" ? "Se caută poziția..." : "În apropierea mea"}
          </button>
        </div>
        {(geoStatus === "denied" || geoStatus === "unavailable") && <p role="status" className="mt-3 text-sm text-muted-foreground">{geoStatus === "denied" ? "Accesul la locație nu este permis. Poți alege localitatea din bara de căutare." : "Poziția nu este disponibilă momentan. Încearcă din nou sau alege localitatea."}</p>}
      </div>

      {geoStatus === "imprecise" && <p role="status" className="mb-3 text-sm text-muted-foreground">Poziția dispozitivului este prea aproximativă. Alege localitatea pentru rezultate utile.</p>}
      {origin && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Zona inițială: aproximativ {radiusKm} km de la poziția ta.</span>
        {radiusKm < 60 && <button type="button" onClick={() => setRadiusKm((radius) => radius * 2)} className="min-h-11 rounded-full border border-border bg-card px-4 text-foreground">Extinde zona la {radiusKm * 2} km</button>}
      </div>}
      {state.meta?.withoutPosition > 0 && <p className="mb-3 text-xs text-muted-foreground">{state.meta.withoutPosition} locații nu au poziție publicată. Le poți găsi alegând localitatea.</p>}
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
              renderCard={(point, onShowMap) => <DirectoryResultCard location={point} onShowMap={onShowMap} />}
              integratedMapAction
              focusArea={focusArea}
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