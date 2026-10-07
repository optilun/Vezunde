import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { loadDashboardKpis, loadRecentActivity, summarizeCounts } from "@/lib/adminCounts";
import { plural } from "@/lib/adminFormat";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import KpiGrid from "./KpiGrid";
import ActionQueueCard from "./ActionQueueCard";
import RecentActivityCard from "./RecentActivityCard";
import QuickLinks from "./QuickLinks";

// 2026-10-05: panoul "Azi". Toate cifrele se numara pe server (count), fara a descarca mii de
// inregistrari in browser. Statisticile de director (research, acoperire judete, niveluri de
// incredere) se muta in ecranul Analytics.
// 2026-10-07: "De rezolvat acum" citeste aceleasi numaratori ca meniul si taburile Cozii (o singura
// sursa, reimprospatata singura), si nu mai spune "Totul e la zi" cat timp ceva nu e verificat.
export default function AdminDashboardHome({ onNavigate }) {
  const { user } = useAuth();
  const { counts, refreshing, refresh } = useAdminCounts();
  const [kpis, setKpis] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    let alive = true;
    loadDashboardKpis(base44).then((value) => { if (alive) setKpis(value); });
    loadRecentActivity(base44).then((rows) => { if (alive) setActivity(rows ?? "error"); });
    return () => { alive = false; };
  }, []);

  const summary = useMemo(() => summarizeCounts(counts), [counts]);

  let subtitle = "Se verifică ce așteaptă…";
  if (summary.loaded) {
    if (summary.rows.length > 0) subtitle = `${plural(summary.total, "lucru", "lucruri")} de rezolvat.`;
    else if (summary.allClear) subtitle = "Totul e la zi.";
    else subtitle = "Nu am putut verifica tot. Reîncearcă.";
  }

  return (
    <div>
      <AdminPageHeader title="Azi" subtitle={subtitle} />

      <div className="mt-6">
        <ActionQueueCard summary={summary} refreshing={refreshing} onRefresh={refresh} onNavigate={onNavigate} />
      </div>

      <KpiGrid stats={kpis} onNavigate={onNavigate} />

      <div className="mt-4">
        <RecentActivityCard records={activity} currentEmail={user?.email} onNavigate={onNavigate} />
      </div>

      <div className="mt-8">
        <QuickLinks onNavigate={onNavigate} />
      </div>
    </div>
  );
}
