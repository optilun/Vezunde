import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PersonalAccountWorkspace from "@/components/workspace/personal/PersonalAccountWorkspace";
import ApplicantWorkspaceRoot from "@/components/workspace/applicant/ApplicantWorkspaceRoot";
import ProviderWorkspaceRoot from "@/components/workspace/provider/ProviderWorkspaceRoot";
import ProfessionalWorkspaceRoot from "@/components/workspace/professional/ProfessionalWorkspaceRoot";

export default function MyAccount() {
  const [user, setUser] = useState(null);
  const [providerWorkspace, setProviderWorkspace] = useState(null);
  const [professionalWorkspace, setProfessionalWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewOverride, setViewOverride] = useState(null); // null | personal
  const { logout } = useAuth();

  const load = async () => {
    const [currentUser, providerResult, professionalResult] = await Promise.all([
      base44.auth.me(),
      base44.functions.invoke("getMyProviderWorkspace", {}),
      base44.functions.invoke("getMyProfessionalWorkspace", {}).catch(() => ({ data: { mode: "none", professional: null, assignments: [] } })),
    ]);
    setUser(currentUser);
    setProviderWorkspace(providerResult.data);
    setProfessionalWorkspace(professionalResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  if (loading || !user || !providerWorkspace || !professionalWorkspace) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se încarcă...</div>;
  }

  const onLogout = () => logout(true);
  const hasProviderWorkspace = providerWorkspace.mode === "provider_workspace";
  const hasProfessionalWorkspace = professionalWorkspace.mode === "professional_workspace";

  if (hasProviderWorkspace && viewOverride !== "personal") {
    return (
      <ProviderWorkspaceRoot
        user={user}
        workspace={providerWorkspace}
        onLogout={onLogout}
        onRefresh={load}
        onSwitchPersonal={() => setViewOverride("personal")}
      />
    );
  }

  if (!hasProviderWorkspace && hasProfessionalWorkspace && viewOverride !== "personal") {
    return (
      <ProfessionalWorkspaceRoot
        user={user}
        workspace={professionalWorkspace}
        onLogout={onLogout}
        onSwitchPersonal={() => setViewOverride("personal")}
      />
    );
  }

  if (providerWorkspace.mode === "applicant_preparation" && viewOverride !== "personal") {
    return <ApplicantWorkspaceRoot user={user} workspace={providerWorkspace} onLogout={onLogout} onRefresh={load} />;
  }

  const switchBack = hasProviderWorkspace
    ? () => setViewOverride(null)
    : hasProfessionalWorkspace
      ? () => setViewOverride(null)
      : null;

  return (
    <PersonalAccountWorkspace
      user={user}
      workspace={viewOverride === "personal" ? {} : providerWorkspace}
      onLogout={onLogout}
      onSwitchBack={switchBack}
    />
  );
}