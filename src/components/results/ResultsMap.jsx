import { pillHtml } from "../../../shared/mapMarkerPresentation.js";
import "./mapMarkers.css";
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLocationCard from "./MapLocationCard";
import {
  FALLBACK_ZOOM,
  boundsForPoints,
  buildResultsMapModel,
  clusterPoints,
  framingForPoints,
  pointIdsWithinBounds,
  unmappedNotice,
} from "../../../shared/resultsMapPoints.js";
import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import { readVisitedProfiles } from "@/lib/visitedProfiles";
import { loadVectorCanvas } from "./vectorCanvasLoader";
const LegacyResultsMap = lazy(() => import("./LegacyResultsMap"));

// 2026-09-24. Harta vectoriala (MapLibre) se incarca separat de pagina (vezi vectorCanvasLoader.js):
// lista si restul paginii nu o mai asteapta. Daca fisierul hartii nu se poate descarca, pagina nu
// cade: trecem pe harta 2D, ca la orice alta problema a hartii vectoriale.
function VectorCanvasUnavailable({ onFailure }) {
  const reported = useRef(false);
  const report = useRef(onFailure);
  report.current = onFailure;
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    report.current?.("unavailable");
  }, []);
  return null;
}
const VectorResultsCanvas = lazy(() => loadVectorCanvas().catch(() => ({ default: VectorCanvasUnavailable })));
const VECTOR_LOADING = <div role="status" className="absolute inset-0 flex items-center justify-center bg-secondary text-sm">Se încarcă harta detaliată...</div>;

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

// Pe ecrane late cardul locatiei pluteste deasupra pinului; pe telefon sta jos, pe latimea hartii.
const WIDE_MAP_QUERY = "(min-width: 768px)";
function useWideMap() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_MAP_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(WIDE_MAP_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
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
  // 2026-09-27: numarul fiecarei locatii in lista (id -> 1, 2, 3...), cand lista are o ordine a
  // potrivirii. Pinul arata acelasi numar ca si cardul. Harta nu schimba ordinea.
  rankById = null,
}) {
  const model = useMemo(() => buildResultsMapModel(results), [results]);
  // Starea „vazut” se citeste o data la deschiderea hartii (revenirea de pe un profil o redeschide).
  const [visited] = useState(readVisitedProfiles);
  const wideMap = useWideMap();
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
  const [vectorFailed, setVectorFailed] = useState(false);
  const selectedPoint = model.points.find((point) => point.id === selectedId) || null;
  const notice = unmappedNotice(model.unmappedCount);

  const clusters = useMemo(
    () => clusterPoints(mapPoints, viewport.zoom),
    [mapPoints, viewport.zoom],
  );

  const openCluster = clusters.find((cluster) => cluster.key === openClusterKey && cluster.count > 1);

  // 2026-09-27. Locatiile cu pozitia departe de restul (de obicei coordonate gresite) nu intra in
  // incadrarea de la deschidere. Cat timp harta arata toate celelalte locatii, spune cate au ramas
  // in afara si le poate arata. Cand vizitatorul se apropie de o parte a orasului, nota dispare.
  const framing = useMemo(() => framingForPoints(fitModel.points), [fitModel.points]);
  const outsideCount = viewport.bounds && framing.excluded.length
    && pointIdsWithinBounds(framing.points, viewport.bounds).length === framing.points.length
    ? framing.excluded.length - pointIdsWithinBounds(framing.excluded, viewport.bounds).length
    : 0;
  const [revealArea, setRevealArea] = useState(null);
  const revealAll = () => setRevealArea({ bounds: boundsForPoints(fitModel.points) });

  // Dreptunghiul vizibil se raporteaza in sus ca lista sa poata fi filtrata la ce se vede.
  // Se trimit ID-URI, nu un criteriu de cautare: serverul nu este intrebat nimic din nou.
  // 2026-09-24: semnatura (toate punctele, sortate) se calculeaza o data per set de puncte, nu la
  // fiecare mutare a hartii (pe harta nationala sunt ~1.300 de puncte).
  const fitSignature = useMemo(
    () => fitModel.points.map((point) => `${point.id}:${point.lat}:${point.lng}`).sort().join("|"),
    [fitModel.points],
  );
  const reportViewport = useCallback((next) => {
    setViewport(next);
    if (storageKey) {
      const maps = readSearchSession().maps || {};
      writeSearchSession({ maps: { ...maps, [storageKey]: { signature: fitSignature, bounds: next.bounds, camera: next.camera } } });
    }

  }, [fitSignature, storageKey]);

  // Marker data can arrive without camera movement (national directory, coordinate overlay).
  useEffect(() => {
    if (vectorFailed || !viewport.bounds) return;
    onViewportChange?.({
      ...viewport,
      visibleIds: pointIdsWithinBounds(model.points, viewport.bounds),
      mappedCount: model.mappedCount,
    });
  }, [viewport, model.points, model.mappedCount, onViewportChange, vectorFailed]);

  if (vectorFailed) return <div className={`relative isolate ${className}`}>
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-sm">Se încarcă harta 2D...</div>}>
      <LegacyResultsMap {...{results, fitResults, selectedId, hoveredId, onSelect, onHover, onViewportChange, storageKey, focusArea, rankById}} className="h-full w-full" />
    </Suspense>
    <details className="absolute left-3 top-24 z-[500] max-w-60 rounded-2xl border border-border bg-card text-xs shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Hartă 2D · De ce?</summary>
      <p className="px-3 pb-3 leading-relaxed">{vectorFailed === "webgl" ? "Acest browser nu poate porni grafica 3D (WebGL). Locațiile, selecția și zoom-ul rămân disponibile în 2D." : "Harta vectorială nu a putut fi încărcată. Poți explora aceleași locații pe harta 2D."}</p>
    </details>
  </div>;

  // Keep the basemap navigable even when no result has public coordinates.
  const closeCard = () => { if (onSelect) onSelect(null); };
  const floatingCard = wideMap && selectedPoint
    ? <MapLocationCard variant="floating" point={selectedPoint} onClose={closeCard} />
    : null;

  return (
    <div className={`relative isolate ${className}`}>
      <Suspense fallback={VECTOR_LOADING}>
        <VectorResultsCanvas fitPoints={fitModel.points} points={model.points} clusters={clusters} selectedId={selectedId} hoveredId={hoveredId} storageKey={storageKey} focusArea={focusArea} reportViewport={reportViewport} pillHtml={pillHtml} onSelect={onSelect} onHover={onHover} onCluster={setOpenClusterKey} onFailure={(reason) => setVectorFailed(reason || "unavailable")} selectedCard={floatingCard} revealArea={revealArea} />
      </Suspense>

      {outsideCount > 0 && (
        <div className="pointer-events-none absolute left-14 right-3 top-3 z-[450] flex justify-center">
          <p role="status" className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card/95 py-1 pl-3.5 pr-1 text-xs font-medium text-muted-foreground shadow-[0_0_0_1px_rgba(23,23,23,0.06),0_2px_8px_rgba(23,35,55,0.14)]">
            {outsideCount === 1 ? "O locație e departe de celelalte" : `${outsideCount} locații sunt departe de celelalte`}
            <button type="button" onClick={revealAll} className="min-h-9 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              {outsideCount === 1 ? "Arat-o" : "Arată-le"}
            </button>
          </p>
        </div>
      )}

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

      {selectedPoint && !floatingCard && (
        <MapLocationCard point={selectedPoint} onClose={closeCard} />
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