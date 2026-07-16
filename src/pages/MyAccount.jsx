import React, { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { readAccountPreferences, rememberAccountMode } from "@/lib/accountPreferences";
const PersonalAccountWorkspace = lazy(() => import("@/components/workspace/personal/PersonalAccountWorkspace"));
const ApplicantWorkspaceRoot = lazy(() => import("@/components/workspace/applicant/ApplicantWorkspaceRoot"));
const ProviderWorkspaceRoot = lazy(() => import("@/components/workspace/provider/ProviderWorkspaceRoot"));
const ProfessionalWorkspaceRoot = lazy(() => import("@/components/workspace/professional/ProfessionalWorkspaceRoot"));

const MODE_LABELS = {
  personal: "Cont personal",
  provider: "Organizații",
  professional: "Cont profesional",
  applicant: "Organizații · Pregătire profil",
};

const PROVIDER_ROLE_LABELS = {
  organization_owner: "Owner",
  location_manager: "Manager",
  location_staff: "Membru",
};

function WorkspaceLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground" role="status">
      Se încarcă spațiul de lucru...
    </div>
  );
}

function providerOrganizationContexts(workspace) {
  if (workspace?.organization_contexts?.length) return workspace.organization_contexts;

  const organizations = workspace?.organizations || [];
  const locations = workspace?.locations || [];
  const memberships = workspace?.memberships || [];
  return organizations.map((organization) => {
    const organizationLocations = locations.filter((location) => location.organization_id === organization.id);
    const locationIds = new Set(organizationLocations.map((location) => location.id));
    const organizationMemberships = memberships.filter((membership) => (
      membership.organization_id === organization.id || locationIds.has(membership.location_id)
    ));
    const role = ["organization_owner", "location_manager", "location_staff"]
      .find((candidate) => organizationMemberships.some((membership) => membership.role === candidate)) || "";
    return {
      organization,
      locations: organizationLocations,
      memberships: organizationMemberships,
      current_user_role: role,
    };
  });
}

export default function MyAccount() {
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [providerWorkspace, setProviderWorkspace] = useState(null);
  const [professionalWorkspace, setProfessionalWorkspace] = useState(null);
  const [onboardingWorkspace, setOnboardingWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState(null);
  const { logout } = useAuth();

  const load = async () => {
    const [currentUser, providerResult, professionalResult, onboardingResult] = await Promise.all([
      base44.auth.me(),
      base44.functions.invoke("getMyProviderWorkspace", {}),
      base44.functions.invoke("getMyProfessionalWorkspace", {}).catch(() => ({ data: { mode: "none", professional: null, assignments: [] } })),
      base44.functions.invoke("getMyProviderOnboardingWorkspace", {}).catch(() => ({ data: { mode: "none" } })),
    ]);
    setUser(currentUser);
    setProviderWorkspace(providerResult.data);
    setProfessionalWorkspace(professionalResult.data);
    setOnboardingWorkspace(onboardingResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  if (loading || !user || !providerWorkspace || !professionalWorkspace || !onboardingWorkspace) {
    return <WorkspaceLoading />;
  }

  const onLogout = () => logout(true);
  const hasProviderWorkspace = providerWorkspace.mode === "provider_workspace";
  const hasProfessionalWorkspace = professionalWorkspace.mode === "professional_workspace";
  const hasApplicantWorkspace = onboardingWorkspace.mode === "applicant_preparation";

  const accountModes = [
    { key: "personal", label: MODE_LABELS.personal },
    ...(hasProviderWorkspace ? [{ key: "provider", label: MODE_LABELS.provider }] : []),
    ...(hasProfessionalWorkspace ? [{ key: "professional", label: MODE_LABELS.professional }] : []),
    ...(hasApplicantWorkspace ? [{ key: "applicant", label: MODE_LABELS.applicant }] : []),
  ];
  const availableModeKeys = new Set(accountModes.map((mode) => mode.key));
  const preferences = readAccountPreferences(user.id);
  const requestedMode = params.get("mode");
  const preferredMode = preferences.startMode === "last" ? preferences.lastMode : preferences.startMode;
  const fallbackMode = [requestedMode, preferredMode, "provider", "professional", "applicant", "personal"]
    .find((mode) => availableModeKeys.has(mode)) || "personal";
  const resolvedMode = activeMode && availableModeKeys.has(activeMode) ? activeMode : fallbackMode;

  const switchMode = (mode) => {
    if (!availableModeKeys.has(mode)) return;
    const next = new URLSearchParams(params);
    next.set("mode", mode);
    if (mode !== "provider") {
      next.delete("organization");
      next.delete("location");
    }
    const settingsOpen = params.get("s") === "settings" || params.get("ps") === "settings";
    if (settingsOpen && mode !== "applicant") {
      if (mode === "professional") {
        next.delete("s");
        next.set("ps", "settings");
      } else {
        next.delete("ps");
        next.set("s", "settings");
      }
    } else if (mode === "applicant") {
      next.delete("ps");
      if (next.get("s") === "settings") next.set("s", "overview");
    }
    setParams(next, { replace: true });
    setActiveMode(mode);
    rememberAccountMode(user.id, mode);
  };

  const openOrganizationWorkspace = ({ mode = "provider", organizationId = "", locationId = "" } = {}) => {
    if (mode === "applicant") {
      switchMode("applicant");
      return;
    }
    if (!hasProviderWorkspace) return;
    const next = new URLSearchParams(params);
    next.set("mode", "provider");
    next.set("s", "overview");
    next.delete("ps");
    if (organizationId) next.set("organization", organizationId);
    else next.delete("organization");
    if (locationId) next.set("location", locationId);
    else next.delete("location");
    setParams(next, { replace: true });
    setActiveMode("provider");
    rememberAccountMode(user.id, "provider");
  };

  const openPersonalSettings = () => {
    const next = new URLSearchParams(params);
    next.set("mode", "personal");
    next.set("s", "settings");
    next.delete("ps");
    next.delete("organization");
    next.delete("location");
    setParams(next, { replace: true });
    setActiveMode("personal");
    rememberAccountMode(user.id, "personal");
  };

  const organizationContexts = providerOrganizationContexts(providerWorkspace);
  const requestedOrganizationId = params.get("organization") || "";
  const requestedLocationId = params.get("location") || preferences.lastProviderLocationId || "";
  const selectedOrganizationContext = organizationContexts.find((context) => context.organization?.id === requestedOrganizationId)
    || organizationContexts.find((context) => (
      context.locations?.some((location) => location.id === requestedLocationId)
      || context.memberships?.some((membership) => membership.location_id === requestedLocationId)
    ))
    || organizationContexts[0]
    || null;
  const selectedOrganizationId = selectedOrganizationContext?.organization?.id || "";

  const modeSwitches = [
    {
      key: "personal",
      kind: "personal",
      group: "account",
      label: MODE_LABELS.personal,
      subtitle: user.email,
      avatarUrl: user.profile_photo_url || "",
      active: resolvedMode === "personal",
      onClick: () => switchMode("personal"),
      onSettings: openPersonalSettings,
    },
    ...(hasProfessionalWorkspace ? [{
      key: "professional",
      kind: "professional",
      group: "account",
      label: professionalWorkspace.professional?.public_display_name
        || professionalWorkspace.professional?.full_name
        || MODE_LABELS.professional,
      subtitle: MODE_LABELS.professional,
      avatarUrl: professionalWorkspace.professional?.profile_photo_url || "",
      professionalProfileId: professionalWorkspace.professional?.id || "",
      active: resolvedMode === "professional",
      onClick: () => switchMode("professional"),
    }] : []),
    ...(hasProviderWorkspace && organizationContexts.length ? organizationContexts.map((context) => {
      const organization = context.organization || {};
      const firstLocationId = context.locations?.[0]?.id || context.memberships?.[0]?.location_id || "";
      return {
        key: `organization:${organization.id}`,
        kind: "organization",
        group: "organizations",
        label: organization.public_display_name || organization.name || "Organizație",
        subtitle: PROVIDER_ROLE_LABELS[context.current_user_role] || "Organizație",
        avatarUrl: organization.logo_url || "",
        organizationId: organization.id || "",
        active: resolvedMode === "provider" && organization.id === selectedOrganizationId,
        onClick: () => openOrganizationWorkspace({
          organizationId: organization.id,
          locationId: firstLocationId,
        }),
      };
    }) : hasProviderWorkspace ? [{
      key: "provider",
      kind: "organization",
      group: "organizations",
      label: MODE_LABELS.provider,
      subtitle: "Spațiu organizație",
      active: resolvedMode === "provider",
      onClick: () => switchMode("provider"),
    }] : []),
    ...(hasApplicantWorkspace ? [{
      key: "applicant",
      kind: "applicant",
      group: "organizations",
      label: onboardingWorkspace.location_summary?.name || "Pregătire profil",
      subtitle: "Solicitare în pregătire",
      active: resolvedMode === "applicant",
      onClick: () => switchMode("applicant"),
    }] : []),
  ];
  const sharedAccountProps = {
    accountModes,
    activeMode: resolvedMode,
    onSwitchMode: switchMode,
    modeSwitches,
  };

  if (resolvedMode === "provider" && hasProviderWorkspace) {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <ProviderWorkspaceRoot user={user} workspace={providerWorkspace} onLogout={onLogout} onRefresh={load} {...sharedAccountProps} />
      </Suspense>
    );
  }

  if (resolvedMode === "professional" && hasProfessionalWorkspace) {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <ProfessionalWorkspaceRoot user={user} workspace={professionalWorkspace} onLogout={onLogout} onRefresh={load} {...sharedAccountProps} />
      </Suspense>
    );
  }

  if (resolvedMode === "applicant" && hasApplicantWorkspace) {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <ApplicantWorkspaceRoot
        user={user}
        workspace={onboardingWorkspace}
        onLogout={onLogout}
        onRefresh={load}
        modeSwitches={modeSwitches}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <PersonalAccountWorkspace
      user={user}
      workspace={providerWorkspace}
      onboardingWorkspace={onboardingWorkspace}
      professionalWorkspace={professionalWorkspace}
      onOpenOrganization={openOrganizationWorkspace}
      onOpenProfessional={() => switchMode("professional")}
      onRefresh={load}
      onLogout={onLogout}
        {...sharedAccountProps}
      />
    </Suspense>
  );
}

