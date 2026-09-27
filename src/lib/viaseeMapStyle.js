// Fundalul hartii VIASEE: stilul „Positron” de la OpenFreeMap, recolorat in paleta site-ului.
// Fara importuri, ca sa poata fi testat direct in Node (scripts/verify-map-visual-refresh.mjs).
//
// 2026-09-27. Stilul vechi („Liberty”) avea drumuri galben-portocaliu, paduri verzi si relief:
// concura cu pinii. Numele erau in engleza („Bucharest”, „Western Industrial Area”), iar la vecini in
// chirilica. Acum:
// - Positron, un stil gandit pentru date puse peste harta, cu jumatate din straturi (55 fata de 111);
// - culorile site-ului: uscat crem, apa albastru-pal, drumuri albe cu contur cald, cladiri nisip;
// - nume romanesti: `name:ro`, apoi numele local in alfabet latin, apoi numele simplu;
// - un strat de cladiri 3D (ascuns), pentru butonul 3D; Positron nu are unul propriu.
// Dalele, fonturile si simbolurile raman cele de la OpenFreeMap; se schimba doar desenul.

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
export const MAP_STYLE_FALLBACK_URL = "https://tiles.openfreemap.org/styles/liberty";

const COLORS = Object.freeze({
  land: "#F2EFE8",
  residential: "#ECE8DF",
  park: "#E3E8D8",
  wood: "#DDE3D2",
  water: "#CCDAEA",
  waterway: "#B7CAE0",
  building: "#E6E0D5",
  buildingOutline: "#DAD3C6",
  road: "#FFFFFF",
  roadMinor: "#FAF8F4",
  roadCasing: "#DCD5C8",
  rail: "#D9D2C6",
  boundaryCountry: "#A69D8E",
  boundaryCounty: "#C4BCAE",
  label: "#2B3445",
  labelMuted: "#5F6878",
  labelWater: "#5A7394",
  halo: "#F7F6F3",
});

export const ROMANIAN_NAME = ["coalesce", ["get", "name:ro"], ["get", "name:latin"], ["get", "name"]];

function usesName(textField) {
  return JSON.stringify(textField || "").includes("name");
}

function paintFor(layer) {
  const id = String(layer.id || "");
  const type = layer.type;
  if (type === "background") return { "background-color": COLORS.land };
  if (type === "fill") {
    if (id === "water") return { "fill-color": COLORS.water };
    if (id === "park") return { "fill-color": COLORS.park };
    if (id === "landcover_wood") return { "fill-color": COLORS.wood };
    if (id === "landuse_residential") return { "fill-color": COLORS.residential };
    if (id === "building") return { "fill-color": COLORS.building, "fill-outline-color": COLORS.buildingOutline };
    if (id === "road_area_pier") return { "fill-color": COLORS.land };
    return null;
  }
  if (type === "line") {
    if (id === "waterway") return { "line-color": COLORS.waterway };
    if (/^boundary_2$/.test(id)) return { "line-color": COLORS.boundaryCountry };
    if (/^boundary/.test(id)) return { "line-color": COLORS.boundaryCounty };
    if (/railway/.test(id) && !/dashline/.test(id)) return { "line-color": COLORS.rail };
    if (/casing/.test(id)) return { "line-color": COLORS.roadCasing };
    if (/highway_minor|highway_path/.test(id)) return { "line-color": COLORS.roadMinor };
    if (/highway_(major|motorway)_(inner|bridge_inner)|motorway_bridge_inner|tunnel_motorway_inner/.test(id)) return { "line-color": COLORS.road };
    if (/subtle/.test(id)) return { "line-color": COLORS.roadCasing };
    if (id === "road_pier") return { "line-color": COLORS.land };
    return null;
  }
  if (type === "symbol") {
    if (/water|waterway/.test(id)) return { "text-color": COLORS.labelWater, "text-halo-color": COLORS.halo };
    if (/^label_(city|city_capital|town|country)/.test(id)) return { "text-color": COLORS.label, "text-halo-color": COLORS.halo };
    if (/^label_|^highway-name|^airport/.test(id)) return { "text-color": COLORS.labelMuted, "text-halo-color": COLORS.halo };
    return null;
  }
  return null;
}

/**
 * Stilul Positron (JSON) -> stilul VIASEE. Nu modifica obiectul primit.
 */
export function transformMapStyle(style) {
  if (!style || !Array.isArray(style.layers)) return style;
  const layers = style.layers.map((layer) => {
    const next = { ...layer };
    const paint = paintFor(layer);
    if (paint) next.paint = { ...(layer.paint || {}), ...paint };
    if (layer.type === "symbol" && layer.layout && usesName(layer.layout["text-field"])) {
      // Un singur rand, in romana; fara al doilea rand in alt alfabet.
      next.layout = { ...layer.layout, "text-field": ROMANIAN_NAME };
    }
    return next;
  });
  const vectorSource = Object.entries(style.sources || {}).find(([, source]) => source?.type === "vector")?.[0];
  if (vectorSource && !layers.some((layer) => layer.id === "building-3d")) {
    const buildingIndex = layers.findIndex((layer) => layer.id === "building");
    layers.splice(buildingIndex >= 0 ? buildingIndex + 1 : layers.length, 0, {
      id: "building-3d",
      type: "fill-extrusion",
      source: vectorSource,
      "source-layer": "building",
      minzoom: 14,
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": COLORS.building,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    });
  }
  return { ...style, layers };
}

// Harta cere stilul prin MapLibre (`setStyle(MAP_STYLE_URL, { transformStyle })`): JSON-ul vine
// de la OpenFreeMap, iar transformarea de mai sus se aplica inainte de prima desenare.
