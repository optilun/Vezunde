import React, { lazy, Suspense } from "react";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";

const ApplicantStatus = lazy(() => import("./ApplicantStatus"));

function WorkspaceSectionLoading() {
  return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">Se încarcă secțiunea...</div>;
}

// Ecranele de ciorna (profil, program, servicii) au fost eliminate: erau o a doua
// interfata de organizatie, diferita de modulele reale din spatiul de furnizor.
// Aici ramane doar starea solicitarii; administrarea se face intr-o singura interfata,
// dupa aprobare.
export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, modeSwitches }) {
  const location = workspace.location_summary;
  const statusCenter = workspace.status_center || {};
  const needsAction = statusCenter.state === "needs_action";
  const bannerTone = needsAction
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-border bg-accent/40 text-foreground";

  return (
    <ProviderAppShell
      navItems={APPLICANT_NAV}
      activeKey="status"
      onNavigate={() => {}}
      user={user}
      onLogout={onLogout}
      title={location?.name || "Solicitare în verificare"}
      subtitle="Solicitare în verificare"
      modeSwitches={modeSwitches}
    >
      <div className={`mb-6 rounded-xl border p-4 ${bannerTone}`}>
        <div className="text-sm font-semibold">
          {needsAction ? (statusCenter.headline || "Sunt necesare completări") : "Solicitarea este în verificare"}
        </div>
        <p className="mt-1 text-xs leading-relaxed opacity-80">
          {needsAction
            ? (statusCenter.message || "Verifică informațiile solicitate de echipa VIASEE.")
            : "Te anunțăm când relația cu locația este confirmată. Atunci vei administra locația în spațiul de organizație."}
        </p>
      </div>
      <Suspense fallback={<WorkspaceSectionLoading />}>
        <ApplicantStatus claim={workspace.claim} statusCenter={statusCenter} />
      </Suspense>
    </ProviderAppShell>
  );
}