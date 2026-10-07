import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import { daysLabel, fullDateTime, relativeTime } from "@/lib/adminFormat";
import useAdminAnalytics from "./useAdminAnalytics";
import RequestsAnalyticsCard from "./RequestsAnalyticsCard";
import StatRow from "./StatRow";
import CountyCoverageCard from "./CountyCoverageCard";
import SearchInsightsCards from "./SearchInsightsCards";
import useSearchAnalytics from "./useSearchAnalytics";
import AIGuidanceCard from "./AIGuidanceCard";

const PERIODS = [7, 30, 90];
const PERIOD_OPTIONS = PERIODS.map((days) => ({ key: days, label: daysLabel(days) }));

// 2026-10-07: perioada se alege cu chip-uri, cifrele se pot actualiza oricand („Actualizat acum 3 min”),
// cererile se compară cu perioada de dinainte, iar o listă tăiată de server sau o sursă căzută se spune.
export default function AdminAnalytics({ onNavigate }) {
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const analytics = useAdminAnalytics(days);
  const search = useSearchAnalytics(days);
  const { data } = analytics;

  const refreshing = analytics.refreshing || search.refreshing;
  const refresh = () => {
    analytics.refresh();
    search.refresh();
    setRefreshKey((value) => value + 1);
  };
  // Cea mai veche dintre cele două încărcări: spunem cât de „proaspete” sunt toate cifrele.
  const stamps = [analytics.loadedAt, search.loadedAt].filter(Boolean);
  const loadedAt = stamps.length ? Math.min(...stamps) : null;

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        subtitle="Cum evoluează cererile, furnizorii și calitatea directorului."
        actions={(
          <>
            <AdminChips options={PERIOD_OPTIONS} value={days} onChange={setDays} label="Perioada" />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Actualizează
            </button>
          </>
        )}
      />
      {loadedAt && (
        <p className="mt-2 text-xs text-muted-foreground" title={fullDateTime(loadedAt)}>
          Cifre actualizate {relativeTime(loadedAt)}.
        </p>
      )}

      {!data ? (
        <div className="mt-6"><AdminLoading label="Se încarcă statisticile…" rows={4} /></div>
      ) : (
        <div className="mt-4 space-y-4">
          {data.unavailable && (
            <AdminNotice tone="warning">
              Nu am putut încărca cifrele de cereri, furnizori și director.{" "}
              <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2">Reîncearcă</button>
            </AdminNotice>
          )}
          {data.truncated && (
            <AdminNotice tone="warning">Sunt prea multe date pentru perioada aleasă și lista a fost tăiată: cifrele de la cereri pot fi parțiale.</AdminNotice>
          )}
          {search.data?.truncated && (
            <AdminNotice tone="warning">Sunt prea multe căutări pentru perioada aleasă și lista a fost tăiată: căutările pe județe și servicii pot fi parțiale.</AdminNotice>
          )}
          {search.stale && (
            <AdminNotice tone="warning">Căutările nu s-au putut actualiza; vezi cifrele de la ultima încărcare reușită.</AdminNotice>
          )}
          <RequestsAnalyticsCard data={data} days={days} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard className="p-5">
              <h3 className="mb-2 font-heading text-sm font-bold">Furnizori</h3>
              <StatRow label="Conturi Pro active (acum)" value={data.proActive} onClick={() => onNavigate("billing")} />
              <StatRow label={`Abonamente Pro noi (${daysLabel(days)})`} value={data.proNew} onClick={() => onNavigate("billing")} />
              <StatRow label={`Revendicări aprobate (${daysLabel(days)})`} value={data.claimsApproved} onClick={() => onNavigate("revendicari")} />
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
          <SearchInsightsCards data={search.data} days={days} failed={search.failed} />
          <CountyCoverageCard rows={search.data?.counties} failed={search.failed} days={days} />
          <AIGuidanceCard days={days} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}
