import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { getProviderNav } from "@/lib/workspaceNav";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";
import { readAccountPreferences, rememberProviderLocation } from "@/lib/accountPreferences";
import LocationSwitcher from "./LocationSwitcher";
const ProviderOverview = lazy(() => import("./ProviderOverview"));
const ProviderProfilePublic = lazy(() => import("./ProviderProfilePublic"));
const ProviderLocationsWithPhoto = lazy(() => import("./ProviderLocationsWithPhoto"));
const ProviderLocationModulePage = lazy(() => import("./ProviderLocationModulePage"));
const ProviderAccess = lazy(() => import("./ProviderAccess"));
const ProviderSettings = lazy(() => import("./ProviderSettings"));

function WorkspaceSectionLoading() {
  return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">Se încarcă secțiunea...</div>;
}

const LOCATION_MODULES = new Set(["servicii", "program", "specialisti"]);
const LOCATION_MODULE_CAPABILITIES = {
  servicii: "location.manage_content",
  program: "location.manage_operational_status",
  specialisti: "location.manage_specialists",
};

const ROLE_CAPABILITIES = {
  organization_owner: [
    "organization.view",
    "organization.manage_profile",
    "organization.manage_locations",
    "organization.manage_members",
    "organization.manage_settings",
    "location.view",
    "location.manage_profile",
    "location.manage_content",
    "location.manage_specialists",
    "location.manage_requests",
    "location.manage_operational_status",
    "location.archive",
    "location.request_closure",
  ],
  location_manager: [
    "organization.view",
    "location.view",
    "location.manage_profile",
    "location.manage_content",
    "location.manage_specialists",
    "location.manage_requests",
    "location.manage_operational_status",
  ],
  location_staff: [
    "organization.view",
    "location.view",
    "location.manage_requests",
    "location.manage_operational_status",
  ],
};

function highestRole(memberships = []) {
  const roles = memberships.map((membership) => membership.role);
  if (roles.includes("organization_owner")) return "organization_owner";
  if (roles.includes("location_manager")) return "location_manager";
  if (roles.includes("location_staff")) return "location_staff";
  return "";
}

function organizationContextsFor(workspace) {
  if (workspace.organization_contexts?.length) return workspace.organization_contexts;

  const locations = workspace.locations || [];
  const locationById = Object.fromEntries(locations.map((location) => [location.id, location]));
  const organizations = workspace.organizations?.length
    ? workspace.organizations
    : [...new Set(locations.map((location) => location.organization_id).filter(Boolean))].map((id) => ({
      id,
      name: locations.find((location) => location.organization_id === id)?.organization_name || "Organizație",
    }));

  return organizations.map((organization) => {
    const contextLocations = locations.filter((location) => location.organization_id === organization.id);
    const locationIds = new Set(contextLocations.map((location) => location.id));
    const memberships = (workspace.memberships || []).filter((membership) => {
      const organizationId = membership.organization_id || locationById[membership.location_id]?.organization_id;
      return organizationId === organization.id || locationIds.has(membership.location_id);
    });
    const currentUserRole = highestRole(memberships);
    return {
      organization,
      current_user_role: currentUserRole,
      capabilities: ROLE_CAPABILITIES[currentUserRole] || [],
      can_manage_members: currentUserRole === "organization_owner",
      can_manage_settings: currentUserRole === "organization_owner",
      memberships,
      locations: contextLocations,
    };
  });
}

export default function ProviderWorkspaceRoot({
  user,
  workspace,
  onLogout,
  onRefresh,
  onSwitchMode,
  modeSwitches,
}) {
  const [params] = useSearchParams();
  const routerNavigate = useNavigate();
  const { locationId: routeLocationId, locationModule } = useParams();
  const requestedLocationModule = LOCATION_MODULES.has(locationModule) ? locationModule : null;
  const requestedSection = params.get("s") || "overview";
  const requestedOrganizationId = params.get("organization") || "";
  const requestedLocationId = params.get("location") || "";
  const ownerSyncStarted = useRef(false);
  const overviewRequestRef = useRef(0);

  const allLocations = useMemo(() => workspace.locations || [], [workspace.locations]);
  const organizationContexts = useMemo(() => organizationContextsFor(workspace), [workspace]);
  const requestedOrganizationContext = organizationContexts.find((context) => context.organization?.id === requestedOrganizationId);
  const requestedOrganizationLocationId = requestedOrganizationContext?.locations?.[0]?.id
    || requestedOrganizationContext?.memberships?.[0]?.location_id
    || "";
  const preferences = readAccountPreferences(user?.id);
  const preferredProviderLocationId = preferences.providerLocationMode === "fixed"
    ? preferences.fixedProviderLocationId
    : preferences.lastProviderLocationId;
  const initialLocationId = allLocations.some((location) => location.id === routeLocationId)
    ? routeLocationId
    : allLocations.some((location) => location.id === requestedLocationId)
      ? requestedLocationId
      : requestedOrganizationLocationId
        || (allLocations.some((location) => location.id === preferredProviderLocationId)
          ? preferredProviderLocationId
          : workspace.memberships?.[0]?.location_id || allLocations[0]?.id || "");
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const selectedContext = useMemo(() => organizationContexts.find((context) => (
    context.locations?.some((location) => location.id === selectedLocationId)
    || context.memberships?.some((membership) => membership.location_id === selectedLocationId)
  )) || organizationContexts[0] || null, [organizationContexts, selectedLocationId]);
  const selectedOrganizationId = selectedContext?.organization?.id || "";
  const locations = selectedContext ? (selectedContext.locations || []) : allLocations;
  const memberships = selectedContext ? (selectedContext.memberships || []) : (workspace.memberships || []);
  const capabilities = new Set(selectedContext?.capabilities || []);
  const canManageOrganizationProfile = capabilities.has("organization.manage_profile");
  const canViewLocations = capabilities.has("location.view");
  const canManageLocationProfile = capabilities.has("location.manage_profile");
  const canManageLocationContent = capabilities.has("location.manage_content");
  const canManageSpecialists = capabilities.has("location.manage_specialists");
  const canManageOperationalStatus = capabilities.has("location.manage_operational_status");
  const canManageAnyLocation = canManageLocationProfile
    || canManageLocationContent
    || canManageSpecialists
    || canManageOperationalStatus;
  const canManageMembers = Boolean(selectedContext?.can_manage_members || capabilities.has("organization.manage_members"));
  const canManageSettings = Boolean(selectedContext?.can_manage_settings || capabilities.has("organization.manage_settings"));
  const activeLocationModule = requestedLocationModule
    && capabilities.has(LOCATION_MODULE_CAPABILITIES[requestedLocationModule])
    ? requestedLocationModule
    : null;
  const deniedLocationModule = Boolean(requestedLocationModule && !activeLocationModule);
  const hasOwnerAccess = organizationContexts.some((context) => (
    context.can_manage_members || context.can_manage_settings || context.current_user_role === "organization_owner"
  ));
  const scopedWorkspace = useMemo(() => ({
    ...workspace,
    organizations: selectedContext?.organization ? [selectedContext.organization] : workspace.organizations,
    locations,
    memberships,
    current_user_role: selectedContext?.current_user_role || workspace.current_user_role,
    current_user_capabilities: selectedContext?.capabilities || workspace.current_user_capabilities || [],
    can_manage_members: canManageMembers,
  }), [workspace, selectedContext, locations, memberships, canManageMembers]);

  const loadOverview = async (locationId, options = {}) => {
    if (!locationId) return;
    const requestId = ++overviewRequestRef.current;
    const silent = options.silent === true;
    if (!silent) setLoadingOverview(true);
    const response = await base44.functions.invoke("getProviderWorkspaceOverview", { location_id: locationId }).catch(() => ({ data: null }));
    if (requestId !== overviewRequestRef.current) return;
    if (response.data) setOverview(response.data);
    if (!silent) setLoadingOverview(false);
  };

  const refreshOverviewInPlace = () => loadOverview(selectedLocationId, { silent: true });

  useEffect(() => {
    if (ownerSyncStarted.current || !hasOwnerAccess) return;
    ownerSyncStarted.current = true;
    base44.functions.invoke("syncProviderOrganizationOwnerAccess", {})
      .then((response) => { if (response.data?.changed) onRefresh?.(); })
      .catch(() => null);
  }, [hasOwnerAccess, onRefresh]);

  useEffect(() => {
    const routeLocationExists = allLocations.some((location) => location.id === routeLocationId);
    if (routeLocationExists && routeLocationId !== selectedLocationId) {
      setSelectedLocationId(routeLocationId);
      return;
    }
    if (!allLocations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(workspace.memberships?.[0]?.location_id || allLocations[0]?.id || "");
    }
  }, [routeLocationId, selectedLocationId, allLocations, workspace.memberships]);

  useEffect(() => {
    const requestedLocationExists = allLocations.some((location) => location.id === requestedLocationId);
    const nextLocationId = requestedLocationExists ? requestedLocationId : requestedOrganizationLocationId;
    if (nextLocationId) setSelectedLocationId(nextLocationId);
  }, [requestedLocationId, requestedOrganizationId, requestedOrganizationLocationId, allLocations]);

  useEffect(() => {
    loadOverview(selectedLocationId);
    if (selectedLocationId) rememberProviderLocation(user?.id, selectedLocationId);
  }, [selectedLocationId]);

  useEffect(() => {
    const denied = deniedLocationModule
      || (requestedSection === "profile" && !canManageOrganizationProfile)
      || (requestedSection === "locations" && !canViewLocations)
      || (requestedSection === "settings" && !canManageSettings)
      || (requestedSection === "access" && !canManageMembers);
    if (denied) {
      routerNavigate(deniedLocationModule ? "/contul-meu?s=locations" : "/contul-meu?s=overview", { replace: true });
    }
  }, [canManageMembers, canManageOrganizationProfile, canManageSettings, canViewLocations, deniedLocationModule, requestedSection, routerNavigate]);

  const goToSection = (key) => {
    routerNavigate(`/contul-meu?s=${key}`);
  };

  const selectLocation = (locationId) => {
    setSelectedLocationId(locationId);
    rememberProviderLocation(user?.id, locationId);
    if (activeLocationModule) routerNavigate(`/contul-meu/locatii/${locationId}/${activeLocationModule}`);
  };

  const selectOrganization = (organizationId) => {
    const context = organizationContexts.find((item) => item.organization?.id === organizationId);
    const locationId = context?.locations?.[0]?.id || context?.memberships?.[0]?.location_id || "";
    if (locationId) selectLocation(locationId);
  };

  const openLocationModule = (moduleKey, locationId = selectedLocationId) => {
    if (!LOCATION_MODULES.has(moduleKey) || !locationId || !capabilities.has(LOCATION_MODULE_CAPABILITIES[moduleKey])) return;
    setSelectedLocationId(locationId);
    routerNavigate(`/contul-meu/locatii/${locationId}/${moduleKey}`);
  };

  const closeLocationModule = () => {
    routerNavigate("/contul-meu?s=locations");
  };

  const navItems = getProviderNav({
    canManageOrganizationProfile,
    canViewLocations,
    canManageMembers,
    canManageSettings,
  });
  const allowedSections = [
    "overview",
    ...(canManageOrganizationProfile ? ["profile"] : []),
    ...(canViewLocations ? ["locations"] : []),
    ...(canManageMembers ? ["access"] : []),
    ...(canManageSettings ? ["settings"] : []),
  ];
  const normalizedSection = ["services", "team", "hours", "photos"].includes(requestedSection) ? "locations" : requestedSection;
  const safeSection = activeLocationModule
    ? "locations"
    : allowedSections.includes(normalizedSection)
      ? normalizedSection
      : "overview";
  const selectedStatus = overview?.location?.id === selectedLocationId ? overview.location.profile_control_status : "";
  const statusLabel = selectedStatus ? (PROFILE_CONTROL_LABELS[selectedStatus] || selectedStatus) : "";
  const statusGreen = ["verified", "claimed"].includes(selectedStatus);
  const activeLocationCount = locations.filter((location) => location.active_status !== "inactiva" && location.status !== "suspendata").length;
  const multiLocation = activeLocationCount >= 2;
  const organizationName = selectedContext?.organization?.public_display_name
    || selectedContext?.organization?.name
    || overview?.organization?.public_display_name
    || overview?.organization?.name
    || overview?.location?.organization_name
    || overview?.location?.name
    || "Spațiu furnizor";

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={safeSection}
      onNavigate={goToSection}
      user={user}
      onLogout={onLogout}
      title={organizationName}
      subtitle="Spațiu furnizor"
      publicProfileUrl={selectedLocationId ? `/furnizor/${selectedLocationId}` : null}
      modeSwitches={modeSwitches}
      wideContent={activeLocationModule === "servicii"}
      statusBadge={(statusLabel || multiLocation) ? (
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          {statusLabel && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusGreen ? "bg-green-100 text-green-800" : "bg-secondary text-foreground"}`}>{statusLabel}</span>}
          {multiLocation && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">Organizație cu {activeLocationCount} locații</span>}
        </span>
      ) : null}
    >
      {(organizationContexts.length > 1 || (memberships.length > 1 && safeSection !== "settings")) && (
        <LocationSwitcher
          organizationContexts={organizationContexts}
          selectedOrganizationId={selectedOrganizationId}
          memberships={memberships}
          selectedLocationId={selectedLocationId}
          showLocations={safeSection !== "settings"}
          onSelectOrganization={selectOrganization}
          onSelect={selectLocation}
        />
      )}
      {loadingOverview || !overview ? (
        <WorkspaceSectionLoading />
      ) : (
        <Suspense fallback={<WorkspaceSectionLoading />}>
          <>
          {safeSection === "overview" && (
            <ProviderOverview
              overview={overview}
              onNavigate={goToSection}
              canManageOrganizationProfile={canManageOrganizationProfile}
              canManageLocations={canManageAnyLocation}
            />
          )}
          {safeSection === "profile" && (
            <div className="[&>div>header:first-child]:hidden">
              <ProviderProfilePublic
                locationId={selectedLocationId}
                overview={overview}
                workspace={scopedWorkspace}
                onNavigate={goToSection}
                onSelectLocation={selectLocation}
                onRefresh={refreshOverviewInPlace}
              />
            </div>
          )}
          {safeSection === "locations" && activeLocationModule && (
            <ProviderLocationModulePage
              workspace={scopedWorkspace}
              locationId={selectedLocationId}
              moduleKey={activeLocationModule}
              overview={overview}
              onBack={closeLocationModule}
              onRefresh={refreshOverviewInPlace}
            />
          )}
          {safeSection === "locations" && !activeLocationModule && (
            <ProviderLocationsWithPhoto
              workspace={scopedWorkspace}
              selectedLocationId={selectedLocationId}
              onSelect={selectLocation}
              overview={overview}
              onRefresh={refreshOverviewInPlace}
              onOpenModule={openLocationModule}
            />
          )}
          {safeSection === "access" && canManageMembers && <ProviderAccess organizationId={selectedOrganizationId} locations={locations} />}
          {safeSection === "settings" && canManageSettings && (
            <ProviderSettings
              user={user}
              workspace={scopedWorkspace}
              overview={overview}
              selectedLocationId={selectedLocationId}
              onSelectLocation={selectLocation}
              onSwitchMode={onSwitchMode}
              onNavigate={goToSection}
            />
          )}
          </>
        </Suspense>
      )}
    </ProviderAppShell>
  );
}
