import React from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminCard from "@/components/admin/ui/AdminCard";
import { daysLabel } from "@/lib/adminFormat";
import { changeBetween } from "./analyticsWindow";
import StatRow from "./StatRow";

const sumWhere = (rows, field, keys) => (rows ? rows.filter((r) => keys.includes(r[field])).reduce((s, r) => s + (r.count || 0), 0) : null);
const total = (rows) => (rows ? rows.reduce((s, r) => s + (r.count || 0), 0) : null);

// Etapele în care o cerere a ajuns cel puțin până aici.
const SENT = ["distributed", "waiting_responses", "has_responses", "conversation_active", "resolved"];
const ANSWERED = ["has_responses", "conversation_active", "resolved"];

export default function RequestsAnalyticsCard({ data, days }) {
  const { stages, perDay, responses, previous } = data;
  const chart = (perDay || []).map((r) => {
    const key = Object.keys(r).find((k) => k !== "count");
    return { label: new Date(r[key]).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }), count: r.count };
  });
  // Săgețile compară cu perioada de dinainte, de aceeași lungime; peste 90 de zile nu avem istoric.
  const since = previous ? `cele ${daysLabel(days)} dinainte` : undefined;
  const compare = (current, before) => (previous ? changeBetween(current, before) : null);

  const created = total(stages);
  const sent = sumWhere(stages, "lifecycle_stage", SENT);
  const answered = sumWhere(stages, "lifecycle_stage", ANSWERED);
  const resolved = sumWhere(stages, "lifecycle_stage", ["resolved"]);
  const canHelp = sumWhere(responses, "response_type", ["can_help"]);

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-bold">Cereri pacienți</h3>
        {previous && <p className="text-xs text-muted-foreground">Săgețile compară cu cele {daysLabel(days)} dinainte.</p>}
      </div>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-0.5">
          <StatRow label="Cereri create" value={created} change={compare(created, total(previous?.stages))} changeSince={since} />
          <StatRow label="Trimise către furnizori" value={sent} change={compare(sent, sumWhere(previous?.stages, "lifecycle_stage", SENT))} changeSince={since} />
          <StatRow label="Cu cel puțin un răspuns" value={answered} change={compare(answered, sumWhere(previous?.stages, "lifecycle_stage", ANSWERED))} changeSince={since} />
          <StatRow label="Rezolvate" value={resolved} change={compare(resolved, sumWhere(previous?.stages, "lifecycle_stage", ["resolved"]))} changeSince={since} />
          <StatRow label="Răspunsuri „pot ajuta”" value={canHelp} change={compare(canHelp, sumWhere(previous?.responses, "response_type", ["can_help"]))} changeSince={since} />
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
