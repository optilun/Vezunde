import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";
import ApplicantOverview from "./ApplicantOverview";
import ApplicantProfileDraft from "./ApplicantProfileDraft";
import ApplicantHoursDraft from "./ApplicantHoursDraft";
import ApplicantServicesDraft from "./ApplicantServicesDraft";
import ApplicantStatus from "./ApplicantStatus";

const ALLOWED_SECTIONS = new Set(["overview", "profile", "hours", "services", "status"]);

export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, onRefresh, modeSwitches }) {
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get("s") || "overview";
  const section = ALLOWED_SECTIONS.has(requestedSection) ? requestedSection : "overview";
  const submitted = params.get("onboarding") === "submitted";
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("s", key);
    next.delete("onboarding");
    setParams(next);
  };
  const location = workspace.location_summary;

  return (
    <ProviderAppShell
      navItems={APPLICANT_NAV}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={location?.name || "Pregateste profilul"}
      subtitle="Pregatire profil"
      modeSwitches={modeSwitches}
    >
      <div className="rounded-xl border border-border bg-accent/40 p-4 mb-6">
        <div className="font-semibold text-sm">Solicitarea este in verificare</div>
        <p className="text-xs text-muted-foreground mt-1">Poti pregati informatiile de baza intre timp. Acestea raman private pana cand relatia ta cu locatia este confirmata.</p>
      </div>
      {section === "overview" && <ApplicantOverview workspace={workspace} onNavigate={navigate} submitted={submitted} />}
      {section === "profile" && <ApplicantProfileDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "hours" && <ApplicantHoursDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "services" && <ApplicantServicesDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "status" && <ApplicantStatus claim={workspace.claim} />}
    </ProviderAppShell>
  );
}
