import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";

// 2026-09-30. „Caută în această zonă”, ca pe Airbnb: apare peste harta cand vizitatorul a mutat-o
// departe de localitatea cautata (sau a micsorat-o mult). Apasat, lista trece pe zona de pe harta.
// Apare dupa o scurta pauza, ca sa nu licareasca in timpul incadrarii de la deschidere.
const SHOW_DELAY_MS = 350;

export default function MapAreaSearchPill({ visible, onSearch }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!visible) { setShown(false); return undefined; }
    const timer = window.setTimeout(() => setShown(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);
  if (!shown) return null;
  return (
    <div className="pointer-events-none absolute inset-x-16 top-3 z-[460] flex justify-center">
      <button
        type="button"
        data-map-area-search
        onClick={onSearch}
        className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-5 text-sm font-semibold text-foreground shadow-[0_0_0_1px_rgba(23,23,23,0.06),0_4px_14px_rgba(23,35,55,0.18)] transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        Caută în această zonă
      </button>
    </div>
  );
}
