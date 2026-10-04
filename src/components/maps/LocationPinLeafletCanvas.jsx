import React, { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../results/mapMarkers.css";
import { pillHtml } from "../../../shared/mapMarkerPresentation.js";
import { locationCoordinates } from "../../../shared/locationMapPosition.js";
import { withCartoApiKey } from "@/lib/cartoBasemap";

const tiles = withCartoApiKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function EditorEvents({ position, onPositionChange }) {
  const map = useMap();
  useMapEvents({ click: event => onPositionChange?.({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) }) });
  useEffect(() => {
    if (position && !map.getBounds().contains([position.lat, position.lng])) map.setView([position.lat, position.lng], 16);
  }, [map, position?.lat, position?.lng]); // position values, not object identity
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function LocationPinLeafletCanvas({ location, onPositionChange }) {
  const position = locationCoordinates(location);
  const icon = useMemo(() => L.divIcon({
    className: "viasee-map-pill", iconSize: [44, 44], iconAnchor: [22, 22],
    html: pillHtml({ key: "location-pin", count: 1, lead: { ...location, name: location.public_display_name || location.name || "Locație" } }, { active: true }),
  }), [location]);
  return <MapContainer center={position ? [position.lat, position.lng] : [45.9, 24.9]} zoom={position ? 16 : 6} maxZoom={19}
    scrollWheelZoom={false} className="h-full w-full" aria-label="Harta VIASEE a locației, 2D">
    <TileLayer url={tiles} attribution={attribution} />
    <EditorEvents position={position} onPositionChange={onPositionChange} />
    {position && <Marker position={[position.lat, position.lng]} icon={icon} title={location.public_display_name || location.name}
      draggable={Boolean(onPositionChange)} eventHandlers={{
        dragend: event => { const next = event.target.getLatLng(); onPositionChange?.({ lat: Number(next.lat.toFixed(6)), lng: Number(next.lng.toFixed(6)) }); },
      }} />}
  </MapContainer>;
}
