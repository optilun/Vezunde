// Descarca din timp codul paginii spre care duce un link, cand utilizatorul arata ca vrea sa-l
// deschida (trece cu mouse-ul, il atinge, ajunge pe el cu tastatura). Click-ul gaseste pagina deja
// descarcata si o afiseaza imediat, fara ecranul de incarcare.
//
// Aceleasi fisiere ca rutele din App.jsx (Vite le recunoaste ca acelasi modul, deci nimic nu se
// descarca de doua ori). Pe conexiuni cu „economisire de date” nu se descarca nimic in avans.

const ROUTE_LOADERS = {
  "/cauta": () => import("@/pages/Search"),
  "/cerere": () => import("@/pages/RequestFlow"),
  "/pentru-specialisti": () => import("@/pages/ForSpecialists"),
  "/parteneri": () => import("@/pages/Partners"),
  "/ghid": () => import("@/pages/GuideIndex"),
  "/adauga-sau-revendica": () => import("@/pages/AddOrClaim"),
};

const started = new Set();

export function prefetchRoute(to) {
  if (typeof to !== "string") return;
  const path = to.split(/[?#]/)[0] || "/";
  const load = ROUTE_LOADERS[path];
  if (!load || started.has(path)) return;
  if (typeof navigator !== "undefined" && navigator.connection?.saveData) return;
  started.add(path);
  load().catch(() => started.delete(path));
}

// De pus pe un <Link>: {...prefetchOnIntent("/cauta")}
export function prefetchOnIntent(to) {
  const run = () => prefetchRoute(to);
  return { onPointerEnter: run, onFocus: run, onTouchStart: run };
}
