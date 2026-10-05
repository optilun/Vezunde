import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import StatRow from "./StatRow";
import AIEngineStats from "./AIEngineStats";

// Comparatia AI (in umbra) vs sistemul fix. Un singur aggregate pe perioada aleasa.
const LABELS = {
  agree: "De acord", partial: "Parțial de acord", disagree: "În dezacord", not_comparable: "Necomparabil",
};

export default function AIGuidanceCard({ days }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    base44.entities.AIGuidanceObservation.aggregate({
      query: { created_date: { $gte: since } },
      groupBy: ["ai_status", "service_agreement", "conflict_detected"],
      limit: 1000,
    }).then((r) => alive && setRows(r.rows || [])).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [days]);

  const sum = (fn) => (rows || []).filter(fn).reduce((t, r) => t + r.count, 0);
  const total = sum(() => true);
  const completed = sum((r) => r.ai_status === "completed");

  return (
    <AdminCard className="p-5">
      <h3 className="font-heading text-sm font-bold">AI la cereri: comparație cu sistemul fix ({days} zile)</h3>
      <p className="mb-2 text-xs text-muted-foreground">Doar observație. AI-ul nu schimbă încă nimic pentru pacienți.</p>
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Se încarcă...</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">Încă nu există observații în această perioadă.</p>
      ) : (
        <>
          <StatRow label="Interpretări încercate" value={total} />
          <StatRow label="AI indisponibil sau eșuat" value={total - completed} />
          {Object.entries(LABELS).map(([key, label]) => (
            <StatRow key={key} label={`Servicii: ${label}`} value={sum((r) => r.ai_status === "completed" && r.service_agreement === key)} />
          ))}
          <StatRow label="Conflicte cu regulile fixe" value={sum((r) => r.conflict_detected === true)} />
          <AIEngineStats days={days} />
        </>
      )}
    </AdminCard>
  );
}