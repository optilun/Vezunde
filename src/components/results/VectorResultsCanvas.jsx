import { layoutMapMarkers } from "../../../shared/mapMarkerPresentation.js";
import { clusterSharesPosition } from "../../../shared/resultsMapLabels.js";
import { CLUSTER_INDIVIDUAL_ZOOM, clusterExpansionZoom, framingForPoints } from "../../../shared/resultsMapPoints.js";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { readSearchSession } from "@/lib/searchSession";
import { requestMapCardFocus } from "@/lib/mapCardFocus";
import { MAP_STYLE_FALLBACK_URL, MAP_STYLE_URL, transformMapStyle } from "@/lib/viaseeMapStyle";

const ATTRIBUTION = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>';

// 2026-09-27. O singura harta pe pagina, pastrata intre cautari.
// Pana acum fiecare cautare noua (alt oras, alt serviciu, trecerea de la harta Romaniei la o
// localitate) crea o harta noua: fundalul, fonturile si dalele se descarcau din nou (5-10 s pe
// telefon). Acum harta ramane in memorie cand pagina de rezultate se schimba: la urmatoarea cautare
// se muta in noul loc si isi schimba doar punctele si incadrarea.
// - o harta e „ocupata” cat timp o foloseste o componenta; daca doua harti apar simultan, a doua
//   este una obisnuita, stearsa la plecare;
// - evenimentele hartii ajung la componenta care o foloseste acum (`entry.owner`);
// - o harta care si-a pierdut contextul grafic (WebGL) nu se mai refoloseste.
let sharedMap = null;

function isStyleRequestError(event) {
  return String(event?.error?.url || event?.error?.message || "").includes("/styles/positron");
}

function createMapEntry(host) {
  const element = document.createElement("div");
  element.style.width = "100%";
  element.style.height = "100%";
  host.appendChild(element);
  let map;
  try {
    map = new maplibregl.Map({container:element, center:[24.9,45.9], zoom:6, maxZoom:19, attributionControl:{compact:true, customAttribution:ATTRIBUTION}});
  } catch (error) {
    element.remove();
    throw error;
  }
  const entry = { map, element, inUse: true, styleLoaded: false, broken: false, fallbackStyle: false, owner: null };
  // Fundalul VIASEE: Positron recolorat, nume romanesti (src/lib/viaseeMapStyle.js).
  map.setStyle(MAP_STYLE_URL, { transformStyle: (_previous, next) => transformMapStyle(next) });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-left");
  // Locul butonului 3D: un control al hartii, asezat sub zoom si busola de MapLibre (nu la o
  // pozitie fixa, care se suprapunea cu butoanele mai mari de pe ecranele tactile).
  const controlSlot = document.createElement("div");
  controlSlot.className = "maplibregl-ctrl viasee-map-control-slot";
  map.addControl({ onAdd: () => controlSlot, onRemove: () => controlSlot.remove() }, "top-left");
  entry.controlSlot = controlSlot;
  map.on("moveend", event => entry.owner?.onMoveEnd(event));
  for (const event of ["moveend", "zoomend", "rotateend", "pitchend", "resize"]) map.on(event, () => entry.owner?.onLabels());
  map.on("click", event => entry.owner?.onMapClick(event));
  map.on("load",() => {
    if (map.getLayer("building")) map.setLayerZoomRange("building",13,24);
    if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d","visibility","none");
    entry.styleLoaded = true;
    entry.owner?.onStyleReady();
  });
  map.on("webglcontextlost",() => { entry.broken = true; entry.owner?.onFailure("webgl"); });
  map.on("error", event => {
    if (!event.error) return;
    console.warn("VIASEE vector map resource failed:", event.error.message);
    // Daca stilul VIASEE nu se poate citi, harta porneste cu stilul standard OpenFreeMap.
    if (!entry.styleLoaded && !entry.fallbackStyle && isStyleRequestError(event)) {
      entry.fallbackStyle = true;
      map.setStyle(MAP_STYLE_FALLBACK_URL);
    }
  });
  return entry;
}

function acquireMap(host) {
  if (sharedMap && !sharedMap.inUse && !sharedMap.broken) {
    host.appendChild(sharedMap.element);
    sharedMap.inUse = true;
    sharedMap.map.resize();
    sharedMap.map.triggerRepaint();
    return sharedMap;
  }
  const entry = createMapEntry(host);
  if (!sharedMap || sharedMap.broken) sharedMap = entry;
  return entry;
}

function releaseMap(entry) {
  entry.owner = null;
  entry.inUse = false;
  if (entry === sharedMap && !entry.broken) {
    entry.element.remove();
    return;
  }
  if (entry === sharedMap) sharedMap = null;
  entry.map.remove();
  entry.element.remove();
}

export default function VectorResultsCanvas({ points, fitPoints = points, clusters, selectedId, hoveredId, storageKey, focusArea, reportViewport, pillHtml, onSelect, onHover, onCluster, onFailure, selectedCard = null, revealArea = null, fitKey = null }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const latest = useRef({});
  latest.current = {points, reportViewport, onFailure};
  // 2026-09-24. Selectia si hover-ul nu mai reconstruiesc markerele: efectul de mai jos le citeste
  // de aici, iar efectul separat schimba doar markerele atinse. Inainte, fiecare hover pe un card din
  // lista rescria HTML-ul tuturor markerelor si le re-aseza (100-220 ms pe desktop, sacadat).
  const markerState = useRef({ selectedId, hoveredId });
  markerState.current = { selectedId, hoveredId };
  const handlers = useRef({});
  handlers.current = { onSelect, onHover, onCluster };
  const clusterByKey = useRef(new Map());
  const stateLayoutFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(stateLayoutFrame.current), []);
  const fitted = useRef(null);
  const skipInitialSelection = useRef(false);
  const restoredCamera = useRef(null);
  const cardAnchor = useRef(null);
  const hasCard = Boolean(selectedCard);
  const hasCardRef = useRef(hasCard);
  hasCardRef.current = hasCard;
  // 2026-09-24. Doua momente distincte:
  // - `ready`: harta exista, deci camera si markerele (elemente HTML) pot fi puse. Punctele apar
  //   imediat, peste fundalul simplu, fara sa astepte fundalul hartii;
  // - `styleReady`: fundalul (stil, texte, dale) s-a incarcat; abia atunci se pot atinge straturile
  //   (cladiri, 3D). Inainte, totul astepta `load`: 6-8 s pe desktop in test, mai mult pe telefon.
  // 2026-09-27: o harta refolosita are fundalul gata, deci ambele sunt adevarate de la inceput.
  const [ready, setReady] = useState(false);
  const [styleReady, setStyleReady] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [zoom, setZoom] = useState(6);
  const [controlSlot, setControlSlot] = useState(null);
  // 2026-09-27: pe telefon harta poate porni ascunsa (lista intai). Incadrarea pe puncte se face abia
  // cand harta are marime: un fitBounds pe 0 px alegea un zoom gresit, pastrat apoi in sesiune.
  const [hasSize, setHasSize] = useState(false);
  useEffect(() => {
    let entry;
    let map;
    let observer;
    let timer;
    let layoutFrame;
    let onVisibility;
    const scheduleLabels = () => {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => { if (container.current) layoutMapMarkers(container.current); });
    };
    try {
      entry = acquireMap(container.current);
      map = entry.map;
      mapRef.current = map;
      const report = (event) => {
        const b = map.getBounds();
        setZoom(map.getZoom());
        // `reason` spune paginii daca harta s-a mutat pentru ca vizitatorul a ales o locatie (lista
        // nu se reordoneaza atunci) sau pentru ca a explorat harta.
        latest.current.reportViewport({zoom:map.getZoom(),bounds:[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]],camera:{center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()},reason:event?.viaseeSelection ? "selection" : "move"});
      };
      entry.owner = {
        onMoveEnd: report,
        onLabels: scheduleLabels,
        onStyleReady: () => { clearTimeout(timer); setStyleReady(true); },
        onFailure: (reason) => latest.current.onFailure(reason),
        // Un clic pe harta (nu pe un pin sau pe card) inchide cardul locatiei, ca pe Airbnb.
        onMapClick: (event) => {
          if (event.originalEvent?.target?.closest?.(".viasee-vector-marker, .maplibregl-ctrl")) return;
          if (markerState.current.selectedId) handlers.current.onSelect?.(null);
        },
      };
      setControlSlot(entry.controlSlot);
      setHasSize(container.current.clientWidth > 0 && container.current.clientHeight > 0);
      // 2026-09-27 (audit /cauta, A3): cele 20 s se numara doar cat fila e vizibila. Intr-o fila din
      // fundal browserul nu deseneaza, dalele nu se incarca, iar harta trecea definitiv pe 2D pentru
      // cine deschidea cautarea intr-o fila noua si revenea mai tarziu.
      const startTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!map.isStyleLoaded()) latest.current.onFailure("timeout"); },20000);
      };
      onVisibility = () => {
        if (entry.styleLoaded) return;
        if (document.visibilityState === "hidden") clearTimeout(timer);
        else startTimer();
      };
      if (entry.styleLoaded) setStyleReady(true);
      else {
        if (document.visibilityState !== "hidden") startTimer();
        document.addEventListener("visibilitychange", onVisibility);
      }
      observer = new ResizeObserver(() => {
        // Harta ascunsa (lista pe telefon) are 0 px: nu o redimensionam si nu o redesenam degeaba.
        // Cand reapare, observatorul se declanseaza din nou cu marimea reala.
        const element = container.current;
        setHasSize(Boolean(element && element.clientWidth > 0 && element.clientHeight > 0));
        if (!element || element.clientWidth === 0 || element.clientHeight === 0) return;
        map.resize();
      });
      observer.observe(container.current);
      setReady(true);
    } catch (error) { console.error("VIASEE vector map initialization failed:", error); latest.current.onFailure(/webgl/i.test(String(error?.message)) ? "webgl" : "initialization"); }
    const currentMarkers = markers.current;
    return () => { cancelAnimationFrame(layoutFrame); clearTimeout(timer); if (onVisibility) document.removeEventListener("visibilitychange", onVisibility); observer?.disconnect(); currentMarkers.forEach(marker=>marker.remove()); currentMarkers.clear(); if (entry) releaseMap(entry); mapRef.current=null; };
  },[]);
  useEffect(() => {
    if (!ready || !hasSize) return;
    const map=mapRef.current;
    const signature=fitPoints.map(p=>`${p.id}:${p.lat}:${p.lng}`).sort().join("|");
    // 2026-09-28 (audit /cauta, B6): cu `fitKey`, harta se reincadreaza doar cand se schimba cheia (pe
    // harta Romaniei: tipul ales), nu si cand aceleasi criterii primesc date noi (lista actuala in
    // locul fisierului static). Harta ramane unde a lasat-o vizitatorul; la revenire, pozitia salvata
    // se reia chiar daca lista s-a schimbat intre timp.
    const fitToken=fitKey===null ? signature : `key:${fitKey}`;
    if (fitToken===fitted.current) return;
    const saved = fitted.current === null && storageKey ? readSearchSession().maps?.[storageKey] : null;
    fitted.current=fitToken;
    if (saved?.bounds && (saved.signature===signature || fitKey!==null)) {
      skipInitialSelection.current = true;
      const camera = saved.camera;
      if (camera && Array.isArray(camera.center) && camera.center.length === 2 && camera.center.every(Number.isFinite) && [camera.zoom, camera.pitch, camera.bearing].every(Number.isFinite)) {
        restoredCamera.current = camera;
        setThreeD(camera.pitch > 0);
        map.jumpTo(camera);
      } else {
        map.fitBounds(saved.bounds.map(([lat,lng])=>[lng,lat]),{padding:0,duration:0});
      }
    } else if (!fitPoints.length) {
      map.fitBounds([[20.2,43.6],[29.8,48.3]], { padding: 24, duration: 0 });
    } else {
      // 2026-09-27: coordonatele aberante nu departeaza harta; 1-2 locatii nu se deschid prea aproape.
      const framing=framingForPoints(fitPoints);
      const bounds=new maplibregl.LngLatBounds();
      framing.points.forEach(p=>bounds.extend([p.lng,p.lat]));
      map.fitBounds(bounds,{padding:60,maxZoom:framing.maxZoom,duration:0});
    }
  },[fitPoints,ready,storageKey,hasSize,fitKey]);
  useEffect(() => {
    if (ready && hasSize && focusArea?.bounds) mapRef.current.fitBounds(focusArea.bounds.map(([lat,lng])=>[lng,lat]),{padding:40,maxZoom:13,duration:0});
  },[focusArea,ready,hasSize]);
  // „Arata toate”: include si locatiile lasate in afara incadrarii (coordonate departe de rest).
  useEffect(() => {
    if (ready && hasSize && revealArea?.bounds) mapRef.current.fitBounds(revealArea.bounds.map(([lat,lng])=>[lng,lat]),{padding:60,maxZoom:14,duration:450});
  },[revealArea,ready,hasSize]);
  useEffect(() => {
    if (!ready) return;
    if (skipInitialSelection.current) { skipInitialSelection.current = false; return; }
    if (!selectedId) return;
    const point=latest.current.points.find(p=>p.id===selectedId);
    // Cardul plutitor sta deasupra pinului: pinul coboara putin sub centru, ca sa incapa cardul.
    // Pe telefon cardul sta jos, deci pinul urca putin.
    if (point) mapRef.current.easeTo({center:[point.lng,point.lat],offset:hasCardRef.current ? [0,130] : [0,-70],duration:350},{viaseeSelection:true});
  },[selectedId,ready]);
  useEffect(() => {
    if (!styleReady) return;
    const map=mapRef.current;
    if (restoredCamera.current) {
      const camera = restoredCamera.current;
      if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d","visibility",camera.pitch > 0 ? "visible" : "none");
      // Wait for state to agree before allowing the normal 2D/3D toggle effect.
      if (threeD === (camera.pitch > 0)) restoredCamera.current = null;
      return;
    }
    if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d","visibility",threeD?"visible":"none");
    // La incarcarea fundalului harta e deja plata: nu pornim o animatie care ar opri o mutare facuta
    // intre timp de vizitator (sau centrarea pe un marker apasat).
    if (!threeD && map.getPitch() === 0 && map.getBearing() === 0) return;
    map.easeTo({pitch:threeD?50:0,bearing:threeD?map.getBearing():0,duration:450});
  },[threeD,styleReady]);
  useEffect(() => {
    if (!ready) return;
    const map=mapRef.current;
    const { selectedId: activeId, hoveredId: hoverId } = markerState.current;
    const keys=new Set(clusters.map(c=>c.key));
    markers.current.forEach((marker,key)=>{if(!keys.has(key)){marker.remove();markers.current.delete(key);}});
    clusterByKey.current = new Map(clusters.map(c=>[c.key,c]));
    clusters.forEach(cluster=>{
      let marker=markers.current.get(cluster.key);
      if (!marker) {
        const button=document.createElement("button");
        button.type="button";
        button.className = "viasee-vector-marker";
        marker=new maplibregl.Marker({element:button,anchor:"center",pitchAlignment:"viewport",rotationAlignment:"viewport"}).setLngLat([cluster.lng,cluster.lat]).addTo(map);
        markers.current.set(cluster.key,marker);
      }
      marker.setLngLat([cluster.lng,cluster.lat]);
      const el=marker.getElement();
      const active=cluster.points.some(p=>p.id===activeId);
      const hovered=cluster.points.some(p=>p.id===hoverId);
      el.innerHTML=pillHtml(cluster,{active,hovered});
      el.style.zIndex=active?"30":hovered?"20":"1";
      el.setAttribute("aria-label",cluster.count>1?`Explorează grupul de ${cluster.count} locații`:cluster.lead.name);
      el.setAttribute("aria-pressed",String(active));
      el.title = cluster.count > 1 ? `${cluster.count} locații — apasă pentru a le explora` : cluster.lead.name;
      el.onclick=()=>{
        const {onSelect:select,onCluster:openCluster}=handlers.current;
        if(cluster.count>1) {
          if(map.getZoom()>=CLUSTER_INDIVIDUAL_ZOOM || clusterSharesPosition(cluster)){select?.(null);openCluster(cluster.key);}
          else {
            // 2026-09-27. Grupul se desface pe loc: harta se apropie centrata pe grup, pana la zoom-ul
            // la care grupul se imparte (nu pe dreptunghiul tuturor punctelor lui, care putea sari
            // pana in orasele vecine).
            openCluster(null);
            const current=map.getZoom();
            const target=Math.min(17,Math.max(current+1,clusterExpansionZoom(cluster.points,current)));
            map.easeTo({center:[cluster.lng,cluster.lat],zoom:target,duration:450});
          }
        } else {openCluster(null);requestMapCardFocus();select?.(cluster.lead.id);}
      };
      el.onmouseenter=()=>{if(cluster.count===1)handlers.current.onHover?.(cluster.lead.id);};
      el.onmouseleave=()=>handlers.current.onHover?.(null);
      el.onfocus=el.onmouseenter;
      el.onblur=el.onmouseleave;
    });
    // La demontare React goleste `container` inaintea curatarii efectelor; cadrul poate rula intre.
    const frame = requestAnimationFrame(() => { if (container.current) layoutMapMarkers(container.current); });
    return () => cancelAnimationFrame(frame);
  },[clusters,ready,pillHtml]);
  // Selectia si hover-ul: doar markerele a caror stare se schimba primesc atributele noi (aceleasi pe
  // care le scrie pillHtml), apoi etichetele se re-aseaza o singura data.
  useEffect(() => {
    if (!ready) return;
    let changed=false;
    markers.current.forEach((marker,key)=>{
      const cluster=clusterByKey.current.get(key);
      const el=marker.getElement();
      const pill=el.querySelector("[data-map-marker]");
      if (!cluster || !pill) return;
      const active=cluster.points.some(p=>p.id===selectedId);
      const hovered=cluster.points.some(p=>p.id===hoveredId);
      if (pill.dataset.active===String(active) && pill.dataset.hovered===String(hovered)) return;
      pill.dataset.active=String(active);
      pill.dataset.hovered=String(hovered);
      el.style.zIndex=active?"30":hovered?"20":"1";
      el.setAttribute("aria-pressed",String(active));
      changed=true;
    });
    if (!changed) return;
    // Un singur cadru in asteptare; o schimbare fara efect pe markere nu il anuleaza.
    cancelAnimationFrame(stateLayoutFrame.current);
    stateLayoutFrame.current = requestAnimationFrame(() => {
      stateLayoutFrame.current = 0;
      if (container.current) layoutMapMarkers(container.current);
    });
  },[selectedId,hoveredId,ready]);
  // 2026-09-27. Cardul locatiei alese sta deasupra pinului si il urmeaza cand harta se misca (ca pe
  // Airbnb). Nu este un marker al hartii: sta langa ea, ca apasarile din card (profil, inchidere) sa
  // nu mute harta. Cand pinul e prea sus, cardul trece sub el; nu iese niciodata lateral din harta.
  useEffect(() => {
    if (!ready || !hasCard) return;
    const map=mapRef.current;
    const anchor=cardAnchor.current;
    const point=latest.current.points.find(p=>p.id===selectedId);
    if (!anchor || !point) return;
    const place = () => {
      const width=container.current?.clientWidth || 0;
      const height=container.current?.clientHeight || 0;
      const card=anchor.firstElementChild;
      const cardWidth=card?.offsetWidth || 300;
      const cardHeight=card?.offsetHeight || 320;
      const {x,y}=map.project([point.lng,point.lat]);
      const below=y-cardHeight-30 < 8 && y+30+cardHeight <= height-8;
      const left=Math.min(Math.max(x-cardWidth/2,8),Math.max(8,width-cardWidth-8));
      const top=below ? y+30 : y-cardHeight-30;
      anchor.style.transform=`translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      anchor.style.visibility=x>=0 && x<=width && y>=0 && y<=height ? "visible" : "hidden";
    };
    place();
    const resize=new ResizeObserver(place);
    if (anchor.firstElementChild) resize.observe(anchor.firstElementChild);
    map.on("move",place);
    map.on("resize",place);
    return () => { resize.disconnect(); map.off("move",place); map.off("resize",place); };
  },[selectedId,hasCard,ready]);
  return <>
    <div ref={container} className="viasee-map-host h-full w-full bg-[#F2EFE8]" role="region" aria-label="Harta detaliată a locațiilor" />
    {!ready && <div role="status" className="absolute inset-0 flex items-center justify-center bg-[#F2EFE8] text-sm">Se încarcă harta detaliată...</div>}
    {ready && !styleReady && <p role="status" className="pointer-events-none absolute bottom-3 left-3 z-40 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm">Se încarcă fundalul hărții...</p>}
    {ready && hasCard && <div ref={cardAnchor} className="pointer-events-none absolute left-0 top-0 z-[450]" style={{visibility:"hidden"}}>
      <div className="pointer-events-auto w-[300px]">{selectedCard}</div>
    </div>}
    {controlSlot && createPortal(<div className="flex flex-col items-start gap-2">
      <button type="button" disabled={!styleReady} aria-label={threeD ? "Comută harta în 2D" : "Comută harta în 3D"} aria-pressed={threeD} onClick={()=>setThreeD(value=>!value)} className="viasee-map-control relative h-9 w-9 text-[12px] font-bold before:absolute before:-inset-1 before:content-[''] disabled:opacity-50">{threeD?"2D":"3D"}</button>
      {threeD && zoom<14 && <span className="max-w-40 rounded-xl bg-card p-2 text-xs shadow">Apropie harta pentru a vedea clădirile 3D.</span>}
    </div>, controlSlot)}
  </>;
}
