import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, LocateFixed, ChevronDown } from "lucide-react";
import { loadNationalDirectoryMap, NATIONAL_MAP_ERROR_MESSAGE } from "@/lib/nationalDirectoryMap";
import { loadNationalMapSnapshot } from "@/lib/nationalMapEarly";
import LocationsWithMap from "@/components/results/LocationsWithMap";
import { readMobileViewChoice, readSearchSession, rememberMobileViewChoice, writeSearchSession } from "@/lib/searchSession";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import useRememberScroll from "@/hooks/useRememberScroll";
import { accuracyNote, formatAccuracy, locatePrecisely, MAX_USABLE_ACCURACY_M } from "@/lib/preciseLocation";

import { distanceKm, mapCenterForOrdering, nearestDirectory, orderByDistanceFrom } from "../../shared/nearbyDirectory.js";

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
// Filtrarea dupa tip se face in browser, pe punctele deja primite (~1.300 la 2026-09-28), iar o
// re-interogare la fiecare bifa ar fi mai lenta decat filtrarea locala.

function formatSnapshotDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
    : "ultima actualizare";
}

export default function DirectoryMap({ providerType = "", filterSummary }) {
  const [saved] = useState(() => readSearchSession().national || {});
  const scrollRestored = useRef(false);
  const [state, setState] = useState({ status: "loading", points: [], meta: null, error: "" });
  const type = providerType;
  const [origin, setOrigin] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoProgress, setGeoProgress] = useState(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const geoRequest = useRef(0);
  const geoCancel = useRef(null);
  const alive = useRef(true);
  // 2026-10-01. Pozitie de inalta precizie, rafinata cateva secunde (GPS pe telefon / tableta,
  // Wi-Fi pe laptop), fara pozitii din cache. Vezi lib/preciseLocation.js.
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus("unavailable"); return; }
    geoCancel.current?.();
    const requestId = ++geoRequest.current;
    setGeoStatus("loading");
    setGeoProgress(null);
    // Cat se precizeaza pozitia, vizitatorul vede precizia curenta; harta nu se muta pana la final.
    const search = locatePrecisely({ onProgress: (fix) => { if (alive.current && requestId === geoRequest.current) setGeoProgress(fix.accuracy); } });
    geoCancel.current = search.cancel;
    search.promise.then((fix) => {
      if (!alive.current || requestId !== geoRequest.current) return;
      if (fix.accuracy > MAX_USABLE_ACCURACY_M) { setGeoStatus("imprecise"); return; }
      setRadiusKm(fix.accuracy > 1000 ? 30 : 15);
      setOrigin({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, requestId });
      setSelectedId(null);
      setPageSize(24);
      setGeoStatus("ready");
    }).catch((error) => {
      if (error?.cancelled) return;
      if (alive.current && requestId === geoRequest.current) setGeoStatus(error?.code === 1 ? "denied" : "unavailable");
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    navigator.permissions?.query({ name: "geolocation" }).then((permission) => {
      // Do not interrupt a returning user's map exploration.
      if (alive.current && permission.state === "granted" && !readSearchSession().maps?.national) requestLocation();
    }).catch(() => {});
    return () => { alive.current = false; geoRequest.current += 1; geoCancel.current?.(); };
  }, [requestLocation]);
  const [retry, setRetry] = useState(0);
  const [visibleIds, setVisibleIds] = useState(null);
  const [pageSize, setPageSize] = useState(saved.pageSize || 24);
  // E2: alegerea explicita lista/harta (comuna cu /cauta pe o localitate); altfel harta.
  const [mobileView, setMobileView] = useState(() => readMobileViewChoice(saved.mobileView || "map"));
  const toggleMobileView = useCallback(() => setMobileView((view) => {
    const next = view === "map" ? "list" : "map";
    rememberMobileViewChoice(next);
    return next;
  }), []);
  // 2026-09-27. Cand harta e apropiata (de la zoom 9), lista urmeaza centrul hartii. Mutarile facute
  // de alegerea unei locatii (din lista sau de pe harta) nu reordoneaza lista, ca locatia aleasa sa
  // nu sara din locul in care vizitatorul tocmai a apasat-o.
  const [mapCenter, setMapCenter] = useState(null);
  const handleViewport = useCallback(({ visibleIds: ids, zoom, bounds, reason }) => {
    setVisibleIds(ids);
    if (reason === "selection") return;
    const next = mapCenterForOrdering(zoom, bounds);
    setMapCenter((current) => (current && next && current.lat === next.lat && current.lng === next.lng) || (!current && !next) ? current : next);
  }, []);
  const [selectedId, setSelectedId] = useState(saved.selectedId || null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    let active = true;
    let live = "pending";
    let snapshotBuiltAt = null;
    setState({ status: "loading", points: [], meta: null, error: "" });
    const show = (data, snapshotAt = null) => setState({
      status: "ready",
      points: Array.isArray(data?.results) ? data.results : [],
      meta: {
        total: Number(data?.total_published) || 0,
        withoutPosition: Number(data?.without_position) || 0,
      },
      error: "",
      snapshotAt,
    });
    // 2026-09-28 (audit /cauta, B6): fisierul static al hartii (scris la Publish) apare imediat;
    // lista actuala il inlocuieste cand soseste, fara sa mute harta (fitKey). Daca lista
    // actuala nu vine, harta ramane cu fisierul si spune de cand este.
    loadNationalMapSnapshot().then((snapshot) => {
      if (!active || !snapshot || live === "ok") return;
      snapshotBuiltAt = snapshot.snapshot_built_at;
      show(snapshot, live === "failed" ? snapshotBuiltAt : null);
    });
    // Incarcatorul comun reincearca singur la erori trecatoare (limita de trafic, 5xx) si tine
    // harta cateva minute; vizitatorul vede un mesaj clar, nu textul tehnic al erorii.
    loadNationalDirectoryMap({ force: retry > 0 })
      .then((data) => {
        live = "ok";
        if (active) show(data);
      })
      .catch(() => {
        live = "failed";
        if (!active) return;
        if (snapshotBuiltAt) {
          setState((current) => ({ ...current, snapshotAt: snapshotBuiltAt }));
          return;
        }
        setState({
          status: "error",
          points: [],
          meta: null,
          error: NATIONAL_MAP_ERROR_MESSAGE,
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
      window.scrollTo({ top: window.matchMedia("(min-width: 1024px)").matches ? 0 : readSearchSession().nationalScroll || 0, behavior: "instant" });
      scrollRestored.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.status]);
  // 2026-09-24. Pozitia se salveaza dupa ce derularea se opreste (si la plecarea de pe pagina),
  // nu la fiecare eveniment (vezi useRememberScroll; 2026-09-29, audit /cauta D3: comun cu /cauta).
  useRememberScroll((y) => {
    if (scrollRestored.current && !window.matchMedia("(min-width: 1024px)").matches) writeSearchSession({ nationalScroll: y });
  });

  const orderedPoints = useMemo(() => {
    if (origin) return nearestDirectory(visiblePoints, origin);
    if (!saved.nearbyOrder) return [...visiblePoints].sort((a,b) => String(a.city || "").localeCompare(String(b.city || ""), "ro") || String(a.name || "").localeCompare(String(b.name || ""), "ro") || String(a.id).localeCompare(String(b.id)));
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
  const centerOrder = !origin && Boolean(mapCenter);
  const inView = useMemo(() => {
    const ids = visibleIds === null ? null : new Set(visibleIds);
    const shown = ids ? orderedPoints.filter((point) => ids.has(point.id)) : orderedPoints;
    return centerOrder ? orderByDistanceFrom(shown, mapCenter) : shown;
  }, [orderedPoints, visibleIds, centerOrder, mapCenter]);
  // 2026-09-28 (audit /cauta, C4): numarul din zona vizibila se schimba la fiecare mutare a hartii.
  // Cititorul de ecran il primeste o singura data, dupa ce harta se opreste, nu la fiecare cadru.
  const [announcedCount, setAnnouncedCount] = useState(null);
  useEffect(() => {
    if (state.status !== "ready") return undefined;
    const timer = window.setTimeout(() => setAnnouncedCount(inView.length), 1200);
    return () => window.clearTimeout(timer);
  }, [inView.length, state.status]);
  // 2026-09-28 (audit /cauta, B7): aceeasi functie intre randari (randurile listei sunt memoizate).
  const renderPointCard = useCallback(
    (point, onShowMap) => <DirectoryResultCard location={point} onShowMap={onShowMap} distanceKm={origin ? distanceKm(origin, point) : null} />,
    [origin],
  );
  const selectedIndex = inView.findIndex((point) => point.id === selectedId);
  // 2026-09-28 (audit /cauta, B8): o locatie aleasa pe harta dincolo de pagina curenta se afiseaza
  // prima, ca pe /cauta la rasfoirea unei localitati. Inainte lista se extindea pana la ea: un pin
  // de pe pozitia 800 randa 800 de carduri deodata.
  const selectedOutsidePage = selectedIndex >= pageSize;
  const listedPoints = useMemo(() => {
    const page = inView.slice(0, pageSize);
    return selectedIndex >= pageSize ? [inView[selectedIndex], ...page] : page;
  }, [inView, pageSize, selectedIndex]);

  const geoMessage = geoStatus === "denied" ? "Accesul la locație nu este permis. Alege localitatea din bara de căutare." : geoStatus === "unavailable" ? "Poziția nu este disponibilă momentan. Încearcă din nou sau alege localitatea." : geoStatus === "imprecise" ? "Poziția este prea aproximativă. Alege localitatea pentru rezultate utile." : "";
  const listHeader = <div className="mb-4">
      <h2 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
        {origin || saved.nearbyOrder || centerOrder ? "Locații în zona explorată" : "Explorează România"}
      </h2>
      <details className="group mt-1 text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          <span>{inView.length} {inView.length === 1 ? "locație" : "locații"} în zona vizibilă</span>
          <span className="inline-flex items-center gap-1 text-xs text-[#4f6080]">Despre rezultate <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-secondary/50 p-3 text-xs leading-relaxed">
          <p>{origin ? "Ordine: apropiere de poziția dispozitivului." : centerOrder ? "Ordine: apropiere de centrul hărții. Mută harta și lista se reordonează." : saved.nearbyOrder ? "Ordine: apropiere de ultima poziție folosită în această sesiune." : "Ordine: localitate, apoi numele locației."}</p>
          <p>Lista urmărește zona vizibilă pe hartă. Pozițiile pot fi aproximative; verifică adresa din profil.</p>
          {state.meta?.withoutPosition > 0 && <p>{state.meta.withoutPosition === 1 ? "O locație din director nu are poziție publicată. O poți găsi alegând localitatea." : `${state.meta.withoutPosition} locații din director nu au poziție publicată. Le poți găsi alegând localitatea.`}</p>}
        </div>
      </details>
      {selectedOutsidePage && <p className="mt-2 text-xs text-[#4f6080]">Locația aleasă pe hartă este afișată prima.</p>}
      <p aria-live="polite" className="sr-only">{announcedCount === null ? "" : `${announcedCount} ${announcedCount === 1 ? "locație" : "locații"} în zona vizibilă`}</p>
      {state.snapshotAt && <p role="status" className="mt-2 text-xs leading-relaxed text-[#8a4b2a]">
        Harta arată locațiile din {formatSnapshotDate(state.snapshotAt)}. Lista actuală nu s-a putut încărca acum.{" "}
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Reîncearcă</button>
      </p>}
      {geoMessage && <p role="status" className="mt-2 text-sm text-muted-foreground">{geoMessage}</p>}
      {origin && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {origin.accuracy != null && <span role="status">{accuracyNote(origin.accuracy)}</span>}
        <span>Zonă inițială: aprox. {radiusKm} km.</span>
        {radiusKm < 60 && <button type="button" onClick={() => setRadiusKm((radius) => radius * 2)} className="min-h-11 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary">Extinde la {radiusKm * 2} km</button>}
      </div>}
      {filterSummary}
    </div>;

  return (
    <section aria-label="Explorează locațiile pe hartă" className="mt-3">
      {/* 2026-09-24. Pe telefon, cat se incarca directorul, locul are deja inaltimea hartii (70vh +
          spatiul de deasupra ei), ca nota de sub harta sa nu fie impinsa in jos cand apare harta. */}
      <div className="min-h-[max(24rem,calc(70vh+0.75rem))] lg:min-h-[24rem]">
        {state.status === "loading" && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Se încarcă directorul...
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
              <MapPin aria-hidden="true" className="mx-auto h-5 w-5 text-muted-foreground" />
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
            <LocationsWithMap
              fixedDesktop
              listHeader={listHeader}
              mapActions={<button type="button" onClick={requestLocation} disabled={geoStatus === "loading"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c9d3e3] bg-white shadow-md px-5 text-sm font-semibold text-[#4f6080] hover:bg-[#dce4f2] disabled:opacity-60">
            {geoStatus === "loading" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="h-4 w-4" />}
            {geoStatus === "loading" ? (geoProgress ? `Se precizează poziția (${formatAccuracy(geoProgress)})...` : "Se caută poziția...") : "În apropierea mea"}
          </button>}
              mapStatus={geoMessage}
              results={visiblePoints}
              listResults={listedPoints}
              renderCard={renderPointCard}
              listLayout="grid"
              integratedMapAction
              focusArea={focusArea}
              userLocation={origin}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={toggleMobileView}
              onViewportChange={handleViewport}
              storageKey="national"
              // 2026-09-30: cheia nu mai depinde de tipul ales. Filtrul de tip ascunde sau arata puncte,
              // dar nu muta harta (ca pe Airbnb): vizitatorul ramane in zona pe care o priveste. Camera se
              // incadreaza o singura data, la deschidere, sau se reia din sesiune / din „Caută în această
              // zonă” (vezi Search.jsx).
              fitKey="national"
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