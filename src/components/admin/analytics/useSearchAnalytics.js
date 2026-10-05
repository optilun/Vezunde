import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { inWindow, sumBy } from "./analyticsWindow";

// Judete + ce cauta pacientii. Serverul (adminAnalyticsOps) intoarce o data cautarile
// pe 90 de zile, pe zile; perioada aleasa se calculeaza aici. Tinute 5 minute.
const TTL_MS = 5 * 60 * 1000;
let cache = null;

export default function useSearchAnalytics(days) {
  const [state, setState] = useState(() => ({ base: cache?.value || null, failed: false }));

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return undefined;
    let alive = true;
    base44.functions.invoke("adminAnalyticsOps", {})
      .then((r) => {
        cache = { at: Date.now(), value: r.data };
        if (alive) setState({ base: r.data, failed: false });
      })
      .catch(() => alive && setState({ base: null, failed: true }));
    return () => { alive = false; };
  }, []);

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
    };
  }, [state.base, days]);

  return { data, failed: state.failed };
}