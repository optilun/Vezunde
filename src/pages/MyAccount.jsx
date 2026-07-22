import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { readAccountPreferences, rememberAccountMode } from "@/lib/accountPreferences";
import {
  accountWorkspaceFunction,
  keepWorkspaceIdentity,
} from "@/lib/accountWorkspaceLifecycle";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
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
  const [providerWorkspace, setProviderWorkspace] = useState(null);
  const [professionalWorkspace, setProfessionalWorkspace] = useState(null);
  const [onboardingWorkspace, setOnboardingWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeMode, setActiveMode] = useState(null);
  const loadRequestRef = useRef(0);
  const refreshRequestRef = useRef({ provider: 0, professional: 0, onboarding: 0 });
  const hasWorkspaceDataRef = useRef(false);
  const { user, logout } = useAuth();

  const updateProviderWorkspace = useCallback((next) => {
    setProviderWorkspace((current) => keepWorkspaceIdentity(current, next));
  }, []);
  const updateProfessionalWorkspace = useCallback((next) => {
    setProfessionalWorkspace((current) => keepWorkspaceIdentity(current, next));
  }, []);
  const updateOnboardingWorkspace = useCallback((next) => {
    setOnboardingWorkspace((current) => keepWorkspaceIdentity(current, next));
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const initialRequest = !hasWorkspaceDataRef.current;
    setLoadError("");
    if (initialRequest) setLoading(true);

    try {
      const [providerResult, professionalResult, onboardingResult] = await Promise.all([
        base44.functions.invoke("getMyProviderWorkspace", {}),
        base44.functions.invoke("getMyProfessionalWorkspace", {}),
        base44.functions.invoke("getMyProviderOnboardingWorkspace", {}),
      ]);

      if (requestId !== loadRequestRef.current) return;
      updateProviderWorkspace(providerResult.data);
      updateProfessionalWorkspace(professionalResult.data);
      updateOnboardingWorkspace(onboardingResult.data);
      hasWorkspaceDataRef.current = true;
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      console.error("Account workspace load failed:", error);
      if (initialRequest) {
        setLoadError("Sesiunea este activă, dar datele contului nu au putut fi încărcate.");
      }
    } finally {
      if (requestId === loadRequestRef.current && initialRequest) setLoading(false);
    }
  }, [updateOnboardingWorkspace, updateProfessionalWorkspace, updateProviderWorkspace]);

  const refreshWorkspace = useCallback(async (workspaceKey) => {
    const requestId = ++refreshRequestRef.current[workspaceKey];
    const response = await base44.functions.invoke(accountWorkspaceFunction(workspaceKey), {})
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message || "Workspace-ul nu a putut fi actualizat." } }));
    if (requestId !== refreshRequestRef.current[workspaceKey]) return null;
    if (!response.data || response.data.error) {
      console.error(`Account ${workspaceKey} workspace refresh failed:`, response.data?.error || "Răspuns indisponibil");
      return null;
    }

    if (workspaceKey === "provider") updateProviderWorkspace(response.data);
    else if (workspaceKey === "professional") updateProfessionalWorkspace(response.data);
    else updateOnboardingWorkspace(response.data);
    hasWorkspaceDataRef.current = true;
    return response.data;
  }, [updateOnboardingWorkspace, updateProfessionalWorkspace, updateProviderWorkspace]);

  const refreshProviderWorkspace = useCallback(
    () => refreshWorkspace("provider"),
    [refreshWorkspace],
  );
  const refreshProfessionalWorkspace = useCallback(
    () => refreshWorkspace("professional"),
    [refreshWorkspace],
  );
  const refreshOnboardingWorkspace = useCallback(
    () => refreshWorkspace("onboarding"),
    [refreshWorkspace],
  );

  useEffect(() => {
    if (user?.id) void load();
    return () => {
      loadRequestRef.current += 1;
      refreshRequestRef.current.provider += 1;
      refreshRequestRef.current.professional += 1;
      refreshRequestRef.current.onboarding += 1;
    };
  }, [load, user?.id]);

  const onLogout = () => logout(true);

  if (loading) return <WorkspaceLoading />;

  if (loadError || !user || !providerWorkspace || !professionalWorkspace || !onboardingWorkspace) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-10">
        <section className="w-full max-w-lg rounded-[22px] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">Nu am putut încărca contul</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {loadError || "Datele contului nu sunt disponibile momentan."} Nu te-am deconectat. Poți reîncerca sau poți ieși din cont.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Încearcă din nou
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Ieși din cont
            </button>
          </div>
        </section>
      </main>
    );
  }
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
        <ProviderWorkspaceRoot user={user} workspace={providerWorkspace} onLogout={onLogout} onRefresh={refreshProviderWorkspace} {...sharedAccountProps} />
      </Suspense>
    );
  }

  if (resolvedMode === "professional" && hasProfessionalWorkspace) {
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <ProfessionalWorkspaceRoot user={user} workspace={professionalWorkspace} onLogout={onLogout} onRefresh={refreshProfessionalWorkspace} {...sharedAccountProps} />
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
        onRefresh={refreshOnboardingWorkspace}
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
