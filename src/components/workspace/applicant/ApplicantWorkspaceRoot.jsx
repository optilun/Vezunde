import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";
import ApplicantOverview from "./ApplicantOverview";
import ApplicantProfileDraft from "./ApplicantProfileDraft";
import ApplicantHoursDraft from "./ApplicantHoursDraft";
import ApplicantServicesDraft from "./ApplicantServicesDraft";
import ApplicantStatus from "./ApplicantStatus";

export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, onRefresh, modeSwitches }) {
  const [params, setParams] = useSearchParams();
  const claim = workspace.claim;
  const isOrganization = !claim?.claim_subject_type || claim.claim_subject_type === "organization";
  const navItems = isOrganization ? APPLICANT_NAV : APPLICANT_NAV.filter((item) => ["overview", "profile", "status"].includes(item.key));
  const requestedSection = params.get("s") || "overview";
  const section = navItems.some((item) => item.key === requestedSection) ? requestedSection : "overview";
  const navigate = (key) => setParams({ s: key });
  const location = workspace.location_summary;
  const subtitle = claim?.claim_subject_type === "independent_professional"
    ? "Pregatire profil profesional"
    : claim?.claim_subject_type === "b2b_supplier"
      ? "Pregatire profil B2B"
      : "Pregatire profil organizatie";

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={location?.name || "Pregateste profilul"}
      subtitle={subtitle}
      modeSwitches={modeSwitches}
    >
      <div className="rounded-xl border border-border bg-accent/40 p-4 mb-6">
        <div className="font-semibold text-sm">Solicitarea este in verificare</div>
        <p className="text-xs text-muted-foreground mt-1">Poti pregati informatiile permise intre timp. Acestea raman private pana la aprobarea solicitarii.</p>
      </div>
      {section === "overview" && <ApplicantOverview workspace={workspace} onNavigate={navigate} />}
      {section === "profile" && <ApplicantProfileDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "hours" && isOrganization && <ApplicantHoursDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "services" && isOrganization && <ApplicantServicesDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "status" && <ApplicantStatus claim={claim} />}
    </ProviderAppShell>
  );
}
