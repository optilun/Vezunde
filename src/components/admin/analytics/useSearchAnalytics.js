import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { inWindow, sumBy } from "./analyticsWindow";

// Judete + ce cauta pacientii. Serverul (adminAnalyticsOps) intoarce o data cautarile
// pe 90 de zile, pe zile; perioada aleasa se calculeaza aici. Tinute 5 minute, cu buton de actualizare.
// `truncated` = serverul a taiat lista la limita de randuri (prea multe combinatii judet x serviciu x zi).
const TTL_MS = 5 * 60 * 1000;
let cache = null;

export default function useSearchAnalytics(days) {
  const [state, setState] = useState(() => ({ base: cache?.value || null, failed: false }));
  const [loadedAt, setLoadedAt] = useState(() => cache?.at || null);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const mine = sequence.current + 1;
    sequence.current = mine;
    setRefreshing(true);
    try {
      const response = await base44.functions.invoke("adminAnalyticsOps", {});
      if (response.data?.error) throw new Error(response.data.error);
      cache = { at: Date.now(), value: response.data };
      if (mine !== sequence.current) return;
      setState({ base: response.data, failed: false });
      setLoadedAt(cache.at);
    } catch {
      // La o actualizare esuata pastram ce aveam deja, dar spunem ca nu s-a putut actualiza.
      if (mine === sequence.current) setState((current) => ({ base: current.base, failed: true }));
    } finally {
      if (mine === sequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return undefined;
    load();
    return () => { sequence.current += 1; };
  }, [load]);

  const data = useMemo(() => {
    const base = state.base;
    if (!base) return null;
    const rows = inWindow(base.search_daily || [], days);
    const searches = Object.fromEntries(sumBy(rows, ["county_name"]).map((r) => [String(r.county_name || "").trim() || "Necunoscut", r.count]));
    const coverage = base.coverage || {};
    const names = new Set([...Object.keys(coverage.locations || {}), ...Object.keys(coverage.contacts || {}), ...Object.keys(searches)]);
    return {
      counties: [...names]
        .map((name) => ({ county: name, locations: coverage.locations?.[name] || 0, searches: searches[name] || 0, search_contacts: coverage.contacts?.[name] || 0 }))
        .sort((a, b) => b.locations - a.locations),
      top_services: sumBy(rows, ["service_key"]).slice(0, 15).map((r) => ({ service_key: r.service_key || "", count: r.count })),
      zero_results: sumBy(rows.filter((r) => r.zero_results === true), ["county_name", "service_key"]).slice(0, 20)
        .map((r) => ({ county: r.county_name || "", service_key: r.service_key || "", count: r.count })),
      truncated: Boolean(base.truncated),
    };
  }, [state.base, days]);

  // `failed` = nu avem deloc date; `stale` = avem date vechi si ultima actualizare a esuat.
  return { data, failed: state.failed && !state.base, stale: state.failed && Boolean(state.base), loadedAt, refreshing, refresh: load };
}
