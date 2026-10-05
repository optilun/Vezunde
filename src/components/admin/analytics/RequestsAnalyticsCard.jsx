import React from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminCard from "@/components/admin/ui/AdminCard";
import StatRow from "./StatRow";

const sumWhere = (rows, field, keys) => (rows ? rows.filter((r) => keys.includes(r[field])).reduce((s, r) => s + (r.count || 0), 0) : null);

export default function RequestsAnalyticsCard({ data }) {
  const { stages, perDay, responses } = data;
  const total = stages ? stages.reduce((s, r) => s + (r.count || 0), 0) : null;
  const chart = (perDay || []).map((r) => {
    const key = Object.keys(r).find((k) => k !== "count");
    return { label: new Date(r[key]).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }), count: r.count };
  });

  return (
    <AdminCard className="p-5">
      <h3 className="font-heading text-sm font-bold">Cereri pacienți</h3>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-0.5">
          <StatRow label="Cereri create" value={total} />
          <StatRow label="Trimise către furnizori" value={sumWhere(stages, "lifecycle_stage", ["distributed", "waiting_responses", "has_responses", "conversation_active", "resolved"])} />
          <StatRow label="Cu cel puțin un răspuns" value={sumWhere(stages, "lifecycle_stage", ["has_responses", "conversation_active", "resolved"])} />
          <StatRow label="Rezolvate" value={sumWhere(stages, "lifecycle_stage", ["resolved"])} />
          <StatRow label="Răspunsuri „pot ajuta”" value={sumWhere(responses, "response_type", ["can_help"])} />
          <StatRow label="Răspunsuri „nu pot ajuta”" value={sumWhere(responses, "response_type", ["cannot_help"])} />
        </div>
        <div className="h-48">
          {chart.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Nicio cerere în perioada aleasă.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip formatter={(v) => [v, "Cereri"]} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AdminCard>
  );
}