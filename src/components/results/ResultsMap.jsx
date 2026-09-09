import { pillHtml } from "../../../shared/mapMarkerPresentation.js";
import "./mapMarkers.css";
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import MapLocationCard from "./MapLocationCard";
import {
  FALLBACK_ZOOM,
  buildResultsMapModel,
  clusterPoints,
  pointIdsWithinBounds,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
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
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  const fitModel = useMemo(() => fitResults === null ? model : buildResultsMapModel(fitResults), [fitResults, model]);
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
      const signature = fitModel.points.map((point) => `${point.id}:${point.lat}:${point.lng}`).sort().join("|");
      writeSearchSession({ maps: { ...maps, [storageKey]: { signature, bounds: next.bounds, camera: next.camera } } });
    }

  }, [fitModel.points, storageKey]);

  // Marker data can arrive without camera movement (national directory, coordinate overlay).
  useEffect(() => {
    if (!viewport.bounds) return;
    onViewportChange?.({
      ...viewport,
      visibleIds: pointIdsWithinBounds(model.points, viewport.bounds),
      mappedCount: model.mappedCount,
    });
  }, [viewport, model.points, model.mappedCount, onViewportChange]);

  const [vectorFailed, setVectorFailed] = useState(false);
  if (vectorFailed) return <div className={`relative isolate ${className}`}>
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-sm">Se încarcă harta 2D...</div>}>
      <LegacyResultsMap {...{results, fitResults, selectedId, hoveredId, onSelect, onHover, onViewportChange, storageKey, focusArea}} className="h-full w-full" />
    </Suspense>
    <details className="absolute left-3 top-24 z-[500] max-w-60 rounded-2xl border border-border bg-card text-xs shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Hartă 2D · De ce?</summary>
      <p className="px-3 pb-3 leading-relaxed">{vectorFailed === "webgl" ? "Acest browser nu poate porni grafica 3D (WebGL). Locațiile, selecția și zoom-ul rămân disponibile în 2D." : "Harta vectorială nu a putut fi încărcată. Poți explora aceleași locații pe harta 2D."}</p>
    </details>
  </div>;

  // Keep the basemap navigable even when no result has public coordinates.

  return (
    <div className={`relative isolate ${className}`}>
      <VectorResultsCanvas fitPoints={fitModel.points} points={model.points} clusters={clusters} selectedId={selectedId} hoveredId={hoveredId} storageKey={storageKey} focusArea={focusArea} reportViewport={reportViewport} pillHtml={pillHtml} onSelect={onSelect} onHover={onHover} onCluster={setOpenClusterKey} onFailure={(reason) => setVectorFailed(reason || "unavailable")} />

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