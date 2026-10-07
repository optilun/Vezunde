import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import StatRow from "./StatRow";

// Cost si viteza motorului AI: ce model a raspuns, cache, escaladari, timp mediu.
export default function AIEngineStats({ days, refreshKey = 0 }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    base44.entities.AIGuidanceObservation.aggregate({
      query: { created_date: { $gte: since }, model_used: { $exists: true, $ne: "" } },
      groupBy: ["model_used", "cache_hit", "escalated"],
      avg: "latency_ms",
      limit: 100,
    }).then((r) => alive && setRows(r.rows || [])).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [days, refreshKey]);

  if (!rows || rows.length === 0) return null;
  const sum = (fn) => rows.filter(fn).reduce((t, r) => t + r.count, 0);
  const total = sum(() => true);
  const avg = Math.round(rows.reduce((t, r) => t + (r.avg_latency_ms || 0) * r.count, 0) / total);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">Motor AI</p>
      <StatRow label="Răspunsuri din cache (fără cost)" value={sum((r) => r.cache_hit === true)} />
      <StatRow label="Model rapid" value={sum((r) => !r.cache_hit && r.model_used === "gemini_3_flash")} />
      <StatRow label="Escaladate la modelul puternic" value={sum((r) => !r.cache_hit && r.model_used !== "gemini_3_flash")} />
      <StatRow label="Timp mediu de răspuns (secunde)" value={Math.round(avg / 100) / 10} />
    </div>
  );
}
