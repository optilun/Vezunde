import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { getProviderNav } from "@/lib/workspaceNav";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import LocationSwitcher from "./LocationSwitcher";
import ProviderOverview from "./ProviderOverview";
import ProviderProfilePublic from "./ProviderProfilePublic";
import ProviderLocations from "./ProviderLocations";
import ProviderServices from "./ProviderServices";
import ProviderTeam from "./ProviderTeam";
import ProviderHours from "./ProviderHours";
import ProviderMedia from "./ProviderMedia";
import ProviderArticles from "./ProviderArticles";
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
  const statusLabel = overview?.location?.profile_control_status ? (PROFILE_CONTROL_LABELS[overview.location.profile_control_status] || overview.location.profile_control_status) : "";
  const statusGreen = ["verified", "claimed"].includes(overview?.location?.profile_control_status);

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={overview?.location?.organization_name || overview?.location?.name || "Workspace furnizor"}
      subtitle="Workspace furnizor"
      publicProfileUrl={selectedLocationId ? `/furnizor/${selectedLocationId}` : null}
      modeSwitch={{ label: "Cont personal", onClick: onSwitchPersonal }}
      statusBadge={statusLabel ? (
        <span className={`hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusGreen ? "bg-green-100 text-green-800" : "bg-secondary text-foreground"}`}>{statusLabel}</span>
      ) : null}
    >
      {workspace.memberships?.length > 1 && (
        <LocationSwitcher memberships={workspace.memberships} selectedLocationId={selectedLocationId} onSelect={setSelectedLocationId} />
      )}
      {loadingOverview || !overview ? (
        <p className="text-sm text-muted-foreground">Se incarca...</p>
      ) : (
        <>
          {section === "overview" && <ProviderOverview overview={overview} onNavigate={navigate} />}
          {section === "profile" && <ProviderProfilePublic locationId={selectedLocationId} overview={overview} workspace={workspace} onNavigate={navigate} onSelectLocation={setSelectedLocationId} onRefresh={() => loadOverview(selectedLocationId)} />}
          {section === "locations" && <ProviderLocations workspace={workspace} selectedLocationId={selectedLocationId} onSelect={setSelectedLocationId} />}
          {section === "services" && <ProviderServices locationId={selectedLocationId} overview={overview} onRefresh={() => loadOverview(selectedLocationId)} />}
          {section === "team" && <ProviderTeam locationId={selectedLocationId} />}
          {section === "hours" && <ProviderHours locationId={selectedLocationId} onRefresh={() => loadOverview(selectedLocationId)} />}
          {section === "media" && <ProviderMedia locationId={selectedLocationId} />}
          {section === "articles" && <ProviderArticles locationId={selectedLocationId} />}
          {section === "access" && workspace.can_manage_members && <ProviderAccess locations={workspace.locations} />}
          {section === "settings" && <ProviderSettings />}
        </>
      )}
    </ProviderAppShell>
  );
}