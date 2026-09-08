import { pillHtml } from "../../../shared/mapMarkerPresentation.js";
import "./mapMarkers.css";
import React, { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FALLBACK_ZOOM,
  buildResultsMapModel,
  clusterPoints,
  pointIdsWithinBounds,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
import LocationThumb, { typeVisual } from "@/components/results/LocationThumb";
import TrustBadge from "@/components/results/TrustBadge";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import VectorResultsCanvas from "./VectorResultsCanvas";
const LegacyResultsMap = lazy(() => import("./LegacyResultsMap"));

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

function PointCard({ point, onClose }) {
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
            to={`/furnizor/${point.id}`}
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

  const [vectorFailed, setVectorFailed] = useState(false);
  if (vectorFailed) return <div className={`relative isolate ${className}`}>
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-sm">Se încarcă harta 2D...</div>}>
      <LegacyResultsMap {...{results, selectedId, hoveredId, onSelect, onHover, onViewportChange, storageKey, focusArea}} className="h-full w-full" />
    </Suspense>
    <details className="absolute left-3 top-24 z-[500] max-w-60 rounded-2xl border border-border bg-card text-xs shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Hartă 2D · De ce?</summary>
      <p className="px-3 pb-3 leading-relaxed">{vectorFailed === "webgl" ? "Acest browser nu poate porni grafica 3D (WebGL). Locațiile, selecția și zoom-ul rămân disponibile în 2D." : "Harta vectorială nu a putut fi încărcată. Poți explora aceleași locații pe harta 2D."}</p>
    </details>
  </div>;

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
    <div className={`relative isolate ${className}`}>
      <VectorResultsCanvas points={model.points} clusters={clusters} selectedId={selectedId} hoveredId={hoveredId} storageKey={storageKey} focusArea={focusArea} reportViewport={reportViewport} pillHtml={pillHtml} onSelect={onSelect} onHover={onHover} onCluster={setOpenClusterKey} onFailure={(reason) => setVectorFailed(reason || "unavailable")} />

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