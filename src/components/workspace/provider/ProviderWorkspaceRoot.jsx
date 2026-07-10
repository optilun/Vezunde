import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { getProviderNav } from "@/lib/workspaceNav";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import LocationSwitcher from "./LocationSwitcher";
import ProviderOverview from "./ProviderOverview";
import ProviderProfilePublic from "./ProviderProfilePublic";
import ProviderLocationsWithPhoto from "./ProviderLocationsWithPhoto";
import ProviderAccess from "./ProviderAccess";
import ProviderSettings from "./ProviderSettings";

export default function ProviderWorkspaceRoot({ user, workspace, onLogout, onRefresh, onSwitchPersonal }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("s") || "overview";
  const navigate = (key) => setParams({ s: key });

  const [selectedLocationId, setSelectedLocationId] = useState(workspace.memberships?.[0]?.location_id || "");
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadOverview = async (locId) => {
    if (!locId) return;
    setLoadingOverview(true);
    const res = await base44.functions.invoke("getProviderWorkspaceOverview", { location_id: locId }).catch(() => ({ data: null }));
    setOverview(res.data);
    setLoadingOverview(false);
  };

  useEffect(() => { loadOverview(selectedLocationId); }, [selectedLocationId]);

  const navItems = getProviderNav({ canManageMembers: workspace.can_manage_members });
  const allowedSections = ["overview", "profile", "locations", "access", "settings"];
  const normalizedSection = ["services", "team", "hours", "photos"].includes(section) ? "locations" : section;
  const safeSection = allowedSections.includes(normalizedSection) ? normalizedSection : "overview";
  const statusLabel = overview?.location?.profile_control_status ? (PROFILE_CONTROL_LABELS[overview.location.profile_control_status] || overview.location.profile_control_status) : "";
  const statusGreen = ["verified", "claimed"].includes(overview?.location?.profile_control_status);
  const activeLocationCount = (workspace.locations || []).filter((location) => location.active_status !== "inactiva" && location.status !== "suspendata").length;
  const multiLocation = activeLocationCount >= 2;

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={safeSection}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={overview?.location?.organization_name || overview?.location?.name || "Workspace furnizor"}
      subtitle="Workspace furnizor"
      publicProfileUrl={selectedLocationId ? `/furnizor/${selectedLocationId}` : null}
      modeSwitch={{ label: "Cont personal", onClick: onSwitchPersonal }}
      statusBadge={(statusLabel || multiLocation) ? (
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          {statusLabel && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusGreen ? "bg-green-100 text-green-800" : "bg-secondary text-foreground"}`}>{statusLabel}</span>}
          {multiLocation && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">Organizație cu {activeLocationCount} locații</span>}
        </span>
      ) : null}
    >
      {workspace.memberships?.length > 1 && (
        <LocationSwitcher memberships={workspace.memberships} selectedLocationId={selectedLocationId} onSelect={setSelectedLocationId} />
      )}
      {loadingOverview || !overview ? (
        <p className="text-sm text-muted-foreground">Se incarca...</p>
      ) : (
        <>
          {safeSection === "overview" && <ProviderOverview overview={overview} onNavigate={navigate} />}
          {safeSection === "profile" && <ProviderProfilePublic locationId={selectedLocationId} overview={overview} workspace={workspace} onNavigate={navigate} onSelectLocation={setSelectedLocationId} onRefresh={() => loadOverview(selectedLocationId)} />}
          {safeSection === "locations" && <ProviderLocationsWithPhoto workspace={workspace} selectedLocationId={selectedLocationId} onSelect={setSelectedLocationId} overview={overview} onRefresh={() => loadOverview(selectedLocationId)} />}
          {safeSection === "access" && workspace.can_manage_members && <ProviderAccess locations={workspace.locations} />}
          {safeSection === "settings" && <ProviderSettings />}
        </>
      )}
    </ProviderAppShell>
  );
}
