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

function workspaceErrorMessage(result) {
  if (result?.status === "fulfilled") {
    return result.value?.data?.error || "Datele acestui modul nu au putut fi încărcate.";
  }
  return result?.reason?.response?.data?.error
    || result?.reason?.message
    || "Datele acestui modul nu au putut fi încărcate.";
}

function WorkspaceModuleError({ title, message, retrying = false, onRetry }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-lg rounded-[22px] border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          disabled={retrying}
          onClick={() => void onRetry?.()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden="true" />
          Reîncearcă
        </button>
      </section>
    </main>
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
  const [workspaceErrors, setWorkspaceErrors] = useState({ provider: "", professional: "", onboarding: "" });
  const [workspaceRefreshing, setWorkspaceRefreshing] = useState({ provider: false, professional: false, onboarding: false });
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

    const results = await Promise.allSettled([
      base44.functions.invoke("getMyProviderWorkspace", {}),
      base44.functions.invoke("getMyProfessionalWorkspace", {}),
      base44.functions.invoke("getMyProviderOnboardingWorkspace", {}),
    ]);
    if (requestId !== loadRequestRef.current) return;

    const nextErrors = { provider: "", professional: "", onboarding: "" };
    let usableWorkspaceCount = 0;
    const entries = [
      ["provider", results[0], updateProviderWorkspace],
      ["professional", results[1], updateProfessionalWorkspace],
      ["onboarding", results[2], updateOnboardingWorkspace],
    ];
    entries.forEach(([workspaceKey, result, updateWorkspace]) => {
      const data = result.status === "fulfilled" ? result.value?.data : null;
      if (data && !data.error) {
        updateWorkspace(data);
        usableWorkspaceCount += 1;
      } else {
        nextErrors[workspaceKey] = workspaceErrorMessage(result);
      }
    });
    setWorkspaceErrors(nextErrors);

    if (usableWorkspaceCount > 0) {
      hasWorkspaceDataRef.current = true;
      setLoadError("");
    } else if (initialRequest) {
      setLoadError("Sesiunea este activă, dar datele contului nu au putut fi încărcate.");
    }
    if (initialRequest) setLoading(false);
  }, [updateOnboardingWorkspace, updateProfessionalWorkspace, updateProviderWorkspace]);

  const refreshWorkspace = useCallback(async (workspaceKey) => {
    const requestId = ++refreshRequestRef.current[workspaceKey];
    setWorkspaceRefreshing((current) => ({ ...current, [workspaceKey]: true }));
    setWorkspaceErrors((current) => ({ ...current, [workspaceKey]: "" }));
    const response = await base44.functions.invoke(accountWorkspaceFunction(workspaceKey), {})
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message || "Workspace-ul nu a putut fi actualizat." } }));
    if (requestId !== refreshRequestRef.current[workspaceKey]) return null;

    if (!response.data || response.data.error) {
      const message = response.data?.error || "Workspace-ul nu a putut fi actualizat.";
      console.error(`Account ${workspaceKey} workspace refresh failed:`, message);
      setWorkspaceErrors((current) => ({ ...current, [workspaceKey]: message }));
      setWorkspaceRefreshing((current) => ({ ...current, [workspaceKey]: false }));
      return null;
    }

    if (workspaceKey === "provider") updateProviderWorkspace(response.data);
    else if (workspaceKey === "professional") updateProfessionalWorkspace(response.data);
    else updateOnboardingWorkspace(response.data);
    hasWorkspaceDataRef.current = true;
    setWorkspaceRefreshing((current) => ({ ...current, [workspaceKey]: false }));
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

  const hasAnyWorkspace = Boolean(providerWorkspace || professionalWorkspace || onboardingWorkspace);
  if (!user || !hasAnyWorkspace) {
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
  const hasProviderWorkspace = providerWorkspace?.mode === "provider_workspace";
  const hasProfessionalWorkspace = professionalWorkspace?.mode === "professional_workspace";
  const hasApplicantWorkspace = onboardingWorkspace?.mode === "applicant_preparation";

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
  const requestedWorkspaceIssue = {
    provider: { workspace: providerWorkspace, error: workspaceErrors.provider, retrying: workspaceRefreshing.provider, retry: refreshProviderWorkspace, title: "Nu am putut încărca spațiul furnizorului" },
    professional: { workspace: professionalWorkspace, error: workspaceErrors.professional, retrying: workspaceRefreshing.professional, retry: refreshProfessionalWorkspace, title: "Nu am putut încărca profilul profesional" },
    applicant: { workspace: onboardingWorkspace, error: workspaceErrors.onboarding, retrying: workspaceRefreshing.onboarding, retry: refreshOnboardingWorkspace, title: "Nu am putut încărca pregătirea profilului" },
  }[requestedMode];
  if (requestedWorkspaceIssue?.error && !requestedWorkspaceIssue.workspace) {
    return (
      <WorkspaceModuleError
        title={requestedWorkspaceIssue.title}
        message={requestedWorkspaceIssue.error}
        retrying={requestedWorkspaceIssue.retrying}
        onRetry={requestedWorkspaceIssue.retry}
      />
    );
  }

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
        <ProviderWorkspaceRoot
          user={user}
          workspace={providerWorkspace}
          workspaceError={workspaceErrors.provider}
          workspaceRefreshing={workspaceRefreshing.provider}
          onRetryWorkspace={refreshProviderWorkspace}
          onLogout={onLogout}
          onRefresh={refreshProviderWorkspace}
          {...sharedAccountProps}
        />
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
