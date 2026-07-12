import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import KpiGrid from "./KpiGrid";
import ResearchPipelineCard from "./ResearchPipelineCard";
import ProfilesTrustCard from "./ProfilesTrustCard";
import GeoCoverageCard from "./GeoCoverageCard";
import ActionQueueCard from "./ActionQueueCard";
import RecentActivityCard from "./RecentActivityCard";
import QuickActionsGrid from "./QuickActionsGrid";

const TOTAL_COUNTIES = 42;
const pj = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (_error) {
    return fallback;
  }
};

const safeInvoke = (functionName, payload, fallback) => (
  base44.functions
    .invoke(functionName, payload)
    .catch(() => ({ data: fallback }))
);

function uniqueById(rows = []) {
  return rows.filter((row, index, allRows) => row?.id && allRows.findIndex((item) => item?.id === row.id) === index);
}

export default function AdminDashboardHome({ onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ProviderLocation.list(null, 500),
      base44.entities.LocationService.list(null, 2000),
      base44.entities.ProviderClaimRequest.filter({ status: "in_asteptare" }, null, 200),
      base44.entities.AIResearchDraft.list("-created_date", 200),
      base44.entities.ResearchSource.list("-created_date", 200),
      base44.entities.DirectoryAuditRecord.list("-created_date", 200),
      safeInvoke("adminServiceConfigurationReview", { action: "list", status: "pending_review" }, { submissions: [] }),
      safeInvoke("adminOrganizationProfileReview", { action: "list", status: "pending_review" }, { submissions: [] }),
      safeInvoke("providerLocationExpansionOps", { action: "admin_list" }, { submissions: [] }),
      safeInvoke("adminProfessionalProfileReview", { action: "list", status: "pending_review" }, { profiles: [] }),
    ]).then(([
      locations,
      services,
      claims,
      drafts,
      sources,
      audit,
      workspaceResponse,
      organizationResponse,
      newLocationResponse,
      professionalResponse,
    ]) => {
      const generalPending = (workspaceResponse.data?.submissions || []).filter(
        (submission) => !(submission.section === "public_profile" && submission.organization_id),
      );
      const organizationPending = organizationResponse.data?.submissions || [];
      const reviewSubmissions = uniqueById([...generalPending, ...organizationPending]);

      setData({
        locations,
        services,
        claims,
        drafts,
        sources,
        audit,
        reviewSubmissions,
        newLocationReviews: newLocationResponse.data?.submissions || [],
        professionalReviews: professionalResponse.data?.profiles || [],
      });
    });
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;

  const {
    locations,
    services,
    claims,
    drafts,
    sources,
    audit,
    reviewSubmissions,
    newLocationReviews,
    professionalReviews,
  } = data;

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentAuditCount = audit.filter((record) => {
    const raw = record.performed_at || record.created_date;
    const timestamp = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
  }).length;

  const reviewQueueCount = reviewSubmissions.length + newLocationReviews.length + professionalReviews.length;
  const directoryProfiles = locations.filter((location) => (location.profile_control_status || "directory") === "directory").length;
  const unconfirmedServices = services.filter((service) => (service.confirmation_level || "not_confirmed") === "not_confirmed").length;
  const activeResearchDrafts = drafts.filter((draft) => ["draft", "in_review", "ready_to_transfer"].includes(draft.status)).length;

  const stats = {
    published: locations.filter((location) => location.status === "publicata").length,
    reviewQueue: reviewQueueCount,
    pendingClaims: claims.length,
    unconfirmedServices,
    activeResearchDrafts,
    directoryProfiles,
    countiesCovered: new Set(locations.map((location) => location.county_name || location.county).filter(Boolean)).size,
    totalCounties: TOTAL_COUNTIES,
    recentAuditCount,
  };

  const pipeline = {
    sources: sources.length,
    drafts: drafts.length,
    inReview: drafts.filter((draft) => draft.status === "in_review").length,
    readyToTransfer: drafts.filter((draft) => draft.status === "ready_to_transfer").length,
    rejected: drafts.filter((draft) => draft.status === "rejected").length,
  };

  const pcsCounts = { directory: 0, claimed: 0, verified: 0, suspended: 0 };
  for (const location of locations) {
    const key = location.profile_control_status || "directory";
    pcsCounts[key] = (pcsCounts[key] || 0) + 1;
  }

  const geo = {
    locationsCount: locations.length,
    countiesWithLocations: stats.countiesCovered,
    countiesWithoutLocations: Math.max(TOTAL_COUNTIES - stats.countiesCovered, 0),
    localitiesPublished: new Set(
      locations
        .filter((location) => location.status === "publicata")
        .map((location) => location.locality_siruta_code)
        .filter(Boolean),
    ).size,
  };

  const actionItems = [
    { label: "Cereri in coada de verificare", count: reviewQueueCount, tab: "workspace_reviews" },
    { label: "Revendicari noi", count: claims.length, tab: "revendicari" },
    { label: "Profiluri directory neverificate", count: directoryProfiles, tab: "profiluri" },
    { label: "Servicii care necesita confirmare", count: unconfirmedServices, tab: "servicii" },
    {
      label: "Surse sau drafturi cu conflicte",
      count: drafts.filter((draft) => pj(draft.conflicts_json, []).length > 0).length,
      tab: "research",
    },
    {
      label: "Locatii care necesita reverificare",
      count: locations.filter((location) => location.next_recheck_at && new Date(location.next_recheck_at) < new Date()).length,
      tab: "research",
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Panou general"
        subtitle="Vezi starea directorului, cozile operationale si progresul acoperirii."
        actions={(
          <>
            <button onClick={() => onNavigate("adauga")} className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Adauga organizatie / locatie
            </button>
            <button onClick={() => onNavigate("workspace_reviews")} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">
              Deschide coada
            </button>
          </>
        )}
      />

      <KpiGrid stats={stats} onNavigate={onNavigate} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ResearchPipelineCard pipeline={pipeline} onNavigate={onNavigate} />
        <ProfilesTrustCard counts={pcsCounts} total={locations.length} />
        <GeoCoverageCard geo={geo} />
        <ActionQueueCard items={actionItems} onNavigate={onNavigate} />
      </div>

      <div className="mt-4">
        <RecentActivityCard records={audit} onNavigate={onNavigate} />
      </div>

      <h2 className="mb-3 mt-8 font-heading text-sm font-bold">Actiuni rapide</h2>
      <QuickActionsGrid onNavigate={onNavigate} />
    </div>
  );
}
