import React from "react";
import { Building2, LayoutDashboard, Settings, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ProviderAppShell from "@/components/provider/shell/ProviderAppShell";
import ProfessionalProfileEditor from "./ProfessionalProfileEditor";
import {
  PROFESSIONAL_REVIEW_STATUS_LABELS,
  PROFESSIONAL_TYPE_LABELS,
} from "@/lib/professionalProfileCatalog";

const NAV_ITEMS = [
  { key: "overview", label: "Prezentare generală", icon: LayoutDashboard },
  { key: "profile", label: "Profil profesional", icon: UserRound },
  { key: "locations", label: "Locații asociate", icon: Building2 },
  { key: "settings", label: "Setări", icon: Settings },
];

function InfoCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Overview({ workspace, onNavigate }) {
  const professional = workspace.professional;
  const assignments = workspace.assignments || [];
  const reviewStatus = professional.profile_review_status || professional.public_visibility_status || "draft";
  const pendingReview = reviewStatus === "pending_review";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Cont profesional</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gestionează identitatea profesională și locațiile cu care ai confirmat asocierea.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Tip profesional" value={PROFESSIONAL_TYPE_LABELS[professional.professional_type] || "Specialist"} hint="Tipul profesional nu poate fi schimbat de o clinică sau optică." />
        <InfoCard label="Status profil" value={PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus} hint="Profilul devine public numai după completare și verificare." />
        <InfoCard label="Locații asociate" value={assignments.length} hint={`${workspace.public_assignment_count || 0} publice · ${workspace.private_assignment_count || 0} private`} />
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">{pendingReview ? "Profilul este în verificare" : "Completează profilul profesional"}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {pendingReview
                ? "Datele trimise sunt blocate temporar pentru editare. Profilul și asocierile rămân private până la decizia Vezunde."
                : "Adaugă numele public, fotografia, descrierea, domeniile profesionale și datele de contact, apoi trimite profilul spre verificare."}
            </p>
          </div>
          {!pendingReview && (
            <button onClick={() => onNavigate("profile")} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
              Completează profilul
            </button>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(0, Math.min(100, professional.profile_completeness || 0))}%` }} />
        </div>
        <div className="mt-2 text-right text-[11px] font-semibold text-muted-foreground">{professional.profile_completeness || 0}% complet</div>
      </section>
    </div>
  );
}

function Locations({ workspace }) {
  const assignments = workspace.assignments || [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locații asociate</h1>
        <p className="mt-1 text-xs text-muted-foreground">Asocierile sunt confirmate de tine. Publicarea la o locație este un pas separat.</p>
      </div>
      <div className="space-y-3">
        {assignments.length === 0 && <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu există locații asociate.</div>}
        {assignments.map((assignment) => (
          <section key={assignment.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">{assignment.location?.name || "Locație"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{[assignment.location?.city, assignment.location?.address].filter(Boolean).join(" · ") || "Adresă necompletată"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Asocierea confirmă faptul că activezi aici. Nu oferă acces la administrarea clinicii sau opticii.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${assignment.public_status === "public" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>
                {assignment.public_status === "public" ? "Public" : "Privat"}
              </span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Setări</h1>
      <p className="mt-2 text-sm text-muted-foreground">Notificările, disponibilitatea pentru mesaje și opțiunile planului profesional vor fi adăugate ulterior.</p>
    </section>
  );
}

export default function ProfessionalWorkspaceRoot({ user, workspace, onLogout, onSwitchPersonal, onRefresh }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("ps") || "overview";
  const safeSection = NAV_ITEMS.some((item) => item.key === section) ? section : "overview";
  const navigate = (key) => {
    const next = new URLSearchParams(params);
    next.set("ps", key);
    setParams(next);
  };
  const reviewStatus = workspace.professional?.profile_review_status || workspace.professional?.public_visibility_status || "draft";

  return (
    <ProviderAppShell
      navItems={NAV_ITEMS}
      activeKey={safeSection}
      onNavigate={navigate}
      user={user}
      onLogout={onLogout}
      title={workspace.professional?.public_display_name || workspace.professional?.full_name || "Cont profesional"}
      subtitle="Cont profesional"
      modeSwitch={onSwitchPersonal ? { label: "Cont personal", onClick: onSwitchPersonal } : null}
      statusBadge={<span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold sm:inline-flex">{PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus}</span>}
    >
      {safeSection === "overview" && <Overview workspace={workspace} onNavigate={navigate} />}
      {safeSection === "profile" && <ProfessionalProfileEditor workspace={workspace} onRefresh={onRefresh} />}
      {safeSection === "locations" && <Locations workspace={workspace} />}
      {safeSection === "settings" && <SettingsPanel />}
    </ProviderAppShell>
  );
}
