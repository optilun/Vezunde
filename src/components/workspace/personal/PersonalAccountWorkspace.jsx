import React, { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
const AccountSettings = lazy(() => import("@/components/workspace/account/AccountSettings"));
import { PERSONAL_NAV } from "@/lib/workspaceNav";
const PersonalOverview = lazy(() => import("./PersonalOverview"));
const PersonalRequests = lazy(() => import("./PersonalRequests"));
const PersonalSaved = lazy(() => import("./PersonalSaved"));

function WorkspaceSectionLoading() {
  return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">Se încarcă secțiunea...</div>;
}

const PERSONAL_SECTIONS = new Set(["overview", "requests", "saved", "settings"]);

export default function PersonalAccountWorkspace({
  user,
  workspace,
  onboardingWorkspace,
  professionalWorkspace,
  onOpenOrganization,
  onOpenProfessional,
  onRefresh,
  onLogout,
  accountModes,
  activeMode,
  onSwitchMode,
  modeSwitches,
}) {
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get("s") || "overview";
  const section = requestedSection === "data"
    ? "settings"
    : PERSONAL_SECTIONS.has(requestedSection)
      ? requestedSection
      : "overview";
  const navigate = (key) => setParams({ s: key, mode: "personal" });

  return (
    <ProviderAppShell
      navItems={PERSONAL_NAV}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title="VIASEE"
      subtitle="Contul meu"
      modeSwitches={modeSwitches}
    >
      <Suspense fallback={<WorkspaceSectionLoading />}>
      {section === "overview" && (
        <PersonalOverview
          user={user}
          workspace={workspace}
          onboardingWorkspace={onboardingWorkspace}
          professionalWorkspace={professionalWorkspace}
          onOpenOrganization={onOpenOrganization}
          onOpenProfessional={onOpenProfessional}
          onNavigate={navigate}
        />
      )}
      {section === "requests" && <PersonalRequests user={user} />}
      {section === "saved" && <PersonalSaved />}
      {section === "settings" && (
        <AccountSettings
          user={user}
          accountModes={accountModes}
          activeMode={activeMode}
          onSwitchMode={onSwitchMode}
          onRefresh={onRefresh}
          onLogout={onLogout}
        />
      )}
      </Suspense>
    </ProviderAppShell>
  );
}

