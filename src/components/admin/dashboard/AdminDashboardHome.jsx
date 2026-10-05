import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import KpiGrid from "./KpiGrid";
import ActionQueueCard from "./ActionQueueCard";
import RecentActivityCard from "./RecentActivityCard";
import QuickActionsGrid from "./QuickActionsGrid";

// 2026-10-05: panoul "Azi". Toate cifrele se numara pe server (count), fara a
// descarca mii de inregistrari in browser. Statisticile de director (research,
// acoperire judete, niveluri de incredere) se muta in ecranul Analytics.
const safeInvoke = (functionName, payload, fallback) => (
  base44.functions.invoke(functionName, payload).catch(() => ({ data: fallback }))
);
const safeCount = (entity, query) => entity.count(query).catch(() => 0);

function uniqueById(rows = []) {
  const seen = new Set();
  return rows.filter((row) => row?.id && !seen.has(row.id) && seen.add(row.id));
}

export default function AdminDashboardHome({ onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const e = base44.entities;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      safeCount(e.ProviderLocation, { status: "publicata" }),
      safeCount(e.ProviderClaimRequest, { status: "in_asteptare" }),
      safeCount(e.SupportTicket, { status: { $in: ["open", "in_progress", "waiting_user"] } }),
      safeCount(e.DirectoryCorrectionRequest, { status: { $in: ["submitted", "in_review"] } }),
      safeCount(e.PatientRequest, { created_date: { $gte: weekAgo } }),
      safeCount(e.ProviderSubscription, { plan_code: "pro", status: { $in: ["active", "trialing", "grace_period"] } }),
      safeCount(e.ProviderLocation, { profile_control_status: { $in: ["claimed", "verified"] } }),
      e.DirectoryAuditRecord.filter({}, { sort: "-created_date", limit: 6 }).then((page) => page.items || []).catch(() => []),
      safeInvoke("adminServiceConfigurationReview", { action: "list", status: "pending_review" }, { submissions: [] }),
      safeInvoke("adminOrganizationProfileReview", { action: "list", status: "pending_review" }, { submissions: [] }),
      safeInvoke("providerLocationExpansionOps", { action: "admin_list" }, { submissions: [] }),
      safeInvoke("adminProfessionalProfileReview", { action: "list", status: "pending_review" }, { profiles: [] }),
    ]).then(([published, claims, tickets, corrections, patientRequests, proAccounts, claimedProfiles, audit, ws, org, newLoc, prof]) => {
      const general = (ws.data?.submissions || []).filter((s) => !(s.section === "public_profile" && s.organization_id));
      const reviewQueue = uniqueById([...general, ...(org.data?.submissions || [])]).length
        + (newLoc.data?.submissions || []).length
        + (prof.data?.profiles || []).length;
      setData({ published, claims, tickets, corrections, patientRequests, proAccounts, claimedProfiles, audit, reviewQueue });
    });
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Se încarcă...</p>;

  const actionItems = [
    { label: "Coada de verificare", count: data.reviewQueue, tab: "workspace_reviews" },
    { label: "Revendicări noi", count: data.claims, tab: "revendicari" },
    { label: "Tichete de suport active", count: data.tickets, tab: "support_tickets" },
    { label: "Sesizări de director deschise", count: data.corrections, tab: "corectii" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Azi"
        subtitle="Ce ai de rezolvat acum și starea pe scurt a platformei."
        actions={(
          <button onClick={() => onNavigate("adauga")} className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Adaugă organizație / locație
          </button>
        )}
      />

      <div className="mt-6">
        <ActionQueueCard items={actionItems} onNavigate={onNavigate} />
      </div>

      <KpiGrid stats={data} onNavigate={onNavigate} />

      <div className="mt-4">
        <RecentActivityCard records={data.audit} onNavigate={onNavigate} />
      </div>

      <h2 className="mb-3 mt-8 font-heading text-sm font-bold">Acțiuni rapide</h2>
      <QuickActionsGrid onNavigate={onNavigate} />
    </div>
  );
}