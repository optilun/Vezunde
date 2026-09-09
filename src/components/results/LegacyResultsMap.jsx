import { clusterSharesPosition } from "../../../shared/resultsMapLabels.js";
import { pillHtml, layoutMapMarkers } from "../../../shared/mapMarkerPresentation.js";
import "./mapMarkers.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  boundsForPoints,
  buildResultsMapModel,
  clusterPoints,
  pointIdsWithinBounds,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
import LocationThumb, { typeVisual } from "@/components/results/LocationThumb";
import TrustBadge from "@/components/results/TrustBadge";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import { withCartoApiKey } from "@/lib/cartoBasemap";

// Harta rezultatelor, in stilul hartilor de cautare (Airbnb, Booking).
//
// 2026-09-05. Ce am preluat din pattern-ul lor, si de ce:
//
//   - pastila in loc de pin. Un pin spune doar "aici e ceva". Pastila spune CE e, deci harta
//     devine citibila fara sa apesi pe nimic. La ei scrie pretul; la noi scrie tipul locatiei,
//     pentru ca aia e informatia dupa care alege un pacient: optica, clinica sau cabinet;
//   - grupare la zoom mic. Fara ea, locatiile de pe aceeasi strada se acopera si dispar din
//     ochii pacientului fara ca cineva sa observe;
//   - sincronizare in ambele sensuri, inclusiv pe hover. Treci peste un card, pastila lui se
//     ridica; treci peste o pastila, cardul se evidentiaza;
//   - tile-uri neutre, ca harta sa nu se bata cu continutul.
//
// Ce NU am preluat: "cauta in zona asta" ca re-interogare. La ei viewportul ESTE cautarea. La noi
// cautarea e definita de localitate si de aria aleasa de pacient, iar rezultatele vin deja
// clasate de server. O re-interogare dupa dreptunghiul hartii ar insemna alt criteriu de
// potrivire decat cel pe care pacientul l-a ales. Butonul de aici doar FILTREAZA vizual lista la
// ce se vede - nu cere nimic de la server si nu schimba ordinea.
//
// Tile-urile sunt CARTO "light" peste date OpenStreetMap. Atributia pentru ambele este
// obligatorie si e afisata de Leaflet in coltul hartii.

// Stilul raster ramane cel folosit pana acum (light_all). Se adauga doar cheia CARTO,
// conform cerintei oficiale pentru rastertiles - vezi src/lib/cartoBasemap.js.
const TILE_URL = withCartoApiKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const SHORT_TYPE_LABELS = {
  optica_medicala: "Optică",
  cabinet_optometric: "Optometrie",
  clinica_oftalmologica: "Clinică",
  cabinet_oftalmologic: "Cabinet",
  laborator_optic: "Laborator",
};

function shortTypeLabel(providerType) {
  return SHORT_TYPE_LABELS[providerType] || "Locație";
}

function clusterIcon(cluster, state) {
  const width = 44;
  return L.divIcon({
    className: "viasee-map-pill",
    html: pillHtml(cluster, state),
    iconSize: [width, 44],
    iconAnchor: [width / 2, 22],
  });
}

// Incadreaza harta pe rezultate. Ruleaza doar cand se schimba SETUL de puncte, nu si cand
// pacientul selecteaza sau trece cu mouse-ul peste un card - altfel harta ar sari mereu inapoi.
function FitToPoints({ points, storageKey }) {
  const map = useMap();
  const signature = points.map((point) => `${point.id}:${point.lat}:${point.lng}`).sort().join("|");
  const fittedSignature = useRef(null);

  useEffect(() => {
    if (fittedSignature.current === signature) return;
    if (points.length === 0) {
      fittedSignature.current = signature;
      map.fitBounds([[43.6,20.2],[48.3,29.8]], { padding: [24,24], animate: false });
      return;
    }
    const initial = fittedSignature.current === null;
    fittedSignature.current = signature;
    const saved = storageKey ? readSearchSession().maps?.[storageKey] : null;
    if (initial && saved?.signature === signature && saved.bounds) {
      map.fitBounds(saved.bounds, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = boundsForPoints(points);
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [signature, map, points, storageKey]);

  return null;
}

// Cand pacientul apasa un card din lista, harta se muta pe pozitia lui, fara sa schimbe zoom-ul.
function FocusArea({ area }) {
  const map = useMap();
  useEffect(() => {
    if (area?.bounds) map.fitBounds(area.bounds, { padding: [40, 40], maxZoom: 13, animate: false });
  }, [area, map]);
  return null;
}

function PanToSelected({ point }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.panTo([point.lat, point.lng], { animate: true, duration: 0.4 });
  }, [point, map]);
  return null;
}

// Urmareste zoom-ul si dreptunghiul vizibil. Zoom-ul decide gruparea, dreptunghiul alimenteaza
// filtrarea vizuala a listei.
function MapResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);
  return null;
}

function MarkerLabelLayout({ clusters, selectedId, hoveredId }) {
  const map = useMap();
  useEffect(() => {
    let frame;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layoutMapMarkers(map.getContainer()));
    };
    map.on("moveend zoomend resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); map.off("moveend zoomend resize", schedule); };
  }, [map, clusters, selectedId, hoveredId]);
  return null;
}

function ViewportWatcher({ onChange }) {
  const map = useMapEvents({
    zoomend: () => report(),
    moveend: () => report(),
  });

  function report() {
    const bounds = map.getBounds();
    onChange({
      zoom: map.getZoom(),
      bounds: [
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()],
      ],
    });
  }

  useEffect(() => {
    report();
  }, []);

  return null;
}

function PointCard({ point, onClose }) {
  const route = useLocation();
  const returnState = route.pathname === "/rezultate" ? { resultsReturn: route.state } : undefined;
  const visual = typeVisual(point.provider_type);
  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] max-h-[55%] overflow-y-auto rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-start gap-3">
        <LocationThumb name={point.name} providerType={point.provider_type} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{visual.label}</div>
          <p className="mt-0.5 font-heading text-sm font-bold leading-tight text-foreground">{point.name}</p>
          {point.address && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.address}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TrustBadge status={point.profile_control_status} />
            {point.map_precision !== "exact" && (
              <span className="text-[10px] font-medium text-muted-foreground">Poziție aproximativă</span>
            )}
          </div>
          <Link
            to={`/furnizor/${point.id}`} state={returnState}
            className="mt-2.5 inline-flex min-h-11 items-center text-xs font-semibold text-foreground underline underline-offset-4"
          >
            Vezi profilul
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function ResultsMap({
  results,
  selectedId = null,
  hoveredId = null,
  onSelect = null,
  onHover = null,
  onViewportChange = null,
  className = "",
  storageKey = null,
  focusArea = null,
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  const [viewport, setViewport] = useState({ zoom: FALLBACK_ZOOM, bounds: null });
  const [openClusterKey, setOpenClusterKey] = useState(null);
  const selectedPoint = model.points.find((point) => point.id === selectedId) || null;
  const notice = unmappedNotice(model.unmappedCount);

  const clusters = useMemo(
    () => clusterPoints(model.points, viewport.zoom),
    [model.points, viewport.zoom],
  );

  const openCluster = clusters.find((cluster) => cluster.key === openClusterKey && cluster.count > 1);

  // Dreptunghiul vizibil se raporteaza in sus ca lista sa poata fi filtrata la ce se vede.
  // Se trimit ID-URI, nu un criteriu de cautare: serverul nu este intrebat nimic din nou.
  const reportViewport = useCallback((next) => {
    setViewport(next);
    if (storageKey) {
      const maps = readSearchSession().maps || {};
      const signature = model.points.map((point) => `${point.id}:${point.lat}:${point.lng}`).sort().join("|");
      writeSearchSession({ maps: { ...maps, [storageKey]: { signature, bounds: next.bounds } } });
    }
    if (onViewportChange) {
      onViewportChange({
        ...next,
        visibleIds: pointIdsWithinBounds(model.points, next.bounds),
        mappedCount: model.mappedCount,
      });
    }
  }, [model.points, model.mappedCount, onViewportChange, storageKey]);

  const mapRef = useRef(null);

  // Keep the basemap navigable even when no result has public coordinates.

  return (
    <div className={`relative isolate ${className}`}>
      <MapContainer
        center={[FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]}
        zoom={FALLBACK_ZOOM}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        aria-label="Harta opțiunilor găsite"
        ref={mapRef}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPoints points={model.points} storageKey={storageKey} />
        <FocusArea area={focusArea} />
        <PanToSelected point={selectedPoint} />
        <ViewportWatcher onChange={reportViewport} />
        <MapResizeWatcher />
        <MarkerLabelLayout clusters={clusters} selectedId={selectedId} hoveredId={hoveredId} />

        {clusters.map((cluster) => {
          const containsSelected = cluster.points.some((point) => point.id === selectedId);
          const containsHovered = cluster.points.some((point) => point.id === hoveredId);
          return (
            <Marker
              key={cluster.key}
              position={[cluster.lat, cluster.lng]}
              ref={(marker) => {
                const element = marker?.getElement();
                if (element) {
                  element.setAttribute("aria-label", cluster.count > 1 ? `Explorează grupul de ${cluster.count} locații` : `${cluster.lead.name}, ${shortTypeLabel(cluster.lead.provider_type)}`);
                  element.setAttribute("aria-pressed", containsSelected ? "true" : "false");
                }
              }}
              title={cluster.count > 1 ? `${cluster.count} locații` : cluster.lead.name}
              alt={cluster.count > 1 ? `${cluster.count} locații` : cluster.lead.name}
              icon={clusterIcon(cluster, { active: containsSelected, hovered: containsHovered })}
              zIndexOffset={containsSelected ? 1000 : (cluster.lead.tier === "top3" ? 500 : 0)}
              eventHandlers={{
                click: () => {
                  if (cluster.count > 1) {
                    // Un grup nu se "alege": se desface. Altfel pacientul ar crede ca a vazut
                    // o locatie cand de fapt sunt mai multe sub aceeasi pastila.
                    const map = mapRef.current;
                    if (map && (map.getZoom() >= 15 || clusterSharesPosition(cluster))) {
                      if (onSelect) onSelect(null);
                      setOpenClusterKey(cluster.key);
                    } else if (map) {
                      setOpenClusterKey(null);
                      const bounds = boundsForPoints(cluster.points);
                      if (bounds) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
                    }
                    return;
                  }
                  setOpenClusterKey(null);
                  if (onSelect) onSelect(cluster.lead.id);
                },
                mouseover: () => { if (onHover && cluster.count === 1) onHover(cluster.lead.id); },
                mouseout: () => { if (onHover) onHover(null); },
              }}
            />
          );
        })}
      </MapContainer>

      {openCluster && !selectedPoint && (
        <section aria-label="Locații din grup"
          className="absolute inset-x-3 bottom-3 z-[500] max-h-[60%] overflow-y-auto rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{openCluster.count} locații în acest grup</h2>
            <button type="button" aria-label="Închide lista locațiilor" onClick={() => setOpenClusterKey(null)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary">×</button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Mai multe profiluri sunt grupate pe hartă. Coordonatele pot fi aproximative; verifică adresa fiecăruia.</p>
          <ul className="divide-y divide-border">
            {openCluster.points.map((point) => (
              <li key={point.id}>
                <button type="button" onClick={() => { setOpenClusterKey(null); if (onSelect) onSelect(point.id); }}
                  className="min-h-11 w-full rounded-lg px-2 py-3 text-left hover:bg-secondary focus-visible:outline focus-visible:outline-2">
                  <span className="block text-sm font-semibold">{point.name}</span>
                  <span className="block text-xs text-muted-foreground">{shortTypeLabel(point.provider_type)}{point.address ? ` · ${point.address}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedPoint && (
        <PointCard point={selectedPoint} onClose={() => { if (onSelect) onSelect(null); }} />
      )}

      {/* Ce nu se vede pe harta se scrie pe ea. O harta care pare completa cand nu este face mai
          mult rau decat una care isi declara limitele. */}
      {notice && (
        <div className="pointer-events-none absolute left-16 right-3 top-16 z-[500]">
          <p className="inline-block rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm">
            {notice}
          </p>
        </div>
      )}
    </div>
  );
}