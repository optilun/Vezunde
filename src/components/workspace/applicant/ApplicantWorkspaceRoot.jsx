import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";
import ApplicantOverview from "./ApplicantOverview";
import ApplicantProfileDraft from "./ApplicantProfileDraft";
import ApplicantHoursDraft from "./ApplicantHoursDraft";
import ApplicantServicesDraft from "./ApplicantServicesDraft";
import ApplicantStatus from "./ApplicantStatus";

export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, onRefresh }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("s") || "overview";
  const navigate = (key) => setParams({ s: key });
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
    >
      <div className="rounded-xl border border-border bg-accent/40 p-4 mb-6">
        <div className="font-semibold text-sm">Solicitarea este in verificare</div>
        <p className="text-xs text-muted-foreground mt-1">Poti pregati informatiile de baza intre timp. Acestea raman private pana cand relatia ta cu locatia este confirmata.</p>
      </div>
      {section === "overview" && <ApplicantOverview workspace={workspace} onNavigate={navigate} />}
      {section === "profile" && <ApplicantProfileDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "hours" && <ApplicantHoursDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "services" && <ApplicantServicesDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "status" && <ApplicantStatus claim={workspace.claim} />}
    </ProviderAppShell>
  );
}