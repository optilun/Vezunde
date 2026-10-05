import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Judete + ce cauta pacientii, calculate pe server (adminAnalyticsOps).
export default function useSearchAnalytics(days) {
  const [state, setState] = useState({ data: null, failed: false });

  useEffect(() => {
    let alive = true;
    setState({ data: null, failed: false });
    base44.functions.invoke("adminAnalyticsOps", { days })
      .then((r) => alive && setState({ data: r.data, failed: false }))
      .catch(() => alive && setState({ data: null, failed: true }));
    return () => { alive = false; };
  }, [days]);

  return state;
}