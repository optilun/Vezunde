// Cheia CARTO Basemaps pentru harta existenta.
//
// 2026-09-06. CARTO a inceput sa afiseze watermark-ul "API KEY REQUIRED" pe tile-urile raster
// servite fara parametrul `key`. Aici se rezolva DOAR asta: se ataseaza `?key=...` la URL-ul
// de tile deja folosit in aplicatie. Stilul raster (light_all) nu se schimba.
//
// De ce nu vine din Secrets: secretele Base44 sunt disponibile numai in functiile de backend
// (Deno), nu in codul care ruleaza in browser. Un tile URL Leaflet este construit in browser,
// deci cheia trebuie sa ajunga acolo ca variabila de build sau ca valoare injectata in pagina.
// Nu construim un proxy de tile-uri pentru asta.
//
// Ordinea de citire:
//   1. import.meta.env.VITE_CARTO_BASEMAP_API_KEY  (variabila de build, recomandat)
//   2. window.__VIASEE_CARTO_BASEMAP_API_KEY__     (injectata in index.html, la runtime)
//
// Daca nu exista nicio valoare, URL-ul ramane exact cum era inainte - harta functioneaza,
// dar cu watermark. Nicio alta parte a hartii nu depinde de acest fisier.

export function cartoBasemapApiKey() {
  const fromEnv = typeof import.meta !== "undefined"
    ? import.meta.env?.VITE_CARTO_BASEMAP_API_KEY
    : "";
  const fromWindow = typeof window !== "undefined"
    ? window.__VIASEE_CARTO_BASEMAP_API_KEY__
    : "";
  return String(fromEnv || fromWindow || "").trim();
}

// Adauga `key` la un URL de tile CARTO, pastrand orice alt parametru existent.
export function withCartoApiKey(tileUrl) {
  const key = cartoBasemapApiKey();
  if (!key) return tileUrl;
  if (/[?&]key=/.test(tileUrl)) return tileUrl;
  return `${tileUrl}${tileUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
}