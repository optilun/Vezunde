import React, { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { getApplicantNav } from "@/lib/workspaceNav";

const ApplicantStatus = lazy(() => import("./ApplicantStatus"));
const OrganizationClaimHistory = lazy(() => import("./OrganizationClaimHistory"));

function WorkspaceSectionLoading() {
  return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">Se încarcă secțiunea...</div>;
}

// Ecranele de ciorna (profil, program, servicii) au fost eliminate: erau o a doua
// interfata de organizatie, diferita de modulele reale din spatiul de furnizor.
// Aici ramane starea solicitarii active; administrarea se face intr-o singura interfata,
// dupa aprobare.
//
// 2026-10-03 (structura conturilor, pasul 1). Spatiul exista si fara o solicitare activa, cand
// contul are istoric de solicitari: „Toate solicitările” a venit aici din contul personal.
export default function ApplicantWorkspaceRoot({ user, workspace, onLogout, modeSwitches }) {
  const [params, setParams] = useSearchParams();
  const hasActiveClaim = workspace?.mode === "applicant_preparation";
  const navItems = getApplicantNav({ hasActiveClaim });
  const requestedSection = params.get("s");
  const section = navItems.some((item) => item.key === requestedSection) ? requestedSection : navItems[0].key;
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("mode", "applicant");
    next.set("s", key);
    setParams(next, { replace: true });
  };
  const location = workspace?.location_summary;
  const statusCenter = workspace?.status_center || {};
  const needsAction = statusCenter.state === "needs_action";
  const bannerTone = needsAction
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-border bg-accent/40 text-foreground";

  return (
    <ProviderAppShell
      navItems={navItems}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={hasActiveClaim ? (location?.name || "Solicitare în verificare") : "Solicitări de organizație"}
      subtitle={hasActiveClaim ? "Solicitare în verificare" : "Organizații"}
      modeSwitches={modeSwitches}
    >
      <Suspense fallback={<WorkspaceSectionLoading />}>
        {section === "status" && hasActiveClaim && (
          <>
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
            <ApplicantStatus claim={workspace.claim} statusCenter={statusCenter} />
          </>
        )}
        {section === "history" && <OrganizationClaimHistory user={user} />}
      </Suspense>
    </ProviderAppShell>
  );
}
