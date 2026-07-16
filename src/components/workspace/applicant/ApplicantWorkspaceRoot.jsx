import React, { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import { APPLICANT_NAV } from "@/lib/workspaceNav";
const ApplicantOverview = lazy(() => import("./ApplicantOverview"));
const ApplicantProfileDraft = lazy(() => import("./ApplicantProfileDraft"));
const ApplicantHoursDraft = lazy(() => import("./ApplicantHoursDraft"));
const ApplicantServicesDraft = lazy(() => import("./ApplicantServicesDraft"));
const ApplicantStatus = lazy(() => import("./ApplicantStatus"));

function WorkspaceSectionLoading() {
  return (
    <div
      className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Se încarcă secțiunea...
    </div>
  );
}

const ALLOWED_SECTIONS = new Set([
  "overview",
  "profile",
  "hours",
  "services",
  "status",
]);

export default function ApplicantWorkspaceRoot({
  user,
  workspace,
  onLogout,
  onRefresh,
  modeSwitches,
}) {
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get("s") || "overview";
  const section = ALLOWED_SECTIONS.has(requestedSection)
    ? requestedSection
    : "overview";
  const submitted = params.get("onboarding") === "submitted";
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("s", key);
    next.delete("onboarding");
    setParams(next);
  };
  const location = workspace.location_summary;
  const statusCenter = workspace.status_center || {};
  const bannerTone =
    statusCenter.state === "needs_action"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : statusCenter.state === "preparation_complete"
        ? "border-green-200 bg-green-50 text-green-950"
        : "border-border bg-accent/40 text-foreground";

  return (
    <ProviderAppShell
      navItems={APPLICANT_NAV}
      activeKey={section}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={location?.name || "Pregătește profilul"}
      subtitle="Pregătire profil"
      modeSwitches={modeSwitches}
    >
      <div className={`mb-6 rounded-xl border p-4 ${bannerTone}`}>
        <div className="text-sm font-semibold">
          {statusCenter.headline || "Solicitarea este în verificare"}
        </div>
        <p className="mt-1 text-xs leading-relaxed opacity-80">
          {statusCenter.message ||
            "Poți pregăti informațiile de bază între timp. Acestea rămân private până când relația ta cu locația este confirmată."}
        </p>
      </div>
      <Suspense fallback={<WorkspaceSectionLoading />}>
        {section === "overview" && (
          <ApplicantOverview
            workspace={workspace}
            onNavigate={navigate}
            submitted={submitted}
          />
        )}
        {section === "profile" && (
          <ApplicantProfileDraft workspace={workspace} onRefresh={onRefresh} />
        )}
        {section === "hours" && (
          <ApplicantHoursDraft workspace={workspace} onRefresh={onRefresh} />
        )}
        {section === "services" && (
          <ApplicantServicesDraft workspace={workspace} onRefresh={onRefresh} />
        )}
        {section === "status" && (
          <ApplicantStatus
            claim={workspace.claim}
            statusCenter={statusCenter}
            onNavigate={navigate}
          />
        )}
      </Suspense>
    </ProviderAppShell>
  );
}
