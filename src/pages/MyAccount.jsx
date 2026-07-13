import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { readAccountPreferences, rememberAccountMode } from "@/lib/accountPreferences";
import PersonalAccountWorkspace from "@/components/workspace/personal/PersonalAccountWorkspace";
import ApplicantWorkspaceRoot from "@/components/workspace/applicant/ApplicantWorkspaceRoot";
import ProviderWorkspaceRoot from "@/components/workspace/provider/ProviderWorkspaceRoot";
import ProfessionalWorkspaceRoot from "@/components/workspace/professional/ProfessionalWorkspaceRoot";

const MODE_LABELS = {
  personal: "Cont personal",
  provider: "Workspace furnizor",
  professional: "Cont profesional",
  applicant: "Pregatire profil",
};

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
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se incarca...</div>;
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

  const modeSwitches = accountModes.map((mode) => ({
    ...mode,
    active: mode.key === resolvedMode,
    onClick: () => switchMode(mode.key),
  }));
  const sharedAccountProps = {
    accountModes,
    activeMode: resolvedMode,
    onSwitchMode: switchMode,
    modeSwitches,
  };

  if (resolvedMode === "provider" && hasProviderWorkspace) {
    return <ProviderWorkspaceRoot user={user} workspace={providerWorkspace} onLogout={onLogout} onRefresh={load} {...sharedAccountProps} />;
  }

  if (resolvedMode === "professional" && hasProfessionalWorkspace) {
    return <ProfessionalWorkspaceRoot user={user} workspace={professionalWorkspace} onLogout={onLogout} onRefresh={load} {...sharedAccountProps} />;
  }

  if (resolvedMode === "applicant" && hasApplicantWorkspace) {
    return (
      <ApplicantWorkspaceRoot
        user={user}
        workspace={onboardingWorkspace}
        onLogout={onLogout}
        onRefresh={load}
        modeSwitches={modeSwitches}
      />
    );
  }

  return <PersonalAccountWorkspace user={user} workspace={providerWorkspace} onLogout={onLogout} {...sharedAccountProps} />;
}
