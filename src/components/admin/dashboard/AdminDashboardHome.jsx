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

const TOTAL_COUNTIES = 42; // Romania: 41 judete + Bucuresti — factual constant, not app data.
const pj = (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };

// UI-1 PART 2/3: modern operational dashboard home. Reads existing entities
// only — creates nothing, changes no business logic.
export default function AdminDashboardHome({ onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ProviderLocation.list(null, 500),
      base44.entities.LocationService.list(null, 2000),
      base44.entities.ProviderClaimRequest.filter({ status: "in_asteptare" }, null, 200),
      base44.entities.AIResearchDraft.list("-created_date", 200),
      base44.entities.ResearchSource.list("-created_date", 200),
      base44.entities.DirectoryAuditRecord.list("-created_date", 15),
    ]).then(([locations, services, claims, drafts, sources, audit]) => setData({ locations, services, claims, drafts, sources, audit }));
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;
  const { locations, services, claims, drafts, sources, audit } = data;

  const stats = {
    published: locations.filter((l) => l.status === "publicata").length,
    toVerify: locations.filter((l) => (l.profile_control_status || "directory") === "directory").length,
    pendingClaims: claims.length,
    unconfirmedServices: services.filter((s) => (s.confirmation_level || "not_confirmed") === "not_confirmed").length,
    draftsInReview: drafts.filter((d) => ["draft", "in_review"].includes(d.status)).length,
    incompleteProfiles: locations.filter((l) => !l.source_url || !l.address).length,
    countiesCovered: new Set(locations.map((l) => l.county_name || l.county).filter(Boolean)).size,
    totalCounties: TOTAL_COUNTIES,
    recentActivityCount: audit.length,
  };

  const pipeline = {
    sources: sources.length,
    drafts: drafts.length,
    inReview: drafts.filter((d) => d.status === "in_review").length,
    readyToTransfer: drafts.filter((d) => d.status === "ready_to_transfer").length,
    rejected: drafts.filter((d) => d.status === "rejected").length,
  };

  const pcsCounts = { directory: 0, claimed: 0, verified: 0, suspended: 0 };
  for (const l of locations) pcsCounts[l.profile_control_status || "directory"] = (pcsCounts[l.profile_control_status || "directory"] || 0) + 1;

  const geo = {
    locationsCount: locations.length,
    countiesWithLocations: stats.countiesCovered,
    countiesWithoutLocations: Math.max(TOTAL_COUNTIES - stats.countiesCovered, 0),
    localitiesPublished: new Set(locations.filter((l) => l.status === "publicata").map((l) => l.locality_siruta_code).filter(Boolean)).size,
  };

  const actionItems = [
    { label: "Revendicari noi", count: claims.length, tab: "revendicari" },
    { label: "Profile incomplete", count: stats.incompleteProfiles, tab: "profiluri" },
    { label: "Servicii care necesita confirmare", count: stats.unconfirmedServices, tab: "servicii" },
    { label: "Schimbari de profil in review", count: locations.filter((l) => l.pending_changes).length, tab: "profiluri" },
    { label: "Surse/drafturi cu conflicte", count: drafts.filter((d) => pj(d.conflicts_json, []).length > 0).length, tab: "ai" },
    { label: "Locatii care necesita reverificare", count: locations.filter((l) => l.next_recheck_at && new Date(l.next_recheck_at) < new Date()).length, tab: "research" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Panou general"
        subtitle="Vezi starea directorului, activitatile care necesita atentie si progresul acoperirii."
        actions={<>
          <button onClick={() => onNavigate("adauga")} className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold">Adauga locatie</button>
          <button onClick={() => onNavigate("ai")} className="px-4 py-2 rounded-lg bg-secondary text-sm font-semibold">Deschide AI Copilot</button>
        </>}
      />

      <KpiGrid stats={stats} onNavigate={onNavigate} />

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <ResearchPipelineCard pipeline={pipeline} onNavigate={onNavigate} />
        <ProfilesTrustCard counts={pcsCounts} total={locations.length} />
        <GeoCoverageCard geo={geo} />
        <ActionQueueCard items={actionItems} onNavigate={onNavigate} />
      </div>

      <div className="mt-4">
        <RecentActivityCard records={audit} onNavigate={onNavigate} />
      </div>

      <h2 className="font-heading font-bold text-sm mt-8 mb-3">Actiuni rapide</h2>
      <QuickActionsGrid onNavigate={onNavigate} />
    </div>
  );
}