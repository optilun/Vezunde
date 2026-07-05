import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PersonalAccountWorkspace from "@/components/workspace/personal/PersonalAccountWorkspace";
import ApplicantWorkspaceRoot from "@/components/workspace/applicant/ApplicantWorkspaceRoot";
import ProviderWorkspaceRoot from "@/components/workspace/provider/ProviderWorkspaceRoot";

// MODULE 3H.1D — role-aware authenticated area router.
// Reads getMyProviderWorkspace mode (none / applicant_preparation / provider_workspace)
// and renders the matching workspace. No entity/schema/backend changes.
export default function MyAccount() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewOverride, setViewOverride] = useState(null); // null | "personal"
  const { logout } = useAuth();

  const load = async () => {
    const [u, ws] = await Promise.all([
      base44.auth.me(),
      base44.functions.invoke("getMyProviderWorkspace", {}),
    ]);
    setUser(u);
    setWorkspace(ws.data);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  if (loading || !user || !workspace) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">Se incarca...</div>;
  }

  const onLogout = () => logout(true);

  if (workspace.mode === "provider_workspace" && viewOverride !== "personal") {
    return (
      <ProviderWorkspaceRoot
        user={user}
        workspace={workspace}
        onLogout={onLogout}
        onRefresh={load}
        onSwitchPersonal={() => setViewOverride("personal")}
      />
    );
  }

  if (workspace.mode === "applicant_preparation") {
    return <ApplicantWorkspaceRoot user={user} workspace={workspace} onLogout={onLogout} onRefresh={load} />;
  }

  return (
    <PersonalAccountWorkspace
      user={user}
      workspace={viewOverride === "personal" ? {} : workspace}
      onLogout={onLogout}
      onSwitchBack={workspace.mode === "provider_workspace" ? () => setViewOverride(null) : null}
    />
  );
}