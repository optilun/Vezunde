import React, { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  boundsForPoints,
  buildResultsMapModel,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
import { typeVisual } from "@/components/results/LocationThumb";

// Harta rezultatelor.
//
// 2026-09-04. Tile-urile sunt CARTO "light" peste date OpenStreetMap: aceeasi sursa de date ca
// OSM, dar cu un stil neutru care nu se bate cu paleta calda a aplicatiei. Atributia pentru
// ambele este obligatorie si este afisata de Leaflet in coltul hartii.
//
// Pinii NU folosesc iconita implicita Leaflet (care oricum se strica sub bundler). Sunt divIcon
// stilizate cu tokenurile aplicatiei, iar forma lor poarta informatie: numarul din Top 3 se
// vede pe pin, restul sunt puncte. Asa harta si lista spun acelasi lucru, nu doua lucruri.
//
// Nota despre volum: tile-urile publice sunt potrivite pentru traficul de acum. Daca traficul
// creste, pasul urmator este un furnizor de tile-uri cu plan propriu sau tile-uri gazduite de
// noi - nu o schimbare de biblioteca.

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const TIER_STYLE = {
  top3: {
    background: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    border: "hsl(var(--primary))",
    size: 30,
  },
  confirmed: {
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
    border: "hsl(var(--foreground))",
    size: 24,
  },
  directory: {
    background: "hsl(var(--secondary))",
    color: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
    size: 22,
  },
};

function markerIcon(point, active) {
  const style = TIER_STYLE[point.tier] || TIER_STYLE.directory;
  const size = active ? style.size + 8 : style.size;
  const label = point.tier === "top3" && point.bucket_rank ? String(point.bucket_rank) : "";
  return L.divIcon({
    className: "viasee-map-pin",
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${style.background};color:${style.color};
      border:2px solid ${active ? "hsl(var(--foreground))" : style.border};
      box-shadow:0 2px 8px rgba(23,23,23,${active ? "0.28" : "0.14"});
      font-family:inherit;font-size:12px;font-weight:700;line-height:1;
      transition:width .12s ease,height .12s ease;
    ">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Incadreaza harta pe rezultate. Ruleaza doar cand se schimba setul de puncte, nu si cand
// pacientul selecteaza un card - altfel harta ar sari inapoi la fiecare click.
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
    if (bounds) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }, [signature, map]);

  return null;
}

// Cand pacientul apasa un card din lista, harta se muta pe pinul lui, fara sa schimbe zoom-ul.
function PanToSelected({ point }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.panTo([point.lat, point.lng], { animate: true, duration: 0.4 });
  }, [point, map]);
  return null;
}

export default function ResultsMap({
  results,
  selectedId = null,
  onSelect = null,
  className = "",
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  const selectedPoint = model.points.find((point) => point.id === selectedId) || null;
  const notice = unmappedNotice(model.unmappedCount);
  const markerRefs = useRef({});

  // Popup-ul urmareste selectia din lista, ca sa fie evident care pin corespunde cardului ales.
  useEffect(() => {
    const marker = selectedId ? markerRefs.current[selectedId] : null;
    if (marker) marker.openPopup();
  }, [selectedId]);

  if (model.points.length === 0) {
    return (
      <div className={`rounded-3xl border border-dashed border-border bg-secondary/20 p-6 text-center ${className}`}>
        <p className="text-sm font-semibold text-foreground">Harta nu are ce afișa încă</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {model.unmappedCount > 0
            ? "Opțiunile găsite sunt profiluri din director, iar poziția lor exactă nu este publicată. Adresa completă apare pe fiecare profil."
            : "Nu există opțiuni de afișat pentru această căutare."}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-3xl border border-border">
        <MapContainer
          center={[FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]}
          zoom={FALLBACK_ZOOM}
          scrollWheelZoom={false}
          className="h-[320px] w-full lg:h-[52vh]"
          aria-label="Harta opțiunilor găsite"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <FitToPoints points={model.points} />
          <PanToSelected point={selectedPoint} />

          {model.points.map((point) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={markerIcon(point, point.id === selectedId)}
              ref={(instance) => { markerRefs.current[point.id] = instance; }}
              eventHandlers={{
                click: () => { if (onSelect) onSelect(point.id); },
              }}
            >
              <Popup>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {typeVisual(point.provider_type).label}
                </span>
                <strong className="mt-0.5 block font-display text-sm leading-tight text-foreground">
                  {point.name}
                </strong>
                {point.city && <span className="mt-0.5 block text-xs text-muted-foreground">{point.city}</span>}
                <Link
                  to={`/furnizor/${point.id}`}
                  className="mt-2 inline-flex text-xs font-semibold text-foreground underline underline-offset-4"
                >
                  Vezi profilul
                </Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Ce nu se vede pe harta se scrie sub ea. O harta care pare completa cand nu este face mai
          mult rau decat una care isi declara limitele. */}
      {notice && (
        <p className="mt-2.5 px-1 text-xs leading-relaxed text-muted-foreground">{notice}</p>
      )}
    </div>
  );
}
