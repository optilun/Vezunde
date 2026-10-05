import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Judete + ce cauta pacientii, calculate pe server (adminAnalyticsOps).
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

export default function useSearchAnalytics(days) {
  const [state, setState] = useState(() => ({ data: cache.get(days)?.value || null, failed: false }));

  useEffect(() => {
    let alive = true;
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < TTL_MS) { setState({ data: hit.value, failed: false }); return undefined; }
    setState({ data: null, failed: false });
    base44.functions.invoke("adminAnalyticsOps", { days })
      .then((r) => {
        cache.set(days, { at: Date.now(), value: r.data });
        if (alive) setState({ data: r.data, failed: false });
      })
      .catch(() => alive && setState({ data: null, failed: true }));
    return () => { alive = false; };
  }, [days]);

  return state;
}