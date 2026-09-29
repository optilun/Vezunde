import { clusterSharesPosition, shortTypeLabel } from "../../../shared/resultsMapLabels.js";
import { pillHtml, layoutMapMarkers } from "../../../shared/mapMarkerPresentation.js";
import "./mapMarkers.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLocationCard from "./MapLocationCard";
import MapClusterList from "./MapClusterList";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  boundsForPoints,
  buildResultsMapModel,
  clusterExpansionZoom,
  clusterIndividualZoom,
  clusterPoints,
  framingForPoints,
  pointIdsWithinBounds,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import { requestMapCardFocus } from "@/lib/mapCardFocus";
import { readVisitedProfiles } from "@/lib/visitedProfiles";
import { withCartoApiKey } from "@/lib/cartoBasemap";

// 2026-09-27: dalele Leaflet au 256 px (MapLibre are 512), deci gruparea pe ecran trebuie sa stie.
const LEAFLET_TILE = { tileSize: 256 };
// 2026-09-29 (audit /cauta, D1): pragul la care un grup nu se mai apropie, ci se deschide ca lista
// (16 pe Leaflet = 15 pe harta vectoriala). Inainte era 15 scris direct aici.
const LEAFLET_INDIVIDUAL_ZOOM = clusterIndividualZoom(LEAFLET_TILE);

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

// 2026-09-29 (audit /cauta, D1): iconita fiecarui marker se refolosea doar daca arata la fel. Inainte
// se crea una noua la fiecare randare, iar Leaflet rescria toate markerele la fiecare hover.
const ICON_CACHE = new Map();
const ICON_CACHE_LIMIT = 3000;
function clusterIcon(cluster, state) {
  const html = pillHtml(cluster, state);
  const cached = ICON_CACHE.get(html);
  if (cached) return cached;
  if (ICON_CACHE.size >= ICON_CACHE_LIMIT) ICON_CACHE.clear();
  const width = 44;
  const icon = L.divIcon({
    className: "viasee-map-pill",
    html,
    iconSize: [width, 44],
    iconAnchor: [width / 2, 22],
  });
  ICON_CACHE.set(html, icon);
  return icon;
}

function pointsSignature(points) {
  return points.map((point) => `${point.id}:${point.lat}:${point.lng}`).sort().join("|");
}

// Incadreaza harta pe rezultate. Ruleaza doar cand se schimba SETUL de puncte, nu si cand
// pacientul selecteaza sau trece cu mouse-ul peste un card - altfel harta ar sari mereu inapoi.
// 2026-09-29 (audit /cauta, D1): semnatura vine calculata o data per set de puncte (ca pe harta
// vectoriala), nu la fiecare randare.
function FitToPoints({ points, signature, storageKey }) {
  const map = useMap();
  const fittedSignature = useRef(null);

  useEffect(() => {
    if (fittedSignature.current === signature) return;
    const initial = fittedSignature.current === null;
    fittedSignature.current = signature;
    const saved = storageKey ? readSearchSession().maps?.[storageKey] : null;
    if (initial && saved?.signature === signature && saved.bounds) {
      map.fitBounds(saved.bounds, { animate: false });
      return;
    }
    if (points.length === 0) {
      map.fitBounds([[43.6,20.2],[48.3,29.8]], { padding: [24,24], animate: false });
      return;
    }
    // 2026-09-27: ca pe harta vectoriala, coordonatele aberante nu departeaza harta. Zoomul Leaflet
    // (dale de 256 px) este cu 1 mai mare decat cel MapLibre: 14 aici = 13 acolo.
    const framing = framingForPoints(points);
    if (framing.points.length === 1) {
      map.setView([framing.points[0].lat, framing.points[0].lng], framing.maxZoom + 1);
      return;
    }
    const bounds = boundsForPoints(framing.points);
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: framing.maxZoom + 1 });
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
  }, [point?.id, point?.lat, point?.lng, map]);
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


export default function ResultsMap({
  results,
  fitResults = null,
  selectedId = null,
  hoveredId = null,
  onSelect = null,
  onHover = null,
  onViewportChange = null,
  className = "",
  storageKey = null,
  focusArea = null,
  rankById = null,
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  const [visited] = useState(readVisitedProfiles);
  const mapPoints = useMemo(() => {
    if (!rankById && visited.size === 0) return model.points;
    return model.points.map((point) => {
      const rank = rankById?.get(point.id) || null;
      const seen = visited.has(point.id);
      return rank || seen ? { ...point, map_rank: rank, visited: seen } : point;
    });
  }, [model.points, rankById, visited]);
  const fitModel = useMemo(() => fitResults === null ? model : buildResultsMapModel(fitResults), [fitResults, model]);
  const [viewport, setViewport] = useState({ zoom: FALLBACK_ZOOM, bounds: null });
  const [openClusterKey, setOpenClusterKey] = useState(null);
  const selectedPoint = model.points.find((point) => point.id === selectedId) || null;
  const notice = unmappedNotice(model.unmappedCount);

  const clusters = useMemo(
    () => clusterPoints(mapPoints, viewport.zoom, LEAFLET_TILE),
    [mapPoints, viewport.zoom],
  );

  const openCluster = clusters.find((cluster) => cluster.key === openClusterKey && cluster.count > 1);

  // Dreptunghiul vizibil se raporteaza in sus ca lista sa poata fi filtrata la ce se vede.
  // Se trimit ID-URI, nu un criteriu de cautare: serverul nu este intrebat nimic din nou.
  const fitSignature = useMemo(() => pointsSignature(fitModel.points), [fitModel.points]);
  const reportViewport = useCallback((next) => {
    setViewport(next);
    if (storageKey) {
      const maps = readSearchSession().maps || {};
      writeSearchSession({ maps: { ...maps, [storageKey]: { signature: fitSignature, bounds: next.bounds } } });
    }
  }, [fitSignature, storageKey]);

  // Marker data can arrive without camera movement (national directory, coordinate overlay).
  useEffect(() => {
    if (!viewport.bounds) return;
    onViewportChange?.({
      ...viewport,
      visibleIds: pointIdsWithinBounds(model.points, viewport.bounds),
      mappedCount: model.mappedCount,
    });
  }, [viewport, model.points, model.mappedCount, onViewportChange]);

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
        <FitToPoints points={fitModel.points} signature={fitSignature} storageKey={storageKey} />
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
                    if (map && (map.getZoom() >= LEAFLET_INDIVIDUAL_ZOOM || clusterSharesPosition(cluster))) {
                      if (onSelect) onSelect(null);
                      setOpenClusterKey(cluster.key);
                    } else if (map) {
                      // Ca pe harta vectoriala: apropiere centrata pe grup, pana se desface.
                      setOpenClusterKey(null);
                      const current = map.getZoom();
                      const target = Math.min(17, Math.max(current + 1, clusterExpansionZoom(cluster.points, current, LEAFLET_TILE)));
                      map.setView([cluster.lat, cluster.lng], target);
                    }
                    return;
                  }
                  setOpenClusterKey(null);
                  requestMapCardFocus();
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
        <MapClusterList cluster={openCluster} onClose={() => setOpenClusterKey(null)} onSelect={onSelect} />
      )}

      {selectedPoint && (
        <MapLocationCard point={selectedPoint} onClose={() => { if (onSelect) onSelect(null); }} />
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