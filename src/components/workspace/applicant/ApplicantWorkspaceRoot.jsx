import React from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";
import ApplicantOverview from "./ApplicantOverview";
import ApplicantProfileDraft from "./ApplicantProfileDraft";
import ApplicantHoursDraft from "./ApplicantHoursDraft";
import ApplicantServicesDraft from "./ApplicantServicesDraft";
import ApplicantStatus from "./ApplicantStatus";

const NAV_SECTION_MAP = {
  profile: "public_profile",
  hours: "operating_hours",
  services: "services",
};

export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, onRefresh, modeSwitches }) {
  const [params, setParams] = useSearchParams();
  const claim = workspace.claim;
  const allowedSections = new Set(workspace.allowed_sections || []);
  const navItems = APPLICANT_NAV.filter((item) => (
    ["overview", "status"].includes(item.key)
    || allowedSections.has(NAV_SECTION_MAP[item.key])
  ));
  const requestedSection = params.get("s") || "overview";
  const section = navItems.some((item) => item.key === requestedSection) ? requestedSection : "overview";
  const navigate = (key) => setParams({ s: key });
  const location = workspace.location_summary;
  const subtitle = claim?.claim_subject_type === "independent_professional"
    ? "Solicitare profil profesional"
    : claim?.claim_subject_type === "b2b_supplier"
      ? "Pregatire profil B2B"
      : "Pregatire profil organizatie";
  const canPrepare = allowedSections.size > 0 && claim?.mode !== "new_location_duplicate_review";

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={location?.name || claim?.business_name || "Solicitare VIASEE"}
      subtitle={subtitle}
      modeSwitches={modeSwitches}
    >
      <div className="rounded-xl border border-border bg-accent/40 p-4 mb-6">
        <div className="font-semibold text-sm">Solicitarea este in verificare</div>
        <p className="text-xs text-muted-foreground mt-1">
          {canPrepare
            ? "Poti pregati informatiile permise intre timp. Acestea raman private pana la aprobarea solicitarii."
            : "Urmareste statusul din cont. Configurarea devine disponibila dupa clarificare sau aprobare."}
        </p>
      </div>
      {section === "overview" && <ApplicantOverview workspace={workspace} onNavigate={navigate} />}
      {section === "profile" && allowedSections.has("public_profile") && <ApplicantProfileDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "hours" && allowedSections.has("operating_hours") && <ApplicantHoursDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "services" && allowedSections.has("services") && <ApplicantServicesDraft workspace={workspace} onRefresh={onRefresh} />}
      {section === "status" && <ApplicantStatus claim={claim} />}
    </ProviderAppShell>
  );
}
