import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { PERSONAL_NAV } from "@/lib/workspaceNav";
import PersonalOverview from "./PersonalOverview";
import PersonalRequests from "./PersonalRequests";
import PersonalSaved from "./PersonalSaved";
import PersonalData from "./PersonalData";
import PersonalSettings from "./PersonalSettings";

export default function PersonalAccountWorkspace({ user, workspace, onLogout, onSwitchBack }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("s") || "overview";
  const navigate = (key) => setParams({ s: key });

  return (
    <ProviderAppShell
      navItems={PERSONAL_NAV}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title="vezunde"
      subtitle="Contul meu"
      modeSwitch={onSwitchBack ? { label: "Workspace furnizor", onClick: onSwitchBack } : null}
    >
      {section === "overview" && <PersonalOverview user={user} workspace={workspace} onNavigate={navigate} />}
      {section === "requests" && <PersonalRequests user={user} />}
      {section === "saved" && <PersonalSaved />}
      {section === "data" && <PersonalData user={user} />}
      {section === "settings" && <PersonalSettings />}
    </ProviderAppShell>
  );
}