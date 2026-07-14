import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import AccountSettings from "@/components/workspace/account/AccountSettings";
import { PERSONAL_NAV } from "@/lib/workspaceNav";
import PersonalOverview from "./PersonalOverview";
import PersonalRequests from "./PersonalRequests";
import PersonalSaved from "./PersonalSaved";

const PERSONAL_SECTIONS = new Set(["overview", "requests", "saved", "settings"]);

export default function PersonalAccountWorkspace({
  user,
  workspace,
  onboardingWorkspace,
  onOpenOrganization,
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
      {section === "overview" && (
        <PersonalOverview
          user={user}
          workspace={workspace}
          onboardingWorkspace={onboardingWorkspace}
          onOpenOrganization={onOpenOrganization}
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
          onLogout={onLogout}
        />
      )}
    </ProviderAppShell>
  );
}
