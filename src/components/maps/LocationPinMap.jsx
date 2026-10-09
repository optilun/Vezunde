import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { locationCoordinates } from "../../../shared/locationMapPosition.js";

function FailedVector({ onFailure }) {
  useEffect(() => { onFailure(); }, [onFailure]);
  return null;
}
const VectorCanvas = lazy(() => import("./LocationPinVectorCanvas").catch(() => ({ default: FailedVector })));
const LegacyCanvas = lazy(() => import("./LocationPinLeafletCanvas"));
const loading = <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">Se încarcă harta VIASEE…</div>;

export default function LocationPinMap({ location, onPositionChange = null, className = "", compact = false }) {
  const holder = useRef(null);
  const [visible, setVisible] = useState(false);
  const [fallback, setFallback] = useState(false);
  const fail = useCallback(() => setFallback(true), []);
  const position = locationCoordinates(location);

  useEffect(() => {
    if (!holder.current || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "160px" });
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);

  if (!position && !onPositionChange) return (
    <div className={`flex h-full min-h-52 flex-col items-center justify-center bg-secondary/30 px-5 text-center ${className}`}>
      <MapPin className="h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm font-semibold">Poziția pe hartă nu este încă disponibilă.</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Adresa rămâne afișată. Pinul poate fi completat și confirmat de organizație.</p>
    </div>
  );
  const Canvas = fallback ? LegacyCanvas : VectorCanvas;
  return (
    <div ref={holder} role="region" aria-label={`Harta VIASEE — ${location?.public_display_name || location?.name || "Locație"}`} className={`relative isolate h-full overflow-hidden bg-secondary/30 ${compact ? "location-map-compact" : ""} ${className}`}>
      {visible ? <Suspense fallback={loading}><Canvas location={location} onPositionChange={onPositionChange} onFailure={fail} /></Suspense> : loading}
    </div>
  );
}
