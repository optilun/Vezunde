import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "../results/mapMarkers.css";
import { pillHtml } from "../../../shared/mapMarkerPresentation.js";
import { locationCoordinates } from "../../../shared/locationMapPosition.js";
import { MAP_STYLE_URL, MAP_STYLE_FALLBACK_URL, transformMapStyle } from "@/lib/viaseeMapStyle";

function markerContent(location) {
  const lead = { ...location, name: location.public_display_name || location.name || "Locație" };
  return pillHtml({ key: "location-pin", count: 1, lead }, { active: true });
}

export default function LocationPinVectorCanvas({ location, onPositionChange, onFailure }) {
  const host = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const latest = useRef({});
  latest.current = { location, onPositionChange, onFailure };
  const [ready, setReady] = useState(false);
  const position = locationCoordinates(location);
  const editable = Boolean(onPositionChange);

  useEffect(() => {
    let map, observer, timer;
    try {
      const initial = locationCoordinates(latest.current.location);
      map = new maplibregl.Map({
        container: host.current, center: initial ? [initial.lng, initial.lat] : [24.9, 45.9],
        zoom: initial ? 16 : 6, maxZoom: 19, scrollZoom: false,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.setStyle(MAP_STYLE_URL, { transformStyle: (_old, next) => transformMapStyle(next) });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      map.getCanvas().setAttribute("aria-label", "Hartă VIASEE. Folosește butoanele de zoom pentru detalii.");
      let styleReady = false, triedFallback = false;
      map.on("load", () => { styleReady = true; clearTimeout(timer); });
      map.on("error", event => {
        const message = String(event.error?.url || event.error?.message || "");
        if (!styleReady && !triedFallback && message.includes("/styles/positron")) {
          triedFallback = true; map.setStyle(MAP_STYLE_FALLBACK_URL);
        }
      });
      map.on("webglcontextlost", () => latest.current.onFailure());
      map.on("click", event => {
        if (!latest.current.onPositionChange || event.originalEvent?.target?.closest?.(".viasee-map-pill")) return;
        latest.current.onPositionChange({ lat: Number(event.lngLat.lat.toFixed(6)), lng: Number(event.lngLat.lng.toFixed(6)) });
      });
      timer = setTimeout(() => { if (!styleReady) latest.current.onFailure(); }, 15000);
      observer = new ResizeObserver(() => map.resize());
      observer.observe(host.current);
      setReady(true);
    } catch { latest.current.onFailure(); }
    return () => {
      clearTimeout(timer); observer?.disconnect(); markerRef.current?.remove(); markerRef.current = null;
      map?.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!position) { markerRef.current?.remove(); markerRef.current = null; return; }
    let marker = markerRef.current;
    if (!marker) {
      const element = document.createElement("div");
      element.className = "viasee-map-pill";
      element.style.width = "44px"; element.style.height = "44px";
      element.setAttribute("role", "img");
      marker = new maplibregl.Marker({ element, draggable: editable, anchor: "center" }).setLngLat([position.lng, position.lat]).addTo(map);
      marker.on("dragend", () => {
        const next = marker.getLngLat();
        latest.current.onPositionChange?.({ lat: Number(next.lat.toFixed(6)), lng: Number(next.lng.toFixed(6)) });
      });
      markerRef.current = marker;
    }
    const element = marker.getElement();
    element.innerHTML = markerContent(location);
    element.setAttribute("aria-label", `Pinul locației ${location.public_display_name || location.name || ""}${editable ? ". Trage-l pentru repoziționare." : ""}`);
    marker.setDraggable(editable).setLngLat([position.lng, position.lat]);
    if (!map.getBounds().contains([position.lng, position.lat])) map.jumpTo({ center: [position.lng, position.lat], zoom: Math.max(15, map.getZoom()) });
  }, [ready, position?.lat, position?.lng, editable, location]);

  const recenter = () => {
    if (position) mapRef.current?.easeTo({ center: [position.lng, position.lat], zoom: 16, duration: 200 });
  };
  return <>
    <div ref={host} className="h-full w-full" />
    {position && <button type="button" onClick={recenter} aria-label="Arată pinul locației" title="Arată pinul locației"
      className="absolute right-3 top-3 z-[550] flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm hover:bg-secondary">
      <MapPin className="h-4 w-4" />
    </button>}
  </>;
}
