import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { getProviderNav } from "@/lib/workspaceNav";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import LocationSwitcher from "./LocationSwitcher";
import ProviderOverview from "./ProviderOverview";
import ProviderProfilePublic from "./ProviderProfilePublic";
import ProviderLocationsWithPhoto from "./ProviderLocationsWithPhoto";
import ProviderLocationModulePage from "./ProviderLocationModulePage";
import ProviderAccess from "./ProviderAccess";
import ProviderSettings from "./ProviderSettings";

const LOCATION_MODULES = new Set(["servicii", "program", "specialisti"]);

export default function ProviderWorkspaceRoot({ user, workspace, onLogout, onRefresh, onSwitchPersonal }) {
  const [params] = useSearchParams();
  const routerNavigate = useNavigate();
  const { locationId: routeLocationId, locationModule } = useParams();
  const activeLocationModule = LOCATION_MODULES.has(locationModule) ? locationModule : null;
  const requestedSection = params.get("s") || "overview";

  const locations = workspace.locations || [];
  const initialLocationId = locations.some((location) => location.id === routeLocationId)
    ? routeLocationId
    : workspace.memberships?.[0]?.location_id || locations[0]?.id || "";
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const loadOverview = async (locId) => {
    if (!locId) return;
    setLoadingOverview(true);
    const res = await base44.functions.invoke("getProviderWorkspaceOverview", { location_id: locId }).catch(() => ({ data: null }));
    setOverview(res.data);
    setLoadingOverview(false);
  };

  useEffect(() => {
    const routeLocationExists = locations.some((location) => location.id === routeLocationId);
    if (routeLocationExists && routeLocationId !== selectedLocationId) {
      setSelectedLocationId(routeLocationId);
      return;
    }
    if (!locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(workspace.memberships?.[0]?.location_id || locations[0]?.id || "");
    }
  }, [routeLocationId, selectedLocationId, locations, workspace.memberships]);

  useEffect(() => {
    loadOverview(selectedLocationId);
  }, [selectedLocationId]);

  const goToSection = (key) => {
    routerNavigate(`/contul-meu?s=${key}`);
  };

  const selectLocation = (locationId) => {
    setSelectedLocationId(locationId);
    if (activeLocationModule) {
      routerNavigate(`/contul-meu/locatii/${locationId}/${activeLocationModule}`);
    }
  };

  const openLocationModule = (moduleKey, locationId = selectedLocationId) => {
    if (!LOCATION_MODULES.has(moduleKey) || !locationId) return;
    setSelectedLocationId(locationId);
    routerNavigate(`/contul-meu/locatii/${locationId}/${moduleKey}`);
  };

  const closeLocationModule = () => {
    routerNavigate("/contul-meu?s=locations");
  };

  const navItems = getProviderNav({ canManageMembers: workspace.can_manage_members });
  const allowedSections = ["overview", "profile", "locations", "access", "settings"];
  const normalizedSection = ["services", "team", "hours", "photos"].includes(requestedSection) ? "locations" : requestedSection;
  const safeSection = activeLocationModule
    ? "locations"
    : allowedSections.includes(normalizedSection)
      ? normalizedSection
      : "overview";
  const statusLabel = overview?.location?.profile_control_status ? (PROFILE_CONTROL_LABELS[overview.location.profile_control_status] || overview.location.profile_control_status) : "";
  const statusGreen = ["verified", "claimed"].includes(overview?.location?.profile_control_status);
  const activeLocationCount = locations.filter((location) => location.active_status !== "inactiva" && location.status !== "suspendata").length;
  const multiLocation = activeLocationCount >= 2;

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={safeSection}
      onNavigate={goToSection}
      user={user}
      onLogout={onLogout}
      title={overview?.location?.organization_name || overview?.location?.name || "Workspace furnizor"}
      subtitle="Workspace furnizor"
      publicProfileUrl={selectedLocationId ? `/furnizor/${selectedLocationId}` : null}
      modeSwitch={{ label: "Cont personal", onClick: onSwitchPersonal }}
      statusBadge={(statusLabel || multiLocation) ? (
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          {statusLabel && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusGreen ? "bg-green-100 text-green-800" : "bg-secondary text-foreground"}`}>{statusLabel}</span>}
          {multiLocation && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">Organizatie cu {activeLocationCount} locatii</span>}
        </span>
      ) : null}
    >
      {workspace.memberships?.length > 1 && (
        <LocationSwitcher memberships={workspace.memberships} selectedLocationId={selectedLocationId} onSelect={selectLocation} />
      )}
      {loadingOverview || !overview ? (
        <p className="text-sm text-muted-foreground">Se incarca...</p>
      ) : (
        <>
          {safeSection === "overview" && <ProviderOverview overview={overview} onNavigate={goToSection} />}
          {safeSection === "profile" && <ProviderProfilePublic locationId={selectedLocationId} overview={overview} workspace={workspace} onNavigate={goToSection} onSelectLocation={selectLocation} onRefresh={() => loadOverview(selectedLocationId)} />}
          {safeSection === "locations" && activeLocationModule && (
            <ProviderLocationModulePage
              workspace={workspace}
              locationId={selectedLocationId}
              moduleKey={activeLocationModule}
              overview={overview}
              onBack={closeLocationModule}
              onRefresh={() => loadOverview(selectedLocationId)}
            />
          )}
          {safeSection === "locations" && !activeLocationModule && (
            <ProviderLocationsWithPhoto
              workspace={workspace}
              selectedLocationId={selectedLocationId}
              onSelect={selectLocation}
              overview={overview}
              onRefresh={() => loadOverview(selectedLocationId)}
              onOpenModule={openLocationModule}
            />
          )}
          {safeSection === "access" && workspace.can_manage_members && <ProviderAccess locations={workspace.locations} />}
          {safeSection === "settings" && <ProviderSettings />}
        </>
      )}
    </ProviderAppShell>
  );
}
