import { layoutMapMarkers } from "../../../shared/mapMarkerPresentation.js";
import { clusterSharesPosition } from "../../../shared/resultsMapLabels.js";
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { readSearchSession } from "@/lib/searchSession";

export default function VectorResultsCanvas({ points, clusters, selectedId, hoveredId, storageKey, focusArea, reportViewport, pillHtml, onSelect, onHover, onCluster, onFailure }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const latest = useRef({});
  latest.current = {points, reportViewport, onFailure};
  const fitted = useRef(null);
  const [ready, setReady] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [zoom, setZoom] = useState(6);
  useEffect(() => {
    let map;
    let observer;
    let timer;
    let layoutFrame;
    const scheduleLabels = () => {
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => { if (container.current) layoutMapMarkers(container.current); });
    };
    try {
      map = new maplibregl.Map({container:container.current, style:"https://tiles.openfreemap.org/styles/liberty", center:[24.9,45.9],zoom:6, maxZoom:19, attributionControl:{compact:true, customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'}});
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-left");
      const report = () => {
        const b = map.getBounds();
        setZoom(map.getZoom());
        latest.current.reportViewport({zoom:map.getZoom(),bounds:[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]]});
      };
      map.on("moveend",report);
      for (const event of ["moveend", "zoomend", "rotateend", "pitchend", "resize"]) map.on(event, scheduleLabels);
      map.on("load",() => {
        clearTimeout(timer);
        if (map.getLayer("building")) map.setLayerZoomRange("building",13,24);
        if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d","visibility","none");
        setReady(true);
      });
      map.on("webglcontextlost",() => latest.current.onFailure("webgl"));
      map.on("error", event => { if (event.error) console.warn("VIASEE vector map resource failed:", event.error.message); });
      timer = setTimeout(() => { if (!map.isStyleLoaded()) latest.current.onFailure("timeout"); },20000);
      observer = new ResizeObserver(() => map.resize());
      observer.observe(container.current);
    } catch (error) { console.error("VIASEE vector map initialization failed:", error); latest.current.onFailure(/webgl/i.test(String(error?.message)) ? "webgl" : "initialization"); }
    const currentMarkers = markers.current;
    return () => { cancelAnimationFrame(layoutFrame); clearTimeout(timer); observer?.disconnect(); currentMarkers.forEach(marker=>marker.remove()); currentMarkers.clear(); map?.remove(); mapRef.current=null; };
  },[]);
  useEffect(() => {
    if (!ready) return;
    const map=mapRef.current;
    const signature=points.map(p=>`${p.id}:${p.lat}:${p.lng}`).sort().join("|");
    if (signature===fitted.current || !points.length) return;
    const saved = !fitted.current && storageKey ? readSearchSession().maps?.[storageKey] : null;
    fitted.current=signature;
    if (saved?.signature===signature && saved.bounds) {
      map.fitBounds(saved.bounds.map(([lat,lng])=>[lng,lat]),{padding:48,duration:0});
    } else {
      const bounds=new maplibregl.LngLatBounds();
      points.forEach(p=>bounds.extend([p.lng,p.lat]));
      map.fitBounds(bounds,{padding:60,maxZoom:14,duration:0});
    }
  },[points,ready,storageKey]);
  useEffect(() => {
    if (ready && focusArea?.bounds) mapRef.current.fitBounds(focusArea.bounds.map(([lat,lng])=>[lng,lat]),{padding:40,maxZoom:13,duration:0});
  },[focusArea,ready]);
  useEffect(() => {
    if (!ready || !selectedId) return;
    const point=latest.current.points.find(p=>p.id===selectedId);
    if (point) mapRef.current.easeTo({center:[point.lng,point.lat],duration:350});
  },[selectedId,ready]);
  useEffect(() => {
    if (!ready) return;
    const map=mapRef.current;
    if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d","visibility",threeD?"visible":"none");
    map.easeTo({pitch:threeD?50:0,bearing:threeD?map.getBearing():0,duration:450});
  },[threeD,ready]);
  useEffect(() => {
    if (!ready) return;
    const map=mapRef.current;
    const keys=new Set(clusters.map(c=>c.key));
    markers.current.forEach((marker,key)=>{if(!keys.has(key)){marker.remove();markers.current.delete(key);}});
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
      const active=cluster.points.some(p=>p.id===selectedId);
      const hovered=cluster.points.some(p=>p.id===hoveredId);
      el.innerHTML=pillHtml(cluster,{active,hovered});
      el.style.zIndex=active?"30":hovered?"20":"1";
      el.setAttribute("aria-label",cluster.count>1?`Explorează grupul de ${cluster.count} locații`:cluster.lead.name);
      el.setAttribute("aria-pressed",String(active));
      el.title = cluster.count > 1 ? `${cluster.count} locații — apasă pentru a le explora` : cluster.lead.name;
      el.onclick=()=>{
        if(cluster.count>1) {
          if(map.getZoom()>=15 || clusterSharesPosition(cluster)){onSelect?.(null);onCluster(cluster.key);}
          else {onCluster(null);const bounds=new maplibregl.LngLatBounds();cluster.points.forEach(p=>bounds.extend([p.lng,p.lat]));map.fitBounds(bounds,{padding:60,maxZoom:17});}
        } else {onCluster(null);onSelect?.(cluster.lead.id);}
      };
      el.onmouseenter=()=>{if(cluster.count===1)onHover?.(cluster.lead.id);};
      el.onmouseleave=()=>onHover?.(null);
      el.onfocus=el.onmouseenter;
      el.onblur=el.onmouseleave;
    });
    const frame = requestAnimationFrame(() => layoutMapMarkers(container.current));
    return () => cancelAnimationFrame(frame);
  },[clusters,selectedId,hoveredId,ready,pillHtml,onSelect,onHover,onCluster]);
  return <>
    <div ref={container} className="h-full w-full" aria-label="Harta detaliată a locațiilor" />
    {!ready && <div role="status" className="absolute inset-0 flex items-center justify-center bg-secondary text-sm">Se încarcă harta detaliată...</div>}
    <div className="absolute left-3 top-32 z-40 flex flex-col items-start gap-2">
      <button type="button" disabled={!ready} aria-label={threeD ? "Comută harta în 2D" : "Comută harta în 3D"} aria-pressed={threeD} onClick={()=>setThreeD(value=>!value)} className="min-h-11 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-md hover:bg-secondary disabled:opacity-50">{threeD?"2D":"3D"}</button>
      {threeD && zoom<14 && <span className="max-w-40 rounded-xl bg-card p-2 text-xs shadow">Apropie harta pentru a vedea clădirile 3D.</span>}
    </div>
  </>;
}
