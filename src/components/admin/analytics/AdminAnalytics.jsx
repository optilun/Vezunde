import React, { useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import useAdminAnalytics from "./useAdminAnalytics";
import RequestsAnalyticsCard from "./RequestsAnalyticsCard";
import StatRow from "./StatRow";
import CountyCoverageCard from "./CountyCoverageCard";

const PERIODS = [7, 30, 90];

export default function AdminAnalytics({ onNavigate }) {
  const [days, setDays] = useState(30);
  const data = useAdminAnalytics(days);

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Cum evoluează cererile, furnizorii și calitatea directorului."
        actions={(
          <div className="flex rounded-lg border bg-card p-0.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setDays(p)} className={`rounded-md px-3 py-1.5 text-sm ${days === p ? "bg-foreground font-semibold text-background" : "text-muted-foreground"}`}>
                {p} zile
              </button>
            ))}
          </div>
        )}
      />

      {!data ? (
        <p className="mt-6 text-sm text-muted-foreground">Se încarcă...</p>
      ) : (
        <div className="mt-6 space-y-4">
          <RequestsAnalyticsCard data={data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard className="p-5">
              <h3 className="mb-2 font-heading text-sm font-bold">Furnizori</h3>
              <StatRow label="Conturi Pro active (acum)" value={data.proActive} onClick={() => onNavigate("billing")} />
              <StatRow label={`Abonamente Pro noi (${days} zile)`} value={data.proNew} onClick={() => onNavigate("billing")} />
              <StatRow label={`Revendicări aprobate (${days} zile)`} value={data.claimsApproved} onClick={() => onNavigate("revendicari")} />
            </AdminCard>
            <AdminCard className="p-5">
              <h3 className="mb-2 font-heading text-sm font-bold">Director (locații publicate, acum)</h3>
              <StatRow label="Doar în director" value={data.trust.directory} onClick={() => onNavigate("profiluri")} />
              <StatRow label="Revendicate" value={data.trust.claimed} onClick={() => onNavigate("profiluri")} />
              <StatRow label="Verificate" value={data.trust.verified} onClick={() => onNavigate("profiluri")} />
              <StatRow label="Suspendate" value={data.trust.suspended} onClick={() => onNavigate("profiluri")} />
              <StatRow label="Poziție pe hartă aproximativă" value={data.approxMap} onClick={() => onNavigate("data_integrity")} />
              <StatRow label="Servicii neconfirmate" value={data.unconfirmedServices} onClick={() => onNavigate("servicii")} />
            </AdminCard>
          </div>
          <CountyCoverageCard />
        </div>
      )}
    </div>
  );
}