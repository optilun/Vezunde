import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
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

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pastila. Trei stari vizuale, cu aceleasi tokenuri ca restul aplicatiei:
// Top 3 plina, confirmata alba cu contur inchis, din director gri discreta.
function pillHtml(cluster, { active, hovered }) {
  const { lead, count } = cluster;
  const raised = active || hovered;
  const isTop3 = lead.tier === "top3";
  const isDirectory = lead.tier === "directory";

  const background = isTop3 ? "hsl(var(--primary))" : "hsl(var(--card))";
  const color = isTop3 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))";
  const border = isTop3
    ? "hsl(var(--primary))"
    : (isDirectory ? "hsl(var(--border))" : "hsl(var(--foreground))");

  const label = count > 1
    ? `${count} locații`
    : (isTop3 && lead.bucket_rank ? `${lead.bucket_rank}. ${shortTypeLabel(lead.provider_type)}` : shortTypeLabel(lead.provider_type));

  // Pozitia aproximativa primeste un contur intrerupt. Diferenta fata de una confirmata trebuie
  // sa se vada pe harta, nu doar sa fie scrisa undeva sub ea.
  const approximate = count === 1 && lead.map_precision !== "exact";
  const borderStyle = approximate ? "dashed" : "solid";

  return `<span style="
    display:inline-flex;align-items:center;white-space:nowrap;
    padding:${raised ? "5px 11px" : "4px 10px"};border-radius:9999px;
    background:${background};color:${color};
    border:1.5px ${borderStyle} ${raised ? "hsl(var(--foreground))" : border};
    box-shadow:0 ${raised ? "4px 12px" : "1px 4px"} rgba(23,23,23,${raised ? "0.24" : "0.12"});
    font-family:inherit;font-size:${raised ? "12px" : "11px"};font-weight:700;line-height:1.2;
    transform:translateY(${raised ? "-2px" : "0"});
    transition:transform .12s ease,padding .12s ease,box-shadow .12s ease;
  ">${escapeHtml(label)}</span>`;
}

function clusterIcon(cluster, state) {
  const width = cluster.count > 1 ? 84 : 74;
  return L.divIcon({
    className: "viasee-map-pill",
    html: pillHtml(cluster, state),
    iconSize: [width, 24],
    iconAnchor: [width / 2, 12],
  });
}

// Incadreaza harta pe rezultate. Ruleaza doar cand se schimba SETUL de puncte, nu si cand
// pacientul selecteaza sau trece cu mouse-ul peste un card - altfel harta ar sari mereu inapoi.
function FitToPoints({ points }) {
  const map = useMap();
  const signature = points.map((point) => point.id).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = boundsForPoints(points);
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [signature, map, points]);

  return null;
}

// Cand pacientul apasa un card din lista, harta se muta pe pozitia lui, fara sa schimbe zoom-ul.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function PointCard({ point, onClose }) {
  const visual = typeVisual(point.provider_type);
  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-start gap-3">
        <LocationThumb name={point.name} providerType={point.provider_type} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{visual.label}</div>
          <p className="mt-0.5 font-display text-sm font-bold leading-tight text-foreground">{point.name}</p>
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
            to={`/furnizor/${point.id}`}
            className="mt-2.5 inline-flex text-xs font-semibold text-foreground underline underline-offset-4"
          >
            Vezi profilul
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
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
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  const [viewport, setViewport] = useState({ zoom: FALLBACK_ZOOM, bounds: null });
  const selectedPoint = model.points.find((point) => point.id === selectedId) || null;
  const notice = unmappedNotice(model.unmappedCount);

  const clusters = useMemo(
    () => clusterPoints(model.points, viewport.zoom),
    [model.points, viewport.zoom],
  );

  // Dreptunghiul vizibil se raporteaza in sus ca lista sa poata fi filtrata la ce se vede.
  // Se trimit ID-URI, nu un criteriu de cautare: serverul nu este intrebat nimic din nou.
  const reportViewport = useCallback((next) => {
    setViewport(next);
    if (onViewportChange) {
      onViewportChange({
        ...next,
        visibleIds: pointIdsWithinBounds(model.points, next.bounds),
        mappedCount: model.mappedCount,
      });
    }
  }, [model.points, model.mappedCount, onViewportChange]);

  const mapRef = useRef(null);

  if (model.points.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center ${className}`}>
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-foreground">Harta nu are ce afișa încă</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {model.unmappedCount > 0
              ? "Opțiunile găsite nu au încă o poziție publicată. Adresa completă apare pe fiecare profil."
              : "Nu există opțiuni de afișat pentru această căutare."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={[FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]}
        zoom={FALLBACK_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        aria-label="Harta opțiunilor găsite"
        ref={mapRef}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPoints points={model.points} />
        <PanToSelected point={selectedPoint} />
        <ViewportWatcher onChange={reportViewport} />

        {clusters.map((cluster) => {
          const containsSelected = cluster.points.some((point) => point.id === selectedId);
          const containsHovered = cluster.points.some((point) => point.id === hoveredId);
          return (
            <Marker
              key={cluster.key}
              position={[cluster.lat, cluster.lng]}
              icon={clusterIcon(cluster, { active: containsSelected, hovered: containsHovered })}
              zIndexOffset={containsSelected ? 1000 : (cluster.lead.tier === "top3" ? 500 : 0)}
              eventHandlers={{
                click: () => {
                  if (cluster.count > 1) {
                    // Un grup nu se "alege": se desface. Altfel pacientul ar crede ca a vazut
                    // o locatie cand de fapt sunt mai multe sub aceeasi pastila.
                    const map = mapRef.current;
                    if (map) map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 3, 17));
                    return;
                  }
                  if (onSelect) onSelect(cluster.lead.id);
                },
                mouseover: () => { if (onHover && cluster.count === 1) onHover(cluster.lead.id); },
                mouseout: () => { if (onHover) onHover(null); },
              }}
            />
          );
        })}
      </MapContainer>

      {selectedPoint && (
        <PointCard point={selectedPoint} onClose={() => { if (onSelect) onSelect(null); }} />
      )}

      {/* Ce nu se vede pe harta se scrie pe ea. O harta care pare completa cand nu este face mai
          mult rau decat una care isi declara limitele. */}
      {notice && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500]">
          <p className="inline-block rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm">
            {notice}
          </p>
        </div>
      )}
    </div>
  );
}
