import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadAdminCounts } from "@/lib/adminCounts";
import { FOCUS_REFRESH_MIN_INTERVAL_MS } from "@/lib/focusRefreshGate";

// Numărătorile „ce așteaptă după mine” (2026-10-07): o singură încărcare pentru Panou, meniu și
// taburile Cozii de verificare, reîmprospătată singură (la 60 s și când revii în fereastră).
// Ecranele care iau o decizie (aprobare, respingere…) apelează `refresh()` ca numerele să se
// schimbe imediat, nu abia la următoarea reîmprospătare.
const CountsContext = createContext({ counts: null, refreshing: false, refresh: () => {} });

const AUTO_REFRESH_MS = 60_000;
// Aceeași pauză minimă ca în contul de furnizor (src/lib/focusRefreshGate.js): trecerea repetată între
// ferestre nu mai pornește câte o rafală de cereri, iar platforma nu mai răspunde „Rate limit exceeded”.
const MIN_GAP_MS = FOCUS_REFRESH_MIN_INTERVAL_MS;

export function AdminCountsProvider({ children }) {
  const [counts, setCounts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const lastLoadAt = useRef(0);

  const load = useCallback(async ({ force = false } = {}) => {
    if (inFlight.current) return;
    if (!force && Date.now() - lastLoadAt.current < MIN_GAP_MS) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      setCounts(await loadAdminCounts(base44));
      lastLoadAt.current = Date.now();
    } catch {
      // Fiecare număr își gestionează singur eșecul (devine „indisponibil”); aici nu e nimic de făcut.
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load({ force: true });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, AUTO_REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  const value = useMemo(() => ({ counts, refreshing, refresh }), [counts, refreshing, refresh]);
  return <CountsContext.Provider value={value}>{children}</CountsContext.Provider>;
}

export function useAdminCounts() {
  return useContext(CountsContext);
}
