// Harta vectoriala (MapLibre, ~290 KB comprimati, ~1 MB de cod) intr-un fisier separat.
//
// 2026-09-24. Biblioteca era in acelasi pachet cu pagina /cauta si cu pagina de rezultate: nimic nu
// aparea (nici bara de cautare, nici lista) pana nu se descarca si rula toata harta; pe telefon
// ~3,6 s de JavaScript doar pentru ea. Acum pagina si lista apar fara ea, iar harta vine in paralel.
//
// `preloadVectorCanvas()` porneste descarcarea devreme (la deschiderea paginii), in paralel cu
// datele; `loadVectorCanvas()` este aceeasi incarcare, folosita de React.lazy. Browserul descarca
// fisierul o singura data.

export function loadVectorCanvas() {
  return import("./VectorResultsCanvas");
}

export function preloadVectorCanvas() {
  loadVectorCanvas().catch(() => {
    // Fara retea sau fisier lipsa: ResultsMap trece singur pe harta 2D cand incearca din nou.
  });
}
